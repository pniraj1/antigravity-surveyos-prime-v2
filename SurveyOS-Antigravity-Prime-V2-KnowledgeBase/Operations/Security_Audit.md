# Security Audit Report — 2026-04-13

**Auditor:** Claude Code (Sonnet 4.6)
**Scope:** Firebase config, Firestore rules, XSS, API key handling, auth, input validation
**Result:** 3 Criticals fixed & deployed. 9 issues pending.

---

## Quick Status

| Severity | Total | Fixed | Pending |
|----------|-------|-------|---------|
| 🔴 CRITICAL | 3 | ✅ 3 | 0 |
| 🟠 HIGH | 4 | 0 | ⏳ 4 |
| 🟡 MEDIUM | 5 | 0 | ⏳ 5 |
| 🟢 LOW | 3 | 0 | ⏳ 3 |

---

## ⚠️ One Manual Action Still Required

**Rotate the Firebase API key — this has NOT been done yet.**

The key `AIzaSyCimnYVKZ0n-iX8MOHO2f3TP3GoBvNMqpk` was hardcoded in source code and committed to git history. The code fix is deployed but the key itself is still valid.

**Steps to complete:**
1. Firebase Console → Project Settings → General → Web API Key → **Regenerate**
2. Update `.env.local` with new key
3. Update `.env.production` with new key
4. Run `npm run build && firebase deploy --only hosting`

---

## 🔴 CRITICAL — All Fixed & Deployed

### C-1 — XSS via `dangerouslySetInnerHTML`
**File:** `src/components/tabs/ReportTab.tsx` lines 261, 264
**Fixed:** Added `DOMPurify.sanitize()` wrapping both calls.

Raw HTML from `buildStandardFinalSurveyHTML()` and `buildUIICFinalHTML()` was injected into the DOM without sanitization. A surveyor entering `<script>alert(1)</script>` in any claim text field would execute JavaScript.

```tsx
// Before (vulnerable)
<div dangerouslySetInnerHTML={{ __html: buildStandardFinalSurveyHTML(...) }} />

// After (safe)
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(buildStandardFinalSurveyHTML(...)) }} />
```

---

### C-2 — Hardcoded Firebase API Key in Source Code
**File:** `src/lib/firebase/config.ts` line 11
**Fixed:** Hardcoded value removed. Key moved to `.env.local` and `.env.production` (both gitignored).

```typescript
// Before (key in git)
apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCimnYVKZ0n-...',

// After (env only, fails loudly if missing)
apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
// + startup check: if (!firebaseConfig.apiKey) throw new Error(...)
```

**New files created (both gitignored via `.env*` in .gitignore):**
- `.env.local` — local development
- `.env.production` — production builds

---

### C-3 — Master AI API Keys Readable by All Users
**File:** `firestore.rules`
**Fixed & deployed to Firestore.**

The `ai_config/routing` document stores master Gemini/Groq API keys. It was readable by any logged-in user.

```javascript
// Before (any authenticated user could read master API keys)
match /ai_config/routing {
  allow read: if request.auth != null;
  allow write: if false;
}

// After (admin only)
match /ai_config/routing {
  allow read, write: if isAdmin();
}
```

---

## 🟠 HIGH — Pending

### H-1 — Surveyor API Keys Synced to Firestore in Plaintext
**File:** `src/lib/firebase/sync.ts` → `pushProfileToCloud()`

`geminiApiKeys[]`, `groqApiKeys[]` are included in the profile pushed to Firestore. Visible to anyone with Firebase Console access.

**Fix:** Strip keys before sync (same pattern already used for `signatureDataUrl`):
```typescript
const {
  signatureDataUrl: _sig, stampDataUrl: _stamp,
  geminiApiKey: _gk, geminiApiKeys: _gks,
  groqApiKey: _rk, groqApiKeys: _rks,
  ...cloudProfile
} = profile as any;
```

---

### H-2 — Master Admin UID Hardcoded in Client Bundle
**File:** `src/components/layout/sidebar.tsx` line 242

`const MASTER_ADMIN_UID = 'QCgRlZdGF3etljVitH8xq3KsTqB2'` is visible in DevTools. Tells an attacker exactly which Google account to target for full database access.

**Fix:** Remove from sidebar. Set `isAdmin: true` once in Firestore for the admin profile. The UID stays only in `firestore.rules` (server-side — acceptable).

---

### H-3 — No Input Sanitization Before AI Prompt Injection
**Files:** `src/lib/ai/service.ts`, `src/lib/ai/prompts.ts`

Claim text fields (cause of accident, descriptions) go directly into AI prompts. Prompt injection possible.

**Fix:**
```typescript
function sanitizeForPrompt(input: string): string {
  return input.replace(/ignore previous instructions/gi, '').slice(0, 500);
}
```

---

### H-4 — `console.log` Leaks UIDs and Internal Data in Production
**Files:** `sync.ts`, `useCloudSync.ts`, `useAutoSave.ts` (30+ instances)

Firebase UIDs, claim IDs, sync events all visible in DevTools console in production.

**Fix:** Dev-only logger:
```typescript
const isDev = process.env.NODE_ENV === 'development';
const log = isDev ? console.log : () => {};
```

---

## 🟡 MEDIUM — Pending

### M-1 — No File Type Validation on Uploads
`file.type` (user-controlled) used without validating actual file bytes (magic bytes check).

### M-2 — BroadcastChannel Accepts Unvalidated Messages
No schema validation on `surveyos_claims_sync` messages. Should whitelist event types.

### M-3 — Firestore Wildcard Too Broad
`match /users/{userId}/{allPaths=**}` — no field validation, no document size limits.

### M-4 — Profile Path Inconsistency ⚠️ May Cause Silent Failures
`sync.ts` writes profile to `users/{uid}/profile/main`
`AdminDashboard.tsx` reads/writes `users/{uid}/profile/current`

**Impact:** Admin subscription suspensions may write to the wrong document and silently fail.

### M-5 — No Rate Limiting on AI API Calls
Unlimited AI extraction per session. Could exhaust all API keys rapidly.

---

## 🟢 LOW — Pending

### L-1 — Firebase Config in NEXT_PUBLIC_ Vars
Acceptable by Firebase design. Security is enforced by rules, not key secrecy.

### L-2 — No Content Security Policy Headers
Add to `firebase.json`:
```json
{
  "key": "Content-Security-Policy",
  "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://*.googleapis.com https://api.groq.com https://generativelanguage.googleapis.com;"
}
```

### L-3 — No Clickjacking Protection
No `X-Frame-Options` header. App can be embedded in iframes.

---

## Fix Priority Order for Next Session

| Priority | Task | Effort |
|----------|------|--------|
| 🔴 Now | Rotate Firebase API key (manual) | 5 min |
| 🟠 This week | H-1: Strip API keys from Firestore sync | 30 min |
| 🟠 This week | H-4: Dev-only console logger | 30 min |
| 🟠 This week | H-2: Remove master UID from sidebar.tsx | 20 min |
| 🟡 Next sprint | M-4: Fix profile path (main vs current) | 1 hr |
| 🟡 Next sprint | L-2: Add CSP headers to firebase.json | 30 min |
| 🟡 Next sprint | M-3: Firestore field validation in rules | 2 hrs |
| 🟡 Next sprint | H-3: AI prompt input sanitization | 1 hr |

---

## Environment Files Reference

| File | Gitignored | Purpose |
|------|-----------|---------|
| `.env.local` | ✅ Yes | Local dev — contains API key |
| `.env.production` | ✅ Yes | Production builds — contains API key |

Both files must be manually kept on each machine. After rotating the API key, update both.
