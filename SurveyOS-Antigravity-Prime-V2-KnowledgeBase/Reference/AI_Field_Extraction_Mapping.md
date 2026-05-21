# AI Field Extraction Mapping & Error Handling

> **Purpose**: Single source of truth for which AI documents extract which fields, where they go in the store, and how errors are handled. **Use this instead of scanning code** when debugging extraction issues.

---

## Quick Reference: Document Types → Extract Fields

| Document Type | AI Provider | Fields Extracted | Target Store |
|---|---|---|---|
| **RC (Vehicle Registration)** | Gemini/Groq | reg no, make, model, YOM, chassis, engine, CC, color, fuel, class, body type, registering authority, registration date, valid up to, hypothecation, RLW | `vehicle.*` |
| **Fitness Certificate** | Gemini/Groq | fitness cert no, validity date, fitness type (NORMAL/EXECUTIVE/TOURIST) | `vehicle.{fitnessNo, fitnessValidUpto, fitnessType}` |
| **Insurance Policy** | Gemini/Groq | policy no, insurer, insured name, start date, expiry date, sum insured, vehicle ID (NCB), coverage type | `policy.*` |
| **Repair Estimate** | Gemini/Groq | estimate date, parts list, labor cost, total estimate amount | `feeBill.estimateAmount` (NOT accident.dateAndTime!) |
| **Spot Report** | Spot Survey AI | surveyor name, survey date, accident location, vehicle condition (damage rows), repairs needed, comments | `spotDetails.*` |

---

## Field Mapping: Source → Store Path → Report Usage

### Vehicle Fields

| AI Key | Source Document | Store Path | Used In Reports | Notes |
|---|---|---|---|---|
| `registration_number` | RC | `vehicle.registrationNumber` | All reports (header) | Primary vehicle ID |
| `make` | RC | `vehicle.make` | All reports (B section) | e.g. MARUTI SUZUKI |
| `model` | RC | `vehicle.model` | All reports (B section) | e.g. SWIFT VXI |
| `year_of_manufacture` (numeric) | RC | `vehicle.yearOfManufacture` | Standard + UIIC (used for age calc) | Used in `getVehicleAgeMonths()` |
| `chassis_no` | RC | `vehicle.chassisNumber` | All reports (B section) | Uppercase |
| `engine_no` | RC | `vehicle.engineNumber` | All reports (B section) | Uppercase |
| `cubic_capacity` | RC | `vehicle.cubicCapacity` | All reports (B section) | CC value |
| `color` | RC | `vehicle.colour` | All reports (B section) | Spelling: "colour" (British) |
| `fuel_type` | RC | `vehicle.fuel` | All reports (B section) | Petrol/Diesel/CNG/LPG/Electric/Hybrid |
| `class_of_vehicle` | RC | `vehicle.classOfVehicle` | All reports (B section) | e.g. LMV PE |
| `body_type` | RC | `vehicle.bodyType` | All reports (B section) | SALOON/HATCHBACK/SUV |
| `registering_authority` | RC | `vehicle.registeringAuthority` | Not in final reports | RTO name |
| `date_of_registration` | RC | `vehicle.dateOfRegistration` | Not in final reports | Used for age calc |
| `registration_valid_upto` | RC | `vehicle.registrationValidUpTo` | Not in final reports | Expiry check |
| `hypothecation` | RC | `vehicle.hypothecation` | All reports (B section) | Financier name or "NO" |
| `registered_load_weight` | RC | `vehicle.registeredLoadWeight` | All reports (E section) | For commercial vehicles |
| `fitness_cert_no` | **Fitness Certificate ONLY** | `vehicle.fitnessNo` | Spot report (D section) | **NOT from RC** |
| `fitness_valid_upto` | **Fitness Certificate ONLY** | `vehicle.fitnessValidUpto` | Spot report (D section) | **NOT from RC** |
| `fitness_type` | **Fitness Certificate ONLY** | `vehicle.fitnessType` | Spot report (D section) | NORMAL/EXECUTIVE/TOURIST |

### Accident Fields

| AI Key | Source Document | Store Path | Used In Reports | Notes |
|---|---|---|---|---|
| `accident_date` | Claim uploaded doc (not Estimate) | `accident.dateAndTime` | All reports (A/C section) | **DO NOT use estimate_date** |
| `police_reported` | Claim form (manual) | `spotDetails.policeReported` | Spot report logic | yes/no, controls visibility of FIR fields |
| `police_station` | Claim form (manual) | `accident.policeStation` | Spot report (A section) | Entered in Claim Details tab, not extracted |
| `fir_number` | Claim form (manual) | `accident.firNumber` | Spot report (A section) | Entered in Claim Details tab, not extracted |
| `fir_date` | Claim form (manual) | `accident.firDate` | Spot report (A section) | Entered in Claim Details tab, not extracted |
| `place_of_survey` | Claim form (manual) | `accident.placeOfSurvey` | All reports (A section) | Single field — not duplicate in SpotTab |
| `accident_location` | Spot survey data | `spotDetails.accidentLocation` | Spot report (G section) | From spot survey form |

### Spot Survey Fields

| AI Key / Field | Source | Store Path | Used In Reports |
|---|---|---|---|
| `surveyor_name` | Spot survey AI | `spotDetails.surveyorName` | Spot report (signature) |
| `report_date` | Spot survey AI | `spotDetails.reportDate` | Spot report (header) |
| `report_no` | Spot survey AI | `spotDetails.reportNo` | Spot report (header) |
| `damage_rows[]` | Spot survey AI | `spotDetails.damageRows[{component, damage}]` | Spot report (G section table) |
| `repairs` | Spot survey form | `spotDetails.repairs` | Spot report (G section) |
| `repair_workshop` | Spot survey form | `spotDetails.repairWorkshop` | Spot report (G section) | e.g. "XYZ Auto Garage, Mumbai" |
| `comments` | Spot survey form | `spotDetails.comments` | Spot report (G section) | Rendered once (fallback if no damage rows) |
| `fitness_type` (spot-specific) | Spot survey form | `spotDetails.fitnessType` | **Different from** `vehicle.fitnessType` |
| `area_of_operation` | Spot survey form | `spotDetails.areaOfOperation` | Spot report (D section) | For commercial vehicles |

### Policy Fields

| AI Key | Source Document | Store Path | Used In Reports |
|---|---|---|---|
| `policy_number` | Insurance Policy | `policy.policyNumber` | All reports (B section) |
| `insurer_name` | Insurance Policy | `policy.insurerName` | All reports (header) |
| `insured_name` | Insurance Policy | `policy.insuredName` | All reports (B section) |
| `policy_start_date` | Insurance Policy | `policy.policyStartDate` | Spot report (B section) |
| `policy_expiry_date` | Insurance Policy | `policy.policyExpiryDate` | Spot report (B section) |
| `sum_insured` | Insurance Policy | `policy.sumInsured` | Spot report (B section) |
| `coverage_type` | Insurance Policy | `policy.coverageType` | Spot report (B section) | e.g. Liability, Third-party, Comprehensive |

### Fee/Billing Fields

| AI Key | Source Document | Store Path | Used In Reports |
|---|---|---|---|
| `estimate_amount` | Repair Estimate | `feeBill.estimateAmount` | Not in final reports (internal tracking) |
| `estimate_date` | Repair Estimate | **NOT USED** for accident date | — | **BUG FIX**: estimate_date ≠ accident_date |
| `salvage_value` | Manual entry | `feeBill.salvageValue` | UIIC report (assessment) |
| `compulsory_excess` | Manual entry | `feeBill.lessExcess` | UIIC report (assessment) | Store field named `lessExcess` (confusing!) |
| `voluntary_excess` | Manual entry | `feeBill.voluntaryExcess` | UIIC report (assessment) |

---

## AI Extraction Flow & Error Handling

### Step 1: Document Upload → AI Extraction

```
User uploads document (RC, Fitness, Policy, Estimate, Spot)
    ↓
callAIGateway() in lib/ai/service.ts
    ↓
[Try Gemini] → if fails → [Try Groq] → if fails → throw error
    ↓
Success: Raw AI response → reconciliation.ts
    ↓
Reconcile fields (map AI keys to store paths)
    ↓
updateClaim() in claim-store.ts
    ↓
Store updated + UI re-renders
```

### Step 2: Error Detection & User Messaging

**Error Types:**

| Error | Symptoms | Handling |
|---|---|---|
| **Quota Exhausted** | HTTP 429 + message includes "quota exceeded" OR "free_tier" OR "limit: 0" | `isQuotaExhausted()` returns true → **break key rotation** → show actionable toast |
| **Rate Limited** | HTTP 429 + generic "too many requests" | `isQuotaExhausted()` returns false → **rotate to next key** → retry |
| **API Error** | 4xx/5xx other than 429 | Show error toast to user, suggest manual entry |
| **No Fallback** | Both Gemini + Groq failed, no other provider configured | Toast: `"Gemini & Groq both failed. Switch to <missing provider> in Profile → AI & Documents Intelligence"` |

**Key Function:**
```typescript
function isQuotaExhausted(err: any): boolean {
  return err.status === 429 && (
    message.includes('quota exceeded') ||
    message.includes('free_tier') ||
    message.includes('limit: 0')
  )
}
```

---

## Common Bugs & Fixes (This Session)

### Bug 1: Estimate Date Overwrites Accident Date ❌
**File**: `claim-store.ts` line 716  
**Problem**: `if (data.estimate_date) newClaim.accident.dateAndTime = data.estimate_date;`  
**Why**: Repair estimate is unrelated to accident occurrence — completely different concepts  
**Fix**: **DELETE** this line entirely  
**Verification**: Upload estimate → accident.dateAndTime stays unchanged  

### Bug 2: Fitness Fields from Wrong Document ❌
**Files**: RC extraction + reconciliation  
**Problem**: `fitnessNo`, `fitnessValidUpto` populated from RC, but RC documents don't contain fitness certificate data  
**Why**: Only Fitness Certificate document has these fields  
**Fix**:
- Remove `rc:` keys from reconciliation mapping
- Remove lines from RC extraction block in claim-store.ts
- Remove `fitness_*` fields from RC prompt
**Verification**: RC upload → fitness fields empty; Fitness cert upload → they populate  

### Bug 3: Duplicate Field Inputs ❌
**Problem**: Fields editable in BOTH Claim Details tab AND SpotTab  
**Why**: Causes confusion, data sync issues, redundant data entry  
**Fix**: Keep in Claim Details tab (single source of truth), remove from SpotTab  
**Map**:
- `policeStation`, `firNumber` → Accident form only
- `fitnessNo`, `fitnessValidUpto` → Vehicle form only
- `placeOfSurvey` → Accident form only (was duplicated in SpotTab at line 663)
**Verification**: SpotTab has no duplicate fields, reports still render correctly  

### Bug 4: Duplicate Spot Comments Rendering ❌
**File**: `SpotPrintReport.tsx` lines 447–450  
**Problem**: `spotDetails.comments` rendered twice — once as fallback in damage section, once separately  
**Why**: Both blocks render when no damage rows exist  
**Fix**: **DELETE** the separate comments block (lines 447–450), keep fallback only  
**Verification**: Print preview shows comments once, not twice  

### Bug 5: Missing Spot Fields in Print Report ❌
**Problem**: `spotDetails.repairWorkshop` + `spotDetails.areaOfOperation` + `spotDetails.fitnessType` entered in UI but never appear in print  
**Why**: SpotPrintReport wasn't reading those fields  
**Fix**: Add rows to Section D (commercial) + observations section  
**Verification**: Fill fields in SpotTab → see them in print preview  

---

## DO's for Development (Token-Efficient)

✅ **When fixing bugs or adding fields:**
1. **Read this file first** — check if the field is already documented
2. **Use graphify `query_graph`** before reading source files
   - `query_graph("pattern": "callers_of", "target": "updateClaim")` → see all callers
   - `query_graph("pattern": "file_summary", "target": "claim-store.ts")` → see all nodes in that file
3. **Check reconciliation.ts** before claim-store.ts — it's the mapping layer
4. **Test extraction with dummy PDF** — don't hardcode test data
5. **Document the fix** in this file + update Tasks.md
6. **Commit with atomic messages** — one fix per commit, not bundled
7. **Use preview_snapshot** to verify UI changes, not screenshots

---

## DON'Ts for Development (Token Wasters)

❌ **Things that burn tokens:**

1. **Don't scan src/ folder blindly** — use graphify first
2. **Don't assume field locations** — check reconciliation.ts + claim-store.ts mapping
3. **Don't add fields to multiple places** — one source of truth only
4. **Don't test with hardcoded data** — upload real PDFs to avoid extraction logic bugs
5. **Don't commit before reviewing graphify impacts** — might break other flows
6. **Don't re-read files you just edited** — trust the Edit tool
7. **Don't debug by reading test data** — test with actual claim flows
8. **Don't bundle unrelated fixes** — one feature/fix per PR
9. **Don't guess AI error responses** — always check actual error status codes + messages
10. **Don't assume Spot-only fields work for standard claims** — test both claim types

---

## Token Reduction Checklist

Before requesting code review or merging:

- [ ] Used graphify `query_graph` instead of grep
- [ ] Checked reconciliation.ts for field mappings
- [ ] Verified store paths match report builders
- [ ] Tested extraction with real document upload
- [ ] Verified error handling (quota vs rate-limit)
- [ ] Used preview_snapshot not screenshots
- [ ] Documented fix in this file
- [ ] Commit message cites which bugs fixed (by name from above)
- [ ] No hardcoded test data in code
- [ ] Checked if field appears in multiple documents (should it?)

---

## Next Steps for Session

1. ✅ **AI Field Mapping** — THIS FILE (completed)
2. ⏳ **Embeddings** — requires Python setup (blocked, not critical)
3. ⏳ **MCP Registry** — document all available MCPs and when to use each
