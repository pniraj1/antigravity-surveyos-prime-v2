# Bramha Archive-Trigger Design

## Problem

Currently, there is no Bramha Cloud Function deployed. The architecture docs describe a trigger on `isCompleted`, but this was never built. The user wants Bramha to write to `bramha_memories` only when a claim is **archived** (`isActive: false`), and archiving should only be possible when the claim is **completed** (`isCompleted: true`). This eliminates wasted Gemini API calls from toggle-complete scenarios and ensures only truly finalized claims enter the vector DB.

## Solution

Two changes:

1. **Client-side archive gate** — disable the Archive button for incomplete claims
2. **New Bramha Cloud Function** — Firestore trigger on archive transition, generates embedding, writes to `bramha_memories`

---

## Change 1: Client-Side Archive Gate

**File:** `src/components/dialogs/NewClaimDialog.tsx`

- Disable the Archive button when `isCompleted === false`
- Show message: "Complete all sections before archiving"
- Visual: dimmed button with `opacity-50`, `cursor-not-allowed`
- Existing archive flow unchanged — sets `isActive: false`, strips photos, pushes to cloud

---

## Change 2: Bramha Cloud Function

**File:** `SurveyOS-Prime/functions/bramha.js` (new file alongside existing `index.js`)

### Trigger

`onDocumentUpdated("users/{uid}/claims/{claimId}")` from `firebase-functions/v2/firestore`

### Guard Logic (Early Exit)

1. `before.isActive === true && after.isActive === false` (archive transition)
2. `after.isCompleted === true` (defense-in-depth — should always be true given client gate)
3. If either check fails → return early, no API call, no cost

### Processing Pipeline

When guard passes:

1. **Build embedding text** — concatenate into a single rich text block:
   - Vehicle: make, model, year, fuel type
   - Damage: descriptions from assessment grid (part names, damage types, repair/replace decisions)
   - Assessment: labor charges, part costs, total amounts, depreciation applied
   - Location: `placeOfAccident` from `claim.accident`
   - Assessment totals and ranges

2. **Call Gemini text-embedding-004** — 768-dimension vector via REST API using project API key from Firestore `ai_config`

3. **Write to `bramha_memories/{auto-id}`** with the following structure:

### Document Structure: `bramha_memories/{docId}`

#### Vector Field (for Firestore Vector Search)
| Field | Type | Purpose |
|-------|------|---------|
| `embedding` | vector(768) | Gemini text-embedding-004 output |

#### Embedding Source Text
| Field | Type | Purpose |
|-------|------|---------|
| `textSummary` | string | The full text that was embedded (damage + vehicle + location + assessment) |

#### Metadata — Vehicle & Assessment
| Field | Type | Purpose |
|-------|------|---------|
| `vehicleMake` | string | e.g. "Honda" |
| `vehicleModel` | string | e.g. "City" |
| `vehicleYear` | string | e.g. "2024" |
| `fuelType` | string | e.g. "Petrol" |
| `assessmentTotal` | number | Final assessment amount |
| `damageType` | string | Primary damage category |

#### Metadata — Fraud Detection (Exact-Match Queries)
| Field | Type | Purpose |
|-------|------|---------|
| `policyNumber` | string | For repeat-policy detection |
| `vehicleRegistration` | string | For repeat-vehicle detection |
| `customerName` | string | For cross-referencing |
| `customerPhone` | string | For repeat-claimant detection |
| `insuredEmail` | string | For cross-referencing |

#### Metadata — Civic / Hotspot Analysis
| Field | Type | Purpose |
|-------|------|---------|
| `placeOfAccident` | string | Free-text location from claim form |

#### Metadata — Traceability
| Field | Type | Purpose |
|-------|------|---------|
| `surveyorUid` | string | UID from trigger path |
| `sourceClaimPath` | string | `users/{uid}/claims/{claimId}` |
| `createdAt` | timestamp | Server timestamp |

### Three Intelligence Modes

1. **RAG (Vector Similarity)** — "Find similar past damage/location/vehicle patterns" via `findNearest` on the embedding field. Serves damage assessment, location clustering, and pattern detection.

2. **Fraud Detection (Exact Queries)** — "Show all claims with registration MH-12-AB-1234" via standard Firestore queries on metadata fields. Supplements RAG with definitive identity matching.

3. **Civic / Hotspot (Aggregation)** — "Which locations have the most claims?" via Firestore queries on `placeOfAccident`. Combined with RAG for semantic location clustering ("MG Road junction" ≈ "Ring Road near MG Road").

---

## Deployment

- The Cloud Function deploys from `SurveyOS-Prime/functions/` via `firebase deploy --only functions`
- Requires `firebase-functions` v2 and `firebase-admin` (already in `package.json`)
- Gemini API key reuses existing `ai_config/routing` pattern from the `callAI` function
- No new environment variables needed

## Cost

- Gemini embedding API: free tier covers ~1500 requests/minute
- Cloud Function invocation: only fires on archive transitions (a few per day at current scale)
- Firestore writes: one document per archived claim
- Estimated monthly cost: $0.00 at current scale

## Privacy Note

PII (customer name, phone, policy number, registration) is stored in metadata fields for fraud detection. The embedding text does NOT include PII — it contains only damage patterns, vehicle info, location, and assessment data. PII fields are queryable but not vectorized, limiting exposure surface.
