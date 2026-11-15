type Kind = 'estimate' | 'final-bill';
interface BaseDocClaim { billCheck?: { baseDocument?: string } }

/** Where a Bill Check upload is filed: the bill as 'invoice', the estimate as 'estimate'. */
export function billCheckUploadDocType(upload: Kind): 'invoice' | 'estimate' {
  return upload === 'final-bill' ? 'invoice' : 'estimate';
}

/** Where an Assessment upload is filed: 'invoice' in a claim made from the bill, else 'estimate'. */
export function assessmentUploadDocType(claim: BaseDocClaim | null): 'invoice' | 'estimate' {
  return claim?.billCheck?.baseDocument === 'final-bill' ? 'invoice' : 'estimate';
}

/** True on a claim's first Assessment upload: no rows and no baseDocument chosen yet. */
export function asksDocumentKind(claim: (BaseDocClaim & { assessmentRows?: unknown[] }) | null): boolean {
  return !!claim && !claim.assessmentRows?.length && !claim.billCheck?.baseDocument;
}

/** The other answer, for Undo. */
export function otherKind(k: Kind): Kind {
  return k === 'estimate' ? 'final-bill' : 'estimate';
}

/** The doc type an Estimate / Final bill answer files as. */
export function docTypeForAnswer(k: Kind): 'invoice' | 'estimate' {
  return k === 'final-bill' ? 'invoice' : 'estimate';
}

/** Undo may flip the claim's mode only while the claim it was answered on is still the current one. */
export function shouldApplyUndo(currentId: string | undefined, claimId: string): boolean {
  return !!currentId && currentId === claimId;
}
