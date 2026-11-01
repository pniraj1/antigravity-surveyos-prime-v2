// Port of SurveyOS Scan's StatusFileTest (chase/StatusFileTest.kt); buildStatus/remoteReceived are Scan-only.
import { describe, it, expect } from 'vitest';
import {
  mergeStatus, parseStatus, statusToJson, statusToChase, withCompletion, withReceived,
  type FieldValue, type SlotStatus, type Status, type StatusAsk,
} from '../scan-status';

const slot = (state: string, by: string, at: number): SlotStatus => ({ state, reason: null, by, at });
const status = (
  slots: Record<string, SlotStatus> = {}, contacts: Record<string, Record<string, FieldValue>> = {},
  asks: StatusAsk[] = [], st = 'active',
): Status => ({ claimId: 'c', updatedAt: 1000, vehicle: 'MH12AB1234', insurer: 'NIA', claimNo: 'CL1', slots, contacts, asks, status: st });

describe('scan status file (port of Scan StatusFileTest)', () => {
  it('newest wins for slots and contacts', () => {
    const l = status(
      { rc: slot('missing', 'scan', 2000), dl: slot('received', 'scan', 5000) },
      { insured: { phone: { value: 'old', at: 1000 }, name: { value: 'A', at: 4000 } } },
    );
    const r = status(
      { rc: slot('received', 'prime', 3000), dl: slot('missing', 'prime', 4000), est: slot('received', 'prime', 1000) },
      { insured: { phone: { value: 'new', at: 2000 }, name: { value: 'B', at: 3000 } }, garage: { name: { value: 'G', at: 1 } } },
    );
    const m = mergeStatus(l, r);
    expect(m.slots.rc.by).toBe('prime');
    expect(m.slots.dl.by).toBe('scan');
    expect(new Set(Object.keys(m.slots))).toEqual(new Set(['rc', 'dl', 'est']));
    expect(m.contacts.insured.phone.value).toBe('new');
    expect(m.contacts.insured.name.value).toBe('A');
    expect(m.contacts.garage.name.value).toBe('G');
  });

  it('ties keep local', () => {
    const m = mergeStatus(status({ rc: slot('received', 'prime', 3000) }, { insured: { phone: { value: 'L', at: 9 } } }),
      status({ rc: slot('missing', 'scan', 3000) }, { insured: { phone: { value: 'R', at: 9 } } }));
    expect(m.slots.rc.by).toBe('prime');
    expect(m.contacts.insured.phone.value).toBe('L');
  });

  it('asks union and status only from remote', () => {
    const a1: StatusAsk = { at: 1000, to: 'insured', via: 'sms', lang: 'en', docs: ['rc'] };
    const a2: StatusAsk = { at: 2000, to: 'garage', via: 'sms', lang: 'en', docs: ['dl'] };
    const m = mergeStatus(status({}, {}, [a1], 'completed'), status({}, {}, [a1, a2], 'active'));
    expect(m.asks).toEqual([a1, a2]);
    expect(m.status).toBe('active');
    expect(mergeStatus(status({}, {}, [], 'active'), status({}, {}, [], 'completed')).status).toBe('completed');
    expect(mergeStatus(status({}, {}, [], 'active'), null).status).toBe('active');
  });

  it('round trip and unknown keys', () => {
    const s = status(
      { rc: slot('received', 'scan', 3000000), dl: { state: 'rejected', reason: 'Cut "off"', by: 'scan', at: 4000000 } },
      { insured: { phone: { value: '98', at: 5000000 } } },
      [{ at: 6000000, to: 'insured', via: 'whatsapp', lang: 'hi', docs: ['rc', 'other:Bank'] }],
    );
    const withUpdated = { ...s, updatedAt: 7000000 };
    expect(parseStatus(statusToJson(withUpdated))).toEqual(withUpdated);
    const extra = statusToJson(withUpdated).replace('{', '{"future":{"x":1},');
    expect(parseStatus(extra)).toEqual(withUpdated);
  });

  it('ms times agree with the wire after a round trip', () => {
    const ms = 1730370000123;
    const local = withReceived(null, 'scan-c', 'rc', ms);
    const remote = parseStatus(statusToJson(local))!;
    expect(remote).toEqual(local);
    expect(mergeStatus(local, remote).slots).toEqual(local.slots);
    expect(local.slots.rc.at).toBe(1730370000000);
  });

  it('writes IST ISO with whole seconds and no claimNo when absent', () => {
    const j = JSON.parse(statusToJson({ ...status({ rc: slot('received', 'prime', 0) }), claimNo: null }));
    expect(j.app).toBe('surveyos-scan-status');
    expect(j.v).toBe(1);
    expect(j.slots.rc.at).toBe('1970-01-01T05:30:00+05:30');
    expect('claimNo' in j).toBe(false);
    expect('reason' in j.slots.rc).toBe(false);
  });

  it('parse rejects foreign files', () => {
    expect(parseStatus('not json')).toBeNull();
    expect(parseStatus('{"app":"other"}')).toBeNull();
  });
});

describe('Prime side', () => {
  it('withReceived marks the slot by prime, keeps remote status and the rest', () => {
    const remote = status({ rc: slot('missing', 'scan', 1000), dl: slot('missing', 'scan', 1000) }, {}, [], 'completed');
    const m = withReceived(remote, 'c', 'rc', 5000);
    expect(m.slots.rc).toEqual(slot('received', 'prime', 5000));
    expect(m.slots.dl).toEqual(slot('missing', 'scan', 1000));
    expect(m.status).toBe('completed');
    expect(m.vehicle).toBe('MH12AB1234');
    expect(m.updatedAt).toBe(5000);
  });

  it('withReceived with no remote file starts an active status', () => {
    const m = withReceived(null, 'scan-c', 'dl', 2000);
    expect(m.claimId).toBe('scan-c');
    expect(m.status).toBe('active');
    expect(Object.keys(m.slots)).toEqual(['dl']);
  });

  it('a Scan slot newer than the upload still wins', () => {
    const remote = status({ rc: slot('missing', 'scan', 9000) });
    expect(withReceived(remote, 'c', 'rc', 5000).slots.rc.by).toBe('scan');
  });

  it('statusToChase maps slots, contacts and asks, and unions asks with Prime', () => {
    const s = {
      ...status(
        { rc: slot('received', 'prime', 1000), dl: slot('missing', 'scan', 1000), est: { state: 'rejected', reason: 'Blurry', by: 'scan', at: 1000 } },
        { insured: { phone: { value: '98', at: 1 } }, bogus: { x: { value: 'y', at: 1 } } },
        [{ at: 0, to: 'insured', via: 'whatsapp', lang: 'en', docs: ['dl'] }],
      ),
      updatedAt: Date.parse('2026-11-01T10:00:00+05:30'),
    };
    const prev = { importedAt: '2026-10-01T00:00:00.000Z', asks: [
      { at: '1970-01-01T05:30:00+05:30', to: 'insured' as const, via: 'whatsapp' as const, lang: 'en' as const, docs: ['dl'] },
      { at: '2026-11-01T11:00:00+05:30', to: 'garage' as const, via: 'email' as const, lang: 'en' as const, docs: ['est'] },
    ] };
    const c = statusToChase(s, prev)!;
    expect(c.slotStates).toEqual({ rc: 'received', dl: 'missing', est: { state: 'rejected', reason: 'Blurry' } });
    expect(c.contacts).toEqual({ insured: { phone: '98' } });
    expect(c.asks!.map((a) => a.to)).toEqual(['insured', 'garage']);
    expect(c.importedAt).toBe('2026-11-01T04:30:00.000Z');
  });

  it('statusToChase keeps a fresher manifest import', () => {
    const s = { ...status({ rc: slot('missing', 'scan', 1) }), updatedAt: Date.parse('2026-10-01T00:00:00Z') };
    expect(statusToChase(s, { importedAt: '2026-10-02T00:00:00.000Z', slotStates: { rc: 'received' } })).toBeNull();
  });

  it('withCompletion sets status and a fresh updatedAt, keeping the rest', () => {
    const remote = status({ rc: slot('missing', 'scan', 1000) });
    const done = withCompletion(remote, 'c', true, 5500);
    expect(done.status).toBe('completed');
    expect(done.updatedAt).toBe(5000);
    expect(done.slots).toEqual(remote.slots);
    expect(done.vehicle).toBe('MH12AB1234');
    const reopened = withCompletion(done, 'c', false, 9000);
    expect(reopened.status).toBe('active');
    expect(reopened.updatedAt).toBe(9000);
    expect(parseStatus(statusToJson(reopened))).toEqual(reopened);
  });

  it('withCompletion with no remote file starts one', () => {
    const m = withCompletion(null, 'scan-c', true, 2000);
    expect(m).toMatchObject({ claimId: 'scan-c', status: 'completed', updatedAt: 2000, slots: {} });
  });
});
