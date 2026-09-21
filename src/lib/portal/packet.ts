/**
 * Portal-neutral hand-off from a finished claim to the portal-fill extension.
 * Canonical names are the contract; the extension's field map turns them into
 * portal model paths. Nothing here knows an Angular path.
 */
import type { ClaimData } from '@/types/claim';
import { getCompulsoryExcess } from '@/lib/calculations/assessment';
import { calculateFeeSummary } from '@/lib/calculations/fees';
import { calculateFeeGST } from '@/lib/calculations/gst';
import { toDepreciationType } from '@/lib/calculations/depreciation';
import {
  buildNiaWorkbook,
  niaAssessmentRows,
  niaPainting,
} from '@/lib/reports/nia-assessment-excel';
import { resolveBillSalvage } from '@/lib/reports/bill-check-projection';

export const CANONICAL_FIELDS = [
  'surveyDate', 'surveyTime', 'surveyPlace',
  'claimantMobile', 'claimantEmail',
  'vendorInvoiceNo', 'vendorInvoiceDate', 'gstApplicable',
  'paintingEstimate', 'paintingAssessed',
  'noOfInvoices', 'netSalvage', 'compulsoryExcess', 'voluntaryExcess',
  'feeInvoiceDate', 'professionalFee', 'photosAmount', 'conveyanceAmount',
  'feeOthers', 'feeGstApplicable', 'feeGstPercent',
] as const;
export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export interface PortalPacket {
  v: 1;
  portal: 'nia';
  flow: 'nontieup';
  claimNo: string;
  builtAt: string;
  fields: Partial<Record<CanonicalField, string | number>>;
  files: Array<{ slot: 'assessmentExcel'; name: string; mime: string; base64: string }>;
}

/** The fee-bill GST rate the engine applies, as a whole percent. */
const FEE_GST_PERCENT = Math.round(calculateFeeGST(100).totalGST);

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function bytesToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

/** Drop empty strings, null and undefined so the extension never "fills" a blank. */
function compact(o: Record<string, string | number | null | undefined>) {
  const out: Partial<Record<CanonicalField, string | number>> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === '' || v === null || v === undefined) continue;
    out[k as CanonicalField] = v;
  }
  return out;
}

export async function buildPortalPacket(
  claim: ClaimData,
  opts: { ageMonths: number },
): Promise<PortalPacket> {
  const claimNo = (claim.policy?.claimNumber ?? '').trim();
  if (!claimNo) throw new Error('This claim has no claim number; the portal needs one to match on.');

  const depType = toDepreciationType(claim.depreciationType);
  const rows = claim.assessmentRows ?? [];
  const fee = claim.feeBill;
  const feeSummary = calculateFeeSummary(fee);
  const painting = niaPainting(rows);
  const isNilDep = depType === 'nil';

  const sheetRows = niaAssessmentRows(rows, opts.ageMonths, depType);
  const wb = buildNiaWorkbook(sheetRows);
  const buf = await wb.xlsx.writeBuffer();
  const safeNo = claimNo.replace(/[^A-Za-z0-9_-]+/g, '_');

  return {
    v: 1,
    portal: 'nia',
    flow: 'nontieup',
    claimNo,
    builtAt: new Date().toISOString(),
    fields: compact({
      surveyDate: claim.accident?.dateOfSurvey,
      surveyTime: claim.accident?.timeOfSurvey,
      surveyPlace: claim.accident?.placeOfSurvey,
      claimantMobile: claim.policy?.insuredMobile?.replace(/\D/g, '').slice(-10) || undefined,
      vendorInvoiceNo: claim.billCheck?.billNo,
      vendorInvoiceDate: claim.billCheck?.billDate,
      gstApplicable: rows.some((r) => (r.gst ?? 0) > 0) ? 'Y' : 'N',
      // R11: on nil-dep the painting is a labour row inside the file; the
      // Painting section must stay empty.
      paintingEstimate: isNilDep ? undefined : painting.estimate,
      paintingAssessed: isNilDep ? undefined : painting.assessed,
      noOfInvoices: '1',
      netSalvage: resolveBillSalvage(fee, rows),
      compulsoryExcess: getCompulsoryExcess(fee),
      voluntaryExcess: fee?.voluntaryExcess ?? 0,
      feeInvoiceDate: fee?.billDate,
      professionalFee: fee?.professionalFee ?? 0,
      photosAmount: feeSummary.photographyCharges,
      conveyanceAmount: feeSummary.travelExpenses,
      feeOthers: (fee?.postalCharges ?? 0) + (fee?.haltageCharges ?? 0),
      feeGstApplicable: fee?.includeGST ? 'Y' : 'N',
      feeGstPercent: fee?.includeGST ? FEE_GST_PERCENT : undefined,
    }),
    files: [
      {
        slot: 'assessmentExcel',
        name: `${safeNo}_Primary_Assessment_Template.xlsx`,
        mime: XLSX_MIME,
        base64: bytesToBase64(buf as ArrayBuffer),
      },
    ],
  };
}
