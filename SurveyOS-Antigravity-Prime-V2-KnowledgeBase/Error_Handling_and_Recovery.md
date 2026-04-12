# Error Handling & Recovery Patterns

> **Purpose**: Standardized error handling across AI extraction, API calls, and user-facing operations. Use when adding new features or debugging error states.

---

## AI Provider Error Hierarchy

### Error Detection Flow

```
callAIGateway(document, provider)
    ↓
Try provider API call
    ↓
CATCH error → isQuotaExhausted(error) ?
    ├─ YES → Show quota toast, STOP (don't rotate keys)
    ├─ NO  → Rotate to next provider, RETRY
    └─ NO next provider → Show fallback toast, ASK USER
```

---

## Error Types & Responses

### 1. Quota Exhausted (Permanent)

**Detection:**
```typescript
function isQuotaExhausted(err: any): boolean {
  const message = err.message?.toLowerCase() || ''
  return err.status === 429 && (
    message.includes('quota exceeded') ||
    message.includes('free_tier') ||
    message.includes('limit: 0')
  )
}
```

**User Message:**
```
"Gemini free-tier quota exhausted. Switch to Groq in Profile → AI & Documents Intelligence"
```

**Action:**
- **STOP key rotation** — attempting again with another Gemini key won't help
- **Show alternative provider suggestion** — tell user which other provider to configure
- **Log for admin** — quota exhaustion is an operational issue, not a code bug

**Example:**
```typescript
if (isQuotaExhausted(error)) {
  toastError(`${providerLabel} quota exhausted. Switch to ${otherProvider} in Profile → AI & Documents Intelligence`)
  break // Don't rotate, just stop
}
```

---

### 2. Rate Limited (Temporary)

**Detection:**
```typescript
// HTTP 429 WITHOUT quota keywords = rate limit (temporary)
if (error.status === 429 && !isQuotaExhausted(error)) {
  // Rotate and retry
}
```

**User Message:**
```
"API temporarily rate limited. Retrying with next provider..."
```

**Action:**
- **Rotate to next key/provider**
- **Retry immediately** (don't exponential backoff on first attempt)
- **Fail over gracefully** if all providers exhausted

**Example:**
```typescript
async function callWithRotation() {
  for (const key of keys) {
    try {
      return await call(key)
    } catch (err) {
      if (isQuotaExhausted(err)) break // Permanent, stop trying
      // Otherwise continue to next key (rate limit)
    }
  }
  throw new Error('All providers failed')
}
```

---

### 3. Generic API Error (4xx/5xx)

**Detection:**
```typescript
if (error.status >= 400 && error.status < 600 && error.status !== 429) {
  // Generic API error, not rate limit
}
```

**User Message:**
```
"Document extraction failed: [specific error]. Try uploading again or manually enter data."
```

**Action:**
- **Show error details** to user (specific, not "unknown error")
- **Suggest manual workaround** (user can enter data manually in UI)
- **Log full error** for debugging

**Example:**
```typescript
catch (error) {
  if (error.response?.status >= 400) {
    toastError(`Extraction failed: ${error.message}. Enter data manually or try another document.`)
    console.error('Extraction error:', error)
  }
}
```

---

### 4. Network Error (No Internet)

**Detection:**
```typescript
if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
  // Network error
}
```

**User Message:**
```
"Network error. Check your internet connection and try again."
```

**Action:**
- **Don't retry immediately** — user likely has no internet
- **Suggest user action** — check connectivity, then retry
- **No key rotation** — won't help

---

## Field Mapping Error Pattern

**When a field doesn't appear in the report after extraction:**

1. ✅ **Check this file first** — see `AI_Field_Extraction_Mapping.md`
2. ✅ **Verify reconciliation.ts** — does the AI key → store path mapping exist?
3. ✅ **Check claim-store.ts** — is the store path being set correctly?
4. ✅ **Check report builders** — is the report reading from that store path?

**Common issues:**
- Field extracted but mapped to wrong store key (reconciliation bug)
- Field extracted but overwritten later (claim-store logic bug)
- Field in store but report reads from different key (report builder bug)

**Example debugging flow:**
```
User: "Fitness number not appearing in spot report"
  ↓
Check reconciliation.ts → fitness_cert_no maps to vehicle.fitnessNo ✅
  ↓
Check claim-store.ts RC block → fitness fields removed (correct) ✅
  ↓
Check SpotPrintReport.tsx → uses spotDetails.fitnessType NOT vehicle.fitnessType ❌
  ↓
BUG: Report reads wrong field (spot-specific field, not vehicle field)
  ↓
FIX: Use vehicle.fitnessNo instead
```

---

## Store Update Error Pattern

**When store updates fail or have unintended side effects:**

### Immutability Violation
❌ **WRONG:**
```typescript
// Don't mutate objects directly
currentClaim.vehicle.fitnessNo = value
// This breaks Zustand reactivity
```

✅ **CORRECT:**
```typescript
// Create new objects
updateVehicle({ fitnessNo: value })
// Zustand detects the change, triggers re-render
```

### Overwriting Related Data
❌ **WRONG:**
```typescript
if (data.estimate_date) 
  newClaim.accident.dateAndTime = data.estimate_date
// Overwrites accident date with unrelated estimate date
```

✅ **CORRECT:**
```typescript
// Only set from appropriate document
if (data.accident_date)
  newClaim.accident.dateAndTime = data.accident_date
```

### Duplicate Field Syndrome
❌ **WRONG:**
```typescript
// In AccidentForm AND SpotTab
<Input value={accident.policeStation} onChange={...} />
// User doesn't know which one is the "real" source
```

✅ **CORRECT:**
```typescript
// In ONE place (Claim Details tab), with clear label
// SpotTab references but doesn't allow editing
```

---

## Claim Type Error Pattern (Spot vs Standard)

**When changes only work for one claim type:**

### Symptom: Feature works in Spot, breaks in Standard (or vice versa)

**Root cause checklist:**
1. Is the field in `accident.*` or `vehicle.*`? (shared by both)
2. Is the field in `spotDetails.*`? (Spot-only)
3. Is the component conditional on `surveyType`? (might break standard)
4. Does the report check for `spotDetails` without fallback? (breaks standard)

**Example:**
```typescript
// BREAKS STANDARD CLAIMS:
{spotDetails.repairWorkshop && (
  <div>Further Repairs: {spotDetails.repairWorkshop}</div>
)}
// Standard claims have no spotDetails, so this never renders

// FIX: Make it work for both:
{(spotDetails?.repairWorkshop || accident.workshopName) && (
  <div>Further Repairs: {spotDetails?.repairWorkshop || accident.workshopName}</div>
)}
```

---

## Validation & Pre-Flight Checks

**Before uploading a document:**

```typescript
// Validate file type
if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
  toastError('Invalid file type. Upload PDF or image.')
  return
}

// Validate file size (max 5MB)
if (file.size > 5 * 1024 * 1024) {
  toastError('File too large. Max 5MB.')
  return
}

// Validate document has content (not blank)
if (file.size < 1024) {
  toastError('File appears empty.')
  return
}
```

---

## User-Facing Error Messages

### Do's ✅
- **Be specific:** `"Policy expiry date must be after today"` not `"Invalid input"`
- **Suggest fix:** `"Try uploading a clearer photo of the document"`
- **Name the field:** `"Vehicle chassis number is required"`
- **Show what to do next:** `"Enter data manually or upload another document"`

### Don'ts ❌
- **Generic errors:** `"Error occurred"` — user learns nothing
- **Technical jargon:** `"Null pointer in extraction pipeline"` — confuses users
- **Blame the user:** `"You uploaded wrong document"` — unhelpful
- **Silent failures:** No error message = user thinks it worked but it didn't

### Examples

❌ **Bad:**
```
"Error: Extract failed"
```

✅ **Good:**
```
"Document extraction failed. Try uploading a clearer image or enter the data manually in the form."
```

---

## Error Logging Pattern

**Client-side (UI):**
```typescript
try {
  await extractDocument(file)
} catch (error) {
  // Show user-friendly message
  toastError('Extraction failed. Please try again.')
  
  // Log detailed info for debugging
  console.error('[Extraction Error]', {
    file: file.name,
    size: file.size,
    provider: currentProvider,
    status: error.status,
    message: error.message,
    timestamp: new Date().toISOString()
  })
}
```

**Server-side (Firebase):**
```typescript
function logError(context: string, error: any) {
  console.error(`[${context}]`, {
    message: error.message,
    code: error.code,
    stack: error.stack,
    timestamp: new Date().toISOString()
  })
}
```

---

## Recovery Patterns

### Retry Strategy
```typescript
async function retryWithBackoff(fn, maxAttempts = 3) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === maxAttempts - 1) throw error // Last attempt, fail
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i))) // Exponential backoff
    }
  }
}
```

### Fallback to Manual Entry
```typescript
// If extraction fails, user can still enter data manually
if (extractionFailed) {
  toastError('Extraction failed. You can still enter data manually in the form.')
  // UI remains accessible for manual input
}
```

### Graceful Degradation
```typescript
// If one provider is down, try next
const providers = ['gemini', 'groq', 'claude']
for (const provider of providers) {
  try {
    return await extract(file, provider)
  } catch (err) {
    if (isQuotaExhausted(err)) break // Quota, don't try others
    // Rate limit or other error, try next provider
    continue
  }
}
throw new Error('All providers failed')
```

---

## Testing Error Scenarios

**Checklist for new extraction features:**

- [ ] ✅ Upload valid document → extraction succeeds
- [ ] ❌ Upload invalid file type → shows type error
- [ ] ❌ Upload blank document → shows empty error
- [ ] ❌ Network down → shows connection error
- [ ] ❌ API quota exhausted → shows quota error + suggests alternative
- [ ] ❌ API rate limited → retries with next key automatically
- [ ] ⚠️ Partial extraction (some fields missing) → shows toast, updates what was extracted
- [ ] ✅ All providers failed → user can enter data manually
- [ ] ✅ Standard vs Spot claims → both work, fields render correctly

---

## Quick Lookup: Common Errors & Fixes

| Error | Cause | Fix |
|---|---|---|
| "All AI providers failed" | No API keys configured | Profile → AI & Documents → add at least one provider |
| "Quota exceeded" | Provider free tier used up | Switch to different provider in Profile |
| "File too large" | PDF > 5MB | Compress PDF or split into pages |
| "Network error" | No internet or API down | Check internet, retry in a few minutes |
| "Field not in report" | See `AI_Field_Extraction_Mapping.md` | Check reconciliation, claim-store, report builder |
| "Standard claim broken after Spot change" | Conditional logic missing | Test both `surveyType === 'spot'` and standard |
| "Data disappears after re-upload" | Immutability bug | Use `updateVehicle({...})` not direct mutation |
| "Same value appears twice in form" | Duplicate field in two tabs | Keep field in one place only |

