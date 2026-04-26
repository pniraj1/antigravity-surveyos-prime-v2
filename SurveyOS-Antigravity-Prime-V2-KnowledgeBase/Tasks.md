# Project Tasks & State

> **AI INSTRUCTION**: This file is our External Chat History and Task List. Update this file instead of letting the chat history grow infinitely.
> If the chat history gets long and begins to exceed token limits, the AI must summarize current status here, and prompt the user to "clear chat context and start a new session."

---

## ⚠️ Immediate Action Required

- [ ] **Rotate Firebase API key** — old key was hardcoded in source, committed to git, now removed from code but key still valid in Firebase
  1. Firebase Console → Project Settings → General → Web API Key → Regenerate
  2. Update `.env.local` and `.env.production` with new key
  3. `npm run build && firebase deploy --only hosting`
- [ ] **Commit today's changes** — large batch of uncommitted work from 2026-04-26 session (see [[Sessions/2026-04-26]])

---

## Current Objective
✅ AI Controls (model selector, doc mode toggle, provider toggle) now on both Documents + Assessment tabs. Next: Security hardening backlog + commit staged changes.

## 🔐 Security Backlog
> Full details: [[Security_Audit_2026-04-13]]

### ✅ Fixed & Deployed (2026-04-13)
- [x] C-1: XSS — DOMPurify added to `dangerouslySetInnerHTML` in ReportTab.tsx
- [x] C-2: Hardcoded Firebase API key removed from config.ts → .env files
- [x] C-3: Firestore `ai_config/routing` locked to admin-only

### 🟠 High Priority (This Week)
- [ ] H-1: Strip `geminiApiKeys[]` / `groqApiKeys[]` from Firestore profile sync
- [ ] H-2: Remove hardcoded master UID from sidebar.tsx client bundle
- [ ] H-4: Replace 30+ `console.log` calls with dev-only logger

### 🟡 Medium Priority (Next Sprint)
- [ ] M-4: Fix profile path — sync.ts writes `profile/main`, AdminDashboard reads `profile/current`
- [ ] L-2: Add CSP headers to firebase.json
- [ ] M-3: Firestore field-level validation + doc size limits
- [ ] H-3: Sanitize claim text before injecting into AI prompts

---

## ✅ Completed (2026-04-26)
- [x] **Sandbox feature removed** — `/sandbox/mapper` was live in production, deleted all 5 source files, fixed leftover refs in layout.tsx and processor.ts
- [x] **Gemini model list cleaned** — static list trimmed to 3 stable models only (2.5 Pro, 2.5 Flash, 2.5 Flash-Lite); live fetch filter strips TTS/image/live/robotics/experimental models
- [x] **Text/Vision mode toggle** — `DocModeToggle` (Auto/Text/Vision) wired through profile store → useAIExtraction → extractDocument; persists across sessions
- [x] **AI controls on Assessment tab** — ProviderToggle + DocModeToggle + ModelSelector + ProviderHealthBadge added; DocumentsTab uses same shared `AIControls.tsx`
- [x] **60-second extraction timeout removed** — large PDFs were silently failing; queue now waits as long as the API needs
- [x] **Obsidian session logging established** — Sessions/ folder created, daily logs written by AI at end of each session

---

## ✅ Completed This Session (2026-04-12 – 2026-04-13)

### Features
- [x] Archive tab with count badge
- [x] Dashboard stats (claimsToday, claimsWeek, claimsPending, archivedCount)
- [x] Fees Overview: Billed / Received / Outstanding
- [x] Bank statement reconciliation (PDF/CSV upload → AI extract → auto-match)
- [x] Fee paid toggle in FeesTab
- [x] Report number at top of DetailsTab for all survey types
- [x] Spot/Final sequential report numbers: SPO/YYYY/NNN, FIN/YYYY/NNN
- [x] Spot report certification text updated in all 3 formats (HTML, Word, PDF)
- [x] FIR Date + Appointment Date added to all 3 spot report formats
- [x] Document Verification section (7 docs) added to all 3 spot report formats
- [x] AccidentForm deduplication: removed pincode, locationCode, remarks
- [x] SpotTab deduplication: removed placeOfSurvey, verificationFlags
- [x] Admin panel fixed: now accessible via master UID regardless of isAdmin flag
- [x] Knowledge base vault structured and populated
- [x] **Reinspection Report Polish** — Removed 'Est. Completion Date' and 'Repair Auth.' from UI, HTML Power Print, and UIIC PDF format.
- [x] **Project ID Research** — Verified `surveyos.web.app` and `surveyosprime.web.app` are taken; recommended custom domain approach.


### Security (2026-04-13)
- [x] Full security audit performed
- [x] XSS vulnerability fixed (DOMPurify)
- [x] API key removed from source code
- [x] Firestore AI config rule locked to admin

### Deployments
- [x] `npm run build && firebase deploy --only hosting,firestore:rules`
- [x] Live: https://surveyos-v2-antigravity.web.app
- [x] **Cloud Sync Distinction Documented** — Created `Cloud_Sync_Logic.md` to formalize the difference between high-bandwidth asset pushes (photos/docs) and critical system backups (keys/stamps).

---

## Key Decisions Made This Session

1. **All 3 spot report formats must stay identical** — SpotPrintReport.tsx is source of truth
2. **4 report renderers exist** (UIIC, Standard, Word, PDF) — only spot reports have parity enforcement
3. **Pincode removed from AccidentForm** — used in UIIC reports but not spot; acceptable trade-off
4. **Admin access = isAdmin flag OR master UID** — prevents access loss if Firestore profile resets
5. **Report numbers stay local** — localStorage only, not synced to Firestore, reset yearly
6. **Dual storage (IndexedDB + Firestore)** — not offline-first, just resilience for photo handling
7. **Cloud Sync Distinction** — "Auto Push Files" toggle ONLY applies to photos and documents. Critical profile data (API keys, stamps, signatures) is ALWAYS backed up to `surveyos_profile_backup.json` to ensure system state persistence.

---

## Blockers / Open Questions
- [ ] Should pincode be restored for UIIC report support?
- [ ] Should Standard and UIIC report formats also get parity enforcement?
- [ ] Should report numbers sync to Firestore for multi-device access?
- [ ] What is next priority feature after security hardening?

