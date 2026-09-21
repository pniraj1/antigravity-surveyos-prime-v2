// extension/src/filler.js
// @ts-check
// Main world. The only place `angular` is reachable. Talks to the Panel over
// window.postMessage; never touches the page except the fields it is told to.
(() => {
  const { normaliseClaimNo, planFill } = globalThis.SxFill;
  const ng = () => /** @type {any} */ (globalThis).angular;

  const esc = (/** @type {string} */ s) => s.replace(/[\\"]/g, '\\$&');
  const q = (/** @type {string} */ p) =>
    /** @type {HTMLElement[]} */ (Array.from(document.querySelectorAll(`[ng-model="${esc(p)}"], [data-ng-model="${esc(p)}"]`)));

  function ctrlScope(/** @type {any} */ map) {
    const el = document.querySelector(`[ng-controller="${map.controller}"], [data-ng-controller="${map.controller}"]`);
    return el ? ng().element(el).scope() : null;
  }

  function $parse() { return ng().element(document.body).injector().get('$parse'); }

  function readPath(/** @type {any} */ scope, /** @type {string} */ path) {
    if (path.startsWith('sessionStorage:')) return sessionStorage.getItem(path.slice('sessionStorage:'.length));
    try { return $parse()(path)(scope); } catch { return undefined; }
  }

  function probe(/** @type {any} */ map) {
    if (!ng()) return { ok: false, reason: 'AngularJS not found on this page' };
    const scope = ctrlScope(map);
    if (!scope) return { ok: false, reason: `controller ${map.controller} not found — portal changed?` };
    const claimNo = readPath(scope, map.claimNoPath) || readPath(scope, map.claimNoFallback);
    const invoices = readPath(scope, map.invoiceCountPath);
    return { ok: true, claimNo: claimNo ? String(claimNo) : '', invoices: Array.isArray(invoices) ? invoices.length : 1 };
  }

  /** E10: write like a keystroke, through the ngModelController.
   *  Returns 'filled' | 'manual' | 'invalid:<validator names>' (the portal's own validator rejected the value).
   *  Synchronous via $apply when no digest is running so a throwing $setViewValue/$render
   *  surfaces to the caller as an 'error' step instead of vanishing into $exceptionHandler. */
  function write(/** @type {HTMLElement} */ el, /** @type {string} */ value, /** @type {string} */ kind) {
    const ctrl = ng().element(el).controller('ngModel');
    if (!ctrl) return 'manual';
    const scope = ng().element(el).scope();
    const doWrite = () => {
      ctrl.$setViewValue(value);
      ctrl.$render();
      if (kind !== 'select') el.dispatchEvent(new Event('input', { bubbles: true }));
      return ctrl.$invalid ? 'invalid:' + Object.keys(ctrl.$error || {}).join(',') : 'filled';
    };
    if (scope.$root.$$phase) { scope.$evalAsync(doWrite); return 'filled'; } // mid-digest: runs next tick, validity unknown yet
    return scope.$apply(doWrite);                                            // synchronous; throws propagate to fill()
  }

  function attachFile(/** @type {HTMLElement} */ el, /** @type {{name:string,mime:string,base64:string}} */ f) {
    const bin = atob(f.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], f.name, { type: f.mime }));
    /** @type {HTMLInputElement} */ (el).files = dt.files;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fill(/** @type {any} */ map, /** @type {any} */ packet) {
    const p = probe(map);
    if (!p.ok) return { ok: false, reason: p.reason, steps: [], files: [] };
    if (normaliseClaimNo(p.claimNo) !== normaliseClaimNo(packet.claimNo)) {
      return { ok: false, reason: `claim mismatch — page: ${p.claimNo || '(none)'}, packet: ${packet.claimNo}`, steps: [], files: [] };
    }
    const scope = ctrlScope(map);
    const read = {
      current: (/** @type {string} */ path) => {
        const el = q(path)[0];
        const c = el ? ng().element(el).controller('ngModel') : null;
        return c ? c.$modelValue : readPath(scope, path);
      },
      radioValues: (/** @type {string} */ path) => q(path).map((el) => /** @type {HTMLInputElement} */ (el).value),
    };
    const steps = planFill(map, packet, read).map((s) => {
      if (s.action !== 'fill') return s;
      const els = q(s.modelPath);
      if (!els.length) return { ...s, action: 'notFound' };
      const el = s.kind === 'radio' || s.kind === 'dateRadioOrOthers'
        ? els.find((e) => /** @type {HTMLInputElement} */ (e).value === s.value)
        : els[0];
      if (!el) return { ...s, action: 'notFound', why: 'no option with that value' };
      if (/** @type {HTMLInputElement} */ (el).disabled) return { ...s, action: 'manual', why: 'disabled on the page' };
      try {
        const r = write(el, /** @type {string} */ (s.value), s.kind);
        if (r === 'filled') { el.style.outline = '2px solid #16a34a'; return { ...s, action: 'filled' }; }
        if (typeof r === 'string' && r.startsWith('invalid:')) { el.style.outline = '2px solid #b91c1c'; return { ...s, action: 'invalid', why: r.slice(8) }; }
        return { ...s, action: 'manual', why: 'not Angular-bound' };
      } catch (e) {
        return { ...s, action: 'error', why: String(e) };
      }
    });
    for (const s of steps) if (s.action === 'kept') { const el = q(s.modelPath)[0]; if (el) el.style.outline = '2px solid #f59e0b'; }

    const files = (packet.files ?? []).map((/** @type {any} */ f) => {
      const spec = map.files?.[f.slot];
      const el = spec ? q(spec.modelPath)[0] : null;
      if (!el) return { slot: f.slot, status: 'notFound' };
      try { attachFile(el, f); return { slot: f.slot, status: 'attached' }; }
      catch (e) { return { slot: f.slot, status: 'error', why: String(e) }; }
    });
    return { ok: true, steps, files };
  }

  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || !d.sx || !d.type) return;
    try {
      if (d.type === 'probe') window.postMessage({ sx: d.sx, type: 'probe:result', ...probe(d.map) }, '*');
      if (d.type === 'fill') window.postMessage({ sx: d.sx, type: 'fill:result', ...fill(d.map, d.packet) }, '*');
    } catch (e) {
      window.postMessage({ sx: d.sx, type: `${d.type}:result`, ok: false, reason: String(e), steps: [], files: [] }, '*');
    }
  });
})();
