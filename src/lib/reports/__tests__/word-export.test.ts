import { describe, expect, test, vi, beforeEach } from 'vitest';
import { buildWordDocument, downloadAsWord } from '../word-export';

const saved: { blob: Blob; name: string }[] = [];

vi.mock('file-saver', () => ({
  saveAs: (blob: Blob, name: string) => { saved.push({ blob, name }); },
}));

beforeEach(() => { saved.length = 0; });

describe('buildWordDocument', () => {
  test('keeps the report body byte-for-byte — the .doc IS the PDF', () => {
    const body = '<table><tr><td style="font-weight:700;">₹ 1,23,456.00</td></tr></table>';
    expect(buildWordDocument(body, 'x')).toContain(body);
  });

  test('declares the office namespaces Word needs to claim the file', () => {
    const doc = buildWordDocument('<p>x</p>', 'x');
    expect(doc).toContain('urn:schemas-microsoft-com:office:word');
    expect(doc).toContain('@page');
  });

  test('binds the body to a named page so Word uses A4, not Letter at 1in', () => {
    // A bare @page is ignored by Word; only a named page applied to a wrapper
    // div carries page size and margins through. Without this the report is
    // laid out narrower than the PDF.
    const doc = buildWordDocument('<p>x</p>', 'x');
    expect(doc).toContain('@page Section1');
    expect(doc).toContain('div.Section1 { page: Section1; }');
    expect(doc).toMatch(/<body><div class="Section1">/);
  });

  test('carries the same margin box and reset as the print document', () => {
    const doc = buildWordDocument('<p>x</p>', 'x');
    expect(doc).toContain('size: 210mm 297mm');   // A4
    expect(doc).toContain('margin: 10mm 12mm');   // matches buildStandardPrintDocument
    expect(doc).toContain('box-sizing: border-box');
  });
});

describe('downloadAsWord', () => {
  test('appends .doc only when missing', () => {
    downloadAsWord('<p>a</p>', 'RJ14-Final-Survey');
    downloadAsWord('<p>b</p>', 'RJ14-Spot.doc');
    expect(saved.map(s => s.name)).toEqual(['RJ14-Final-Survey.doc', 'RJ14-Spot.doc']);
  });

  test('emits a msword blob led by a UTF-8 BOM so the ₹ sign survives', async () => {
    downloadAsWord('<p>₹ 500</p>', 'fee');
    expect(saved[0].blob.type).toBe('application/msword');
    // Assert raw bytes: Blob.text() would strip the BOM during UTF-8 decode,
    // but it is the bytes on disk that tell Word which encoding to use.
    const head = new Uint8Array(await saved[0].blob.arrayBuffer()).slice(0, 3);
    expect(Array.from(head)).toEqual([0xef, 0xbb, 0xbf]);
  });

  test('refuses to save an empty report rather than shipping a blank document', () => {
    expect(() => downloadAsWord('   ', 'empty')).toThrow(/empty/i);
    expect(saved).toHaveLength(0);
  });
});
