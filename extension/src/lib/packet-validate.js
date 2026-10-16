// @ts-check
/** Shape check for a PortalPacket coming over window.postMessage. Data, never code. */
const NS = 'SxPacket';
const MAX_FILE_B64 = 1_400_000; // ≈1 MB of bytes
const SLOTS = ['assessmentExcel'];
/** Portal → flows the extension has a map for. */
const KNOWN_FLOWS = { nia: ['nontieup'] };

/** @param {unknown} x */
function validatePacket(x) {
  const fail = (/** @type {string} */ reason) => ({ ok: /** @type {const} */ (false), reason });
  if (!x || typeof x !== 'object') return fail('not an object');
  const p = /** @type {Record<string, any>} */ (x);
  if (p.v !== 1) return fail('unsupported packet version');
  if (!KNOWN_FLOWS[p.portal]?.includes(p.flow)) return fail('packet is for another portal');
  if (typeof p.claimNo !== 'string' || !p.claimNo.trim()) return fail('missing claim number');
  if (typeof p.builtAt !== 'string') return fail('missing builtAt');
  if (!p.fields || typeof p.fields !== 'object') return fail('missing fields');
  for (const [k, v] of Object.entries(p.fields)) {
    if (!(typeof v === 'string' || typeof v === 'number')) return fail(`field ${k} is not a scalar`);
  }
  if (!Array.isArray(p.files)) return fail('missing files');
  for (const f of p.files) {
    if (!f || !SLOTS.includes(f.slot)) return fail('unknown file slot');
    if (typeof f.name !== 'string' || typeof f.mime !== 'string') return fail('bad file meta');
    if (typeof f.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(f.base64)) return fail('bad base64');
    if (f.base64.length >= MAX_FILE_B64) return fail('file too large');
  }
  return { ok: /** @type {const} */ (true), packet: p };
}

const API = { validatePacket, KNOWN_FLOWS };
// ---- umd shim: classic script in the extension, ESM/CJS in Vitest ----
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else globalThis[NS] = API;
