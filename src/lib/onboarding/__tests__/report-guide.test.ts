import { describe, it, expect } from 'vitest';
import { getReportGuide, REPORT_GUIDES } from '../report-guide';

describe('report-guide', () => {
  it('provides guides for all 3 report types', () => {
    expect(REPORT_GUIDES.survey).toBeDefined();
    expect(REPORT_GUIDES.spot).toBeDefined();
    expect(REPORT_GUIDES.valuation).toBeDefined();
  });

  it('contains expected sections for Final Survey Report', () => {
    const guide = getReportGuide('survey');
    expect(guide.title).toContain('Final Survey Report');
    expect(guide.sections.length).toBeGreaterThanOrEqual(7);

    const ids = guide.sections.map((s) => s.id);
    expect(ids).toContain('header');
    expect(ids).toContain('parties');
    expect(ids).toContain('vehicle');
    expect(ids).toContain('dl');
    expect(ids).toContain('accident');
    expect(ids).toContain('assessment');
    expect(ids).toContain('summary');

    // Every section has a valid fixTab and fixLabel
    for (const section of guide.sections) {
      expect(section.fixTab).toBeTruthy();
      expect(section.fixLabel).toBeTruthy();
      expect(section.purpose).toBeTruthy();
    }
  });

  it('contains expected sections for Spot Survey Report', () => {
    const guide = getReportGuide('spot');
    expect(guide.title).toContain('Spot Survey Report');
    expect(guide.sections.length).toBeGreaterThanOrEqual(4);

    const ids = guide.sections.map((s) => s.id);
    expect(ids).toContain('spot_header');
    expect(ids).toContain('spot_accident');
    expect(ids).toContain('spot_parts');
  });

  it('falls back safely to survey guide on unknown report type', () => {
    // @ts-expect-error test fallback
    const guide = getReportGuide('unknown');
    expect(guide.reportType).toBe('survey');
  });
});
