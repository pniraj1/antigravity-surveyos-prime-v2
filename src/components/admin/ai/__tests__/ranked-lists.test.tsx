import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RankedLists } from '@/components/admin/ai/RankedLists';
import { FALLBACK_AI_MODELS_CONFIG, emptyProviderConfig } from '@/lib/ai/models-config';
import { EMPTY_PROBES, type ProbeResult, type ModelProbes } from '@/lib/ai/probe-types';

const r = (id: string, over: Partial<ProbeResult> = {}): ProbeResult => ({ id, status: 'ok', reason: '', vision: true, imageCap: null, ctxWindow: 1e6, msPerPage: 3000, slow: false,
  source: { vision: 'probe', imageCap: 'probe', ctxWindow: 'probe' }, probedAt: 1, consecutiveFailures: 0, ...over });
const probes: ModelProbes = { ...EMPTY_PROBES, providers: { ...EMPTY_PROBES.providers,
  gemini: { probedAt: 1, error: null, accuracy: {}, models: { 'gemini-3.5-flash': r('gemini-3.5-flash'), 'gemini-3.5-flash-lite': r('gemini-3.5-flash-lite'), 'gemini-3-flash-preview': r('gemini-3-flash-preview') } } } };
const cfg = { ...FALLBACK_AI_MODELS_CONFIG, providers: { ...FALLBACK_AI_MODELS_CONFIG.providers, gemini: { ...emptyProviderConfig(), excluded: ['gemini-3-flash-preview'], excludedReason: { 'gemini-3-flash-preview': 'not a document model' } } } };
const noop = () => {};

describe('RankedLists', () => {
  const html = renderToStaticMarkup(<RankedLists config={cfg} probes={probes} newIds={new Set(['gemini-3.5-flash'])} onExclude={noop} onInclude={noop} onLimit={noop} />);
  it('renders the three job lists with rank numbers', () => {
    // renderToStaticMarkup HTML-escapes '&' to '&amp;' in text nodes.
    for (const label of ['Estimates &amp; bills', 'Licence · RC · policy', 'Letters &amp; text']) expect(html).toContain(label);
    expect(html).toContain('gemini-3.5-flash');
  });
  it('shows the NEW badge and the reason line', () => {
    expect(html).toContain('NEW');
    expect(html).toContain('Flash tier · 20/day per key · 3 s/page');
  });
  it('lists excluded models with their reason and an Include button', () => {
    expect(html).toContain('gemini-3-flash-preview');
    expect(html).toContain('not a document model');
    expect(html).toContain('Include');
  });
  it('limit input shows the table default as placeholder', () => {
    expect(html).toMatch(/placeholder="20"/);
  });
});
