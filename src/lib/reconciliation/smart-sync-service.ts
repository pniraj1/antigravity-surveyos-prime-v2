// ═══════════════════════════════════════════════════════════
// SMART RECONCILIATION SYNC ENGINE
//
// Features:
// - Deduplication: Skips previously settled or dismissed payment emails.
// - Smart Caching: Reuses cached voucher extractions to avoid redundant AI calls.
// - Background Resiliency: Progress reporting and AbortSignal support.
// - Unmatched Recycling: Re-matches existing unmatched vouchers against new claims.
// - Instant Local Matching: Matches active claims against cached vouchers with 0 network calls.
// ═══════════════════════════════════════════════════════════

import type {
  PaymentMatchResult,
  PaymentAdviceClaimItem,
  PaymentAdvice,
  InsurerSenderConfig,
  CachedPaymentAdviceRecord,
} from '@/types/payment-reconciliation';
import {
  buildGmailSearchQuery,
  listGmailMessageIds,
  fetchPaymentEmailDetailsById,
  fetchGmailAttachmentBlob,
} from './gmail-fetcher';
import {
  isEmailSettledOrDismissed,
  getCachedAdvicesByMessageId,
  getAllUnmatchedCachedAdvices,
  saveCachedAdvice,
  saveProcessedEmail,
} from './advice-cache';
import {
  extractPaymentAdviceFromFile,
  extractPaymentAdviceFromText,
} from '@/lib/ai/payment-advice-extractor';
import { matchPaymentAdvicesToClaims } from './matcher';

export interface SyncProgressUpdate {
  phase: 'listing' | 'filtering' | 'processing' | 'matching' | 'complete' | 'cancelled';
  current: number;
  total: number;
  message: string;
}

export interface SmartSyncOptions {
  accessToken: string;
  senders: InsurerSenderConfig[];
  activeClaims: Array<{
    id: string;
    claimNo?: string;
    vehicleNo?: string;
    feeTotal?: number;
    reportNo?: string;
    feePaid?: boolean;
  }>;
  daysBack?: number;
  maxResults?: number;
  forceRescan?: boolean;
  signal?: AbortSignal;
  onProgress?: (update: SyncProgressUpdate) => void;
}

export interface SmartSyncResult {
  matches: PaymentMatchResult[];
  unmatchedAdvices: PaymentAdviceClaimItem[];
  stats: {
    totalFound: number;
    skippedSettled: number;
    cachedReused: number;
    newlyParsed: number;
    matchesCount: number;
  };
  cancelled?: boolean;
}

/**
 * Runs intelligent reconciliation sync:
 * 1. Queries Gmail using targeted search queries.
 * 2. Checks local deduplication index to skip settled/dismissed emails.
 * 3. Reuses cached payment advice records for previously seen messages.
 * 4. Downloads attachments or parses email text for newly received emails.
 * 5. Pulls previously unmatched cached vouchers so newly created claims match instantly.
 * 6. Executes deterministic matching against active surveyor claims.
 */
export async function runSmartReconciliationSync(
  options: SmartSyncOptions
): Promise<SmartSyncResult> {
  const stats = {
    totalFound: 0,
    skippedSettled: 0,
    cachedReused: 0,
    newlyParsed: 0,
    matchesCount: 0,
  };

  const {
    accessToken,
    senders = [],
    activeClaims = [],
    daysBack,
    maxResults = 25,
    forceRescan = false,
    signal,
    onProgress,
  } = options;

  if (signal?.aborted) {
    onProgress?.({
      phase: 'cancelled',
      current: 0,
      total: 0,
      message: 'Sync cancelled by user',
    });
    return {
      matches: [],
      unmatchedAdvices: [],
      stats,
      cancelled: true,
    };
  }

  onProgress?.({
    phase: 'listing',
    current: 0,
    total: 0,
    message: 'Searching Gmail for payment advice emails...',
  });

  const query = buildGmailSearchQuery(senders, daysBack);
  const messageRefs = await listGmailMessageIds(accessToken, query, maxResults);
  stats.totalFound = messageRefs.length;

  if (signal?.aborted) {
    onProgress?.({
      phase: 'cancelled',
      current: 0,
      total: messageRefs.length,
      message: 'Sync cancelled by user',
    });
    return {
      matches: [],
      unmatchedAdvices: [],
      stats,
      cancelled: true,
    };
  }

  const collectedAdvicesMap = new Map<string, CachedPaymentAdviceRecord>();

  for (let i = 0; i < messageRefs.length; i++) {
    if (signal?.aborted) {
      onProgress?.({
        phase: 'cancelled',
        current: i,
        total: messageRefs.length,
        message: 'Sync cancelled by user',
      });
      return {
        matches: [],
        unmatchedAdvices: [],
        stats,
        cancelled: true,
      };
    }

    const msg = messageRefs[i];

    // 1. Skip settled or dismissed emails (unless forceRescan is requested)
    if (!forceRescan && (await isEmailSettledOrDismissed(msg.id))) {
      stats.skippedSettled++;
      onProgress?.({
        phase: 'filtering',
        current: i + 1,
        total: messageRefs.length,
        message: `Skipped settled email ${msg.id}`,
      });
      continue;
    }

    // 2. Reuse cached advice if previously parsed
    const cachedAdvices = !forceRescan ? await getCachedAdvicesByMessageId(msg.id) : [];
    if (cachedAdvices && cachedAdvices.length > 0) {
      stats.cachedReused++;
      onProgress?.({
        phase: 'filtering',
        current: i + 1,
        total: messageRefs.length,
        message: `Reusing cached advice for email ${msg.id}`,
      });
      for (const record of cachedAdvices) {
        collectedAdvicesMap.set(record.id, record);
      }
      continue;
    }

    // 3. New email to process
    if (signal?.aborted) {
      onProgress?.({
        phase: 'cancelled',
        current: i,
        total: messageRefs.length,
        message: 'Sync cancelled by user',
      });
      return {
        matches: [],
        unmatchedAdvices: [],
        stats,
        cancelled: true,
      };
    }

    onProgress?.({
      phase: 'processing',
      current: i + 1,
      total: messageRefs.length,
      message: `Fetching email details ${i + 1} of ${messageRefs.length}...`,
    });

    const email = await fetchPaymentEmailDetailsById(accessToken, msg.id);

    if (signal?.aborted) {
      onProgress?.({
        phase: 'cancelled',
        current: i + 1,
        total: messageRefs.length,
        message: 'Sync cancelled by user',
      });
      return {
        matches: [],
        unmatchedAdvices: [],
        stats,
        cancelled: true,
      };
    }

    let advice: PaymentAdvice | null = null;
    const targetAttachment = email.attachments?.find((att) => {
      const name = (att.filename || '').toLowerCase();
      const mime = (att.mimeType || '').toLowerCase();
      return (
        name.endsWith('.pdf') ||
        name.endsWith('.zip') ||
        mime.includes('pdf') ||
        mime.includes('zip')
      );
    });

    if (targetAttachment) {
      onProgress?.({
        phase: 'processing',
        current: i + 1,
        total: messageRefs.length,
        message: `Extracting advice from attachment ${targetAttachment.filename}...`,
      });

      const blob = await fetchGmailAttachmentBlob(
        accessToken,
        email.id,
        targetAttachment.attachmentId
      );
      if (blob) {
        const file = new File([blob], targetAttachment.filename, {
          type: targetAttachment.mimeType || 'application/octet-stream',
        });
        advice = await extractPaymentAdviceFromFile(file);
      }
    }

    if (!advice || !advice.claims || advice.claims.length === 0) {
      const bodyText = email.bodyText || email.snippet;
      if (bodyText && bodyText.trim().length > 0) {
        onProgress?.({
          phase: 'processing',
          current: i + 1,
          total: messageRefs.length,
          message: `Extracting advice from email text...`,
        });
        advice = await extractPaymentAdviceFromText(bodyText, `Gmail: ${email.subject}`);
      }
    }

    if (advice && advice.claims && advice.claims.length > 0) {
      const adviceRecord: CachedPaymentAdviceRecord = {
        id: `adv_${msg.id}_0`,
        sourceMessageId: msg.id,
        claims: advice.claims,
        utrNumber: advice.utrNumber,
        paymentDate: advice.paymentDate,
        insurerName: advice.insurerName || email.from,
        extractedAt: new Date().toISOString(),
      };

      await saveCachedAdvice(adviceRecord);
      await saveProcessedEmail({
        messageId: msg.id,
        subject: email.subject,
        from: email.from,
        date: email.date,
        status: 'unmatched',
        utrNumber: advice.utrNumber,
        processedAt: new Date().toISOString(),
      });

      stats.newlyParsed++;
      collectedAdvicesMap.set(adviceRecord.id, adviceRecord);
    }
  }

  // Also load any existing cached unmatched advices from getAllUnmatchedCachedAdvices()
  // so newly created claims can match against previously seen unmatched vouchers!
  const existingUnmatched = await getAllUnmatchedCachedAdvices();
  for (const unmatched of existingUnmatched) {
    if (!collectedAdvicesMap.has(unmatched.id)) {
      collectedAdvicesMap.set(unmatched.id, unmatched);
    }
  }

  onProgress?.({
    phase: 'matching',
    current: collectedAdvicesMap.size,
    total: collectedAdvicesMap.size,
    message: `Matching payment advices against ${activeClaims.length} active claims...`,
  });

  const matches: PaymentMatchResult[] = [];
  const unmatchedAdvices: PaymentAdviceClaimItem[] = [];

  for (const adviceRecord of collectedAdvicesMap.values()) {
    const matchResults = matchPaymentAdvicesToClaims(
      adviceRecord.claims || [],
      activeClaims,
      adviceRecord.utrNumber || '',
      adviceRecord.paymentDate || '',
      adviceRecord.insurerName || ''
    );

    for (const res of matchResults) {
      if (res.status === 'matched') {
        matches.push(res);
      } else {
        unmatchedAdvices.push(res.adviceClaim);
      }
    }
  }

  stats.matchesCount = matches.length;

  onProgress?.({
    phase: 'complete',
    current: messageRefs.length,
    total: messageRefs.length,
    message: `Sync complete: ${matches.length} matched, ${unmatchedAdvices.length} unmatched`,
  });

  return {
    matches,
    unmatchedAdvices,
    stats,
  };
}

/**
 * Purely local matching helper:
 * Evaluates active claims against all existing unmatched cached advice vouchers in IndexedDB.
 * Requires 0 network requests and runs instantly on claim creation or modification.
 */
export async function checkCachedAdvicesAgainstClaims(
  activeClaims: Array<{
    id: string;
    claimNo?: string;
    vehicleNo?: string;
    feeTotal?: number;
    reportNo?: string;
    feePaid?: boolean;
  }>
): Promise<PaymentMatchResult[]> {
  const cachedAdvices = await getAllUnmatchedCachedAdvices();
  const matchedResults: PaymentMatchResult[] = [];

  for (const record of cachedAdvices) {
    const results = matchPaymentAdvicesToClaims(
      record.claims || [],
      activeClaims || [],
      record.utrNumber || '',
      record.paymentDate || '',
      record.insurerName || ''
    );

    for (const res of results) {
      if (res.status === 'matched') {
        matchedResults.push(res);
      }
    }
  }

  return matchedResults;
}
