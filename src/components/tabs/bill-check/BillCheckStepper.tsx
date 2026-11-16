'use client';

import React, { useMemo } from 'react';
import { Layers, CheckCircle2, Sparkles, ShieldAlert, List } from 'lucide-react';
import { useClaimStore } from '@/stores/claim-store';
import type { TallyStage } from '@/stores/slices/tallySlice';
import type { AssessmentRow, ExtraBillItem, BillItem } from '@/types/assessment';
import { normPart } from '@/lib/reports/bill-match-score';
import { matchStage1PartNumbers } from '@/lib/tally/stage1-part-number';
import { matchStage2NameAndCost } from '@/lib/tally/stage2-name-cost';
import { segregateStage4Tally } from '@/lib/tally/stage4-tally-matrix';

export interface BillCheckStepperProps {
  activeStage?: TallyStage;
  onStageChange?: (stage: TallyStage) => void;
  stageCounts?: {
    stage1?: number;
    stage2?: number;
    stage3?: number;
    stage4?: number;
  };
  rows?: AssessmentRow[];
  extraBillItems?: ExtraBillItem[];
  className?: string;
}

function extraToBillItem(e: ExtraBillItem, idx: number): BillItem {
  return {
    idx,
    srNo: e.srNo ?? idx + 1,
    description: e.description,
    partNumber: e.partNumber || '',
    taxableAmount: e.taxableAmount,
    totalAmount: e.amount,
    gstPercent: e.gstPercent,
    section: (e.section === 'parts' || e.section === 'labour' || e.section === 'paint') ? e.section : 'parts',
    category: e.category,
    raw: e,
  };
}

export function isPartNumberMatched(row: AssessmentRow): boolean {
  if (!row.refMatch?.bill) return false;
  const rowPn = normPart(row.partNumber);
  const billPn = normPart(row.refMatch.bill.partNumber);
  if (rowPn && billPn && rowPn === billPn) return true;
  return row.refMatch.reasons?.some((r) => r.toLowerCase().includes('part')) || (row.refMatch as any).reason === 'part';
}

export function isSemanticMatched(row: AssessmentRow): boolean {
  if (!row.refMatch?.bill) return false;
  return !isPartNumberMatched(row);
}

export function BillCheckStepper({
  activeStage: propActiveStage,
  onStageChange,
  stageCounts: propStageCounts,
  rows: propRows,
  extraBillItems: propExtraBillItems,
  className = '',
}: BillCheckStepperProps) {
  const storeActiveStage = useClaimStore((s) => s.activeTallyStage);
  const setStoreTallyStage = useClaimStore((s) => s.setTallyStage);
  const storeClaim = useClaimStore((s) => s.currentClaim);
  const currentClaim = (storeClaim?.assessmentRows?.length ?? 0) > 0 ? storeClaim : (useClaimStore.getState().currentClaim ?? storeClaim);

  const activeStage = propActiveStage ?? storeActiveStage ?? 1;

  const handleStageSelect = (stage: TallyStage) => {
    if (onStageChange) {
      onStageChange(stage);
    } else {
      setStoreTallyStage(stage);
    }
  };

  const calculatedCounts = useMemo(() => {
    const rows = propRows ?? currentClaim?.assessmentRows ?? [];
    const extraItems = propExtraBillItems ?? currentClaim?.extraBillItems ?? [];

    // Part number matches: existing in rows + candidate matches
    const existingS1 = rows.filter((r) => isPartNumberMatched(r));
    const s1Verified = existingS1.filter((r) => r.billVerified === true).length;

    const unmatchedRows = rows.filter(
      (r) => !r.refMatch && r.allowed && r.billStatus !== 'not-in-bill' && r.billedTaxable === undefined
    );
    const billLines = extraItems.map((e, idx) => extraToBillItem(e, idx));

    const s1Result = matchStage1PartNumbers(unmatchedRows, billLines);
    const stage1Count = existingS1.length + s1Result.matches.length;

    // Stage 2: Name & Price
    const existingS2 = rows.filter((r) => isSemanticMatched(r));
    const s2Verified = existingS2.filter((r) => r.billVerified === true).length;

    const s2Result = matchStage2NameAndCost(s1Result.unmatchedRows, s1Result.unmatchedLines);
    const stage2Count = existingS2.length + s2Result.matches.length;

    // Stage 3: Remaining items needing AI
    const stage3Count = s2Result.unmatchedRows.length;

    // Stage 4: Disallowed & Tally segregation
    const s4Matrix = segregateStage4Tally(rows, s2Result.unmatchedLines);
    const stage4Count = s4Matrix.disallowedBilled.length + s4Matrix.savings.length + s4Matrix.extraBillItems.length;

    return {
      stage1: stage1Count,
      stage2: stage2Count,
      stage3: stage3Count,
      stage4: stage4Count,
      s1Confirmed: stage1Count > 0 && s1Verified === existingS1.length && s1Result.matches.length === 0,
      s2Confirmed: stage2Count > 0 && s2Verified === existingS2.length && s2Result.matches.length === 0,
    };
  }, [currentClaim]);

  const counts = {
    stage1: propStageCounts?.stage1 ?? calculatedCounts.stage1,
    stage2: propStageCounts?.stage2 ?? calculatedCounts.stage2,
    stage3: propStageCounts?.stage3 ?? calculatedCounts.stage3,
    stage4: propStageCounts?.stage4 ?? calculatedCounts.stage4,
  };

  const isStageConfirmed = (stageNum: number) => {
    if (typeof activeStage === 'number' && activeStage > stageNum) return true;
    if (stageNum === 1 && calculatedCounts.s1Confirmed) return true;
    if (stageNum === 2 && calculatedCounts.s2Confirmed) return true;
    return false;
  };

  const stages = [
    {
      id: 1 as TallyStage,
      stageNum: 1,
      label: 'Part Numbers',
      icon: Layers,
      count: counts.stage1,
      confirmed: isStageConfirmed(1),
    },
    {
      id: 2 as TallyStage,
      stageNum: 2,
      label: 'Name & Price',
      icon: CheckCircle2,
      count: counts.stage2,
      confirmed: isStageConfirmed(2),
    },
    {
      id: 3 as TallyStage,
      stageNum: 3,
      label: 'Ask AI',
      icon: Sparkles,
      count: counts.stage3,
      confirmed: isStageConfirmed(3),
    },
    {
      id: 4 as TallyStage,
      stageNum: 4,
      label: 'Disallowed & Tally',
      icon: ShieldAlert,
      count: counts.stage4,
      confirmed: isStageConfirmed(4),
    },
  ];

  const isGridActive = activeStage === 'grid';

  return (
    <nav
      aria-label="Progressive Tally Cockpit Stages"
      className={`w-full bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* 4-Stage Stepper Buttons */}
        <div role="tablist" aria-orientation="horizontal" className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          {stages.map((st) => {
            const isActive = activeStage === st.id;
            const isConfirmed = st.confirmed;
            const Icon = st.icon;

            let buttonStyle = 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700/80';
            let badgeStyle = 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
            let iconStyle = 'text-slate-500 dark:text-slate-400';

            if (isActive) {
              // Design System: Blue for active
              buttonStyle = 'bg-blue-600 text-white border-blue-600 shadow-sm ring-1 ring-blue-700 dark:bg-blue-600 dark:text-white dark:border-blue-600';
              badgeStyle = 'bg-blue-700/80 text-blue-100 dark:bg-blue-700/90 dark:text-blue-50';
              iconStyle = 'text-white';
            } else if (isConfirmed) {
              // Design System: Emerald for confirmed/clean
              buttonStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-950/60';
              badgeStyle = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200';
              iconStyle = 'text-emerald-600 dark:text-emerald-400';
            }

            return (
              <button
                key={st.id}
                role="tab"
                id={`tally-stage-tab-${st.id}`}
                aria-selected={isActive}
                aria-controls={`tally-stage-panel-${st.id}`}
                onClick={() => handleStageSelect(st.id)}
                className={`min-h-[44px] px-3.5 py-2 rounded-lg border text-xs font-semibold inline-flex items-center gap-2 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 select-none ${buttonStyle}`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${iconStyle}`} aria-hidden="true" />
                <span className="whitespace-nowrap">
                  <span className="opacity-70 mr-1">Stage {st.stageNum}:</span>
                  {st.label}
                </span>
                <span
                  className={`ml-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold tracking-tight shrink-0 ${badgeStyle}`}
                  aria-label={`${st.count} items in ${st.label}`}
                >
                  {st.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Toggle Full Grid Button */}
        <div className="shrink-0 pl-1 border-l border-slate-200 dark:border-slate-800">
          <button
            type="button"
            role="button"
            aria-pressed={isGridActive}
            aria-label="Toggle Full Grid View"
            onClick={() => handleStageSelect(isGridActive ? 1 : 'grid')}
            className={`min-h-[44px] px-3.5 py-2 rounded-lg border text-xs font-semibold inline-flex items-center gap-2 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 select-none ${
              isGridActive
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-1 ring-blue-700 dark:bg-blue-600 dark:text-white'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700/80'
            }`}
          >
            <List
              className={`w-4 h-4 shrink-0 ${isGridActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}
              aria-hidden="true"
            />
            <span className="whitespace-nowrap">Show Full Grid</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
