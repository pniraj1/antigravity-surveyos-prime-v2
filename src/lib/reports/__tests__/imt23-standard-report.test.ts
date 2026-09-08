import { describe, it, expect } from 'vitest';
import { buildStandardFinalSurveyHTML } from '../standard-report-builder';
import { calculateAssessmentSummary, getCompulsoryExcess } from '@/lib/calculations/assessment';
import { toDepreciationType } from '@/lib/calculations/depreciation';
import { getVehicleAgeMonths } from '../report-utils';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

const row = (o: Partial<AssessmentRow> = {}): AssessmentRow => ({
  id: Math.random().toString(36).slice(2),
  particulars: 'BUMPER',
  estimated: 4100,
  assessed: 4100,
  partType: 'metal',
  gst: 18,
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

const build = (c: ClaimData) => buildStandardFinalSurveyHTML(c, {} as never);

describe('standard report — IMT-23', () => {
  it('prints the deduction line with the item count', () => {
    const html = build(claimWith([row({ imt23: true })]));
    expect(html).toContain('Less endorsement 23');
    expect(html).toContain('1 item');
  });

  it('prints no deduction line when nothing is ticked', () => {
    const html = build(claimWith([row()]));
    expect(html).not.toContain('Less endorsement 23');
  });

  it('tags the row and leaves the stored particulars alone', () => {
    const rows = [row({ imt23: true })];
    const html = build(claimWith(rows));
    expect(html).toContain('BUMPER - IMT 23');
    expect(rows[0].particulars).toBe('BUMPER');
  });

  it('halves the row net columns and prints a Less Imt 23 sub-line', () => {
    // Design changed (surveyor rejected the gross-row shape): a tagged row's
    // net columns now show the halved post-endorsement basis, with a labelled
    // sub-line beneath. Assessed stays gross.
    const html = build(claimWith([row({ imt23: true })]));
    const partRow = html.slice(
      html.indexOf('SPARE PARTS'),
      html.indexOf('Sub-Total Parts'),
    );
    expect(partRow).toContain('4,100.00');       // Assessed cell stays gross
    expect(partRow).toContain('Less Imt 23');    // the sub-line label
    expect(partRow).toContain('2,050.00');       // halved basis (material cell + sub-line)
    expect(partRow).toContain('2,419.00');       // 2,050 × 1.18, halved Price+GST
    expect(partRow).not.toContain('4,838.00');   // never the gross Price+GST now
  });

  it('a tagged row with non-zero depreciation: material cell and sub-line differ', () => {
    // The case the format exists for. Halved basis 2,050; after 25% dep the
    // metal cell is 1,537.50 and Price+GST 1,814.25, while the sub-line still
    // shows the un-depreciated halved basis 2,050 and Assessed stays gross.
    const html = build(claimWith([row({ imt23: true, partType: 'metal', depOverride: 25 })]));
    const partRow = html.slice(
      html.indexOf('SPARE PARTS'),
      html.indexOf('Sub-Total Parts'),
    );
    expect(partRow).toContain('4,100.00');   // Assessed cell stays gross
    expect(partRow).toContain('2,050.00');   // sub-line: halved basis, no dep
    expect(partRow).toContain('1,537.50');   // metal material cell: 2,050 × 0.75
    expect(partRow).toContain('1,814.25');   // Price+GST: 1,537.50 × 1.18
  });

  it("a tagged row's Price+GST is half what an untagged one shows", () => {
    const tagged = build(claimWith([row({ imt23: true })]));
    const plain = build(claimWith([row()]));
    expect(plain.slice(plain.indexOf('SPARE PARTS'), plain.indexOf('Sub-Total Parts'))).toContain('4,838.00');
    expect(tagged.slice(tagged.indexOf('SPARE PARTS'), tagged.indexOf('Sub-Total Parts'))).toContain('2,419.00');
  });

  it('prints no sub-line for a tagged row with a zero basis', () => {
    const html = build(claimWith([row({ imt23: true, assessed: 0 })]));
    expect(html).not.toContain('Less Imt 23');
  });

  it('an untagged claim renders no Less Imt 23 sub-line and is unchanged', () => {
    const html = build(claimWith([row()]));
    expect(html).not.toContain('Less Imt 23');
    const partRow = html.slice(html.indexOf('SPARE PARTS'), html.indexOf('Sub-Total Parts'));
    expect(partRow).toContain('4,100.00');
    expect(partRow).toContain('4,838.00');
  });

  it('paint subtotal is net of GR-9 paint-material depreciation, matching the engine', () => {
    const c = claimWith(
      [row({ section: 'paint', partType: 'paint', assessed: 10000, estimated: 10000, gst: 18 })],
      { depreciationType: 'standard', applyPaintMaterialDep: true } as Partial<ClaimData>,
    );
    const ageMonths = getVehicleAgeMonths(
      c.vehicle.dateOfRegistration || null,
      c.vehicle.yearOfManufacture ? Number(c.vehicle.yearOfManufacture) : null,
      c.accident.dateAndTime || null,
    );
    const summary = calculateAssessmentSummary(
      c.assessmentRows!, ageMonths, toDepreciationType(c.depreciationType),
      0, getCompulsoryExcess(c.feeBill), c.feeBill?.voluntaryExcess ?? 0, c,
    );
    expect(summary.paintOnlyBase).toBe(8750);

    const html = build(c);
    // The "after dep, before GST" subtotal cell spans the material columns (colspan="4").
    const sub = html.slice(html.indexOf('Sub-Total Painting'), html.indexOf('Sub-Total Painting') + 900);
    const cell = /colspan="4"[^>]*>([\d,]+\.\d\d)</.exec(sub);
    expect(cell?.[1]).toBe('8,750.00');

    // Section 8 GRAND TOTAL, "Assessed (after Dep.)" column must reconcile too.
    const grandRow = html.slice(html.indexOf('GRAND TOTAL'), html.indexOf('GRAND TOTAL') + 600);
    const engineGrandBase = summary.partsBase + summary.labourOnlyBase + summary.paintOnlyBase;
    expect(engineGrandBase).toBe(8750);
    expect(grandRow).toContain('8,750.00');
  });

  it('labour subtotal reflects a surveyor depOverride, matching the engine', () => {
    const c = claimWith(
      [row({ section: 'labour', partType: 'labour', assessed: 10000, estimated: 10000, gst: 18, depOverride: 30 })],
    );
    const ageMonths = getVehicleAgeMonths(
      c.vehicle.dateOfRegistration || null,
      c.vehicle.yearOfManufacture ? Number(c.vehicle.yearOfManufacture) : null,
      c.accident.dateAndTime || null,
    );
    const summary = calculateAssessmentSummary(
      c.assessmentRows!, ageMonths, toDepreciationType(c.depreciationType),
      0, getCompulsoryExcess(c.feeBill), c.feeBill?.voluntaryExcess ?? 0, c,
    );
    expect(summary.labourOnlyBase).toBe(7000);

    const html = build(c);
    const sub = html.slice(html.indexOf('Sub-Total Labour'), html.indexOf('Sub-Total Labour') + 900);
    const cell = /colspan="4"[^>]*>([\d,]+\.\d\d)</.exec(sub);
    expect(cell?.[1]).toBe('7,000.00');
  });

  it('omits the paint-material note when every allowed paint row carries a depOverride', () => {
    // An overridden paint row never took the automatic 25%/50% material rule,
    // so it must not feed the note. Note + subtotal would otherwise print two
    // contradictory figures on the same signed page.
    const c = claimWith(
      [row({ section: 'paint', partType: 'paint', assessed: 10000, estimated: 10000, depOverride: 30 })],
      { depreciationType: 'standard', applyPaintMaterialDep: true } as Partial<ClaimData>,
    );
    const html = build(c);
    const sub = html.slice(html.indexOf('Sub-Total Painting'), html.indexOf('Sub-Total Painting') + 900);
    expect(/colspan="4"[^>]*>([\d,]+\.\d\d)</.exec(sub)?.[1]).toBe('7,000.00');
    expect(html).not.toContain('Less 50% dep. on paint material');
  });

  it('bases the paint-material note only on paint rows that took the automatic rate', () => {
    const c = claimWith(
      [
        row({ section: 'paint', partType: 'paint', assessed: 8000, estimated: 8000 }),
        row({ section: 'paint', partType: 'paint', assessed: 10000, estimated: 10000, depOverride: 30 }),
      ],
      { depreciationType: 'standard', applyPaintMaterialDep: true } as Partial<ClaimData>,
    );
    const html = build(c);
    // Only the 8,000 auto row feeds the note: 8,000 @ 25% = 2,000, less 50% = 1,000.
    expect(html).toContain('(2,000.00 of 8,000.00 @ 25%)');
    expect(html).toContain('=&nbsp; 1,000.00');
  });

  const FOOTNOTE_PHRASE = 'Theft of these items is excluded under all circumstances';

  it('final: prints the explanatory footnote when a row is tagged', () => {
    const html = build(claimWith([row({ imt23: true })]));
    expect(html).toContain(FOOTNOTE_PHRASE);
    expect(html).toContain('Rows marked "- IMT 23" are covered under Endorsement IMT-23.');
  });

  it('final: no footnote when nothing is tagged', () => {
    const html = build(claimWith([row()]));
    expect(html).not.toContain(FOOTNOTE_PHRASE);
  });

  it('bill check: prints the footnote with the asterisk opening clause', () => {
    const html = buildStandardFinalSurveyHTML(
      claimWith([row({ imt23: true })]), {} as never, 'bill-check',
    );
    expect(html).toContain(FOOTNOTE_PHRASE);
    expect(html).toContain('* IMT-23 part.');
  });

  it('bill check: no footnote when nothing is tagged', () => {
    const html = buildStandardFinalSurveyHTML(
      claimWith([row()]), {} as never, 'bill-check',
    );
    expect(html).not.toContain(FOOTNOTE_PHRASE);
  });

  it('states the paint rule, never the derived percentage', () => {
    const c = claimWith(
      [row({ section: 'paint', partType: 'paint', assessed: 10000, estimated: 10000 })],
      { depreciationType: 'standard', applyPaintMaterialDep: true } as Partial<ClaimData>,
    );
    const html = build(c);
    expect(html).toContain('Less 50% dep. on paint material');
    expect(html).toContain('Painting material @ 25%');
    expect(html).not.toContain('12.5%');
  });
});

// ── Paint material depreciation on the row itself ───────────────────────────
// The surveyor found a paint row printing 14,300.00 while its own subtotal
// printed 12,512.50: the row's money used dep = 0 while the engine applied the
// GR-9 12.5%. Real figures from that report.
//
// Every assertion below is scoped to the ROW. Asserting against the whole
// document passes on the subtotal and the footnote, which already carry these
// figures, and proves nothing about the row.
function rowHtml(html: string, particulars: string): string {
  const at = html.indexOf(particulars);
  if (at < 0) throw new Error(`row not found: ${particulars}`);
  const open = html.lastIndexOf('<tr', at);
  const close = html.indexOf('</tr>', at);
  return html.slice(open, close + 5);
}
/** The row plus whatever sub-rows follow it, up to the next numbered row. */
function rowBlock(html: string, particulars: string): string {
  const at = html.indexOf(particulars);
  if (at < 0) throw new Error(`row not found: ${particulars}`);
  const open = html.lastIndexOf('<tr', at);
  const firstClose = html.indexOf('</tr>', at) + 5;
  const nextClose = html.indexOf('</tr>', firstClose) + 5;
  return html.slice(open, nextClose > firstClose ? nextClose : firstClose);
}

describe('paint material depreciation reaches the row', () => {
  const paintClaim = (extra: Partial<AssessmentRow> = {}) =>
    claimWith(
      [row({ section: 'paint', partType: 'paint', particulars: 'PAINTING CHARGES', estimated: 17500, assessed: 14300, gst: 0, ...extra })],
      { depreciationType: 'standard', applyPaintMaterialDep: true },
    );

  it('prints the row net after the material deduction, not the gross', () => {
    const r = rowHtml(buildStandardFinalSurveyHTML(paintClaim(), {} as never), 'PAINTING CHARGES');
    expect(r).toContain('12,512.50');
    expect(r).toContain('14,300.00');   // Assessed stays gross
    expect(r).not.toContain('17,500.00 </td><td');  // sanity: estimate untouched
  });

  it('spells out the deduction on a sub-line so the row derives from its own cells', () => {
    const b = rowBlock(buildStandardFinalSurveyHTML(paintClaim(), {} as never), 'PAINTING CHARGES');
    expect(b).toContain('Less 50% dep. on paint material');
    expect(b).toContain('1,787.50');
  });

  it('never prints the derived 12.5% rate in this format', () => {
    expect(buildStandardFinalSurveyHTML(paintClaim(), {} as never)).not.toContain('12.5%');
  });

  it('prints no material sub-line for a row carrying the surveyor own rate', () => {
    const b = rowBlock(buildStandardFinalSurveyHTML(paintClaim({ depOverride: 30 }), {} as never), 'PAINTING CHARGES');
    expect(b).not.toContain('Less 50% dep. on paint material');
  });

  it('labour and paint rows carry a Net column instead of a dash', () => {
    const html = buildStandardFinalSurveyHTML(
      claimWith(
        [row({ section: 'labour', partType: 'labour', particulars: 'REM REFIT CHARGES', estimated: 4200, assessed: 2500, gst: 0 })],
        { depreciationType: 'standard' },
      ),
      {} as never,
    );
    expect(html).toContain('Net ₹');
    expect(rowHtml(html, 'REM REFIT CHARGES')).toContain('2,500.00');
  });
});

// ── Part names reach the HTML from outside the code ─────────────────────────
// Names are not always hand-typed: AI extraction lifts them from the workshop's
// estimate PDF. A "<" was read as the start of a tag, swallowing text until the
// next ">" and collapsing the table from that row down.
describe('part names are escaped before they reach the report', () => {
  const nasty = 'HOSE <25MM> & CLAMP';

  it('escapes the angle brackets rather than emitting them as markup', () => {
    const html = buildStandardFinalSurveyHTML(claimWith([row({ particulars: nasty })]), {} as never);
    expect(html).toContain('HOSE &lt;25MM&gt; &amp; CLAMP');
    expect(html).not.toContain('HOSE <25MM>');
  });

  it('escapes it on an IMT-23 tagged row too', () => {
    const html = buildStandardFinalSurveyHTML(claimWith([row({ particulars: nasty, imt23: true })]), {} as never);
    expect(html).toContain('HOSE &lt;25MM&gt; &amp; CLAMP');
    expect(html).not.toContain('HOSE <25MM>');
  });
});
