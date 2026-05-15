'use client';

import { useState } from 'react';

interface DepreciationRow {
  particulars: string;
  billed: number;
  assessed: number;
  deductionAmount: number;
}

interface DepreciationBreakdownTableProps {
  breakdown: DepreciationRow[];
  total: number;
}

export function DepreciationBreakdownTable({ breakdown, total }: DepreciationBreakdownTableProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between py-2">
        <div>
          <span className="text-sm font-medium">Depreciation on parts</span>
          <p className="text-xs text-muted-foreground mt-0.5">
            Applied to {breakdown.length} part{breakdown.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-destructive">
            − ₹{total.toLocaleString('en-IN')}
          </span>
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-primary underline underline-offset-2"
          >
            {expanded ? 'Hide ▴' : 'Show breakdown ▾'}
          </button>
        </div>
      </div>

      {expanded && (
        <table className="w-full text-xs mt-1 border rounded overflow-hidden">
          <thead>
            <tr className="bg-muted text-muted-foreground text-left">
              <th className="p-2 font-medium">Part</th>
              <th className="p-2 font-medium text-right">Billed</th>
              <th className="p-2 font-medium text-right">Assessed</th>
              <th className="p-2 font-medium text-right">Deduction</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((row, i) => (
              <tr key={i} className="border-t">
                <td className="p-2">{row.particulars}</td>
                <td className="p-2 text-right">₹{row.billed.toLocaleString('en-IN')}</td>
                <td className="p-2 text-right">₹{row.assessed.toLocaleString('en-IN')}</td>
                <td className="p-2 text-right text-destructive">
                  ₹{row.deductionAmount.toLocaleString('en-IN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
