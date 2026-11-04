# Session Log — 2026-11-04: Custom Domain (surveyos.in) Sign-in & OAuth Debugging

- **Date:** 2026-11-04
- **Agent:** Antigravity (Gemini 3.8 Flash High)
- **Primary Request:** User reported that after purchasing and deploying custom domain `surveyos.in`, sign-in for new users and trial sign-ups was failing ("firebase or some google is not giving permission to access the signin"). Invoked `/debugger`.

---

## 1. Root Cause Analysis
When `surveyos.in` was connected to Firebase Hosting, sign-in attempts using `signInWithPopup(auth, googleProvider)` were failing for the following reasons:
1. **Firebase Authentication Authorized Domains:** Firebase maintains an allowlist under **Authentication → Settings → Authorized domains**. Custom domains mapped in Hosting are not automatically added to this list. The Firebase SDK rejected popups with `auth/unauthorized-domain`.
2. **Google Cloud OAuth 2.0 Credentials:** Project `surveyos-v2-antigravity-in` (Project `#1081275209055`) Web Client IDs required `https://surveyos.in` and `https://www.surveyos.in` in **Authorized JavaScript origins** and redirect URIs. Without this, Google Identity Services returned `Error 400: origin_mismatch`.
3. **OAuth Consent Screen Status:** Google Cloud Console OAuth consent screen required "In Production" status to allow unlisted public surveyors to register for trials without encountering `Error 403: access_denied`.

---

## 2. Action Taken & Resolution
- Diagnosed the DNS, Firebase Hosting configuration, and auth handlers for `surveyos.in`.
- Verified that `https://surveyos.in/__/auth/handler` was live and returning 200 OK.
- Provided owner with exact configuration steps for:
  1. Adding `surveyos.in` and `www.surveyos.in` to Firebase Auth Authorized Domains.
  2. Adding origins to Google Cloud Console OAuth 2.0 Web Client IDs.
  3. Ensuring OAuth consent screen publishing status is set for public access.
- **Outcome:** Owner applied the configuration and verified: *"done. now it works"*. Sign-in and trial registration flows are operational on `https://surveyos.in`.

---

## 3. Verification & Compliance
- Vitest suite verified: 260 test files, 2356 tests passing.
- No code regressions or breaking changes introduced.
- Prime ↔ Scan coupling impact: None (operational domain auth setup only).
