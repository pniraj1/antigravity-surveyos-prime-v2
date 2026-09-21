import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isExtensionPresent, sendPacketToExtension } from '../extension-bridge';

const packet = { v: 1, portal: 'nia', flow: 'nontieup', claimNo: '1', builtAt: '', fields: {}, files: [] } as const;

describe('extension bridge', () => {
  let listeners: Array<(ev: MessageEvent) => void>;
  beforeEach(() => {
    listeners = [];
    Object.defineProperty(globalThis, 'document', {
      value: { documentElement: { dataset: {} } },
      configurable: true,
    });
    Object.defineProperty(globalThis, 'location', {
      value: { origin: 'https://motorsurveyos-in.web.app' },
      configurable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: {
        addEventListener: (_: string, fn: any) => listeners.push(fn),
        removeEventListener: (_: string, fn: any) => { listeners = listeners.filter((l) => l !== fn); },
        postMessage: vi.fn(),
      },
      configurable: true,
    });
  });

  it('detects the relay marker', () => {
    expect(isExtensionPresent()).toBe(false);
    (globalThis as any).document.documentElement.dataset.surveyosExt = '0.1.0';
    expect(isExtensionPresent()).toBe(true);
  });

  it('posts to own origin and resolves on ack', async () => {
    const p = sendPacketToExtension(packet as any, 100);
    expect((globalThis as any).window.postMessage).toHaveBeenCalledWith(
      { type: 'surveyos:portal-packet', packet }, 'https://motorsurveyos-in.web.app');
    listeners[0]({ origin: 'https://motorsurveyos-in.web.app', source: globalThis.window, data: { type: 'surveyos:portal-packet-ack', ok: true } } as any);
    await expect(p).resolves.toEqual({ ok: true });
  });

  it('times out without an ack', async () => {
    await expect(sendPacketToExtension(packet as any, 20)).resolves.toMatchObject({ ok: false, reason: expect.stringMatching(/no reply/i) });
  });
});
