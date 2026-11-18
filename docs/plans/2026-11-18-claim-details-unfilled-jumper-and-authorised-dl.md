# Claim Details: Quick Jumper & Authorised to Drive Default Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Streamline claim details entry by defaulting "Authorised to Drive" to "YES" (removing "—") and introducing an unfilled fields "Quick Jumper" button (with Alt+J keyboard shortcut and visual pulse) to navigate directly between missing inputs.

**Architecture:** 
1. The driver form model defaults `authorisedToDrive` to `'YES'` at initialization and on mount if unset, with dropdown options restricted strictly to `Yes` and `No`.
2. A pure DOM-scanning utility (`getUnfilledFields`) identifies interactive, visible, and non-exempt empty fields while honoring "Not applicable" states and skipping disabled, hidden, and file inputs.
3. The `DetailsTab` header integrates a live counter badge button that cycles focus through unfilled fields using smooth scrolling, cursor selection, temporary ring pulse highlights, and single-toast feedback.

**Tech Stack:** Next.js 16 (React 19), TypeScript, Tailwind CSS, Lucide React, Zustand (`useClaimStore`), Sonner, Vitest.

---

### Task 1: Driving Licence "Authorised to Drive" Default to "YES" & Remove Empty Option

**Files:**
- Modify: `src/types/claim.ts:318-325`
- Modify: `src/components/claim/DriverForm.tsx:1-30, 273-286`
- Create: `src/components/claim/__tests__/DriverAuthorisedToDrive.test.tsx`

**Step 1: Write the failing test**

Create `src/components/claim/__tests__/DriverAuthorisedToDrive.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DriverDetailsForm } from '../DriverForm';
import { useClaimStore } from '@/stores/claim-store';
import { createBlankClaim } from '@/types';

vi.mock('@/stores/claim-store', () => ({
  useClaimStore: vi.fn(),
}));

vi.mock('@/hooks/useFieldEvidence', () => ({
  useFieldEvidence: () => ({
    triggerField: vi.fn(),
    hasEvidence: () => false,
  }),
}));

describe('DriverDetailsForm - authorisedToDrive', () => {
  let mockUpdateDriver: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUpdateDriver = vi.fn();
  });

  it('createBlankClaim initializes driver.authorisedToDrive to YES', () => {
    const claim = createBlankClaim('final', 'private');
    expect(claim.driver.authorisedToDrive).toBe('YES');
  });

  it('renders select with only Yes and No options (no empty or dash option)', () => {
    const claim = createBlankClaim('final', 'private');
    claim.driver.authorisedToDrive = 'YES';

    vi.mocked(useClaimStore).mockReturnValue({
      currentClaim: claim,
      updateDriver: mockUpdateDriver,
    } as any);

    const html = renderToStaticMarkup(<DriverDetailsForm />);

    expect(html).toContain('id="d-authorised"');
    expect(html).toContain('<option value="YES" selected="">Yes</option>');
    expect(html).toContain('<option value="NO">No</option>');
    expect(html).not.toContain('<option value="">—</option>');
    expect(html).not.toContain('<option value="">-</option>');
  });

  it('renders select defaulted to YES even if claim.driver.authorisedToDrive is empty', () => {
    const claim = createBlankClaim('final', 'private');
    claim.driver.authorisedToDrive = '';

    vi.mocked(useClaimStore).mockReturnValue({
      currentClaim: claim,
      updateDriver: mockUpdateDriver,
    } as any);

    const html = renderToStaticMarkup(<DriverDetailsForm />);

    expect(html).toContain('id="d-authorised"');
    expect(html).toContain('<option value="YES" selected="">Yes</option>');
    expect(html).not.toContain('<option value="">—</option>');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/claim/__tests__/DriverAuthorisedToDrive.test.tsx`
Expected: FAIL because `createBlankClaim` still initializes `authorisedToDrive` to `''` and `<option value="">—</option>` is present.

**Step 3: Implement minimal code**

1. In `src/types/claim.ts:321`, change:
```ts
      authorisedToDrive: 'YES',
```

2. In `src/components/claim/DriverForm.tsx`:
Add `useEffect` to ensure `authorisedToDrive: 'YES'` if unset on driver object:
```tsx
  useEffect(() => {
    if (d && !d.authorisedToDrive) {
      updateDriver({ authorisedToDrive: 'YES' });
    }
  }, [d?.authorisedToDrive, updateDriver]);
```
Update `#d-authorised` select:
```tsx
      <div className="space-y-1">
        <Label htmlFor="d-authorised">Authorised to Drive This Vehicle?</Label>
        <select
          id="d-authorised"
          className={selectCls}
          value={d?.authorisedToDrive || 'YES'}
          onChange={(e) => updateDriver({ authorisedToDrive: e.target.value })}
        >
          <option value="YES">Yes</option>
          <option value="NO">No</option>
        </select>
      </div>
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/claim/__tests__/DriverAuthorisedToDrive.test.tsx`
Expected: PASS (3/3 tests green)

---

### Task 2: Unfilled Fields Detection Helper & Unit Tests

**Files:**
- Create: `src/lib/claims/unfilled-fields.ts`
- Create: `src/lib/claims/__tests__/unfilled-fields.test.ts`

**Step 1: Write the failing test**

Create `src/lib/claims/__tests__/unfilled-fields.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { getUnfilledFields } from '../unfilled-fields';

describe('getUnfilledFields', () => {
  it('returns empty array when container is null', () => {
    expect(getUnfilledFields(null)).toEqual([]);
  });

  it('detects unfilled inputs and ignores filled ones', () => {
    const div = document.createElement('div');
    div.innerHTML = `
      <input id="input-filled" value="DL-12345" />
      <input id="input-empty" value="" />
      <input id="input-whitespace" value="   " />
      <input id="input-disabled" disabled value="" />
      <input id="input-readonly" readonly value="" />
      <input type="hidden" id="input-hidden" value="" />
      <input type="file" id="input-file" />
      <textarea id="ta-empty"></textarea>
      <select id="sel-unselected">
        <option value="">Select...</option>
        <option value="A">Option A</option>
      </select>
      <select id="sel-na">
        <option value="">Not applicable</option>
        <option value="A">Option A</option>
      </select>
    `;

    // Mock offsetParent for JSDOM
    const elements = div.querySelectorAll<HTMLElement>('input, textarea, select');
    elements.forEach(el => {
      Object.defineProperty(el, 'offsetParent', { get: () => div });
      el.getBoundingClientRect = () => ({ width: 100, height: 30, top: 0, left: 0, bottom: 30, right: 100, x: 0, y: 0, toJSON: () => {} });
    });

    const unfilled = getUnfilledFields(div);
    const ids = unfilled.map(el => el.id);

    expect(ids).toContain('input-empty');
    expect(ids).toContain('input-whitespace');
    expect(ids).toContain('ta-empty');
    expect(ids).toContain('sel-unselected');

    // Must NOT contain filled, disabled, readonly, hidden, file, or "not applicable"
    expect(ids).not.toContain('input-filled');
    expect(ids).not.toContain('input-disabled');
    expect(ids).not.toContain('input-readonly');
    expect(ids).not.toContain('input-hidden');
    expect(ids).not.toContain('input-file');
    expect(ids).not.toContain('sel-na');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/claims/__tests__/unfilled-fields.test.ts`
Expected: FAIL ("cannot find module ../unfilled-fields")

**Step 3: Implement minimal code**

Create `src/lib/claims/unfilled-fields.ts`:
```ts
/**
 * Scans a form container for interactive, visible fields that have not been filled.
 * Skips hidden, disabled, read-only, buttons, file pickers, and checkbox/radio controls.
 * Correctly distinguishes unselected empty options from intentional "Not applicable" options.
 */
export function getUnfilledFields(
  container: HTMLElement | null
): (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[] {
  if (!container) return [];

  const candidates = Array.from(
    container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input, textarea, select'
    )
  );

  return candidates.filter((el) => {
    // 1. Skip non-interactive or invisible elements
    if (el.disabled || ('readOnly' in el && (el as HTMLInputElement).readOnly)) return false;
    if (el.offsetParent === null) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;

    // 2. Filter input types
    if (el instanceof HTMLInputElement) {
      const type = (el.type || 'text').toLowerCase();
      if (['hidden', 'file', 'checkbox', 'radio', 'button', 'submit', 'reset'].includes(type)) {
        return false;
      }
      return el.value.trim() === '';
    }

    if (el instanceof HTMLTextAreaElement) {
      return el.value.trim() === '';
    }

    if (el instanceof HTMLSelectElement) {
      const val = el.value.trim();
      if (!val) {
        // If option is explicitly "Not applicable", don't treat it as unfilled
        const opt = el.selectedOptions?.[0];
        const text = opt?.textContent?.toLowerCase() || '';
        if (text.includes('not applicable')) return false;
        return true;
      }
      return false;
    }

    return false;
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/claims/__tests__/unfilled-fields.test.ts`
Expected: PASS

---

### Task 3: Claim Details Quick Jumper UI & Keyboard Navigation

**Files:**
- Modify: `src/components/tabs/DetailsTab.tsx`
- Create: `src/components/tabs/__tests__/DetailsTabQuickJumper.test.tsx`

**Step 1: Write the failing test**

Create `src/components/tabs/__tests__/DetailsTabQuickJumper.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DetailsTab } from '../DetailsTab';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { createBlankClaim } from '@/types';

vi.mock('@/stores/claim-store', () => ({
  useClaimStore: vi.fn(),
}));

vi.mock('@/stores/profile-store', () => ({
  useProfileStore: vi.fn(),
}));

vi.mock('@/hooks/useAIExtraction', () => ({
  useAIExtraction: () => ({
    isProcessing: false,
    progress: '',
    reviewData: null,
    triggerExtraction: vi.fn(),
    confirmApply: vi.fn(),
    cancelReview: vi.fn(),
  }),
}));

vi.mock('@/hooks/useEvidencePanel', () => ({
  useEvidencePanel: () => ({
    panelOpen: false,
    togglePanel: vi.fn(),
    containerRef: { current: null },
  }),
}));

vi.mock('@/hooks/useFieldEvidence', () => ({
  useFieldEvidence: () => ({
    triggerField: vi.fn(),
    hasEvidence: () => false,
  }),
}));

describe('DetailsTab - Quick Jumper', () => {
  it('renders the Quick Jumper button in the header with shortcut tooltip', () => {
    const claim = createBlankClaim('final', 'private');

    vi.mocked(useClaimStore).mockImplementation((selector: any) => {
      const state = {
        currentClaim: claim,
        updateClaim: vi.fn(),
        updateSpotDetails: vi.fn(),
      };
      return selector ? selector(state) : state;
    });

    vi.mocked(useProfileStore).mockImplementation((selector: any) => {
      const state = {
        getNextSpotNumber: () => 'SPOT-001',
        getNextFinalNumber: () => 'FINAL-001',
      };
      return selector ? selector(state) : state;
    });

    const html = renderToStaticMarkup(<DetailsTab />);

    expect(html).toContain('Unfilled');
    expect(html).toContain('Alt+J');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/tabs/__tests__/DetailsTabQuickJumper.test.tsx`
Expected: FAIL because `Unfilled` and `Alt+J` are not yet in `DetailsTab.tsx`.

**Step 3: Implement minimal code**

1. In `src/components/tabs/DetailsTab.tsx`:
   - Import `useEffect, useRef, useCallback` from `'react'`.
   - Import `AlertCircle, CheckCircle2` from `'lucide-react'`.
   - Import `getUnfilledFields` from `@/lib/claims/unfilled-fields`.
   - Attach `ref={formAreaRef}` and `onInput={handleContainerInput}` to the form container.
   - Implement `jumpToNextUnfilled` with smooth scroll, cursor focus/select, ring pulse (`ring-2 ring-primary ring-offset-2`), and single-slot toast.
   - Attach global `keydown` event listener for <kbd>Alt</kbd>+<kbd>J</kbd>.
   - Add button to header row next to `Evidence`:
     - If count == 0: displays `<CheckCircle2 />` "All Filled".
     - If count > 0: displays `<AlertCircle />` "Unfilled" with count badge.

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/tabs/__tests__/DetailsTabQuickJumper.test.tsx`
Expected: PASS

---

### Task 4: Full Suite Verification & Final Polish

**Step 1: TypeScript validation**
Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 2: Run targeted tests**
Run: `npx vitest run src/components/claim/__tests__ src/components/tabs/__tests__ src/lib/claims/__tests__`
Expected: ALL PASS

**Step 3: SurveyOS Scan Coupler check**
Verify coupling points: neither `version.properties` nor Scan contract files touched. Impact is 0.

---
