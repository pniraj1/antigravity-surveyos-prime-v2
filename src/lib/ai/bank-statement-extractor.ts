// ═══════════════════════════════════════════════════════════
// BANK STATEMENT EXTRACTOR
// Extracts credit transactions from a bank statement PDF/image
// using the existing AI gateway (Gemini / Groq).
// ═══════════════════════════════════════════════════════════

import { fileToImages } from './processor';
import { callAIGateway } from './service';
import { DOC_PROMPTS } from './prompts';

export interface BankTransaction {
  date: string;       // YYYY-MM-DD
  amount: number;     // credit amount in ₹
  narration: string;
  reference: string;
}

/**
 * Parse a CSV bank statement row by row.
 * Tries to detect amount and date columns heuristically.
 */
function parseCsvTransactions(text: string): BankTransaction[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Find header row
  const header = lines[0].split(',').map(h => h.replace(/"/g, '').toLowerCase().trim());
  const dateIdx    = header.findIndex(h => h.includes('date'));
  const creditIdx  = header.findIndex(h => h.includes('credit') || h.includes('deposit') || h.includes('cr'));
  const narIdx     = header.findIndex(h => h.includes('narration') || h.includes('description') || h.includes('particulars') || h.includes('remarks'));
  const refIdx     = header.findIndex(h => h.includes('ref') || h.includes('utr') || h.includes('cheque'));

  const results: BankTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim());
    const creditRaw = creditIdx >= 0 ? cols[creditIdx] : '';
    const amount = parseFloat(creditRaw.replace(/[^0-9.]/g, ''));
    if (!amount || amount <= 0) continue;

    const dateRaw = dateIdx >= 0 ? cols[dateIdx] : '';
    // Normalise DD/MM/YYYY → YYYY-MM-DD
    const dateParts = dateRaw.split(/[\/\-]/);
    let date = dateRaw;
    if (dateParts.length === 3 && dateParts[2].length === 4) {
      date = `${dateParts[2]}-${dateParts[1].padStart(2,'0')}-${dateParts[0].padStart(2,'0')}`;
    }

    results.push({
      date,
      amount,
      narration: narIdx >= 0 ? cols[narIdx] : '',
      reference: refIdx >= 0 ? cols[refIdx] : '',
    });
  }

  return results;
}

/**
 * Extract credit transactions from a bank statement file.
 * Supports PDF (via AI vision) and CSV (parsed locally).
 */
export async function extractBankStatement(file: File): Promise<BankTransaction[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  // ── CSV: parse locally, no AI needed ────────────────────
  if (ext === 'csv') {
    const text = await file.text();
    return parseCsvTransactions(text);
  }

  // ── PDF / Image: use AI vision ───────────────────────────
  const images = await fileToImages(file);
  if (!images.length) return [];

  const prompt = DOC_PROMPTS['bank-statement'];
  let raw = '';

  // Process up to 6 pages to keep within token limits
  const pages = images.slice(0, 6);
  const allTx: BankTransaction[] = [];

  for (const page of pages) {
    try {
      raw = await callAIGateway(prompt, [page]);
      const clean = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      const txs: BankTransaction[] = (parsed.transactions || []).map((t: any) => ({
        date: t.date || '',
        amount: Number(t.amount) || 0,
        narration: t.narration || '',
        reference: t.reference || '',
      })).filter((t: BankTransaction) => t.amount > 0);
      allTx.push(...txs);
    } catch {
      // skip pages that fail to parse
    }
  }

  // Deduplicate by reference or (date+amount)
  const seen = new Set<string>();
  return allTx.filter(tx => {
    const key = tx.reference || `${tx.date}:${tx.amount}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
