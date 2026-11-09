/**
 * SurveyOS Cloud Sync for AI Portal Fill.
 * Persists learned field mappings to the surveyor's cloud profile in Firestore,
 * and contributes anonymous structural fingerprints to the SurveyOS consensus engine.
 *
 * ZERO-PII RULE:
 * Only (portal, flow, fingerprint, claimField, transform) are ever saved.
 * No claim numbers, names, dates, or financial figures are transmitted.
 */
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './config';

export interface CloudPortalBinding {
  claimField: string;
  transform: string;
  fingerprint: {
    label: string;
    name: string;
    inputType: string;
    maxLength: number;
    nearbyText: string;
    placeholder: string;
    ariaLabel: string;
    idHint: string;
    siblingIndex: number;
  };
  matchCount: number;
  confidence: 'candidate' | 'confirmed';
  lastSeen: string;
}

/**
 * Fetch a surveyor's cloud-persisted portal learnings from Firestore.
 */
export async function getCloudPortalLearnings(
  uid: string,
  portal: string,
): Promise<CloudPortalBinding[]> {
  if (!uid || !portal || !db) return [];
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'portalLearnings', portal));
    if (snap.exists()) {
      const data = snap.data();
      return Array.isArray(data?.bindings) ? data.bindings : [];
    }
  } catch (err) {
    console.warn('[PortalSync] Failed to fetch cloud portal learnings:', err);
  }
  return [];
}

/**
 * Persist a surveyor's confirmed portal bindings to Firestore.
 */
export async function saveCloudPortalLearnings(
  uid: string,
  portal: string,
  flow: string,
  bindings: CloudPortalBinding[],
): Promise<boolean> {
  if (!uid || !portal || !db || !Array.isArray(bindings)) return false;
  try {
    const ref = doc(db, 'users', uid, 'portalLearnings', portal);
    await setDoc(
      ref,
      {
        portal,
        flow,
        bindings,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    return true;
  } catch (err) {
    console.error('[PortalSync] Failed to save cloud portal learnings:', err);
    return false;
  }
}

/**
 * Submit anonymous structural consensus telemetry.
 * When multiple surveyors confirm the same fingerprint -> claimField,
 * SurveyOS flags it as verified community knowledge.
 */
export async function submitConsensusTelemetry(
  portal: string,
  flow: string,
  binding: CloudPortalBinding,
  surveyorHash: string,
): Promise<void> {
  if (!portal || !flow || !db || !binding?.claimField) return;
  try {
    const key = `${portal}_${flow}`;
    const ref = doc(db, 'portalConsensus', key);
    const snap = await getDoc(ref);
    const existing = snap.exists() ? snap.data() : { rules: {} };
    const ruleKey = binding.fingerprint.name || binding.fingerprint.idHint || binding.fingerprint.label;

    if (!ruleKey) return;

    const currentRule = existing.rules?.[ruleKey] || {
      claimField: binding.claimField,
      transform: binding.transform,
      fingerprint: binding.fingerprint,
      contributors: [],
      verified: false,
    };

    if (!currentRule.contributors.includes(surveyorHash)) {
      currentRule.contributors.push(surveyorHash);
    }

    // Community consensus gate: ≥ 3 distinct surveyors confirm
    if (currentRule.contributors.length >= 3) {
      currentRule.verified = true;
    }

    await setDoc(
      ref,
      {
        portal,
        flow,
        rules: {
          ...existing.rules,
          [ruleKey]: currentRule,
        },
        lastUpdated: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch (err) {
    // Non-blocking background telemetry
    console.warn('[PortalSync] Consensus submission note:', err);
  }
}
