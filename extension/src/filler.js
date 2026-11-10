// extension/src/filler.js
// @ts-check
// Main world. The only place `angular` is reachable. Talks to the Panel over
// window.postMessage; never touches the page except the fields it is told to.
(() => {
  const { normaliseClaimNo, planCheck, planFill, scopeAnchors, selectMatched } = globalThis.SxFill;
  // Surveyor copy: these reach the card's "Couldn't read page" / "Couldn't check" body.
  const NO_ANGULAR = "This page didn't load fully. Reload it and try again.";
  const NO_FIELDS = 'Page fields not found. The portal may have changed.';
  const ng = () => /** @type {any} */ (globalThis).angular;

  const esc = (/** @type {string} */ s) => s.replace(/[\\"]/g, '\\$&');
  const q = (/** @type {string} */ p) => {
    if (p.startsWith('#') || p.startsWith('.') || p.includes(' ')) {
      const el = document.querySelector(p);
      return el ? [/** @type {HTMLElement} */ (el)] : [];
    }
    return /** @type {HTMLElement[]} */ (Array.from(document.querySelectorAll(`[ng-model="${esc(p)}"], [data-ng-model="${esc(p)}"]`)));
  };

  function ctrlScope(/** @type {any} */ map) {
    if (!ng()) return null;
    if (map.controller) {
      const el = document.querySelector(`[ng-controller="${map.controller}"], [data-ng-controller="${map.controller}"]`);
      return el ? ng().element(el).scope() : null;
    }
    for (const path of scopeAnchors(map)) {
      const el = q(path)[0];
      if (el) return ng().element(el).scope();
    }
    return null;
  }

  function $parse() { return ng().element(document.body).injector().get('$parse'); }

  function readPath(/** @type {any} */ scope, /** @type {string} */ path) {
    if (path.startsWith('sessionStorage:')) return sessionStorage.getItem(path.slice('sessionStorage:'.length));
    try { return $parse()(path)(scope); } catch { return undefined; }
  }

  function probe(/** @type {any} */ map) {
    if (map?.framework === 'react') return reactProbe(map);
    if (!ng()) return { ok: false, reason: NO_ANGULAR };
    const scope = ctrlScope(map);
    if (!scope) return { ok: false, reason: NO_FIELDS };
    const claimNo = readPath(scope, map.claimNoPath) || readPath(scope, map.claimNoFallback);
    const invoices = readPath(scope, map.invoiceCountPath);
    return { ok: true, claimNo: claimNo ? String(claimNo) : '', invoices: Array.isArray(invoices) ? invoices.length : 1 };
  }

  /** E10: write like a keystroke, through the ngModelController.
   *  Returns 'filled' | 'manual' | 'invalid:<validator names>' (the portal's own validator rejected the value).
   *  Synchronous via $apply when no digest is running so a throwing $setViewValue/$render
   *  surfaces to the caller as an 'error' step instead of vanishing into $exceptionHandler. */
  function write(/** @type {HTMLElement} */ el, /** @type {string} */ value, /** @type {string} */ kind) {
    const ctrl = ng() ? ng().element(el).controller('ngModel') : null;
    if (!ctrl) {
      if (kind === 'radio') {
        /** @type {HTMLInputElement} */ (el).checked = true;
        el.dispatchEvent(new Event('click', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return 'filled';
      }
      if (kind === 'select' || el.tagName === 'SELECT') {
        const sel = /** @type {HTMLSelectElement} */ (el);
        sel.value = value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return 'filled';
      }
      const input = /** @type {HTMLInputElement} */ (el);
      const prev = input.value;
      input.value = value;
      // @ts-ignore
      const tracker = input._valueTracker;
      if (tracker) tracker.setValue(prev);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return 'filled';
    }
    const scope = ng().element(el).scope();
    const doWrite = () => {
      ctrl.$setViewValue(value);
      ctrl.$render();
      if (kind !== 'select') el.dispatchEvent(new Event('input', { bubbles: true }));
      else if (!selectMatched(/** @type {HTMLSelectElement} */ (el).selectedOptions[0]?.value)) return 'invalid:no matching option';
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
    if (map?.framework === 'react') return reactFill(map, packet);
    const p = probe(map);
    if (!p.ok) return { ok: false, reason: p.reason, steps: [], files: [] };
    if (normaliseClaimNo(p.claimNo) !== normaliseClaimNo(packet.claimNo)) {
      return { ok: false, reason: `claim mismatch — page: ${p.claimNo || '(none)'}, packet: ${packet.claimNo}`, steps: [], files: [] };
    }
    const scope = ctrlScope(map);
    const read = {
      current: (/** @type {string} */ path) => {
        const el = q(path)[0];
        const c = el && ng() ? ng().element(el).controller('ngModel') : null;
        return c ? c.$modelValue : el ? (/** @type {HTMLInputElement} */ (el)).value : readPath(scope, path);
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

      // Phase 3 Semantic AI: Dropdown Option Normalization
      if (el.tagName === 'SELECT' && typeof globalThis !== 'undefined' && globalThis.SxSemanticAI) {
        const sel = /** @type {HTMLSelectElement} */ (el);
        const directMatch = Array.from(sel.options).some(
          (o) => o.value.replace(/^(string|number|boolean):/, '') === String(s.value)
        );
        if (!directMatch) {
          const norm = globalThis.SxSemanticAI.normalizeDropdownOption(
            String(s.value),
            Array.from(sel.options, (o) => ({
              text: o.text,
              value: o.value.replace(/^(string|number|boolean):/, '')
            }))
          );
          if (norm && norm.match) {
            s.value = norm.match.value;
          }
        }
      }
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

  /** Read-only: gathers reads for planCheck. Never writes, dispatches or styles anything on the page. */
  function check(/** @type {any} */ map, /** @type {any} */ packet) {
    if (map?.framework === 'react') return reactCheck(map, packet);
    if (!ng()) return { ok: false, reason: 'AngularJS not found on this page' };
    const scope = ctrlScope(map);
    if (!scope) return { ok: false, reason: NO_FIELDS };
    const claimNo = readPath(scope, map.claimNoPath) || readPath(scope, map.claimNoFallback);
    const invoices = readPath(scope, map.invoiceCountPath);
    const ctrlOf = (/** @type {string} */ path) => { const el = q(path)[0]; return el ? ng().element(el).controller('ngModel') : null; };
    const read = {
      // undefined / [] (never a throw) for missing or unbound fields: planFill asks about those too
      current: (/** @type {string} */ path) => { const c = ctrlOf(path); return c ? c.$modelValue : undefined; },
      radioValues: (/** @type {string} */ path) => q(path).map((el) => /** @type {HTMLInputElement} */ (el).value),
      lookup: (/** @type {string} */ path) => {
        const els = q(path);
        const el = els[0]; // first element, the one Fill writes to
        if (!el) return { found: false, bound: false, disabled: false, options: null, current: undefined };
        const c = ctrlOf(path);
        const options = el.tagName === 'SELECT' ? Array.from(/** @type {HTMLSelectElement} */ (el).options, (o) => o.value.replace(/^(string|number|boolean):/, '')) // ng-options prefixes
          : /** @type {HTMLInputElement} */ (el).type === 'radio' ? els.map((e) => /** @type {HTMLInputElement} */ (e).value) : null;
        return { found: true, bound: !!c, disabled: !!(/** @type {HTMLInputElement} */ (el).disabled), options, current: c ? c.$modelValue : undefined };
      },
    };
    const pageClaimNo = claimNo ? String(claimNo) : '';
    return { ok: true, claimNo: pageClaimNo, invoices: Array.isArray(invoices) ? invoices.length : 1, ...planCheck(map, packet, pageClaimNo, read) };
  }

  // ---- React portals (OIC): PrimeReact + MUI widgets, written through SxReact ----
  const STEP2 = 'Open step 2 of this claim first.';
  const SAVED_CLAIM = 'sx-oic-claim';

  /** `label=Text` → the element the matching <label> points at (MUI date ids change per load); else a CSS selector. */
  const rq = (/** @type {string} */ p) => {
    if (!p.startsWith('label=')) return /** @type {HTMLElement[]} */ (Array.from(document.querySelectorAll(p)));
    const text = p.slice('label='.length);
    const label = /** @type {HTMLLabelElement|undefined} */ (Array.from(document.querySelectorAll('label'))
      .find((l) => (l.textContent ?? '').trim().replace(/\s*\*$/, '') === text));
    const el = label?.htmlFor ? document.getElementById(label.htmlFor) : null;
    return el ? [el] : [];
  };

  /** B1/B9: step 2's claim select, else the number saved on step 2 of this same assessment; null when neither. */
  function reactClaimNo(/** @type {any} */ map, save = true) {
    const id = sessionStorage.getItem('surveyAssessmentId');
    const sel = /** @type {HTMLSelectElement|null} */ (document.querySelector(map?.claimNoSelector ?? "select[name='claimNumber']"));
    if (sel) {
      const claimNo = String(sel.value ?? '').trim();
      if (claimNo && save) sessionStorage.setItem(SAVED_CLAIM, JSON.stringify({ id, claimNo }));
      return claimNo;
    }
    try {
      const saved = JSON.parse(sessionStorage.getItem(SAVED_CLAIM) ?? 'null');
      if (id && saved?.id === id && saved.claimNo) return String(saved.claimNo);
    } catch { /* a corrupt saved value counts as none */ }
    return null;
  }

  function reactProbe(/** @type {any} */ map) {
    const claimNo = reactClaimNo(map);
    return claimNo === null ? { ok: false, reason: STEP2 } : { ok: true, claimNo, invoices: 1 };
  }

  /** Ruling 1: a radioPick reads as the answer whose input is checked; a dropdown as its React value. */
  function reactCurrent(/** @type {string} */ path, /** @type {any} */ spec) {
    if (spec?.kind === 'radioPick') {
      return Object.keys(spec.choices ?? {}).find((k) => { const e = /** @type {HTMLInputElement|undefined} */ (rq(spec.choices[k])[0]); return e?.type === 'radio' && e.checked; }) ?? '';
    }
    const el = rq(path)[0];
    if (!el) return undefined;
    // a PrimeReact Dropdown root is a <div>: its value lives in props, not on the element
    if (spec?.kind === 'dropdown') { const props = globalThis.SxReact.reactProps(el); if (props) return props.value; }
    const input = /** @type {HTMLInputElement} */ (el);
    // an empty MUI date box shows its placeholder (DD-MM-YYYY) as its value (live 2026-11-10)
    if (input.placeholder && input.value === input.placeholder) return '';
    return isNumberBox(input) ? input.value.replace(/[₹,\s]/g, '') : input.value;
  }

  const isNumberBox = (/** @type {any} */ el) => !!el.classList?.contains('p-inputnumber-input');

  /** Disabled for a PrimeReact dropdown lives in its props or a p-disabled class, not on the <div>. */
  const reactDisabled = (/** @type {any} */ el) => !!(el.disabled || globalThis.SxReact.reactProps(el)?.disabled || el.classList?.contains('p-disabled'));

  function reactWrite(/** @type {HTMLElement} */ el, /** @type {any} */ s) {
    const W = globalThis.SxReact;
    const v = String(s.value);
    if ((s.kind === 'text' || s.kind === 'money') && isNumberBox(el)) return W.writeNumber(el, v);
    if (s.kind === 'text' || s.kind === 'money' || s.kind === 'textarea') return W.writeText(el, v);
    if (s.kind === 'dropdown') return W.pickDropdown(el, v, s.match);
    if (s.kind === 'radioPick') { const r = W.clickRadio(el); return r === 'manual' ? 'manual:not a radio input' : r; }
    if (s.kind === 'date') return W.writeDate(el, v);
    return 'manual';
  }

  // OIC's change handler spreads a stale copy of the form, so two writes in one tick lose the first
  // (live 2026-11-10). A short pause lets React re-render between writes.
  const WRITE_PAUSE_MS = 30;
  const pause = () => new Promise((r) => setTimeout(r, WRITE_PAUSE_MS));

  async function reactFill(/** @type {any} */ map, /** @type {any} */ packet) {
    const p = reactProbe(map);
    if (!p.ok) return { ok: false, reason: p.reason, steps: [], files: [] };
    if (normaliseClaimNo(p.claimNo) !== normaliseClaimNo(packet.claimNo)) {
      return { ok: false, reason: `claim mismatch — page: ${p.claimNo || '(none)'}, packet: ${packet.claimNo}`, steps: [], files: [] };
    }
    const read = { current: reactCurrent, radioValues: (/** @type {string} */ path) => rq(path).map((el) => /** @type {HTMLInputElement} */ (el).value) };
    const steps = [];
    for (const s of planFill(map, packet, read)) steps.push(await writeStep(s));
    async function writeStep(/** @type {any} */ s) {
      if (s.action !== 'fill') return s;
      const el = rq(s.kind === 'radioPick' ? s.choice : s.modelPath)[0];
      if (!el) return { ...s, action: 'notFound' };
      if (reactDisabled(el)) return { ...s, action: 'manual', why: 'disabled on the page' };
      try {
        const r = reactWrite(el, { ...s, match: map.fields?.[s.name]?.match });
        await pause();
        if (r === 'filled') { el.style.outline = '2px solid #16a34a'; return { ...s, action: 'filled' }; }
        if (r === 'noOption') { el.style.outline = '2px solid #b91c1c'; return { ...s, action: 'noOption' }; }
        if (r.startsWith('invalid:')) { el.style.outline = '2px solid #b91c1c'; return { ...s, action: 'invalid', why: r.slice(8) }; }
        return { ...s, action: 'manual', why: r.startsWith('manual:') ? r.slice(7) : `can't fill a ${s.kind} box here` };
      } catch (e) {
        return { ...s, action: 'error', why: String(e) };
      }
    }
    for (const s of steps) if (s.action === 'kept') { const el = rq(s.kind === 'radioPick' ? map.fields[s.name]?.choices?.[s.current] ?? '' : s.modelPath)[0]; if (el) el.style.outline = '2px solid #f59e0b'; }
    const files = (packet.files ?? []).map((/** @type {any} */ f) => {
      const spec = map.files?.[f.slot];
      const el = spec ? rq(spec.modelPath)[0] : null;
      if (!el) return { slot: f.slot, status: 'notFound' };
      try { attachFile(el, f); return { slot: f.slot, status: 'attached' }; }
      catch (e) { return { slot: f.slot, status: 'error', why: String(e) }; }
    });
    return { ok: true, steps, files };
  }

  /** Read-only, like check(). */
  function reactCheck(/** @type {any} */ map, /** @type {any} */ packet) {
    const claimNo = reactClaimNo(map, false);
    if (claimNo === null) return { ok: false, reason: STEP2 };
    const specOf = (/** @type {string} */ path) => Object.values(map.fields ?? {}).find((/** @type {any} */ f) => f.modelPath === path);
    const read = {
      current: reactCurrent,
      radioValues: (/** @type {string} */ path) => rq(path).map((el) => /** @type {HTMLInputElement} */ (el).value),
      lookup: (/** @type {string} */ path) => {
        const el = rq(path)[0];
        if (!el) return { found: false, bound: false, disabled: false, options: null, current: undefined };
        // ponytail: options stay null, so Check says ready? for dropdowns; a missing option shows as noOption on Fill
        return { found: true, bound: true, disabled: reactDisabled(el), options: null, current: reactCurrent(path, specOf(path)) };
      },
    };
    return { ok: true, claimNo, invoices: 1, ...planCheck(map, packet, claimNo, read) };
  }

  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || !d.sx || !d.type) return;
    try {
      if (d.type === 'probe') window.postMessage({ sx: d.sx, type: 'probe:result', ...probe(d.map) }, '*');
      if (d.type === 'check') window.postMessage({ sx: d.sx, type: 'check:result', ...check(d.map, d.packet ?? null) }, '*');
      if (d.type === 'fill') {
        const post = (/** @type {any} */ r) => window.postMessage({ sx: d.sx, type: 'fill:result', ...r }, '*');
        const r = fill(d.map, d.packet); // a Promise on React portals (paced writes)
        if (r instanceof Promise) r.then(post, (e) => post({ ok: false, reason: String(e), steps: [], files: [] }));
        else post(r);
      }
    } catch (e) {
      window.postMessage({ sx: d.sx, type: `${d.type}:result`, ok: false, reason: String(e), steps: [], files: [] }, '*');
    }
  });
})();
