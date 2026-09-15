import { describe, it, expect } from 'vitest';
import { parseGeminiError, classifyGemini429, isThinkingRejected, isModalityRejected } from '../gemini-errors';

const violation = (quotaId: string) => ({ quotaMetric: 'x', quotaId, quotaDimensions: { location: 'global', model: 'gemini-2.5-flash' } });
const body429 = (ids: string[]) => ({ error: { code: 429, message: 'You exceeded your current quota', status: 'RESOURCE_EXHAUSTED',
  details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: ids.map(violation) },
            { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '34s' }] } });

describe('parseGeminiError', () => {
  it('reads details from the body', () => {
    const info = parseGeminiError(429, body429(['GenerateRequestsPerMinutePerProjectPerModel']));
    expect(info.status).toBe(429);
    expect(info.details).toHaveLength(2);
  });
  it('falls back to details double-encoded inside message', () => {
    const inner = JSON.stringify(body429(['GenerateRequestsPerDayPerProjectPerModel-FreeTier']));
    const info = parseGeminiError(429, { error: { message: inner, code: 429 } });
    expect(info.details).toHaveLength(2);
  });
  it('tolerates a non-JSON body', () => {
    const info = parseGeminiError(503, 'Service Unavailable');
    expect(info.message).toBe('Service Unavailable');
    expect(info.details).toEqual([]);
  });
});

describe('classifyGemini429', () => {
  it('PerMinutePerProjectPerModel → model/minute (PerModel wins over PerProject)', () => {
    expect(classifyGemini429(parseGeminiError(429, body429(['GenerateRequestsPerMinutePerProjectPerModel']))))
      .toEqual({ scope: 'model', period: 'minute' });
  });
  it('PerDayPerProjectPerModel-FreeTier → model/day', () => {
    expect(classifyGemini429(parseGeminiError(429, body429(['GenerateRequestsPerDayPerProjectPerModel-FreeTier']))))
      .toEqual({ scope: 'model', period: 'day' });
  });
  it('PerDayPerProject (no PerModel) → project/day', () => {
    expect(classifyGemini429(parseGeminiError(429, body429(['GenerateRequestsPerDayPerProject']))))
      .toEqual({ scope: 'project', period: 'day' });
  });
  it('token limits count too: InputTokensPerModelPerMinute → model/minute', () => {
    expect(classifyGemini429(parseGeminiError(429, body429(['GenerateContentInputTokensPerModelPerMinute-FreeTier']))))
      .toEqual({ scope: 'model', period: 'minute' });
  });
  it('day AND minute violations at once (captured Pro body) → zero quota', () => {
    const pro = body429([
      'GenerateRequestsPerDayPerProjectPerModel-FreeTier',
      'GenerateRequestsPerMinutePerProjectPerModel-FreeTier',
      'GenerateContentInputTokensPerModelPerMinute-FreeTier',
      'GenerateContentInputTokensPerModelPerDay-FreeTier',
    ]);
    expect(classifyGemini429(parseGeminiError(429, pro))).toBe('zero');
  });
  it('no details → null', () => {
    expect(classifyGemini429(parseGeminiError(429, { error: { message: 'Too many requests' } }))).toBeNull();
  });
  it('non-429 → null', () => {
    expect(classifyGemini429(parseGeminiError(503, body429(['GenerateRequestsPerDayPerProject'])))).toBeNull();
  });
  it('scope aggregates over all violations, not just the first', () => {
    expect(classifyGemini429(parseGeminiError(429, body429(['GenerateRequestsPerDayPerProject', 'GenerateRequestsPerDayPerProjectPerModel-FreeTier']))))
      .toEqual({ scope: 'model', period: 'day' });
  });
});

describe('isThinkingRejected', () => {
  it('true for a 400 that mentions thinking', () => {
    expect(isThinkingRejected(parseGeminiError(400, { error: { message: 'Thinking budget is not supported for this model' } }))).toBe(true);
  });
  it('false for other 400s and for non-400', () => {
    expect(isThinkingRejected(parseGeminiError(400, { error: { message: 'Invalid JSON payload' } }))).toBe(false);
    expect(isThinkingRejected(parseGeminiError(429, { error: { message: 'thinking' } }))).toBe(false);
  });
});

describe('isModalityRejected', () => {
  it('matches image / vision / modality wording', () => {
    expect(isModalityRejected('this model does not support image input')).toBe(true);
    expect(isModalityRejected('Unsupported modality: IMAGE')).toBe(true);
    expect(isModalityRejected('vision is not enabled for this model')).toBe(true);
    expect(isModalityRejected('Invalid argument')).toBe(false);
  });
});
