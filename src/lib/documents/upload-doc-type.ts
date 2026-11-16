import type { ClaimData } from '@/types';
import { isFromBill, switchPrompt } from '@/lib/reports/bill-check-mode';

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

/** Every Assessment upload asks Estimate or Final bill. */
export function asksDocumentKind(claim: object | null): boolean {
  return !!claim;
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

/**
 * The Assessment answer is the claim's BASE document; setBillCheckUpload and switchPrompt take the
 * Bill Check UPLOAD kind, which is the opposite. Null when the answer is already the claim's base.
 */
export function assessmentSwitch(claim: ClaimData, answer: Kind): { upload: Kind; prompt: string | null } | null {
  if (answer === (isFromBill(claim) ? 'final-bill' : 'estimate')) return null;
  const upload = otherKind(answer);
  return { upload, prompt: switchPrompt(claim, upload) };
}
