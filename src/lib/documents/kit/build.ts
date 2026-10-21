/**
 * Builds the file for each portal upload box: cut pages out of combined PDFs,
 * or merge several documents into one PDF. Originals are only ever read.
 */
import { PDFDocument } from 'pdf-lib';
import type { BoxState } from './checklist';
import type { RecipeBox } from './recipes/types';
import { safeFileStem } from '../naming';

export type BoxPlan = Array<{ docId: string; pages: number[] }>;
type Source = { blob: Blob; mime: string; name: string };

const A4 = { w: 595, h: 842, margin: 36 };

export const CANT_OPEN_PDF = "This PDF can't be opened here (it may be password-protected). Open it yourself and save an unlocked copy into the claim folder.";

/** Pages sorted ascending per document, documents in state order. The HTML stand-in report is never built (C1). */
export function planBox(state: BoxState): BoxPlan {
  return state.parts.filter((p) => !p.html).map((p) => ({ docId: p.docId, pages: [...p.pages].sort((a, b) => a - b) }));
}

const extOf = (name: string): string => /\.[^./\\]+$/.exec(name)?.[0].toLowerCase() ?? '';
const isPdf = (s: Source): boolean => s.mime === 'application/pdf' || extOf(s.name) === '.pdf';
const isPng = (s: Source): boolean => s.mime === 'image/png' || extOf(s.name) === '.png';
const isJpeg = (s: Source): boolean => s.mime === 'image/jpeg' || ['.jpg', '.jpeg'].includes(extOf(s.name));

const loadPdf = async (s: Source) => PDFDocument.load(await s.blob.arrayBuffer(), { ignoreEncryption: true });

async function addImagePage(out: PDFDocument, s: Source): Promise<void> {
  const bytes = new Uint8Array(await s.blob.arrayBuffer());
  const img = isPng(s) ? await out.embedPng(bytes) : await out.embedJpg(bytes);
  const scale = Math.min((A4.w - 2 * A4.margin) / img.width, (A4.h - 2 * A4.margin) / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  out.addPage([A4.w, A4.h]).drawImage(img, { x: (A4.w - w) / 2, y: (A4.h - h) / 2, width: w, height: h });
}

export async function buildBoxFile(
  box: RecipeBox,
  plan: BoxPlan,
  read: (docId: string) => Promise<Source>,
): Promise<{ blob: Blob; name: string; pages: number }> {
  if (plan.length === 0) throw new Error(`Nothing to build for "${box.label}".`);

  // A single whole file in an accepted format goes through untouched.
  if (box.combine === 'single' && plan.length === 1) {
    const src = await read(plan[0].docId);
    const ext = extOf(src.name);
    if (box.formats.includes(ext)) {
      const pdf = isPdf(src) ? await loadPdf(src) : null;
      const whole = plan[0].pages.length === 0 || !pdf || plan[0].pages.length === pdf.getPageCount();
      if (whole) return { blob: src.blob, name: `${safeFileStem(box.label)}${ext}`, pages: pdf?.getPageCount() ?? 1 };
    }
  }

  const out = await PDFDocument.create();
  for (const entry of plan) {
    const src = await read(entry.docId);
    if (isPdf(src)) {
      const doc = await loadPdf(src);
      // Pages copied out of an encrypted PDF come out as garbage; only the untouched whole file is safe.
      if (doc.isEncrypted) throw new Error(CANT_OPEN_PDF);
      const idx = entry.pages.length > 0 ? entry.pages.map((p) => p - 1) : doc.getPageIndices();
      for (const page of await out.copyPages(doc, idx)) out.addPage(page);
    } else if (isPng(src) || isJpeg(src)) {
      await addImagePage(out, src);
    } else {
      throw new Error(`"${src.name}" can't be merged into a PDF; upload it on its own.`);
    }
  }
  const bytes = await out.save();
  return { blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }), name: `${safeFileStem(box.label)}.pdf`, pages: out.getPageCount() };
}

export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
