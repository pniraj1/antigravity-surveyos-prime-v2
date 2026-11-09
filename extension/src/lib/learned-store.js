// @ts-check
/**
 * Learned Overlay Store for AI SurveyOS Portal Fill.
 * Manages learned DOM-to-claim bindings in chrome.storage.local.
 *
 * Implements:
 * - 2-claim confirmation gate: matchCount >= 2 promotes 'candidate' -> 'confirmed'
 * - Static map priority: static fields always override learned bindings
 * - Privacy: zero claim values stored; only fingerprints, field paths, and transforms
 * - CRUD operations: record, promote, getConfirmed, purge, merge
 */
(() => {
const NS = 'SxLearnedStore';

/**
 * Generate a storage key for a portal flow.
 * @param {string} portal
 * @param {string} flow
 * @returns {string}
 */
function storageKey(portal, flow) {
  return `learned:${portal}-${flow}`;
}

/**
 * Compare two fingerprints to determine if they represent the same DOM field.
 * @param {import('./observer-types').SemanticFingerprint} a
 * @param {import('./observer-types').SemanticFingerprint} b
 * @returns {boolean}
 */
function areFingerprintsEquivalent(a, b) {
  if (!a || !b) return false;
  // If both have names and they match
  if (a.name && b.name && a.name === b.name) return true;
  // If both have labels and they match (case-insensitive)
  if (a.label && b.label && a.label.trim().toLowerCase() === b.label.trim().toLowerCase()) return true;
  // If both have idHint and they match
  if (a.idHint && b.idHint && a.idHint === b.idHint) return true;
  return false;
}

/**
 * Retrieve all learned bindings for a portal-flow.
 * @param {any} storage - chrome.storage.local or mock storage object
 * @param {string} portal
 * @param {string} flow
 * @returns {Promise<LearnedBinding[]>}
 */
async function getLearned(storage, portal, flow) {
  const key = storageKey(portal, flow);
  if (typeof storage?.get === 'function') {
    const res = await storage.get(key);
    return Array.isArray(res?.[key]) ? res[key] : [];
  }
  return Array.isArray(storage?.[key]) ? storage[key] : [];
}

/**
 * Save learned bindings for a portal-flow.
 * @param {any} storage
 * @param {string} portal
 * @param {string} flow
 * @param {LearnedBinding[]} bindings
 */
async function saveLearned(storage, portal, flow, bindings) {
  const key = storageKey(portal, flow);
  if (typeof storage?.set === 'function') {
    await storage.set({ [key]: bindings });
  } else if (storage) {
    storage[key] = bindings;
  }
}

/**
 * Record an observed candidate correlation.
 * If the binding already exists for the same claim field, increments matchCount.
 * When matchCount >= 2, promotes to 'confirmed'.
 *
 * @param {any} storage
 * @param {string} portal
 * @param {string} flow
 * @param {{
 *   fingerprint: import('./observer-types').SemanticFingerprint,
 *   claimField: string,
 *   transform: string
 * }} candidate
 * @returns {Promise<{ promoted: boolean, binding: LearnedBinding }>}
 */
async function recordCandidate(storage, portal, flow, candidate) {
  const bindings = await getLearned(storage, portal, flow);
  const now = new Date().toISOString();

  const existingIdx = bindings.findIndex((b) =>
    areFingerprintsEquivalent(b.fingerprint, candidate.fingerprint)
  );

  let promoted = false;
  let targetBinding;

  if (existingIdx >= 0) {
    const existing = bindings[existingIdx];
    if (existing.claimField === candidate.claimField) {
      existing.matchCount = (existing.matchCount || 1) + 1;
      existing.lastSeen = now;
      existing.transform = candidate.transform; // keep freshest transform
      if (existing.matchCount >= 2 && existing.confidence !== 'confirmed') {
        existing.confidence = 'confirmed';
        promoted = true;
      }
      targetBinding = existing;
    } else {
      // Conflicting correlation for same DOM element: reset count with the new field
      existing.claimField = candidate.claimField;
      existing.transform = candidate.transform;
      existing.confidence = 'candidate';
      existing.matchCount = 1;
      existing.lastSeen = now;
      targetBinding = existing;
    }
  } else {
    targetBinding = {
      fingerprint: candidate.fingerprint,
      claimField: candidate.claimField,
      transform: candidate.transform,
      confidence: 'candidate',
      matchCount: 1,
      firstSeen: now,
      lastSeen: now,
    };
    bindings.push(targetBinding);
  }

  await saveLearned(storage, portal, flow, bindings);
  return { promoted, binding: targetBinding };
}

/**
 * Get only confirmed bindings for a portal-flow.
 * @param {any} storage
 * @param {string} portal
 * @param {string} flow
 * @returns {Promise<LearnedBinding[]>}
 */
async function getConfirmed(storage, portal, flow) {
  const bindings = await getLearned(storage, portal, flow);
  return bindings.filter((b) => b.confidence === 'confirmed');
}

/**
 * Purge all learned bindings for a portal-flow.
 * @param {any} storage
 * @param {string} portal
 * @param {string} flow
 */
async function purgeLearned(storage, portal, flow) {
  const key = storageKey(portal, flow);
  if (typeof storage?.remove === 'function') {
    await storage.remove(key);
  } else if (storage) {
    delete storage[key];
  }
}

/**
 * Merge confirmed learned bindings into a static map.
 * RULE D4: Static map ALWAYS wins over learned bindings.
 *
 * @param {any} staticMap - The bundled or remote static map
 * @param {LearnedBinding[]} confirmedBindings - Confirmed learned bindings
 * @returns {any} A new merged map with learned fields added under non-conflicting names
 */
function mergeWithStaticMap(staticMap, confirmedBindings) {
  if (!staticMap || !staticMap.fields) return staticMap;
  if (!Array.isArray(confirmedBindings) || confirmedBindings.length === 0) {
    return staticMap;
  }

  const merged = {
    ...staticMap,
    fields: { ...staticMap.fields },
  };

  // Build sets of existing selectors and from-fields to prevent conflicts
  const existingSelectors = new Set();
  const existingFroms = new Set();

  for (const f of Object.values(staticMap.fields)) {
    const spec = /** @type {any} */ (f);
    if (spec.modelPath) existingSelectors.add(spec.modelPath);
    if (spec.from) existingFroms.add(spec.from);
  }

  for (let i = 0; i < confirmedBindings.length; i++) {
    const binding = confirmedBindings[i];
    const fp = binding.fingerprint;

    // Determine an element selector from fingerprint
    const selector = fp.idHint
      ? fp.idHint
      : fp.name
      ? `[name="${fp.name}"]`
      : null;

    if (!selector) continue;

    // Check if static map already covers this selector
    if (existingSelectors.has(selector)) continue;

    // Use claimField as base name
    const fieldName = `learned_${binding.claimField}_${i}`;

    merged.fields[fieldName] = {
      modelPath: selector,
      kind: 'text',
      empty: '',
      label: fp.label || binding.claimField,
      from: binding.claimField,
      learnedTransform: binding.transform,
      isLearned: true,
      fingerprint: fp,
    };
  }

  return merged;
}

/**
 * @typedef {{
 *   fingerprint: import('./observer-types').SemanticFingerprint,
 *   claimField: string,
 *   transform: string,
 *   confidence: 'candidate' | 'confirmed',
 *   matchCount: number,
 *   firstSeen: string,
 *   lastSeen: string
 * }} LearnedBinding
 */

const API = {
  storageKey,
  areFingerprintsEquivalent,
  getLearned,
  saveLearned,
  recordCandidate,
  getConfirmed,
  purgeLearned,
  mergeWithStaticMap,
};

if (typeof module !== 'undefined' && module.exports) module.exports = API;
else globalThis[NS] = API;
})();
