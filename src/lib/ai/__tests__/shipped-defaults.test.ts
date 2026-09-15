import { describe, it, expect } from 'vitest';
import {
  CURRENT_MODELS, PROVIDER_MODELS,
  DEPRECATED_GEMINI_MODELS, DEPRECATED_GROQ_MODELS,
} from '../service';
import { FALLBACK_AI_MODELS_CONFIG } from '../models-config';

/**
 * Guards every model id the app ships as a default, a fallback, or a migration
 * target. Three of these were dead in production before this test existed:
 *
 *   meta-llama/llama-4-scout-17b-16e-instruct  404 "does not exist"
 *     — Groq's default AND the head of its fallback chain AND its only
 *       vision model, so Groq scans could not work at all.
 *   gemini-2.5-flash-lite  404 "no longer available to new users"
 *     — second entry in the Gemini chain, so a rate-limited Flash fell
 *       through to another dead model.
 *   gemini-2.5-pro  429 "exceeded your current quota"
 *     — offered in the UI as "Most capable", not on the free tier.
 *
 * Verified by live API call on 2026-08-10. The probe (ai_config/model_probes)
 * catches drift going forward; this catches it at build time for the ids that
 * are hardcoded rather than admin-managed.
 */
const KNOWN_DEAD = new Set([
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'llama-3.2-90b-vision-preview',
  'llama-3.2-11b-vision-preview',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-pro',
]);

function assertLive(ids: string[], where: string) {
  for (const id of ids) {
    expect(KNOWN_DEAD.has(id), `${where} ships dead model "${id}"`).toBe(false);
  }
}

describe('shipped default models are alive', () => {
  it('CURRENT_MODELS points at live models', () => {
    assertLive(Object.values(CURRENT_MODELS), 'CURRENT_MODELS');
  });

  it('migration maps never point at a dead model', () => {
    assertLive(Object.values(DEPRECATED_GEMINI_MODELS), 'DEPRECATED_GEMINI_MODELS targets');
    assertLive(Object.values(DEPRECATED_GROQ_MODELS), 'DEPRECATED_GROQ_MODELS targets');
  });

  it('migration maps never rewrite a live model into something else', () => {
    // openai/gpt-oss-120b and -20b are live on Groq (verified 2026-08-10) but
    // were being migrated away as "fake ids that never existed".
    const live = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile'];
    for (const id of live) {
      expect(DEPRECATED_GROQ_MODELS[id], `live model "${id}" is being migrated away`).toBeUndefined();
    }
  });

  it('the UI model lists offer nothing dead', () => {
    assertLive(PROVIDER_MODELS.gemini.map(m => m.id), 'PROVIDER_MODELS.gemini');
    assertLive(PROVIDER_MODELS.groq.map(m => m.id), 'PROVIDER_MODELS.groq');
  });

  it('the offline fallback config offers nothing dead', () => {
    for (const [provider, block] of Object.entries(FALLBACK_AI_MODELS_CONFIG.providers)) {
      assertLive(block.models.map(m => m.id), `FALLBACK_AI_MODELS_CONFIG.${provider}`);
      assertLive([block.defaultModel], `FALLBACK_AI_MODELS_CONFIG.${provider}.defaultModel`);
    }
  });

  it('every provider default appears in its own model list', () => {
    for (const [provider, block] of Object.entries(FALLBACK_AI_MODELS_CONFIG.providers)) {
      expect(block.models.map(m => m.id), `${provider} default is not in its list`)
        .toContain(block.defaultModel);
    }
  });
});
