# Token Optimization Guide for Development

> **Purpose**: Concrete DO's and DON'Ts that prevent token waste during active development. Use this checklist every session.

---

## HIGHEST IMPACT: Use Graphify Instead of File Scanning

### ✅ DO: Use Graphify Query Tools

**Before reading ANY source file, run graphify queries:**

```typescript
// When adding a field to store:
query_graph("pattern": "callers_of", "target": "updateClaim")
// Shows ALL places that call updateClaim → see if field already flows through

// When debugging a component:
query_graph("pattern": "file_summary", "target": "AccidentForm.tsx")
// See all functions, types, imports in ONE VIEW instead of scanning file

// When finding where a field is used:
query_graph("pattern": "callers_of", "target": "vehicle.fitnessNo")
// See all places reading/writing this field across codebase

// When understanding report generation:
query_graph("pattern": "callees_of", "target": "buildStandardFinalSurveyHTML")
// See all functions called BY this report builder
```

**Token savings: 70-80%** — query results are compact, vs reading 5 source files manually.

---

### ❌ DON'T: Grep + Manual File Reading

**Token wasters:**
```bash
# ❌ BAD: Scans whole src/ folder
grep -r "fitnessNo" src/

# ❌ BAD: Read full claim-store.ts just to find one field
cat src/stores/claim-store.ts | grep fitnessNo

# ❌ BAD: Read multiple files to trace a function call
grep -l "updateVehicle" src/**/*.tsx
```

**Cost: 50-150 tokens per file read, plus analysis tokens.**

---

## DO's During Development

### 1. Read Knowledge Base FIRST

✅ **Before coding, always check:**
- `[[AI_Field_Extraction_Mapping]]` — is this field already mapped?
- `[[Error_Handling_and_Recovery]]` — what's the error handling pattern?
- `[[Data_Dictionary_and_Flow]]` — what's the data type?

**Token savings: 200+ tokens** — answers ready-made, no need to infer from code.

---

### 2. Use graphify Before Any File Read

✅ **Sequence:**
1. Form your question clearly
2. Run `query_graph()` or `semantic_search_nodes` (if embeddings available)
3. Read ONLY the files graphify suggests
4. If stuck, then grep specific patterns

**Example:**
```
Question: "Where is policeStation field used?"

Step 1: query_graph("pattern": "callers_of", "target": "policeStation")
Result: AccidentForm.tsx, SpotTab.tsx, SpotPrintReport.tsx

Step 2: Read ONLY those 3 files
Step 3: Understand the flow

COST: ~100 tokens (graphify results + 3 focused reads) vs 500+ tokens (blind file scanning)
```

---

### 3. Trust Recent Session Notes

✅ **Each session updates `Tasks.md`:**
- What was done
- What's pending
- Known issues

**Read Tasks.md first** — saves 100+ tokens of re-discovery.

---

### 4. Check Type Definitions Before Store Logic

✅ **Sequence for field bugs:**
1. Look at `types/claim.ts` — what's the shape?
2. Look at `reconciliation.ts` — how does AI data map?
3. Look at `claim-store.ts` — how does it update?
4. Look at report builders — how do they read it?

**This order prevents circular searches** — saves 50+ tokens per bug.

---

### 5. Test with Real PDFs, Not Hardcoded Data

✅ **When debugging extraction:**
- Upload a real document (RC, Fitness cert, etc.)
- Watch the extraction in real time
- Verify the field appears in the store
- Check it renders in reports

**Why**: Hardcoded test data bypasses extraction logic, masks real bugs.

**Token savings: 100+ tokens** — avoids chasing phantom bugs that don't exist.

---

### 6. Use Preview Tools, Not Screenshots

✅ **When verifying UI changes:**
```typescript
// Use graphify preview:
mcp__Claude_Preview__preview_snapshot(serverId)
// Returns text structure + element tree

// For visual inspection:
mcp__Claude_Preview__preview_inspect(selector)
// Returns exact colors, fonts, spacing
```

**Token savings: 50+ tokens per change** — no screenshot attachment overhead.

---

### 7. Commit Atomic Changes

✅ **Good commits:**
```
fix: remove duplicate policeStation field from SpotTab
fix: add repairWorkshop to SpotPrintReport observations
```

❌ **Bad commits:**
```
fix: several field mapping issues and ui improvements and error handling
```

**Why**: Atomic commits = easy to understand, easy to revert, less token waste on explanation.

---

### 8. Document Discoveries in Knowledge Base

✅ **When you solve something non-obvious:**
- Add 1-3 lines to `AI_Field_Extraction_Mapping.md` or `Error_Handling_and_Recovery.md`
- Or create a brief Patterns/ entry
- Don't explain again next session

**Token savings: 200+ tokens per repeated discovery.**

---

## DON'Ts During Development

### 1. ❌ DON'T Scan Full Files for One Field

```typescript
// ❌ BAD: Read 500-line file looking for one line
const form = readFile('AccidentForm.tsx') // All 500 lines
const field = form.match(/policeStation/)

// ✅ GOOD: Query first
query_graph("pattern": "file_summary", "target": "AccidentForm.tsx")
// Returns concise list of all fields + line numbers
```

**Cost: 100 tokens wasted per large file read.**

---

### 2. ❌ DON'T Add Fields to Multiple Places

```typescript
// ❌ BAD: Field in both AccidentForm AND SpotTab
// → User confused about which one to edit
// → Sync issues when one is updated
// → Duplicate testing

// ✅ GOOD: Field in ONE place (single source of truth)
// AccidentForm (Claim Details tab)
// → Used by all claim types
// → Single edit point
// → Reports read from same store path
```

**Cost: 50-100 tokens per debugging session; risk of bugs.**

---

### 3. ❌ DON'T Hardcode Test Data

```typescript
// ❌ BAD: Hardcoded test claim in UI
const testClaim = {
  vehicle: { fitnessNo: 'ABC123' },
  // ...
}
// Bypasses entire extraction flow, masks real bugs

// ✅ GOOD: Upload real PDF in dev environment
// Follow actual user workflow
// Extract → store → render
// Real bugs surface immediately
```

**Cost: 200+ tokens chasing bugs that don't exist in production.**

---

### 4. ❌ DON'T Assume Field Locations

```typescript
// ❌ BAD: Guess where field comes from
"Where is policeStation set? Probably in handleUploadDocument..."
// Search 3 files, still lost

// ✅ GOOD: Use reconciliation.ts as source of truth
// Look at aiKeys mapping
// Follow the path step by step
```

**Cost: 100+ tokens of wrong-direction investigation.**

---

### 5. ❌ DON'T Test Only Spot Claims (or Only Standard)

```typescript
// ❌ BAD: Add feature, test in Spot claims only
// Standard claims silently break

// ✅ GOOD: Test BOTH
// surveyType === 'spot' → Spot claim
// surveyType !== 'spot' → Standard claim
// Verify fields render in both
```

**Cost: 50-100 tokens debugging "broken in production".**

---

### 6. ❌ DON'T Re-Read Files You Just Edited

```typescript
// ✅ CORRECT:
Edit file
// → Trust the Edit tool validation
// → Don't Read it back unless needed

// ❌ WRONG:
Edit file
Read file back to verify
// → Wastes 50 tokens per edit
```

---

### 7. ❌ DON'T Commit Without Graphify Impact Check

```typescript
// ❌ BAD: Commit a change that breaks other flows
// No visibility into cross-component impact

// ✅ GOOD: Before commit, run:
detect_changes_tool()
// Shows: "This change affects 5 flows: ReportTab, DetailsTab, ..."
// Validate impact, test those flows
```

**Cost: 100+ tokens debugging broken features from unexpected commits.**

---

### 8. ❌ DON'T Use `any` Types Without Reason

```typescript
// ❌ BAD: Lose type safety, debug later
const field: any = claimData.vehicle

// ✅ GOOD: Use typed interfaces
const field: Vehicle = claimData.vehicle
// TypeScript catches mistakes at compile time
```

**Cost: 50+ tokens debugging runtime type errors.**

---

### 9. ❌ DON'T Bundle Unrelated Fixes in One Commit

```typescript
// ❌ BAD:
fix: remove duplicates, add repairWorkshop, fix error messages, update types
// 4 separate concerns in one commit
// Impossible to revert 1 fix without affecting 3 others

// ✅ GOOD:
fix: remove duplicate policeStation from SpotTab  [commit 1]
feat: add repairWorkshop to SpotPrintReport      [commit 2]
fix: improve AI quota error messaging            [commit 3]
chore: update Vehicle type hints                 [commit 4]
```

**Cost: 50-100 tokens per complex merge/revert scenario.**

---

### 10. ❌ DON'T Guess AI Error Codes

```typescript
// ❌ BAD: Assume what the error is
if (error.status === 429) {
  // Maybe it's quota? Maybe it's rate limit?
  // Guess and implement
}

// ✅ GOOD: Reference Error_Handling_and_Recovery.md
if (isQuotaExhausted(error)) { ... }  // Permanent
else if (error.status === 429) { ... } // Rate limit, temporary
```

**Cost: 100+ tokens fixing error handling that doesn't match reality.**

---

## Session Checklist (Before Closing)

- [ ] Read `Tasks.md` — understand where we are
- [ ] Read `AI_Field_Extraction_Mapping.md` — know the field flows
- [ ] Read `Error_Handling_and_Recovery.md` — know error patterns
- [ ] For each feature/fix:
  - [ ] Used `query_graph` before file reads
  - [ ] Tested with real documents (not hardcoded data)
  - [ ] Verified both Spot AND Standard claims work
  - [ ] Checked `AI_Field_Extraction_Mapping.md` for existing mappings
  - [ ] Used atomic commits (one concern per commit)
- [ ] After changes:
  - [ ] Ran `detect_changes_tool()` to see impact
  - [ ] Tested affected flows (ReportTab, DetailsTab, etc.)
  - [ ] Updated `Tasks.md` with what's done + what's next
- [ ] Before PR:
  - [ ] No hardcoded test data
  - [ ] No `any` types without reason
  - [ ] No duplicate fields in UI
  - [ ] Error handling follows the pattern in this guide

---

## Token Savings Summary

| Practice | Tokens Saved | When |
|----------|---|---|
| Use graphify instead of grep | 50-150 | Per file read avoided |
| Read KB before coding | 200+ | Per session |
| Test with real PDFs | 100+ | Per bug avoided |
| Atomic commits | 50-100 | Per PR/revert |
| Preview tools not screenshots | 50 | Per UI change |
| Document discoveries in KB | 200+ | Per repeated discovery |
| Query before file read | 70-80% | Per feature |
| Test both claim types | 50-100 | Per deployment |

**Total potential savings: 50-70% of token usage per session** when all practices applied consistently.

