export interface CandidateRow {
  id: string;
  particulars: string;
  amount: number;
}

export interface CandidateLine {
  id: string;
  description: string;
  amount: number;
}

export interface AIProposal {
  rowId: string;
  lineId: string;
  confidence: number;
  reason: string;
}

export function buildStage3AIPrompt(
  rows: CandidateRow[],
  lines: CandidateLine[]
): string {
  return `You are an expert Indian motor insurance surveyor. Compare these remaining unmatched assessment items against workshop invoice lines.
Identify if any pair refers to the same vehicle part or labour operation, considering Indian workshop vocabulary, abbreviations, and assembly terms.

ASSESSMENT ROWS:
${rows.map((r) => `- ID: ${r.id} | "${r.particulars}" | ₹${r.amount}`).join('\n')}

WORKSHOP INVOICE LINES:
${lines.map((l) => `- ID: ${l.id} | "${l.description}" | ₹${l.amount}`).join('\n')}

Return ONLY a JSON array of matching pairs:
[
  { "rowId": "string", "lineId": "string", "confidence": 0-100, "reason": "brief reason why these are the same" }
]
If an item has no valid match, do NOT include it.`;
}

export function parseStage3AIResponse(raw: string): AIProposal[] {
  try {
    if (!raw || !raw.trim()) return [];
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const startIdx = cleaned.indexOf('[');
    const endIdx = cleaned.lastIndexOf(']');
    const jsonStr =
      startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx
        ? cleaned.slice(startIdx, endIdx + 1)
        : cleaned;

    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
      .filter(
        (p) =>
          typeof p.rowId === 'string' &&
          typeof p.lineId === 'string' &&
          typeof p.confidence === 'number'
      )
      .map((p) => ({
        rowId: String(p.rowId),
        lineId: String(p.lineId),
        confidence: Number(p.confidence),
        reason: typeof p.reason === 'string' ? p.reason : '',
      }));
  } catch {
    return [];
  }
}
