'use client';

import React, { useState, useEffect, useRef, useId } from 'react';
import {
  Clock,
  ChevronDown,
  Check,
  SlidersHorizontal,
  X,
  AlertCircle,
  Calendar,
} from 'lucide-react';

export interface ScanScope {
  daysBack: number;
  maxResults: number;
  label?: string;
  isCustom?: boolean;
}

export const PRESET_SCAN_SCOPES: ScanScope[] = [
  { daysBack: 15, maxResults: 10, label: 'Last 15 days (10 emails)' },
  { daysBack: 30, maxResults: 25, label: 'Last 30 days (25 emails)' }, // Default
  { daysBack: 60, maxResults: 50, label: 'Last 60 days (50 emails)' },
  { daysBack: 90, maxResults: 100, label: 'Last 90 days (100 emails)' },
];

export const SCAN_SCOPE_STORAGE_KEY = 'surveyos_preferred_scan_scope';

export interface ScanScopeSelectorProps {
  currentScope?: ScanScope;
  onChangeScope: (scope: ScanScope) => void;
  disabled?: boolean;
}

/**
 * Validate and clamp custom scan scope values.
 * Enforces:
 * - daysBack: between 1 and 180 (default 30)
 * - maxResults: between 5 and 100 (default 25)
 */
export function validateCustomScope(daysBackInput: number, maxResultsInput: number): ScanScope {
  const parsedDays = Number.isFinite(daysBackInput) ? Math.round(daysBackInput) : 30;
  const parsedMax = Number.isFinite(maxResultsInput) ? Math.round(maxResultsInput) : 25;

  const daysBack = Math.min(Math.max(parsedDays, 1), 180);
  const maxResults = Math.min(Math.max(parsedMax, 5), 100);

  return {
    daysBack,
    maxResults,
    label: `Custom (${daysBack}d / ${maxResults} emails)`,
    isCustom: true,
  };
}

/**
 * Resolves a human-readable display label for a scan scope.
 */
export function getScopeLabel(scope?: Partial<ScanScope> | null): string {
  if (!scope) {
    return PRESET_SCAN_SCOPES[1].label!;
  }
  if (scope.label) {
    return scope.label;
  }
  if (scope.isCustom) {
    return `Custom (${scope.daysBack ?? 30}d / ${scope.maxResults ?? 25} emails)`;
  }
  const match = PRESET_SCAN_SCOPES.find(
    (p) => p.daysBack === scope.daysBack && p.maxResults === scope.maxResults
  );
  if (match?.label) {
    return match.label;
  }
  return `Last ${scope.daysBack ?? 30} days (${scope.maxResults ?? 25} emails)`;
}

/**
 * Load preferred scan scope from localStorage.
 * Falls back safely to the 30-day preset on missing, invalid, or throwing localStorage.
 */
export function getSavedScanScope(): ScanScope {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return PRESET_SCAN_SCOPES[1];
    }
    const raw = window.localStorage.getItem(SCAN_SCOPE_STORAGE_KEY);
    if (!raw) {
      return PRESET_SCAN_SCOPES[1];
    }
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.daysBack === 'number' &&
      !isNaN(parsed.daysBack) &&
      parsed.daysBack > 0 &&
      typeof parsed.maxResults === 'number' &&
      !isNaN(parsed.maxResults) &&
      parsed.maxResults > 0
    ) {
      if (!parsed.isCustom) {
        const matchedPreset = PRESET_SCAN_SCOPES.find(
          (p) => p.daysBack === parsed.daysBack && p.maxResults === parsed.maxResults
        );
        if (matchedPreset) {
          return matchedPreset;
        }
      }
      return {
        daysBack: Math.min(Math.max(Math.round(parsed.daysBack), 1), 180),
        maxResults: Math.min(Math.max(Math.round(parsed.maxResults), 5), 100),
        label: parsed.label || `Custom (${parsed.daysBack}d / ${parsed.maxResults} emails)`,
        isCustom: Boolean(parsed.isCustom),
      };
    }
  } catch {
    // Graceful fallback if localStorage is disabled or throws
  }
  return PRESET_SCAN_SCOPES[1];
}

/**
 * Persist preferred scan scope to localStorage.
 */
export function saveScanScope(scope: ScanScope): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SCAN_SCOPE_STORAGE_KEY, JSON.stringify(scope));
    }
  } catch {
    // Safely ignore storage quota / sandbox exceptions
  }
}

export function ScanScopeSelector({
  currentScope = PRESET_SCAN_SCOPES[1],
  onChangeScope,
  disabled = false,
}: ScanScopeSelectorProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);

  // Custom modal input states
  const [inputDays, setInputDays] = useState<number>(() => currentScope?.daysBack || 30);
  const [inputMaxResults, setInputMaxResults] = useState<number>(() => currentScope?.maxResults || 25);
  const [validationHint, setValidationHint] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownId = useId();

  // Close dropdown on click outside
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  // Handle keyboard navigation (Escape to close dropdown or modal)
  useEffect(() => {
    if (!isDropdownOpen && !isCustomModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCustomModalOpen) {
          setIsCustomModalOpen(false);
        } else if (isDropdownOpen) {
          setIsDropdownOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDropdownOpen, isCustomModalOpen]);

  // Update input defaults when currentScope changes
  useEffect(() => {
    if (currentScope?.daysBack) {
      setInputDays(currentScope.daysBack);
    }
    if (currentScope?.maxResults) {
      setInputMaxResults(currentScope.maxResults);
    }
  }, [currentScope?.daysBack, currentScope?.maxResults]);

  const activeLabel = getScopeLabel(currentScope);

  const handleSelectPreset = (preset: ScanScope) => {
    saveScanScope(preset);
    onChangeScope(preset);
    setIsDropdownOpen(false);
  };

  const handleOpenCustomModal = () => {
    setInputDays(currentScope?.daysBack || 30);
    setInputMaxResults(currentScope?.maxResults || 25);
    setValidationHint(null);
    setIsDropdownOpen(false);
    setIsCustomModalOpen(true);
  };

  const handleApplyCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const validated = validateCustomScope(Number(inputDays), Number(inputMaxResults));
    saveScanScope(validated);
    onChangeScope(validated);
    setIsCustomModalOpen(false);
  };

  const handleCancelCustom = () => {
    setIsCustomModalOpen(false);
    setInputDays(currentScope?.daysBack || 30);
    setInputMaxResults(currentScope?.maxResults || 25);
    setValidationHint(null);
  };

  const handleDaysChange = (val: string) => {
    const num = parseInt(val, 10);
    setInputDays(isNaN(num) ? 0 : num);
    if (num > 180) {
      setValidationHint('Days back capped at 180 days');
    } else if (num < 1 && val !== '') {
      setValidationHint('Minimum 1 day required');
    } else {
      setValidationHint(null);
    }
  };

  const handleMaxResultsChange = (val: string) => {
    const num = parseInt(val, 10);
    setInputMaxResults(isNaN(num) ? 0 : num);
    if (num > 100) {
      setValidationHint('Search volume capped at 100 emails max');
    } else if (num < 5 && val !== '') {
      setValidationHint('Minimum 5 emails recommended');
    } else {
      setValidationHint(null);
    }
  };

  const isCurrentPreset = (preset: ScanScope) => {
    if (currentScope?.isCustom) return false;
    return (
      currentScope?.daysBack === preset.daysBack &&
      currentScope?.maxResults === preset.maxResults
    );
  };

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      {/* Scope Selector Pill Button */}
      <button
        type="button"
        id={dropdownId}
        data-testid="scan-scope-trigger"
        onClick={() => !disabled && setIsDropdownOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isDropdownOpen}
        aria-label="Select scan scope and limits"
        title="Choose date range and email limit for Gmail search"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white border border-neutral-200 text-neutral-800 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/20 ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-neutral-50 hover:border-neutral-300 cursor-pointer'
        } ${isDropdownOpen ? 'border-amber-500 ring-2 ring-amber-500/10' : ''}`}
      >
        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span className="truncate max-w-[170px]" data-testid="scan-scope-current-label">
          {activeLabel}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-neutral-400 shrink-0 transition-transform duration-150 ${
            isDropdownOpen ? 'rotate-180 text-amber-600' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div
          data-testid="scan-scope-dropdown"
          role="listbox"
          aria-labelledby={dropdownId}
          className="absolute left-0 mt-1 w-64 bg-white border border-neutral-200 rounded-lg shadow-lg z-30 py-1 text-xs divide-y divide-neutral-100"
        >
          {/* Section 1: Presets Header */}
          <div className="px-3 py-1.5 bg-neutral-50/70">
            <span className="text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
              Scan Scope & Limits
            </span>
          </div>

          {/* Section 2: Preset Options */}
          <div className="py-1">
            {PRESET_SCAN_SCOPES.map((preset) => {
              const active = isCurrentPreset(preset);
              return (
                <button
                  key={`${preset.daysBack}-${preset.maxResults}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-testid={`preset-option-${preset.daysBack}`}
                  onClick={() => handleSelectPreset(preset)}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs transition-colors ${
                    active
                      ? 'bg-amber-50 text-amber-900 font-semibold'
                      : 'text-neutral-700 hover:bg-neutral-50 font-normal'
                  }`}
                >
                  <span className="truncate">{preset.label}</span>
                  {active && <Check className="w-3.5 h-3.5 text-amber-600 shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>

          {/* Section 3: Custom Scope Option */}
          <div className="py-1">
            <button
              type="button"
              role="option"
              aria-selected={Boolean(currentScope?.isCustom)}
              data-testid="custom-scope-option"
              onClick={handleOpenCustomModal}
              className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs transition-colors ${
                currentScope?.isCustom
                  ? 'bg-amber-50 text-amber-900 font-semibold'
                  : 'text-neutral-700 hover:bg-neutral-50 font-normal'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="truncate">Custom Scope...</span>
              </div>
              {currentScope?.isCustom && (
                <Check className="w-3.5 h-3.5 text-amber-600 shrink-0 ml-2" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Custom Scope Modal / Popover */}
      {isCustomModalOpen && (
        <div
          data-testid="custom-scope-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="custom-scope-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-[1px]"
        >
          <div className="bg-white rounded-xl border border-neutral-200 shadow-xl max-w-sm w-full p-4 space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="custom-scope-title" className="text-sm font-semibold text-neutral-900">
                    Custom Scan Scope
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Set search window & email limit
                  </p>
                </div>
              </div>
              <button
                type="button"
                data-testid="custom-scope-close-btn"
                onClick={handleCancelCustom}
                aria-label="Close dialog"
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-md hover:bg-neutral-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleApplyCustom} className="space-y-3.5 text-xs">
              {/* Field 1: Days Back */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="custom-days-input"
                    className="font-medium text-neutral-700"
                  >
                    Days Back to Search
                  </label>
                  <span className="text-[11px] text-neutral-400">1 – 180 days</span>
                </div>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="custom-days-input"
                    data-testid="custom-days-input"
                    type="number"
                    min={1}
                    max={180}
                    required
                    value={inputDays || ''}
                    onChange={(e) => handleDaysChange(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-neutral-900 text-xs focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    placeholder="30"
                  />
                </div>
                <p className="text-[11px] text-neutral-500">
                  Searches messages with date filter <code className="bg-neutral-100 px-1 py-0.5 rounded text-[10px]">newer_than:{inputDays || 30}d</code>.
                </p>
              </div>

              {/* Field 2: Max Emails Limit */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="custom-max-results-input"
                    className="font-medium text-neutral-700"
                  >
                    Max Emails to Inspect
                  </label>
                  <span className="text-[11px] text-neutral-400">5 – 100 emails</span>
                </div>
                <div className="relative">
                  <Clock className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="custom-max-results-input"
                    data-testid="custom-max-results-input"
                    type="number"
                    min={5}
                    max={100}
                    required
                    value={inputMaxResults || ''}
                    onChange={(e) => handleMaxResultsChange(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-neutral-900 text-xs focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    placeholder="25"
                  />
                </div>
                <p className="text-[11px] text-neutral-500">
                  Caps search list. Settled emails are skipped automatically without AI calls.
                </p>
              </div>

              {/* Validation Warning Hint */}
              {validationHint && (
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>{validationHint}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  data-testid="cancel-custom-scope-btn"
                  onClick={handleCancelCustom}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="apply-custom-scope-btn"
                  onClick={handleApplyCustom}
                  className="px-3.5 py-1.5 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  Apply Custom Scope
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
