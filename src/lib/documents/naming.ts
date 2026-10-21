/** Pure naming: which folder a claim lives in and where each file goes inside it. */
import type { ClaimData } from '@/types/claim';
import type { ClaimDocument, DocType } from '@/types/documents';
import { DOC_TYPE_LABEL, MULTI_FILE_TYPES } from '@/types/documents';
import { sanitizeSegment } from '@/lib/local-sync/nomenclature';
import { insurerShortForm } from './insurers';

/**
 * Spec D2: fixed at the first write. A surveyor looks for a claim by the
 * vehicle it was on and who insured it — `MH12AB1234 - NIA` — which is also
 * how SurveyOS Sync names its own folders.
 */
export function folderNameFor(claim: ClaimData): string {
  if (claim.documentsFolder) return claim.documentsFolder;
  const reg = sanitizeSegment(claim.vehicle?.registrationNumber?.trim() ?? '', '');
  const insurer = insurerShortForm(claim.policy?.insurerName);
  const name = [reg, insurer].filter(Boolean).join(' - ');
  if (name) return name;
  const claimNo = claim.policy?.claimNumber?.trim();
  return claimNo ? sanitizeSegment(claimNo, 'claim') : 'claim';
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

/** Words surveyors actually name files with, beyond our own labels (lowercase stems). */
const ALIASES: Array<[DocType, string[]]> = [
  ['rc', ['rc', 'rc book', 'registration certificate']],
  ['rcBack', ['rc back']],
  ['dl', ['dl', 'dl front', 'driving licence', 'driving license']],
  ['dlBack', ['dl back']],
  ['aadhaar', ['aadhar', 'aadhaar', 'aadhar card', 'aadhaar card']],
  ['pan', ['pan', 'pan card']],
  ['cancelledCheque', ['cheque', 'cancelled cheque', 'canceled cheque']],
  ['policy', ['policy', 'policy copy']],
  ['claimForm', ['claim form']],
  ['estimate', ['estimate']],
  ['invoice', ['invoice', 'bill']],
  ['fir', ['fir']],
  ['ckyc', ['ckyc']],
];

/** Label or alias → type, built once. Labels are unique by construction. */
const TYPE_BY_LABEL = new Map<string, DocType>([
  ...ALIASES.flatMap(([type, words]) => words.map((w): [string, DocType] => [w, type])),
  ...(Object.entries(DOC_TYPE_LABEL) as Array<[DocType, string]>).map(([type, label]): [string, DocType] => [label.toLowerCase(), type]),
]);

/**
 * What a file found on disk is, judged only by its own name: a file inside a
 * subfolder takes the subfolder's type, a top-level file takes its stem with
 * any trailing number dropped. Anything we cannot place is `other` — the
 * surveyor can retype it in the list.
 */
export function docTypeFromRelPath(relPath: string): DocType {
  const parts = relPath.split('/');
  if (parts.length > 1) return TYPE_BY_LABEL.get(parts[0].toLowerCase().trim()) ?? 'other';
  const stem = parts[0].replace(/\.[^.]+$/, '').replace(/\s+\d+$/, '').toLowerCase().trim();
  return TYPE_BY_LABEL.get(stem) ?? 'other';
}

/** A portal box label as a Windows-safe file stem: "Front/Rear/Side Photograph" -> "Front-Rear-Side Photograph". */
export const safeFileStem = (label: string): string => label.replace(/[/\\:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();

/** Our own working files and superseded copies are not documents. */
export function isScanSkippable(relPath: string): boolean {
  const name = relPath.split('/').pop() ?? '';
  return relPath.split('/')[0].toLowerCase() === 'portal upload' // files we built for a portal, not the surveyor's (Windows ignores case)
    || name.endsWith('.part')
    || name.startsWith('_surveyos') // our own working files; a surveyor's _estimate.pdf is a document
    || / \(old(?: \d+)?\)\.[^.]+$/.test(name);
}
