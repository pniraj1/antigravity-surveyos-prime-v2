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

  it('untickedFillNotOfferedAgain', () => {
    const c = claim(); // Severity is the blank default 'moderate', so phone 'major' is a fill
    const notes = { spot: { 'spotDetails.damageSeverity': 'major' } };
    const plan = planNotes(c, notes);
    expect(keys(plan.fill)).toEqual(['spotDetails.damageSeverity']);
    const u = applyNotes(c, plan, { 'spotDetails.damageSeverity': false });
    expect(u.spotDetails).toBeUndefined();
    expect(u.scanImport.decided).toEqual({ 'spotDetails.damageSeverity': 'major' });
    expect(isEmptyNotesPlan(planNotes(c, notes, u.scanImport.decided))).toBe(true);
    expect(keys(planNotes(c, { spot: { 'spotDetails.damageSeverity': 'minor' } }, u.scanImport.decided).fill))
      .toEqual(['spotDetails.damageSeverity']); // a new phone value is offered
  });

  it('docVerificationRules', () => {
    const c = claim((b) => ({ ...b, documentVerification: { ...b.documentVerification, dl: { status: 'YES', detail: '' } } }));
    const plan = planNotes(c, { spot: {
      'documentVerification.rc': { status: 'NO', detail: 'Photocopy' },
      'documentVerification.dl': { status: 'NO', detail: '' },
    } });
    expect(keys(plan.fill)).toEqual(['documentVerification.rc.detail']);
    expect(keys(plan.differ)).toEqual(['documentVerification.dl.status']);
  });

  it('numbersParsedStrictlyAndCompared', () => {
    const c = claim((b) => ({ ...b, vehicle: { ...b.vehicle, odometer: '45,210' } }));
    expect(isEmptyNotesPlan(planNotes(c, { spot: { 'vehicle.odometer': '45210 km' } }))).toBe(true);
    const bad = planNotes(claim(), { spot: { 'spotDetails.actualLoad': '0x10', 'vehicle.odometer': '-5' } });
    expect(bad.fill).toEqual([]);
    expect(bad.differ.map((d) => d.writable)).toEqual([false, false]);
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
      { component: '', condition: 'Good' },
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

  it('feeBillAllowListIncludesAll16Paths', () => {
    const expected = [
      'feeBill.billDate',
      'feeBill.advanceReceipt',
      'feeBill.cashReceived',
      'feeBill.feePaid',
      'feeBill.professionalFee',
      'feeBill.riFee',
      'feeBill.distanceKm',
      'feeBill.ratePerKm',
      'feeBill.travelNote',
      'feeBill.tollCharges',
      'feeBill.tollNote',
      'feeBill.photosCount',
      'feeBill.photoRate',
      'feeBill.postalCharges',
      'feeBill.haltageCharges',
      'feeBill.includeGST',
    ];
    for (const path of expected) {
      expect(NOTES_ALLOW_LIST).toHaveProperty(path);
      expect((NOTES_ALLOW_LIST as any)[path].section).toBe('feeBill');
    }
  });

  it('feeBillPlansAndAppliesNumericAndBoolean', () => {
    const c = claim();
    const plan = planNotes(c, {
      feeBill: {
        'feeBill.distanceKm': '45',
        'feeBill.tollCharges': '270',
        'feeBill.photosCount': '12',
        'feeBill.includeGST': 'yes',
        'feeBill.feePaid': 'yes',
        'feeBill.billDate': '2026-10-30',
      },
    });
    expect(keys(plan.fill)).toEqual([
      'feeBill.billDate',
      'feeBill.feePaid',
      'feeBill.distanceKm',
      'feeBill.tollCharges',
      'feeBill.photosCount',
      'feeBill.includeGST',
    ]);
    const u = applyNotes(c, plan);
    expect(u.feeBill?.distanceKm).toBe(45);
    expect(u.feeBill?.tollCharges).toBe(270);
    expect(u.feeBill?.photosCount).toBe(12);
    expect(u.feeBill?.includeGST).toBe(true);
    expect(u.feeBill?.feePaid).toBe(true);
    expect(u.feeBill?.billDate).toBe('2026-10-30');
  });

  it('feeBillBooleanConversionAndDiffers', () => {
    const c = claim((b) => ({
      ...b,
      feeBill: {
        ...b.feeBill,
        distanceKm: 30,
        includeGST: true,
        feePaid: true,
      },
    }));
    const plan = planNotes(c, {
      feeBill: {
        'feeBill.distanceKm': '45',
        'feeBill.includeGST': 'no',
        'feeBill.feePaid': 'no',
      },
    });
    expect(plan.fill).toEqual([]);
    expect(keys(plan.differ).sort()).toEqual(['feeBill.distanceKm', 'feeBill.feePaid', 'feeBill.includeGST'].sort());
    expect(plan.differ.find((d) => d.key === 'feeBill.includeGST')?.value).toBe(false);
    expect(plan.differ.find((d) => d.key === 'feeBill.feePaid')?.value).toBe(false);

    const u = applyNotes(c, plan, { 'feeBill.distanceKm': true, 'feeBill.includeGST': true, 'feeBill.feePaid': true });
    expect(u.feeBill?.distanceKm).toBe(45);
    expect(u.feeBill?.includeGST).toBe(false);
    expect(u.feeBill?.feePaid).toBe(false);
  });

  it('surveyDateTimeBackfillsAccidentOnImport', () => {
    const c = claim();
    expect(c.accident.dateOfSurvey).toBe('');
    expect(c.accident.timeOfSurvey).toBe('');

    // 1. spotDetails.surveyDatetime backfills accident.dateOfSurvey and accident.timeOfSurvey
    const planSpot = planNotes(c, {
      spot: { 'spotDetails.surveyDatetime': '2026-10-30T14:45' },
    });
    const uSpot = applyNotes(c, planSpot);
    expect(uSpot.accident?.dateOfSurvey).toBe('2026-10-30');
    expect(uSpot.accident?.timeOfSurvey).toBe('14:45');

    // 2. valuationDetails.inspectionDate with datetime backfills accident.dateOfSurvey and accident.timeOfSurvey
    const planVal = planNotes(c, {
      valuation: { 'valuationDetails.inspectionDate': '2026-10-30T10:30' },
    });
    const uVal = applyNotes(c, planVal);
    expect(uVal.accident?.dateOfSurvey).toBe('2026-10-30');
    expect(uVal.accident?.timeOfSurvey).toBe('10:30');

    // 3. accident.placeOfSurvey syncs to valuationDetails.inspectionPlace
    const planPlace = planNotes(c, {
      spot: { 'accident.placeOfSurvey': 'Workshop Pune' },
    });
    const uPlace = applyNotes(c, planPlace);
    expect(uPlace.accident?.placeOfSurvey).toBe('Workshop Pune');
    expect(uPlace.valuationDetails?.inspectionPlace).toBe('Workshop Pune');

    // 4. valuationDetails.inspectionPlace syncs to accident.placeOfSurvey
    const planValPlace = planNotes(c, {
      valuation: { 'valuationDetails.inspectionPlace': 'Garage Nashik' },
    });
    const uValPlace = applyNotes(c, planValPlace);
    expect(uValPlace.valuationDetails?.inspectionPlace).toBe('Garage Nashik');
    expect(uValPlace.accident?.placeOfSurvey).toBe('Garage Nashik');
  });
});

const HANDOVER = resolve(process.cwd(), '../SurveyOS Scan/docs/handover/prime-notes-import.md');

describe.skipIf(!existsSync(HANDOVER))('handover', () => {
  it('allowListMatchesHandover', () => {
    const md = readFileSync(HANDOVER, 'utf8');
    const paths: string[] = []; // `section:path`
    const rowLists: string[] = [];
    let section = '';
    for (const line of md.split(/\r?\n/)) {
      if (line.startsWith('## ')) section = line === '## Fee Bill fields' ? 'feeBill' : line === '## Valuation fields' ? 'valuation' : line === '## Fields' ? 'spot' : '';
      const cols = line.split(/(?<!\\)\|/).map((s) => s.trim());
      const m = section && cols[3]?.match(/^`([^`]+)`/);
      if (!m) continue;
      if (m[1].includes('[]')) { rowLists.push(m[1].split('[]')[0]); continue; } // handled by planRows
      const docs = m[1].match(/^documentVerification\.<(.+)>$/);
      if (docs) docs[1].split('\\|').forEach((id) => paths.push(`${section}:documentVerification.${id}`));
      else paths.push(`${section}:${m[1]}`);
    }
    expect(paths.length).toBeGreaterThan(40);
    expect(paths.sort()).toEqual(Object.entries(NOTES_ALLOW_LIST).map(([p, s]) => `${s.section}:${p}`).sort());
    expect(rowLists).toEqual(['spotDamageRows', 'valuationPartRows']); // a new row list needs code
  });
});
