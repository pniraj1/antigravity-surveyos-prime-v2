import { describe, it, expect } from 'vitest';
import { getVehicleAgeMonths, getDepreciationRate } from '../depreciation';

/**
 * Age drives the IRDAI depreciation band, and the band steps at
 * 6 / 12 / 24 / 36 / 48 / 60 / 120 months. A bare calendar-month difference
 * rounds the age up whenever the accident falls earlier in the month than the
 * registration date, which can hand the insured a whole band they have not
 * aged into.
 */
describe('getVehicleAgeMonths', () => {
  it('counts only completed months when the accident day precedes the reg day', () => {
    // 25 Jan → 02 Jul is 5 months 8 days, not 6.
    expect(getVehicleAgeMonths('2020-01-25', null, '2020-07-02')).toBe(5);
  });

  it('counts the full month when the accident day is on or after the reg day', () => {
    expect(getVehicleAgeMonths('2020-01-02', null, '2020-07-25')).toBe(6);
    expect(getVehicleAgeMonths('2020-01-15', null, '2020-07-15')).toBe(6);
  });

  it('does not cross a depreciation band on a vehicle that has not aged into it', () => {
    // The regression: this pair used to read 6 months and jump metal from
    // 0% to the next band boundary a month early.
    const age = getVehicleAgeMonths('2019-01-25', null, '2020-01-02');
    expect(age).toBe(11);
    expect(getDepreciationRate('metal', age, 'standard')).toBe(5);
    expect(getDepreciationRate('metal', 12, 'standard')).toBe(5);
    expect(getDepreciationRate('metal', 13, 'standard')).toBe(10);
  });

  it('never returns a negative age', () => {
    expect(getVehicleAgeMonths('2020-01-31', null, '2020-02-01')).toBe(0);
    expect(getVehicleAgeMonths('2020-06-01', null, '2020-01-01')).toBe(0);
  });

  it('falls back to 1 January of the manufacture year when there is no reg date', () => {
    expect(getVehicleAgeMonths(null, 2020, '2020-07-15')).toBe(6);
  });

  it('returns 0 for unparseable or absent dates', () => {
    expect(getVehicleAgeMonths(null, null, '2020-07-15')).toBe(0);
    expect(getVehicleAgeMonths('not-a-date', null, '2020-07-15')).toBe(0);
  });
});

/**
 * Depreciation is fixed at the DATE OF LOSS. Two callers had drifted off it —
 * one omitted the reference date entirely (falling back to `new Date()`), one
 * passed the survey date. Both produced a rate that disagreed with the same
 * claim's own final report.
 */
describe('the depreciation rate is pegged to the date of loss', () => {
  it('does not drift as the claim ages in the drawer', () => {
    // Real claim: TATA SIGNA 4825, reg 21-01-2022, accident 10-12-2025.
    // 46 completed months → the 36-48 band → 25%, which is what the insurer's
    // own report assessed. Reading it "today" instead walks it up a band.
    const atLoss = getVehicleAgeMonths('2022-01-21', 2022, '2025-12-10');
    expect(atLoss).toBe(46);
    expect(getDepreciationRate('metal', atLoss, 'standard')).toBe(25);

    const today = getVehicleAgeMonths('2022-01-21', 2022, null);
    expect(today).toBeGreaterThan(atLoss);
  });

  it('the survey date is not interchangeable with the accident date', () => {
    // Accident 25-01-2023 (36 months) vs survey a month later (37 months) —
    // opposite sides of the 36-month band boundary.
    const accident = getVehicleAgeMonths('2020-01-21', 2020, '2023-01-25');
    const survey = getVehicleAgeMonths('2020-01-21', 2020, '2023-02-25');
    expect(getDepreciationRate('metal', accident, 'standard')).toBe(15);
    expect(getDepreciationRate('metal', survey, 'standard')).toBe(25);
  });
});
