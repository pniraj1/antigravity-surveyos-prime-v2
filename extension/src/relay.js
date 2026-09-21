// @ts-check
// Runs on motorsurveyos-in.web.app. Marks the page so SurveyOS can show the
// "Send to extension" button, and moves a packet into chrome.storage.local.
(() => {
  if (!globalThis.SxPacket) { console.error('SurveyOS Portal Fill: packet-validate.js not loaded before relay.js'); return; }
  const { validatePacket } = globalThis.SxPacket;
  const VERSION = chrome.runtime.getManifest().version;
  document.documentElement.dataset.surveyosExt = VERSION;

  window.addEventListener('message', (ev) => {
    if (ev.source !== window || ev.origin !== location.origin) return;
    const d = ev.data;
    if (!d || d.type !== 'surveyos:portal-packet') return;
    const r = validatePacket(d.packet);
    if (!r.ok) {
      window.postMessage({ type: 'surveyos:portal-packet-ack', ok: false, reason: r.reason }, location.origin);
      return;
    }
    chrome.storage.local.set({ packet: r.packet, storedAt: Date.now() }, () => {
      const err = chrome.runtime.lastError;
      window.postMessage(
        { type: 'surveyos:portal-packet-ack', ok: !err, reason: err ? err.message : undefined },
        location.origin,
      );
    });
  });
})();
