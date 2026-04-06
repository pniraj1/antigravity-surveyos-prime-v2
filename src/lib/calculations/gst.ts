// ═══════════════════════════════════════════════════════════
// GST CALCULATION ENGINE
// Mirrors: recalcSummary() GST logic from
// Surveyor_V6_MASTER.html lines 1896-1910
//
// Parts: 9% CGST + 9% SGST = 18% total (applied on base)
// Labour: 18% GST flat (single line)
// ═══════════════════════════════════════════════════════════

export interface GSTBreakdown {
  baseAmount: number;
  cgst: number;
  sgst: number;
  igst: number; // for inter-state (future)
  totalGST: number;
  totalWithGST: number;
}

/**
 * Calculate parts GST (split CGST + SGST at 9% each).
 * Legacy: pGST = pb * 0.09, pT = pb + pGST * 2
 */
export function calculatePartsGST(partsBase: number): GSTBreakdown {
  const cgst = partsBase * 0.09;
  const sgst = partsBase * 0.09;
  return {
    baseAmount: partsBase,
    cgst,
    sgst,
    igst: 0,
    totalGST: cgst + sgst,
    totalWithGST: partsBase + cgst + sgst,
  };
}

/**
 * Calculate labour/paint GST (flat 18%).
 * Legacy: lGST = labBase * 0.18, lT = labBase + lGST
 */
export function calculateLabourGST(labourBase: number): GSTBreakdown {
  const gst = labourBase * 0.18;
  return {
    baseAmount: labourBase,
    cgst: gst / 2,
    sgst: gst / 2,
    igst: 0,
    totalGST: gst,
    totalWithGST: labourBase + gst,
  };
}

/**
 * Calculate GST for fee bill (18% SAC 998549).
 */
export function calculateFeeGST(feeTotal: number): GSTBreakdown {
  const gst = feeTotal * 0.18;
  return {
    baseAmount: feeTotal,
    cgst: gst / 2,
    sgst: gst / 2,
    igst: 0,
    totalGST: gst,
    totalWithGST: feeTotal + gst,
  };
}
