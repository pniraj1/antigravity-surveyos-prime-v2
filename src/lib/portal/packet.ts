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
import { projectForBillCheck, resolveBillSalvage } from '@/lib/reports/bill-check-projection';
import { uiicPortalSummary, type UiicGstSlab } from '@/lib/calculations/uiic-portal-summary';

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

export interface NiaPortalPacket {
  v: 1;
  portal: 'nia';
  flow: 'nontieup';
  claimNo: string;
  builtAt: string;
  fields: Partial<Record<CanonicalField, string | number>>;
  files: Array<{ slot: 'assessmentExcel'; name: string; mime: string; base64: string }>;
}

/** What the UIIC map reads, minus towingCharge / invoiceNo (never sent). */
export const UIIC_FIELDS = [
  'surveyDate', 'surveyTime', 'surveyPlace', 'claimantMobile', 'reportNo',
  'ageBasedDep', 'dep50', 'dep30', 'nilDep',
  'gst28AmountP', 'gst18AmountP', 'gst12AmountP', 'gst5AmountP', 'gst0AmountP',
  'labourCharge', 'gst18AmountL', 'gst0AmountL',
  'workshopInvoiceNo', 'salvageValue', 'voluntaryExcess', 'compulsoryExcess',
  'profFeeAmount', 'travelExpense', 'photoCharge', 'dailyAllowance',
] as const;
export type UiicField = (typeof UIIC_FIELDS)[number];

export interface UiicPortalPacket {
  v: 1;
  portal: 'uiic';
  flow: 'claimsurvey';
  claimNo: string;
  builtAt: string;
  fields: Partial<Record<UiicField, string | number>>;
  files: [];
}

export type PortalPacket = NiaPortalPacket | UiicPortalPacket;

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
function compact<K extends string>(o: Record<string, string | number | null | undefined>) {
  const out: Partial<Record<K, string | number>> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === '' || v === null || v === undefined) continue;
    out[k as K] = v;
  }
  return out;
}

export async function buildPortalPacket(
  claim: ClaimData,
  opts: { ageMonths: number },
): Promise<NiaPortalPacket> {
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
    fields: compact<CanonicalField>({
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

/** Portal GST fields exist only for these rates; any other slab is dropped. */
const UIIC_PARTS_GST = [28, 18, 12, 5, 0];
const UIIC_LABOUR_GST = [18, 0];

function gstFields(slabs: UiicGstSlab[], rates: number[], suffix: 'P' | 'L') {
  const out: Record<string, number> = {};
  for (const s of slabs) if (rates.includes(s.rate)) out[`gst${s.rate}Amount${suffix}`] = s.amount;
  return out;
}

export function buildUiicPacket(claim: ClaimData, opts: { ageMonths: number }): UiicPortalPacket {
  const claimNo = (claim.policy?.claimNumber ?? '').trim();
  if (!claimNo) throw new Error('This claim has no claim number; the portal needs one to match on.');

  const fee = claim.feeBill;
  const feeSummary = calculateFeeSummary(fee);
  // R12: always the bill-check basis, whatever the dialog's toggle shows.
  const summary = uiicPortalSummary(
    projectForBillCheck(claim.assessmentRows ?? []),
    opts.ageMonths,
    toDepreciationType(claim.depreciationType),
  );

  return {
    v: 1,
    portal: 'uiic',
    flow: 'claimsurvey',
    claimNo,
    builtAt: new Date().toISOString(),
    fields: compact<UiicField>({
      surveyDate: claim.accident?.dateOfSurvey,
      surveyTime: claim.accident?.timeOfSurvey,
      surveyPlace: claim.accident?.placeOfSurvey,
      claimantMobile: claim.policy?.insuredMobile?.replace(/\D/g, '').slice(-10) || undefined,
      reportNo: claim.reportNo,
      ...summary.parts,
      ...gstFields(summary.partsGst, UIIC_PARTS_GST, 'P'),
      labourCharge: summary.labour.totalLabour,
      ...gstFields(summary.labourGst, UIIC_LABOUR_GST, 'L'),
      workshopInvoiceNo: claim.billCheck?.billNo,
      salvageValue: resolveBillSalvage(fee, claim.assessmentRows ?? []),
      compulsoryExcess: getCompulsoryExcess(fee),
      voluntaryExcess: fee?.voluntaryExcess ?? 0,
      profFeeAmount: fee?.professionalFee ?? 0,
      travelExpense: feeSummary.travelExpenses,
      photoCharge: feeSummary.photographyCharges,
      dailyAllowance: fee?.haltageCharges ?? 0,
    }),
    files: [],
  };
}
