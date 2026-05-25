/**
 * Bramha Intelligence Engine — Firestore Trigger
 *
 * Fires when a claim document is updated. If the update is an archive
 * transition (isActive: true → false) AND the claim is completed,
 * generates a Gemini embedding and writes to bramha_memories.
 */

const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

if (!getApps().length) initializeApp();
const db = getFirestore();

// ─── Build embedding text from claim data ───
function buildEmbeddingText(claim) {
  const parts = [];

  // Vehicle context
  const v = claim.vehicle || {};
  if (v.make || v.model) {
    parts.push(`Vehicle: ${[v.make, v.model, v.yearOfManufacture, v.fuel].filter(Boolean).join(' ')}`);
  }
  if (v.bodyType) parts.push(`Body type: ${v.bodyType}`);

  // Accident location
  const a = claim.accident || {};
  if (a.placeOfAccident) parts.push(`Accident location: ${a.placeOfAccident}`);
  if (a.causeOfAccident) parts.push(`Cause: ${a.causeOfAccident}`);

  // Assessment rows — damage descriptions
  const rows = claim.assessmentRows || [];
  if (rows.length > 0) {
    const damages = rows.map(r => {
      const desc = [r.partName, r.type, r.action].filter(Boolean).join(' — ');
      const cost = r.assessed != null ? ` (₹${r.assessed})` : '';
      return desc + cost;
    });
    parts.push(`Damage assessment:\n${damages.join('\n')}`);
  }

  // Spot damage rows
  const spotRows = claim.spotDamageRows || [];
  if (spotRows.length > 0) {
    const spotDamages = spotRows.map(r =>
      [r.part, r.damage, r.action].filter(Boolean).join(' — ')
    );
    parts.push(`Spot damage:\n${spotDamages.join('\n')}`);
  }

  // Assessment totals
  if (rows.length > 0) {
    const totalAssessed = rows.reduce((sum, r) => sum + (r.assessed || 0), 0);
    const totalDepreciation = rows.reduce((sum, r) => sum + (r.depreciation || 0), 0);
    parts.push(`Total assessed: ₹${totalAssessed}`);
    if (totalDepreciation > 0) parts.push(`Total depreciation: ₹${totalDepreciation}`);
  }

  // Survey type
  if (claim.surveyType) parts.push(`Survey type: ${claim.surveyType}`);

  return parts.join('\n\n');
}

// ─── Get Gemini API key from Firestore config ───
async function getGeminiKey() {
  const doc = await db.collection("ai_config").doc("routing").get();
  if (!doc.exists) throw new Error("ai_config/routing not found");
  const config = doc.data();
  const gemini = (config.providers || []).find(p => p.name === "gemini");
  if (!gemini || !gemini.keys || !gemini.keys.length) {
    throw new Error("No Gemini API key found in ai_config/routing");
  }
  return gemini.keys[0];
}

// ─── Generate embedding via Gemini REST API ───
async function generateEmbedding(text, apiKey) {
  const fetch = (await import("node-fetch")).default;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/text-embedding-004",
      content: { parts: [{ text }] },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini embedding failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.embedding.values;
}

// ─── Main Trigger ───
exports.onClaimArchived = onDocumentUpdated(
  { document: "users/{uid}/claims/{claimId}", memory: "256MiB" },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    // Guard: only proceed on archive transition
    if (!(before.isActive === true && after.isActive === false)) return;

    // Guard: only completed claims
    if (!after.isCompleted) {
      console.warn(`[Bramha] Claim ${event.params.claimId} archived but not completed — skipping.`);
      return;
    }

    const uid = event.params.uid;
    const claimId = event.params.claimId;
    console.log(`[Bramha] Processing archived claim ${claimId} for user ${uid}`);

    try {
      // 1. Build embedding text
      const text = buildEmbeddingText(after);
      if (!text || text.length < 20) {
        console.warn(`[Bramha] Claim ${claimId} — embedding text too short, skipping.`);
        return;
      }

      // 2. Get API key and generate embedding
      const apiKey = await getGeminiKey();
      const embedding = await generateEmbedding(text, apiKey);
      console.log(`[Bramha] Generated ${embedding.length}-dim embedding for claim ${claimId}`);

      // 3. Extract metadata
      const v = after.vehicle || {};
      const p = after.policy || {};
      const a = after.accident || {};
      const rows = after.assessmentRows || [];
      const totalAssessed = rows.reduce((sum, r) => sum + (r.assessed || 0), 0);

      // 4. Write to bramha_memories
      await db.collection("bramha_memories").add({
        // Vector
        embedding: FieldValue.vector(embedding),

        // Embedding source
        textSummary: text,

        // Vehicle & assessment metadata
        vehicleMake: v.make || '',
        vehicleModel: v.model || '',
        vehicleYear: v.yearOfManufacture || '',
        fuelType: v.fuel || '',
        assessmentTotal: totalAssessed,
        surveyType: after.surveyType || '',

        // Fraud detection metadata
        policyNumber: p.policyNumber || '',
        vehicleRegistration: v.registrationNumber || '',
        customerName: p.insuredName || '',
        customerPhone: p.insuredMobile || '',
        insuredEmail: '',

        // Civic / hotspot metadata
        placeOfAccident: a.placeOfAccident || '',

        // Traceability
        surveyorUid: uid,
        sourceClaimPath: `users/${uid}/claims/${claimId}`,
        createdAt: FieldValue.serverTimestamp(),
      });

      console.log(`[Bramha] Successfully wrote memory for claim ${claimId}`);
    } catch (err) {
      console.error(`[Bramha] Failed to process claim ${claimId}:`, err);
    }
  }
);
