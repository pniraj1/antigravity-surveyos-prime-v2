/** Pure naming: which folder a claim lives in and where each file goes inside it. */
import type { ClaimData } from '@/types/claim';
import type { ClaimDocument, DocType } from '@/types/documents';
import { DOC_TYPE_LABEL, MULTI_FILE_TYPES } from '@/types/documents';
import { sanitizeSegment } from '@/lib/local-sync/nomenclature';

/** Spec D2: fixed at the first write. Claim number first; vehicle − insurer as the fallback. */
export function folderNameFor(claim: ClaimData): string {
  if (claim.documentsFolder) return claim.documentsFolder;
  const claimNo = claim.policy?.claimNumber?.trim();
  if (claimNo) return sanitizeSegment(claimNo, 'claim');
  const reg = claim.vehicle?.registrationNumber?.trim() ?? '';
  const insurer = claim.policy?.insurerName?.trim() ?? '';
  return reg || insurer ? sanitizeSegment(`${reg} - ${insurer}`.replace(/^ - | - $/g, ''), 'claim') : 'claim';
}

const MIME_EXT: Array<[RegExp, string]> = [
  [/pdf/, 'pdf'], [/png/, 'png'], [/jpe?g/, 'jpg'], [/gif/, 'gif'], [/webp/, 'webp'], [/heic|heif/, 'heic'],
  [/text\/html/, 'html'], [/spreadsheetml|xlsx/, 'xlsx'], [/ms-excel/, 'xls'],
  [/wordprocessingml/, 'docx'], [/msword/, 'doc'], [/text\/plain/, 'txt'],
];

export function extForFile(mime: string, fileName?: string): string {
  for (const [re, ext] of MIME_EXT) if (re.test(mime)) return ext;
  const m = fileName?.match(/\.([A-Za-z0-9]{1,5})$/);
  return m ? m[1].toLowerCase() : 'bin';
}

function highestNumber(existing: ClaimDocument[], type: DocType, label: string): number {
  const re = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\d+)\\.`);
  let max = 0;
  for (const d of existing) {
    if (d.type !== type) continue;
    const m = d.relPath.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

/** Relative paths for a batch of files of one type. Multi-file types number on from what exists. */
export function relPathsFor(
  type: DocType,
  files: { mime: string; name?: string }[],
  existing: ClaimDocument[],
): string[] {
  const label = DOC_TYPE_LABEL[type];
  if (MULTI_FILE_TYPES.has(type)) {
    const start = highestNumber(existing, type, label);
    return files.map((f, i) => `${label}/${label} ${start + i + 1}.${extForFile(f.mime, f.name)}`);
  }
  if (files.length === 1) return [`${label}.${extForFile(files[0].mime, files[0].name)}`];
  return files.map((f, i) => `${label} ${i + 1}.${extForFile(f.mime, f.name)}`);
}

/** "RC Book.pdf" → "RC Book (old).pdf", then "(old 2)" … until a free name. */
export function oldNameFor(relPath: string, taken: ReadonlySet<string>): string {
  const dot = relPath.lastIndexOf('.');
  const stem = dot > 0 ? relPath.slice(0, dot) : relPath;
  const ext = dot > 0 ? relPath.slice(dot) : '';
  let n = 1;
  for (;;) {
    const candidate = n === 1 ? `${stem} (old)${ext}` : `${stem} (old ${n})${ext}`;
    if (!taken.has(candidate)) return candidate;
    n += 1;
  }
}
