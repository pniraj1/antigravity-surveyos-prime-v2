import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  runSmartReconciliationSync,
  checkCachedAdvicesAgainstClaims,
} from '../smart-sync-service';
import {
  listGmailMessageIds,
  fetchPaymentEmailDetailsById,
  fetchGmailAttachmentBlob,
} from '../gmail-fetcher';
import {
  isEmailSettledOrDismissed,
  getCachedAdvicesByMessageId,
  getAllUnmatchedCachedAdvices,
  saveCachedAdvice,
  saveProcessedEmail,
} from '../advice-cache';
import {
  extractPaymentAdviceFromFile,
  extractPaymentAdviceFromText,
} from '@/lib/ai/payment-advice-extractor';

// Mock dependencies
vi.mock('../gmail-fetcher', () => ({
  buildGmailSearchQuery: vi.fn().mockReturnValue('mock-search-query'),
  listGmailMessageIds: vi.fn(),
  fetchPaymentEmailDetailsById: vi.fn(),
  fetchGmailAttachmentBlob: vi.fn(),
}));

vi.mock('../advice-cache', () => ({
  isEmailSettledOrDismissed: vi.fn(),
  getCachedAdvicesByMessageId: vi.fn(),
  getAllUnmatchedCachedAdvices: vi.fn(),
  saveCachedAdvice: vi.fn(),
  saveProcessedEmail: vi.fn(),
}));

vi.mock('@/lib/ai/payment-advice-extractor', () => ({
  extractPaymentAdviceFromFile: vi.fn(),
  extractPaymentAdviceFromText: vi.fn(),
}));

describe('Smart Reconciliation Sync Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAllUnmatchedCachedAdvices).mockResolvedValue([]);
    vi.mocked(getCachedAdvicesByMessageId).mockResolvedValue([]);
    vi.mocked(isEmailSettledOrDismissed).mockResolvedValue(false);
  });

  it('skips settled emails when forceRescan is false', async () => {
    vi.mocked(listGmailMessageIds).mockResolvedValue([{ id: 'msg-settled-1' }]);
    vi.mocked(isEmailSettledOrDismissed).mockResolvedValue(true);

    const result = await runSmartReconciliationSync({
      accessToken: 'token-xyz',
      senders: [],
      activeClaims: [],
      forceRescan: false,
    });

    expect(isEmailSettledOrDismissed).toHaveBeenCalledWith('msg-settled-1');
    expect(fetchPaymentEmailDetailsById).not.toHaveBeenCalled();
    expect(extractPaymentAdviceFromFile).not.toHaveBeenCalled();
    expect(extractPaymentAdviceFromText).not.toHaveBeenCalled();

    expect(result.stats.totalFound).toBe(1);
    expect(result.stats.skippedSettled).toBe(1);
    expect(result.stats.cachedReused).toBe(0);
    expect(result.stats.newlyParsed).toBe(0);
    expect(result.matches).toHaveLength(0);
  });

  it('processes settled emails when forceRescan is true', async () => {
    vi.mocked(listGmailMessageIds).mockResolvedValue([{ id: 'msg-settled-2' }]);
    vi.mocked(isEmailSettledOrDismissed).mockResolvedValue(true);
    vi.mocked(fetchPaymentEmailDetailsById).mockResolvedValue({
      id: 'msg-settled-2',
      threadId: 'th-1',
      subject: 'Payment Advice United India',
      from: 'uiic@service.com',
      date: '2026-11-20',
      snippet: 'payment disbursed',
      bodyText: 'Claim 2310023126C050058001 disbursed Rs 5468',
      attachments: [],
    });
    vi.mocked(extractPaymentAdviceFromText).mockResolvedValue({
      id: 'adv-rescan',
      insurerName: 'United India Insurance',
      paymentDate: '2026-11-20',
      utrNumber: 'AXISCN999888',
      totalAmount: 6076,
      totalTds: 608,
      netPaid: 5468,
      claims: [
        {
          claimNumber: '2310023126C050058001',
          vehicleNumber: 'MH 18 BZ 2552',
          grossFee: 6076,
          tdsAmount: 608,
          netPaid: 5468,
        },
      ],
      rawSource: 'test',
    });

    const activeClaims = [
      {
        id: 'claim-uiic-1',
        claimNo: '2310023126C050058001',
        vehicleNo: 'MH 18 BZ 2552',
        feeTotal: 6076,
      },
    ];

    const result = await runSmartReconciliationSync({
      accessToken: 'token-xyz',
      senders: [],
      activeClaims,
      forceRescan: true,
    });

    // Should NOT have skipped settled email
    expect(fetchPaymentEmailDetailsById).toHaveBeenCalledWith('token-xyz', 'msg-settled-2');
    expect(extractPaymentAdviceFromText).toHaveBeenCalled();
    expect(result.stats.skippedSettled).toBe(0);
    expect(result.stats.newlyParsed).toBe(1);
    expect(result.stats.matchesCount).toBe(1);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].matchedClaimId).toBe('claim-uiic-1');
  });

  it('reuses cached advice without calling fetchPaymentEmailDetailsById or AI extractor', async () => {
    vi.mocked(listGmailMessageIds).mockResolvedValue([{ id: 'msg-cached-10' }]);
    vi.mocked(isEmailSettledOrDismissed).mockResolvedValue(false);
    vi.mocked(getCachedAdvicesByMessageId).mockResolvedValue([
      {
        id: 'adv_msg-cached-10_0',
        sourceMessageId: 'msg-cached-10',
        claims: [
          {
            claimNumber: '16080231260190000009',
            vehicleNumber: 'MH-39-J-6873',
            grossFee: 1570,
            tdsAmount: 157,
            netPaid: 1413,
          },
        ],
        utrNumber: 'CMS123456',
        paymentDate: '2026-11-18',
        insurerName: 'The New India Assurance Co. Ltd.',
        extractedAt: '2026-11-18T10:00:00Z',
      },
    ]);

    const activeClaims = [
      {
        id: 'claim-nia-1',
        claimNo: '16080231260190000009',
        feeTotal: 1570,
      },
    ];

    const result = await runSmartReconciliationSync({
      accessToken: 'token-xyz',
      senders: [],
      activeClaims,
      forceRescan: false,
    });

    expect(getCachedAdvicesByMessageId).toHaveBeenCalledWith('msg-cached-10');
    expect(fetchPaymentEmailDetailsById).not.toHaveBeenCalled();
    expect(extractPaymentAdviceFromFile).not.toHaveBeenCalled();
    expect(extractPaymentAdviceFromText).not.toHaveBeenCalled();

    expect(result.stats.cachedReused).toBe(1);
    expect(result.stats.newlyParsed).toBe(0);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].matchedClaimId).toBe('claim-nia-1');
    expect(result.matches[0].confidence).toBe('exact_claim_no');
  });

  it('downloads attachment and extracts advice for new emails with PDF/ZIP attachment', async () => {
    vi.mocked(listGmailMessageIds).mockResolvedValue([{ id: 'msg-pdf-1' }]);
    vi.mocked(isEmailSettledOrDismissed).mockResolvedValue(false);
    vi.mocked(getCachedAdvicesByMessageId).mockResolvedValue([]);

    vi.mocked(fetchPaymentEmailDetailsById).mockResolvedValue({
      id: 'msg-pdf-1',
      threadId: 'th-pdf',
      subject: 'Payment Advice Attachment',
      from: 'accounts@hdfcergo.com',
      date: '2026-11-20',
      snippet: 'Please find attached advice',
      attachments: [
        {
          attachmentId: 'att-hdfc-99',
          filename: 'Advice_2026.pdf',
          mimeType: 'application/pdf',
          size: 4096,
        },
      ],
    });

    const mockBlob = new Blob(['dummy pdf byte data'], { type: 'application/pdf' });
    vi.mocked(fetchGmailAttachmentBlob).mockResolvedValue(mockBlob);

    vi.mocked(extractPaymentAdviceFromFile).mockResolvedValue({
      id: 'adv-pdf-parsed',
      insurerName: 'HDFC ERGO General Insurance',
      paymentDate: '2026-11-20',
      utrNumber: 'HDFC00112233',
      totalAmount: 4000,
      totalTds: 400,
      netPaid: 3600,
      claims: [
        {
          claimNumber: 'HDFC-CLM-888',
          vehicleNumber: 'MH02CD4567',
          grossFee: 4000,
          tdsAmount: 400,
          netPaid: 3600,
        },
      ],
      rawSource: 'Advice_2026.pdf',
    });

    const activeClaims = [
      {
        id: 'claim-hdfc-888',
        claimNo: 'HDFC-CLM-888',
        feeTotal: 4000,
      },
    ];

    const result = await runSmartReconciliationSync({
      accessToken: 'token-xyz',
      senders: [],
      activeClaims,
    });

    expect(fetchGmailAttachmentBlob).toHaveBeenCalledWith('token-xyz', 'msg-pdf-1', 'att-hdfc-99');
    expect(extractPaymentAdviceFromFile).toHaveBeenCalled();
    expect(saveCachedAdvice).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'adv_msg-pdf-1_0',
        sourceMessageId: 'msg-pdf-1',
        utrNumber: 'HDFC00112233',
      })
    );
    expect(saveProcessedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: 'msg-pdf-1',
        status: 'unmatched',
        utrNumber: 'HDFC00112233',
      })
    );

    expect(result.stats.newlyParsed).toBe(1);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].matchedClaimId).toBe('claim-hdfc-888');
  });

  it('falls back to email body text when no PDF/ZIP attachment exists', async () => {
    vi.mocked(listGmailMessageIds).mockResolvedValue([{ id: 'msg-body-only' }]);
    vi.mocked(isEmailSettledOrDismissed).mockResolvedValue(false);
    vi.mocked(getCachedAdvicesByMessageId).mockResolvedValue([]);

    vi.mocked(fetchPaymentEmailDetailsById).mockResolvedValue({
      id: 'msg-body-only',
      threadId: 'th-body',
      subject: 'Disbursement Notification',
      from: 'disburse@oriental.co.in',
      date: '2026-11-20',
      snippet: 'Disbursement of surveyor fee',
      bodyText: 'Payment advice details for Claim OIC-777 disbursed Rs 1350',
      attachments: [],
    });

    vi.mocked(extractPaymentAdviceFromText).mockResolvedValue({
      id: 'adv-text-parsed',
      insurerName: 'Oriental Insurance',
      paymentDate: '2026-11-20',
      utrNumber: 'OIC-UTR-777',
      totalAmount: 1500,
      totalTds: 150,
      netPaid: 1350,
      claims: [
        {
          claimNumber: 'OIC-777',
          grossFee: 1500,
          netPaid: 1350,
        },
      ],
      rawSource: 'Gmail: Disbursement Notification',
    });

    const result = await runSmartReconciliationSync({
      accessToken: 'token-xyz',
      senders: [],
      activeClaims: [],
    });

    expect(extractPaymentAdviceFromFile).not.toHaveBeenCalled();
    expect(extractPaymentAdviceFromText).toHaveBeenCalledWith(
      'Payment advice details for Claim OIC-777 disbursed Rs 1350',
      'Gmail: Disbursement Notification'
    );
    expect(result.stats.newlyParsed).toBe(1);
    expect(result.unmatchedAdvices).toHaveLength(1);
    expect(result.unmatchedAdvices[0].claimNumber).toBe('OIC-777');
  });

  it('aborts and returns cancelled: true when signal.aborted is triggered prior to sync', async () => {
    const controller = new AbortController();
    controller.abort();

    const onProgress = vi.fn();
    const result = await runSmartReconciliationSync({
      accessToken: 'token-xyz',
      senders: [],
      activeClaims: [],
      signal: controller.signal,
      onProgress,
    });

    expect(result.cancelled).toBe(true);
    expect(listGmailMessageIds).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'cancelled' })
    );
  });

  it('aborts and returns cancelled: true when signal.aborted is triggered mid-sync', async () => {
    vi.mocked(listGmailMessageIds).mockResolvedValue([
      { id: 'msg-abort-1' },
      { id: 'msg-abort-2' },
    ]);
    vi.mocked(isEmailSettledOrDismissed).mockResolvedValue(false);
    vi.mocked(getCachedAdvicesByMessageId).mockResolvedValue([]);

    const controller = new AbortController();

    vi.mocked(fetchPaymentEmailDetailsById).mockImplementation(async () => {
      controller.abort();
      return {
        id: 'msg-abort-1',
        threadId: 'th',
        subject: 'Sub',
        from: 'f@b.com',
        date: '2026-11-20',
        snippet: 'Snip',
        attachments: [],
      };
    });

    const onProgress = vi.fn();
    const result = await runSmartReconciliationSync({
      accessToken: 'token-xyz',
      senders: [],
      activeClaims: [],
      signal: controller.signal,
      onProgress,
    });

    expect(result.cancelled).toBe(true);
    expect(fetchPaymentEmailDetailsById).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'cancelled' })
    );
  });

  it('emits progress updates with correct counts and phases', async () => {
    vi.mocked(listGmailMessageIds).mockResolvedValue([
      { id: 'msg-p1' },
      { id: 'msg-p2' },
    ]);
    vi.mocked(isEmailSettledOrDismissed).mockImplementation(async (id) => id === 'msg-p1');
    vi.mocked(getCachedAdvicesByMessageId).mockResolvedValue([]);
    vi.mocked(fetchPaymentEmailDetailsById).mockResolvedValue({
      id: 'msg-p2',
      threadId: 'th-2',
      subject: 'Subject 2',
      from: 'from@test.com',
      date: '2026-11-20',
      snippet: 'Body snippet',
      attachments: [],
    });
    vi.mocked(extractPaymentAdviceFromText).mockResolvedValue({
      id: 'adv-p2',
      insurerName: 'Test Insurer',
      paymentDate: '2026-11-20',
      utrNumber: 'U-2',
      totalAmount: 1000,
      totalTds: 100,
      netPaid: 900,
      claims: [
        {
          claimNumber: 'C-2',
          grossFee: 1000,
          netPaid: 900,
        },
      ],
      rawSource: 'test',
    });

    const progressUpdates: Array<{ phase: string; current: number; total: number }> = [];
    const onProgress = vi.fn((update) => {
      progressUpdates.push({
        phase: update.phase,
        current: update.current,
        total: update.total,
      });
    });

    await runSmartReconciliationSync({
      accessToken: 'token-xyz',
      senders: [],
      activeClaims: [{ id: 'clm-target', claimNo: 'C-2', feeTotal: 1000 }],
      onProgress,
    });

    const phases = progressUpdates.map((u) => u.phase);
    expect(phases).toContain('listing');
    expect(phases).toContain('filtering');
    expect(phases).toContain('processing');
    expect(phases).toContain('matching');
    expect(phases).toContain('complete');

    const completeUpdate = progressUpdates.find((u) => u.phase === 'complete');
    expect(completeUpdate?.total).toBe(2);
  });

  it('matches against active claims and separates matches vs unmatched advices', async () => {
    vi.mocked(listGmailMessageIds).mockResolvedValue([{ id: 'msg-multi' }]);
    vi.mocked(isEmailSettledOrDismissed).mockResolvedValue(false);
    vi.mocked(getCachedAdvicesByMessageId).mockResolvedValue([]);

    vi.mocked(fetchPaymentEmailDetailsById).mockResolvedValue({
      id: 'msg-multi',
      threadId: 'th',
      subject: 'Batch Remittance',
      from: 'cms@bank.com',
      date: '2026-11-20',
      snippet: 'Batch remittance advice',
      attachments: [],
    });

    vi.mocked(extractPaymentAdviceFromText).mockResolvedValue({
      id: 'adv-multi',
      insurerName: 'ICICI Lombard',
      paymentDate: '2026-11-20',
      utrNumber: 'ICICIR555',
      totalAmount: 3500,
      totalTds: 350,
      netPaid: 3150,
      claims: [
        {
          claimNumber: 'CLM-MATCHED-100',
          grossFee: 2000,
          netPaid: 1800,
        },
        {
          claimNumber: 'CLM-UNMATCHED-200',
          grossFee: 1500,
          netPaid: 1350,
        },
      ],
      rawSource: 'test',
    });

    const activeClaims = [
      {
        id: 'claim-active-100',
        claimNo: 'CLM-MATCHED-100',
        feeTotal: 2000,
      },
    ];

    const result = await runSmartReconciliationSync({
      accessToken: 'token-xyz',
      senders: [],
      activeClaims,
    });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].matchedClaimId).toBe('claim-active-100');
    expect(result.matches[0].status).toBe('matched');

    expect(result.unmatchedAdvices).toHaveLength(1);
    expect(result.unmatchedAdvices[0].claimNumber).toBe('CLM-UNMATCHED-200');
    expect(result.stats.matchesCount).toBe(1);
  });

  it('re-matches existing unmatched cached advices from previous scans', async () => {
    vi.mocked(listGmailMessageIds).mockResolvedValue([]);
    vi.mocked(getAllUnmatchedCachedAdvices).mockResolvedValue([
      {
        id: 'adv-previous-1',
        sourceMessageId: 'old-msg-id',
        claims: [
          {
            claimNumber: 'PREV-UNMATCHED-CLAIM',
            vehicleNumber: 'KA-01-AB-1234',
            grossFee: 2500,
            netPaid: 2250,
          },
        ],
        utrNumber: 'PREV-UTR',
        paymentDate: '2026-11-05',
        insurerName: 'SBI General',
        extractedAt: '2026-11-05T00:00:00Z',
      },
    ]);

    const activeClaims = [
      {
        id: 'new-active-claim',
        claimNo: 'PREV-UNMATCHED-CLAIM',
        vehicleNo: 'KA-01-AB-1234',
        feeTotal: 2500,
      },
    ];

    const result = await runSmartReconciliationSync({
      accessToken: 'token-xyz',
      senders: [],
      activeClaims,
    });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].matchedClaimId).toBe('new-active-claim');
    expect(result.stats.matchesCount).toBe(1);
  });

  it('checkCachedAdvicesAgainstClaims matches local cached advices with 0 network calls', async () => {
    vi.mocked(getAllUnmatchedCachedAdvices).mockResolvedValue([
      {
        id: 'adv-local-store',
        sourceMessageId: 'msg-local-1',
        claims: [
          {
            claimNumber: 'LOCAL-MATCH-1',
            vehicleNumber: 'DL-01-XY-9999',
            grossFee: 1800,
            netPaid: 1620,
          },
        ],
        utrNumber: 'LOCAL-UTR-999',
        paymentDate: '2026-11-10',
        insurerName: 'National Insurance Company',
        extractedAt: '2026-11-10T12:00:00Z',
      },
    ]);

    const activeClaims = [
      {
        id: 'claim-local-target',
        claimNo: 'LOCAL-MATCH-1',
        vehicleNo: 'DL-01-XY-9999',
        feeTotal: 1800,
      },
    ];

    const matches = await checkCachedAdvicesAgainstClaims(activeClaims);

    expect(getAllUnmatchedCachedAdvices).toHaveBeenCalled();
    expect(listGmailMessageIds).not.toHaveBeenCalled();
    expect(fetchPaymentEmailDetailsById).not.toHaveBeenCalled();
    expect(fetchGmailAttachmentBlob).not.toHaveBeenCalled();
    expect(extractPaymentAdviceFromFile).not.toHaveBeenCalled();
    expect(extractPaymentAdviceFromText).not.toHaveBeenCalled();

    expect(matches).toHaveLength(1);
    expect(matches[0].matchedClaimId).toBe('claim-local-target');
    expect(matches[0].status).toBe('matched');
    expect(matches[0].confidence).toBe('exact_claim_no');
    expect(matches[0].utrNumber).toBe('LOCAL-UTR-999');
  });
});
