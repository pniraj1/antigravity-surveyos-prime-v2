// extension/__tests__/map.test.js
import { describe, it, expect } from 'vitest';
import map from '../maps/nia-nontieup.json';

const KINDS = ['text', 'money', 'radio', 'select', 'dateRadioOrOthers', 'file'];

describe('nia-nontieup map', () => {
  it('has the header the filler needs', () => {
    expect(map.portal).toBe('nia');
    expect(map.flow).toBe('nontieup');
    expect(map.controller).toBe('surveyorWorklistSurveyCtrl');
    expect(map.claimNoPath).toMatch(/claimNumber$/);
    expect(map.files.assessmentExcel.modelPath).toMatch(/myFiles$/);
  });
  it('every field has a modelPath, a known kind and an empty value', () => {
    for (const [k, f] of Object.entries(map.fields)) {
      expect(f.modelPath, k).toMatch(/^surveyorData\.worklist\./);
      expect(KINDS, k).toContain(f.kind);
      expect('empty' in f, k).toBe(true);
    }
  });
  it('hosted copy is identical', async () => {
    const hosted = (await import('../../public/portal-maps/nia-nontieup.json')).default;
    expect(hosted).toEqual(map);
  });
});
