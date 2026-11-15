/**
 * Pasting estimate numbers into Bill Check's Ref No. column (spec D10).
 * Pure: reads the clipboard text and works out what to write to which row.
 * The grid applies the result; nothing here touches the store.
 */

export type RefPaste =
  | { kind: 'single' }                                        // no line break, no tab: let the input paste natively
  | { kind: 'column'; refs: string[] }                        // '' = leave that row unchanged
  | { kind: 'keyed'; pairs: Array<{ srNo: number; ref: string }> }
  | { kind: 'invalid' };

const isWhole = (s: string): boolean => s !== '' && Number.isInteger(Number(s));

export function parseRefPaste(text: string): RefPaste {
  if (!/[\n\t]/.test(text)) return { kind: 'single' };
  const lines = text.split(/\r?\n/);
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  const rows = lines.map(l => l.split('\t').map(c => c.trim()));
  const width = rows[0].length;
  if (rows.some(r => r.length !== width) || width > 2) return { kind: 'invalid' };
  if (width === 1) return { kind: 'column', refs: rows.map(r => r[0]) };

  // Two columns: Sr No. → Ref No. A first line that is not a number is a header.
  const body = isWhole(rows[0][0]) ? rows : rows.slice(1);
  if (!body.length || !body.every(r => isWhole(r[0]))) return { kind: 'invalid' };
  return {
    kind: 'keyed',
    pairs: body.filter(r => r[1] !== '').map(r => ({ srNo: Number(r[0]), ref: r[1] })),
  };
}
