// @ts-check
/**
 * Pure fill logic. No DOM, no Angular — the Filler feeds it readers and
 * executes the steps it returns. Everything testable lives here.
 */
// IIFE: as a MAIN-world classic script, top-level const/function would be page globals
// and collide with the portal's own declarations. Body left unindented to keep the diff small.
(() => {
const NS = 'SxFill';

/** @param {string} s */
const normaliseClaimNo = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const pad2 = (/** @type {string|number} */ n) => String(n).padStart(2, '0');

const transforms = {
  /** ISO date / ISO datetime / dd/MM/yyyy -> dd/MM/yyyy */
  ddmmyyyy: (/** @type {unknown} */ v) => {
    const s = String(v ?? '').trim().split('T')[0];
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return `${pad2(m[3])}/${pad2(m[2])}/${m[1]}`;
    m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (m) return `${pad2(m[1])}/${pad2(m[2])}/${m[3]}`;
    return s;
  },
  /** 9:05 / 14:30:00 -> HH:MM */
  hhmm: (/** @type {unknown} */ v) => {
    const m = String(v ?? '').trim().match(/^(\d{1,2}):(\d{2})/);
    return m ? `${pad2(m[1])}:${m[2]}` : String(v ?? '');
  },
  money2dp: (/** @type {unknown} */ v) => (Number(v) || 0).toFixed(2),
  yn: (/** @type {unknown} */ v) => (v === true || v === 'Y' || v === 'y' || v === 'yes' ? 'Y' : 'N'),
  /** UIIC free text: only [a-zA-Z0-9. ], single spaces, trimmed, max 500. */
  uiicText: (/** @type {unknown} */ v) =>
    String(v ?? '').replace(/[^a-zA-Z0-9. ]/g, '').replace(/ {2,}/g, ' ').trim().slice(0, 500),
  /** 9:05 / 14:30:00 -> '09' / '14'; '' when unparseable */
  hour: (/** @type {unknown} */ v) => {
    const m = String(v ?? '').trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    return m ? pad2(m[1]) : '';
  },
  /** 9:05 / 14:30:00 -> '05' / '30'; '' when unparseable */
  minute: (/** @type {unknown} */ v) => {
    const m = String(v ?? '').trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    return m ? m[2] : '';
  },
};

/**
 * E4: "empty" = the portal's own default for the field. Numbers and numeric
 * strings equal to 0 are empty on money fields; null/undefined/'' always are.
 * @param {unknown} current @param {unknown} empty
 */
function isEmptyValue(current, empty) {
  if (current === null || current === undefined || current === '') return true;
  if (empty !== null && empty !== undefined && current === empty) return true;
  if (empty === '' && (current === 0 || current === '0' || current === '0.00')) return true;
  return false;
}

/** @param {unknown} current @param {unknown} empty @param {string} incoming */
function decide(current, empty, incoming) {
  if (isEmptyValue(current, empty)) return 'fill';
  const cur = current instanceof Date ? null : String(current);
  if (cur !== null && (cur === incoming || (Number(cur) === Number(incoming) && !Number.isNaN(Number(cur))))) return 'same';
  return 'kept';
}

/**
 * @param {any} map @param {any} packet
 * @param {{ current: (p: string) => unknown, radioValues: (p: string) => string[] }} read
 */
function planFill(map, packet, read) {
  const fields = packet.fields ?? {};
  /** @type {any[]} */
  const steps = [];
  for (const [name, f] of Object.entries(map.fields)) {
    const spec = /** @type {any} */ (f);
    const base = { name, modelPath: spec.modelPath, kind: spec.kind };

    /** @type {string|undefined} */
    let value;
    if (spec.kind === 'dateRadioOrOthers') {
      const src = fields[spec.from];
      if (src === undefined) { steps.push({ ...base, action: 'skip', why: 'no source' }); continue; }
      const dmy = transforms.ddmmyyyy(src);
      value = read.radioValues(spec.modelPath).includes(dmy) ? dmy : 'Others';
    } else if ('constant' in spec) {
      if (spec.onlyIf && fields[spec.onlyIf] === undefined) { steps.push({ ...base, action: 'skip', why: 'condition not met' }); continue; }
      value = String(spec.constant);
    } else {
      const raw = fields[spec.from ?? name];
      if (raw === undefined) { steps.push({ ...base, action: 'skip', why: 'not in packet' }); continue; }
      value = spec.kind === 'money' ? transforms.money2dp(raw)
        : spec.transform ? transforms[spec.transform](raw)
        : String(raw);
      if (spec.options) value = spec.options[value] ?? value;
      if (spec.maxLen) value = value.slice(0, spec.maxLen);
    }

    const current = read.current(spec.modelPath);
    const action = decide(current, spec.empty, value);
    steps.push({ ...base, action, value, current });
  }
  return steps;
}

/** @param {{portal: string, flow: string}} map */
const mapId = (map) => `${map.portal}-${map.flow}`;

/**
 * The map for this page. Exact route only: `#/WorklistSurvey` must not catch
 * `#/WorklistSurveyNew`. A `?query` or `/sub-path` after the route is allowed.
 * An empty host is a file:// fixture — the zipped build strips file:// matches,
 * so a live portal page always has its host.
 * @param {Record<string, any>} maps @param {string} host @param {string} hash
 */
function pickMap(maps, host, hash) {
  for (const m of Object.values(maps ?? {})) {
    if (host && m.host !== host) continue;
    if (hash === m.route || hash.startsWith(m.route + '?') || hash.startsWith(m.route + '/')) return m;
  }
  return null;
}

/** E3's sibling: the packet must be for the portal flow this page is. @param {any} map @param {any} packet */
function packetGate(map, packet) {
  if (packet.portal === map.portal && packet.flow === map.flow) return { ok: true };
  return { ok: false, reason: `This claim was sent for ${packet.portal} (${packet.flow}); this page is ${map.portal} (${map.flow}).` };
}

/**
 * Model paths whose element can lend its Angular scope when the map names no
 * controller (UIIC's capture has none): the claim number first, then every field.
 * @param {any} map @returns {string[]}
 */
function scopeAnchors(map) {
  const paths = [map.claimNoPath, ...Object.values(map.fields ?? {}).map((/** @type {any} */ f) => f.modelPath)];
  return [...new Set(paths.filter((p) => p && !p.startsWith('sessionStorage:')))];
}

/**
 * Panel lifecycle on a route check. `id` is the matched map ('' for none).
 * A panel the page removed is re-booted even when the route did not change.
 * @param {string} bootedFor @param {string} id @param {boolean} panelPresent
 */
function routeStep(bootedFor, id, panelPresent) {
  if (id !== bootedFor) return { remove: !!bootedFor, boot: id, bootedFor: id };
  return { remove: false, boot: id && !panelPresent ? id : '', bootedFor };
}

/**
 * After a good fill the results stay until a new packet arrives — not on our
 * own packet removal, not on a map refresh.
 * @param {boolean} done @param {Record<string, any>} ch
 */
const keepResults = (done, ch) => done && !ch.packet?.newValue;

const API = { normaliseClaimNo, transforms, isEmptyValue, decide, planFill, mapId, pickMap, packetGate, scopeAnchors, routeStep, keepResults };
// ---- umd shim: classic script in the extension, ESM/CJS in Vitest ----
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else globalThis[NS] = API;
})();
