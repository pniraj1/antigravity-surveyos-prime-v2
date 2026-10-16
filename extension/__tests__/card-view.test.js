import { describe, it, expect } from 'vitest';
import { cardView, reportText, claimTail, LINE_COPY, pulseRestore, shouldReprobe, probeChanged, checkPacket, livePacket } from '../src/lib/card-view.js';
import nia from '../maps/nia-nontieup.json';

const H = 3600000;
const now = 1_800_000_000_000;
const packet = { portal: 'nia', flow: 'nontieup', claimNo: '7700031260390039686', fields: { a: 1, b: 2 }, files: [{ slot: 'x' }] };
const probeOk = { ok: true, claimNo: '7700031260390039686', invoices: 1 };
const base = { map: nia, packet, storedAt: now - 3 * H, now, probe: probeOk, phase: 'idle', fill: null, check: null };
const view = (o = {}) => cardView({ ...base, ...o });
const names = Object.keys(nia.fields);
const L = (i) => nia.fields[names[i]].label;

describe('cardView states', () => {
  it('loading', () => {
    const v = view({ phase: 'loading' });
    expect(v).toMatchObject({ state: 'loading', badge: { tone: 'muted', text: '' }, body: 'Reading this page…', primary: null, secondary: [] });
    expect(view({ probe: null }).state).toBe('loading');
  });
  it('noPacket', () => {
    const v = view({ packet: null });
    expect(v.state).toBe('noPacket');
    expect(v.badge).toEqual({ tone: 'muted', text: 'No claim sent' });
    expect(v.body).toBe('Send this claim from SurveyOS (Assessment → NIA Excel → Send to extension).');
    expect(v.primary).toBeNull();
    expect(v.secondary.map((s) => s.id)).toEqual(['check']);
    expect(view({ packet: null, map: { ...nia, portal: 'uiic' } }).body).toContain('UIIC summary');
  });
  it('expired packet shows No claim sent', () => {
    const v = view({ storedAt: now - 25 * H });
    expect(v.state).toBe('noPacket');
    expect(v.primary).toBeNull();
  });
  it('otherPortal', () => {
    const v = view({ packet: { ...packet, portal: 'uiic' } });
    expect(v.state).toBe('otherPortal');
    expect(v.badge).toEqual({ tone: 'muted', text: 'Other portal' });
    expect(v.body).toBe('The claim you sent is for United India. Open it on that portal.');
    expect(v.primary).toBeNull();
    expect(v.secondary.map((s) => s.id)).toEqual(['check']);
  });
  it('wrong claim keeps Check and disables Fill with reason', () => {
    const v = view({ probe: { ok: true, claimNo: '1234 5678 9999 0001', invoices: 1 } });
    expect(v.state).toBe('wrongClaim');
    expect(v.badge).toEqual({ tone: 'bad', text: 'Different claim' });
    expect(v.body).toBe('You sent claim …9686. This page is claim …0001. Open the right claim, or send this one from SurveyOS.');
    expect(v.primary).toEqual({ id: 'fill', label: 'Fill', disabled: true, reason: 'Different claim' });
    expect(v.secondary.map((s) => s.id)).toEqual(['check']);
  });
  it('wrongClaim with empty page claim number', () => {
    expect(view({ probe: { ok: true, claimNo: '', invoices: 1 } }).body).toBe("This page's claim number couldn't be read. You sent claim …9686.");
  });
  it('probeFailed', () => {
    const v = view({ probe: { ok: false, reason: 'No fields here' } });
    expect(v).toMatchObject({ state: 'probeFailed', badge: { tone: 'bad', text: "Couldn't read page" }, body: 'No fields here', primary: { id: 'retry', label: 'Try again' }, secondary: [] });
  });
  it('ready', () => {
    const v = view();
    expect(v.state).toBe('ready');
    expect(v.badge).toEqual({ tone: 'ok', text: 'Claim matches' });
    expect(v.body).toBe('3 items are ready to fill. Sent 3 h ago.');
    expect(v.primary).toEqual({ id: 'fill', label: 'Fill' });
    expect(v.secondary.map((s) => s.id)).toEqual(['check', 'clear']);
    expect(view({ storedAt: now - 1000 }).body).toBe('3 items are ready to fill. Sent just now.');
  });
  it('filling', () => {
    const v = view({ phase: 'filling' });
    expect(v).toMatchObject({ state: 'filling', badge: { tone: 'ok', text: 'Claim matches' }, body: 'Filling…', primary: { id: 'fill', label: 'Filling…', disabled: true }, secondary: [] });
  });
  it('checking', () => {
    const v = view({ phase: 'checking' });
    expect(v).toMatchObject({ state: 'checking', badge: { tone: 'info', text: 'Checking' }, body: 'Checking this page…', primary: null, secondary: [] });
  });
  it('filled', () => {
    const v = view({ fill: { ok: true, steps: [{ name: names[0], action: 'filled' }], files: [{ slot: 'x', status: 'attached' }] } });
    expect(v).toMatchObject({ state: 'filled', badge: { tone: 'ok', text: 'Filled' }, body: '', primary: null, doneHint: nia.doneHint });
    expect(v.secondary.map((s) => s.id)).toEqual(['showAll']);
    expect(v.reassurance).toBe('Nothing is saved until you save on the portal. To undo, reload this page.');
  });
  it('legend only after a fill (Check draws no outlines on the page)', () => {
    const LEGEND = 'On the page: green = filled, amber = kept, red = rejected.';
    expect(view({ fill: { ok: true, steps: [], files: [] } }).legend).toBe(LEGEND);
    expect(view({ check: { ok: true, mode: 'value', fields: [], files: [] } }).legend).toBeNull();
    expect(view().legend).toBeNull();
  });
  it('needsYou, with Fill again only on error or invalid', () => {
    const mk = (action) => view({ fill: { ok: true, steps: [{ name: names[0], action, why: 'bad' }], files: [] } });
    const m = mk('manual');
    expect(m).toMatchObject({ state: 'needsYou', badge: { tone: 'warn', text: 'Needs you: 1' }, primary: null, doneHint: nia.doneHint });
    expect(mk('invalid').primary).toEqual({ id: 'fill', label: 'Fill again' });
    expect(mk('error').primary).toEqual({ id: 'fill', label: 'Fill again' });
    expect(view({ fill: { ok: true, steps: [], files: [{ slot: 'x', status: 'error' }] } }).primary.label).toBe('Fill again');
  });
  it('fillFailed', () => {
    const v = view({ fill: { ok: false, reason: 'Nope', steps: [], files: [] } });
    expect(v).toMatchObject({ state: 'fillFailed', badge: { tone: 'bad', text: "Couldn't fill" }, body: 'Nope', primary: { id: 'retry', label: 'Try again' }, secondary: [] });
  });
  it('checked modes', () => {
    const chk = (mode) => view({ check: { ok: true, mode, fields: [], files: [] } });
    const s = chk('structure');
    expect(s).toMatchObject({ state: 'checked', badge: { tone: 'info', text: 'Checked' }, body: 'Page check (no claim sent).', primary: null });
    expect(s.secondary.map((x) => x.id)).toEqual(['showAll', 'check', 'copy']);
    expect(s.reassurance).toBe('Nothing is saved until you save on the portal. To undo, reload this page.');
    const v = chk('value');
    expect(v.body).toBe('Page check for this claim.');
    expect(v.primary).toEqual({ id: 'fill', label: 'Fill' });
    const w = view({ probe: { ok: true, claimNo: '1234 5678 9999 0001', invoices: 1 }, check: { ok: true, mode: 'wrongClaim', fields: [], files: [] } });
    expect(w.body).toBe('Page check: you sent claim …9686, this page is …0001. Fill will refuse.');
    expect(w.primary).toBeNull();
    expect(view({ probe: { ok: true, claimNo: '', invoices: 1 }, check: { ok: true, mode: 'wrongClaim', fields: [], files: [] } }).body)
      .toBe("Page check: this page's claim number couldn't be read. You sent claim …9686.");
  });
  it('checkFailed: a check that could not run offers Try again (Check)', () => {
    const v = view({ check: { ok: false, reason: 'Page fields not found. The portal may have changed.' } });
    expect(v).toMatchObject({ state: 'checkFailed', badge: { tone: 'bad', text: "Couldn't check" },
      body: 'Page fields not found. The portal may have changed.', primary: { id: 'check', label: 'Try again' }, secondary: [], lines: [] });
  });
  it('precedence: probe failure and phase beat results', () => {
    const fill = { ok: true, steps: [], files: [] };
    expect(view({ fill, probe: { ok: false, reason: 'x' } }).state).toBe('probeFailed');
    expect(view({ fill, phase: 'checking' }).state).toBe('checking');
    expect(view({ fill, check: { ok: true, mode: 'value', fields: [], files: [] } }).state).toBe('filled');
  });
});

describe('lines and summary', () => {
  const steps = [
    { name: names[0], action: 'filled' },
    { name: names[1], action: 'kept' },
    { name: names[2], action: 'notFound' },
    { name: names[3], action: 'skip' },
    { name: names[4], action: 'same' },
    { name: names[5], action: 'manual' },
  ];
  const fill = { ok: true, steps, files: [{ slot: 'x', status: 'attached' }] };
  it('lines order needs-you first and hides OK lines until showAll', () => {
    const v = view({ fill });
    expect(v.lines.map((l) => l.status)).toEqual(['notFound', 'manual', 'kept']);
    expect(v.lines[0].label).toBe(L(2));
    expect(v.lines[0].text).toBe(LINE_COPY.notFound);
    expect(v.okCount).toBe(3);
    const all = view({ fill, showAll: true });
    expect(all.lines.map((l) => l.status)).toEqual(['notFound', 'manual', 'kept', 'filled', 'same', 'attached']);
    expect(all.lines.at(-1).label).toBe('Excel file');
  });
  it('each line carries a tone for its icon and colour', () => {
    const all = view({ fill, showAll: true }).lines;
    expect(all.map((l) => [l.status, l.tone])).toEqual([
      ['notFound', 'bad'], ['manual', 'info'], ['kept', 'warn'], ['filled', 'ok'], ['same', 'ok'], ['attached', 'ok']]);
    const chk = (status) => view({ check: { ok: true, mode: 'value', files: [], fields: [{ name: 'a', label: 'A', status, modelPath: 'p' }] } }).lines[0].tone;
    expect(['hasValue', 'disabled', 'notBound', 'noOption', 'invalid', 'error', 'weird'].map(chk))
      .toEqual(['warn', 'info', 'info', 'bad', 'bad', 'bad', 'bad']);
  });
  it('summary omits zero parts', () => {
    expect(view({ fill }).summary).toBe('3 filled · 1 kept · 1 do by hand · 1 not found');
    expect(view({ fill: { ok: true, steps: [{ name: names[0], action: 'filled' }], files: [] } }).summary).toBe('1 filled');
    const chk = { ok: true, mode: 'value', files: [{ slot: 'x', status: 'found' }], fields: [
      { name: 'a', label: 'A', status: 'ready', modelPath: 'p.a' }, { name: 'b', label: 'B', status: 'hasValue', modelPath: 'p.b' }, { name: 'c', label: 'C', status: 'notFound', modelPath: 'p.c' }, { name: 'd', label: 'D', status: 'skip', modelPath: 'p.d' }] };
    expect(view({ check: chk }).summary).toBe('2 ready · 1 need you · 1 already filled');
  });
  it('noOption line copy with ellipsis rule', () => {
    const mk = (liveOptions) => view({ check: { ok: true, mode: 'value', files: [], fields: [{ name: 'a', label: 'A', status: 'noOption', modelPath: 'p', planned: 'Z', liveOptions }] } }).lines[0].text;
    expect(mk(['A', 'B', 'C', 'D'])).toBe("The portal has no option 'Z' (it offers A, B, C…).");
    expect(mk(['A', 'B'])).toBe("The portal has no option 'Z' (it offers A, B).");
  });
  it('invalid and error copy carry why', () => {
    const v = view({ fill: { ok: true, steps: [{ name: names[0], action: 'invalid', why: 'bad date' }, { name: names[1], action: 'error', why: 'boom' }], files: [] } });
    expect(v.lines.map((l) => l.text)).toEqual(['The portal rejected the value (bad date). Type it yourself.', 'Something went wrong here: boom']);
  });
});

describe('claimTail and reportText', () => {
  it('claimTail', () => {
    expect(claimTail('7700031260390039686')).toBe('…9686');
    expect(claimTail('77/0003-12.6039 0039686')).toBe('…9686');
    expect(claimTail('')).toBe('');
    expect(claimTail(undefined)).toBe('');
  });
  it('reportText has no text or money values', () => {
    const check = { ok: true, mode: 'value', files: [{ slot: 'x', status: 'found' }], fields: [
      { name: 'surveyPlace', label: 'Survey place', kind: 'text', modelPath: 'p.place', status: 'ready?', planned: 'Nashik Road' },
      { name: 'net', label: 'Net salvage', kind: 'money', modelPath: 'p.net', status: 'hasValue', planned: 1234, current: '1234' },
      { name: 'cause', label: 'Cause', kind: 'select', modelPath: 'p.cause', status: 'noOption', planned: 'FIRE', liveOptions: ['A', 'B'] }] };
    const text = reportText(view({ check, packet: { ...packet, fields: { surveyPlace: 'Nashik Road', net: 1234 } } }), { extVersion: '0.4.0', mapId: 'nia-nontieup', mapVersion: 3, route: '#/WorklistSurveyNew', mode: 'value', scopeFound: true, invoices: 2 });
    expect(text).not.toContain('Nashik');
    expect(text).not.toContain('1234');
    const rows = text.split('\n');
    expect(rows[0]).toBe('SurveyOS Portal Fill 0.4.0 · nia-nontieup v3 · #/WorklistSurveyNew · mode value · scope found · invoices 2 · page claim …9686');
    expect(rows).toContain('ready?\tp.place\tSurvey place');
    expect(rows).toContain('hasValue\tp.net\tNet salvage');
    expect(rows).toContain('noOption\tp.cause\tCause\tplanned FIRE\tlive A,B');
  });
});

describe('secondary labels (spec §10.3)', () => {
  const labels = (v) => v.secondary.map((s) => s.label);
  it('noPacket, ready, checked, needsYou', () => {
    expect(labels(view({ packet: null }))).toEqual(['Check page']);
    expect(labels(view())).toEqual(['Check page', 'Clear']);
    expect(labels(view({ check: { ok: true, mode: 'structure', fields: [], files: [] } }))).toEqual(['Show all lines', 'Check page', 'Copy report']);
    const fill = { ok: true, steps: [{ name: names[0], action: 'manual' }], files: [] };
    expect(labels(view({ fill }))).toEqual(['Show all lines']);
    expect(labels(view({ fill, showAll: true }))).toEqual(['Show fewer lines']);
  });
});

describe('pulseRestore', () => {
  const PULSE = 'rgb(15, 118, 110) solid 2px';
  it('restores the original outline when ours is still on the field', () => {
    expect(pulseRestore(PULSE, PULSE, 'rgb(22, 163, 74) solid 2px')).toBe('rgb(22, 163, 74) solid 2px');
    expect(pulseRestore(PULSE, PULSE, '')).toBe('');
  });
  it('leaves the field alone when something newer (Fill) replaced our outline', () => {
    expect(pulseRestore('rgb(185, 28, 28) solid 2px', PULSE, '')).toBeNull();
  });
});

describe('final fix wave helpers', () => {
  it('shouldReprobe only in resting states while idle', () => {
    for (const s of ['ready', 'wrongClaim', 'noPacket', 'otherPortal', 'probeFailed']) {
      expect(shouldReprobe(s, 'idle')).toBe(true);
      expect(shouldReprobe(s, 'filling')).toBe(false);
      expect(shouldReprobe(s, 'checking')).toBe(false);
      expect(shouldReprobe(s, 'loading')).toBe(false);
    }
    for (const s of ['loading', 'filling', 'checking', 'filled', 'needsYou', 'fillFailed', 'checked', 'checkFailed']) expect(shouldReprobe(s, 'idle')).toBe(false);
  });
  it('probeChanged on ok or claimNo only', () => {
    const a = { ok: true, claimNo: '1', invoices: 1 };
    expect(probeChanged(a, { ...a })).toBe(false);
    expect(probeChanged(a, { ...a, invoices: 3 })).toBe(false);
    expect(probeChanged(a, { ...a, claimNo: '2' })).toBe(true);
    expect(probeChanged(a, { ok: false, reason: 'x' })).toBe(true);
    expect(probeChanged(null, a)).toBe(true);
  });
  it('checkPacket drops other-portal packets and strips files', () => {
    expect(checkPacket(nia, { ...packet, portal: 'uiic' })).toBeNull();
    expect(checkPacket(nia, null)).toBeNull();
    expect(checkPacket(nia, undefined)).toBeNull();
    const p = checkPacket(nia, { ...packet, files: [{ slot: 'x', base64: 'AAAA' }] });
    expect(p.files).toEqual([]);
    expect(p).toMatchObject({ portal: 'nia', flow: 'nontieup', claimNo: packet.claimNo, fields: packet.fields });
  });
  it('livePacket boundary: live at the TTL, expired 1 ms after', () => {
    const TTL = 24 * H;
    expect(livePacket(packet, now - TTL, now, TTL)).toBe(packet);
    expect(livePacket(packet, now - TTL - 1, now, TTL)).toBeUndefined();
    expect(livePacket(packet, undefined, now, TTL)).toBe(packet);
  });
  it('ready mentions multiple invoices', () => {
    expect(view().body).toBe('3 items are ready to fill. Sent 3 h ago.');
    expect(view({ probe: { ...probeOk, invoices: 3 } }).body)
      .toBe('3 items are ready to fill. Sent 3 h ago. This claim has 3 invoices on the portal; Fill fills invoice 1 only.');
  });
  it('checked offers Show, Check and Copy, and respects showAll', () => {
    const check = { ok: true, mode: 'value', files: [], fields: [
      { name: 'a', label: 'A', status: 'ready', modelPath: 'p.a' }, { name: 'b', label: 'B', status: 'notFound', modelPath: 'p.b' }] };
    const v = view({ check });
    expect(v.secondary).toEqual([{ id: 'showAll', label: 'Show all lines' }, { id: 'check', label: 'Check page' }, { id: 'copy', label: 'Copy report' }]);
    expect(v.primary).toEqual({ id: 'fill', label: 'Fill' });
    expect(v.lines.map((l) => l.status)).toEqual(['notFound']);
    const all = view({ check, showAll: true });
    expect(all.secondary[0].label).toBe('Show fewer lines');
    expect(all.lines.map((l) => l.status)).toEqual(['notFound', 'ready']);
  });
});

it('reportText header with nothing read from the page', () => {
  const v = view({ probe: { ok: false, reason: 'x' } });
  expect(reportText(v, { extVersion: '0.4.0', mapId: 'nia-nontieup', mapVersion: 3, route: '#/x', mode: '-', scopeFound: false, invoices: undefined }))
    .toBe('SurveyOS Portal Fill 0.4.0 · nia-nontieup v3 · #/x · mode - · scope missing · invoices - · page claim (none)');
});
