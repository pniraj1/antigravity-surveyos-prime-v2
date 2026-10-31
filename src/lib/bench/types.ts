export type BenchSection = 'spare_parts' | 'labour_items' | 'painting_items';
export interface EstimateSpan { label: string; firstPage: number; lastPage: number; grandTotal: number | null; subtotals?: Partial<Record<BenchSection, number>> }
/** Pages are 1-based. */
export interface PdfProfile { id: string; fileName: string; kind: 'digital' | 'scan' | 'mixed'; pageCount: number; estimates: EstimateSpan[]; unreadablePages: number[]; confirmed: boolean }
/** page: 1-based, first page of the call that produced the row. */
export interface BenchRow { section: BenchSection; srNo: number | null; description: string; qty: number | null; rate: number | null; amount: number; page: number }
export type ErrorType = 'missed' | 'invented' | 'duplicated' | 'wrong_amount' | 'wrong_order' | 'totals_mismatch' | 'broken_reply' | 'rate_limited' | 'unreadable';
export interface BenchError { type: ErrorType; estimate: string; page: number | null; srNo: number | null; detail: string }
export const COUNTS_AGAINST_MODEL: ReadonlySet<ErrorType> = new Set<ErrorType>([
  'missed', 'invented', 'duplicated', 'wrong_amount', 'wrong_order', 'totals_mismatch', 'broken_reply',
]);
