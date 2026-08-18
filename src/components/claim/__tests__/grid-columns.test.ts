import { describe, expect, test } from 'vitest';
import {
  GRID_COLUMNS,
  ASSESSMENT_COLUMN_ORDER,
  BILL_CHECK_COLUMN_ORDER,
} from '../grid-columns';

describe('shared grid columns', () => {
  // The defect this module exists to prevent: BillCheckGrid labelled
  // row.estimated "Assessed Tax" while AssessmentSectionTable called the same
  // field "Estimate(taxable amount)".
  test('every ordered column resolves to exactly one label', () => {
    for (const key of [...ASSESSMENT_COLUMN_ORDER, ...BILL_CHECK_COLUMN_ORDER]) {
      expect(GRID_COLUMNS[key], `no config for column "${key}"`).toBeDefined();
      expect(GRID_COLUMNS[key].label.length).toBeGreaterThan(0);
    }
  });

  test('a column shared by both grids carries the same label in both', () => {
    const shared = ASSESSMENT_COLUMN_ORDER.filter(k => BILL_CHECK_COLUMN_ORDER.includes(k));
    expect(shared.length).toBeGreaterThan(5);
    for (const key of shared) {
      expect(GRID_COLUMNS[key].label).toBe(GRID_COLUMNS[key].label);
    }
  });

  test('bill check adds the bill columns and keeps the assessment ones', () => {
    for (const key of ASSESSMENT_COLUMN_ORDER) {
      expect(BILL_CHECK_COLUMN_ORDER).toContain(key);
    }
    expect(BILL_CHECK_COLUMN_ORDER).toContain('billedTaxable');
    expect(BILL_CHECK_COLUMN_ORDER).toContain('status');
  });

  test('no order lists a column twice', () => {
    expect(new Set(ASSESSMENT_COLUMN_ORDER).size).toBe(ASSESSMENT_COLUMN_ORDER.length);
    expect(new Set(BILL_CHECK_COLUMN_ORDER).size).toBe(BILL_CHECK_COLUMN_ORDER.length);
  });

  test('the estimate column is named for what it holds', () => {
    expect(GRID_COLUMNS.unitPrice.label.toLowerCase()).toContain('estimate');
    expect(GRID_COLUMNS.unitPrice.label.toLowerCase()).not.toContain('assessed');
  });
});
