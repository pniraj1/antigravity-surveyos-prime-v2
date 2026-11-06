'use client';

import React, { useState, useCallback } from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { usePrintGate } from '@/hooks/usePrintGate';
import { rowsNeedingRemark } from '@/lib/reports/bill-check-projection';
import { billCheckFlags } from '@/lib/reports/bill-check-flags';
import { triggerUIICBillCheckPrint } from '@/lib/reports/uiic-final-builder';
import { triggerStandardPrint } from '@/lib/reports/standard-report-builder';
import { PendingRowsDialog } from '@/components/dialogs/PendingRowsDialog';
import { MissingRemarkDialog } from '@/components/dialogs/MissingRemarkDialog';
import { VerifyInvoiceDetailsDialog } from '@/components/dialogs/VerifyInvoiceDetailsDialog';
import type { ClaimData } from '@/types/claim';
import type { SurveyorProfile } from '@/types/vehicle';

export function useBillCheckPrintGate() {
  const currentClaim = useClaimStore((s) => s.currentClaim);
  const updateAssessmentRow = useClaimStore((s) => s.updateAssessmentRow);
  const updateClaim = useClaimStore((s) => s.updateClaim);
  const { profile } = useProfileStore();
  const { gate, gateDialog } = usePrintGate();

  const [verifyOpen, setVerifyOpen] = useState(false);
  const [pendingGate, setPendingGate] = useState(false);
  const [flagGate, setFlagGate] = useState(false);
  const [remarkWarning, setRemarkWarning] = useState(false);
  const [targetFormat, setTargetFormat] = useState<'standard' | 'uiic'>('standard');

  const executePrint = useCallback((fmt: 'standard' | 'uiic', claimOverride?: ClaimData) => {
    const latest = claimOverride ?? useClaimStore.getState().currentClaim ?? currentClaim;
    if (!latest) return;
    const gateKind = fmt === 'uiic' ? 'uiic-bill-check' : 'bill-check';
    gate(gateKind, () => {
      const activeClaim = useClaimStore.getState().currentClaim ?? latest;
      if (fmt === 'uiic') {
        triggerUIICBillCheckPrint(activeClaim, profile);
      } else {
        triggerStandardPrint(activeClaim, profile, 'bill-check');
      }
    });
  }, [currentClaim, profile, gate]);

  const requestPrint = useCallback((format: 'standard' | 'uiic') => {
    const claim = useClaimStore.getState().currentClaim ?? currentClaim;
    if (!claim) return;
    setTargetFormat(format);

    const bc = claim.billCheck || { billNo: '', billDate: '', billTotal: 0 };
    const allRows = claim.assessmentRows || [];
    const allowedRows = allRows.filter((r) => r.allowed);

    // ── Check 1: Invoice metadata verification ───────────────────
    const isInvoiceVerified =
      Boolean(bc.billNo?.trim()) &&
      Boolean(bc.billDate?.trim()) &&
      Boolean(bc.billTotal && bc.billTotal > 0) &&
      bc.verifiedBySurveyor === true;

    if (!isInvoiceVerified) {
      setVerifyOpen(true);
      return;
    }

    // ── Check 2: Pending rows ────────────────────────────────────
    const pending = allowedRows.filter((r) => !r.billStatus || r.billStatus === 'pending');
    if (pending.length > 0) {
      setPendingGate(true);
      return;
    }

    // ── Check 3: Blocking flags ──────────────────────────────────
    const flags = billCheckFlags(allRows);
    const blocking = flags.filter((f) => f.blocking);
    if (blocking.length > 0) {
      setFlagGate(true);
      return;
    }

    // ── Check 4: Missing remarks ─────────────────────────────────
    const remarks = rowsNeedingRemark(allowedRows);
    if (remarks.length > 0) {
      setRemarkWarning(true);
      return;
    }

    executePrint(format, claim);
  }, [currentClaim, executePrint]);

  const handleInvoiceVerified = (data: { billNo: string; billDate: string; billTotal: number }) => {
    const claim = useClaimStore.getState().currentClaim ?? currentClaim;
    if (!claim) return;

    const updatedClaim: ClaimData = {
      ...claim,
      billCheck: {
        ...claim.billCheck,
        billNo: data.billNo,
        billDate: data.billDate,
        billTotal: data.billTotal,
        verifiedBySurveyor: true,
        verifiedAt: new Date().toISOString(),
      },
    };

    updateClaim({ billCheck: updatedClaim.billCheck });
    setVerifyOpen(false);

    // Continue to next check after state update
    const allRows = updatedClaim.assessmentRows || [];
    const allowedRows = allRows.filter((r) => r.allowed);
    const pending = allowedRows.filter((r) => !r.billStatus || r.billStatus === 'pending');
    if (pending.length > 0) {
      setPendingGate(true);
      return;
    }
    const flags = billCheckFlags(allRows);
    const blocking = flags.filter((f) => f.blocking);
    if (blocking.length > 0) {
      setFlagGate(true);
      return;
    }
    const remarks = rowsNeedingRemark(allowedRows);
    if (remarks.length > 0) {
      setRemarkWarning(true);
      return;
    }

    executePrint(targetFormat, updatedClaim);
  };

  const resolveAllPending = () => {
    const claim = useClaimStore.getState().currentClaim ?? currentClaim;
    if (!claim) return;
    const pending = (claim.assessmentRows || []).filter(
      (r) => r.allowed && (!r.billStatus || r.billStatus === 'pending')
    );
    pending.forEach((r) =>
      updateAssessmentRow(r.id, { billStatus: 'not-in-bill', billedTaxable: 0, billedAmount: 0 })
    );
    setPendingGate(false);
    requestPrint(targetFormat);
  };

  const resolveAllFlags = () => {
    const claim = useClaimStore.getState().currentClaim ?? currentClaim;
    if (!claim) return;
    const flags = billCheckFlags(claim.assessmentRows || []);
    const blocking = flags.filter((f) => f.blocking);
    blocking.forEach((f) => updateAssessmentRow(f.rowId, { billVerified: true }));
    setFlagGate(false);
    requestPrint(targetFormat);
  };

  const activeClaim = currentClaim;
  const allRows = activeClaim?.assessmentRows || [];
  const allowedRows = allRows.filter((r) => r.allowed);
  const pendingRows = allowedRows.filter((r) => !r.billStatus || r.billStatus === 'pending');
  const flags = billCheckFlags(allRows);
  const blockingFlags = flags.filter((f) => f.blocking);
  const remarkRows = rowsNeedingRemark(allowedRows);
  const bc = activeClaim?.billCheck || { billNo: '', billDate: '', billTotal: 0 };

  const dialogs = (
    <>
      {verifyOpen && (
        <VerifyInvoiceDetailsDialog
          open={verifyOpen}
          initialBillNo={bc.billNo || ''}
          initialBillDate={bc.billDate || ''}
          initialBillTotal={bc.billTotal || 0}
          onConfirm={handleInvoiceVerified}
          onCancel={() => setVerifyOpen(false)}
        />
      )}

      {pendingGate && (
        <PendingRowsDialog
          rows={pendingRows}
          onResolveAll={resolveAllPending}
          onCancel={() => setPendingGate(false)}
        />
      )}

      {flagGate && (
        <PendingRowsDialog
          rows={allRows.filter((r) => blockingFlags.some((f) => f.rowId === r.id))}
          title={`${blockingFlags.length} item${blockingFlags.length === 1 ? '' : 's'} not yet checked against the bill`}
          body="The bill and your assessment disagree on these. Look at each before issuing — the claim has already been capped where the workshop billed less."
          resolveLabel="Confirm all"
          onResolveAll={resolveAllFlags}
          onCancel={() => setFlagGate(false)}
        />
      )}

      {remarkWarning && (
        <MissingRemarkDialog
          rows={remarkRows}
          onPrintAnyway={() => {
            setRemarkWarning(false);
            executePrint(targetFormat);
          }}
          onCancel={() => setRemarkWarning(false)}
        />
      )}

      {gateDialog}
    </>
  );

  return {
    requestPrint,
    dialogs,
  };
}
