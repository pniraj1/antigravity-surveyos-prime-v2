// extension/src/background.js
// @ts-check
// Map fetch (install + daily), packet expiry (E6). No other network.
const MAP_URL = 'https://motorsurveyos-in.web.app/portal-maps/nia-nontieup.json';
const DAY_MS = 24 * 60 * 60 * 1000;

async function loadBundledMap() {
  const r = await fetch(chrome.runtime.getURL('maps/nia-nontieup.json'));
  return r.json();
}

async function refreshMap() {
  const { map: current } = await chrome.storage.local.get('map');
  const bundled = await loadBundledMap();
  let best = current && current.version >= bundled.version ? current : bundled;
  try {
    const r = await fetch(MAP_URL, { cache: 'no-store' });
    if (r.ok) {
      const remote = await r.json();
      if (remote && remote.portal === 'nia' && remote.flow === 'nontieup' && remote.version > best.version) best = remote;
    }
  } catch { /* offline: keep what we have */ }
  await chrome.storage.local.set({ map: best });
}

async function expirePacket() {
  const { storedAt } = await chrome.storage.local.get('storedAt');
  if (storedAt && Date.now() - storedAt > DAY_MS) await chrome.storage.local.remove(['packet', 'storedAt']);
}

chrome.runtime.onInstalled.addListener(() => {
  refreshMap();
  chrome.alarms.create('sx-daily', { periodInMinutes: 24 * 60 });
});
chrome.runtime.onStartup.addListener(refreshMap);
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'sx-daily') { refreshMap(); expirePacket(); } });
chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch.packet) expirePacket(); });
