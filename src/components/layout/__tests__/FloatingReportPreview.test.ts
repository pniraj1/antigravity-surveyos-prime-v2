import { describe, it, expect } from 'vitest';
import { printKindFor } from '../FloatingReportPreview';

describe('printKindFor', () => {
  it('maps each previewed format to its printed-log kind', () => {
    expect(printKindFor('standard')).toBe('surveyReport');
    expect(printKindFor('uiic')).toBe('surveyReport');
    expect(printKindFor('std-bill')).toBe('billCheckReport');
    expect(printKindFor('uiic-bill')).toBe('billCheckReport');
    expect(printKindFor('fee-bill')).toBe('feeBill');
    expect(printKindFor('valuation')).toBe('valuationReport');
    expect(printKindFor('spot')).toBeNull();
  });
});
