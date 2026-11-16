import { describe, it, expect } from 'vitest';
import { buildStage3AIPrompt, parseStage3AIResponse } from '../stage3-ai-matcher';

describe('stage3-ai-matcher', () => {
  it('builds a concise prompt with only remaining rows and lines', () => {
    const prompt = buildStage3AIPrompt(
      [{ id: 'r1', particulars: 'ALTERNATOR BELT', amount: 850 }],
      [{ id: 'b1', description: 'DRIVE BELT V-RIBBED', amount: 900 }]
    );
    expect(prompt).toContain('ALTERNATOR BELT');
    expect(prompt).toContain('DRIVE BELT V-RIBBED');
    expect(prompt).toContain('Return ONLY a JSON array');
  });

  it('names the uploaded document, defaulting to the workshop invoice', () => {
    expect(buildStage3AIPrompt([], [], 'repair estimate')).toContain('repair estimate');
    expect(buildStage3AIPrompt([], [])).toContain('workshop invoice');
  });

  it('parses valid AI JSON proposals', () => {
    const rawJson = JSON.stringify([
      { rowId: 'r1', lineId: 'b1', confidence: 92, reason: 'Alternator belt is drive belt' }
    ]);
    const res = parseStage3AIResponse(rawJson);
    expect(res).toHaveLength(1);
    expect(res[0].rowId).toBe('r1');
    expect(res[0].confidence).toBe(92);
    expect(res[0].reason).toBe('Alternator belt is drive belt');
  });

  it('handles markdown code block wrappers gracefully', () => {
    const raw = '```json\n[{"rowId": "r2", "lineId": "b3", "confidence": 85, "reason": "Synonym"}]\n```';
    const res = parseStage3AIResponse(raw);
    expect(res).toHaveLength(1);
    expect(res[0].rowId).toBe('r2');
    expect(res[0].lineId).toBe('b3');
    expect(res[0].confidence).toBe(85);
  });

  it('returns empty array on malformed JSON or empty string', () => {
    expect(parseStage3AIResponse('')).toEqual([]);
    expect(parseStage3AIResponse('Not JSON')).toEqual([]);
    expect(parseStage3AIResponse('{"foo": "bar"}')).toEqual([]);
  });

  it('filters out objects missing rowId, lineId, or confidence', () => {
    const rawJson = JSON.stringify([
      { rowId: 'r1', lineId: 'b1', confidence: 90, reason: 'OK' },
      { rowId: 'r2', confidence: 80 }, // missing lineId
      { lineId: 'b3', confidence: 70 }, // missing rowId
      { rowId: 'r4', lineId: 'b4' }, // missing confidence
      'just a string',
    ]);
    const res = parseStage3AIResponse(rawJson);
    expect(res).toHaveLength(1);
    expect(res[0].rowId).toBe('r1');
  });
});
