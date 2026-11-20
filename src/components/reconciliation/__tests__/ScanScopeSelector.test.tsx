// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import * as ReactDOMClient from 'react-dom/client';

// Configure React act environment for JSDOM
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import {
  ScanScopeSelector,
  PRESET_SCAN_SCOPES,
  SCAN_SCOPE_STORAGE_KEY,
  getSavedScanScope,
  saveScanScope,
  validateCustomScope,
  getScopeLabel,
  type ScanScope,
} from '../ScanScopeSelector';

describe('ScanScopeSelector & Helper Utilities', () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. getSavedScanScope & saveScanScope', () => {
    it('falls back gracefully to 30-day preset when localStorage is empty', () => {
      const scope = getSavedScanScope();
      expect(scope).toEqual(PRESET_SCAN_SCOPES[1]);
      expect(scope.daysBack).toBe(30);
      expect(scope.maxResults).toBe(25);
    });

    it('falls back gracefully when localStorage.getItem throws an exception', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError: Access is denied');
      });

      const scope = getSavedScanScope();
      expect(scope).toEqual(PRESET_SCAN_SCOPES[1]);
    });

    it('falls back gracefully when localStorage contains corrupted JSON', () => {
      localStorage.setItem(SCAN_SCOPE_STORAGE_KEY, 'invalid-json-content{');
      const scope = getSavedScanScope();
      expect(scope).toEqual(PRESET_SCAN_SCOPES[1]);
    });

    it('falls back gracefully when localStorage contains non-numeric or negative values', () => {
      localStorage.setItem(
        SCAN_SCOPE_STORAGE_KEY,
        JSON.stringify({ daysBack: -10, maxResults: 0 })
      );
      const scope = getSavedScanScope();
      expect(scope).toEqual(PRESET_SCAN_SCOPES[1]);
    });

    it('loads and returns matching preset when saved in localStorage', () => {
      const preset60 = PRESET_SCAN_SCOPES[2]; // 60 days, 50 emails
      localStorage.setItem(SCAN_SCOPE_STORAGE_KEY, JSON.stringify(preset60));

      const scope = getSavedScanScope();
      expect(scope).toEqual(preset60);
      expect(scope.daysBack).toBe(60);
      expect(scope.maxResults).toBe(50);
    });

    it('loads custom scope and clamps out-of-bound values safely', () => {
      localStorage.setItem(
        SCAN_SCOPE_STORAGE_KEY,
        JSON.stringify({
          daysBack: 400, // over 180
          maxResults: 250, // over 100
          isCustom: true,
        })
      );

      const scope = getSavedScanScope();
      expect(scope.isCustom).toBe(true);
      expect(scope.daysBack).toBe(180); // clamped to 180
      expect(scope.maxResults).toBe(100); // clamped to 100
    });

    it('saveScanScope saves JSON under SCAN_SCOPE_STORAGE_KEY', () => {
      const customScope: ScanScope = {
        daysBack: 45,
        maxResults: 30,
        label: 'Custom (45d / 30 emails)',
        isCustom: true,
      };

      saveScanScope(customScope);

      const stored = localStorage.getItem(SCAN_SCOPE_STORAGE_KEY);
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!)).toEqual(customScope);
    });

    it('saveScanScope handles storage quota errors gracefully', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => {
        saveScanScope(PRESET_SCAN_SCOPES[0]);
      }).not.toThrow();
    });
  });

  describe('2. validateCustomScope & getScopeLabel', () => {
    it('validates normal custom values correctly', () => {
      const result = validateCustomScope(45, 35);
      expect(result.daysBack).toBe(45);
      expect(result.maxResults).toBe(35);
      expect(result.isCustom).toBe(true);
      expect(result.label).toBe('Custom (45d / 35 emails)');
    });

    it('enforces email limit maximum of 100 emails', () => {
      const result = validateCustomScope(30, 200);
      expect(result.maxResults).toBe(100);
      expect(result.label).toContain('100 emails');
    });

    it('enforces email limit minimum of 5 emails', () => {
      const result = validateCustomScope(30, 2);
      expect(result.maxResults).toBe(5);
    });

    it('enforces days back maximum of 180 days', () => {
      const result = validateCustomScope(365, 50);
      expect(result.daysBack).toBe(180);
    });

    it('enforces days back minimum of 1 day', () => {
      const result = validateCustomScope(0, 50);
      expect(result.daysBack).toBe(1);
    });

    it('resolves labels for presets and custom scopes', () => {
      expect(getScopeLabel(PRESET_SCAN_SCOPES[0])).toBe('Last 15 days (10 emails)');
      expect(getScopeLabel(null)).toBe('Last 30 days (25 emails)');
      expect(getScopeLabel({ daysBack: 45, maxResults: 20, isCustom: true })).toBe(
        'Custom (45d / 20 emails)'
      );
    });
  });

  describe('3. ScanScopeSelector Component Rendering & Interactions', () => {
    it('renders current scope label properly', () => {
      act(() => {
        root.render(
          <ScanScopeSelector
            currentScope={PRESET_SCAN_SCOPES[0]}
            onChangeScope={vi.fn()}
          />
        );
      });

      const labelEl = container.querySelector('[data-testid="scan-scope-current-label"]');
      expect(labelEl).not.toBeNull();
      expect(labelEl?.textContent).toBe('Last 15 days (10 emails)');
    });

    it('handles undefined currentScope prop gracefully', () => {
      act(() => {
        root.render(<ScanScopeSelector onChangeScope={vi.fn()} />);
      });

      const labelEl = container.querySelector('[data-testid="scan-scope-current-label"]');
      expect(labelEl?.textContent).toBe('Last 30 days (25 emails)');
    });

    it('opens dropdown menu on trigger button click', () => {
      act(() => {
        root.render(
          <ScanScopeSelector
            currentScope={PRESET_SCAN_SCOPES[1]}
            onChangeScope={vi.fn()}
          />
        );
      });

      const trigger = container.querySelector('[data-testid="scan-scope-trigger"]') as HTMLButtonElement;
      expect(container.querySelector('[data-testid="scan-scope-dropdown"]')).toBeNull();

      act(() => {
        trigger.click();
      });

      const dropdown = container.querySelector('[data-testid="scan-scope-dropdown"]');
      expect(dropdown).not.toBeNull();
      expect(dropdown?.textContent).toContain('Last 15 days (10 emails)');
      expect(dropdown?.textContent).toContain('Last 90 days (100 emails)');
      expect(dropdown?.textContent).toContain('Custom Scope...');
    });

    it('selecting a preset invokes onChangeScope, updates localStorage, and closes dropdown', () => {
      const onChange = vi.fn();

      act(() => {
        root.render(
          <ScanScopeSelector
            currentScope={PRESET_SCAN_SCOPES[1]}
            onChangeScope={onChange}
          />
        );
      });

      // Open dropdown
      const trigger = container.querySelector('[data-testid="scan-scope-trigger"]') as HTMLButtonElement;
      act(() => {
        trigger.click();
      });

      // Click 60 days preset
      const preset60Btn = container.querySelector('[data-testid="preset-option-60"]') as HTMLButtonElement;
      expect(preset60Btn).not.toBeNull();

      act(() => {
        preset60Btn.click();
      });

      // Callback invoked with 60 days preset
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(PRESET_SCAN_SCOPES[2]);

      // LocalStorage updated
      const stored = JSON.parse(localStorage.getItem(SCAN_SCOPE_STORAGE_KEY)!);
      expect(stored.daysBack).toBe(60);
      expect(stored.maxResults).toBe(50);

      // Dropdown closed
      expect(container.querySelector('[data-testid="scan-scope-dropdown"]')).toBeNull();
    });

    it('selecting "Custom Scope..." displays custom inputs modal', () => {
      act(() => {
        root.render(
          <ScanScopeSelector
            currentScope={PRESET_SCAN_SCOPES[1]}
            onChangeScope={vi.fn()}
          />
        );
      });

      // Open dropdown
      const trigger = container.querySelector('[data-testid="scan-scope-trigger"]') as HTMLButtonElement;
      act(() => {
        trigger.click();
      });

      // Click "Custom Scope..."
      const customOption = container.querySelector('[data-testid="custom-scope-option"]') as HTMLButtonElement;
      expect(customOption).not.toBeNull();

      act(() => {
        customOption.click();
      });

      // Dropdown closes, custom modal opens
      expect(container.querySelector('[data-testid="scan-scope-dropdown"]')).toBeNull();
      const modal = container.querySelector('[data-testid="custom-scope-modal"]');
      expect(modal).not.toBeNull();

      // Check inputs exist
      const daysInput = container.querySelector('[data-testid="custom-days-input"]') as HTMLInputElement;
      const maxResultsInput = container.querySelector('[data-testid="custom-max-results-input"]') as HTMLInputElement;
      expect(daysInput).not.toBeNull();
      expect(maxResultsInput).not.toBeNull();
      expect(daysInput.value).toBe('30');
      expect(maxResultsInput.value).toBe('25');
    });

    it('applying custom scope validates inputs, enforces max 100 emails, and invokes onChangeScope', () => {
      const onChange = vi.fn();

      act(() => {
        root.render(
          <ScanScopeSelector
            currentScope={PRESET_SCAN_SCOPES[1]}
            onChangeScope={onChange}
          />
        );
      });

      // Open dropdown and then custom modal
      const trigger = container.querySelector('[data-testid="scan-scope-trigger"]') as HTMLButtonElement;
      act(() => {
        trigger.click();
      });
      const customOption = container.querySelector('[data-testid="custom-scope-option"]') as HTMLButtonElement;
      act(() => {
        customOption.click();
      });

      // Change inputs: Days = 45, Max emails = 150 (exceeds 100 cap)
      const daysInput = container.querySelector('[data-testid="custom-days-input"]') as HTMLInputElement;
      const maxResultsInput = container.querySelector('[data-testid="custom-max-results-input"]') as HTMLInputElement;

      act(() => {
        const setVal = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setVal?.call(daysInput, '45');
        daysInput.dispatchEvent(new Event('input', { bubbles: true }));

        setVal?.call(maxResultsInput, '150');
        maxResultsInput.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // Click Apply Custom Scope button
      const applyBtn = container.querySelector('[data-testid="apply-custom-scope-btn"]') as HTMLButtonElement;
      expect(applyBtn).not.toBeNull();

      act(() => {
        applyBtn.click();
      });

      // Verify onChangeScope was called with validated inputs (maxResults clamped to 100)
      expect(onChange).toHaveBeenCalledTimes(1);
      const calledArg = onChange.mock.calls[0][0] as ScanScope;
      expect(calledArg.daysBack).toBe(45);
      expect(calledArg.maxResults).toBe(100); // capped at 100!
      expect(calledArg.isCustom).toBe(true);

      // Verify localStorage was updated
      const stored = JSON.parse(localStorage.getItem(SCAN_SCOPE_STORAGE_KEY)!);
      expect(stored.daysBack).toBe(45);
      expect(stored.maxResults).toBe(100);
      expect(stored.isCustom).toBe(true);

      // Modal closed
      expect(container.querySelector('[data-testid="custom-scope-modal"]')).toBeNull();
    });

    it('cancelling custom scope closes modal without invoking onChangeScope', () => {
      const onChange = vi.fn();

      act(() => {
        root.render(
          <ScanScopeSelector
            currentScope={PRESET_SCAN_SCOPES[1]}
            onChangeScope={onChange}
          />
        );
      });

      // Open custom modal
      const trigger = container.querySelector('[data-testid="scan-scope-trigger"]') as HTMLButtonElement;
      act(() => {
        trigger.click();
      });
      const customOption = container.querySelector('[data-testid="custom-scope-option"]') as HTMLButtonElement;
      act(() => {
        customOption.click();
      });

      expect(container.querySelector('[data-testid="custom-scope-modal"]')).not.toBeNull();

      // Click Cancel button
      const cancelBtn = container.querySelector('[data-testid="cancel-custom-scope-btn"]') as HTMLButtonElement;
      act(() => {
        cancelBtn.click();
      });

      // Modal is closed and onChange is not invoked
      expect(container.querySelector('[data-testid="custom-scope-modal"]')).toBeNull();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('disabled prop prevents opening dropdown', () => {
      act(() => {
        root.render(
          <ScanScopeSelector
            currentScope={PRESET_SCAN_SCOPES[1]}
            onChangeScope={vi.fn()}
            disabled={true}
          />
        );
      });

      const trigger = container.querySelector('[data-testid="scan-scope-trigger"]') as HTMLButtonElement;
      expect(trigger.disabled).toBe(true);

      act(() => {
        trigger.click();
      });

      expect(container.querySelector('[data-testid="scan-scope-dropdown"]')).toBeNull();
    });

    it('pressing Escape closes the dropdown and custom modal', () => {
      act(() => {
        root.render(
          <ScanScopeSelector
            currentScope={PRESET_SCAN_SCOPES[1]}
            onChangeScope={vi.fn()}
          />
        );
      });

      // Open dropdown
      const trigger = container.querySelector('[data-testid="scan-scope-trigger"]') as HTMLButtonElement;
      act(() => {
        trigger.click();
      });
      expect(container.querySelector('[data-testid="scan-scope-dropdown"]')).not.toBeNull();

      // Dispatch Escape key
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });
      expect(container.querySelector('[data-testid="scan-scope-dropdown"]')).toBeNull();
    });
  });
});
