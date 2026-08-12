// ═══════════════════════════════════════════════════════════
// LINE-ITEM EXTRACTION SUMMARY
//
// Counts and totals of what the AI actually read from an estimate or final
// bill, so the surveyor can check them against the printed last page.
//
// This exists for one specific failure that nothing else catches: the model
// stops early on a multi-page bill and returns a SMALLER, INTERNALLY
// CONSISTENT set of items. The arithmetic adds up perfectly — just over too
// few items — so no discrepancy check fires. Smart Fix triggers when the
// numbers disagree with each other; it cannot see numbers that were never
// read. Only a human comparing the printed grand total and item count can.
// ═══════════════════════════════════════════════════════════

export interface LineGroupSummary {
  count: number;
  taxable: number;
}

export interface ExtractionSummary {
  parts: LineGroupSummary;
  labour: LineGroupSummary;
  painting: LineGroupSummary;
  /** Grand total as extracted, or null when the document carried none. */
  gross: number | null;
  totalItems: number;
}

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : 0;
}

function summariseGroup(rows: unknown): LineGroupSummary {
  if (!Array.isArray(rows)) return { count: 0, taxable: 0 };
  return {
    count: rows.length,
    taxable: rows.reduce<number>((sum, row) => {
      const r = row as Record<string, unknown>;
      // taxable_amount is the documented anchor; fall back to the gross column
      // when a workshop prints only one amount.
      return sum + (r?.taxable_amount != null ? num(r.taxable_amount) : num(r?.total_amount));
    }, 0),
  };
}

/** Document types that carry line-item arrays worth confirming. */
export function hasLineItems(docKey: string): boolean {
  return docKey === 'estimate' || docKey === 'final-bill';
}

export function summariseExtraction(data: unknown): ExtractionSummary {
  const d = (data ?? {}) as Record<string, unknown>;
  const parts = summariseGroup(d.spare_parts);
  const labour = summariseGroup(d.labour_items);
  const painting = summariseGroup(d.painting_items);

  const rawGross = d.gross_amount ?? d.total_amount;
  const gross = rawGross == null || rawGross === '' ? null : num(rawGross);

  return {
    parts,
    labour,
    painting,
    gross,
    totalItems: parts.count + labour.count + painting.count,
  };
}
