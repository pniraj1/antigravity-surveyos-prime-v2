import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EstimateHeadsDialog, clampHead } from '@/components/dialogs/EstimateHeadsDialog';

const initial = { metal: 100000, plastic: 20000, glass: 5000, fiberglass: 0, labour: 80000, paint: 41500 };
const base = { initial, onConfirm: () => {}, onCancel: () => {} };

describe('EstimateHeadsDialog', () => {
  it('shows the six heads with the initial figures and no difference when totals agree', () => {
    const html = renderToStaticMarkup(<EstimateHeadsDialog {...base} totals={{ linesInclGst: 246500, printed: 246500 }} />);
    for (const t of ['Estimate amounts for the UIIC report', 'Metal', 'Plastic / Rubber', 'Glass', 'Fibre Glass', 'Labour', 'Painting', 'Total of heads', 'Confirm and print']) {
      expect(html).toContain(t);
    }
    expect(html).toContain('value="100000"');
    expect(html).toContain('value="41500"');
    expect(html).not.toContain('Difference');
  });

  it('shows the difference when lines and printed total disagree', () => {
    const html = renderToStaticMarkup(<EstimateHeadsDialog {...base} totals={{ linesInclGst: 246500, printed: 250000 }} />);
    expect(html).toContain('Difference ₹3,500');
  });

  it('shows the lines total incl. GST above the printed total (I4)', () => {
    const html = renderToStaticMarkup(<EstimateHeadsDialog {...base} totals={{ linesInclGst: 246500, printed: 250000 }} />);
    expect(html).toContain('Lines read, incl. GST');
    expect(html.indexOf('Lines read, incl. GST')).toBeLessThan(html.indexOf('Estimate total (printed on estimate)'));
  });

  it('clamps a typed negative figure to 0 (M3)', () => {
    expect(clampHead('-500')).toBe(0);
    expect(clampHead('')).toBe(0);
    expect(clampHead('1200.5')).toBe(1200.5);
  });
});
