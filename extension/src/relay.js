// @ts-check
// Runs on surveyos.in and motorsurveyos-in.web.app.
// Marks the page so SurveyOS knows the extension is installed, bridges
// claim packets into chrome.storage.local, and bidirectionally syncs
// learned portal bindings between SurveyOS Cloud and the extension.
(() => {
  if (!globalThis.SxPacket) { console.error('SurveyOS Portal Fill: packet-validate.js not loaded before relay.js'); return; }
  const { validatePacket } = globalThis.SxPacket;
  const VERSION = chrome.runtime.getManifest().version;
  document.documentElement.dataset.surveyosExt = VERSION;

  window.addEventListener('message', (ev) => {
    if (ev.source !== window || ev.origin !== location.origin) return;
    const d = ev.data;
    if (!d || !d.type) return;

    // 1. Packet handoff from SurveyOS to extension
    if (d.type === 'surveyos:portal-packet') {
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
      return;
    }

    // 2. Cloud Sync Push: SurveyOS -> Extension (restore surveyor's cloud bindings)
    if (d.type === 'surveyos:portal-sync-push') {
      const { portal, flow, bindings } = d;
      if (!portal || !flow || !Array.isArray(bindings)) return;
      const key = `learned:${portal}-${flow}`;
      chrome.storage.local.get(key, (stored) => {
        const existing = Array.isArray(stored[key]) ? stored[key] : [];
        // Merge without duplicating
        const merged = [...existing];
        for (const b of bindings) {
          const idx = merged.findIndex((m) => m.claimField === b.claimField);
          if (idx >= 0) {
            if (b.matchCount >= (merged[idx].matchCount || 1)) merged[idx] = b;
          } else {
            merged.push(b);
          }
        }
        chrome.storage.local.set({ [key]: merged }, () => {
          window.postMessage({ type: 'surveyos:portal-sync-push-ack', ok: !chrome.runtime.lastError }, location.origin);
        });
      });
      return;
    }

    // 3. Cloud Sync Pull: SurveyOS <- Extension (fetch confirmed bindings to upload to cloud)
    if (d.type === 'surveyos:portal-sync-pull') {
      chrome.storage.local.get(null, (all) => {
        const learnings = {};
        for (const [k, v] of Object.entries(all || {})) {
          if (k.startsWith('learned:') && Array.isArray(v)) {
            learnings[k] = v;
          }
        }
        window.postMessage({ type: 'surveyos:portal-sync-pull-ack', ok: true, learnings }, location.origin);
      });
    }
  });
})();
