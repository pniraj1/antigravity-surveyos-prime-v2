// ═══════════════════════════════════════════════════════════
// PAYMENT ADVICE EXTRACTOR
// Extracts structured payment remittance / advice details from
// email text, PDFs, or scanned advice documents using Gemini.
// ═══════════════════════════════════════════════════════════

import type { PaymentAdvice, PaymentAdviceClaimItem } from '@/types/payment-reconciliation';
import { callAIGateway } from './service';
import { fileToImages } from './processor';

export const PAYMENT_ADVICE_PROMPT = `You are an expert Indian motor insurance survey remittance and payment advice parser.
Analyze the provided payment advice document or email text and extract structured payment details.
Payment advices are sent by Indian insurance companies (e.g. New India Assurance, United India Insurance, National Insurance, Oriental Insurance, ICICI Lombard, HDFC ERGO, Bajaj Allianz, Tata AIG, SBI General, Digit, etc.) to disburse surveyor fees.

Extract:
1. "insurerName": Full name of the insurance company.
2. "paymentDate": Date of payment in YYYY-MM-DD format.
3. "utrNumber": UTR / NEFT / RTGS / CMS / Cheque / Transaction reference number.
4. "totalAmount": Gross disbursement amount across all claims before TDS deduction (number).
5. "totalTds": Total TDS amount deducted (usually 10% under Section 194J) (number).
6. "netPaid": Net amount credited/disbursed to surveyor's bank account (number).
7. "claims": Array of individual claim entries found in the advice. For each claim:
   - "claimNumber": Claim number / reference number (e.g. 310100/31/24/01/00001234 or UIIC/2026/01).
   - "vehicleNumber": Vehicle registration number (e.g. MH-12-AB-1234).
   - "policyNumber": Policy number if present.
   - "grossFee": Survey fee / professional fee (number).
   - "conveyance": Conveyance / photo charges / out of pocket expense (number, optional).
   - "tdsAmount": TDS deducted for this claim (number, optional).
   - "netPaid": Net payment amount for this claim (number).
   - "remarks": Remarks / nature of payment (optional).

Return ONLY valid JSON matching this schema:
{
  "insurerName": "string",
  "paymentDate": "YYYY-MM-DD",
  "utrNumber": "string",
  "totalAmount": 0,
  "totalTds": 0,
  "netPaid": 0,
  "claims": [
    {
      "claimNumber": "string",
      "vehicleNumber": "string",
      "policyNumber": "string",
      "grossFee": 0,
      "conveyance": 0,
      "tdsAmount": 0,
      "netPaid": 0,
      "remarks": "string"
    }
  ]
}`;

/**
 * Clean and parse raw JSON text from AI response into a typed PaymentAdvice object.
 * Normalizes claim numbers, vehicle numbers, computes missing TDS or netPaid values.
 */
export function parseAdviceJSON(raw: string, source: string = 'unknown'): PaymentAdvice | null {
  if (!raw || !raw.trim()) return null;

  try {
    let clean = raw.trim();
    clean = clean.replace(/```json/gi, '').replace(/```/g, '').trim();

    // Find JSON object boundary if surrounded by other prose
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) {
      clean = match[0];
    }

    const data = JSON.parse(clean);
    const root = data.advice || data;

    const rawClaims = Array.isArray(root.claims) ? root.claims : [];
    const claims: PaymentAdviceClaimItem[] = rawClaims
      .filter((c: any) => c && typeof c === 'object')
      .map((c: any) => {
        const claimNumber = String(c.claimNumber || '').trim();
        const vehicleNumber = c.vehicleNumber ? String(c.vehicleNumber).trim().toUpperCase() : undefined;
        const policyNumber = c.policyNumber ? String(c.policyNumber).trim() : undefined;
        const grossFee = Number(c.grossFee) || 0;
        const conveyance = c.conveyance != null && !isNaN(Number(c.conveyance)) ? Number(c.conveyance) : undefined;
        let tdsAmount = c.tdsAmount != null && !isNaN(Number(c.tdsAmount)) ? Number(c.tdsAmount) : undefined;
        let netPaid = Number(c.netPaid) || 0;
        const remarks = c.remarks ? String(c.remarks).trim() : undefined;

        // Auto-compute rules:
        // 1. If netPaid is 0 but grossFee > 0: check if TDS applies (10% standard Section 194J)
        if (netPaid === 0 && grossFee > 0) {
          if (tdsAmount == null || tdsAmount === 0) {
            tdsAmount = Math.round(grossFee * 0.10);
          }
          netPaid = (grossFee + (conveyance || 0)) - tdsAmount;
        }

        // 2. If tdsAmount is 0 or missing, but grossFee > netPaid, auto-compute tdsAmount = grossFee - netPaid (+ conveyance)
        if ((tdsAmount == null || tdsAmount === 0) && grossFee > netPaid) {
          tdsAmount = (grossFee + (conveyance || 0)) - netPaid;
          if (tdsAmount < 0) tdsAmount = 0;
        }

        return {
          claimNumber,
          ...(vehicleNumber ? { vehicleNumber } : {}),
          ...(policyNumber ? { policyNumber } : {}),
          grossFee,
          ...(conveyance !== undefined ? { conveyance } : {}),
          ...(tdsAmount !== undefined ? { tdsAmount } : {}),
          netPaid,
          ...(remarks ? { remarks } : {}),
        };
      });

    let totalAmount = Number(root.totalAmount) || 0;
    let totalTds = Number(root.totalTds) || 0;
    let netPaid = Number(root.netPaid) || 0;

    const sumGross = claims.reduce((acc, c) => acc + (c.grossFee || 0) + (c.conveyance || 0), 0);
    const sumTds = claims.reduce((acc, c) => acc + (c.tdsAmount || 0), 0);
    const sumNet = claims.reduce((acc, c) => acc + (c.netPaid || 0), 0);

    if (totalAmount === 0 && sumGross > 0) {
      totalAmount = sumGross;
    }
    if (totalTds === 0) {
      if (sumTds > 0) {
        totalTds = sumTds;
      } else if (totalAmount > netPaid && netPaid > 0) {
        totalTds = totalAmount - netPaid;
      }
    }
    if (netPaid === 0 && sumNet > 0) {
      netPaid = sumNet;
    }

    const id = root.id || (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `adv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);

    return {
      id,
      insurerName: String(root.insurerName || '').trim(),
      paymentDate: String(root.paymentDate || new Date().toISOString().split('T')[0]).trim(),
      utrNumber: String(root.utrNumber || '').trim(),
      totalAmount,
      totalTds,
      netPaid,
      claims,
      rawSource: source,
      createdAt: root.createdAt || new Date().toISOString(),
    };
  } catch (err) {
    console.error('Failed to parse payment advice JSON:', err);
    return null;
  }
}

/**
 * Extracts payment advice details from raw text (e.g. copied email body).
 */
export async function extractPaymentAdviceFromText(text: string, source: string = 'email-body'): Promise<PaymentAdvice | null> {
  if (!text || !text.trim()) return null;

  try {
    const prompt = `${PAYMENT_ADVICE_PROMPT}\n\nPayment Advice Content / Email Text:\n${text}`;
    const raw = await callAIGateway(prompt, [], 'json', 'heavy');
    return parseAdviceJSON(raw, source);
  } catch (error) {
    console.error('Failed to extract payment advice from text:', error);
    return null;
  }
}

/**
 * Extracts payment advice details from an uploaded file (.txt, image, or PDF).
 */
export async function extractPaymentAdviceFromFile(file: File): Promise<PaymentAdvice | null> {
  if (!file) return null;

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'txt' || file.type === 'text/plain') {
    const text = await file.text();
    return extractPaymentAdviceFromText(text, file.name);
  }

  try {
    const { apiImages } = await fileToImages(file);
    if (!apiImages || apiImages.length === 0) return null;

    // Send up to 3 pages to callAIGateway
    const pages = apiImages.slice(0, 3);
    const raw = await callAIGateway(PAYMENT_ADVICE_PROMPT, pages, 'json', 'heavy');
    return parseAdviceJSON(raw, file.name);
  } catch (error) {
    console.error('Failed to extract payment advice from file:', error);
    return null;
  }
}
