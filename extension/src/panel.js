// extension/src/panel.js
// @ts-check
// Isolated world on the portal. Card UI + storage + messaging to the Filler.
(() => {
  // The SPA changes route without reload; re-check on every hashchange.
  const onRoute = () => {
    if (location.hash.startsWith('#/WorklistSurveyNew')) boot();
    else document.getElementById('sx-panel')?.remove();
  };
  window.addEventListener('hashchange', onRoute);
  onRoute();

  function boot() {
    if (document.getElementById('sx-panel')) return;
    const nonce = crypto.randomUUID();
    const root = document.createElement('div');
    root.id = 'sx-panel';
    root.innerHTML = `
      <div class="sx-head">SurveyOS <span class="sx-v"></span></div>
      <div class="sx-body">Loading…</div>
      <div class="sx-foot"><button class="sx-fill" disabled>Fill</button><a class="sx-clear" href="#">Clear packet</a></div>`;
    document.body.appendChild(root);
    root.querySelector('.sx-v').textContent = chrome.runtime.getManifest().version;
    const body = /** @type {HTMLElement} */ (root.querySelector('.sx-body'));
    const fillBtn = /** @type {HTMLButtonElement} */ (root.querySelector('.sx-fill'));
    root.querySelector('.sx-clear').addEventListener('click', (e) => { e.preventDefault(); chrome.storage.local.remove(['packet', 'storedAt'], render); });

    /** @param {string} type @param {object} payload @returns {Promise<any>} */
    const ask = (type, payload) => new Promise((resolve) => {
      const onMsg = (/** @type {MessageEvent} */ ev) => {
        if (ev.source !== window || !ev.data || ev.data.sx !== nonce || ev.data.type !== `${type}:result`) return;
        window.removeEventListener('message', onMsg); resolve(ev.data);
      };
      window.addEventListener('message', onMsg);
      window.postMessage({ sx: nonce, type, ...payload }, '*');
    });

    async function render() {
      const { packet, storedAt, map } = await chrome.storage.local.get(['packet', 'storedAt', 'map']);
      if (!map) { body.textContent = 'Field map not loaded yet — reopen this page in a minute.'; fillBtn.disabled = true; return; }
      if (!packet) { body.textContent = 'Send a claim from SurveyOS first.'; fillBtn.disabled = true; return; }
      const probe = await ask('probe', { map });
      const n = Object.keys(packet.fields).length;
      body.innerHTML = `<div><b>Claim</b> ${esc(packet.claimNo)}</div>
        <div>${n} fields · ${packet.files.length} file · built ${new Date(packet.builtAt).toLocaleString()}</div>
        <div class="sx-page">Page: ${probe.ok ? `claim ${esc(probe.claimNo || '(none)')} · invoice 1 of ${probe.invoices}` : esc(probe.reason)}</div>`;
      fillBtn.disabled = !probe.ok;
      fillBtn.onclick = async () => {
        fillBtn.disabled = true;
        const r = await ask('fill', { map, packet });
        if (!r.ok) { body.innerHTML += `<div class="sx-err">${esc(r.reason)}</div>`; fillBtn.disabled = false; return; }
        const icon = { filled: '✓', kept: '⚠ kept', same: '=', skip: '·', notFound: '✗ not found', manual: '✎ do by hand', error: '✗ error' };
        body.innerHTML = `<div><b>Filled.</b> Check the amber fields, then click <b>Validate</b> on the portal yourself.</div><ul class="sx-list">` +
          r.steps.filter((s) => s.action !== 'skip').map((s) => `<li class="sx-${s.action}">${icon[s.action]} ${esc(s.name)}${s.why ? ` — ${esc(s.why)}` : ''}</li>`).join('') +
          r.files.map((f) => `<li class="sx-${f.status}">${f.status === 'attached' ? '✓' : '✗'} ${esc(f.slot)} ${esc(f.why || '')}</li>`).join('') + '</ul>';
        if (r.files.every((f) => f.status === 'attached') && !r.steps.some((s) => s.action === 'error')) {
          chrome.storage.local.remove(['packet', 'storedAt']); // E6
        } else {
          fillBtn.disabled = false; // packet stays in storage on a partial fill — let the surveyor retry
        }
      };
    }
    const esc = (/** @type {unknown} */ s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

    chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && (ch.packet || ch.map)) render(); });
    render();
  }
})();
