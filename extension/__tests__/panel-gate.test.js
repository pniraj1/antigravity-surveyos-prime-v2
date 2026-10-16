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

import { routeStep, keepResults } from '../src/lib/fill-core.js';

describe('routeStep', () => {
  it('boots the matched map when nothing is booted', () => {
    expect(routeStep('', 'nia-nontieup', false)).toEqual({ remove: false, boot: 'nia-nontieup', bootedFor: 'nia-nontieup' });
  });
  it('does nothing when the same map is already showing', () => {
    expect(routeStep('nia-nontieup', 'nia-nontieup', true)).toEqual({ remove: false, boot: '', bootedFor: 'nia-nontieup' });
  });
  it('re-boots when the page removed the panel without a route change', () => {
    expect(routeStep('nia-nontieup', 'nia-nontieup', false)).toEqual({ remove: false, boot: 'nia-nontieup', bootedFor: 'nia-nontieup' });
  });
  it('swaps maps on a route change', () => {
    expect(routeStep('nia-nontieup', 'nia-maruti', true)).toEqual({ remove: true, boot: 'nia-maruti', bootedFor: 'nia-maruti' });
  });
  it('removes the panel on a route with no map', () => {
    expect(routeStep('nia-nontieup', '', true)).toEqual({ remove: true, boot: '', bootedFor: '' });
  });
});

describe('keepResults', () => {
  it('keeps results after a good fill when our own packet removal fires', () => {
    expect(keepResults(true, { packet: { oldValue: {} } })).toBe(true);
  });
  it('keeps results after a good fill when only the map changed', () => {
    expect(keepResults(true, { maps: { newValue: {} } })).toBe(true);
  });
  it('re-renders when a new packet arrives, or before any fill', () => {
    expect(keepResults(true, { packet: { newValue: {} } })).toBe(false);
    expect(keepResults(false, { maps: { newValue: {} } })).toBe(false);
  });
});
