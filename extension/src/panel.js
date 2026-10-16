// extension/src/panel.js
// @ts-check
// Isolated world on the portal. Thin renderer of SxCard.cardView + storage + messaging to the Filler.
(() => {
  const { pickMap, mapId, routeStep, keepResults } = /** @type {any} */ (globalThis).SxFill;
  const { cardView, reportText, pulseRestore } = /** @type {any} */ (globalThis).SxCard;
  /** Live line-click pulses, so overlapping clicks restore the true original once. @type {WeakMap<HTMLElement, {orig: string, timer: ReturnType<typeof setTimeout>}>} */
  const pulses = new WeakMap();
  const PACKET_TTL_MS = 24 * 60 * 60 * 1000; // E6
  const ASK_TIMEOUT_MS = 5000;
  const NUDGE_PX = 24;
  const PULSE_MS = 1500;
  const COPIED_MS = 2000;
  const PULSE_OUTLINE = '2px solid #0f766e';

  // Lucide icons (24×24, stroke), always next to a word.
  const svg = (/** @type {string} */ d) => `<svg class="sx-ic" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
  const ICON = {
    check: svg('<path d="M20 6 9 17l-5-5"/>'),
    alert: svg('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
    x: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    pencil: svg('<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>'),
    minus: svg('<path d="M5 12h14"/>'),
  };
  /** badge / line tone -> icon */
  const TONE_ICON = /** @type {Record<string,string>} */ ({ ok: ICON.check, warn: ICON.alert, bad: ICON.x, info: ICON.pencil, muted: ICON.minus });
  const BADGE_ICON = /** @type {Record<string,string>} */ ({ ...TONE_ICON, info: ICON.check });

  const esc = (/** @type {unknown} */ s) => String(s ?? '').replace(/[&<>"]/g, (c) => /** @type {any} */ ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  // Same selector as the Filler's q(): the first element is the one Fill writes to.
  const cssq = (/** @type {string} */ s) => s.replace(/[\\"]/g, '\\$&');
  const fieldEl = (/** @type {string} */ p) => /** @type {HTMLElement | null} */ (document.querySelector(`[ng-model="${cssq(p)}"], [data-ng-model="${cssq(p)}"]`));
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Registered once; boot() points it at the live card's render. */
  /** @type {((ch: Record<string, chrome.storage.StorageChange>) => void) | null} */
  let currentRender = null;
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local' || !(ch.packet || ch.maps)) return;
    if (!document.getElementById('sx-panel') || !currentRender) return;
    currentRender(ch);
  });

  // The SPA changes route without reload; re-pick the map on every hashchange.
  let bootedFor = '';
  const onRoute = async () => {
    const { maps } = await chrome.storage.local.get('maps');
    const map = pickMap(maps, location.host, location.hash);
    const step = routeStep(bootedFor, map ? mapId(map) : '', !!document.getElementById('sx-panel'));
    if (step.remove) document.getElementById('sx-panel')?.remove();
    bootedFor = step.bootedFor;
    if (step.boot) boot(step.boot);
  };
  window.addEventListener('hashchange', onRoute);
  // First install: maps land in storage after this page loaded.
  chrome.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch.maps && !bootedFor) onRoute(); });
  onRoute();

  function boot(/** @type {string} */ mapKey) {
    if (document.getElementById('sx-panel')) return;
    const nonce = crypto.randomUUID();
    const uiKey = `ui:${mapKey}`;
    let done = false; // a successful fill removes the packet; keep the results on screen
    /** @type {any} */ let map = null;
    /** @type {any} */ let packet;
    /** @type {number | undefined} */ let storedAt;
    /** @type {any} */ let probe = null;
    /** @type {any} */ let fill = null;
    /** @type {any} */ let check = null;
    /** @type {any} */ let view = null;
    let phase = 'loading';
    let showAll = false;
    /** top: null = vertically centred */
    const ui = { collapsed: false, top: /** @type {number | null} */ (null) };

    const root = document.createElement('div');
    root.id = 'sx-panel';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'SurveyOS Portal Fill');
    root.innerHTML = `
      <div class="sx-head" title="Drag to move up or down. Arrow keys move it, Home puts it back.">
        <span class="sx-name">SurveyOS</span><span class="sx-v sx-num"></span>
        <span class="sx-badge"></span>
        <button type="button" class="sx-toggle" aria-expanded="true" aria-controls="sx-content">Hide</button>
      </div>
      <div id="sx-content">
        <p class="sx-body"></p>
        <p class="sx-summary sx-num" tabindex="-1"></p>
        <ul class="sx-lines" aria-live="polite"></ul>
        <p class="sx-legend"></p>
        <p class="sx-hint"></p>
        <p class="sx-reassure"></p>
        <div class="sx-actions"></div>
      </div>`;
    document.body.appendChild(root);
    const $ = (/** @type {string} */ s) => /** @type {HTMLElement} */ (root.querySelector(s));
    $('.sx-v').textContent = chrome.runtime.getManifest().version;
    const head = $('.sx-head'), badge = $('.sx-badge'), toggle = $('.sx-toggle'), content = $('#sx-content');
    const body = $('.sx-body'), summary = $('.sx-summary'), lines = $('.sx-lines'), legend = $('.sx-legend');
    const hint = $('.sx-hint'), reassure = $('.sx-reassure'), actions = $('.sx-actions');

    /** @param {string} type @param {object} payload @returns {Promise<any>} */
    const ask = (type, payload) => new Promise((resolve) => {
      const onMsg = (/** @type {MessageEvent} */ ev) => {
        if (ev.source !== window || !ev.data || ev.data.sx !== nonce || ev.data.type !== `${type}:result`) return;
        clearTimeout(timer); window.removeEventListener('message', onMsg); resolve(ev.data);
      };
      const timer = setTimeout(() => {
        window.removeEventListener('message', onMsg);
        resolve({ ok: false, reason: "The portal page didn't answer. Reload the page and try again.", steps: [], files: [] });
      }, ASK_TIMEOUT_MS);
      window.addEventListener('message', onMsg);
      window.postMessage({ sx: nonce, type, ...payload }, '*');
    });

    // ---- placement: docked right, vertical position only ----
    /** Clamp `t` (null = centred) into the viewport, apply it, return the applied top. @param {number | null} t */
    const place = (t) => {
      const max = Math.max(0, innerHeight - root.offsetHeight);
      const top = Math.round(t == null ? max / 2 : Math.min(Math.max(t, 0), max));
      root.style.top = `${top}px`;
      return top;
    };
    const saveUi = () => {
      const val = ui.top == null ? { collapsed: ui.collapsed } : { collapsed: ui.collapsed, top: ui.top };
      try { chrome.storage.local.set({ [uiKey]: val }).catch(() => {}); } catch { /* context invalidated after an extension reload; position is a convenience */ }
    };
    const moveTo = (/** @type {number | null} */ t) => { const top = place(t); ui.top = t == null ? null : top; saveUi(); };
    const setCollapsed = (/** @type {boolean} */ c, /** @type {boolean} */ persist) => {
      ui.collapsed = c;
      root.classList.toggle('sx-collapsed', c);
      content.hidden = c;
      toggle.setAttribute('aria-expanded', String(!c));
      toggle.textContent = c ? 'Show' : 'Hide';
      place(ui.top);
      if (persist) saveUi();
    };

    toggle.addEventListener('click', () => setCollapsed(!ui.collapsed, true));
    root.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || ui.collapsed) return;
      e.preventDefault(); setCollapsed(true, true); toggle.focus();
    });
    head.addEventListener('keydown', (e) => { // keys reach here from the focused collapse button
      const cur = parseFloat(root.style.top) || 0;
      if (e.key === 'ArrowUp') moveTo(cur - NUDGE_PX);
      else if (e.key === 'ArrowDown') moveTo(cur + NUDGE_PX);
      else if (e.key === 'Home') moveTo(null);
      else return;
      e.preventDefault();
    });
    head.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || /** @type {Element} */ (e.target).closest('button')) return;
      const startY = e.clientY, startTop = parseFloat(root.style.top) || 0;
      head.setPointerCapture(e.pointerId);
      const onMove = (/** @type {PointerEvent} */ m) => { ui.top = place(startTop + m.clientY - startY); };
      const onUp = () => { head.removeEventListener('pointermove', onMove); head.removeEventListener('pointerup', onUp); head.removeEventListener('pointercancel', onUp); saveUi(); };
      head.addEventListener('pointermove', onMove);
      head.addEventListener('pointerup', onUp);
      head.addEventListener('pointercancel', onUp);
    });
    // ponytail: these two stay registered after a route change removes the card; isConnected makes them no-ops.
    window.addEventListener('resize', () => { if (root.isConnected) place(ui.top); });
    document.addEventListener('focusin', (e) => { // never sit on top of the portal field the surveyor is in
      const t = e.target;
      if (!root.isConnected || ui.collapsed || !(t instanceof Element) || root.contains(t)) return;
      const a = t.getBoundingClientRect(), b = root.getBoundingClientRect();
      if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) setCollapsed(true, false);
    });

    // ---- drawing: everything shown comes from cardView ----
    /** Escaped text with claim tails (…9686) wrapped so hover and screen readers get the full number. @param {string} text */
    const withTails = (text) => {
      // Bodies name the sent claim before the page's; each tail is used once, so equal tails still get their own number.
      const q = [[view.claim.packetTail, view.claim.packetFull], [view.claim.pageTail, view.claim.pageFull]].filter(([t]) => t);
      return esc(text).replace(/…[0-9A-Za-z]{1,4}/g, (m) => {
        const i = q.findIndex(([t]) => t === m);
        if (i < 0) return m;
        const full = esc(q.splice(i, 1)[0][1]);
        return `<span class="sx-num" title="${full}" aria-label="${full}">${m}</span>`;
      });
    };
    const fillText = (/** @type {HTMLElement} */ el, /** @type {string | null} */ text) => { el.textContent = text ?? ''; el.hidden = !text; };

    function draw() {
      view = cardView({ map, packet, storedAt, now: Date.now(), probe, phase, fill, check, showAll });
      const tone = view.badge.tone;
      badge.className = `sx-badge sx-${tone}`;
      badge.innerHTML = view.badge.text ? `${BADGE_ICON[tone]}<span>${esc(view.badge.text)}</span>` : '';
      body.innerHTML = withTails(view.body);
      body.hidden = !view.body;
      fillText(summary, view.summary);
      lines.innerHTML = view.lines.map((/** @type {any} */ l) => {
        const inner = `${TONE_ICON[l.tone]}<span><span class="sx-ll">${esc(l.label)}</span> ${esc(l.text)}</span>`;
        return `<li>${l.modelPath ? `<button type="button" class="sx-line sx-${l.tone}" data-path="${esc(l.modelPath)}">${inner}</button>` : `<span class="sx-line sx-${l.tone}">${inner}</span>`}</li>`;
      }).join('');
      lines.hidden = !view.lines.length;
      fillText(legend, view.legend);
      fillText(hint, view.doneHint);
      fillText(reassure, view.reassurance);
      const p = view.primary;
      actions.innerHTML = (p ? `<button type="button" class="sx-primary" data-act="${esc(p.id)}"${p.disabled ? ' disabled' : ''}${p.reason ? ' aria-describedby="sx-reason"' : ''}>${esc(p.label)}</button>` : '')
        + (p?.reason ? `<span class="sx-reason sx-bad" id="sx-reason">${ICON.x}<span>${esc(p.reason)}</span></span>` : '')
        + view.secondary.map((/** @type {any} */ s) => `<button type="button" class="sx-link" data-act="${esc(s.id)}">${esc(s.label)}</button>`).join('');
      actions.hidden = !actions.innerHTML;
      place(ui.top);
    }
    const focusResult = () => (summary.hidden ? /** @type {HTMLElement | null} */ (actions.querySelector('button:not([disabled])')) : summary)?.focus();

    async function render() {
      const stored = await chrome.storage.local.get(['packet', 'storedAt', 'maps']);
      map = stored.maps?.[mapKey];
      ({ packet, storedAt } = stored);
      if (packet && storedAt && Date.now() - storedAt > PACKET_TTL_MS) { // E6
        chrome.storage.local.remove(['packet', 'storedAt']);
        packet = undefined;
      }
      done = false; fill = null; check = null; probe = null; phase = 'loading';
      if (!map) { // boot only runs with a map, so this is a map removed under us
        badge.innerHTML = ''; body.hidden = false; body.textContent = "This page isn't supported yet.";
        for (const el of [summary, lines, legend, hint, reassure, actions]) el.hidden = true;
        return;
      }
      draw();
      probe = await ask('probe', { map });
      phase = 'idle';
      draw();
    }

    async function runFill() {
      if (!packet) return;
      phase = 'filling'; check = null; draw();
      const r = await ask('fill', { map, packet });
      phase = 'idle'; fill = r;
      if (r.ok && r.files.every((/** @type {any} */ f) => f.status === 'attached') && !r.steps.some((/** @type {any} */ s) => s.action === 'error' || s.action === 'invalid')) {
        done = true;
        packet = undefined;
        chrome.storage.local.remove(['packet', 'storedAt']); // E6
      } // else the packet stays in storage on a partial fill — let the surveyor retry
      draw(); focusResult();
    }

    async function runCheck() {
      phase = 'checking'; draw();
      const r = await ask('check', { map, packet: packet ?? null }); // expired packets were dropped in render(); planCheck picks the mode
      phase = 'idle'; fill = null; check = r;
      draw(); focusResult();
    }

    async function copyReport(/** @type {HTMLButtonElement} */ btn) {
      const label = btn.textContent;
      try {
        await navigator.clipboard.writeText(reportText(view, { mapId: mapKey, version: map.version, route: location.hash, mode: check?.mode ?? '-' }));
        btn.textContent = 'Copied';
      } catch {
        btn.textContent = "Couldn't copy";
      }
      setTimeout(() => { if (btn.isConnected) btn.textContent = label; }, COPIED_MS);
    }

    actions.addEventListener('click', (e) => {
      const btn = /** @type {HTMLButtonElement | null} */ (/** @type {Element} */ (e.target).closest('button[data-act]'));
      if (!btn || btn.disabled) return;
      const act = btn.dataset.act;
      if (act === 'fill') runFill();
      else if (act === 'retry') fill ? runFill() : render(); // fillFailed retries the fill, probeFailed re-reads the page
      else if (act === 'check') runCheck();
      else if (act === 'clear') { done = false; chrome.storage.local.remove(['packet', 'storedAt'], render); }
      else if (act === 'copy') copyReport(btn);
      else if (act === 'showAll') { showAll = !showAll; draw(); /** @type {HTMLElement | null} */ (actions.querySelector('[data-act="showAll"]'))?.focus(); }
    });

    // The one user-initiated, display-only touch on the portal (spec §10.4): scroll to the field, outline it 1.5 s, put it back.
    lines.addEventListener('click', (e) => {
      const btn = /** @type {HTMLElement | null} */ (/** @type {Element} */ (e.target).closest('button[data-path]'));
      const el = btn && fieldEl(/** @type {string} */ (btn.dataset.path));
      if (!el) return;
      const reduce = reducedMotion();
      el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      const live = pulses.get(el);
      if (live) clearTimeout(live.timer);
      const orig = live ? live.orig : el.style.outline; // a re-click keeps the first original (Fill's green/amber/red)
      el.style.outline = PULSE_OUTLINE;
      const pulsed = el.style.outline; // read back: the browser normalises the value
      const timer = setTimeout(() => {
        const back = pulseRestore(el.style.outline, pulsed, orig); // null: Fill outlined it since, leave that
        if (back != null) el.style.outline = back;
        pulses.delete(el);
      }, PULSE_MS);
      pulses.set(el, { orig, timer });
    });

    currentRender = (ch) => {
      if (keepResults(done, ch)) return; // after a good fill, only a new packet replaces the results
      render();
    };

    (async () => {
      try {
        const saved = (await chrome.storage.local.get(uiKey))[uiKey];
        if (saved) { ui.collapsed = !!saved.collapsed; ui.top = typeof saved.top === 'number' ? saved.top : null; }
      } catch { /* missing or unreadable: open, centred */ }
      setCollapsed(ui.collapsed, false);
      render();
    })();
  }
})();
