# UI Refactor — Workflow Guardrails

> Pre-refactor audit (2026-06-21, Claude). Read BEFORE any UI restyle/restructure.
> Goal: improve the UI without disrupting the claim workflow or the generated reports.

## TL;DR
- ✅ **SAFE:** Report output (PDF / print / Word / Excel) is fully isolated from app styling. A token/Tailwind restyle CANNOT change generated reports — as long as `src/components/pdf/*`, `src/components/print/*`, and `src/lib/reports/*` are NOT touched.
- ⚠️ **RISKY:** Navigation & routing. Tab IDs are a URL contract; `useRouteSync` is race-guarded. A pure restyle is safe; a RESTRUCTURE needs care here.

---

## 1. Reports are isolated — keep it that way (CRITICAL)
- **PDF:** all 8 documents in `src/components/pdf/*` use react-pdf `StyleSheet.create` — its own engine, ignores CSS/Tailwind/CSS-vars.
- **Print/HTML:** self-contained inline styles + own `<style>` / `@page` / Barlow font + `getHtmlScale()`. Verified: **0 matches** for `var(--)` or semantic Tailwind classes in `src/components/print`.
- **Word/Excel:** docx / exceljs generate files programmatically.
- **Guardrail:** restyle the app shell + tabs/forms ONLY. Do not edit `components/pdf`, `components/print`, `lib/reports` during the restyle. Verify a generated Final + Spot report (PDF + print preview) is byte-identical before/after.

## 2. Tab IDs are a URL contract (restructure risk)
- Canonical list: `AppTab` union in `src/stores/ui-store.ts`.
- `useRouteSync` writes them to `?tab=` / `?claim=` and casts the raw URL string back to `AppTab`. Renaming/removing an ID breaks bookmarks, reload-restore, and Back/Forward.
- If restructuring nav: **preserve existing IDs** (or add an alias/redirect map).
- `'learning'` is in `AppTab` + the sidebar nav but has **no handler** in `TabPlaceholder` → dead item ("Coming soon"). Safe to remove from nav.

## 3. `useRouteSync` is fragile (restructure risk)
- Two effects (URL→Store, Store→URL) guarded by `syncingFromUrl` + `initializedRef`; the stale-URL guard depends on `closeClaim()` setting `UIStore.currentClaimId = null` synchronously.
- `activeTab` is deliberately **NOT persisted** (`partialize` excludes it) — derived from the URL each load to avoid rehydration loops. **Do not persist `activeTab`.**
- The dashboard row-click sets `currentClaimId` synchronously BEFORE the async `getClaim` — preserve that ordering.
- **Guardrail:** restyle must not touch this hook; restructure must keep these semantics.

## 4. Navigation business logic lives in `sidebar.tsx` (restructure risk)
- Survey-type filtering (spot/final/valuation hide specific tabs) and `requiresClaim` gating are implemented inline in `sidebar.tsx`. If nav is replaced, this logic must move with it, not be lost.

## 5. Cross-tab sync contract (both)
- `BroadcastChannel('surveyos_claims_sync')` + message `'CLAIMS_UPDATED'` used in 7 files (Dashboard, NewClaimDialog, useClaimsLoader, firebase/sync, storage/indexeddb, drive/index, BankReconcileDialog). Keep the name + message; keep posting on save/archive/delete if the dashboard/claim-list is rebuilt.

## 6. Persistence keys are contracts (both)
- localStorage `surveyos-ui-storage` (partialized: `sidebarCollapsed`, `currentClaimId`, `isDriveConnected`, `driveEmail`).
- IndexedDB `DB_VERSION = 4`: stores `claimMeta`, `claims`, `tombstones`, `pushedAt`, `driveFileCache`.
- sessionStorage `evidence_${claimId}_${docType}` (AI evidence viewer; cleared on archive).
- Don't rename keys or change shapes without a migration.

## 7. Gating wraps everything (both)
- `SubscriptionGuard` (states: pending/trial/active/readonly/expired/suspended) + `AuthGate` + `/access-request` redirect. The readonly overlay MUST keep blocking edits. Restyle the overlays carefully; never change the gating LOGIC.

## 8. Styling reality (restyle scope)
- Three methods coexist: Tailwind utilities, CSS-var tokens (`globals.css`), and inline hardcoded hex. The restyle = migrate inline hex → tokens in the shell + tabs.
- Decorative/luxury classes (`bg-mesh-gradient`, `transform-3d-dashboard`, `btn-gold`, `card-premium`, `bg-tech-grid`) are isolated to `landing/page.tsx` + `globals.css`. `.ai-filled` is defined but unused in `src`. Removing/relocating decoration is low-risk.
- Six near-identical grays in use (`#F0F2F5` `#F8F9FA` `#FAFAFA` `#FAFBFC` `#E2E6EA` `#E8ECF0`) → collapse into one neutral ramp.

## 9. Component / runtime constraints (both)
- Every tab is a dynamic import with `ssr:false` (browser-only APIs). Any new shell/route must keep `'use client'` + `ssr:false` for tab content.
- Static export (`output:'export'`, `trailingSlash`). No server routes — nav stays client-side. `/landing` is a separate route.
- Global chrome: `ClaimHeader` (always present) + `FloatingReportPreview` (all tabs except Reports). Account for both in any layout change.

---

## Verification checklist (before merging ANY UI change)
- [ ] Generate a Final + Spot report (PDF + print preview) — unchanged.
- [ ] Open a claim → reload the page → same tab + claim restored.
- [ ] Browser Back/Forward navigates correctly.
- [ ] Create / archive / delete a claim → dashboard updates in another open tab.
- [ ] Spot vs Final vs Valuation show the correct tab set.
- [ ] Subscription readonly / suspended overlays still block editing.
- [ ] Existing vitest suite green; visual screenshot diff reviewed.

---
*Scope note: this audit traced the workflow-critical coupling points a UI change could break — not a line-by-line review of all ~150 components.*
