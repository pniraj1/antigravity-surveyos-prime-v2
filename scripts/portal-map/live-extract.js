// Structure-only field extractor for a live insurer portal page.
// Run: paste/run this file as a page script in the browser; the last expression
// returns a JSON string { total, groups } in the same shape as *-survey.json.
// It keeps no values: no .value/.checked/.selected, no text, no option labels.
// Only a radio's `value` attribute (an option code) is emitted. Vitest require()s it.
(() => {
  const NO_MODEL = '(no-model)';

  function describe(e) {
    const a = e.attrs;
    const model = a['data-ng-model'] || a['ng-model'];
    const type = a.type || (e.tag === 'select' ? 'select' : 'textarea');
    const required = a.required !== undefined ? (a.required || true) : (a['ng-required'] || a['data-ng-required']);
    const out = {
      name: a.name,
      id: a.id,
      type,
      model,
      value: type === 'radio' ? a.value : undefined,
      pattern: a['ng-pattern'] || a['data-ng-pattern'],
      required,
      disabled_when: a['data-ng-disabled'] || a['ng-disabled'],
      options: e.options && e.options.length ? e.options.slice() : undefined,
      hidden: e.hidden ? true : undefined,
    };
    const clean = {};
    for (const k of Object.keys(out)) if (out[k] !== undefined && out[k] !== '') clean[k] = out[k];
    return clean;
  }

  function extractFields(elements) {
    const groups = {};
    const seen = new Set();
    let total = 0;
    for (const e of elements) {
      const f = describe(e);
      const key = JSON.stringify([f.name, f.id, f.type, f.value, f.model]);
      if (seen.has(key)) continue;
      seen.add(key);
      const g = f.model ? f.model.replace(/\.[^.]*$/, '') : NO_MODEL;
      (groups[g] = groups[g] || []).push(f);
      total++;
    }
    return { total, groups };
  }

  function fromDom(doc) {
    const names = ['name', 'id', 'type', 'ng-model', 'data-ng-model', 'required', 'ng-required',
      'data-ng-required', 'ng-pattern', 'data-ng-pattern', 'ng-disabled', 'data-ng-disabled'];
    return Array.from(doc.querySelectorAll('input,select,textarea')).map((el) => {
      const attrs = {};
      for (const n of names) if (el.hasAttribute(n)) attrs[n] = el.getAttribute(n);
      if (el.type === 'radio' && el.hasAttribute('value')) attrs.value = el.getAttribute('value');
      const tag = el.tagName.toLowerCase();
      const options = tag === 'select' ? Array.from(el.options).map((o) => o.getAttribute('value') || '') : undefined;
      return { tag, attrs, options, hidden: el.closest('.ng-hide') !== null };
    });
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { extractFields }; return; }
  return JSON.stringify(extractFields(fromDom(document)));
})();
