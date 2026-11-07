# Implementation Plan: Admin Panel Surveyor Claims Count

> **Date:** 2026-11-07  
> **Paired Spec:** [`2026-11-07-admin-surveyor-claims-count-design.md`](./2026-11-07-admin-surveyor-claims-count-design.md)  
> **Target Subsystem:** Admin Dashboard — Surveyors Registry  

---

## 1. Phased Task Breakdown

### Phase 1: Data Access Layer & Unit Tests
- [ ] Create `src/lib/firebase/claims-count.ts` with `getSurveyorClaimCount(uid: string): Promise<number>`.
  - Guard empty or falsy `uid`.
  - Use `getCountFromServer(collection(db, 'users', uid, 'claims'))`.
  - Return `snapshot.data().count`.
- [ ] Write unit tests in `src/lib/firebase/__tests__/claims-count.test.ts` to verify valid count retrieval, falsy UID guard, and exception handling.

### Phase 2: UI Integration in `SurveyorsTab.tsx`
- [ ] Import `FileText` from `lucide-react`.
- [ ] Add state `claimsCountMap: Record<string, number | 'loading' | 'error'>`.
- [ ] Implement `loadClaimsCount(uid: string)` to lazily fetch and cache counts.
- [ ] Wire `loadClaimsCount` to row expansion click (`handleRowClick`).
- [ ] Insert "Claims Created" grid cell into the expanded card:
  - Loading skeleton pulse
  - Error fallback
  - Trial `0 (Untested)` amber badge
  - Non-trial `0 claims` muted text
  - Active `X claims` emerald badge
- [ ] Add unit/integration test in `src/components/admin/tabs/__tests__/` to test component behavior.

### Phase 3: Verification & Protocol Compliance
- [ ] Run `npx vitest run` on affected tests.
- [ ] Run full test suite (`npm test`).
- [ ] Run TypeScript check (`npx tsc --noEmit`).
- [ ] Verify Prime ↔ Scan coupling (None / 0 drift).
- [ ] Update `Tasks.md`, `Changelog.md`, and write session log in `Sessions/`.
