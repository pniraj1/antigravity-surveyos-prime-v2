import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isSandbox } from '@/lib/sandbox';

function stubLocation(hostname: string, search = '') {
  vi.stubGlobal('window', { location: { hostname, search } });
}

describe('isSandbox', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('NEXT_PUBLIC_SANDBOX_MODE', '');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns false on the production host even with ?sandbox=true', () => {
    stubLocation('motorsurveyos-in.web.app', '?sandbox=true');
    expect(isSandbox()).toBe(false);
  });

  it('returns false on the production firebaseapp host even with ?sandbox=true', () => {
    stubLocation('motorsurveyos-in.firebaseapp.com', '?sandbox=true');
    expect(isSandbox()).toBe(false);
  });

  it('returns false on the production host even when NEXT_PUBLIC_SANDBOX_MODE is true', () => {
    vi.stubEnv('NEXT_PUBLIC_SANDBOX_MODE', 'true');
    stubLocation('motorsurveyos-in.web.app');
    expect(isSandbox()).toBe(false);
  });

  it('returns true on the antigravity sandbox host', () => {
    stubLocation('surveyos-v2-antigravity-in.web.app');
    expect(isSandbox()).toBe(true);
  });

  it('returns true on a preview channel of the production site', () => {
    stubLocation('motorsurveyos-in--sandbox-abc.web.app');
    expect(isSandbox()).toBe(true);
  });

  it('returns true on localhost with ?sandbox=true', () => {
    stubLocation('localhost', '?sandbox=true');
    expect(isSandbox()).toBe(true);
  });

  it('returns false on localhost without any sandbox signal', () => {
    stubLocation('localhost', '');
    expect(isSandbox()).toBe(false);
  });

  it('returns true when NEXT_PUBLIC_SANDBOX_MODE is true on a neutral host', () => {
    vi.stubEnv('NEXT_PUBLIC_SANDBOX_MODE', 'true');
    stubLocation('localhost', '');
    expect(isSandbox()).toBe(true);
  });
});
