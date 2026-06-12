import { describe, it, expect } from 'vitest';
import { resolveEnabledModel } from '../service';
import type { ProviderConfig } from '../models-config';

const cfg: ProviderConfig = {
  enabled: true,
  defaultModel: 'gemini-2.5-flash',
  models: [
    { id: 'gemini-2.5-flash', label: 'x', note: '', ctxWindow: null, vision: true, imageCap: null, estimateCapacity: '' },
    { id: 'gemini-3.5-flash', label: 'y', note: '', ctxWindow: null, vision: true, imageCap: null, estimateCapacity: '' },
  ],
};

describe('resolveEnabledModel', () => {
  it('keeps the saved model when it is still enabled', () => {
    expect(resolveEnabledModel('gemini-3.5-flash', cfg)).toBe('gemini-3.5-flash');
  });
  it('falls back to defaultModel when the saved model was disabled', () => {
    expect(resolveEnabledModel('gemini-1.5-flash', cfg)).toBe('gemini-2.5-flash');
  });
  it('falls back to defaultModel when nothing is saved', () => {
    expect(resolveEnabledModel(undefined, cfg)).toBe('gemini-2.5-flash');
  });
});
