import { describe, it, expect, afterEach } from 'vitest';
import { setAITestOverride, getAITestOverride } from '../service';

describe('AI test override', () => {
  afterEach(() => setAITestOverride(null));
  it('stores and clears the override', () => {
    expect(getAITestOverride()).toBeNull();
    setAITestOverride({ provider: 'nvidia', model: 'meta/llama-3.2-90b-vision-instruct', key: 'nvapi-x' });
    expect(getAITestOverride()?.provider).toBe('nvidia');
    setAITestOverride(null);
    expect(getAITestOverride()).toBeNull();
  });
});
