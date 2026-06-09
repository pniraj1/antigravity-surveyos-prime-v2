// ═══════════════════════════════════════════════════════════
// SYNC BRIDGE — shared DTOs (match the Worker's response shapes)
// ═══════════════════════════════════════════════════════════

/** Standard envelope returned by every bridge route. */
export interface BridgeResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** A claim shown as a "folder" in the Sync drive picker. */
export interface SyncClaimSummary {
  claimId: string;
  label: string; // "MH12AB1234 - HDFC ERGO"
  vehicleNumber: string;
  insuranceCompany: string;
  modelMake: string;
  status: string;
  totalDocs: number;
  receivedDocs: number;
}

/** A single document inside a claim. */
export interface SyncDocMeta {
  docId: string;
  docType: string;
  status: string;
  mimeType: string;
  fileSizeKb: number;
  uploadedAt: string;
  fileCount: number;
}

/** Detail payload for one claim. */
export interface SyncClaimDetail {
  claimId: string;
  vehicleNumber: string;
  insuranceCompany: string;
  modelMake: string;
  documents: SyncDocMeta[];
}
