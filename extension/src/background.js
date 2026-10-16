// extension/src/background.js
// @ts-check
// Map fetch (install + daily), packet expiry (E6). No other network.
const MAP_IDS = ['nia-nontieup', 'uiic-claimsurvey'];
const MAP_BASE = 'https://motorsurveyos-in.web.app/portal-maps/';
const DAY_MS = 24 * 60 * 60 * 1000;

// Copy of fill-core's mapId — the service worker loads no other file.
const mapId = (/** @type {{portal: string, flow: string}} */ m) => `${m.portal}-${m.flow}`;

async function loadBundledMap(/** @type {string} */ id) {
  const r = await fetch(chrome.runtime.getURL(`maps/${id}.json`));
  return r.json();
}

/** One map per flow under `maps`; a newer remote copy with the same id wins. */
async function refreshMaps() {
  const { maps: stored = {} } = await chrome.storage.local.get('maps');
  /** @type {Record<string, any>} */
  const maps = {};
  for (const id of MAP_IDS) {
    const bundled = await loadBundledMap(id);
    const current = stored[id];
    let best = current && current.version >= bundled.version ? current : bundled;
    try {
      const r = await fetch(`${MAP_BASE}${id}.json`, { cache: 'no-store' });
      if (r.ok) {
        const remote = await r.json();
        const usable = remote && remote.host && remote.route && remote.fields && mapId(remote) === id;
        if (usable && remote.version > best.version) best = remote;
      }
    } catch { /* offline: keep what we have */ }
    maps[id] = best;
  }
  await chrome.storage.local.set({ maps });
  await chrome.storage.local.remove('map'); // v0.1.0 kept a single map here
}

async function expirePacket() {
  const { storedAt } = await chrome.storage.local.get('storedAt');
  if (storedAt && Date.now() - storedAt > DAY_MS) await chrome.storage.local.remove(['packet', 'storedAt']);
}

chrome.runtime.onInstalled.addListener(() => {
  refreshMaps();
  chrome.alarms.create('sx-daily', { periodInMinutes: 24 * 60 });
});
chrome.runtime.onStartup.addListener(refreshMaps);
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'sx-daily') { refreshMaps(); expirePacket(); } });
chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch.packet) expirePacket(); });
// onInstalled is not guaranteed for an update applied while disabled; without
// `maps` the panel never appears, so load them whenever the worker starts empty.
chrome.storage.local.get('maps').then(({ maps }) => { if (!maps || MAP_IDS.some((id) => !maps[id])) refreshMaps(); });

// ---- Vitest only; the service worker has no `module` ----
if (typeof module !== 'undefined' && module.exports) module.exports = { refreshMaps, MAP_IDS };
