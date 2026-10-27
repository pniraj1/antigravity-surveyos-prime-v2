import { describe, it, expect } from 'vitest';
import { createAssessmentRow } from '@/lib/calculations';
import { buildEstimateRows } from '@/stores/slices/aiDataSlice';
import type { AssessmentRow } from '@/types/assessment';
import { applyEstimateFix, planEstimateFix, sheetToEstimateData } from '../estimate-fix';

const part = (srNo: number | undefined, particulars: string, estimated: number, o: Partial<AssessmentRow> = {}) =>
  createAssessmentRow('parts', { srNo, particulars, estimated, assessed: estimated, quantity: 1, source: 'estimate', ...o });

const all = (plan: ReturnType<typeof planEstimateFix>) => ({
  missingIds: plan.missing.map((r) => r.id),
  changedRowIds: plan.changed.map((c) => c.rowId),
});

describe('planEstimateFix / applyEstimateFix', () => {
  it('proposes missing rows and inserts them in serial order', () => {
    const sheet = [part(1, 'Bumper', 100), part(2, 'Grille', 200), part(5, 'Lamp', 500)];
    const reRead = [part(1, 'Bumper', 100), part(2, 'Grille', 200), part(3, 'Hood', 300), part(4, 'Fender', 400), part(5, 'Lamp', 500)];
    const plan = planEstimateFix(sheet, reRead);
    expect(plan.missing.map((r) => r.srNo)).toEqual([3, 4]);
    expect(plan.changed).toEqual([]);
    const out = applyEstimateFix(sheet, plan, all(plan));
    expect(out.map((r) => r.srNo)).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not propose a hand-typed row with the same description as missing', () => {
    const sheet = [createAssessmentRow('parts', { particulars: '  Front  BUMPER ', estimated: 100, assessed: 100 })];
    const plan = planEstimateFix(sheet, [part(1, 'front bumper', 100)]);
    expect(plan.missing).toEqual([]);
    expect(plan.changed).toEqual([]);
  });

  it('flags every matched row when re-read is taxable and the sheet holds gross', () => {
    const sheet = [part(1, 'Bumper', 1180), part(2, 'Grille', 2360)];
    const reRead = [part(1, 'Bumper', 1000), part(2, 'Grille', 2000)];
    const plan = planEstimateFix(sheet, reRead);
    expect(plan.changed.map((c) => c.rowId)).toEqual([sheet[0].id, sheet[1].id]);
    expect(plan.changed[0].after.estimated).toBe(1000);
  });

  it('assessed follows the new estimate only when it was untouched', () => {
    const untouched = part(1, 'Bumper', 1180);
    const edited = part(2, 'Grille', 2360, { assessed: 1500 });
    const plan = planEstimateFix([untouched, edited], [part(1, 'Bumper', 1000), part(2, 'Grille', 2000)]);
    const out = applyEstimateFix([untouched, edited], plan, all(plan));
    expect(out[0].estimated).toBe(1000);
    expect(out[0].assessed).toBe(1000);
    expect(out[0].reReadNote).toBeUndefined();
    expect(out[1].estimated).toBe(2000);
    expect(out[1].assessed).toBe(1500);
    expect(out[1].reReadNote).toBe('Estimate re-read changed ₹2360 → ₹2000');
  });

  it('unnumbered estimate matches by description, duplicates nothing, never shortens', () => {
    const sheet = [part(undefined, 'Bumper', 100), part(undefined, 'Grille', 200), part(undefined, 'Hand added', 50, { source: undefined })];
    const reRead = [part(undefined, 'Bumper', 100), part(undefined, 'Grille', 250), part(undefined, 'Lamp', 300)];
    const plan = planEstimateFix(sheet, reRead);
    expect(plan.missing.map((r) => r.particulars)).toEqual(['Lamp']);
    expect(plan.changed.map((c) => c.rowId)).toEqual([sheet[1].id]);
    const out = applyEstimateFix(sheet, plan, all(plan));
    expect(out).toHaveLength(4);
    expect(out.map((r) => r.particulars)).toEqual(['Bumper', 'Grille', 'Hand added', 'Lamp']);
    expect(planEstimateFix(out, reRead)).toEqual({ missing: [], changed: [] });
  });

  it('applies nothing for unticked groups', () => {
    const sheet = [part(1, 'Bumper', 1180)];
    const plan = planEstimateFix(sheet, [part(1, 'Bumper', 1000), part(2, 'Grille', 200)]);
    const out = applyEstimateFix(sheet, plan, { missingIds: [], changedRowIds: [] });
    expect(out).toEqual(sheet);
    const onlyMissing = applyEstimateFix(sheet, plan, { missingIds: [plan.missing[0].id], changedRowIds: [] });
    expect(onlyMissing).toHaveLength(2);
    expect(onlyMissing[0].estimated).toBe(1180);
  });

  it('matches only within the same section and tracks part type changes', () => {
    const sheet = [part(1, 'Wheel alignment', 100)];
    const labour = createAssessmentRow('labour', { srNo: 1, particulars: 'Wheel alignment', estimated: 100, assessed: 100 });
    const plan = planEstimateFix(sheet, [labour, part(1, 'Wheel alignment', 100, { partType: 'plastic' })]);
    expect(plan.missing.map((r) => r.section)).toEqual(['labour']);
    expect(plan.changed[0].after.partType).toBe('plastic');
  });

  describe('estimate with no printed serials (positional srNo from buildEstimateRows)', () => {
    const item = (description: string) => ({ description, taxable_amount: 100, gst_percent: 18, quantity: 1 });
    const build = (names: string[]) => buildEstimateRows({ spare_parts: names.map(item) }, 'estimate', 1);

    it('a dropped row causes no mispairing', () => {
      const sheet = build(['A', 'B', 'C', 'D', 'E']);
      const plan = planEstimateFix(sheet, build(['A', 'C', 'D', 'E']));
      expect(plan).toEqual({ missing: [], changed: [] });
    });

    it('an added row is the only missing one', () => {
      const sheet = build(['A', 'B', 'C', 'D', 'E']);
      const plan = planEstimateFix(sheet, build(['A', 'B', 'X', 'C', 'D', 'E']));
      expect(plan.missing.map((r) => r.particulars)).toEqual(['X']);
      expect(plan.changed).toEqual([]);
    });
  });

  it('never serial-matches a supplementary row to a primary re-read row', () => {
    const sheet = [part(1, 'Bumper', 100), part(2, 'Spoiler', 50, { source: 'supplementary' })];
    const plan = planEstimateFix(sheet, [part(1, 'Bumper', 100), part(2, 'Grille', 200)]);
    expect(plan.missing.map((r) => r.particulars)).toEqual(['Grille']);
    expect(plan.changed).toEqual([]);
  });

  it('inserted rows are source estimate whatever precedes them', () => {
    for (const prevSource of ['supplementary', undefined] as const) {
      const sheet = [part(1, 'Bumper', 100), part(2, 'Prev', 50, { source: prevSource })];
      const plan = planEstimateFix(sheet, [part(1, 'Bumper', 100), part(3, 'Lamp', 300)]);
      const out = applyEstimateFix(sheet, plan, all(plan));
      expect(out.find((r) => r.particulars === 'Lamp')?.source).toBe('estimate');
    }
  });

  it('does not anchor an insert on a supplementary row', () => {
    const sheet = [part(1, 'Bumper', 100), part(2, 'Supp', 50, { source: 'supplementary' }), part(5, 'Lamp', 500)];
    const plan = planEstimateFix(sheet, [part(1, 'Bumper', 100), part(3, 'Hood', 300), part(5, 'Lamp', 500)]);
    const out = applyEstimateFix(sheet, plan, all(plan));
    expect(out.map((r) => r.particulars)).toEqual(['Bumper', 'Hood', 'Supp', 'Lamp']);
  });

  describe('multi-page re-read returns the whole sheet once per page', () => {
    const sheet = () => [part(1, 'Bumper', 100), part(2, 'Grille', 200), part(3, 'Hood', 300)];
    // fresh ids and merged-page serials, as mergeAIResults would join them
    const copy = (rows: AssessmentRow[]) => rows.map((r) => part(r.srNo, r.particulars, r.estimated));

    it('the sheet repeated twice and three times proposes nothing', () => {
      const s = sheet();
      for (const n of [2, 3]) {
        const reRead = Array.from({ length: n }, () => copy(s)).flat();
        expect(planEstimateFix(s, reRead)).toEqual({ missing: [], changed: [] });
      }
    });

    it('a genuinely new row repeated on every page is proposed once', () => {
      const s = sheet();
      const x = () => part(4, 'Fender', 400);
      const plan = planEstimateFix(s, [...copy(s), x(), ...copy(s), x()]);
      expect(plan.missing.map((r) => r.particulars)).toEqual(['Fender']);
      expect(plan.changed).toEqual([]);
    });

    it('repeat copies of a row the re-read changed are not proposed again', () => {
      const s = sheet();
      const plan = planEstimateFix(s, [part(2, 'Grille', 250), part(2, 'Grille', 250)]);
      expect(plan.missing).toEqual([]);
      expect(plan.changed.map((c) => [c.rowId, c.after.estimated])).toEqual([[s[1].id, 250]]);
    });

    it('three copies of a changed row propose nothing new', () => {
      const s = sheet();
      const plan = planEstimateFix(s, [part(2, 'Grille', 250), part(2, 'Grille', 250), part(2, 'Grille', 250)]);
      expect(plan.missing).toEqual([]);
      expect(plan.changed).toHaveLength(1);
    });

    it('a repeat that differs from both the sheet row and the matched copy is still proposed', () => {
      const s = sheet();
      const plan = planEstimateFix(s, [part(2, 'Grille', 250), part(2, 'Grille', 300)]);
      expect(plan.changed.map((c) => c.after.estimated)).toEqual([250]);
      expect(plan.missing.map((r) => r.estimated)).toEqual([300]);
    });
  });

  describe('supplementary re-read', () => {
    const supp = (srNo: number | undefined, name: string, est: number) => part(srNo, name, est, { source: 'supplementary' });

    it('inserts rows as supplementary, anchored among supplementary rows', () => {
      const sheet = [part(1, 'Bumper', 100), part(2, 'Grille', 200), supp(1, 'Spoiler', 50), supp(3, 'Mirror', 70)];
      const plan = planEstimateFix(sheet, [supp(1, 'Spoiler', 50), supp(2, 'Lamp', 60), supp(3, 'Mirror', 70)], 'supplementary');
      expect(plan.source).toBe('supplementary');
      expect(plan.missing.map((r) => r.particulars)).toEqual(['Lamp']);
      const out = applyEstimateFix(sheet, plan, all(plan));
      expect(out.map((r) => r.particulars)).toEqual(['Bumper', 'Grille', 'Spoiler', 'Lamp', 'Mirror']);
      expect(out.find((r) => r.particulars === 'Lamp')?.source).toBe('supplementary');
    });

    it('with no supplementary rows yet, goes after the section, never before primary rows', () => {
      const sheet = [part(1, 'Bumper', 100), part(2, 'Grille', 200)];
      const plan = planEstimateFix(sheet, [supp(1, 'Spoiler', 50)], 'supplementary');
      const out = applyEstimateFix(sheet, plan, all(plan));
      expect(out.map((r) => r.particulars)).toEqual(['Bumper', 'Grille', 'Spoiler']);
      expect(out[2].source).toBe('supplementary');
    });

    it('serial pass never pairs across families, either way', () => {
      const sheet = [part(1, 'Bumper', 100), supp(1, 'Spoiler', 50)];
      const asSupp = planEstimateFix(sheet, [supp(1, 'Wing', 80)], 'supplementary');
      expect(asSupp.changed.map((c) => c.rowId)).toEqual([sheet[1].id]);
      const asPrimary = planEstimateFix(sheet, [part(1, 'Hood', 90)]);
      expect(asPrimary.changed.map((c) => c.rowId)).toEqual([sheet[0].id]);
      const noSuppRows = planEstimateFix([part(1, 'Bumper', 100)], [supp(1, 'Wing', 80)], 'supplementary');
      expect(noSuppRows.changed).toEqual([]);
      expect(noSuppRows.missing.map((r) => r.particulars)).toEqual(['Wing']);
    });
  });

  it('applying the same plan twice does not duplicate rows', () => {
    const sheet = [part(1, 'Bumper', 100)];
    const plan = planEstimateFix(sheet, [part(1, 'Bumper', 100), part(2, 'Grille', 200)]);
    const once = applyEstimateFix(sheet, plan, all(plan));
    expect(applyEstimateFix(once, plan, all(plan))).toHaveLength(2);
  });

  it('works with rows built by buildEstimateRows', () => {
    const data = { spare_parts: [{ sr_no: 1, description: 'Bumper', taxable_amount: 1000, gst_percent: 28, quantity: 2, category: 'plastic' }] };
    const reRead = buildEstimateRows(data, 'estimate', 1);
    const sheet = [part(1, 'Bumper', 1000)];
    const plan = planEstimateFix(sheet, reRead);
    expect(plan.changed[0].after).toMatchObject({ gst: 28, quantity: 2, partType: 'plastic' });
  });
});

describe('sheetToEstimateData', () => {
  it('groups every row by section as the AI previous data', () => {
    const rows = [
      part(1, 'Bumper', 100, { gst: 28 }),
      createAssessmentRow('labour', { srNo: 2, particulars: 'Fit', estimated: 50, quantity: 3 }),
      createAssessmentRow('paint', { particulars: 'Paint', estimated: 70, source: undefined }),
    ];
    const d = sheetToEstimateData(rows);
    expect(d.spare_parts).toEqual([{ sr_no: 1, description: 'Bumper', taxable_amount: 100, gst_percent: 28, quantity: 1 }]);
    expect(d.labour_items).toEqual([{ sr_no: 2, description: 'Fit', taxable_amount: 50, gst_percent: 18, quantity: 3 }]);
    expect(d.painting_items).toHaveLength(1);
  });
});
