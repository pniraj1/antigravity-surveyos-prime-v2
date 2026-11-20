// ═══════════════════════════════════════════════════════════
// PAYMENT ADVICE EXTRACTOR
// Extracts structured payment remittance / advice details from
// email text, PDFs, or scanned advice documents using Gemini.
// ═══════════════════════════════════════════════════════════

import type { PaymentAdvice, PaymentAdviceClaimItem } from '@/types/payment-reconciliation';
import { callAIGateway } from './service';
import { fileToImages } from './processor';
import { readZip } from '@/lib/scan-import/zip';
import { pageTexts } from '@/lib/documents/kit/page-text';
import { parseDeterministicAdvice } from '@/lib/reconciliation/deterministic-parsers';

export const PAYMENT_ADVICE_PROMPT = `You are an expert Indian motor insurance survey remittance and payment advice parser.
Analyze the provided payment advice document or email text and extract structured payment details.
Payment advices are sent by Indian insurance companies (New India Assurance, United India Insurance, Oriental Insurance, National Insurance, ICICI Lombard, HDFC ERGO, Bajaj Allianz, Tata AIG, SBI General, Digit, etc.) or their CMS banks (Axis Bank, HDFC Bank, ICICI Bank, SBI CMS) to disburse surveyor fees.

CRITICAL PARSING RULES & REAL-WORLD FORMATS:
1. United India Insurance (UIIC) automated emails:
   - Text structure: "For the claim {claimNo} on policy number: {policyNo}, vehicle number: {vehicleNo}, insured name: {name} and Survey report no. {reportNo} your payment has been disbursed at Rs. {net}/-( gross={gross}, TDS={tds}, GST TDS=0 )"
   - Extract:
     * claimNumber: exact claim number (e.g. 2310023126C050058001)
     * vehicleNumber: exact vehicle registration number (e.g. MH 18 BZ 2552)
     * policyNumber: policy number if present (e.g. 2310023125P117257182)
     * grossFee: gross amount before TDS (e.g. 6076)
     * tdsAmount: TDS amount deducted (e.g. 608)
     * netPaid: actual disbursed amount (e.g. 5468)
     * insurerName: "United India Insurance Company Limited"
2. New India Assurance (NIA) tabular emails:
   - Text structure: A table with headers:
     "INVOICE NUMBER | POLICY NUMBER | CLAIM NUMBER | AMOUNT | CLAIM DETAILS (Vehicle Number) | DESCRIPTION"
   - The first row contains the gross fee (e.g. 1,570.00), Claim Number (e.g. 16080231260190000009), Vehicle Number (e.g. MH-39-J-6873), and Policy Number.
   - Subsequent rows with negative amounts (e.g. -157.00) and descriptions like "OF-TDS-CM..." represent TDS deducted!
   - The "TOTAL:" row (e.g. 1,413.00) is the netPaid amount.
   - Extract: grossFee: 1570, tdsAmount: 157, netPaid: 1413, claimNumber: 16080231260190000009, vehicleNumber: MH-39-J-6873.
3. Bank CMS Payment Advices (Axis Bank / HDFC / ICICI / SBI CMS):
   - In Axis Bank CMS advices (e.g. Straight2axis@axis.bank.in), ALWAYS check the "Enrichment:" block at the top of the advice!
   - In the "Enrichment:" section:
     * Vehicle registration number appears (e.g. GJ20AH3438).
     * Claim number appears directly below "Claim#" (e.g. 2310843126C050010001).
   - In the details table:
     * "Company Name": Full insurer name (e.g. "UNITED INDIA INSURANCE COMPANY LIMITED" or "THE ORIENTAL INSURANCE COMPANY LIMITED").
     * "UTR Number": UTR / Transaction reference (e.g. AXISCN1526257496).
     * "Net Amount" or "Amount": The net amount credited (e.g. 4743.00).
4. TDS Deduction Rule:
   - In India, insurance companies deduct 10% (or 2%) TDS under Section 194J on professional surveyor fees.
   - If grossFee is known and netPaid is known (grossFee > netPaid), the difference is usually TDS (or disallowance).
   - If grossFee and tdsAmount are specified (e.g. gross=6076, TDS=608), netPaid is exactly grossFee - tdsAmount (e.g. 5468).

Extract:
1. "insurerName": Full name of the insurance company.
2. "paymentDate": Date of payment in YYYY-MM-DD format.
3. "utrNumber": UTR / NEFT / RTGS / CMS / Cheque / Transaction reference number.
4. "totalAmount": Gross disbursement amount across all claims before TDS deduction (number).
5. "totalTds": Total TDS amount deducted (usually 10% under Section 194J) (number).
6. "netPaid": Net amount credited/disbursed to surveyor's bank account (number).
7. "claims": Array of individual claim entries found in the advice. For each claim:
   - "claimNumber": Claim number / reference number.
   - "vehicleNumber": Vehicle registration number (e.g. MH-12-AB-1234, GJ20AH3438).
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
 * Prioritizes 0-latency deterministic regex parsers before falling back to AI.
 */
export async function extractPaymentAdviceFromText(text: string, source: string = 'email-body'): Promise<PaymentAdvice | null> {
  if (!text || !text.trim()) return null;

  // 1. Deterministic fast path (<5ms, 0 AI tokens)
  const deterministic = parseDeterministicAdvice(text, source);
  if (deterministic) return deterministic;

  // 2. Quick heuristic: if text does NOT contain any financial keyword, skip AI immediately
  if (!/(rs\.?|inr|₹|disbursed|credited|paid|payment|neft|rtgs|cms|advice|settlement|utr|amount|remit)/i.test(text)) {
    return null;
  }

  try {
    const prompt = `${PAYMENT_ADVICE_PROMPT}\n\nPayment Advice Content / Email Text:\n${text}`;
    const raw = await callAIGateway(prompt, [], 'json', 'text');
    return parseAdviceJSON(raw, source);
  } catch (error) {
    console.error('Failed to extract payment advice from text:', error);
    return null;
  }
}

/**
 * Extracts payment advice details from an uploaded file (.txt, image, or PDF).
 * Avoids vision AI when digital text layers can be parsed directly.
 */
export async function extractPaymentAdviceFromFile(file: File): Promise<PaymentAdvice | null> {
  if (!file) return null;

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'txt' || file.type === 'text/plain') {
    const text = await file.text();
    return extractPaymentAdviceFromText(text, file.name);
  }

  // Handle ZIP archives containing PDFs or text advices (e.g. Axis Bank CMS remittances)
  if (ext === 'zip' || file.type.includes('zip')) {
    try {
      const filesMap = await readZip(file);
      for (const [entryName, entryBlob] of filesMap.entries()) {
        const entryExt = entryName.split('.').pop()?.toLowerCase();
        if (entryExt === 'pdf') {
          const pdfFile = new File([entryBlob], entryName, { type: 'application/pdf' });
          const pages = await pageTexts(pdfFile);
          if (pages && pages.length > 0) {
            const text = pages.join('\n').trim();
            if (text) {
              const advice = parseDeterministicAdvice(text, entryName) || (await extractPaymentAdviceFromText(text, entryName));
              if (advice && advice.claims && advice.claims.length > 0) {
                return advice;
              }
            }
          }
          // Scanned PDF fallback
          const advice = await extractPaymentAdviceFromFile(pdfFile);
          if (advice && advice.claims && advice.claims.length > 0) {
            return advice;
          }
        } else if (entryExt === 'txt' || entryExt === 'csv') {
          const text = await entryBlob.text();
          const advice = await extractPaymentAdviceFromText(text, entryName);
          if (advice && advice.claims && advice.claims.length > 0) {
            return advice;
          }
        }
      }
    } catch (zipErr) {
      console.warn('Failed to unzip payment archive:', zipErr);
    }
  }

  // Standalone PDF files: check text layer first before rendering images
  if (ext === 'pdf' || file.type === 'application/pdf') {
    const pages = await pageTexts(file);
    if (pages && pages.length > 0) {
      const text = pages.join('\n').trim();
      if (text) {
        const advice = parseDeterministicAdvice(text, file.name);
        if (advice && advice.claims && advice.claims.length > 0) {
          return advice;
        }
      }
    }
  }

  try {
    const { apiImages } = await fileToImages(file);
    if (!apiImages || apiImages.length === 0) return null;

    // Send up to 3 pages to callAIGateway with 'light' tier
    const pages = apiImages.slice(0, 3);
    const raw = await callAIGateway(PAYMENT_ADVICE_PROMPT, pages, 'json', 'light');
    return parseAdviceJSON(raw, file.name);
  } catch (error) {
    console.error('Failed to extract payment advice from file:', error);
    return null;
  }
}
