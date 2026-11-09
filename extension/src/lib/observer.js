// @ts-check
/**
 * Passive blur listener for the AI SurveyOS Portal Fill learning engine.
 * Watches unmapped portal fields for surveyor input and builds semantic
 * fingerprints. Never touches passwords, CAPTCHAs, or login forms.
 *
 * Runs in the ISOLATED world (same as panel.js), delegates correlation
 * to the inverter via a simple function call.
 */
(() => {
const NS = 'SxObserver';

// ---- Helpers ----

/** Elements we must never observe. */
const SKIP_TYPES = new Set(['password', 'file', 'hidden', 'submit', 'button', 'reset', 'image']);

/** Closest ancestor matching selectors that indicate login / captcha zones. */
const UNSAFE_ANCESTORS = [
  'form[action*="login"]', 'form[action*="Login"]', 'form[action*="signin"]',
  'form[action*="authenticate"]', '[class*="captcha"]', '[id*="captcha"]',
  '[class*="Captcha"]', '[id*="Captcha"]', '[class*="CAPTCHA"]', '[id*="CAPTCHA"]',
  '[class*="otp"]', '[id*="otp"]', '[class*="OTP"]', '[id*="OTP"]',
  '[class*="login"]', '[id*="login"]', '[class*="Login"]', '[id*="Login"]',
];
const UNSAFE_SELECTOR = UNSAFE_ANCESTORS.join(', ');

/**
 * Extract the nearest visible label text for an input element.
 * Tries: explicit <label>, aria-label, aria-labelledby, placeholder,
 * preceding sibling text, parent card/section heading.
 * @param {HTMLElement} el
 * @returns {string}
 */
function extractLabel(el) {
  // 1. Explicit <label for="...">
  const id = el.id || el.getAttribute?.('name');
  if (id && typeof document !== 'undefined' && typeof CSS !== 'undefined' && CSS.escape) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label && label.textContent) return label.textContent.trim();
  }
  // 2. Wrapping <label>
  const parent = el.closest ? el.closest('label') : null;
  if (parent) {
    const text = parent.textContent?.replace(/** @type {HTMLInputElement} */(el).value || '', '').trim();
    if (text) return text;
  }
  // 3. aria-label
  const ariaLabel = el.getAttribute?.('aria-label');
  if (ariaLabel) return ariaLabel.trim();
  // 4. aria-labelledby
  const labelledBy = el.getAttribute?.('aria-labelledby');
  if (labelledBy && typeof document !== 'undefined') {
    const ref = document.getElementById(labelledBy);
    if (ref?.textContent) return ref.textContent.trim();
  }
  // 5. placeholder
  const placeholder = el.getAttribute?.('placeholder');
  if (placeholder) return placeholder.trim();
  // 6. Previous sibling or previous element that looks like a label
  let prev = el.previousElementSibling;
  if (!prev) {
    // Check parent's previous child (common: <td>Label</td><td><input></td>)
    const parentEl = el.parentElement;
    if (parentEl) prev = parentEl.previousElementSibling;
  }
  if (prev?.textContent) {
    const t = prev.textContent.trim();
    if (t.length < 100) return t;
  }
  return '';
}

/**
 * Find the nearest heading or section title above this element.
 * @param {HTMLElement} el
 * @returns {string}
 */
function nearbyHeading(el) {
  // Walk up to find a card / panel / section container with a heading
  let node = el.parentElement;
  for (let i = 0; i < 10 && node; i++, node = node.parentElement) {
    const heading = node.querySelector ? node.querySelector('h1, h2, h3, h4, h5, h6, .card-header, .panel-heading, .section-title, legend') : null;
    if (heading?.textContent) {
      const t = heading.textContent.trim();
      if (t.length < 120) return t;
    }
  }
  return '';
}

/**
 * Count the ordinal position of this element among siblings of the same tag/type.
 * @param {HTMLElement} el
 * @returns {number}
 */
function siblingIndex(el) {
  if (!el.parentElement) return 0;
  const siblings = Array.from(el.parentElement.querySelectorAll(el.tagName));
  return siblings.indexOf(el);
}

/**
 * Build a semantic fingerprint for a DOM element. The fingerprint is used to
 * re-locate the same logical field on future page loads even if IDs change.
 * @param {HTMLElement} el
 * @returns {import('./observer-types').SemanticFingerprint}
 */
function buildFingerprint(el) {
  const input = /** @type {HTMLInputElement} */ (el);
  return {
    label: extractLabel(el),
    name: el.getAttribute('name') || '',
    inputType: input.type || el.tagName.toLowerCase(),
    maxLength: input.maxLength > 0 && input.maxLength < 100000 ? input.maxLength : 0,
    nearbyText: nearbyHeading(el),
    placeholder: el.getAttribute('placeholder') || '',
    ariaLabel: el.getAttribute('aria-label') || '',
    idHint: el.id ? `#${el.id}` : '',
    siblingIndex: siblingIndex(el),
  };
}

/**
 * Should we skip observing this element?
 * @param {HTMLElement} el
 * @returns {boolean}
 */
function shouldSkip(el) {
  const input = /** @type {HTMLInputElement} */ (el);
  // Skip non-input elements
  const tag = el.tagName;
  if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return true;
  // Skip unsafe input types
  if (SKIP_TYPES.has(input.type)) return true;
  // Skip readonly / disabled
  if (input.readOnly || input.disabled) return true;
  // Skip elements inside login / captcha zones
  if (el.closest(UNSAFE_SELECTOR)) return true;
  // Skip elements that are part of the SurveyOS panel itself
  if (el.closest('#sx-panel')) return true;
  return false;
}

// ---- Fingerprint matching (for re-locating a fingerprinted element) ----

/**
 * Score how well a DOM element matches a stored fingerprint. 0–100.
 * @param {HTMLElement} el
 * @param {import('./observer-types').SemanticFingerprint} fp
 * @returns {number}
 */
function matchScore(el, fp) {
  const live = buildFingerprint(el);
  let score = 0;
  let maxScore = 0;

  // Label: highest weight (30 points)
  maxScore += 30;
  if (fp.label && live.label) {
    if (live.label.toLowerCase() === fp.label.toLowerCase()) score += 30;
    else if (live.label.toLowerCase().includes(fp.label.toLowerCase()) ||
             fp.label.toLowerCase().includes(live.label.toLowerCase())) score += 20;
  }

  // Name attribute: very stable (25 points)
  maxScore += 25;
  if (fp.name && live.name && live.name === fp.name) score += 25;

  // Input type (10 points)
  maxScore += 10;
  if (live.inputType === fp.inputType) score += 10;

  // maxLength match (10 points)
  maxScore += 10;
  if (fp.maxLength > 0 && live.maxLength === fp.maxLength) score += 10;
  else if (fp.maxLength === 0 && live.maxLength === 0) score += 5;

  // Nearby heading (10 points)
  maxScore += 10;
  if (fp.nearbyText && live.nearbyText) {
    if (live.nearbyText.toLowerCase() === fp.nearbyText.toLowerCase()) score += 10;
    else if (live.nearbyText.toLowerCase().includes(fp.nearbyText.toLowerCase())) score += 5;
  }

  // Placeholder (5 points)
  maxScore += 5;
  if (fp.placeholder && live.placeholder && live.placeholder === fp.placeholder) score += 5;

  // Aria-label (5 points)
  maxScore += 5;
  if (fp.ariaLabel && live.ariaLabel && live.ariaLabel === fp.ariaLabel) score += 5;

  // Sibling index: weak signal, tiebreaker only (5 points)
  maxScore += 5;
  if (live.siblingIndex === fp.siblingIndex) score += 5;

  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

/**
 * Find the best-matching DOM element for a stored fingerprint.
 * Returns the element if score >= threshold (default 80), else null.
 * @param {import('./observer-types').SemanticFingerprint} fp
 * @param {number} [threshold]
 * @returns {{ el: HTMLElement, score: number } | null}
 */
function findByFingerprint(fp, threshold = 80) {
  const candidates = /** @type {HTMLElement[]} */ (
    Array.from(document.querySelectorAll('input, textarea, select'))
  );
  let best = /** @type {{ el: HTMLElement, score: number } | null} */ (null);
  for (const el of candidates) {
    const s = matchScore(el, fp);
    if (s >= threshold && (!best || s > best.score)) {
      best = { el, score: s };
    }
  }
  return best;
}

// ---- Debounced blur collection ----

/** @type {Array<{fingerprint: import('./observer-types').SemanticFingerprint, typedValue: string}>} */
let blurBatch = [];
/** @type {ReturnType<typeof setTimeout> | null} */
let batchTimer = null;
const BATCH_DELAY_MS = 1000;

/** @type {((batch: Array<{fingerprint: import('./observer-types').SemanticFingerprint, typedValue: string}>) => void) | null} */
let onBatchReady = null;

/**
 * Set of model paths that are already covered by the static map.
 * Populated by the panel when it activates the observer.
 * @type {Set<string>}
 */
let mappedModelPaths = new Set();

/** @type {Set<string>} */
let mappedSelectors = new Set();

function flushBatch() {
  batchTimer = null;
  if (blurBatch.length === 0) return;
  const batch = blurBatch;
  blurBatch = [];
  if (onBatchReady) onBatchReady(batch);
}

/**
 * Handle a blur event on the portal page.
 * @param {FocusEvent} e
 */
function handleBlur(e) {
  const el = /** @type {HTMLElement} */ (e.target);
  if (!el || !(el instanceof HTMLElement)) return;
  if (shouldSkip(el)) return;

  const input = /** @type {HTMLInputElement} */ (el);
  const value = el.tagName === 'SELECT'
    ? /** @type {HTMLSelectElement} */ (el).selectedOptions[0]?.textContent?.trim() || /** @type {HTMLSelectElement} */ (el).value
    : input.value;

  // Skip empty values — nothing to correlate
  if (!value || value.trim() === '') return;

  // Skip if this element is already mapped by the static map
  // (Check by common selectors: ng-model, data-ng-model, id, name)
  const ngModel = el.getAttribute('ng-model') || el.getAttribute('data-ng-model');
  if (ngModel && mappedModelPaths.has(ngModel)) return;
  if (el.id && mappedSelectors.has(`#${el.id}`)) return;

  const fingerprint = buildFingerprint(el);
  blurBatch.push({ fingerprint, typedValue: value.trim() });

  if (batchTimer) clearTimeout(batchTimer);
  batchTimer = setTimeout(flushBatch, BATCH_DELAY_MS);
}

// ---- Public API ----

let attached = false;

/**
 * Start observing blur events on the document.
 * @param {object} opts
 * @param {Set<string>} opts.mappedPaths - Model paths from the static map
 * @param {Set<string>} opts.mappedSelectors - CSS selectors from the static map
 * @param {(batch: Array<{fingerprint: import('./observer-types').SemanticFingerprint, typedValue: string}>) => void} opts.onBatch - Called with a debounced batch of observations
 */
function startObserving(opts) {
  mappedModelPaths = opts.mappedPaths;
  mappedSelectors = opts.mappedSelectors || new Set();
  onBatchReady = opts.onBatch;
  if (!attached) {
    document.addEventListener('blur', handleBlur, true); // capture phase: catches all blurs
    attached = true;
  }
}

/** Stop observing. */
function stopObserving() {
  document.removeEventListener('blur', handleBlur, true);
  attached = false;
  if (batchTimer) { clearTimeout(batchTimer); batchTimer = null; }
  blurBatch = [];
  onBatchReady = null;
}

const API = { buildFingerprint, matchScore, findByFingerprint, shouldSkip, startObserving, stopObserving, extractLabel, nearbyHeading };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else globalThis[NS] = API;
})();
