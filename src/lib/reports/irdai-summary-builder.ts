// ═══════════════════════════════════════════════════════════
// IRDAI ANNUAL SUMMARY BUILDER
// Generates a multi-sheet Excel workbook for IRDAI annual
// return submission and surveyor analytics.
// ═══════════════════════════════════════════════════════════

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { ClaimData } from '@/types/claim';
import { SurveyorProfile } from '@/types';
import { calculateFeeSummary } from '@/lib/calculations/fees';
import { calculateAssessmentSummary } from '@/lib/calculations/assessment';
import { getVehicleAgeMonths } from '@/lib/calculations/depreciation';
import { formatDateDMY } from '@/lib/calculations';

// ─── Types ──────────────────────────────────────────────────

export interface IRDAIExportOptions {
  financialYear: number;   // e.g. 2025 means FY 2025-26
  includeArchived: boolean;
  surveyTypeFilter: 'all' | 'spot' | 'final';
}

interface ClaimRow {
  sr: number;
  reportNo: string;
  reportDate: string;
  insurerName: string;
  insuredName: string;
  claimNo: string;
  vehicleReg: string;
  vehicleType: string;
  surveyType: string;
  netAssessedLoss: number;
  professionalFee: number;
  riFee: number;
  travelExpenses: number;
  photographyCharges: number;
  postalHaltage: number;
  gstAmount: number;
  totalFee: number;
  feePaid: string;
  status: string;
  month: string;      // "Apr 2025" for grouping
  monthKey: string;   // "2025-04" for sorting
}

// ─── Financial Year Helpers ──────────────────────────────────

export function getFYLabel(year: number): string {
  return `${year}-${String(year + 1).slice(2)}`; // "2025-26"
}

export function getFYRange(year: number): { start: Date; end: Date } {
  return {
    start: new Date(year, 3, 1),           // Apr 1
    end:   new Date(year + 1, 2, 31, 23, 59, 59), // Mar 31
  };
}

export function getCurrentFY(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

// ─── Filter claims by FY and options ────────────────────────

export function filterClaimsForExport(
  claims: ClaimData[],
  options: IRDAIExportOptions
): ClaimData[] {
  const { start, end } = getFYRange(options.financialYear);

  return claims.filter(claim => {
    // Date filter
    const dateStr = claim.reportDate || claim.createdAt;
    const claimDate = new Date(dateStr);
    if (claimDate < start || claimDate > end) return false;

    // Archived filter
    if (!options.includeArchived && !claim.isActive) return false;

    // Survey type filter
    if (options.surveyTypeFilter !== 'all' && claim.surveyType !== options.surveyTypeFilter) return false;

    return true;
  });
}

// ─── Build flat row for each claim ──────────────────────────

function buildClaimRow(claim: ClaimData, index: number): ClaimRow {
  const feeSummary = claim.feeBill
    ? calculateFeeSummary(claim.feeBill)
    : { professionalFee: 0, riFee: 0, travelExpenses: 0, photographyCharges: 0, postalCharges: 0, haltageCharges: 0, gstAmount: 0, grandTotal: 0, subTotal: 0 };

  // Assessment: only meaningful for final surveys
  let netAssessedLoss = 0;
  if (claim.surveyType === 'final' && claim.assessmentRows?.length > 0) {
    try {
      const ageMonths = getVehicleAgeMonths(
        claim.vehicle?.dateOfRegistration ?? null,
        claim.vehicle?.yearOfManufacture ?? null,
      );
      const summary = calculateAssessmentSummary(
        claim.assessmentRows,
        ageMonths,
        'standard',
        claim.feeBill?.salvageValue ?? 0,
        claim.feeBill?.compulsoryExcess ?? 0
      );
      netAssessedLoss = summary.netAssessedLoss;
    } catch {
      netAssessedLoss = 0;
    }
  }

  const vehicleTypeMap: Record<string, string> = {
    'private':        'Private',
    'comm-goods':     'Commercial Goods',
    'comm-passenger': 'Commercial Passenger',
  };

  const dateStr = claim.reportDate || claim.createdAt;
  const d = new Date(dateStr);
  const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

  const statusLabel = !claim.isActive
    ? 'Archived'
    : claim.isCompleted
    ? 'Completed'
    : 'In Progress';

  return {
    sr:                 index + 1,
    reportNo:           claim.reportNo || '—',
    reportDate:         formatDateDMY(dateStr) || '—',
    insurerName:        claim.policy?.insurerName || '—',
    insuredName:        claim.policy?.insuredName || '—',
    claimNo:            claim.policy?.claimNumber || '—',
    vehicleReg:         claim.vehicle?.registrationNumber || '—',
    vehicleType:        vehicleTypeMap[claim.vehicleType] || claim.vehicleType || '—',
    surveyType:         claim.surveyType === 'spot' ? 'Spot' : 'Final',
    netAssessedLoss,
    professionalFee:    feeSummary.professionalFee,
    riFee:              feeSummary.riFee,
    travelExpenses:     feeSummary.travelExpenses,
    photographyCharges: feeSummary.photographyCharges,
    postalHaltage:      feeSummary.postalCharges + feeSummary.haltageCharges,
    gstAmount:          feeSummary.gstAmount,
    totalFee:           feeSummary.grandTotal,
    feePaid:            claim.feeBill?.feePaid ? 'Yes' : 'No',
    status:             statusLabel,
    month:              monthLabel,
    monthKey,
  };
}

// ─── Styling helpers ─────────────────────────────────────────

const NAVY   = '0D1B2A';
const GOLD   = 'D4AF37';
const GREY   = 'F0F2F5';
const GREEN  = 'D1FAE5';
const RED    = 'FEE2E2';
const WHITE  = 'FFFFFF';
const BORDER: Partial<ExcelJS.Borders> = {
  top:    { style: 'thin', color: { argb: '000000' } },
  left:   { style: 'thin', color: { argb: '000000' } },
  bottom: { style: 'thin', color: { argb: '000000' } },
  right:  { style: 'thin', color: { argb: '000000' } },
};

function headerCell(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  value: string,
  bg = NAVY,
  color = WHITE
) {
  const cell = ws.getCell(row, col);
  cell.value = value;
  cell.font  = { bold: true, color: { argb: color }, size: 10, name: 'Calibri' };
  cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = BORDER;
}

function dataCell(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  value: string | number,
  opts: { bold?: boolean; align?: 'left' | 'center' | 'right'; bg?: string; numFmt?: string } = {}
) {
  const cell = ws.getCell(row, col);
  cell.value = value;
  cell.font  = { size: 9, name: 'Calibri', bold: opts.bold };
  cell.alignment = { vertical: 'middle', horizontal: opts.align || 'left', wrapText: false };
  cell.border = BORDER;
  if (opts.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.bg } };
  if (opts.numFmt) cell.numFmt = opts.numFmt;
}

// ─── Sheet 1: Claim Register ─────────────────────────────────

function buildClaimRegister(wb: ExcelJS.Workbook, rows: ClaimRow[], fyLabel: string, profile: SurveyorProfile) {
  const ws = wb.addWorksheet('Claim Register', {
    views: [{ state: 'frozen', ySplit: 3, xSplit: 0 }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.properties.tabColor = { argb: NAVY };

  // Column widths
  const cols = [
    { width: 5  }, // Sr.
    { width: 14 }, // Report No.
    { width: 12 }, // Date
    { width: 22 }, // Insurer
    { width: 22 }, // Insured
    { width: 16 }, // Claim No.
    { width: 12 }, // Vehicle Reg.
    { width: 18 }, // Vehicle Type
    { width: 8  }, // Survey Type
    { width: 14 }, // Net Assessed Loss
    { width: 13 }, // Prof Fee
    { width: 10 }, // RI Fee
    { width: 12 }, // Travel
    { width: 12 }, // Photography
    { width: 12 }, // Postal+Haltage
    { width: 10 }, // GST
    { width: 13 }, // Total Fee
    { width: 8  }, // Fee Paid
    { width: 12 }, // Status
  ];
  ws.columns = cols;

  // Row 1: Surveyor info
  ws.mergeCells('A1:S1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `${profile.name || 'Surveyor'} | Lic: ${profile.licenceNumber || '—'} | IRDAI Annual Return FY ${fyLabel}`;
  titleCell.font = { bold: true, size: 11, name: 'Calibri', color: { argb: WHITE } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 22;

  // Row 2: Column headers
  const headers = [
    'Sr.', 'Report No.', 'Date of report', 'Insurer', 'Insured', 'Claim No.',
    'Vehicle Reg.', 'Vehicle Type', 'Type', 'Net Assessed (₹)',
    'Prof. Fee (₹)', 'RI Fee (₹)', 'Travel (₹)', 'Photography (₹)',
    'Postal+Halt (₹)', 'GST (₹)', 'Total Fee (₹)', 'Paid', 'Status',
  ];
  headers.forEach((h, i) => headerCell(ws, 2, i + 1, h));
  ws.getRow(2).height = 28;

  // Data rows
  rows.forEach((r, i) => {
    const rowNum = i + 3;
    const bg = i % 2 === 0 ? WHITE : GREY;
    const paidBg = r.feePaid === 'Yes' ? GREEN : RED;

    dataCell(ws, rowNum, 1,  r.sr,                 { align: 'center', bg });
    dataCell(ws, rowNum, 2,  r.reportNo,            { bg });
    dataCell(ws, rowNum, 3,  r.reportDate,          { align: 'center', bg });
    dataCell(ws, rowNum, 4,  r.insurerName,         { bg });
    dataCell(ws, rowNum, 5,  r.insuredName,         { bg });
    dataCell(ws, rowNum, 6,  r.claimNo,             { bg });
    dataCell(ws, rowNum, 7,  r.vehicleReg,          { align: 'center', bg });
    dataCell(ws, rowNum, 8,  r.vehicleType,         { bg });
    dataCell(ws, rowNum, 9,  r.surveyType,          { align: 'center', bg });
    dataCell(ws, rowNum, 10, r.netAssessedLoss,     { align: 'right', bg, numFmt: '#,##0.00' });
    dataCell(ws, rowNum, 11, r.professionalFee,     { align: 'right', bg, numFmt: '#,##0.00' });
    dataCell(ws, rowNum, 12, r.riFee,               { align: 'right', bg, numFmt: '#,##0.00' });
    dataCell(ws, rowNum, 13, r.travelExpenses,      { align: 'right', bg, numFmt: '#,##0.00' });
    dataCell(ws, rowNum, 14, r.photographyCharges,  { align: 'right', bg, numFmt: '#,##0.00' });
    dataCell(ws, rowNum, 15, r.postalHaltage,       { align: 'right', bg, numFmt: '#,##0.00' });
    dataCell(ws, rowNum, 16, r.gstAmount,           { align: 'right', bg, numFmt: '#,##0.00' });
    dataCell(ws, rowNum, 17, r.totalFee,            { align: 'right', bold: true, bg, numFmt: '#,##0.00' });
    dataCell(ws, rowNum, 18, r.feePaid,             { align: 'center', bg: paidBg });
    dataCell(ws, rowNum, 19, r.status,              { align: 'center', bg });
  });

  // Totals row
  const totalRow = rows.length + 3;
  ws.mergeCells(totalRow, 1, totalRow, 9);
  const totalLabelCell = ws.getCell(totalRow, 1);
  totalLabelCell.value = `TOTAL (${rows.length} claims)`;
  totalLabelCell.font  = { bold: true, size: 10, name: 'Calibri', color: { argb: WHITE } };
  totalLabelCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  totalLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };
  totalLabelCell.border = BORDER;

  const sum = (field: keyof ClaimRow) => rows.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
  const totalCols: [number, keyof ClaimRow][] = [
    [10, 'netAssessedLoss'], [11, 'professionalFee'], [12, 'riFee'],
    [13, 'travelExpenses'], [14, 'photographyCharges'], [15, 'postalHaltage'],
    [16, 'gstAmount'], [17, 'totalFee'],
  ];
  totalCols.forEach(([col, field]) => {
    dataCell(ws, totalRow, col, sum(field), { align: 'right', bold: true, bg: GOLD, numFmt: '#,##0.00' });
    ws.getCell(totalRow, col).font = { bold: true, size: 10, name: 'Calibri' };
  });

  ws.getRow(totalRow).height = 22;
}

// ─── Sheet 2: Insurer-wise Summary ──────────────────────────

function buildInsurerSummary(wb: ExcelJS.Workbook, rows: ClaimRow[]) {
  const ws = wb.addWorksheet('Insurer-wise Summary');
  ws.properties.tabColor = { argb: '1D4ED8' };
  ws.columns = [
    { width: 28 }, { width: 10 }, { width: 16 },
    { width: 14 }, { width: 14 }, { width: 14 },
    { width: 16 }, { width: 16 },
  ];

  // Group by insurer
  const grouped: Record<string, ClaimRow[]> = {};
  rows.forEach(r => {
    const key = r.insurerName;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });

  const headers = ['Insurer', 'Claims', 'Total Assessed (₹)', 'Min Assessment (₹)', 'Max Assessment (₹)', 'Avg Assessment (₹)', 'Fees Billed (₹)', 'Fees Received (₹)'];
  headers.forEach((h, i) => headerCell(ws, 1, i + 1, h));
  ws.getRow(1).height = 28;

  Object.entries(grouped)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([insurer, claimsGroup], i) => {
      const row = i + 2;
      const bg = i % 2 === 0 ? WHITE : GREY;
      const assessments = claimsGroup.map(c => c.netAssessedLoss).filter(v => v > 0);
      const totalAssessed  = assessments.reduce((s, v) => s + v, 0);
      const minAssessed    = assessments.length ? Math.min(...assessments) : 0;
      const maxAssessed    = assessments.length ? Math.max(...assessments) : 0;
      const avgAssessed    = assessments.length ? totalAssessed / assessments.length : 0;
      const feesBilled     = claimsGroup.reduce((s, c) => s + c.totalFee, 0);
      const feesReceived   = claimsGroup.filter(c => c.feePaid === 'Yes').reduce((s, c) => s + c.totalFee, 0);

      dataCell(ws, row, 1, insurer,       { bg, bold: true });
      dataCell(ws, row, 2, claimsGroup.length, { align: 'center', bg });
      dataCell(ws, row, 3, totalAssessed, { align: 'right', bg, numFmt: '#,##0.00' });
      dataCell(ws, row, 4, minAssessed,   { align: 'right', bg, numFmt: '#,##0.00' });
      dataCell(ws, row, 5, maxAssessed,   { align: 'right', bg, numFmt: '#,##0.00' });
      dataCell(ws, row, 6, avgAssessed,   { align: 'right', bg, numFmt: '#,##0.00' });
      dataCell(ws, row, 7, feesBilled,    { align: 'right', bg, numFmt: '#,##0.00' });
      dataCell(ws, row, 8, feesReceived,  { align: 'right', bg: feesReceived >= feesBilled ? GREEN : RED, numFmt: '#,##0.00' });
    });
}

// ─── Sheet 3: Month-wise Fee Summary ────────────────────────

function buildMonthSummary(wb: ExcelJS.Workbook, rows: ClaimRow[], fyLabel: string) {
  const ws = wb.addWorksheet('Month-wise Fees');
  ws.properties.tabColor = { argb: '059669' };
  ws.columns = [
    { width: 14 }, { width: 10 }, { width: 14 }, { width: 12 },
    { width: 14 }, { width: 10 }, { width: 14 }, { width: 14 },
  ];

  const headers = ['Month', 'Claims', 'Prof. Fee (₹)', 'RI Fee (₹)', 'Travel + Photo (₹)', 'GST (₹)', 'Total Fee (₹)', 'Received (₹)'];
  headers.forEach((h, i) => headerCell(ws, 1, i + 1, h));
  ws.getRow(1).height = 28;

  // Generate all 12 months in the FY
  const [fyStart] = fyLabel.split('-');
  const startYear = parseInt(fyStart);
  const fyMonths: string[] = [];
  for (let m = 3; m <= 14; m++) {
    const d = new Date(startYear, m, 1);
    fyMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  fyMonths.forEach((monthKey, i) => {
    const monthRows = rows.filter(r => r.monthKey === monthKey);
    const row = i + 2;
    const bg = i % 2 === 0 ? WHITE : GREY;

    const label = monthRows[0]?.month || new Date(monthKey + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    const totalFee    = monthRows.reduce((s, r) => s + r.totalFee, 0);
    const received    = monthRows.filter(r => r.feePaid === 'Yes').reduce((s, r) => s + r.totalFee, 0);

    dataCell(ws, row, 1, label,           { bold: true, bg });
    dataCell(ws, row, 2, monthRows.length, { align: 'center', bg });
    dataCell(ws, row, 3, monthRows.reduce((s, r) => s + r.professionalFee, 0),                     { align: 'right', bg, numFmt: '#,##0.00' });
    dataCell(ws, row, 4, monthRows.reduce((s, r) => s + r.riFee, 0),                               { align: 'right', bg, numFmt: '#,##0.00' });
    dataCell(ws, row, 5, monthRows.reduce((s, r) => s + r.travelExpenses + r.photographyCharges, 0), { align: 'right', bg, numFmt: '#,##0.00' });
    dataCell(ws, row, 6, monthRows.reduce((s, r) => s + r.gstAmount, 0),                           { align: 'right', bg, numFmt: '#,##0.00' });
    dataCell(ws, row, 7, totalFee,        { align: 'right', bold: true, bg, numFmt: '#,##0.00' });
    dataCell(ws, row, 8, received,        { align: 'right', bg: received > 0 ? GREEN : WHITE, numFmt: '#,##0.00' });
  });
}

// ─── Sheet 4: Analytics ─────────────────────────────────────

function buildAnalytics(wb: ExcelJS.Workbook, rows: ClaimRow[]) {
  const ws = wb.addWorksheet('Analytics');
  ws.properties.tabColor = { argb: '7C3AED' };
  ws.columns = [{ width: 28 }, { width: 14 }, { width: 12 }];

  let currentRow = 1;

  const section = (title: string) => {
    ws.mergeCells(currentRow, 1, currentRow, 3);
    const cell = ws.getCell(currentRow, 1);
    cell.value = title;
    cell.font  = { bold: true, color: { argb: WHITE }, size: 11, name: 'Calibri' };
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    ws.getRow(currentRow).height = 22;
    currentRow++;
  };

  const analyticsRow = (label: string, value: string | number, pct?: string) => {
    const bg = currentRow % 2 === 0 ? GREY : WHITE;
    dataCell(ws, currentRow, 1, label, { bg });
    dataCell(ws, currentRow, 2, value, { align: 'right', bold: true, bg, numFmt: typeof value === 'number' ? '#,##0.00' : undefined });
    dataCell(ws, currentRow, 3, pct || '', { align: 'center', bg });
    currentRow++;
  };

  const total = rows.length;
  const pct = (n: number) => total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '—';

  // Survey Type
  section('Survey Type Breakdown');
  const spotCount  = rows.filter(r => r.surveyType === 'Spot').length;
  const finalCount = rows.filter(r => r.surveyType === 'Final').length;
  analyticsRow('Spot Surveys',  spotCount,  pct(spotCount));
  analyticsRow('Final Surveys', finalCount, pct(finalCount));
  analyticsRow('Total Claims',  total,      '100%');
  currentRow++;

  // Vehicle Type
  section('Vehicle Type Breakdown');
  const pvt  = rows.filter(r => r.vehicleType === 'Private').length;
  const goods = rows.filter(r => r.vehicleType === 'Commercial Goods').length;
  const pass  = rows.filter(r => r.vehicleType === 'Commercial Passenger').length;
  analyticsRow('Private',                pvt,   pct(pvt));
  analyticsRow('Commercial Goods',       goods,  pct(goods));
  analyticsRow('Commercial Passenger',   pass,   pct(pass));
  currentRow++;

  // Assessment Buckets
  section('Assessment Range Distribution');
  const buckets = [
    { label: 'Below ₹1 Lakh',      min: 0,       max: 100000  },
    { label: '₹1L – ₹3L',          min: 100000,  max: 300000  },
    { label: '₹3L – ₹5L',          min: 300000,  max: 500000  },
    { label: '₹5L – ₹10L',         min: 500000,  max: 1000000 },
    { label: 'Above ₹10 Lakh',     min: 1000000, max: Infinity },
  ];
  const withAssessment = rows.filter(r => r.netAssessedLoss > 0);
  buckets.forEach(b => {
    const count = withAssessment.filter(r => r.netAssessedLoss >= b.min && r.netAssessedLoss < b.max).length;
    analyticsRow(b.label, count, withAssessment.length > 0 ? pct(count) : '—');
  });
  currentRow++;

  // Fee Summary
  section('Fee Summary');
  const totalFees     = rows.reduce((s, r) => s + r.totalFee, 0);
  const received      = rows.filter(r => r.feePaid === 'Yes').reduce((s, r) => s + r.totalFee, 0);
  const outstanding   = totalFees - received;
  const totalGST      = rows.reduce((s, r) => s + r.gstAmount, 0);
  const totalProfFee  = rows.reduce((s, r) => s + r.professionalFee, 0);
  analyticsRow('Total Fees Billed (₹)',    totalFees);
  analyticsRow('Total Fees Received (₹)', received);
  analyticsRow('Outstanding (₹)',         outstanding);
  analyticsRow('Total GST Collected (₹)', totalGST);
  analyticsRow('Total Professional Fee (₹)', totalProfFee);
  analyticsRow('Paid Claims',             rows.filter(r => r.feePaid === 'Yes').length, pct(rows.filter(r => r.feePaid === 'Yes').length));
  analyticsRow('Unpaid Claims',           rows.filter(r => r.feePaid === 'No').length,  pct(rows.filter(r => r.feePaid === 'No').length));
}

// ─── Main Export Function ────────────────────────────────────

export async function generateIRDAISummary(
  claims: ClaimData[],
  profile: SurveyorProfile,
  options: IRDAIExportOptions
): Promise<void> {
  const fyLabel = getFYLabel(options.financialYear);
  const rows = claims.map((c, i) => buildClaimRow(c, i));

  const wb = new ExcelJS.Workbook();
  wb.creator  = profile.name || 'SurveyOS';
  wb.subject  = `IRDAI Annual Return FY ${fyLabel}`;
  wb.created  = new Date();

  buildClaimRegister(wb, rows, fyLabel, profile);
  buildInsurerSummary(wb, rows);
  buildMonthSummary(wb, rows, fyLabel);
  buildAnalytics(wb, rows);

  const buffer = await wb.xlsx.writeBuffer();
  const safeName = (profile.name || 'Surveyor').replace(/[^a-zA-Z0-9]/g, '_');
  saveAs(new Blob([buffer]), `IRDAI_Return_FY${fyLabel}_${safeName}.xlsx`);
}
