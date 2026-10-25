import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createBlankClaim, type ClaimData } from '@/types';
import { NOTES_ALLOW_LIST, planNotes, applyNotes, isEmptyNotesPlan } from '../notes';

const claim = (patch: (c: ClaimData) => ClaimData = (c) => c) => patch(createBlankClaim('spot'));
const keys = (cs: { key: string }[]) => cs.map((c) => c.key);

describe('planNotes / applyNotes', () => {
  it('fillsEmpty', () => {
    const c = claim();
    const plan = planNotes(c, {
      spot: {
        'vehicle.odometer': '45,210 km',
        'spotDetails.policeReported': 'yes',
        'spotDetails.actualLoad': '12400',
        'documentVerification.rc': { status: 'YES', detail: 'Original seen' },
        'documentVerification.dl': { status: 'NO', detail: '' },
      },
      valuation: { 'valuationDetails.odometer': '42,987' },
      updatedAt: '2026-10-24T14:05:00+05:30',
    });
    expect(keys(plan.fill)).toEqual([
      'vehicle.odometer', 'spotDetails.policeReported', 'documentVerification.rc.status',
      'documentVerification.rc.detail', 'spotDetails.actualLoad', 'valuationDetails.odometer',
    ]);
    expect(plan.differ).toEqual([]);
    const u = applyNotes(c, plan);
    expect(u.vehicle?.odometer).toBe('45210');
    expect(u.spotDetails?.actualLoad).toBe(12400);
    expect(u.spotDetails?.policeReported).toBe('yes');
    expect(u.documentVerification?.rc).toEqual({ status: 'YES', detail: 'Original seen' });
    expect(u.documentVerification?.dl).toEqual({ status: 'NO', detail: '' });
    expect(u.valuationDetails?.odometer).toBe('42,987'); // string in Prime: as-is
    expect(u.scanImport).toEqual({ at: '2026-10-24T14:05:00+05:30', decided: {} });
    expect(u.assessmentRows).toBeUndefined();
  });

  it('differingNeverAutoFilled', () => {
    const c = claim((b) => ({ ...b, vehicle: { ...b.vehicle, odometer: '45000' }, accident: { ...b.accident, placeOfAccident: 'Pune' } }));
    const plan = planNotes(c, { spot: { 'vehicle.odometer': '45210', 'accident.placeOfAccident': 'Pune', 'spotDetails.actualLoad': 'about 12 t' } });
    expect(plan.fill).toEqual([]);
    expect(keys(plan.differ)).toEqual(['vehicle.odometer', 'spotDetails.actualLoad']);
    expect(plan.differ[1].writable).toBe(false); // not a number: look at it, never written

    const kept = applyNotes(c, plan);
    expect(kept.vehicle).toBeUndefined();
    expect(kept.spotDetails).toBeUndefined();
    expect(kept.scanImport.decided).toEqual({ 'vehicle.odometer': '45210', 'spotDetails.actualLoad': 'about 12 t' });

    const used = applyNotes(c, plan, { 'vehicle.odometer': true, 'spotDetails.actualLoad': true });
    expect(used.vehicle?.odometer).toBe('45210');
    expect(used.spotDetails).toBeUndefined();
  });

  it('insurableAlwaysPicked', () => {
    const c = claim(); // blank isInsurable = true, which is not "empty"
    const plan = planNotes(c, { valuation: { 'valuationDetails.isInsurable': 'no' } });
    expect(plan.fill).toEqual([]);
    expect(plan.differ.map((d) => [d.key, d.value])).toEqual([['valuationDetails.isInsurable', false]]);
    expect(applyNotes(c, plan, { 'valuationDetails.isInsurable': true }).valuationDetails?.isInsurable).toBe(false);
    expect(isEmptyNotesPlan(planNotes(c, { valuation: { 'valuationDetails.isInsurable': 'yes' } }))).toBe(true);
  });

  it('decidedNotAskedAgain', () => {
    const c = claim((b) => ({ ...b, vehicle: { ...b.vehicle, odometer: '45000' } }));
    const notes = { spot: { 'vehicle.odometer': '45210' }, updatedAt: 't1' };
    const first = applyNotes(c, planNotes(c, notes));
    const after = { ...c, scanImport: first.scanImport } as ClaimData;
    expect(isEmptyNotesPlan(planNotes(after, notes, first.scanImport.decided))).toBe(true);
    // a new phone value asks again
    expect(keys(planNotes(after, { spot: { 'vehicle.odometer': '45300' } }, first.scanImport.decided).differ)).toEqual(['vehicle.odometer']);
  });

  it('clearingOnPhoneNeverClears', () => {
    const c = claim((b) => ({ ...b, accident: { ...b.accident, placeOfSurvey: 'Workshop' } }));
    const plan = planNotes(c, { spot: { 'accident.placeOfSurvey': '', 'documentVerification.rc': { status: '', detail: '' } } });
    expect(isEmptyNotesPlan(plan)).toBe(true);
    expect(applyNotes(c, plan).accident).toBeUndefined();
  });

  it('damageRowsDeduped', () => {
    const c = claim((b) => ({ ...b, spotDamageRows: [{ id: 'a', component: 'Front Bumper', damage: 'Broken' }] }));
    const plan = planNotes(c, { spotDamageRows: [
      { component: ' front bumper ', damage: 'broken ' },
      { component: 'Headlamp', damage: 'Cracked' },
      { component: 'headlamp', damage: 'cracked' },
      { component: '', damage: '' },
    ] });
    expect(plan.rows.damage).toEqual([{ component: 'Headlamp', damage: 'Cracked' }]);
    const u = applyNotes(c, plan, {}, (i) => `id${i}`);
    expect(u.spotDamageRows).toEqual([
      { id: 'a', component: 'Front Bumper', damage: 'Broken' },
      { id: 'id0', component: 'Headlamp', damage: 'Cracked' },
    ]);
  });

  it('partRowsDedupedAndEmptyConditionFilled', () => {
    const c = claim((b) => ({ ...b, valuationDetails: { ...b.valuationDetails, panelRows: [
      { id: 'p1', component: 'Bodyshell', condition: '' },
      { id: 'p2', component: 'Bonnet', condition: 'Good' },
    ] } }));
    const plan = planNotes(c, { valuationPartRows: [
      { component: 'BODYSHELL', condition: 'Damaged' },
      { component: 'bonnet', condition: 'Average / Serviceable' },
      { component: 'Dickey', condition: 'Good' },
      { component: 'dickey', condition: 'N/A' },
    ] });
    expect(plan.rows.parts).toEqual([{ component: 'Dickey', condition: 'Good' }]);
    expect(plan.rows.partConditions).toEqual([{ id: 'p1', condition: 'Damaged' }]);
    expect(applyNotes(c, plan, {}, (i) => `n${i}`).valuationDetails?.panelRows).toEqual([
      { id: 'p1', component: 'Bodyshell', condition: 'Damaged' },
      { id: 'p2', component: 'Bonnet', condition: 'Good' },
      { id: 'n0', component: 'Dickey', condition: 'Good' },
    ]);
  });

  it('unknownKeysDropped', () => {
    const plan = planNotes(claim(), {
      spot: { 'insured.name': 'X', 'driver.name': 'Y', assessmentRows: '[]', 'valuationDetails.remarks': 'wrong section' },
      valuation: { 'spotDetails.comments': 'wrong section' },
      other: { 'vehicle.odometer': '1' },
    });
    expect(isEmptyNotesPlan(plan)).toBe(true);
  });
});

const HANDOVER = resolve(process.cwd(), '../SurveyOS Scan/docs/handover/prime-notes-import.md');

describe.skipIf(!existsSync(HANDOVER))('handover', () => {
  it('allowListMatchesHandover', () => {
    const md = readFileSync(HANDOVER, 'utf8');
    const paths = new Set<string>();
    for (const line of md.split('\n')) {
      const cols = line.split(/(?<!\\)\|/).map((s) => s.trim());
      const m = cols[3]?.match(/^`([^`]+)`/);
      if (!m || m[1].includes('[]')) continue; // row lists are handled separately
      const docs = m[1].match(/^documentVerification\.<(.+)>$/);
      if (docs) docs[1].split('\\|').forEach((id) => paths.add(`documentVerification.${id}`));
      else paths.add(m[1]);
    }
    expect(paths.size).toBeGreaterThan(40);
    expect([...paths].sort()).toEqual(Object.keys(NOTES_ALLOW_LIST).sort());
  });
});
