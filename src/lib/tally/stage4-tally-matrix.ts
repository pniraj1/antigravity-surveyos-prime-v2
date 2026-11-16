import type { AssessmentRow } from '@/types/assessment';
import type { BillItem } from '@/stores/slices/aiDataSlice';

export interface DisallowedBilledRow {
  row: AssessmentRow;
  billedTaxable: number;
  liability: 0;
  remark: string;
}

export interface InsurerSavingRow {
  row: AssessmentRow;
  savedAmount: number;
}

export interface Stage4TallyMatrix {
  allowedBilled: AssessmentRow[];
  disallowedBilled: DisallowedBilledRow[];
  savings: InsurerSavingRow[];
  extraBillItems: BillItem[];
  totalSaved: number;
}

export function segregateStage4Tally(
  rows: AssessmentRow[],
  extraLines: BillItem[]
): Stage4TallyMatrix {
  const allowedBilled: AssessmentRow[] = [];
  const disallowedBilled: DisallowedBilledRow[] = [];
  const savings: InsurerSavingRow[] = [];

  for (const r of rows) {
    if (!r.allowed) {
      if ((r.billedTaxable ?? 0) > 0) {
        disallowedBilled.push({
          row: r,
          billedTaxable: r.billedTaxable ?? 0,
          liability: 0,
          remark: `Workshop claimed ₹${r.billedTaxable}; disallowed at survey.`,
        });
      }
    } else {
      if (r.billedTaxable !== undefined && r.billStatus !== 'not-in-bill') {
        allowedBilled.push(r);
      } else {
        savings.push({
          row: r,
          savedAmount: r.assessed,
        });
      }
    }
  }

  const totalSaved = savings.reduce((sum, s) => sum + s.savedAmount, 0);

  return {
    allowedBilled,
    disallowedBilled,
    savings,
    extraBillItems: extraLines,
    totalSaved,
  };
}
