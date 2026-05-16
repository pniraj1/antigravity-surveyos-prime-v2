'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Plus, MessageSquare, ChevronDown } from 'lucide-react';
import type { AssessmentRow } from '@/types';
import {
  CATEGORY_BADGE_LABELS,
  CATEGORY_BADGE_COLOURS,
  type DeductionCategory,
} from '@/lib/constants/deduction-categories';

type RowContext =
  | 'depreciation-only'
  | 'fully-approved'
  | 'amount-reduced'
  | 'disallowed'
  | 'disposal'
  | 'amount-increased'
  | 'default';

const CONTEXT_CATEGORIES: Record<RowContext, DeductionCategory[]> = {
  'depreciation-only': ['depreciation'],
  'fully-approved': ['approved'],
  'amount-reduced': ['negotiated', 'overpricing', 'partial-repair'],
  // 'safe' (no damage found) is a manual surveyor judgment — shown in disallowed context
  disallowed: ['not-covered', 'previous-damage', 'wear-and-tear', 'consumable', 'safe'],
  disposal: ['salvage'],
  'amount-increased': ['negotiated'],
  default: ['negotiated', 'not-covered', 'overpricing'],
};

const REMARK_PRESETS: Record<RowContext, string[]> = {
  'depreciation-only': [],
  'fully-approved': [],
  'amount-reduced': [
    'Rates as per local market',
    'Quantity / area adjusted',
    'Used / second-hand parts',
    'Labour rate adjusted as per norms',
    'Paint area adjusted',
  ],
  disallowed: [
    'Not related to accident',
    'Pre-existing damage',
    'Not covered under policy',
    'Duplicate entry',
    'Betterment / upgrade not covered',
  ],
  disposal: ['Used / second-hand parts — no GST'],
  'amount-increased': [
    'Actual cost higher than estimate',
    'Additional hidden damage found',
  ],
  default: ['Rates as per local market', 'Not related to accident'],
};

function detectRowContext(
  row: AssessmentRow,
  autoDepRate: number,
): RowContext {
  if (!row.allowed || row.action === 'disallow') return 'disallowed';
  if (row.isDisposal) return 'disposal';
  if (row.assessed < row.estimated) return 'amount-reduced';
  if (row.assessed > row.estimated) return 'amount-increased';
  if (row.assessed === row.estimated && autoDepRate > 0) return 'depreciation-only';
  if (row.assessed === row.estimated && autoDepRate === 0) return 'fully-approved';
  return 'default';
}

function shouldAutoClassify(ctx: RowContext): DeductionCategory | null {
  if (ctx === 'depreciation-only') return 'depreciation';
  if (ctx === 'fully-approved') return 'approved';
  if (ctx === 'disposal') return 'salvage';
  return null;
}

interface SmartRemarksCellProps {
  row: AssessmentRow;
  autoDepRate: number;
  onUpdate: (updates: Partial<AssessmentRow>) => void;
}

export function SmartRemarksCell({ row, autoDepRate, onUpdate }: SmartRemarksCellProps) {
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ctx = detectRowContext(row, autoDepRate);
  const autoCategory = shouldAutoClassify(ctx);
  const categories = CONTEXT_CATEGORIES[ctx];
  const presets = REMARK_PRESETS[ctx];

  useEffect(() => {
    if (autoCategory && !row.deductionCategory) {
      onUpdate({ deductionCategory: autoCategory });
    }
  }, [autoCategory, row.deductionCategory, onUpdate]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCustomMode(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (customMode && inputRef.current) inputRef.current.focus();
  }, [customMode]);

  const currentCat = row.deductionCategory;
  const currentColour = currentCat ? CATEGORY_BADGE_COLOURS[currentCat] : null;
  const currentLabel = currentCat ? CATEGORY_BADGE_LABELS[currentCat] : null;

  function selectCategory(cat: DeductionCategory) {
    onUpdate({ deductionCategory: currentCat === cat ? undefined : cat });
  }

  function selectPreset(text: string) {
    onUpdate({ remarks: text });
    setOpen(false);
  }

  function submitCustom() {
    if (customText.trim()) {
      onUpdate({ remarks: customText.trim() });
    }
    setCustomMode(false);
    setOpen(false);
    setCustomText('');
  }

  return (
    <div className="relative" ref={popoverRef}>
      {/* Collapsed badge */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border transition-all cursor-pointer ${
          currentCat
            ? 'opacity-100'
            : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100 hover:text-gray-600'
        }`}
        style={currentColour ? { backgroundColor: currentColour.bg, color: currentColour.text, borderColor: `${currentColour.text}33` } : undefined}
        title={row.remarks || currentLabel || 'Add remark'}
      >
        {currentCat ? (
          <>
            {currentLabel}
            {row.remarks && <MessageSquare size={8} className="ml-0.5 opacity-60" />}
          </>
        ) : (
          <>
            <Plus size={10} />
            <span>Tag</span>
          </>
        )}
        <ChevronDown size={8} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded popover */}
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg p-2 space-y-2">
          {/* Category pills — only relevant ones */}
          <div className="flex flex-wrap gap-1">
            {categories.map(cat => {
              const colour = CATEGORY_BADGE_COLOURS[cat];
              const isSelected = currentCat === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => selectCategory(cat)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all ${
                    isSelected ? 'ring-1 ring-offset-1' : 'opacity-60 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: colour.bg,
                    color: colour.text,
                    borderColor: `${colour.text}33`,
                    ...(isSelected ? { ringColor: colour.text } : {}),
                  }}
                >
                  {CATEGORY_BADGE_LABELS[cat]}
                </button>
              );
            })}
          </div>

          {/* Remark presets */}
          {presets.length > 0 && (
            <div className="border-t border-gray-100 pt-1.5">
              <div className="text-[9px] font-medium text-gray-400 uppercase tracking-wider mb-1">Remark</div>
              <div className="space-y-0.5">
                {presets.map(text => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => selectPreset(text)}
                    className={`w-full text-left px-2 py-1 rounded text-[11px] transition-colors ${
                      row.remarks === text
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {text}
                  </button>
                ))}
                {!customMode ? (
                  <button
                    type="button"
                    onClick={() => { setCustomMode(true); setCustomText(row.remarks || ''); }}
                    className="w-full text-left px-2 py-1 rounded text-[11px] text-gray-400 hover:bg-gray-50 italic"
                  >
                    Custom...
                  </button>
                ) : (
                  <div className="flex gap-1 mt-1">
                    <input
                      ref={inputRef}
                      value={customText}
                      onChange={e => setCustomText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') submitCustom(); if (e.key === 'Escape') { setCustomMode(false); } }}
                      className="flex-1 h-6 px-2 text-[11px] rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Type remark..."
                    />
                    <button
                      type="button"
                      onClick={submitCustom}
                      className="px-2 h-6 text-[10px] font-medium bg-primary text-white rounded hover:bg-primary/90"
                    >
                      OK
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Show current remark if it doesn't match any preset */}
          {row.remarks && !presets.includes(row.remarks) && !customMode && (
            <div className="border-t border-gray-100 pt-1.5">
              <div className="text-[9px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Current</div>
              <div className="text-[11px] text-gray-600 px-1 italic truncate" title={row.remarks}>
                &ldquo;{row.remarks}&rdquo;
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
