// Opt-in regression check over real digital estimates/bills kept OUTSIDE the repo (they carry customer data).
//   PARSER_CORPUS=<file listing one PDF path per line>  PARSER_SNAP=<dir for snapshots>  npx vitest run parser-corpus
// First run writes a snapshot per PDF; later runs fail on any change. PARSER_SNAP_UPDATE=1 rewrites them.
import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { tokensFromItems, type PdfToken } from '../row-parser';
import { safeParse } from '../parser-first';

const list = process.env.PARSER_CORPUS;
const snapDir = process.env.PARSER_SNAP;
const pdfs = list ? readFileSync(list, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [];

async function tokensOf(path: string): Promise<PdfToken[][]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(path)), verbosity: 0 }).promise;
  const out: PdfToken[][] = [];
  for (let n = 1; n <= pdf.numPages; n++) out.push(tokensFromItems((await (await pdf.getPage(n)).getTextContent()).items as never));
  return out;
}

describe.skipIf(!list || !snapDir)('parser corpus', () => {
  for (const path of pdfs) {
    it(basename(path), async () => {
      const r = safeParse(await tokensOf(path));
      const got = JSON.stringify(r.ok ? r.data : { declined: r.reason }, null, 1);
      mkdirSync(snapDir!, { recursive: true });
      const snap = join(snapDir!, basename(path) + '.json');
      if (!existsSync(snap) || process.env.PARSER_SNAP_UPDATE) writeFileSync(snap, got);
      else expect(got).toBe(readFileSync(snap, 'utf8'));
    }, 60_000);
  }
});
