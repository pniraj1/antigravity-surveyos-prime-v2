import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReportSectionGuideView } from '../ReportSectionGuide';
import { getReportGuide } from '@/lib/onboarding/report-guide';

describe('ReportSectionGuide', () => {
  it('renders collapsed state with header and title', () => {
    const guide = getReportGuide('survey');
    const html = renderToStaticMarkup(
      <ReportSectionGuideView guide={guide} defaultExpanded={false} />
    );

    expect(html).toContain('Report Section Guide');
    expect(html).toContain('Show Guide');
    expect(html).toContain('print:hidden');
  });

  it('renders expanded state with section breakdown and action buttons', () => {
    const guide = getReportGuide('survey');
    const html = renderToStaticMarkup(
      <ReportSectionGuideView guide={guide} defaultExpanded={true} />
    );

    expect(html).toContain('Report Section Guide');
    expect(html).toContain('Part-by-Part Assessment Sheet');
    expect(html).toContain('Edit in Assessment');
    expect(html).toContain('Surveyor Credentials &amp; Letterhead');
    expect(html).toContain('Edit in My Profile');
    expect(html).toContain('Insurer &amp; Insured Particulars');
    expect(html).toContain('Edit in Claim Details');
    expect(html).toContain('print:hidden');
  });

  it('renders spot survey sections when given spot guide', () => {
    const guide = getReportGuide('spot');
    const html = renderToStaticMarkup(
      <ReportSectionGuideView guide={guide} defaultExpanded={true} />
    );

    expect(html).toContain('Spot Survey Report');
    expect(html).toContain('Spot Inspection &amp; Accident Narrative');
    expect(html).toContain('Immediate Visible Damage List');
  });
});
