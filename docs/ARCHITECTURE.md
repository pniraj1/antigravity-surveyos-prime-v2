# SurveyOS Prime V2 — Architecture

## Overview

Static Next.js app (no server) + Firebase backend. All business logic runs client-side. Data lives in IndexedDB locally and syncs to Firestore in the background.

```
Browser
  └── Next.js (static export)
        ├── Zustand stores (in-memory state)
        ├── IndexedDB (per-user local persistence)
        └── Firebase SDK
              ├── Auth (Google Sign-In)
              └── Firestore (cloud sync)
```

---

## Authentication Flow

```
User clicks Sign In
  → signInWithPopup (Google)
  → Firebase Auth validates
  → onAuthStateChanged fires
  → initUserDB(uid)         ← opens per-user IndexedDB
  → Check Firestore profile exists?
      YES → load profile into Zustand
      NO  → create pending profile in Firestore
          → write to newSignups collection
  → setUser(user) in auth store
  → SubscriptionGuard reads profile.subscriptionStatus
      'pending'   → yellow waiting screen
      'active'    → render app
      'suspended' → red blocked screen
      'expired'   → renewal screen
```

**Logout:**
```
signOut()
  → closeUserDB()
  → resetAllState()   ← wipes all Zustand + localStorage
  → setUser(null)
```

---

## Firestore Data Model

```
users/
  {uid}/
    profile/
      current                 → SurveyorProfile
    claims/
      {claimId}               → ClaimData

newSignups/
  {uid}                       → { email, displayName, signedUpAt, status }

ai_config/
  routing                     → AI provider config (admin-only read)
```

### SurveyorProfile shape (key fields)

```typescript
{
  name: string
  email: string
  licenceNumber: string
  subscriptionStatus: 'active' | 'pending' | 'suspended' | 'expired'
  subscriptionExpiry: string | null   // ISO date or null for pending
  isAdmin: boolean
  surveyorId: string
  geminiApiKeys: string[]
  groqApiKeys: string[]
  signatureDataUrl: string | null
  stampDataUrl: string | null
  spotSequence: number
  finalSequence: number
}
```

### ClaimData shape (key fields)

```typescript
{
  id: string
  surveyType: 'spot' | 'final' | 'reinspection' | 'bill-check'
  vehicleType: 'private' | 'comm-passenger' | 'comm-goods'
  isSpotCompleted: boolean
  isCompleted: boolean
  vehicle: VehicleDetails
  driver: DriverDetails
  accident: AccidentDetails
  policy: PolicyDetails
  spotDetails: SpotSurveyDetails
  assessmentRows: AssessmentRow[]
  spotDamageRows: SpotDamageRow[]
  photos: PhotoEntry[]
  fees: FeeDetails
  billCheckRows: BillCheckRow[]
}
```

---

## State Management

All state is Zustand. Four stores:

| Store | File | Contents |
|---|---|---|
| `useAuthStore` | `stores/auth-store.ts` | Firebase user object, isAuthenticated |
| `useClaimStore` | `stores/claim-store.ts` | currentClaim, claimsList, CRUD ops |
| `useProfileStore` | `stores/profile-store.ts` | SurveyorProfile, report sequences |
| `useUIStore` | `stores/ui-store.ts` | activeTab, sidebar state, save status |

**Persistence:**
- `useProfileStore` → persists to `localStorage` (key: `surveyos-profile`)
- `useClaimStore` → persists to **IndexedDB** (per-user DB: `surveyos-v2-{uid}`)
- Cloud sync: `useCloudSync` hook pushes/pulls claims between IndexedDB and Firestore

---

## Component Tree

```
app/layout.tsx
  └── AuthSyncWrapper          ← wires auth + cloud sync hooks
        └── AuthGate           ← shows SignInScreen if not authenticated
              └── SubscriptionGuard  ← blocks if subscription not active
                    └── app/page.tsx (main dashboard)
                          ├── Sidebar
                          └── Tab content (11 tabs)
                                ├── DetailsTab
                                ├── SpotTab
                                ├── AssessmentTab
                                ├── PhotosTab
                                ├── ReportTab
                                │     └── SurveyActions (PDF/Word/Excel export)
                                ├── FeesTab
                                ├── BillCheckTab
                                ├── ReinspectionTab
                                ├── CloudVaultTab
                                ├── AdminTab (isAdmin only)
                                │     └── AdminDashboard
                                └── LearningTab (placeholder)
```

---

## Data Sync Architecture

```
User edits claim
  → Zustand (instant, in-memory)
  → IndexedDB (immediate, local)
  → useAutoSave (2s debounce)
      → Firestore (cloud, background)
```

**Conflict resolution:** Last-write-wins by `updatedAt` timestamp.

**Photos:** Stored as base64 DataURLs in IndexedDB only. Not synced to Firestore (size constraint). Risk: photos lost if device is wiped.

---

## Report Generation

All reports are built client-side from claim data.

| Report | Builder | Library |
|---|---|---|
| Spot PDF | `SpotReportDocument.tsx` | @react-pdf/renderer |
| Final PDF (Standard) | `standard-report-builder.ts` | @react-pdf/renderer |
| Final PDF (UIIC) | `uiic-final-builder.ts` | @react-pdf/renderer |
| Final Word | `word-builder.ts` | docx |
| UIIC Excel | `uiic-excel-builder.ts` | exceljs |
| Photo Sheet | `PhotoSheetDocument.tsx` | @react-pdf/renderer |
| Fee Bill | `FeeBillDocument.tsx` | @react-pdf/renderer |
| Bill Check | `BillCheckDocument.tsx` | @react-pdf/renderer |

---

## Firestore Security Rules

Location: `firestore.rules`

Key rules:
- `isAdmin()` — reads `isAdmin` flag from user's own profile doc (role-based, not hardcoded UID)
- Users can only read/write their own `users/{uid}/**` data
- `newSignups/{uid}` — user can create own entry; only admins can read/manage
- `ai_config/routing` — admin-only read/write

---

## AI Extraction Pipeline

```
User uploads document (PDF/image)
  → useAIExtraction hook
  → lib/ai/processor.ts
      → Gemini or Groq API (based on profile.aiProvider)
      → lib/ai/prompts.ts (structured extraction prompt)
  → Returns extracted fields
  → AIReviewDialog shows extracted vs existing values
  → User confirms → merged into claim data
```

---

## Deployment

- `next build` → static export to `out/`
- `firebase deploy --only hosting` → uploads `out/` to Firebase Hosting
- `firebase deploy --only firestore:rules` → deploys `firestore.rules`
- GitHub Actions (`.github/workflows/deploy.yml`) automates on `master` push
