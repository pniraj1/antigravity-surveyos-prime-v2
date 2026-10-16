// @ts-check
/**
 * Pure view model for the surveyor-facing card. No DOM — the panel draws what this returns.
 * Copy is fixed by spec §10.3/§10.4.
 */
// IIFE: as a classic script in the isolated world, top-level const/function would be shared globals.
(() => {
const NS = 'SxCard';
const F = (typeof module !== 'undefined' && module.exports) ? require('./fill-core.js') : /** @type {any} */ (globalThis).SxFill;

const DAY_MS = 24 * 3600000;
const PORTAL_NAME = /** @type {Record<string,string>} */ ({ nia: 'New India', uiic: 'United India' });
const SEND_PATH = /** @type {Record<string,string>} */ ({ nia: 'NIA Excel', uiic: 'UIIC summary' });
const REASSURANCE = 'Nothing is saved until you save on the portal. To undo, reload this page.';
const LEGEND = 'On the page: green = filled, amber = kept, red = rejected.';

const NEEDS_YOU = ['notFound', 'invalid', 'error', 'manual', 'noOption', 'disabled', 'notBound'];
const KEPT = ['kept', 'hasValue'];
const OK = ['filled', 'same', 'ready', 'ready?', 'attached', 'found'];

const LINE_COPY = {
  kept: "Kept the portal's value. Check it.",
  manual: 'Type this one yourself (the portal locks it for this claim).',
  notFound: 'Not on this page. The portal may have changed.',
  invalid: 'The portal rejected the value ({why}). Type it yourself.',
  noOption: "The portal has no option '{planned}' (it offers {options}).",
  disabled: 'Locked on this page. Type it yourself if needed.',
  notBound: "Can't be filled automatically. Type it yourself.",
  error: 'Something went wrong here: {why}',
};
const OK_COPY = /** @type {Record<string,string>} */ ({
  filled: 'Filled', same: 'Same as the portal', ready: 'Ready',
  'ready?': 'Ready (the portal checks the format when it is written)', attached: 'Attached', found: 'Found',
});

/** @param {any} claimNo */
const claimTail = (claimNo) => {
  const n = F.normaliseClaimNo(claimNo);
  return n ? '…' + n.slice(-4) : '';
};

/** @param {any} l */
function lineText(l) {
  if (OK_COPY[l.status]) return OK_COPY[l.status];
  if (KEPT.includes(l.status)) return LINE_COPY.kept;
  if (l.status === 'noOption') {
    const live = l.liveOptions ?? [];
    const options = live.slice(0, 3).join(', ') + (live.length > 3 ? '…' : '');
    return LINE_COPY.noOption.replace('{planned}', l.planned).replace('{options}', options);
  }
  const t = /** @type {any} */ (LINE_COPY)[l.status] ?? LINE_COPY.error;
  return t.replace('{why}', l.why ?? '');
}

/** Line tone -> the panel's icon and colour: ok ✓, warn kept, info type-it-yourself, bad problem. @param {string} s */
const toneOf = (s) => OK.includes(s) ? 'ok' : KEPT.includes(s) ? 'warn' : ['manual', 'disabled', 'notBound'].includes(s) ? 'info' : 'bad';

/** Fill or Check result -> all lines (ordered, skip dropped). @param {any} map @param {any} res @param {boolean} isFill */
function buildLines(map, res, isFill) {
  const rows = isFill
    ? [
        ...res.steps.filter((/** @type {any} */ s) => s.action !== 'skip').map((/** @type {any} */ s) => {
          const f = map.fields?.[s.name];
          return { status: s.action, label: f?.label ?? s.name, modelPath: f?.modelPath ?? '', why: s.why };
        }),
        ...res.files.map((/** @type {any} */ x) => ({ status: x.status, label: 'Excel file', modelPath: map.files?.[x.slot]?.modelPath ?? '', why: x.why })),
      ]
    : [
        ...res.fields.filter((/** @type {any} */ f) => f.status !== 'skip').map((/** @type {any} */ f) => ({ status: f.status, label: f.label, modelPath: f.modelPath, planned: f.planned, liveOptions: f.liveOptions })),
        ...res.files.map((/** @type {any} */ x) => ({ status: x.status, label: 'Excel file', modelPath: map.files?.[x.slot]?.modelPath ?? '', why: x.why })),
      ];
  const rank = (/** @type {string} */ s) => { const i = NEEDS_YOU.indexOf(s); return i >= 0 ? i : KEPT.includes(s) ? 50 : 100; };
  // Array.sort is stable: input order is kept inside a rank. Unknown statuses count as needs-you.
  return rows.map((r) => ({ ...r, text: lineText(r), tone: toneOf(r.status) })).sort((a, b) => rank(a.status) - rank(b.status));
}

const isNeeds = (/** @type {string} */ s) => !KEPT.includes(s) && !OK.includes(s);

/** @param {any[]} all @param {boolean} isFill */
function summarise(all, isFill) {
  const n = (/** @type {string[]} */ ss) => all.filter((l) => ss.includes(l.status)).length;
  const parts = isFill
    ? [[n(['filled', 'same', 'attached']), 'filled'], [n(['kept']), 'kept'],
       [all.filter((l) => isNeeds(l.status) && l.status !== 'notFound').length, 'do by hand'], [n(['notFound']), 'not found']]
    : [[n(['ready', 'ready?', 'found']), 'ready'], [all.filter((l) => isNeeds(l.status)).length, 'need you'], [n(['hasValue']), 'already filled']];
  const out = parts.filter(([c]) => c).map(([c, t]) => `${c} ${t}`).join(' · ');
  return out || null;
}

/**
 * @param {{ map:any, packet:any, storedAt?:number, now:number, probe:any, phase?:string, fill?:any, check?:any, showAll?:boolean }} i
 */
function cardView(i) {
  const { map, packet, probe, fill, check } = i;
  const expired = !!packet && i.storedAt != null && i.now - i.storedAt > DAY_MS;
  const live = expired ? null : packet;
  const packetTail = claimTail(live?.claimNo);
  const pageTail = claimTail(probe?.claimNo);
  const claim = { packetTail, pageTail, packetFull: F.normaliseClaimNo(live?.claimNo), pageFull: F.normaliseClaimNo(probe?.claimNo) };
  const v = /** @type {any} */ ({
    state: '', badge: { tone: 'muted', text: '' }, body: '', primary: null, secondary: [],
    summary: null, lines: [], allLines: [], okCount: 0, doneHint: null, reassurance: null, legend: null, claim,
  });
  const set = (/** @type {any} */ o) => Object.assign(v, o);
  const gate = live ? F.packetGate(map, live) : null;
  const matches = !!live && gate.ok && !!claim.pageFull && claim.packetFull === claim.pageFull;
  const FILL = { id: 'fill', label: 'Fill' };
  const RETRY = { id: 'retry', label: 'Try again' };
  const SHOW = { id: 'showAll', label: i.showAll ? 'Show fewer lines' : 'Show all lines' };

  if (i.phase === 'loading' || !probe) return set({ state: 'loading', body: 'Reading this page…' });
  if (probe.ok === false) return set({ state: 'probeFailed', badge: { tone: 'bad', text: "Couldn't read page" }, body: probe.reason ?? '', primary: RETRY });
  if (i.phase === 'filling') return set({ state: 'filling', badge: { tone: 'ok', text: 'Claim matches' }, body: 'Filling…', primary: { ...FILL, label: 'Filling…', disabled: true } });
  if (i.phase === 'checking') return set({ state: 'checking', badge: { tone: 'info', text: 'Checking' }, body: 'Checking this page…' });

  if (fill || check) {
    const isFill = !!fill;
    if (isFill && fill.ok === false) return set({ state: 'fillFailed', badge: { tone: 'bad', text: "Couldn't fill" }, body: fill.reason ?? '', primary: RETRY });
    if (!isFill && check.ok === false) return set({ state: 'checkFailed', badge: { tone: 'bad', text: "Couldn't check" }, body: check.reason ?? '', primary: { id: 'check', label: 'Try again' } });
    const all = buildLines(map, isFill ? fill : check, isFill);
    set({
      allLines: all,
      lines: i.showAll ? all : all.filter((l) => isNeeds(l.status) || KEPT.includes(l.status)),
      okCount: all.filter((l) => OK.includes(l.status)).length,
      summary: summarise(all, isFill),
      reassurance: REASSURANCE,
    });
    if (isFill) {
      const k = all.filter((l) => isNeeds(l.status)).length;
      const again = (fill.steps.some((/** @type {any} */ s) => s.action === 'error' || s.action === 'invalid') || fill.files.some((/** @type {any} */ x) => x.status === 'error'));
      return set({ state: k ? 'needsYou' : 'filled', badge: k ? { tone: 'warn', text: `Needs you: ${k}` } : { tone: 'ok', text: 'Filled' },
        primary: k && again ? { ...FILL, label: 'Fill again' } : null, secondary: [SHOW], doneHint: map.doneHint ?? null, legend: LEGEND });
    }
    const body = check.mode === 'structure' ? 'Page check (no claim sent).'
      : check.mode === 'value' ? 'Page check for this claim.'
      : pageTail ? `Page check: you sent claim ${packetTail}, this page is ${pageTail}. Fill will refuse.`
      : `Page check: this page's claim number couldn't be read. You sent claim ${packetTail}.`;
    return set({ state: 'checked', badge: { tone: 'info', text: 'Checked' }, body, primary: check.mode === 'value' && live ? FILL : null, secondary: [{ id: 'copy', label: 'Copy report' }] });
  }

  const CHECK = { id: 'check', label: 'Check page' };
  if (!live) return set({ state: 'noPacket', badge: { tone: 'muted', text: 'No claim sent' }, secondary: [CHECK],
    body: `Send this claim from SurveyOS (Assessment → ${SEND_PATH[map.portal] ?? map.portal} → Send to extension).` });
  if (!gate.ok) return set({ state: 'otherPortal', badge: { tone: 'muted', text: 'Other portal' }, secondary: [CHECK],
    body: `The claim you sent is for ${PORTAL_NAME[live.portal] ?? live.portal}. Open it on that portal.` });
  if (!matches) return set({ state: 'wrongClaim', badge: { tone: 'bad', text: 'Different claim' }, secondary: [CHECK],
    primary: { ...FILL, disabled: true, reason: 'Different claim' },
    body: pageTail ? `You sent claim ${packetTail}. This page is claim ${pageTail}. Open the right claim, or send this one from SurveyOS.`
      : `This page's claim number couldn't be read. You sent claim ${packetTail}.` });
  const n = Object.keys(live.fields ?? {}).length + (live.files ?? []).length;
  const h = Math.floor((i.now - (i.storedAt ?? i.now)) / 3600000);
  return set({ state: 'ready', badge: { tone: 'ok', text: 'Claim matches' }, primary: FILL,
    secondary: [CHECK, { id: 'clear', label: 'Clear' }],
    body: `${n} items are ready to fill. ${h < 1 ? 'Sent just now' : `Sent ${h} h ago`}.` });
}

/** Copy-report text. Field names and statuses only — never a packet text/money value. @param {any} view @param {{mapId:string, version:any, route:string, mode:string}} meta */
function reportText(view, meta) {
  const head = `SurveyOS Portal Fill ${meta.version} · ${meta.mapId} · ${meta.route} · mode ${meta.mode} · page claim ${view.claim.pageTail}`;
  const rows = view.allLines.map((/** @type {any} */ l) => `${l.status}\t${l.modelPath}\t${l.label}` +
    (l.status === 'noOption' ? `\tplanned ${l.planned}\tlive ${(l.liveOptions ?? []).join(',')}` : ''));
  return [head, ...rows].join('\n');
}

const API = { cardView, reportText, claimTail, LINE_COPY };
// ---- umd shim: classic script in the extension, ESM/CJS in Vitest ----
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else /** @type {any} */ (globalThis)[NS] = API;
})();
