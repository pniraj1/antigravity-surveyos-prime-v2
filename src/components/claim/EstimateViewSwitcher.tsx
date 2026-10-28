'use client';

import React, { useMemo } from 'react';
import type { AssessmentRow } from '@/types';
import { Layers } from 'lucide-react';

export interface EstimateViewSwitcherProps {
  rows: AssessmentRow[];
  activeEstimateId: string | 'all';
  onSelectEstimate: (estimateId: string | 'all') => void;
}

export interface EstimateGroupInfo {
  id: string;
  label: string;
  count: number;
}

export function parseEstimateLabel(estimateId: string): string {
  if (!estimateId) return 'Manual / Untagged';
  // E.g. "Dhanashree Sales & Service-EST/23/04-2024-04-12"
  const parts = estimateId.split('-');
  const name = parts[0]?.trim() || estimateId;
  const num = parts[1]?.trim();
  if (name.length > 20) {
    return num ? `${name.slice(0, 18)}… #${num}` : `${name.slice(0, 18)}…`;
  }
  return num ? `${name} #${num}` : name;
}

export function EstimateViewSwitcher({
  rows,
  activeEstimateId,
  onSelectEstimate,
}: EstimateViewSwitcherProps) {
  const groups = useMemo(() => {
    const counts: Record<string, number> = {};
    rows.forEach((r) => {
      const id = r.estimateId || '__untagged__';
      counts[id] = (counts[id] || 0) + 1;
    });

    const list: EstimateGroupInfo[] = [];
    Object.entries(counts).forEach(([id, count]) => {
      if (id === '__untagged__') {
        list.push({ id, label: 'Manual / Other', count });
      } else {
        list.push({ id, label: parseEstimateLabel(id), count });
      }
    });
    return list;
  }, [rows]);

  // If there are less than 2 distinct groups, no switcher needed
  if (groups.length < 2) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 border-b border-border text-xs overflow-x-auto">
      <span className="flex items-center gap-1 font-medium text-muted-foreground shrink-0 mr-1">
        <Layers size={13} className="text-primary" />
        <span>View Lens:</span>
      </span>

      <button
        type="button"
        onClick={() => onSelectEstimate('all')}
        className={`px-2.5 py-1 rounded-md font-medium transition-colors shrink-0 ${
          activeEstimateId === 'all'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'bg-background hover:bg-muted text-foreground border border-border/60'
        }`}
      >
        All Quotations ({rows.length})
      </button>

      {groups.map((g) => {
        const isActive = activeEstimateId === g.id;
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onSelectEstimate(g.id)}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors shrink-0 ${
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-background hover:bg-muted text-foreground border border-border/60'
            }`}
            title={g.id !== '__untagged__' ? g.id : undefined}
          >
            {g.label} ({g.count})
          </button>
        );
      })}
    </div>
  );
}
