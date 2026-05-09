# motorsurveyos Primary Hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `motorsurveyos` the sole Firebase Hosting deploy target and replace every user-facing URL reference to `surveyos-v2-antigravity.web.app` with `motorsurveyos.web.app`.

**Architecture:** The Firebase GCP project ID (`surveyos-v2-antigravity`) is permanent infrastructure — it cannot be renamed and must stay in all Firebase SDK env vars, `projectId` fields, and auth/storage domain strings. Only the hosting site alias and user-visible URLs change. After this plan, `firebase.json` contains one hosting entry (target `motorsurveyos`), `.firebaserc` retains one hosting target alias, the CI deploy step names the target explicitly, and all in-app URL strings point to `motorsurveyos.web.app`.

**Tech Stack:** Firebase Hosting multi-site, GitHub Actions `FirebaseExtended/action-hosting-deploy@v0`, Next.js `metadata` exports

---

## Critical distinction — do NOT confuse these

| String | Type | Can change? |
|--------|------|-------------|
| `surveyos-v2-antigravity` (project ID / auth domain / storage bucket) | GCP project identity | **NO — permanent** |
| `surveyos-v2-antigravity.web.app` (old hosting URL) | Hosting site URL | **YES — replace with `motorsurveyos.web.app`** |
| `surveyos-v2-antigravity` in `.firebaserc targets` | Hosting target alias | **YES — remove the alias** |
| `surveyos-v2-antigravity` in `firebase.json` hosting array | Hosting target name | **YES — remove the entry** |

---

## File Map

| File | Change |
|------|--------|
| `firebase.json` | Remove `surveyos-v2-antigravity` target entry; keep only `motorsurveyos` |
| `.firebaserc` | Remove `surveyos-v2-antigravity` from `targets.*.hosting`; keep `default: surveyos-v2-antigravity` (project ID) |
| `src/app/landing/layout.tsx` | Lines 8, 14 — canonical and OG `url` → `motorsurveyos.web.app` |
| `src/lib/email/sendEmail.ts` | Line 39 — approval email login URL → `motorsurveyos.web.app` |
| `.github/workflows/deploy.yml` | Deploy step — add `target: motorsurveyos`; projectId line stays unchanged |
| `README.md` | Live URL references → `motorsurveyos.web.app` |

---

## Task 1: Remove the `surveyos-v2-antigravity` hosting target from firebase.json

**Files:**
- Modify: `firebase.json`

- [ ] **Step 1: Edit firebase.json — keep only the `motorsurveyos` entry**

Replace the entire file with:

```json
{
  "hosting": [
    {
      "target": "motorsurveyos",
      "public": "out",
      "cleanUrls": true,
      "ignore": [
        "firebase.json",
        "**/.*",
        "**/node_modules/**"
      ],
      "redirects": [
        { "source": "/landing",  "destination": "/", "type": 301 },
        { "source": "/landing/", "destination": "/", "type": 301 }
      ],
      "rewrites": [
        { "source": "**", "destination": "/index.html" }
      ]
    }
  ],
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

- [ ] **Step 2: Verify the file looks correct**

Run: `cat firebase.json`
Expected: single-element array with `"target": "motorsurveyos"` only.

- [ ] **Step 3: Commit**

```bash
git add firebase.json
git commit -m "chore(hosting): remove surveyos-v2-antigravity target, motorsurveyos only"
```

---

## Task 2: Remove the `surveyos-v2-antigravity` hosting alias from .firebaserc

**Files:**
- Modify: `.firebaserc`

- [ ] **Step 1: Edit .firebaserc — keep `default` (project ID), drop the old site alias**

Replace the entire file with:

```json
{
  "projects": {
    "default": "surveyos-v2-antigravity"
  },
  "targets": {
    "surveyos-v2-antigravity": {
      "hosting": {
        "motorsurveyos": [
          "motorsurveyos"
        ]
      }
    }
  },
  "etags": {}
}
```

Note: `projects.default` stays as `surveyos-v2-antigravity` — that is the GCP project identifier.
Only the `hosting.surveyos-v2-antigravity` alias inside `targets` is removed.

- [ ] **Step 2: Verify**

Run: `cat .firebaserc`
Expected: `targets` block has only `motorsurveyos` under `hosting`.

- [ ] **Step 3: Commit**

```bash
git add .firebaserc
git commit -m "chore(hosting): remove surveyos-v2-antigravity hosting alias from .firebaserc"
```

---

## Task 3: Update canonical and OG URL in landing layout

**Files:**
- Modify: `src/app/landing/layout.tsx` (lines 8, 14)

- [ ] **Step 1: Replace both URL occurrences**

In `src/app/landing/layout.tsx`, change:
```ts
// line 8
canonical: 'https://surveyos-v2-antigravity.web.app/',
// line 14
url: 'https://surveyos-v2-antigravity.web.app/',
```
To:
```ts
canonical: 'https://motorsurveyos.web.app/',
url: 'https://motorsurveyos.web.app/',
```

- [ ] **Step 2: Verify no stale URL remains in that file**

Run: `grep -n "surveyos-v2-antigravity.web.app" src/app/landing/layout.tsx`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/landing/layout.tsx
git commit -m "fix(seo): update landing canonical and OG url to motorsurveyos.web.app"
```

---

## Task 4: Update login URL in approval email template

**Files:**
- Modify: `src/lib/email/sendEmail.ts` (line 39)

- [ ] **Step 1: Replace the hardcoded URL**

In `src/lib/email/sendEmail.ts`, change line 39:
```ts
`Log in here: https://surveyos-v2-antigravity.web.app\n\n` +
```
To:
```ts
`Log in here: https://motorsurveyos.web.app\n\n` +
```

- [ ] **Step 2: Verify**

Run: `grep -n "surveyos-v2-antigravity.web.app" src/lib/email/sendEmail.ts`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/email/sendEmail.ts
git commit -m "fix(email): update approval email login URL to motorsurveyos.web.app"
```

---

## Task 5: Update CI deploy step to target motorsurveyos explicitly

**Files:**
- Modify: `.github/workflows/deploy.yml` (lines 67–74 only)

**Do NOT touch lines 30–35 or 58–64** — those are Firebase SDK env vars (project ID, auth domain, storage bucket). The `projectId: surveyos-v2-antigravity` on line 73 also stays — it is the GCP project ID required by the action.

- [ ] **Step 1: Add `target: motorsurveyos` to the deploy step**

Current deploy step (lines 67–74):
```yaml
      - name: Deploy to Firebase Hosting
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live
          projectId: surveyos-v2-antigravity
```

Replace with:
```yaml
      - name: Deploy to Firebase Hosting
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live
          projectId: surveyos-v2-antigravity
          target: motorsurveyos
```

- [ ] **Step 2: Verify no other lines were changed**

Run: `git diff .github/workflows/deploy.yml`
Expected: only one added line (`target: motorsurveyos`) in the deploy step. All env var lines unchanged.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: deploy to motorsurveyos target explicitly"
```

---

## Task 6: Update README.md URL references

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Find all stale URLs**

Run: `grep -n "surveyos-v2-antigravity.web.app" README.md`
Note the line numbers returned.

- [ ] **Step 2: Replace each occurrence**

For every line found, change `surveyos-v2-antigravity.web.app` → `motorsurveyos.web.app`.

Do NOT change lines that contain `surveyos-v2-antigravity` without `.web.app` (those are the project ID references in Firebase console URLs, which are correct as-is).

- [ ] **Step 3: Verify**

Run: `grep -n "surveyos-v2-antigravity.web.app" README.md`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: update README live URL to motorsurveyos.web.app"
```

---

## Task 7: Final audit — confirm no remaining user-facing URL leakage

- [ ] **Step 1: Grep the whole src tree for the old URL**

Run: `grep -rn "surveyos-v2-antigravity\.web\.app" src/ public/`
Expected: no output. If any hits remain, fix them before continuing.

- [ ] **Step 2: Grep for the old URL in config/doc files**

Run: `grep -rn "surveyos-v2-antigravity\.web\.app" . --include="*.json" --include="*.md" --include="*.txt" --include="*.yml" --exclude-dir=node_modules --exclude-dir=.git`
Expected: no output. Hits in `.firebaserc` are project-ID strings (no `.web.app` suffix) and are fine.

- [ ] **Step 3: Build to confirm no TypeScript errors**

Run: `npm run build`
Expected: exits 0, `out/` directory produced.

- [ ] **Step 4: Deploy to motorsurveyos only**

Run: `firebase deploy --only hosting:motorsurveyos`
Expected: deploy succeeds, URL `https://motorsurveyos.web.app` is live.

- [ ] **Step 5: Smoke-test the live site**

Visit `https://motorsurveyos.web.app` — marketing landing page loads (not a spinner).
Visit `https://motorsurveyos.web.app/login` — login form renders.
Visit `https://motorsurveyos.web.app/dashboard` — redirects to `/login` if not authenticated.

- [ ] **Step 6: Push to master**

```bash
git push origin feature/insured-claim-summary
```

The CI workflow will now build and deploy exclusively to `motorsurveyos`.

---

## Out of scope

- Renaming or deleting the `surveyos-v2-antigravity` Firebase Hosting *site* in the Firebase console — the site can be left dormant; it doesn't affect `motorsurveyos`.
- Changing `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, or `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` — these are GCP-level identifiers and are correct.
- Adding a custom domain (`motorsurveyos.com` etc.) — separate workstream.
