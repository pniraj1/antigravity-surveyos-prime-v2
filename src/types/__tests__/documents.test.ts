import { describe, it, expect } from 'vitest';
import { DOC_TYPE_LABEL, MULTI_FILE_TYPES, FIELD_KEY_TO_DOC_TYPE, tagToDocType } from '../documents';

describe('document vocabulary', () => {
  it('labels every type and labels are Windows-safe file stems', () => {
    for (const [type, label] of Object.entries(DOC_TYPE_LABEL)) {
      expect(label, type).toMatch(/^[A-Za-z0-9 ()-]+$/);
    }
    expect(DOC_TYPE_LABEL.rc).toBe('RC Book');
    expect(DOC_TYPE_LABEL.surveyReport).toBe('Final Survey Report');
    expect(DOC_TYPE_LABEL.niaAssessmentExcel).toBe('Primary Assessment Template');
  });
  it('multi-file types are exactly the three', () => {
    expect([...MULTI_FILE_TYPES].sort()).toEqual(['damagePhotos', 'other', 'spotPhotos']);
  });
  it('maps every Documents-tab field key', () => {
    const keys = ['rc', 'dl', 'policy', 'claim', 'fir', 'final-bill', 'permit', 'auth', 'fitness', 'load-challan'];
    for (const k of keys) expect(FIELD_KEY_TO_DOC_TYPE[k], k).toBeDefined();
    expect(FIELD_KEY_TO_DOC_TYPE['claim']).toBe('claimForm');
    expect(FIELD_KEY_TO_DOC_TYPE['final-bill']).toBe('invoice');
    expect(FIELD_KEY_TO_DOC_TYPE['auth']).toBe('other');
  });
  it('maps photo tags, defaulting to damage', () => {
    expect(tagToDocType('odometer')).toBe('odometerPhoto');
    expect(tagToDocType('front')).toBe('photoFront');
    expect(tagToDocType('spot')).toBe('spotPhotos');
    expect(tagToDocType(undefined)).toBe('damagePhotos');
  });
});
