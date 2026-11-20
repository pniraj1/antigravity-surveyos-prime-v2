// ═══════════════════════════════════════════════════════════
// DETERMINISTIC PAYMENT ADVICE PARSERS
// Pure regex / text parsers for standard Indian insurer remittances
// (Axis Bank CMS, UIIC automated emails, NIA tabular notices).
// Completely bypasses AI: 0 latency, 0 token cost, 100% deterministic.
// ═══════════════════════════════════════════════════════════

import type { PaymentAdvice } from '@/types/payment-reconciliation';

function makeId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `adv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Parses Axis Bank CMS Payment Advice PDF text (Straight2axis@axis.bank.in).
 * Used for UIIC and Oriental remittances disbursed via Axis Bank CMS.
 */
export function parseAxisBankCmsPdfText(text: string, source: string = 'axis-cms.pdf'): PaymentAdvice | null {
  if (!text) return null;

  // Detects: Payment Advice and (UTR Number or Straight2axis or Beneficiary Name or LossDt)
  const hasPaymentAdvice = /payment\s*advice/i.test(text);
  const hasAxisSignal =
    /utr\s*number/i.test(text) ||
    /straight2axis/i.test(text) ||
    /beneficiary\s*name/i.test(text) ||
    /lossdt/i.test(text);

  if (!hasPaymentAdvice || !hasAxisSignal) return null;

  // Extract insurer name: from Company Name\s*:\s*(.*?)(?=\nBeneficiary|\nPayment)
  let insurerName = 'Axis Bank CMS Remittance';
  const insurerMatch =
    text.match(/Company\s*Name\s*:\s*(.*?)(?=(?:\r?\n\s*Beneficiary|\r?\n\s*Payment|\r?\n\s*$|$))/i) ||
    text.match(/Company\s*Name\s*:\s*([^\r\n]+)/i);
  if (insurerMatch && insurerMatch[1].trim()) {
    insurerName = insurerMatch[1].trim().replace(/\s+/g, ' ');
  }

  // Extract UTR Number: UTR Number\s*:\s*([A-Za-z0-9]+)
  const utrMatch = text.match(/UTR\s*Number\s*[:\-]?\s*([A-Za-z0-9]+)/i);
  const utrNumber = utrMatch ? utrMatch[1].trim() : '';

  // Extract Payment Date: Payment Ini\. Date\s*:\s*([0-9]{2}-[0-9]{2}-[0-9]{4}) -> convert DD-MM-YYYY to YYYY-MM-DD
  let paymentDate = '';
  const dateMatch =
    text.match(/Payment\s*Ini\.?\s*Date\s*[:\-]?\s*(\d{2})[-/](\d{2})[-/](\d{4})/i) ||
    text.match(/Date\s*[:\-]?\s*(\d{2})[-/](\d{2})[-/](\d{4})/i);
  if (dateMatch) {
    paymentDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
  } else {
    paymentDate = new Date().toISOString().split('T')[0];
  }

  // Extract Net Amount: Amount\s*:\s*([\d,]+(?:\.\d{2})?)
  const amountMatch = text.match(/(?:Net\s+)?Amount\s*[:\-]?\s*([\d,]+(?:\.\d{2})?)/i);
  const netPaid = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;

  // In Enrichment: block
  const enrichmentMatch = text.match(/Enrichment\s*:\s*([\s\S]*?)(?=(?:Payment\s*Details|Instrument\s*Details|Company\s*Name|\r?\n\r?\n|$))/i);
  const enrichmentText = enrichmentMatch ? enrichmentMatch[1] : text;

  // Vehicle Reg: \b([A-Z]{2}\s*[0-9]{1,2}\s*[A-Z]{1,3}\s*[0-9]{4})\b (e.g. GJ20AH3438)
  const vehicleMatch =
    enrichmentText.match(/\b([A-Z]{2}\s*[0-9]{1,2}\s*[A-Z]{1,3}\s*[0-9]{4})\b/i) ||
    text.match(/\b([A-Z]{2}\s*[0-9]{1,2}\s*[A-Z]{1,3}\s*[0-9]{4})\b/i);
  const vehicleNumber = vehicleMatch ? vehicleMatch[1].replace(/\s+/g, ' ').trim().toUpperCase() : undefined;

  // Claim No: Claim#\s*([A-Za-z0-9]+) or standard 16-24 char claim number (e.g. 2310843126C050010001)
  const claimMatch =
    enrichmentText.match(/Claim#?\s*[:\-]?\s*([A-Za-z0-9]+)/i) ||
    enrichmentText.match(/\b([0-9]{15,24}[A-Za-z0-9]*)\b/) ||
    text.match(/Claim#?\s*[:\-]?\s*([A-Za-z0-9]+)/i) ||
    text.match(/\b([0-9]{15,24}[A-Za-z0-9]*)\b/);
  const claimNumber = claimMatch ? claimMatch[1].trim() : '';

  if (!claimNumber && !utrNumber && netPaid === 0) {
    return null;
  }

  return {
    id: makeId(),
    insurerName,
    paymentDate,
    utrNumber,
    totalAmount: netPaid,
    totalTds: 0,
    netPaid,
    claims: [
      {
        claimNumber,
        ...(vehicleNumber ? { vehicleNumber } : {}),
        grossFee: netPaid,
        tdsAmount: 0,
        netPaid,
      },
    ],
    rawSource: source,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Parses United India Insurance (UIIC) automated email text (policy.noreply@service.uiic.co.in).
 */
export function parseUiicEmailText(text: string, source: string = 'uiic-email'): PaymentAdvice | null {
  if (!text) return null;

  // Detects: For the claim\s+([A-Za-z0-9]+) and disbursed at Rs\.\s*([\d,]+)/-\(\s*gross=([\d,]+),\s*TDS=([\d,]+)
  const claimMatch = text.match(/For\s+the\s+claim\s+([A-Za-z0-9]+)/i);
  const disbursementMatch = text.match(
    /disbursed\s+at\s+Rs\.?\s*([\d,]+(?:\.\d{2})?)\s*\/?\s*-\s*\(\s*gross\s*=\s*([\d,]+(?:\.\d{2})?)\s*,\s*TDS\s*=\s*([\d,]+(?:\.\d{2})?)/i
  );

  if (!claimMatch || !disbursementMatch) return null;

  const claimNumber = claimMatch[1].trim();
  const netPaid = parseFloat(disbursementMatch[1].replace(/,/g, '')) || 0;
  const grossFee = parseFloat(disbursementMatch[2].replace(/,/g, '')) || 0;
  const tdsAmount = parseFloat(disbursementMatch[3].replace(/,/g, '')) || 0;

  // policyNumber: policy number:\s*([A-Za-z0-9]+)
  const policyMatch = text.match(/policy\s+number\s*:\s*([A-Za-z0-9]+)/i);
  const policyNumber = policyMatch ? policyMatch[1].trim() : undefined;

  // vehicleNumber: vehicle number:\s*([A-Za-z0-9\s]+?),
  const vehicleMatch = text.match(/vehicle\s+number\s*:\s*([A-Za-z0-9\s]+?)(?:,|\s+insured|\r?\n|$)/i);
  const vehicleNumber = vehicleMatch ? vehicleMatch[1].replace(/\s+/g, ' ').trim().toUpperCase() : undefined;

  // remarks: Survey report no\.\s*([A-Za-z0-9\-_]+)
  const reportMatch = text.match(/Survey\s+report\s+no\.?\s*([A-Za-z0-9\-_]+)/i);
  const remarks = reportMatch ? reportMatch[1].trim() : undefined;

  const insurerName = 'United India Insurance Company Limited';

  let paymentDate = '';
  const dateMatch = text.match(/\b(\d{2})[-/](\d{2})[-/](\d{4})\b/) || text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (dateMatch) {
    paymentDate = dateMatch[3] ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : dateMatch[0];
  } else {
    paymentDate = new Date().toISOString().split('T')[0];
  }

  const utrMatch = text.match(/\b(?:UTR|Ref(?:erence)?|NEFT|Txn(?:ID)?)\s*[:#\-]?\s*([A-Za-z0-9]+)/i);
  const utrNumber = utrMatch ? utrMatch[1].trim() : '';

  return {
    id: makeId(),
    insurerName,
    paymentDate,
    utrNumber,
    totalAmount: grossFee || netPaid,
    totalTds: tdsAmount,
    netPaid,
    claims: [
      {
        claimNumber,
        ...(vehicleNumber ? { vehicleNumber } : {}),
        ...(policyNumber ? { policyNumber } : {}),
        grossFee,
        tdsAmount,
        netPaid,
        ...(remarks ? { remarks } : {}),
      },
    ],
    rawSource: source,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Parses New India Assurance (NIA) tabular email / notice text (NIAHO@newindia.co.in).
 */
export function parseNiaEmailText(text: string, source: string = 'nia-email'): PaymentAdvice | null {
  if (!text) return null;

  // Detects: (The New India Assurance or NIAHO or INVOICE NUMBER.*POLICY NUMBER.*CLAIM NUMBER) and remit an amount of Rs\.
  const isNia =
    /The\s+New\s+India\s+Assurance/i.test(text) ||
    /NIAHO/i.test(text) ||
    /INVOICE\s+NUMBER[\s\S]*?POLICY\s+NUMBER[\s\S]*?CLAIM\s+NUMBER/i.test(text);
  const hasRemit = /remit\s+an\s+amount\s+of\s+Rs\.?/i.test(text);

  if (!isNia || !hasRemit) return null;

  const insurerName = 'The New India Assurance Co. Ltd';

  // netPaid: from TOTAL:\s*([\d,]+\.\d{2}) or remit an amount of Rs\.([\d,]+(?:\.\d{2})?)
  let netPaid = 0;
  const totalMatch = text.match(/TOTAL\s*:\s*([\d,]+(?:\.\d{2})?)/i);
  const remitMatch = text.match(/remit\s+an\s+amount\s+of\s+Rs\.?\s*([\d,]+(?:\.\d{2})?)/i);
  if (totalMatch) {
    netPaid = parseFloat(totalMatch[1].replace(/,/g, ''));
  } else if (remitMatch) {
    netPaid = parseFloat(remitMatch[1].replace(/,/g, ''));
  }

  // tdsAmount: from negative TDS row (e.g. -157.00) in tabular layout
  const tdsMatch =
    text.match(/(?:\|\s*|\t|\s)-\s*([\d,]+\.\d{2})/) ||
    text.match(/(?:\|\s*|\t|\s)-\s*([\d,]+(?:\.\d{2})?)/);
  const tdsAmount = tdsMatch ? Math.abs(parseFloat(tdsMatch[1].replace(/,/g, ''))) : 0;

  let policyNumber: string | undefined;
  let claimNumber = '';
  let vehicleNumber: string | undefined;
  let grossFee = 0;

  // Try full tabular row: [policy] | [claim] | [amount] | [vehicle]
  const tableRowMatch = text.match(
    /(?:\|\s*|\t)([0-9]{15,24}[A-Za-z0-9]*)\s*(?:\|\s*|\t)([0-9]{15,24}[A-Za-z0-9]*)\s*(?:\|\s*|\t)([\d,]+\.\d{2})\s*(?:\|\s*|\t)([A-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[A-Z]{0,3}[-\s]?[0-9]{4})/i
  );

  if (tableRowMatch) {
    policyNumber = tableRowMatch[1].trim();
    claimNumber = tableRowMatch[2].trim();
    grossFee = parseFloat(tableRowMatch[3].replace(/,/g, ''));
    vehicleNumber = tableRowMatch[4].trim().toUpperCase();
  } else {
    // Column immediately preceding amount in tabular format
    const claimBeforeAmount = text.match(/([0-9]{15,24}[A-Za-z0-9]*)\s*(?:\|\s*|\t)\s*([\d,]+\.\d{2})/);
    if (claimBeforeAmount) {
      claimNumber = claimBeforeAmount[1].trim();
      grossFee = parseFloat(claimBeforeAmount[2].replace(/,/g, ''));
    } else {
      const claimMatch = text.match(/\b([0-9]{15,24}[A-Za-z0-9]*)\b/);
      claimNumber = claimMatch ? claimMatch[1].trim() : '';
    }

    const vehMatch = text.match(/\b([A-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[A-Z]{0,3}[-\s]?[0-9]{4})\b/i);
    vehicleNumber = vehMatch ? vehMatch[1].trim().toUpperCase() : undefined;

    if (!grossFee && claimNumber) {
      const claimRowRegex = new RegExp(claimNumber + '[\\s\\S]*?([\\d,]+\\.\\d{2})', 'i');
      const rowMatch = text.match(claimRowRegex);
      if (rowMatch) {
        grossFee = parseFloat(rowMatch[1].replace(/,/g, ''));
      }
    }
  }

  if (!grossFee && netPaid > 0) {
    grossFee = netPaid + tdsAmount;
  }

  let paymentDate = '';
  const dateMatch = text.match(/\b(\d{2})[-/](\d{2})[-/](\d{4})\b/) || text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (dateMatch) {
    paymentDate = dateMatch[3] ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : dateMatch[0];
  } else {
    paymentDate = new Date().toISOString().split('T')[0];
  }

  const utrMatch =
    text.match(/\bUTR\s*(?:No\.?|Number)?\s*[:\-]?\s*([A-Za-z0-9]+)/i) ||
    text.match(/\b(?:Reference|Ref|Txn)\s*(?:No\.?|Number)?\s*[:\-]?\s*([A-Za-z0-9]+)/i) ||
    text.match(/\bNEFT\s*(?:Ref|Reference|No\.?|Number)\s*[:\-]?\s*([A-Za-z0-9]+)/i);
  const utrNumber = utrMatch ? utrMatch[1].trim() : '';

  return {
    id: makeId(),
    insurerName,
    paymentDate,
    utrNumber,
    totalAmount: grossFee || netPaid,
    totalTds: tdsAmount,
    netPaid,
    claims: [
      {
        claimNumber,
        ...(vehicleNumber ? { vehicleNumber } : {}),
        ...(policyNumber ? { policyNumber } : {}),
        grossFee: grossFee || netPaid,
        tdsAmount,
        netPaid,
      },
    ],
    rawSource: source,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Attempts to parse text using deterministic rules across all known templates.
 * Returns null if no deterministic template matched.
 */
export function parseDeterministicAdvice(text: string, source: string = 'unknown'): PaymentAdvice | null {
  if (!text || !text.trim()) return null;

  return (
    parseAxisBankCmsPdfText(text, source) ||
    parseUiicEmailText(text, source) ||
    parseNiaEmailText(text, source) ||
    null
  );
}
