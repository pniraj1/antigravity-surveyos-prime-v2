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

  it('shows the row at its full figure, not halved', () => {
    const html = build(claimWith([row({ imt23: true })]));
    // The part's own data row — between the SPARE PARTS heading and its subtotal.
    const partRow = html.slice(
      html.indexOf('SPARE PARTS'),
      html.indexOf('Sub-Total Parts'),
    );
    expect(partRow).toContain('4,100.00');       // assessed + gross material cell
    expect(partRow).toContain('4,838.00');       // 4,100 × 1.18, gross Price+GST
    expect(partRow).not.toContain('2,050.00');   // never the halved figure on the row
    expect(partRow).not.toContain('2,419.00');   // nor the halved Price+GST
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
