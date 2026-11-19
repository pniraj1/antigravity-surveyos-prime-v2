import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildStandardFinalHTML } from '../standard-report-builder';
import { buildUIICFinalHTML } from '../uiic-final-builder';
import { nonKoClaim } from './non-ko-claim';

// Fixture = output of the builders at commit 38c19c46 (before K.O.) for this claim.
const golden = JSON.parse(readFileSync(__dirname + '/fixtures/non-ko-final.json', 'utf-8'));

describe('non-TL claim with no K.O. rows renders as before K.O. existed', () => {
  test('Standard Final is byte-identical to 38c19c46', () => {
    expect(buildStandardFinalHTML(nonKoClaim(), null)).toBe(golden.standard);
  });
  test('UIIC Final is byte-identical to 38c19c46', () => {
    expect(buildUIICFinalHTML(nonKoClaim(), null)).toBe(golden.uiic);
  });
});
