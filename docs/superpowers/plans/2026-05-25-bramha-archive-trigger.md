# Bramha Archive-Trigger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate claim archiving behind completion, and create a Bramha Cloud Function that generates Gemini embeddings for archived claims and writes them to `bramha_memories`.

**Architecture:** Two changes — (1) client-side: disable Archive button for incomplete claims in both Dashboard.tsx and NewClaimDialog.tsx, (2) server-side: new Firestore-triggered Cloud Function in `SurveyOS-Prime/functions/bramha.js` that fires on `isActive` transition `true→false`, builds a rich text summary, calls Gemini text-embedding-004, and writes the vector + metadata to `bramha_memories`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Firebase Cloud Functions v2, Firestore, Gemini text-embedding-004 API

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/layout/Dashboard.tsx` | Modify | Disable archive button + show message for incomplete claims |
| `src/components/dialogs/NewClaimDialog.tsx` | Modify | Disable archive button in ArchiveFirstScreen for incomplete claims |
| `SurveyOS-Prime/functions/bramha.js` | Create | Firestore trigger → build text → embed → write to bramha_memories |
| `SurveyOS-Prime/functions/index.js` | Modify | Re-export bramha function so Firebase discovers it |
| `SurveyOS-Prime/functions/package.json` | Modify | Add @google/generative-ai dependency |

---

### Task 1: Gate Archive Button in Dashboard

**Files:**
- Modify: `src/components/layout/Dashboard.tsx:443-466` (archive button)
- Modify: `src/components/layout/Dashboard.tsx:520-537` (archive confirmation dialog button)

The Dashboard has two places to gate:
1. The archive icon button (line 443) — should be disabled for incomplete claims
2. The "Archive Claim" confirmation button (line 520) — defense-in-depth

The `claim` object in the list has `isCompleted: boolean` (from `ClaimSlice` at `src/stores/slices/claimSlice.ts:22`).

- [ ] **Step 1: Disable the archive icon button for incomplete claims**

In `src/components/layout/Dashboard.tsx`, find the archive button (around line 443):

```tsx
<button
  onClick={(e) => {
    e.stopPropagation();
    if (claim.isActive) {
      setArchiveTarget({ id: claim.id, vehicleNo: claim.vehicleNo || 'Unknown' });
    } else {
```

Replace the `onClick` handler to add a completion check, and add disabled styling:

```tsx
<button
  onClick={(e) => {
    e.stopPropagation();
    if (claim.isActive) {
      if (!claim.isCompleted) return;
      setArchiveTarget({ id: claim.id, vehicleNo: claim.vehicleNo || 'Unknown' });
    } else {
      // Restore doesn't need confirmation
      (async () => {
        const fullClaim = await getClaim(claim.id);
        if (fullClaim) {
          await saveClaim({ ...fullClaim, isActive: true });
          const channel = new BroadcastChannel('surveyos_claims_sync');
          channel.postMessage('CLAIMS_UPDATED');
          channel.close();
          toast.success('Claim restored');
        }
      })();
    }
  }}
  className={`p-1.5 rounded-lg transition-colors ${
    claim.isActive && !claim.isCompleted
      ? 'text-gray-300 cursor-not-allowed'
      : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
  }`}
  title={
    claim.isActive
      ? claim.isCompleted
        ? "Archive Claim"
        : "Complete all sections before archiving"
      : "Restore Claim"
  }
>
  {claim.isActive ? <Archive size={16} /> : <ArchiveRestore size={16} />}
</button>
```

- [ ] **Step 2: Verify the change in browser**

Run the dev server (`npm run dev`), open the Dashboard, and verify:
- An incomplete (active, not completed) claim shows a dimmed Archive icon with tooltip "Complete all sections before archiving"
- A completed claim shows a normal Archive icon that opens the confirmation dialog
- Archived claims still show Restore icon normally

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Dashboard.tsx
git commit -m "feat(bramha): gate archive button behind claim completion in Dashboard"
```

---

### Task 2: Gate Archive in ArchiveFirstScreen (NewClaimDialog)

**Files:**
- Modify: `src/components/dialogs/NewClaimDialog.tsx:51-67` (handleArchive)
- Modify: `src/components/dialogs/NewClaimDialog.tsx:105-120` (archive button in list)

The `ArchiveFirstScreen` shows when a user hits the 50-claim limit and needs to archive one. The `activeClaims` list items come from `getAllClaims()` and have the full `ClaimData` shape (line 54: `const fullClaim = await getClaim(id)`). But the list display uses `ActiveClaimSummary` which does NOT have `isCompleted`. We need to add it.

- [ ] **Step 1: Add `isCompleted` to `ActiveClaimSummary` interface**

In `src/components/dialogs/NewClaimDialog.tsx`, find (around line 28):

```tsx
interface ActiveClaimSummary {
  id: string;
  registrationNumber: string;
  reportNo?: string;
  surveyType?: string;
  updatedAt?: string;
}
```

Replace with:

```tsx
interface ActiveClaimSummary {
  id: string;
  registrationNumber: string;
  reportNo?: string;
  surveyType?: string;
  updatedAt?: string;
  isCompleted: boolean;
}
```

- [ ] **Step 2: Pass `isCompleted` when building the active claims list**

Find both places where `ActiveClaimSummary` arrays are built (around lines 164-175 and 182-196). In each `.map()`, add `isCompleted`:

First instance (around line 168):
```tsx
.map(c => ({
  id: c.id,
  registrationNumber: c.vehicle?.registrationNumber ?? '',
  reportNo: c.reportNo,
  surveyType: c.surveyType,
  updatedAt: c.updatedAt,
  isCompleted: c.isCompleted,
}));
```

Second instance (around line 188):
```tsx
.map(c => ({
  id: c.id,
  registrationNumber: c.vehicle?.registrationNumber ?? '',
  reportNo: c.reportNo,
  surveyType: c.surveyType,
  updatedAt: c.updatedAt,
  isCompleted: c.isCompleted,
}));
```

- [ ] **Step 3: Disable Archive button for incomplete claims in the list**

Find the archive button in the list (around line 105):

```tsx
<button
  onClick={() => handleArchive(c.id)}
  disabled={archivingId === c.id}
  className="ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors flex-shrink-0"
  style={{
    borderColor: '#D4AF37',
    color: archivingId === c.id ? '#8D99AE' : '#0D1B2A',
    background: archivingId === c.id ? '#F0F2F5' : 'rgba(212,175,55,0.08)',
    cursor: archivingId === c.id ? 'not-allowed' : 'pointer',
  }}
>
  {archivingId === c.id
    ? <Loader2 size={12} className="animate-spin" />
    : <Archive size={12} />}
  {archivingId === c.id ? 'Archiving…' : 'Archive'}
</button>
```

Replace with:

```tsx
<button
  onClick={() => handleArchive(c.id)}
  disabled={archivingId === c.id || !c.isCompleted}
  className="ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors flex-shrink-0"
  style={{
    borderColor: !c.isCompleted ? '#ccc' : '#D4AF37',
    color: (archivingId === c.id || !c.isCompleted) ? '#8D99AE' : '#0D1B2A',
    background: (archivingId === c.id || !c.isCompleted) ? '#F0F2F5' : 'rgba(212,175,55,0.08)',
    cursor: (archivingId === c.id || !c.isCompleted) ? 'not-allowed' : 'pointer',
  }}
  title={!c.isCompleted ? 'Complete this claim before archiving' : undefined}
>
  {archivingId === c.id
    ? <Loader2 size={12} className="animate-spin" />
    : <Archive size={12} />}
  {!c.isCompleted ? 'Not Complete' : archivingId === c.id ? 'Archiving…' : 'Archive'}
</button>
```

- [ ] **Step 4: Verify in browser**

Open the app, create enough claims to hit the 50-claim limit (or temporarily set `ACTIVE_CLAIM_LIMIT = 2` for testing). Verify:
- Incomplete claims show disabled "Not Complete" button
- Completed claims show enabled "Archive" button
- Archiving a completed claim still works normally

- [ ] **Step 5: Commit**

```bash
git add src/components/dialogs/NewClaimDialog.tsx
git commit -m "feat(bramha): gate archive in ArchiveFirstScreen behind claim completion"
```

---

### Task 3: Create Bramha Cloud Function

**Files:**
- Create: `SurveyOS-Prime/functions/bramha.js`

This function triggers on Firestore document updates at `users/{uid}/claims/{claimId}`. It guards against non-archive events, builds a rich text summary from the claim data, calls Gemini `text-embedding-004` to generate a 768-dim vector, and writes the result to `bramha_memories`.

- [ ] **Step 1: Add `@google/generative-ai` dependency**

```bash
cd "SurveyOS-Prime/functions" && npm install @google/generative-ai
```

- [ ] **Step 2: Create `bramha.js`**

Create `SurveyOS-Prime/functions/bramha.js` with the following content:

```javascript
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
```

- [ ] **Step 3: Commit**

```bash
cd "SurveyOS-Prime/functions"
git add bramha.js
git commit -m "feat(bramha): add Cloud Function for archive-triggered embedding pipeline"
```

---

### Task 4: Wire Bramha into Functions Entry Point

**Files:**
- Modify: `SurveyOS-Prime/functions/index.js`

Firebase discovers Cloud Functions from the `main` entry point. The existing `index.js` exports `callAI`. We need to also export the Bramha function.

- [ ] **Step 1: Add bramha export to index.js**

At the bottom of `SurveyOS-Prime/functions/index.js` (after the existing `exports.callAI = ...` block, around line 135), add:

```javascript

// ─── Bramha Intelligence Engine ───
const bramha = require("./bramha");
exports.onClaimArchived = bramha.onClaimArchived;
```

- [ ] **Step 2: Verify functions load locally**

```bash
cd "SurveyOS-Prime/functions" && node -e "const f = require('./index.js'); console.log(Object.keys(f))"
```

Expected output: `[ 'callAI', 'onClaimArchived' ]`

- [ ] **Step 3: Commit**

```bash
cd "SurveyOS-Prime/functions"
git add index.js package.json package-lock.json
git commit -m "feat(bramha): wire onClaimArchived into functions entry point"
```

---

### Task 5: Deploy Cloud Function

**Files:** None (deployment step)

- [ ] **Step 1: Deploy functions to Firebase**

```bash
cd "SurveyOS-Prime" && firebase deploy --only functions
```

Expected output should show both `callAI` and `onClaimArchived` deployed successfully.

- [ ] **Step 2: Verify in Firebase Console**

Open the Firebase Console → Functions tab for project `surveyos-v2-antigravity`. Verify both functions appear:
- `callAI` (existing)
- `onClaimArchived` (new)

- [ ] **Step 3: End-to-end test**

1. Open `motorsurveyos.web.app`
2. Create a test claim, fill in vehicle details and a few assessment rows
3. Mark it as completed (toggle the checkmark)
4. Archive the claim
5. Check Firestore Console → `bramha_memories` collection — a new document should appear with the embedding vector and metadata fields

- [ ] **Step 4: Commit deployment config if changed**

```bash
git add -A && git status
```

Only commit if `firebase.json` or `.firebaserc` changed during deploy.

---

### Task 6: Deploy Client-Side Changes

**Files:** None (deployment step)

- [ ] **Step 1: Build the Next.js app**

```bash
cd "SurveyOS-Prime-V2" && npm run build
```

Expected: 0 errors, clean build.

- [ ] **Step 2: Deploy to Firebase Hosting**

```bash
firebase deploy --only hosting
```

- [ ] **Step 3: Verify on production**

1. Open `motorsurveyos.web.app`
2. Verify incomplete claims have dimmed/disabled Archive button
3. Verify completed claims can still be archived normally
4. Verify the ArchiveFirstScreen (if reachable) also shows disabled buttons for incomplete claims
