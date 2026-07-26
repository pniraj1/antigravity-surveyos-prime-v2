/**
 * Bramha Intelligence Engine — admin-triggered batch indexer.
 *
 * Replaces the previous onDocumentUpdated trigger, which fired on EVERY claim
 * write (every autosave) just to exit early unless it was an archive
 * transition, and swallowed all errors so failures were invisible.
 *
 * This runs only when an admin asks, embeds in batches, and RETURNS a summary
 * so a failure is something you see rather than something you don't.
 *
 * DPDP: bramha_memories deliberately stores NO personal data — no insured
 * name, phone, policy number or vehicle registration. Those live in the
 * surveyor's own claim, which `sourceClaimPath` points at. Cross-claim
 * identity matching is therefore not possible here by design; rebuild an
 * enriched index from source if a lawful basis for it ever exists.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

if (!getApps().length) initializeApp();
const db = getFirestore();

// gemini-embedding-001 defaults to 3072 dims (~24KB/claim in Firestore).
// 768 keeps the corpus ~3x smaller against the 1 GiB free tier and is plenty
// for similarity over short assessment summaries.
const EMBED_MODEL = "models/gemini-embedding-001";
const EMBED_DIMS = 768;
const EMBED_BATCH = 100;  // Gemini batchEmbedContents ceiling
const WRITE_BATCH = 400;  // Firestore hard limit is 500

// ─── Build embedding text from claim data ───
// Deliberately excludes every direct identifier — see the DPDP note above.
function buildEmbeddingText(claim) {
  const parts = [];

  const v = claim.vehicle || {};
  if (v.make || v.model) {
    parts.push(`Vehicle: ${[v.make, v.model, v.yearOfManufacture, v.fuel].filter(Boolean).join(' ')}`);
  }
  if (v.bodyType) parts.push(`Body type: ${v.bodyType}`);

  const a = claim.accident || {};
  if (a.placeOfAccident) parts.push(`Accident location: ${a.placeOfAccident}`);
  if (a.causeOfAccident) parts.push(`Cause: ${a.causeOfAccident}`);

  const rows = claim.assessmentRows || [];
  if (rows.length > 0) {
    const damages = rows.map(r => {
      const desc = [r.partName, r.type, r.action].filter(Boolean).join(' — ');
      const cost = r.assessed != null ? ` (₹${r.assessed})` : '';
      return desc + cost;
    });
    parts.push(`Damage assessment:\n${damages.join('\n')}`);
  }

  const spotRows = claim.spotDamageRows || [];
  if (spotRows.length > 0) {
    parts.push(`Spot damage:\n${spotRows.map(r =>
      [r.part, r.damage, r.action].filter(Boolean).join(' — ')
    ).join('\n')}`);
  }

  if (rows.length > 0) {
    const totalAssessed = rows.reduce((sum, r) => sum + (r.assessed || 0), 0);
    const totalDepreciation = rows.reduce((sum, r) => sum + (r.depreciation || 0), 0);
    parts.push(`Total assessed: ₹${totalAssessed}`);
    if (totalDepreciation > 0) parts.push(`Total depreciation: ₹${totalDepreciation}`);
  }

  if (claim.surveyType) parts.push(`Survey type: ${claim.surveyType}`);

  return parts.join('\n\n');
}

/**
 * One document per claim, keyed deterministically. Re-running overwrites
 * instead of duplicating, and deleting a claim's memory is a known doc id
 * rather than a query.
 */
function memoryId(uid, claimId) {
  return `${uid}__${claimId}`;
}

/** Unit-length vector — required when reducing gemini-embedding-001 below 3072. */
function normalize(vec) {
  const mag = Math.sqrt(vec.reduce((sum, x) => sum + x * x, 0));
  return mag > 0 ? vec.map(x => x / mag) : vec;
}

async function getGeminiKey() {
  const doc = await db.collection("ai_config").doc("routing").get();
  if (!doc.exists) throw new Error("ai_config/routing not found");
  const gemini = (doc.data().providers || []).find(p => p.name === "gemini");
  if (!gemini || !gemini.keys || !gemini.keys.length) {
    throw new Error("No Gemini API key found in ai_config/routing");
  }
  return gemini.keys[0];
}

/** Embed up to EMBED_BATCH texts in a single API call. */
async function embedBatch(texts, apiKey) {
  const fetch = (await import("node-fetch")).default;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${EMBED_MODEL}:batchEmbedContents?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: texts.map(text => ({
          model: EMBED_MODEL,
          content: { parts: [{ text }] },
          outputDimensionality: EMBED_DIMS,
        })),
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini batch embed failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  if (!data.embeddings || data.embeddings.length !== texts.length) {
    throw new Error(`Expected ${texts.length} embeddings, got ${data.embeddings?.length ?? 0}`);
  }
  return data.embeddings.map(e => normalize(e.values));
}

// ─── Admin-triggered rebuild ───
exports.rebuildBramhaIndex = onCall(
  { memory: "512MiB", timeoutSeconds: 3600 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");

    // Mirrors isAdmin() in firestore.rules — the flag on the caller's own profile.
    const profile = await db.doc(`users/${request.auth.uid}/profile/current`).get();
    if (!profile.exists || profile.data().isAdmin !== true) {
      throw new HttpsError("permission-denied", "Admin only.");
    }

    const force = request.data?.force === true;
    const started = Date.now();
    const stats = { scanned: 0, embedded: 0, skipped: 0, pruned: 0, failed: 0, errors: [] };

    // Completed claims across every surveyor. collectionGroup because claims
    // live under users/{uid}/claims; the Admin SDK bypasses security rules.
    const claims = await db.collectionGroup("claims").where("isCompleted", "==", true).get();
    stats.scanned = claims.size;

    // Existing memories, so a re-run only does new work and orphans are visible.
    const existing = new Set();
    const existingSnap = await db.collection("bramha_memories").get();
    existingSnap.forEach(d => existing.add(d.id));

    const pending = [];
    const liveIds = new Set();

    for (const doc of claims.docs) {
      // users/{uid}/claims/{claimId}
      const segments = doc.ref.path.split("/");
      const uid = segments[1];
      const claimId = segments[3];
      const id = memoryId(uid, claimId);
      liveIds.add(id);

      if (!force && existing.has(id)) { stats.skipped++; continue; }

      const claim = doc.data();
      const text = buildEmbeddingText(claim);
      if (!text || text.length < 20) { stats.skipped++; continue; }

      pending.push({ id, uid, claimId, claim, text });
    }

    const apiKey = pending.length > 0 ? await getGeminiKey() : null;

    for (let i = 0; i < pending.length; i += EMBED_BATCH) {
      const chunk = pending.slice(i, i + EMBED_BATCH);
      let vectors;
      try {
        vectors = await embedBatch(chunk.map(c => c.text), apiKey);
      } catch (err) {
        // One bad chunk must not abort the run — record it and continue.
        stats.failed += chunk.length;
        if (stats.errors.length < 5) stats.errors.push(err.message);
        continue;
      }

      const batch = db.batch();
      chunk.forEach((c, n) => {
        const v = c.claim.vehicle || {};
        const a = c.claim.accident || {};
        const rows = c.claim.assessmentRows || [];

        batch.set(db.collection("bramha_memories").doc(c.id), {
          embedding: FieldValue.vector(vectors[n]),
          textSummary: c.text,

          vehicleMake: v.make || '',
          vehicleModel: v.model || '',
          vehicleYear: v.yearOfManufacture || '',
          fuelType: v.fuel || '',
          assessmentTotal: rows.reduce((sum, r) => sum + (r.assessed || 0), 0),
          surveyType: c.claim.surveyType || '',
          placeOfAccident: a.placeOfAccident || '',

          // Traceability only. Personal details stay in the claim this points at.
          surveyorUid: c.uid,
          sourceClaimPath: `users/${c.uid}/claims/${c.claimId}`,
          indexedAt: FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
      stats.embedded += chunk.length;
    }

    // Drop memories whose claim no longer exists. Folds cascade-deletion into
    // the same job, so no separate onDelete trigger is needed.
    const orphans = [...existing].filter(id => !liveIds.has(id));
    for (let i = 0; i < orphans.length; i += WRITE_BATCH) {
      const batch = db.batch();
      orphans.slice(i, i + WRITE_BATCH).forEach(id =>
        batch.delete(db.collection("bramha_memories").doc(id))
      );
      await batch.commit();
      stats.pruned += Math.min(WRITE_BATCH, orphans.length - i);
    }

    return { ...stats, durationMs: Date.now() - started };
  }
);

// Exported for the self-check in bramha.test.js
exports._internal = { buildEmbeddingText, memoryId, normalize };
