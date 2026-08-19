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
