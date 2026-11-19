'use client';

import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { useUIStore } from '@/stores/ui-store';
import { getClaim, saveClaim } from '@/lib/storage/indexeddb';
import { calculateFeeSummary } from '@/lib/calculations/fees';
import { getDriveToken } from '@/lib/drive';
import {
  extractPaymentAdviceFromFile,
  extractPaymentAdviceFromText,
} from '@/lib/ai/payment-advice-extractor';
import { matchPaymentAdvicesToClaims } from '@/lib/reconciliation/matcher';
import { loadSavedSenders } from '@/lib/reconciliation/sample-store';
import {
  buildGmailSearchQuery,
  fetchRecentPaymentEmails,
} from '@/lib/reconciliation/gmail-fetcher';
import type { PaymentMatchResult } from '@/types/payment-reconciliation';
import { ReconciliationKPICards } from '@/components/reconciliation/ReconciliationKPICards';
import { PaymentMatchQueue } from '@/components/reconciliation/PaymentMatchQueue';
import { ClaimsLedgerTable } from '@/components/reconciliation/ClaimsLedgerTable';
import { SenderManagerModal } from '@/components/reconciliation/SenderManagerModal';
import { toast } from 'sonner';
import { UploadCloud } from 'lucide-react';

export function PaymentReconciliationTab() {
  const storeClaimsList = useClaimStore((s) => s.claimsList);
  const setClaimsList = useClaimStore((s) => s.setClaimsList);
  const loadClaim = useClaimStore((s) => s.loadClaim);

  const claimsList =
    storeClaimsList && storeClaimsList.length > 0
      ? storeClaimsList
      : useClaimStore.getState().claimsList || [];

  const { setActiveTab } = useUIStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [matches, setMatches] = useState<PaymentMatchResult[]>([]);
  const [isCheckingGmail, setIsCheckingGmail] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [isSenderModalOpen, setIsSenderModalOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Active claims subset for calculation and ledger
  const activeClaims = useMemo(() => {
    return (claimsList || []).filter((c) => c.isActive !== false);
  }, [claimsList]);

  // Zone 1: Compute KPI summaries across active claims
  const kpis = useMemo(() => {
    let totalBilled = 0;
    let totalReceived = 0;
    let pendingAmount = 0;
    let pendingCount = 0;
    let totalTds = 0;

    for (const claim of activeClaims) {
      const billed = claim.feeTotal || 0;
      totalBilled += billed;

      if (claim.feePaid) {
        // Received in Bank: amountReceived if recorded, else billed feeTotal
        const rec =
          claim.amountReceived !== undefined && claim.amountReceived > 0
            ? claim.amountReceived
            : billed;
        totalReceived += rec;
      } else {
        pendingAmount += billed;
        pendingCount++;
      }

      if (claim.tdsDeducted && claim.tdsDeducted > 0) {
        totalTds += claim.tdsDeducted;
      }
    }

    return {
      totalBilled,
      totalReceived,
      pendingAmount,
      pendingCount,
      totalTds,
    };
  }, [activeClaims]);

  // File parsing & matching helper
  const processUploadedFile = useCallback(
    async (file: File) => {
      setIsProcessingFile(true);
      try {
        let advice = null;
        const ext = file.name.split('.').pop()?.toLowerCase();

        if (ext === 'txt' || ext === 'csv' || file.type === 'text/plain') {
          const text = await file.text();
          advice = await extractPaymentAdviceFromText(text, file.name);
        } else {
          advice = await extractPaymentAdviceFromFile(file);
        }

        if (!advice || !advice.claims || advice.claims.length === 0) {
          toast.warning(`No payment advice line items found in "${file.name}"`);
          return;
        }

        // Map claimsList to match targets
        const matchTargets = activeClaims.map((c) => ({
          id: c.id,
          claimNo: c.claimNo,
          vehicleNo: c.vehicleNo,
          feeTotal: c.feeTotal,
          reportNo: c.reportNo,
          feePaid: c.feePaid,
        }));

        const newMatches = matchPaymentAdvicesToClaims(
          advice.claims,
          matchTargets,
          advice.utrNumber,
          advice.paymentDate,
          advice.insurerName
        );

        setMatches((prev) => {
          // Merge avoiding identical IDs
          const existingIds = new Set(prev.map((m) => m.id));
          const additions = newMatches.filter((m) => !existingIds.has(m.id));
          return [...prev, ...additions];
        });

        const matchedCount = newMatches.filter((m) => m.status === 'matched').length;
        toast.success(
          `Extracted ${newMatches.length} payment line item(s) (${matchedCount} matched)`
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'File parsing error';
        toast.error(`Failed to parse payment advice: ${msg}`);
      } finally {
        setIsProcessingFile(false);
      }
    },
    [activeClaims]
  );

  // File Input Handler
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
    // reset input value so re-uploading same file triggers change
    e.target.value = '';
  };

  // Drag and drop handlers on cockpit container
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  // Check Gmail for payment emails
  const handleCheckGmail = async () => {
    const token = getDriveToken();
    if (!token) {
      toast.error('Google Workspace is not connected', {
        description:
          'Please link your Google account in the Save Status bar or Cloud Vault tab to search Gmail.',
      });
      return;
    }

    setIsCheckingGmail(true);
    try {
      const senders = loadSavedSenders();
      const query = buildGmailSearchQuery(senders, 30);
      toast.info('Searching Gmail for insurer payment advices...');

      const emails = await fetchRecentPaymentEmails(token, query, 5);
      if (!emails || emails.length === 0) {
        toast.info('No payment advice emails found in the last 30 days');
        return;
      }

      toast.info(`Found ${emails.length} potential payment email(s). Extracting details...`);

      let totalExtracted = 0;
      const matchTargets = activeClaims.map((c) => ({
        id: c.id,
        claimNo: c.claimNo,
        vehicleNo: c.vehicleNo,
        feeTotal: c.feeTotal,
        reportNo: c.reportNo,
        feePaid: c.feePaid,
      }));

      const collectedMatches: PaymentMatchResult[] = [];

      for (const email of emails) {
        const textContent = email.bodyText || email.snippet;
        if (!textContent) continue;

        const advice = await extractPaymentAdviceFromText(textContent, `Gmail: ${email.subject}`);
        if (advice && advice.claims && advice.claims.length > 0) {
          totalExtracted += advice.claims.length;
          const adviceMatches = matchPaymentAdvicesToClaims(
            advice.claims,
            matchTargets,
            advice.utrNumber,
            advice.paymentDate,
            advice.insurerName || email.from
          );
          collectedMatches.push(...adviceMatches);
        }
      }

      if (collectedMatches.length > 0) {
        setMatches((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const additions = collectedMatches.filter((m) => !existingIds.has(m.id));
          return [...prev, ...additions];
        });
        toast.success(`Processed ${totalExtracted} payment remittance item(s) from Gmail`);
      } else {
        toast.info('No structured remittance data could be parsed from the payment emails');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gmail search failed';
      toast.error(`Gmail Check Failed: ${msg}`);
    } finally {
      setIsCheckingGmail(false);
    }
  };

  // Manual claim assignment for unmatched advice items
  const handleAssignManualClaim = (matchId: string, claimId: string) => {
    const target = activeClaims.find((c) => c.id === claimId);
    if (!target) return;

    setMatches((prev) =>
      prev.map((m) => {
        if (m.id !== matchId) return m;
        return {
          ...m,
          matchedClaimId: claimId,
          vehicleNo: target.vehicleNo || m.vehicleNo,
          reportNo: target.reportNo,
          billedTotal: target.feeTotal || 0,
          status: 'matched' as const,
          confidence: 'manual' as const,
        };
      })
    );
    toast.success(`Assigned item to claim ${target.vehicleNo || target.label}`);
  };

  // Confirm & Settle selected matched claims
  const handleConfirmSettle = async (selectedMatches: PaymentMatchResult[]) => {
    if (!selectedMatches || selectedMatches.length === 0) return;

    setIsSettling(true);
    let settledCount = 0;

    try {
      const settledClaimIds = new Set<string>();

      for (const item of selectedMatches) {
        if (!item.matchedClaimId) continue;

        try {
          const fullClaim = await getClaim(item.matchedClaimId);
          if (fullClaim) {
            const netPaid = item.adviceClaim.netPaid || item.billedTotal;
            const tds =
              item.adviceClaim.tdsAmount ??
              (item.adviceClaim.grossFee ? Math.max(0, item.adviceClaim.grossFee - netPaid) : 0);

            const updatedClaim = {
              ...fullClaim,
              feeBill: {
                ...fullClaim.feeBill,
                feePaid: true,
                paymentStatus: 'paid' as const,
                amountReceived: netPaid,
                tdsDeducted: tds,
                utrNumber: item.utrNumber || fullClaim.feeBill?.utrNumber || '',
                paymentDate: item.paymentDate || new Date().toISOString().split('T')[0],
                paymentAdviceSource: item.insurerName || 'Payment Advice',
              },
            };

            await saveClaim(updatedClaim);
            settledClaimIds.add(item.matchedClaimId);
            settledCount++;
          }
        } catch (itemErr) {
          console.error(`Failed to settle claim ${item.matchedClaimId}:`, itemErr);
        }
      }

      // Update in-memory Zustand store immediately for instantaneous UI update
      if (settledCount > 0) {
        const updatedList = claimsList.map((c) => {
          if (settledClaimIds.has(c.id)) {
            const matchingItem = selectedMatches.find((m) => m.matchedClaimId === c.id);
            const net = matchingItem?.adviceClaim.netPaid || c.feeTotal;
            const tds = matchingItem?.adviceClaim.tdsAmount || 0;
            return {
              ...c,
              feePaid: true,
              paymentStatus: 'paid' as const,
              amountReceived: net,
              tdsDeducted: tds,
              utrNumber: matchingItem?.utrNumber || c.utrNumber,
              paymentDate: matchingItem?.paymentDate || c.paymentDate,
            };
          }
          return c;
        });
        setClaimsList(updatedList);

        // Remove settled items from matches queue
        const settledMatchIds = new Set(selectedMatches.map((m) => m.id));
        setMatches((prev) => prev.filter((m) => !settledMatchIds.has(m.id)));

        // Broadcast sync
        try {
          const channel = new BroadcastChannel('surveyos_claims_sync');
          channel.postMessage('CLAIMS_UPDATED');
          channel.close();
        } catch {
          // ignore
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('surveyos_claims_updated'));
        }

        toast.success(`Successfully confirmed and settled ${settledCount} claim payment(s)`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Settlement failed';
      toast.error(`Error settling payments: ${msg}`);
    } finally {
      setIsSettling(false);
    }
  };

  // Quick toggle paid / unpaid on a claim from the ledger table
  const handleTogglePaid = async (claimId: string, currentPaid: boolean) => {
    try {
      const fullClaim = await getClaim(claimId);
      const newPaid = !currentPaid;

      if (fullClaim) {
        const billedGrandTotal = fullClaim.feeBill
          ? calculateFeeSummary(fullClaim.feeBill).grandTotal
          : 0;

        const updatedClaim = {
          ...fullClaim,
          feeBill: {
            ...fullClaim.feeBill,
            feePaid: newPaid,
            paymentStatus: newPaid ? ('paid' as const) : ('unpaid' as const),
            amountReceived: newPaid
              ? fullClaim.feeBill?.amountReceived || billedGrandTotal
              : 0,
          },
        };

        await saveClaim(updatedClaim);
      }

      // Update in-memory Zustand store immediately
      const updatedList = claimsList.map((c) => {
        if (c.id === claimId) {
          return {
            ...c,
            feePaid: newPaid,
            paymentStatus: newPaid ? ('paid' as const) : ('unpaid' as const),
            amountReceived: newPaid ? c.amountReceived || c.feeTotal : 0,
          };
        }
        return c;
      });
      setClaimsList(updatedList);

      // Broadcast sync
      try {
        const channel = new BroadcastChannel('surveyos_claims_sync');
        channel.postMessage('CLAIMS_UPDATED');
        channel.close();
      } catch {
        // ignore
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('surveyos_claims_updated'));
      }

      toast.success(newPaid ? 'Claim marked as Paid' : 'Claim marked as Unpaid');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      toast.error(`Failed to update payment status: ${msg}`);
    }
  };

  // Open full claim details when clicked in ledger
  const handleSelectClaim = async (claimId: string) => {
    try {
      const claim = await getClaim(claimId);
      if (claim) {
        loadClaim(claim);
        setActiveTab('details');
      }
    } catch {
      // ignore
    }
  };

  return (
    <div
      data-testid="payment-reconciliation-tab"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`p-6 max-w-7xl mx-auto space-y-6 min-h-screen transition-colors ${
        isDraggingOver ? 'bg-amber-500/5 ring-2 ring-amber-500/40 rounded-2xl' : ''
      }`}
    >
      {/* Page Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Payment Reconciliation
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Match insurer payment remittances, bank statement credits, and TDS deductions against survey fee bills
          </p>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.csv,image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Drag Overlay Hint */}
      {isDraggingOver && (
        <div className="p-4 rounded-xl border-2 border-dashed border-amber-500 bg-amber-500/10 text-center text-amber-500 font-medium text-xs flex items-center justify-center gap-2">
          <UploadCloud className="w-4 h-4 animate-bounce" />
          <span>Drop payment advice PDF, text file, bank statement, or image here to parse</span>
        </div>
      )}

      {/* Zone 1: Top KPI Strip & Action Buttons */}
      <ReconciliationKPICards
        totalBilled={kpis.totalBilled}
        totalReceived={kpis.totalReceived}
        pendingAmount={kpis.pendingAmount}
        pendingCount={kpis.pendingCount}
        totalTds={kpis.totalTds}
        onCheckGmail={handleCheckGmail}
        onUploadClick={() => fileInputRef.current?.click()}
        onOpenSenders={() => setIsSenderModalOpen(true)}
        isCheckingGmail={isCheckingGmail}
        isProcessingFile={isProcessingFile}
      />

      {/* Zone 2: Matching Queue (shown when queue has advice items) */}
      <PaymentMatchQueue
        matches={matches}
        claimsList={activeClaims}
        onConfirmSettle={handleConfirmSettle}
        onDismissMatch={(id) => setMatches((prev) => prev.filter((m) => m.id !== id))}
        onClearQueue={() => setMatches([])}
        onAssignManualClaim={handleAssignManualClaim}
        isSettling={isSettling}
      />

      {/* Zone 3: Master Claims Fee Ledger */}
      <ClaimsLedgerTable
        claims={activeClaims}
        onTogglePaid={handleTogglePaid}
        onSelectClaim={handleSelectClaim}
      />

      {/* Verified Senders Configuration Modal */}
      <SenderManagerModal
        isOpen={isSenderModalOpen}
        onClose={() => setIsSenderModalOpen(false)}
      />
    </div>
  );
}

export default PaymentReconciliationTab;
