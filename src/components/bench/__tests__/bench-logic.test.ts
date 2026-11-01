import { describe, it, expect } from 'vitest';
import { PARSER_MODEL, METHODS_OFFERED, defaultPickRows, missingKeys, toPicks } from '../bench-logic';

describe('parser pick', () => {
  it('is offered by default, parser method only', () => {
    const row = defaultPickRows().find(r => r.model === PARSER_MODEL);
    expect(row).toMatchObject({ checked: true, methods: ['parser'] });
    expect(METHODS_OFFERED(PARSER_MODEL)).toEqual(['parser']);
    expect(METHODS_OFFERED('some-model')).toEqual(['text', 'vision']);
  });
  it('needs no API key', () => {
    const picks = toPicks(defaultPickRows().filter(r => r.model === PARSER_MODEL), {});
    expect(missingKeys(picks)).toEqual([]);
    expect(missingKeys([{ provider: 'groq', model: 'x', key: '', methods: ['text'] }])).toEqual(['groq']);
  });
});
