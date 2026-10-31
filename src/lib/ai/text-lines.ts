// Rebuilds table-like lines from pdf.js text items (digital PDFs).

export interface TextItem { str: string; transform: number[]; width: number }

const median = (xs: number[], fallback: number): number => {
  if (!xs.length) return fallback;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** Lines top→bottom, items left→right; a gap > 2× median char width becomes ' | '. */
export function layoutLines(items: TextItem[]): string {
  const live = items
    .filter(i => i.str && i.str.trim())
    .map(i => ({ s: i.str, x: i.transform?.[4] ?? 0, y: i.transform?.[5] ?? 0, h: i.transform?.[3] || 0, w: i.width || 0 }));
  if (!live.length) return '';
  const halfH = median(live.map(i => i.h).filter(h => h > 0), 10) / 2;
  const charW = median(live.filter(i => i.w > 0).map(i => i.w / i.s.length), 5);

  const sorted = [...live].sort((a, b) => b.y - a.y);
  const lines: typeof live[] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last[0].y - it.y) <= halfH) last.push(it);
    else lines.push([it]);
  }
  return lines
    .map(line => {
      const row = [...line].sort((a, b) => a.x - b.x);
      return row.reduce((acc, it, k) => {
        if (!k) return it.s;
        const p = row[k - 1];
        return acc + (it.x - (p.x + p.w) > 2 * charW ? ' | ' : ' ') + it.s;
      }, '');
    })
    .join('\n');
}

/**
 * Lines whose last ' | ' cell (or line end) is an amount with a decimal part
 * (1234.50) or a thousands comma (1,234): the expected row count. Bare
 * integers (qty, page numbers, "Total 5") don't count.
 */
export function countAmountLines(text: string): number {
  const amount = /(?:^|\s)(?:\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+\.\d{1,2})$/;
  return text.split('\n').filter(l => amount.test((l.split(' | ').pop() ?? '').trim())).length;
}
