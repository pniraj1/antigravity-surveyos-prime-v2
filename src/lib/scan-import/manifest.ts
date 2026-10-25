/** `_surveyos-scan.json`, as written by SurveyOS Scan (export/Manifest.kt). Unknown keys are ignored. */

export const MANIFEST_NAME = '_surveyos-scan.json';

export interface ScanPhotoMeta {
  takenAt: string;
  timeSource: string;
  editedAt: string | null;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  address: string | null;
}

export interface ScanManifestFile {
  /** Path inside the claim folder, `/`-separated. */
  path: string;
  /** Prime DocType key (Scan writes it under the JSON key `type`). */
  type: string;
  pages: string[];
  sha256: string;
  photo?: ScanPhotoMeta;
}

export interface ScanManifest {
  app: 'surveyos-scan';
  v: number;
  vehicle: string;
  insurer: string;
  claimNo: string | null;
  exportedAt: string;
  files: ScanManifestFile[];
  /** Spot/valuation notes; typed and consumed by the notes importer. */
  notes?: unknown;
  claimId?: string;
}

export interface FoundManifest {
  /** '' when the manifest is at the zip root, else 'Folder/'. */
  root: string;
  manifest: ScanManifest;
}

const NOT_SCAN = 'Not a SurveyOS Scan export';

/**
 * Finds the Scan manifest. A Home-screen share holds one `<folder>/_surveyos-scan.json` per claim:
 * the one whose vehicle matches `claimVehicle` is used; a single manifest is used as-is (the caller
 * runs the mismatch confirm); several with no match are refused.
 */
export async function findManifest(files: Map<string, Blob>, claimVehicle = ''): Promise<FoundManifest> {
  const found: FoundManifest[] = [];
  for (const [path, blob] of files) {
    const parts = path.split('/');
    if (parts[parts.length - 1] !== MANIFEST_NAME || parts.length > 2) continue;
    let manifest: ScanManifest;
    try {
      manifest = JSON.parse(await blob.text()) as ScanManifest;
    } catch {
      throw new Error(NOT_SCAN);
    }
    if (!manifest || manifest.app !== 'surveyos-scan' || !Array.isArray(manifest.files)) {
      throw new Error(NOT_SCAN);
    }
    found.push({ root: parts.length === 2 ? `${parts[0]}/` : '', manifest });
  }
  if (found.length === 0) throw new Error(NOT_SCAN);
  if (found.length === 1) return found[0];
  const match = found.find((f) => sameVehicle(f.manifest.vehicle, claimVehicle));
  if (match) return match;
  const vehicles = found.map((f) => f.manifest.vehicle || '(no vehicle)').join(', ');
  throw new Error(`This zip holds ${found.length} claims (${vehicles}); none match this claim's vehicle.`);
}

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

export function sameVehicle(a: string, b: string): boolean {
  return norm(a) !== '' && norm(a) === norm(b);
}
