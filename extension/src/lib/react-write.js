// @ts-check
/**
 * MAIN world. Writes into React widgets (PrimeReact, MUI date pickers) so their
 * own onChange sees the change. Never clicks any button: only a radio input.
 */
// IIFE: as a MAIN-world classic script, top-level names would be page globals.
(() => {
const NS = 'SxReact';

/** Props of the nearest fiber at or above `el` that has an onChange function. @param {any} el */
function reactProps(el) {
  const key = Object.keys(el ?? {}).find((k) => k.startsWith('__reactFiber$'));
  for (let f = key ? el[key] : null; f; f = f.return) {
    if (typeof f.memoizedProps?.onChange === 'function') return f.memoizedProps;
  }
  return null;
}

// PrimeReact's own rule: the named key, else `label`/`value`, else the option itself.
const labelOf = (/** @type {any} */ o, /** @type {string|undefined} */ k) => (k ? o?.[k] : o?.label !== undefined ? o.label : o);
const valueOf = (/** @type {any} */ o, /** @type {string|undefined} */ k) => (k ? o?.[k] : o?.value !== undefined ? o.value : o);

/**
 * Exact on value, then case-insensitive on label or value. Never partial.
 * @param {any[]} options @param {string|undefined} optionLabel @param {string|undefined} optionValue @param {string} wanted
 */
function matchOption(options, optionLabel, optionValue, wanted) {
  const w = String(wanted);
  const lw = w.toLowerCase();
  return options.find((o) => String(valueOf(o, optionValue)) === w)
    ?? options.find((o) => String(labelOf(o, optionLabel)).toLowerCase() === lw || String(valueOf(o, optionValue)).toLowerCase() === lw)
    ?? null;
}

/** Native value setter + React's value tracker, then input and change. @param {any} input @param {string} value */
function writeText(input, value) {
  const prev = input.value;
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
  if (setter) setter.call(input, value); else input.value = value;
  input._valueTracker?.setValue(prev);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return 'filled';
}

/** Calls the PrimeReact Dropdown's onChange with the matched option's value. @param {any} root @param {string} value */
function pickDropdown(root, value) {
  const props = reactProps(root);
  const opt = props ? matchOption(props.options ?? [], props.optionLabel, props.optionValue, value) : null;
  if (!props || opt === null) return 'noOption';
  const v = valueOf(opt, props.optionValue);
  props.onChange({ originalEvent: null, value: v, stopPropagation() {}, preventDefault() {}, target: { name: props.name, id: props.id, value: v } });
  return 'filled';
}

/** @param {any} input */
function clickRadio(input) {
  input.click();
  return 'filled';
}

/** MUI date field: paste the text, else type it; 'invalid:date' if neither sticks. @param {any} input @param {string} ddmmyyyy */
function writeDate(input, ddmmyyyy) {
  input.focus?.();
  try {
    const dt = new DataTransfer();
    dt.setData('text/plain', ddmmyyyy);
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  } catch { /* ponytail: paste unsupported here; writeText below is the fallback */ }
  if (input.value === ddmmyyyy) return 'filled';
  writeText(input, ddmmyyyy);
  return input.value === ddmmyyyy ? 'filled' : 'invalid:date';
}

const API = { reactProps, matchOption, writeText, pickDropdown, clickRadio, writeDate };
// ---- umd shim: classic script in the extension, ESM/CJS in Vitest ----
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else globalThis[NS] = API;
})();
