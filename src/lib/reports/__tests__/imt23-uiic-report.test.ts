import { describe, it, expect } from 'vitest';
import { buildUIICFinalHTML, buildUIICBillCheckHTML } from '../uiic-final-builder';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

const row = (o: Partial<AssessmentRow> = {}): AssessmentRow => ({
  id: Math.random().toString(36).slice(2),
  particulars: 'INDICATOR FR RH',
  estimated: 300,
  assessed: 300,
  partType: 'plastic',
  gst: 0,
  section: 'parts',
  allowed: true,
  isDisposal: false,
  disposalPercent: 50,
  ...o,
});

function claimWith(rows: AssessmentRow[], extra: Partial<ClaimData> = {}): ClaimData {
  return {
    id: 'c1',
    assessmentRows: rows,
    depreciationType: 'nil',
    vehicle: { registrationNumber: 'MH12AB1234', dateOfRegistration: '2025-01-01', yearOfManufacture: 2024 },
    policy: {},
    accident: { dateAndTime: '2026-08-05T10:00' },
    driver: {},
    spotDetails: {},
    reinspection: {},
    feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0 },
    billCheck: { billNo: 'B1', billDate: '2026-08-01', billTotal: 0 },
    ...extra,
  } as unknown as ClaimData;
}

const build = (c: ClaimData) => buildUIICFinalHTML(c, null);

describe('UIIC report — IMT-23', () => {
  it('prints a per-row Less Imt 23 line with the halved figure', () => {
    const html = build(claimWith([row({ imt23: true })]));
    expect(html).toContain('Less Imt 23');
    expect(html).toContain('150.00');
  });

  it('prints no per-row line for an untagged row', () => {
    const html = build(claimWith([row()]));
    expect(html).not.toContain('Less Imt 23');
  });

  const FOOTNOTE_PHRASE = 'Theft of these items is excluded under all circumstances';

  it('prints the explanatory footnote when a row is tagged', () => {
    const html = build(claimWith([row({ imt23: true })]));
    expect(html).toContain(FOOTNOTE_PHRASE);
    expect(html).toContain('Rows carrying a "Less Imt 23" line are covered under Endorsement IMT-23.');
  });

  it('no footnote when nothing is tagged', () => {
    const html = build(claimWith([row()]));
    expect(html).not.toContain(FOOTNOTE_PHRASE);
  });

  it('prints the paint block with the effective rate, as this format does', () => {
    const html = build(claimWith(
      [row({ section: 'paint', partType: 'paint', assessed: 24000, imt23: true })],
      { depreciationType: 'standard', applyPaintMaterialDep: true } as Partial<ClaimData>,
    ));
    expect(html).toContain('LESS PAINT DEP: 12.5%');
    expect(html).toContain('12,000.00');
  });
});

describe('UIIC report — IMT-23 depreciation column (basis-consistent)', () => {
  // Row 36 of the real settled report: list 300, IMT-23 tagged, 50% depreciation.
  // Basis 150, depreciation 75, assessment 75. The Depreciation column is the
  // dep actually taken on the basis the row was assessed on (150 - 75 = 75),
  // NOT full assessed minus afterDep (300 - 75 = 225).
  // The Dep Amt cell sits immediately after the Dep% cell in the item row.
  const depAmtCell = (html: string) =>
    html.match(/>50%\*?<\/td>\s*<td[^>]*text-align:right;">([\d.]+)</)?.[1];

  it('final builder: tagged row Dep Amt cell is 75.00, not 225.00', () => {
    const html = build(claimWith([row({ imt23: true, depOverride: 50 })]));
    expect(depAmtCell(html)).toBe('75.00');
  });

  it('bill-check builder: tagged row cell and item-table depreciation totals are 75.00, not 225.00', () => {
    const html = buildUIICBillCheckHTML(claimWith([row({ imt23: true, depOverride: 50 })]), null);
    expect(depAmtCell(html)).toBe('75.00');
    // Item table spans SPARE PARTS .. GST SUMMARY: rows + the SUB TOTAL and
    // TOTAL depreciation reducers. None may show the overstated 225.00.
    const itemTable = html.slice(html.indexOf('SPARE PARTS'), html.indexOf('GST SUMMARY'));
    expect(itemTable).not.toContain('225.00');
    expect(itemTable).toContain('75.00');
  });

  it('no-IMT-23 case is unchanged: untagged row at 50% dep still prints 150.00', () => {
    const finalHtml = build(claimWith([row({ depOverride: 50 })]));
    const billHtml = buildUIICBillCheckHTML(claimWith([row({ depOverride: 50 })]), null);
    // untagged: effectiveAssessed === assessed, so 300 - 150 = 150.00, unchanged.
    expect(depAmtCell(finalHtml)).toBe('150.00');
    expect(depAmtCell(billHtml)).toBe('150.00');
  });
});

describe('UIIC report — IMT-23 headline Depreciation figures (basis-consistent)', () => {
  // One tagged 300 part at 50% depreciation: basis 150, dep 75, assessment 75.
  // Every headline "Depreciation" figure and the SPARE PARTS sub-total dep cell
  // must be 75.00. The broken form (rawParts − partsDepreciated) prints 225.00.
  const page1Dep = (html: string) =>
    html.match(/Depreciation<\/td>\s*<td[^>]*text-align:right;">([\d,.]+)</)?.[1];

  const taggedClaim = () => claimWith([row({ imt23: true, depOverride: 50 })]);

  it('final report page-1 "Depreciation" summary is 75.00, not 225.00', () => {
    const html = build(taggedClaim());
    expect(page1Dep(html)).toBe('75.00');
    expect(html).not.toContain('225.00');
  });

  it('final report SPARE PARTS sub-total depreciation cell is 75.00, not 225.00', () => {
    const html = build(taggedClaim());
    const section = html.slice(
      html.indexOf('DETAILS OF ASSESSMENT'),
      html.indexOf('SERVICES BEFORE TAX'),
    );
    expect(section).toContain('SUB TOTAL');
    expect(section).not.toContain('225.00');
    expect(section).toContain('75.00');
  });

  it('bill-check page-1 "Depreciation" summary is 75.00, not 225.00', () => {
    const html = buildUIICBillCheckHTML(taggedClaim(), null);
    expect(page1Dep(html)).toBe('75.00');
    expect(html).not.toContain('225.00');
  });

  it('no tagged rows: headline Depreciation figures are unchanged (150.00)', () => {
    const c = () => claimWith([row({ depOverride: 50 })]);
    const finalHtml = build(c());
    const billHtml = buildUIICBillCheckHTML(c(), null);
    expect(page1Dep(finalHtml)).toBe('150.00');
    expect(page1Dep(billHtml)).toBe('150.00');
    const section = finalHtml.slice(
      finalHtml.indexOf('DETAILS OF ASSESSMENT'),
      finalHtml.indexOf('SERVICES BEFORE TAX'),
    );
    // 300 list − 150 dep = 150.00 assessment; no 225 anywhere.
    expect(section).not.toContain('225.00');
  });
});

describe('UIIC bill check — IMT-23 explanation on the page', () => {
  const FOOTNOTE_PHRASE = 'Theft of these items is excluded under all circumstances';

  // The bill-check item table shows the row's full pre-depreciation basis in
  // the "Parts Assessment" cell (fa(r.assessed)); "Part List Without Tax" shows
  // the workshop estimate. The Less Imt 23 line must be exactly half the
  // Parts Assessment figure directly above it, never half the estimate.
  it('renders a Less Imt 23 line that is half the Parts Assessment figure above it', () => {
    const html = buildUIICBillCheckHTML(
      claimWith([row({ imt23: true, estimated: 400, assessed: 300 })]),
      null,
    );
    const rowBlock = html.slice(html.indexOf('SPARE PARTS'), html.indexOf('GST SUMMARY'));
    expect(rowBlock).toContain('Less Imt 23');
    expect(rowBlock).toContain('150.00'); // 300 / 2
    expect(rowBlock).not.toContain('200.00'); // NOT 400 (estimate) / 2
  });

  it('renders no Less Imt 23 line for a tagged but not-in-bill row', () => {
    const html = buildUIICBillCheckHTML(
      claimWith([row({ imt23: true, billStatus: 'not-in-bill' })]),
      null,
    );
    expect(html).not.toContain('Less Imt 23</td>'); // the per-row line; footnote may still cite it
  });

  it('an untagged claim renders neither the line nor the footnote', () => {
    const html = buildUIICBillCheckHTML(claimWith([row()]), null);
    expect(html).not.toContain('Less Imt 23');
    expect(html).not.toContain(FOOTNOTE_PHRASE);
  });

  it('renders the footnote when a tagged row is present', () => {
    const html = buildUIICBillCheckHTML(claimWith([row({ imt23: true })]), null);
    expect(html).toContain(FOOTNOTE_PHRASE);
    expect(html).toContain('Rows carrying a "Less Imt 23" line are covered under Endorsement IMT-23.');
  });
});
