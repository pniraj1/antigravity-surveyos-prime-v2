import { describe, it, expect } from 'vitest';
import { tierOf, dailyLimit, OLLAMA_REST_MS } from '../quota';

describe('dailyLimit — Google free tier, per key (owner quota page 2026-09-16)', () => {
  it('Flash family is 20/day', () => {
    for (const id of ['gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3-flash-preview']) {
      expect(dailyLimit('gemini', id)).toBe(20);
    }
  });
  it('Flash-Lite is 500/day', () => {
    expect(dailyLimit('gemini', 'gemini-3.5-flash-lite')).toBe(500);
    expect(dailyLimit('gemini', 'gemini-flash-lite-latest')).toBe(500);
  });
  it('Gemma via Google is 14 400/day', () => { expect(dailyLimit('gemini', 'gemma-4-31b-it')).toBe(14_400); });
  it('Pro is 0 — never eligible on the free tier', () => { expect(dailyLimit('gemini', 'gemini-3.1-pro')).toBe(0); });
  it('other providers are unknown → Infinity', () => {
    expect(dailyLimit('ollama', 'gemma4:31b')).toBe(Infinity);
    expect(dailyLimit('groq', 'llama-3.2-90b-vision-preview')).toBe(Infinity);
    expect(dailyLimit('nvidia', 'meta/llama-3.2-90b-vision-instruct')).toBe(Infinity);
  });
});

describe('tierOf', () => {
  it('gemini: gemma > lite > flash by pattern; pro counts as flash', () => {
    expect(tierOf('gemini', 'gemma-4-31b-it')).toBe('gemma');
    expect(tierOf('gemini', 'gemini-3.5-flash-lite')).toBe('lite');
    expect(tierOf('gemini', 'gemini-3.5-flash')).toBe('flash');
    expect(tierOf('gemini', 'gemini-3.1-pro')).toBe('flash');
  });
  it('ollama gemma is gemma; everything else is lite (cheap fallback, not a reserve)', () => {
    expect(tierOf('ollama', 'gemma4:31b')).toBe('gemma');
    expect(tierOf('ollama', 'gpt-oss:120b')).toBe('lite');
    expect(tierOf('groq', 'llama-3.2-90b-vision-preview')).toBe('lite');
  });
  it('rest window is one hour', () => { expect(OLLAMA_REST_MS).toBe(3_600_000); });
});
