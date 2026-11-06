# Design: Floating Preview Bill Check Parity & Clean Bill Check Header

> Date: 2026-11-06  
> Author: Antigravity  
> Status: Approved by User

## 1. Understanding Summary
- **What is being built:**
  1. Generic title in `BillCheckHeader.tsx`: Replace hardcoded "UIIC Bill Check Report" with "Bill Check Report".
  2. Standard Bill Check format integration in `FloatingReportPreview.tsx`: Add Standard Bill Check (`buildStandardFinalSurveyHTML(claim, profile, 'bill-check')`) to the live preview floater.
  3. 5-Pill Selector Toolbar: `Std` | `UIIC` | `Std Bill` | `UIIC Bill` | `Fees`.
  4. Smart Auto-Default on Tab Navigation: Automatically select `UIIC Bill` if insurer name matches United India / UIIC, else `Std Bill` when opening the `bill-check` tab.
  5. Removal of Minimise Button: Remove the clunky 48px height collapse button, keeping only the clean Close (`X`) button (which collapses to the bottom-right floating pill FAB).
- **Why it exists:** Parity between Standard and UIIC Bill Check previews, elimination of misleading UIIC branding on general insurer claims, and improved floating window ergonomics.
- **Target Audience:** Motor insurance surveyors inspecting and checking final bills across all insurers.
- **Key Constraints:** Zero regression on print gates (`usePrintGate`) and existing test suites; preserve responsive layout of the floater header.
- **Non-Goals:** Modifying underlying report calculation formulas (already reconciled).

## 2. Assumptions
- The floating bubble FAB button (`open === false`) at bottom-right already serves as the collapsed/docked state, rendering the internal minimise button redundant.
- Print gate for `std-bill` uses `'bill-check'` and print gate for `uiic-bill` uses `'uiic-bill-check'`.

## 3. Decision Log
| Decision | Alternatives Considered | Rationale |
|---|---|---|
| **Header Title: "Bill Check Report"** | Dynamic format title; `<Insurer> Bill Check Report` | Clean, universal, avoids confusion when insurer details are pending or different. |
| **Pill Model: Unified 5-Pill Selector** | Nested mode toggle; context-only tabs | 1-click preview switching without hiding formats or requiring multiple clicks. |
| **Remove Minimise Button** | Keep minimise; replace with accordion | Floating bubble FAB already provides natural collapsed state; minimise added clunkiness. |

## 4. Final Design Specification

### 4.1 Bill Check Tab Header (`BillCheckHeader.tsx`)
Change line 48:
```tsx
<h1 className="text-2xl lg:text-3xl font-medium mb-2 text-[#1D1D1F]" style={{ letterSpacing: '-0.02em' }}>
  Bill Check Report
</h1>
```

### 4.2 Floating Report Preview (`FloatingReportPreview.tsx`)
1. **Type Definition:**
   ```ts
   type ReportFormat = 'standard' | 'uiic' | 'std-bill' | 'uiic-bill' | 'spot' | 'fee-bill' | 'valuation';
   ```

2. **State & Header Controls:**
   - Remove `minimised` state and `<Minus size={12} />` button.
   - Fixed height `height: size.height` on panel container.
   - Retain `<X size={12} />` close button.

3. **Auto-Detection on Tab Change:**
   ```ts
   if (activeTab === 'bill-check') {
     const isUIIC = currentClaim.policy?.insurerName?.toLowerCase().includes('united');
     setFormat(isUIIC ? 'uiic-bill' : 'std-bill');
   } else if (activeTab === 'reinspection') {
     if (format !== 'standard' && format !== 'uiic') setFormat('uiic');
   } else {
     if (format === 'std-bill' || format === 'uiic-bill' || format === 'fee-bill' || format === 'valuation') {
       setFormat('standard');
     }
   }
   ```

4. **Debounced HTML Generation:**
   ```ts
   if (format === 'uiic') {
     out = buildUIICFinalHTML(currentClaim, profile);
   } else if (format === 'std-bill') {
     out = buildStandardFinalSurveyHTML(currentClaim, profile, 'bill-check');
   } else if (format === 'uiic-bill') {
     out = buildUIICBillCheckHTML(currentClaim, profile);
   } else if (format === 'fee-bill') {
     out = buildSpotFeeBillHTML(currentClaim, profile);
   } else if (format === 'valuation') {
     out = buildValuationReportHTML(currentClaim, profile);
   } else {
     out = buildStandardFinalSurveyHTML(currentClaim, profile);
   }
   ```

5. **Print Gate Dispatch:**
   ```ts
   const fresh = !latest ? null
     : format === 'uiic' ? buildUIICFinalHTML(latest, profile)
     : format === 'std-bill' ? buildStandardFinalSurveyHTML(latest, profile, 'bill-check')
     : format === 'uiic-bill' ? buildUIICBillCheckHTML(latest, profile)
     : format === 'standard' ? buildStandardFinalSurveyHTML(latest, profile)
     : null;
   ```
   ```ts
   const kind = format === 'uiic' ? 'uiic-final'
     : format === 'uiic-bill' ? 'uiic-bill-check'
     : format === 'std-bill' ? 'bill-check'
     : format === 'standard' ? 'final'
     : null;
   ```

6. **Toolbar Pill Rendering:**
   ```tsx
   {(currentClaim?.surveyType === 'spot'
       ? (['spot', 'fee-bill'] as const)
       : currentClaim?.surveyType === 'valuation'
       ? (['valuation', 'fee-bill'] as const)
       : (['standard', 'uiic', 'std-bill', 'uiic-bill', 'fee-bill'] as const)).map(f => (
     <button
       key={f}
       onPointerDown={e => e.stopPropagation()}
       onClick={() => setFormat(f)}
       className="px-2 py-1 rounded-md text-[9px] font-medium uppercase tracking-wide transition-all"
       style={{
         background: format === f ? 'var(--color-primary)' : 'transparent',
         color: format === f ? 'var(--color-neutral-900)' : 'var(--color-neutral-400)',
       }}
     >
       {f === 'standard' ? 'Std' :
        f === 'uiic' ? 'UIIC' :
        f === 'std-bill' ? 'Std Bill' :
        f === 'uiic-bill' ? 'UIIC Bill' :
        f === 'fee-bill' ? 'Fees' :
        f === 'valuation' ? 'Valuation' : 'Spot'}
     </button>
   ))}
   ```
