/**
 * Portal-neutral hand-off from a finished claim to the portal-fill extension.
 * Canonical names are the contract; the extension's field map turns them into
 * portal model paths. Nothing here knows an Angular path.
 */
import { createBlankClaim, type ClaimData } from '@/types/claim';
import { calculateBillCheckSummary, getCompulsoryExcess } from '@/lib/calculations/assessment';
import { calculateFeeSummary } from '@/lib/calculations/fees';
import { calculateFeeGST } from '@/lib/calculations/gst';
import { toDepreciationType } from '@/lib/calculations/depreciation';
import {
  buildNiaWorkbook,
  niaAssessmentRows,
  niaPainting,
} from '@/lib/reports/nia-assessment-excel';
import {
  buildOicWorkbook,
  inOicExcel,
  oicAssessmentRows,
  type OicGstType,
  type OicPaintingMode,
} from '@/lib/reports/oic-assessment-excel';
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
  'driverName', 'driverLicenceNo', 'licenceIssuingAuthority', 'licenceIssueDate',
  'licenceExpiryDate', 'driverDob', 'badgeNumber',
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

/**
 * Splits an Indian Driving Licence into the OIC portal's 3 boxes:
 * state code (2), middle, last 4. Under 8 characters it all goes in the middle box.
 */
export function splitIndianDl(dlRaw?: string): { one?: string; two?: string; three?: string } {
  if (!dlRaw) return {};
  const clean = dlRaw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (clean.length < 8) return { two: dlRaw.trim() };
  return { one: clean.slice(0, 2), two: clean.slice(2, -4), three: clean.slice(-4) };
}

/** "MH19DV9776" -> "MH 19 DV 9776"; anything that does not fit stays compact upper-case. */
export function oicRegNumber(raw?: string): string | undefined {
  const compact = raw?.replace(/\s+/g, '').toUpperCase();
  if (!compact) return undefined;
  const m = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/.exec(compact);
  return m ? m.slice(1).filter(Boolean).join(' ') : compact;
}

/**
 * Driving licence "MH18 2010 0012611" -> "MH18": the RTO code (owner: the licence's first 4 characters).
 * Matched on OIC ignoring leading zeros (OIC has MH01 and DL2).
 */
export function oicRtoCode(licence?: string): string | undefined {
  const m = /^([A-Z]{2})(\d{2})/.exec(licence?.replace(/[^A-Za-z0-9]/g, '').toUpperCase() ?? '');
  return m ? m[1] + m[2] : undefined;
}

/** ponytail: one figure for the Excel and step 3, so both use the same row filter. */
export function oicNetLiability(claim: ClaimData, ageMonths: number): number {
  const fee = claim.feeBill;
  const rows = claim.assessmentRows ?? [];
  return calculateBillCheckSummary(
    rows.filter(inOicExcel), ageMonths, toDepreciationType(claim.depreciationType),
    resolveBillSalvage(fee, rows), fee?.compulsoryExcess ?? 0, fee?.voluntaryExcess ?? 0,
    claim, fee?.towingCharges ?? 0,
  ).netLiability;
}

const NAME_TITLES = new Set(['MR', 'MRS', 'MS', 'SHRI', 'SMT', 'KUM', 'DR']);
function normName(n?: string): string {
  return (n ?? '').toUpperCase().replace(/[^A-Z ]/g, ' ').split(/\s+/)
    .filter((w) => w && !NAME_TITLES.has(w)).join(' ');
}

const TWO_WHEELER = /M\.?\s?CYCLE|MOTOR\s?CYCLE|SCOOTER|TWO\s?WHEEL|\b2W\b|MCWG|MCWOG/i;

/**
 * The class that fits the vehicle, in OIC's own option wording (live list, 2026-11-10).
 * No fallback: no fit, or LMV-TR (goods vs passenger unknown), is left for the surveyor.
 */
function pickLicenseType(raw: string | undefined, v: ClaimData['vehicle'] | undefined): string | undefined {
  const classes = (raw ?? '').split(/[,/]/).map((c) => c.trim().toUpperCase()).filter(Boolean);
  if (TWO_WHEELER.test(`${v?.classOfVehicle ?? ''} ${v?.bodyType ?? ''}`)) {
    if (classes.some((c) => c.includes('MCWOG'))) return 'MOTOR CYCLE WITHOUT GEAR';
    return classes.some((c) => c.includes('MCWG')) ? 'MOTOR CYCLE WITH GEAR' : undefined;
  }
  if (v?.isCommercial) return classes.map((c) => c.match(/^(HGV|HPV|MGV|MPV)\b/)?.[1]).find(Boolean);
  return classes.some((c) => /^LMV/.test(c) && !/TR/.test(c)) ? 'LIGHT MOTOR VEHICLE - NON TRANSPORT' : undefined;
}

function localIsoDate(t = new Date()): string {
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

/** Digits only; a leading 91 or 0 on a longer number is dropped. */
function oicMobile(raw?: string): string | undefined {
  const d = raw?.replace(/\D/g, '') ?? '';
  return (d.length > 10 && /^(91|0)/.test(d) ? d.slice(-10) : d) || undefined;
}

/** 'yes' when the surveyor changed anything from a fresh claim's spot defaults. */
function spotSurveyDone(spot: ClaimData['spotDetails'] | undefined): 'yes' | 'no' {
  const blank = createBlankClaim('final', 'private').spotDetails as unknown as Record<string, unknown>;
  const cur = (spot ?? {}) as unknown as Record<string, unknown>;
  return Object.keys(cur).some((k) => JSON.stringify(cur[k]) !== JSON.stringify(blank[k])
    && cur[k] !== undefined && cur[k] !== '') ? 'yes' : 'no';
}

export const OIC_FIELDS = [
  'regNumber', 'rto', 'make', 'model', 'chasisNumber', 'engineNumber',
  'cubicCapacity', 'manufacturingYear', 'colorOfVehicle', 'typeOfFuel',
  'typeOfBody', 'classOfVehicle', 'unladenWeight', 'registeredLadenWeight',
  'seatingCapacity', 'lossDescription', 'driverName',
  'driverLicenseNoOne', 'driverLicenseNoTwo', 'driverLicenseNoThree',
  'driverBadgeNo', 'driverQualification', 'driverAddress',
  'workshopName', 'workshopEstimateAmount', 'workshopGstNo',
  'driverDob', 'dlValidFrom', 'dlValidUpTo', 'licenseType', 'nilDepCover',
  'ownerDriver', 'thirdPartyInvolved', 'workshopEstimateDate', 'dlVerifiedRemarks',
  'spotSurveyDone', 'initialLossAmount', 'claimantMobile', 'surveyorObservation',
  'causeOfAccident', 'surveyorAppointedDate', 'finalDocumentDate',
] as const;
export type OicField = (typeof OIC_FIELDS)[number];

export interface OicPortalPacket {
  v: 1;
  portal: 'oic';
  flow: 'assessment';
  claimNo: string;
  builtAt: string;
  fields: Partial<Record<OicField, string | number>>;
  files: Array<{ slot: 'assessmentExcel'; name: string; mime: string; base64: string }> | [];
}

export type PortalPacket = NiaPortalPacket | UiicPortalPacket | OicPortalPacket;

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
  const dl = claim.driver;
  const dlValidities = [dl?.validityTransport, dl?.validityNonTransport].filter((d) => d?.trim());

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
      driverName: dl?.name?.trim(),
      // The portal accepts letters and digits only.
      driverLicenceNo: dl?.licenceNumber?.replace(/[^A-Za-z0-9]/g, ''),
      licenceIssuingAuthority: dl?.issuingAuthority?.trim(),
      licenceIssueDate: dl?.dateOfIssue,
      // One expiry slot: which validity applies is the surveyor's call when both are set.
      licenceExpiryDate: dlValidities.length === 1 ? dlValidities[0] : undefined,
      driverDob: dl?.dateOfBirth,
      badgeNumber: dl?.badgeNumber?.trim(),
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

export interface BuildOicPacketOptions {
  ageMonths: number;
  invoiceNumber?: string;
  invoiceDate?: string; // DD-MM-YYYY
  gstType?: OicGstType;
  paintingMode?: OicPaintingMode;
  includeExcel?: boolean;
}

export async function buildOicPacket(
  claim: ClaimData,
  opts: BuildOicPacketOptions,
): Promise<OicPortalPacket> {
  const claimNo = (claim.policy?.claimNumber ?? '').trim();
  if (!claimNo) throw new Error('This claim has no claim number; the portal needs one to match on.');

  const v = claim.vehicle;
  const d = claim.driver;
  const a = claim.accident;
  const bc = claim.billCheck;
  const dlParts = splitIndianDl(d?.licenceNumber);
  const depType = toDepreciationType(claim.depreciationType);
  const ownerName = normName(claim.policy?.insuredName);
  const driverName = normName(d?.name);

  let files: OicPortalPacket['files'] = [];
  if (opts.includeExcel !== false) {
    const invNo = opts.invoiceNumber?.trim() || bc?.billNo || (claimNo ? `INV-${claimNo.slice(-4)}` : '1');
    const invDate =
      opts.invoiceDate?.trim() ||
      (bc?.billDate
        ? bc.billDate.split('-').reverse().join('-')
        : new Date().toISOString().split('T')[0].split('-').reverse().join('-'));
    const gstType = opts.gstType || 'CGST/SGST';
    const rows = claim.assessmentRows ?? [];
    const itemRows = oicAssessmentRows(rows, opts.ageMonths, depType, invNo, {
      paintingMode: opts.paintingMode,
    });
    const wb = buildOicWorkbook({
      invoiceNumber: invNo,
      invoiceDate: invDate,
      gstType,
      rows: itemRows,
    });
    const buf = await wb.xlsx.writeBuffer();
    const safeNo = claimNo.replace(/[^A-Za-z0-9_-]+/g, '_');
    files = [
      {
        slot: 'assessmentExcel',
        name: `${safeNo}_OIC_Assessment.xlsx`,
        mime: XLSX_MIME,
        base64: bytesToBase64(buf as ArrayBuffer),
      },
    ];
  }

  return {
    v: 1,
    portal: 'oic',
    flow: 'assessment',
    claimNo,
    builtAt: new Date().toISOString(),
    fields: compact<OicField>({
      regNumber: oicRegNumber(v?.registrationNumber),
      rto: oicRtoCode(d?.licenceNumber),
      make: v?.make?.trim(),
      model: v?.model?.trim(),
      chasisNumber: v?.chassisNumber?.trim(),
      engineNumber: v?.engineNumber?.trim(),
      cubicCapacity: v?.cubicCapacity?.trim(),
      manufacturingYear: v?.yearOfManufacture != null ? String(v.yearOfManufacture) : undefined,
      colorOfVehicle: v?.colour?.trim(),
      typeOfFuel: v?.fuel?.trim(),
      typeOfBody: v?.bodyType?.trim(),
      classOfVehicle: v?.classOfVehicle?.trim(),
      unladenWeight: v?.unladenWeight != null ? String(v.unladenWeight) : undefined,
      registeredLadenWeight:
        v?.registeredLoadWeight?.trim() || (v?.grossWeight != null ? String(v.grossWeight) : undefined),
      seatingCapacity: v?.seatingCapacity?.trim(),
      lossDescription: (a?.causeOfAccident || a?.remarks || '')?.trim().slice(0, 2000) || undefined,
      driverName: d?.name?.trim(),
      driverLicenseNoOne: dlParts.one,
      driverLicenseNoTwo: dlParts.two || d?.licenceNumber?.trim(),
      driverLicenseNoThree: dlParts.three,
      driverBadgeNo: d?.badgeNumber?.trim(),
      driverAddress: d?.address?.trim().slice(0, 240) || undefined,
      workshopName: a?.workshopName?.trim(),
      workshopEstimateAmount: bc?.billTotal ?? undefined,
      workshopEstimateDate: bc?.billDate,
      driverDob: d?.dateOfBirth,
      dlValidFrom: d?.dateOfIssue,
      dlValidUpTo: v?.isCommercial ? d?.validityTransport : d?.validityNonTransport,
      licenseType: pickLicenseType(d?.licenceType, v),
      dlVerifiedRemarks: d?.invalidRemarks?.trim(),
      ownerDriver: ownerName && driverName ? (ownerName === driverName ? 'yes' : 'no') : undefined,
      thirdPartyInvolved: a ? (a.thirdPartyDetails?.trim() ? 'yes' : 'no') : undefined,
      nilDepCover: claim.policyCheck?.nilDep,
      spotSurveyDone: spotSurveyDone(claim.spotDetails),
      initialLossAmount: (claim.assessmentRows ?? []).some(inOicExcel)
        ? oicNetLiability(claim, opts.ageMonths) : undefined,
      claimantMobile: oicMobile(claim.policy?.insuredMobile),
      surveyorObservation: a?.remarks?.trim().slice(0, 2000),
      causeOfAccident: a?.causeOfAccident?.trim().slice(0, 500),
      surveyorAppointedDate: a?.appointmentDate,
      finalDocumentDate: localIsoDate(),
    }),
    files,
  };
}
