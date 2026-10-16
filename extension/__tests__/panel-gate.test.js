import { describe, it, expect } from 'vitest';
import { packetGate } from '../src/lib/fill-core.js';

const uiicMap = { portal: 'uiic', flow: 'claimsurvey' };
const niaPacket = { portal: 'nia', flow: 'nontieup', claimNo: '1' };

describe('packetGate', () => {
  it('refuses a packet built for another portal, naming both', () => {
    expect(packetGate(uiicMap, niaPacket)).toEqual({
      ok: false,
      reason: 'This claim was sent for nia (nontieup); this page is uiic (claimsurvey).',
    });
  });
  it('passes when portal and flow match', () => {
    expect(packetGate({ portal: 'nia', flow: 'nontieup' }, niaPacket)).toEqual({ ok: true });
  });
});
