'use client';

import { DecimalInput } from '@/components/claim/DecimalInput';
import { useState, useEffect, useMemo, type ClipboardEvent, type KeyboardEvent } from 'react';
import { AlertCircle, Trash2, FileSearch, PlusCircle, PackageX } from 'lucide-react';
import { ColumnPicker } from '@/components/claim/ColumnPicker';
import { useEvidenceStore } from '@/components/evidence/DocumentEvidenceViewer';
import { useClaimStore } from '@/stores/claim-store';
import type { AssessmentRow, AssessmentSummary, ClaimData } from '@/types';
import type { ExtraBillItem, AssessmentSection } from '@/types/assessment';
import { shouldStartSupplementaryBand, withGst } from '@/lib/calculations/utils';
import { computeRowNet } from '@/lib/calculations';
import { rowDepRate } from '@/lib/calculations/row-dep-rate';
import { billCheckAssessed } from '@/lib/reports/bill-check-projection';
import {
  sectionSubtotals, billedTotals, SECTION_ORDER, type BilledTotals,
} from '@/lib/calculations/section-subtotals';
import { sectionTickState, useGridSelection, clampRangeToSection } from '@/components/claim/useGridSelection';
import { duplicateParticularsOf, normParticulars, rowTintClass, deleteRowWithUndo } from '@/components/claim/assessment-grid-config';
import {
  OptionalColumn, OPTIONAL_COLUMNS, type ColumnMeta, DEFAULT_VISIBLE, COL_WIDTHS,
  loadVisibility, saveVisibility, statusLabel, statusOptions, type BillStatus,
} from './config';
import { GRID_COLUMNS } from '@/components/claim/grid-columns';
import { AllowanceScopeDialog } from '@/components/dialogs/AllowanceScopeDialog';
import { AllowanceInput } from './AllowanceInput';
import { FormulaNumericInput } from '@/components/claim/FormulaNumericInput';
import { billCheckFlags, type BillFlag } from '@/lib/reports/bill-check-flags';
import { isFromBill, uploadLabels, selfBilled } from '@/lib/reports/bill-check-mode';

const FROM_BILL_LOCK = "Billed at the bill's own figure (this claim is made from the bill).";
import { BillCheckFlagMark, BillCheckFlagDetail, BillCheckMatchDetail } from './BillCheckFlagRow';
import { useColumnResize } from '@/hooks/useColumnResize';
import { overBilledRows } from '@/lib/calculations/estimate-floor';
import { toast } from 'sonner';
import { buildBillItems } from '@/stores/slices/aiDataSlice';
import { columnValues, moveTarget, planColumnFill, type FillColumn, type MoveKey } from '@/lib/reports/grid-fill';
import { parseRefPaste, planRefPaste, type ReadLine, type RowUpdate } from '@/lib/reports/ref-paste';

/** Bill Check rows are the assessment's rows: deleting here deletes there too. */
const ALSO_REMOVES =
  'This also removes it from the Assessment tab and the Final Survey Report. It cannot be undone.';

/**
 * Rows of a section the grid lists. Allowed only is the default view; the wider
 * view also lists disallowed rows the workshop billed anyway.
 */
export function billCheckRowsShown(
  rows: AssessmentRow[], section: AssessmentSection, allowedOnly: boolean,
): AssessmentRow[] {
  return rows.filter(
    r => r.section === section && (r.allowed || (!allowedOnly && (r.billedAmount ?? 0) > 0)),
  );
}

/** Billed figures a section footer shows. Allowed rows only, whatever the view. */
/** Selected ids that are on screen: Delete Selected must never reach rows a filter hides. */
export function deletableSelection(selected: ReadonlySet<string>, shownIds: ReadonlySet<string>): string[] {
  return Array.from(selected).filter(id => shownIds.has(id));
}

/** Column picker entries; the two price columns carry the same case labels as the headers. */
export function pickerColumns(
  columns: readonly ColumnMeta[], labels: { base: string; amount: string },
): ColumnMeta[] {
  return columns.map(c =>
    c.key === 'unitPrice' ? { ...c, label: `${labels.base === 'Billed' ? 'Bill' : labels.base} (taxable)` }
    : c.key === 'billedTaxable' ? { ...c, label: `${labels.amount} (taxable)` }
    : c);
}

export function sectionFooterTotals(
  rows: AssessmentRow[], section: AssessmentSection, allowedOnly: boolean, fromBill: boolean,
): BilledTotals {
  return gridTotals(billCheckRowsShown(rows, section, allowedOnly).filter(r => r.allowed), fromBill);
}

/**
 * Totals in the grid's column terms: BASE (estimated) is the row's own figure in
 * both cases; UPLOADED is the bill (case 1) or the uploaded estimate (case 2).
 * billedTotals alone swaps these for from-bill claims, so it is not used as is.
 */
export function gridTotals(rows: AssessmentRow[], fromBill: boolean): BilledTotals {
  const t = billedTotals(rows, fromBill);
  return { ...t, estimated: billedTotals(rows, false).estimated, billedTaxable: fromBill ? t.estimated : t.billedTaxable };
}

/** Counts over the rows the grid lists, so buttons and headers match the screen. */
export function billCheckCounts(
  rows: AssessmentRow[], allowedOnly: boolean,
): { shown: number; uncertain: number } {
  const shown = SECTION_ORDER.flatMap(({ section }) => billCheckRowsShown(rows, section, allowedOnly));
  return {
    shown: shown.length,
    uncertain: shown.filter(r => r.refStatus === 'ambiguous' || (r.allowed && !r.refSrNo)).length,
  };
}

interface Props {
  allRows: AssessmentRow[];
  allowedRows: AssessmentRow[];
  /** Engine summary — the source of the per-section assessed subtotals. */
  summary: AssessmentSummary;
  /** Row id → the serial the insurer reads in both PDFs. */
  serials: Map<string, number>;
  updateAssessmentRow: (id: string, updates: Partial<AssessmentRow>) => void;
  deleteAssessmentRow: (id: string) => void;
  deleteAssessmentRows: (ids: string[]) => void;
  claimId: string | null;
  fmt: (n: number) => string;
  /** Vehicle age at the date of loss — feeds the same rate table the report reads. */
  ageMonths: number;
  /** The claim in scope — carries the paint-material-depreciation settings. */
  claim: ClaimData;
  /** Rendered inside the scroll box after the last row, pinned left so it stays put when scrolling sideways. */
  after?: React.ReactNode;
}

export function BillCheckGrid({
  allRows,
  allowedRows,
  summary,
  serials,
  updateAssessmentRow,
  deleteAssessmentRows,
  claimId,
  fmt,
  ageMonths,
  claim,
  after,
}: Props) {
  // Same rate the report computes, so the grid and the PDF cannot disagree.
  const depRateFor = (row: AssessmentRow) => rowDepRate(row, ageMonths, claim);

  /**
   * The row as this document values it. computeRowNet reads `assessed`, so a
   * raw row makes the screen ignore an allowance the report already applied.
   */
  const asBilled = (row: AssessmentRow): AssessmentRow =>
    ({ ...row, assessed: billCheckAssessed(row) });
  const { width: particularsWidth, resizeHandleProps: particularsResizeHandleProps } = useColumnResize({
    storageKey: 'surveyos_billcheck_particulars_width',
    defaultWidth: 240,
    minWidth: 160,
    maxWidth: 750,
  });
  const [visible, setVisible] = useState<Record<OptionalColumn, boolean>>(DEFAULT_VISIBLE);
  const [pendingAllowance, setPendingAllowance] = useState<{ id: string; assessed: number; proposed: number } | null>(null);
  const [openFlag, setOpenFlag] = useState<string | null>(null);
  const [filterUncertain, setFilterUncertain] = useState(false);
  const [allowedOnly, setAllowedOnly] = useState(true);
  const addAssessmentRowToSection = useClaimStore(s => s.addAssessmentRowToSection);
  const linkExtraBillItem = useClaimStore(s => s.linkExtraBillItem);
  const unlinkBillMatch = useClaimStore(s => s.unlinkBillMatch);
  const updateClaim = useClaimStore(s => s.updateClaim);

  const { shown: shownCount, uncertain: uncertainCount } = useMemo(
    () => billCheckCounts(allRows, allowedOnly),
    [allRows, allowedOnly],
  );
  const labels = uploadLabels(claim);
  const defaultRefTitle = labels.itemNo;
  const refColTitle = claim?.billCheck?.refColumnTitle || defaultRefTitle;

  const fromBill = isFromBill(claim);
  const flagsByRow = useMemo(() => {
    const m = new Map<string, BillFlag>();
    // First flag per row wins: a doubtful match is settled before its price.
    for (const f of billCheckFlags(allRows, fromBill)) if (!m.has(f.rowId)) m.set(f.rowId, f);
    return m;
  }, [allRows, fromBill]);

  // Flagged rows in on-screen order: section by section, same rows the grid shows.
  const flaggedIds = SECTION_ORDER.flatMap(({ section }) =>
    billCheckRowsShown(allRows, section, allowedOnly)
      .filter(r => flagsByRow.has(r.id))
      .map(r => r.id),
  );
  const flagPos = openFlag ? flaggedIds.indexOf(openFlag) : -1;

  // Same rows, same order as the grid shows them; pool ignores the "needs a ref" filter.
  const screenRows = () => {
    const pool = SECTION_ORDER.flatMap(({ section }) => billCheckRowsShown(allRows, section, allowedOnly));
    const onScreen = filterUncertain
      ? pool.filter(r => r.refStatus === 'ambiguous' || (r.allowed && !r.refSrNo))
      : pool;
    return { pool, onScreen };
  };

  // The Assessment grid's selection, over the rows this grid shows (same order).
  const onScreen = screenRows().onScreen;
  const selection = useGridSelection(onScreen);
  const { selected, cellSelection, setCellSelection } = selection;
  const duplicates = useMemo(() => duplicateParticularsOf(allRows), [allRows]);
  /**
   * Rows of the selected cells, top to bottom: one column, one section, as in Assessment.
   * With `at`, only when that box is inside the selection (Tab or Shift+→ may have left it).
   */
  const selRows = (at?: HTMLElement): AssessmentRow[] => {
    if (!cellSelection) return [];
    const ids = clampRangeToSection(onScreen, cellSelection.anchorRowId, cellSelection.focusRowId);
    if (at && (at.dataset.bcCol !== cellSelection.columnKey || !ids.has(at.dataset.bcRow ?? ''))) return [];
    return onScreen.filter(r => ids.has(r.id));
  };
  /** data-sel marks a selected cell; the grid draws the blue outline from it. */
  const cs = (rowId: string, col: string) => selection.isCellSelected(rowId, col) || undefined;
  /** What a box shows, read from the screen so copy and fill use the figure the surveyor sees. */
  const shownValue = (root: HTMLElement, rowId: string, col: string) =>
    root.querySelector<HTMLInputElement>(`[data-bc-row="${CSS.escape(rowId)}"][data-bc-col="${col}"]`)?.value ?? '';

  const FILL_COLS: readonly string[] = ['gst', 'disposalPercent', 'billAllowed', 'depOverride', 'billedTaxable', 'billRemarks'];
  const ARROWS: readonly string[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

  /**
   * Shift+arrows move between editable boxes, as in the Assessment tab.
   * In a text box plain ↑/↓ and Enter move a row too, like Excel; a dropdown
   * keeps plain arrows for choosing. Ctrl+D copies the box above into this one.
   */
  const handleGridKeys = (e: KeyboardEvent<HTMLElement>) => {
    const t = e.target as HTMLElement;
    if (e.key === 'Escape') setCellSelection(null);
    if (!t.dataset?.bcRow) return;
    const els = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-bc-row][data-bc-col]'))
      .filter(el => !(el as HTMLInputElement).disabled);
    const cells = els.map(el => ({ row: el.dataset.bcRow!, col: el.dataset.bcCol! }));
    const here = { row: t.dataset.bcRow, col: t.dataset.bcCol! };
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      const rows = selRows(t);
      if (rows.length >= 2) { // fill the selection with its top cell, as in Assessment
        const col = cellSelection!.columnKey;
        const top = shownValue(e.currentTarget, rows[0].id, col);
        fillColumn(col, rows.slice(1).map(() => top), rows[1].id);
        return;
      }
      const above = moveTarget(cells, here, 'ArrowUp');
      if (above !== null) fillColumn(here.col, [(els[above] as HTMLInputElement).value ?? ''], here.row);
      return;
    }
    const isTextBox = (t instanceof HTMLInputElement && t.type === 'text') || t instanceof HTMLTextAreaElement;
    const isTab = e.key === 'Tab';
    const plain = !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && isTextBox;
    const key = e.key === 'Enter' && plain ? 'ArrowDown'
      : isTab ? (e.shiftKey ? 'ArrowLeft' : 'ArrowRight')
      : (e.shiftKey && ARROWS.includes(e.key)) || (plain && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) ? e.key
      : null;
    if (!key) return;
    e.preventDefault(); // never let Shift+arrow change a select, even at the edges
    const to = moveTarget(cells, here, key as MoveKey, isTab);
    if (to === null) return;
    const next = els[to];
    next.focus();
    if (next instanceof HTMLInputElement && next.type === 'text') next.select();
    if (key !== 'ArrowUp' && key !== 'ArrowDown') return;
    const nextRow = next.dataset.bcRow!;
    // Shift extends the selection down the column; a plain move starts it afresh.
    setCellSelection(prev => e.shiftKey
      ? (prev && prev.columnKey === here.col ? { ...prev, focusRowId: nextRow } : { columnKey: here.col, anchorRowId: here.row, focusRowId: nextRow })
      : { columnKey: here.col, anchorRowId: nextRow, focusRowId: nextRow });
  };

  /** Ctrl+C on two or more selected cells copies them one per line, for Excel. */
  const handleCopy = (e: ClipboardEvent<HTMLElement>) => {
    const rows = selRows(e.target as HTMLElement);
    if (rows.length < 2) return;
    e.clipboardData.setData('text/plain', rows.map(r => shownValue(e.currentTarget, r.id, cellSelection!.columnKey)).join('\n'));
    e.preventDefault();
  };

  /** A column pasted from Excel into any editable column but Ref No (that has its own paste). */
  const handleColumnPaste = (e: ClipboardEvent<HTMLElement>) => {
    const t = e.target as HTMLElement;
    const col = t.dataset?.bcCol;
    if (e.defaultPrevented || !col || !FILL_COLS.includes(col)) return;
    const text = e.clipboardData.getData('text');
    const values = columnValues(text);
    if (!values) {
      // One value over a selection fills every selected cell, as in Assessment.
      const rows = selRows(t);
      if (rows.length < 2) return;
      e.preventDefault();
      fillColumn(col, rows.map(() => text.trim()), rows[0].id);
      return;
    }
    e.preventDefault();
    fillColumn(col, values, t.dataset.bcRow!);
  };

  /** Writes values down `col` from row `startRowId`, through the same lock rules as a paste. */
  const fillColumn = (col: string, values: string[], startRowId: string) => {
    if (!FILL_COLS.includes(col)) return;
    (document.activeElement as HTMLElement | null)?.blur(); // FormulaNumericInput only syncs from the store while not focused
    const plan = planColumnFill(col as FillColumn, values, onScreen, startRowId, {
      fromBill,
      autoDepRate: r => depRateFor({ ...r, depOverride: undefined }),
    });
    if (plan.filled === 0) {
      toast.info('Nothing pasted — those boxes are locked or the values could not be read.');
      return;
    }
    plan.apply.forEach(u => updateAssessmentRow(u.id, u.updates));
    toast(`Pasted ${plan.filled} value${plan.filled === 1 ? '' : 's'}${plan.skipped > 0 ? ` · ${plan.skipped} skipped` : ''}`, {
      action: { label: 'Undo', onClick: () => plan.undo.forEach(u => updateAssessmentRow(u.id, u.updates)) },
    });
  };

  /**
   * A column pasted from Excel / Sheets / a Gemini table into Ref No. (spec D10).
   * A single value pastes natively. Pasted refs are the surveyor's, unless what
   * Bill Check read contradicts them — then they are left to check, not printed.
   */
  const handleRefPaste = (e: ClipboardEvent<HTMLInputElement>, rowId: string) => {
    const paste = parseRefPaste(e.clipboardData.getData('text'));
    if (paste.kind === 'single') return;
    e.preventDefault();
    if (paste.kind === 'invalid') {
      toast.error('Copy just the Ref No. column, or the Sr No. and Ref No. columns of one section at a time.');
      return;
    }
    const { pool, onScreen } = screenRows();
    // Every line Bill Check has read: a "continue" upload stores only its own pages.
    const stored = claim.extractedData?.['final-bill'];
    const lines: ReadLine[] = [
      ...(stored ? buildBillItems(stored) : []),
      ...(claim.extraBillItems ?? []),
      ...allRows.flatMap(r => (r.refMatch ? [r.refMatch.bill, ...(r.refMatch.also ?? [])] : [])),
    ];
    const plan = planRefPaste(paste, onScreen, rowId, lines.length ? lines : null, id => serials.get(id), pool);
    // A changed ref frees the line its old match held: back to the unmatched list, as unlinking does.
    // Only lines not already listed: Undo takes back exactly what the paste added.
    const listed = new Set((claim.extraBillItems ?? []).map(x => x.id));
    const added = plan.released.filter((b, i, all) => !listed.has(b.id) && all.findIndex(o => o.id === b.id) === i);
    const addedIds = new Set(added.map(b => b.id));
    const setExtras = (f: (xs: ExtraBillItem[]) => ExtraBillItem[]) =>
      updateClaim({ extraBillItems: f(useClaimStore.getState().currentClaim?.extraBillItems ?? []) });
    const run = (us: RowUpdate[]) => us.forEach(u => updateAssessmentRow(u.id, u.updates));
    if (plan.filled + plan.flagged === 0) {
      toast.info('Nothing to fill — the pasted values already match or found no row.');
      return;
    }
    run(plan.apply);
    if (added.length) setExtras(xs => [...xs, ...added]);
    const parts = [`Filled ${plan.filled} Ref Nos.`];
    if (plan.flagged) parts.push(`${plan.flagged} to check${plan.notOnDocument ? ` (${plan.notOnDocument} not on the document read here)` : ''}`);
    if (plan.skipped) parts.push(`${plan.skipped} found no row`);
    toast(parts.join(' · '), {
      action: {
        label: 'Undo',
        onClick: () => {
          run(plan.undo);
          if (addedIds.size) setExtras(xs => xs.filter(x => !addedIds.has(x.id)));
        },
      },
    });
  };
  const stepFlag = (dir: 1 | -1) => {
    const n = flaggedIds.length;
    const id = flaggedIds[flagPos < 0 ? (dir === 1 ? 0 : n - 1) : (flagPos + dir + n) % n];
    setOpenFlag(id);
    setFilterUncertain(false);
    requestAnimationFrame(() =>
      document.getElementById(`bc-row-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  };

  /**
   * Allowing above the assessed figure means editing `assessed` — the field
   * both this grid and the Final Survey Report read, with no snapshot of an
   * issued report anywhere. Writing it directly would silently reprint a
   * report already filed. `billAllowed` is bill-check-only; the surveyor
   * chooses to also touch `assessed` via AllowanceScopeDialog.
   *
   * A row that already carries billAllowed, or a value equal to assessed,
   * does not re-prompt — only the first divergent edit asks.
   */
  const commitAllowance = (row: AssessmentRow, value: number) => {
    if (value === row.assessed || row.billAllowed !== undefined) {
      updateAssessmentRow(row.id, { billAllowed: value });
      return;
    }
    setPendingAllowance({ id: row.id, assessed: row.assessed, proposed: value });
  };

  useEffect(() => { setVisible(loadVisibility()); }, []);
  const toggleColumn = (key: OptionalColumn) => {
    const next = { ...visible, [key]: !visible[key] };
    setVisible(next); saveVisibility(next);
  };
  const showAllCols = () => {
    const next = Object.fromEntries(OPTIONAL_COLUMNS.map(c => [c.key, true])) as Record<OptionalColumn, boolean>;
    setVisible(next); saveVisibility(next);
  };
  const resetDefaults = () => { setVisible({ ...DEFAULT_VISIBLE }); saveVisibility({ ...DEFAULT_VISIBLE }); };
  const visibleCount = Object.values(visible).filter(Boolean).length;

  const buildCols = () => {
    const w = (keys: OptionalColumn[]) => keys.filter(k => visible[k]).map(k => COL_WIDTHS[k]);
    // Same order as headerRow, totalsRow and the row cells: base, assessed, uploaded, item no., status, then the rest.
    return ['32px', '28px', '50px', `${particularsWidth}px`, ...w(['partNumber', 'hsnSac', 'section', 'quantity', 'unitPrice']),
      '100px', ...w(['billedTaxable', 'refSrNo']), '120px', ...w(['gst', 'disposal']), '70px', '100px',
      ...w(['priceWithGst', 'remarks']), '40px'].join(' ');
  };
  const gridCols = buildCols();

  const handleBulkDelete = () => {
    const ids = deletableSelection(selected, new Set(onScreen.map(r => r.id)));
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} selected item${ids.length === 1 ? '' : 's'}?\n\n${ALSO_REMOVES}\n\nIf the workshop simply did not bill it, set it to "Not in Bill" instead.`)) return;
    deleteAssessmentRows(ids);
    selection.clearSelection();
  };
  /** Deletes at once with Undo, as in Assessment (it is the same row there). */
  const handleDeleteRow = (id: string) => {
    deleteRowWithUndo(id);
    if (selected.has(id)) selection.toggleSelect(id);
  };

  const subtotals = sectionSubtotals(summary);

  /**
   * One column-header row, repeated above every section so a section scrolled
   * into view still says what its columns mean — the Assessment tab does the
   * same by rendering one table per section.
   */
  const headerRow = (sectionIds: string[]) => {
    const tick = sectionTickState(sectionIds, selected);
    return (
      <div
        className="px-2 py-2 grid gap-2 items-center text-xs font-medium uppercase text-muted-foreground bg-muted shadow-sm border-b border-border"
        style={{ gridTemplateColumns: gridCols, position: 'sticky', top: 0, zIndex: 10 }}
      >
        <span className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={tick === 'all'}
            ref={el => { if (el) el.indeterminate = tick === 'some'; }}
            onChange={() => selection.toggleSectionSelectAll(sectionIds)}
            className="h-3.5 w-3.5 cursor-pointer accent-[var(--color-status-danger)]"
            title="Select every row in this section"
          />
        </span>
        <span></span>
        <span className="sticky left-0 z-[1] bg-muted -mr-2 pr-2">Sr.</span>
        <span className="sticky left-[58px] z-[1] bg-muted flex items-center justify-between group pr-2 select-none">
          <span>Particulars</span>
          <span className="text-[8px] text-muted-foreground/40 font-mono tracking-normal opacity-0 group-hover:opacity-100 transition-opacity">
            {particularsWidth}px
          </span>
          <div
            {...particularsResizeHandleProps}
            className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/50 active:bg-primary group/handle z-10"
            title="Drag to resize column (double-click to reset)"
          >
            <div className="w-0.5 h-full bg-border group-hover/handle:bg-primary mx-auto transition-colors" />
          </div>
        </span>
        {visible.partNumber    && <span>Part No.</span>}
        {visible.hsnSac        && <span>HSN/SAC</span>}
        {visible.section       && <span>Section</span>}
        {visible.quantity      && <span>Qty</span>}
        {visible.unitPrice     && <span>{labels.base === 'Billed' ? 'Bill' : labels.base} (taxable)</span>}
        <span>Assessed (₹)</span>
        {visible.billedTaxable && <span>{labels.amount} (taxable)</span>}
        {visible.refSrNo && (
          <span
            className="flex items-center gap-1 cursor-pointer group hover:text-foreground"
            onClick={() => {
              const custom = prompt('Enter custom column title for Reference Item No.:', refColTitle);
              if (custom !== null) {
                useClaimStore.getState().updateClaim({
                  billCheck: { ...claim.billCheck, refColumnTitle: custom.trim() || undefined },
                });
              }
            }}
            title="Click to rename reference column"
          >
            <span>{refColTitle}</span>
            <span className="opacity-0 group-hover:opacity-100 text-[10px] text-primary">✎</span>
          </span>
        )}
        <span>Status</span>
        {visible.gst           && <span>{GRID_COLUMNS.gst.label}</span>}
        {visible.disposal      && (
          <span className="flex items-center justify-center gap-1 text-amber-600" title="Disposal: used/salvaged part — no GST">
            <PackageX size={11} />
            {GRID_COLUMNS.disposal.label}
          </span>
        )}
        <span>Dep%</span>
        <span>Net (₹)</span>
        {visible.priceWithGst  && <span>{GRID_COLUMNS.priceWithGst.label}</span>}
        {visible.remarks       && <span>Remarks</span>}
        <span></span>
      </div>
    );
  };

  /**
   * A totals row aligned to the columns above it.
   *
   * Emits the same cells in the same order under the same visibility guards as
   * headerRow. One mismatch shifts every figure a column to the right, which is
   * why both live here rather than being written out per section.
   */
  const totalsRow = (label: string, t: BilledTotals, onDark: boolean) => {
    const money = onDark ? { color: 'var(--color-neutral-50)' } : undefined;
    return (
      <div
        className="px-2 py-2 grid gap-2"
        style={{
          gridTemplateColumns: gridCols,
          background: onDark ? 'var(--color-neutral-900)' : 'var(--color-neutral-100)',
        }}
      >
        <div /><div /><div />
        <div className={`text-xs font-medium uppercase tracking-widest ${onDark ? 'text-primary' : 'text-muted-foreground'}`}>
          {label}
        </div>
        {visible.partNumber    && <div />}
        {visible.hsnSac        && <div />}
        {visible.section       && <div />}
        {visible.quantity      && <div />}
        {visible.unitPrice     && <div className="text-sm font-medium" style={money}>{fmt(t.estimated)}</div>}
        <div className="text-sm font-medium" style={money}>{fmt(t.assessed)}</div>
        {visible.billedTaxable && <div className="text-sm font-medium text-primary">{fmt(t.billedTaxable)}</div>}
        {visible.refSrNo       && <div />}
        <div className={`text-xs font-medium ${onDark ? 'text-white/50' : 'text-muted-foreground'}`}>
          {fmt(t.notInBill)} not claimed
        </div>
        {visible.gst           && <div />}
        {visible.disposal      && <div />}
        <div />
        <div />
        {visible.priceWithGst  && <div />}
        {visible.remarks && <div />}
        <div />
      </div>
    );
  };

  if (allRows.length === 0) {
    return (
      <div className="h-full min-h-0 overflow-auto">
      <div
        className="rounded-2xl p-12 flex flex-col items-center text-center bg-card border border-border"
      >
        <AlertCircle size={28} className="text-muted-foreground" style={{ marginBottom: 12 }} />
        <div className="text-base font-medium mb-1 text-foreground">No items in assessment</div>
        <div className="text-sm text-muted-foreground">
          Go to Assessment tab and add items to begin bill check.
        </div>
      </div>
      {after && <div className="mt-6">{after}</div>}
      </div>
    );
  }

  return (
    <>
    <div className="flex flex-col h-full min-h-0 rounded-2xl overflow-hidden bg-card border border-border [&_[data-sel]]:ring-2 [&_[data-sel]]:ring-blue-400 [&_[data-sel]]:ring-inset" onKeyDown={handleGridKeys} onPaste={handleColumnPaste} onCopy={handleCopy} onMouseDown={selection.handleCellMouseDown}>
      {/* Grid header / toolbar */}
      <div className="px-4 py-3 flex items-start justify-between gap-4" style={{ borderBottom: '1px solid var(--color-neutral-100)', background: 'var(--color-neutral-50)' }}>
        <div>
          <div className="text-sm font-medium text-foreground">
            Step 2 — Verify Each Item ({shownCount} items · {allowedRows.length} allowed)
          </div>
          <div className="text-xs mt-0.5 text-muted-foreground">
            Mark each item as In Bill or Not in Bill. Turn off Allowed only to also see disallowed items the workshop billed.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const zeros = allRows.filter(r => r.assessed === 0 && r.estimated === 0);
              if (zeros.length === 0) { alert('No zero amount parts found.'); return; }
              if (confirm(`Remove ${zeros.length} zero amount parts?\n\n${ALSO_REMOVES}`)) {
                deleteAssessmentRows(zeros.map(r => r.id));
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all border hover:bg-status-danger-tint text-status-danger border-status-danger bg-card"
            title="Remove all zero amount parts"
          >
            <Trash2 size={14} />
            Remove 0 Amount
          </button>
          {selected.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all hover:opacity-90 bg-status-danger text-white"
            >
              <Trash2 size={14} />
              Delete Selected ({selected.size})
            </button>
          )}
          <button
            onClick={() => { selection.clearSelection(); setAllowedOnly(!allowedOnly); }}
            aria-pressed={allowedOnly}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${
              allowedOnly
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
            }`}
            title="Show allowed rows only. Turn off to also see disallowed items the workshop billed."
          >
            Allowed only
          </button>
          {(uncertainCount > 0 || filterUncertain) && (
            <button
              onClick={() => { selection.clearSelection(); setFilterUncertain(!filterUncertain); }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${
                filterUncertain
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
              }`}
              title="Filter to ambiguous or missing reference numbers"
            >
              <AlertCircle size={14} />
              {filterUncertain ? `Show All (${shownCount})` : `Review Ref Numbers (${uncertainCount})`}
            </button>
          )}
          {flaggedIds.length > 0 && (
            <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <button onClick={() => stepFlag(-1)} className="px-2 py-1.5 rounded-lg border border-border text-foreground">‹ Prev</button>
              <button onClick={() => stepFlag(1)} className="px-2 py-1.5 rounded-lg border border-border text-foreground">Next ›</button>
              <span>{flagPos + 1} / {flaggedIds.length}</span>
            </div>
          )}
          <ColumnPicker
            columns={pickerColumns(OPTIONAL_COLUMNS, labels)}
            visible={visible}
            count={visibleCount}
            onToggle={toggleColumn}
            onShowAll={showAllCols}
            onReset={resetDefaults}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto" style={{ scrollPaddingTop: 44 }}>
        <div style={{ width: 'max-content', minWidth: '100%' }}>{/* every row as wide as its columns, so frozen columns hold all the way right */}
          {/*
            Grouped Parts / Labour / Painting, mirroring the Assessment tab and
            the printed Bill Check, which the surveyor reads side by side.

            Grouping also straightens two things the flat list got wrong:
            buildSerialMap numbers per section, so Sr. now runs 1..n instead of
            restarting mid-list; and the supplementary band is computed over the
            section's own rows rather than the interleaved claim array.
          */}
          {SECTION_ORDER.map(({ section, title }) => {
          // Rejected at final survey — already absent from every Bill Check
          // report, and nothing here can give them liability. The header count
          // states how many, and the serial gaps show where they sat.
          //
          // One exception, and it is the whole reason this is not a plain
          // `r.allowed`: a rejected row the workshop billed anyway still needs
          // the surveyor's eye. That is a claim for refused work, and hiding it
          // would hide the one thing on this screen worth acting on.
          // That exception is the "Allowed only" toggle's off state.
          const sectionRows = billCheckRowsShown(allRows, section, allowedOnly);
          const displayedRows = filterUncertain
            ? sectionRows.filter(r => r.refStatus === 'ambiguous' || (r.allowed && !r.refSrNo))
            : sectionRows;
          // An empty section is not rendered at all, as in AssessmentGrid.
          if (displayedRows.length === 0) return null;
          const sectionIds = displayedRows.map(r => r.id);
          const sub = subtotals[section];
          // Allowed only: sectionSubtotals reads a summary the engine built from
          // allowed rows, and the two footer lines must describe one population.
          const billed = sectionFooterTotals(allRows, section, allowedOnly, fromBill);

          return (
          <div key={section}>
          {/* Section title — full width, deliberately not a grid row */}
          <div className="px-2 pt-4 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {title} <span className="ml-2 opacity-60">({displayedRows.length}{filterUncertain ? ` of ${sectionRows.length}` : ''})</span>
            </h3>
          </div>

          {headerRow(sectionIds)}

          {displayedRows.map((row, idx) => {
            const isDisallowed = !row.allowed;
            const isDup = duplicates.has(normParticulars(row.particulars));
            const effectiveStatus: BillStatus = isDisallowed ? 'not-allowed' : (row.billStatus || 'pending');
            const st = statusLabel(effectiveStatus);
            return [
              shouldStartSupplementaryBand(displayedRows, idx) && (
                <div
                  key={`band-${section}-${idx}`}
                  className="px-4 py-1.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-gradient-to-r from-muted via-muted to-transparent"
                >
                  Supplementary Estimate
                </div>
              ),
              <div
                key={row.id}
                id={`bc-row-${row.id}`}
                data-row-id={row.id}
                className={`px-2 py-1.5 grid gap-2 items-center ${rowTintClass(row, isDup, selected.has(row.id))}`}
                style={{
                  gridTemplateColumns: gridCols,
                  borderBottom: '1px solid var(--color-neutral-100)',
                  opacity: isDisallowed ? 0.75 : 1,
                }}
              >
                <div className={`flex items-center justify-center self-stretch ${isDup ? 'border-l-4 border-orange-500' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => selection.toggleSelect(row.id)}
                    className="h-3.5 w-3.5 cursor-pointer accent-[var(--color-status-danger)]"
                  />
                </div>
                <div className="flex items-center justify-center">
                  {flagsByRow.get(row.id) && (
                    <BillCheckFlagMark
                      flag={flagsByRow.get(row.id)!}
                      open={openFlag === row.id}
                      onToggle={() => setOpenFlag(openFlag === row.id ? null : row.id)}
                    />
                  )}
                </div>
                {/* The number the insurer reads in both PDFs, not the estimate's srNo. */}
                <div className="text-sm font-medium sticky left-0 z-[1] bg-card -mr-2 pr-2 self-stretch flex items-center" style={{ color: 'var(--color-neutral-600)', ...(isDisallowed ? { background: 'var(--color-neutral-100)' } : {}) }}>{serials.get(row.id) ?? idx + 1}</div>
                <div
                  className="group text-sm font-medium flex items-center gap-1.5 cursor-pointer select-none text-foreground sticky left-[58px] z-[1] bg-card self-stretch"
                  style={{ textDecoration: isDisallowed ? 'line-through' : 'none', ...(isDisallowed ? { background: 'var(--color-neutral-100)' } : {}) }}
                  onClick={() => {
                    if (!claimId) return;
                    useEvidenceStore.getState().openField(claimId, {
                      docType: 'final-bill',
                      fieldKey: 'bill_item',
                      contextSnippet: row.particulars
                        ? `${row.particulars}${row.assessed ? ` — Assessed: ₹${row.assessed}` : ''}${row.billedAmount ? ` — Billed: ₹${row.billedAmount}` : ''}`
                        : 'Bill item',
                    });
                  }}
                  title="Click to view in Evidence Viewer"
                >
                  <span>{row.particulars || '—'}</span>
                  <FileSearch size={12} className="opacity-0 group-hover:opacity-60 transition-opacity shrink-0 text-primary" />
                </div>
                {visible.partNumber    && <div className="text-xs font-mono" style={{ color: 'var(--color-neutral-600)' }}>{row.partNumber || '—'}</div>}
                {visible.hsnSac        && <div className="text-xs font-mono" style={{ color: 'var(--color-neutral-600)' }}>{row.hsnSac || '—'}</div>}
                {visible.section       && <div><span className="text-[9px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-600)' }}>{row.section}</span></div>}
                {visible.quantity      && <div className="text-sm font-medium text-center" style={{ color: 'var(--color-neutral-600)' }}>{row.quantity ?? '—'}</div>}
                {visible.unitPrice     && <div className="text-sm font-medium" style={{ color: 'var(--color-neutral-600)' }}>{fmt(row.estimated || 0)}</div>}
                <AllowanceInput
                  data-bc-row={row.id}
                  data-bc-col="billAllowed"
                  data-column-key="billAllowed"
                  data-sel={cs(row.id, 'billAllowed')}
                  value={row.billAllowed ?? row.assessed ?? 0}
                  disabled={isDisallowed}
                  highlighted={row.billAllowed !== undefined}
                  error={overBilledRows([row]).length > 0}
                  title={overBilledRows([row]).length > 0
                    ? `Allowed above the billed ₹${row.billedTaxable}. Lower it before printing.`
                    : row.billAllowed !== undefined ? `Allowed against an assessed value of ₹${row.assessed}` : undefined}
                  onCommit={next => commitAllowance(row, next)}
                />
                {visible.billedTaxable && fromBill && (
                  <div className="text-sm font-medium text-right" style={{ color: 'var(--color-neutral-600)' }} title={FROM_BILL_LOCK}>
                    {row.estimateAmount === undefined ? '—' : fmt(row.estimateAmount)}
                  </div>
                )}
                {visible.billedTaxable && !fromBill && (
                  <DecimalInput
                    data-bc-row={row.id}
                    data-bc-col="billedTaxable"
                    data-column-key="billedTaxable"
                    data-sel={cs(row.id, 'billedTaxable')}
                    value={row.billedTaxable ?? ''}
                    onChange={e => {
                      const raw = e.target.value.trim();
                      const gstPct = row.gst ?? 18;
                      // Cleared means not checked yet, which is what the print
                      // gate reads. Zero would mean the workshop billed nothing.
                      if (raw === '') {
                        updateAssessmentRow(row.id, { billedTaxable: undefined, billedAmount: undefined });
                        return;
                      }
                      const tax = Number(raw);
                      if (!Number.isFinite(tax)) return;
                      updateAssessmentRow(row.id, { billedTaxable: tax, billedAmount: withGst(tax, gstPct) });
                    }}
                    disabled={isDisallowed || row.billStatus === 'not-in-bill'}
                    className="px-2 py-1 rounded-lg text-sm text-right border outline-none w-full border-border text-foreground"
                    style={{ background: isDisallowed || row.billStatus === 'not-in-bill' ?  'var(--color-neutral-100)' : 'var(--color-neutral-50)' }}
                  />
                )}
                {visible.refSrNo && (
                  <div className="flex items-center gap-1">
                    <input
                      data-bc-row={row.id}
                      data-bc-col="refSrNo"
                      data-column-key="refSrNo"
                      data-sel={cs(row.id, 'refSrNo')}
                      type="text"
                      value={row.refSrNo ?? ''}
                      placeholder="—"
                      onPaste={e => handleRefPaste(e, row.id)}
                      onChange={e => {
                        const val = e.target.value.trim();
                        updateAssessmentRow(row.id, {
                          refSrNo: val === '' ? undefined : val,
                          refStatus: 'manual',
                        });
                      }}
                      // Red only when the match is doubtful or missing: a normal ref is plain.
                      className={`px-1.5 py-1 rounded text-xs text-center border outline-none w-full font-medium ${
                        row.refStatus === 'ambiguous' || (row.allowed && !row.refSrNo)
                          ? 'border-amber-400 text-amber-800 bg-amber-50'
                          : 'border-border text-foreground bg-background'
                      }`}
                      title={row.refStatus === 'ambiguous' ? 'Ambiguous match — please verify' : 'Reference serial number'}
                    />
                    {row.refStatus === 'ambiguous' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title={row.refMatch ? `${row.refMatch.score}% match — check` : 'Ambiguous match'} />
                    )}
                  </div>
                )}
                {isDisallowed ? (
                  <div
                    className="px-2 py-1 rounded-lg text-[10px] font-medium text-center border border-border"
                    style={{ background: st.bg, color: st.color }}
                    title="This item was marked Not Allowed in Assessment"
                  >
                    {(row.billedAmount ?? 0) > 0 ? '⚠ Billed (Not Allowed)' : 'Not Allowed'}
                  </div>
                ) : (
                  <select
                    data-bc-row={row.id}
                    data-bc-col="billStatus"
                    data-column-key="billStatus"
                    data-sel={cs(row.id, 'billStatus')}
                    value={row.billStatus || 'pending'}
                    onChange={e => {
                      const s = e.target.value as BillStatus;
                      const gstPct = row.gst ?? 18;
                      if (s === 'in-bill' && fromBill) {
                        // From-bill: In Estimate bills the row at its own figure. This is
                        // also how the surveyor overrides a Not in Estimate.
                        updateAssessmentRow(row.id, selfBilled(row));
                      } else if (s === 'in-bill') {
                        // "Billed as assessed." assessed is pre-GST, so it is the
                        // taxable basis; billedAmount is the incl-GST display figure.
                        updateAssessmentRow(row.id, {
                          billStatus: s,
                          billedTaxable: row.assessed,
                          billedAmount: withGst(row.assessed, gstPct),
                        });
                      } else if (s === 'not-in-bill') {
                        updateAssessmentRow(row.id, { billStatus: s, billedTaxable: 0, billedAmount: 0 });
                      } else {
                        updateAssessmentRow(row.id, { billStatus: s });
                      }
                    }}
                    title={fromBill && row.refSrNo === 'Not in estimate' && row.billStatus === 'in-bill'
                      ? 'Not in the estimate, but allowed by the surveyor' : undefined}
                    className="px-2 py-1 rounded-lg text-[11px] font-medium border outline-none w-full border-border"
                    style={{ background: st.bg, color: st.color }}
                  >
                    {statusOptions(fromBill).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
                {visible.gst           && (
                  <div className="flex items-center justify-center">
                    <FormulaNumericInput
                      data-bc-row={row.id}
                      data-bc-col="gst"
                      data-column-key="gst"
                      data-sel={cs(row.id, 'gst')}
                      integerOnly
                      value={row.isDisposal ? 0 : (row.gst ?? 18)}
                      onChange={(val) => {
                        const gst = Math.max(0, val);
                        const updates: Partial<AssessmentRow> = { gst };
                        if (row.billedTaxable !== undefined) {
                          updates.billedAmount = withGst(row.billedTaxable, gst);
                        }
                        updateAssessmentRow(row.id, updates);
                      }}
                      className="h-7 w-12 text-[11px] text-center border-transparent hover:border-input focus:bg-background px-0 font-medium"
                      placeholder="18"
                      min={0}
                      max={100}
                    />
                  </div>
                )}
                {visible.disposal      && (
                  <div className="flex items-center justify-center gap-1">
                    <input
                      type="checkbox"
                      checked={!!row.isDisposal}
                      onChange={(e) => {
                        const isDisposal = e.target.checked;
                        updateAssessmentRow(row.id, {
                          isDisposal,
                          ...(isDisposal ? { gst: 0 } : (row.gst === 0 ? { gst: 18 } : {})),
                        });
                      }}
                      className="h-3.5 w-3.5 cursor-pointer rounded accent-amber-500 shrink-0"
                      title="Disposal / Used Part (No GST)"
                    />
                    {row.isDisposal && (
                      <FormulaNumericInput
                        data-bc-row={row.id}
                        data-bc-col="disposalPercent"
                        data-column-key="disposalPercent"
                        data-sel={cs(row.id, 'disposalPercent')}
                        value={row.disposalPercent ?? 50}
                        onChange={(val) => updateAssessmentRow(row.id, { disposalPercent: Math.min(100, Math.max(0, val)) })}
                        className="h-6 w-10 text-[11px] text-center px-0 font-medium bg-background"
                        style={{ borderColor: 'var(--color-status-warning)', color: 'var(--color-status-warning)' }}
                        min={0}
                        max={100}
                        title="Disposal percentage (default 50%)"
                      />
                    )}
                  </div>
                )}
                <div className="flex items-center justify-center">
                  {row.allowed ? (
                    <DecimalInput
                      data-bc-row={row.id}
                      data-bc-col="depOverride"
                      data-column-key="depOverride"
                      data-sel={cs(row.id, 'depOverride')}
                      min={0}
                      max={100}
                      step={1}
                      value={row.depOverride != null ? row.depOverride : depRateFor(row)}
                      onChange={e => {
                        const raw = e.target.value;
                        const autoRate = depRateFor({ ...row, depOverride: undefined });
                        if (raw === '') {
                          updateAssessmentRow(row.id, { depOverride: undefined });
                        } else {
                          if (!Number.isFinite(Number(raw))) return; // letters typed: ignore
                          const v = Math.min(100, Math.max(0, Number(raw)));
                          updateAssessmentRow(row.id, { depOverride: v === autoRate ? undefined : v });
                        }
                      }}
                      className={`w-12 text-center text-[11px] font-medium rounded border focus:outline-none focus:ring-1 focus:ring-[var(--color-status-warning)] ${
                        row.depOverride != null
                          ? 'bg-[var(--color-status-warning-tint)] border-[var(--color-status-warning)] text-[var(--color-status-warning)]'
                          : 'bg-transparent border-transparent text-danger hover:border-input'
                      }`}
                      title={row.depOverride != null ? `Auto: ${depRateFor({ ...row, depOverride: undefined })}% — Click to clear override` : `Auto rate: ${depRateFor(row)}%`}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <div className="text-sm font-medium text-right" style={{ color: 'var(--color-neutral-600)' }}>
                  {fmt(computeRowNet(asBilled(row), depRateFor(row)).netBeforeGst)}
                </div>
                {visible.priceWithGst && (
                  <div className="text-sm font-medium text-right" style={{ color: 'var(--color-neutral-600)' }}>
                    {(() => {
                      const { isDisposal, netBeforeGst } = computeRowNet(asBilled(row), depRateFor(row));
                      return fmt(isDisposal ? netBeforeGst : netBeforeGst * (1 + (row.gst ?? 18) / 100));
                    })()}
                  </div>
                )}
                {visible.remarks && (
                  <input
                    data-bc-row={row.id}
                    data-bc-col="billRemarks"
                    data-column-key="billRemarks"
                    data-sel={cs(row.id, 'billRemarks')}
                    value={row.billRemarks || ''}
                    onChange={e => updateAssessmentRow(row.id, { billRemarks: e.target.value })}
                    placeholder="Notes…"
                    className="px-2 py-1 rounded-lg text-xs border outline-none w-full border-border"
                    style={{ color: 'var(--color-neutral-600)', background: 'var(--color-neutral-50)' }}
                  />
                )}
                <button
                  onClick={() => handleDeleteRow(row.id)}
                  className="flex items-center justify-center h-7 w-7 rounded-lg transition-colors hover:bg-status-danger-tint text-status-danger"
                  title="Delete row"
                >
                  <Trash2 size={14} />
                </button>
              </div>,
              openFlag === row.id && flagsByRow.get(row.id)?.kind === 'ambiguous' && (
                <BillCheckMatchDetail
                  key={`flag-${row.id}`}
                  flag={flagsByRow.get(row.id)!}
                  row={row}
                  serial={serials.get(row.id)}
                  extraBillItems={claim.extraBillItems || []}
                  colSpan={gridCols.split(' ').length}
                  onConfirm={() => {
                    updateAssessmentRow(row.id, { refStatus: 'manual' });
                    setOpenFlag(null);
                  }}
                  onUnlink={() => {
                    unlinkBillMatch(row.id);
                    setOpenFlag(null);
                  }}
                  onUseOther={id => {
                    linkExtraBillItem(id, row.id);
                    setOpenFlag(null);
                  }}
                />
              ),
              openFlag === row.id && flagsByRow.get(row.id) && flagsByRow.get(row.id)!.kind !== 'ambiguous' && (
                <BillCheckFlagDetail
                  key={`flag-${row.id}`}
                  flag={flagsByRow.get(row.id)!}
                  colSpan={gridCols.split(' ').length}
                  onConfirm={() => {
                    updateAssessmentRow(row.id, { billVerified: true });
                    setOpenFlag(null);
                  }}
                  onRaise={amount => {
                    updateAssessmentRow(row.id, { billVerified: true });
                    commitAllowance(row, amount);
                    setOpenFlag(null);
                  }}
                />
              )
            ];
          }).flat()}

          {/*
            Assessed subtotal. Full width rather than column-aligned because
            these are post-depreciation figures and this grid has no column that
            means any of them — "Assessed Tax" and "Assessed" both show the
            pre-depreciation amounts, and GST% is a rate, not an amount. Printing
            sub.base under "Assessed Tax" would put a depreciated number under a
            heading that promises an undepreciated one.
          */}
          <div
            className="px-2 py-1.5 text-right text-[11px] text-muted-foreground border-b border-border"
            style={{ background: 'var(--color-neutral-50)' }}
          >
            {title} assessed —{' '}
            taxable <span className="font-medium text-foreground">{fmt(sub.base)}</span>
            {' · '}GST <span className="font-medium text-foreground">{fmt(sub.gst)}</span>
            {' · '}total <span className="font-medium text-foreground">{fmt(sub.total)}</span>
          </div>

          {totalsRow(`${title} billed`, billed, false)}
          <button
            onClick={() => addAssessmentRowToSection(section)}
            className="ml-2 mt-2 mb-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground text-[11px] font-semibold transition-colors"
          >
            <PlusCircle size={12} /> Add row
          </button>
          </div>
          );
          })}

          {totalsRow('TOTAL', gridTotals(allowedRows, fromBill), true)}
        </div>
        {after && <div className="sticky left-0 p-4">{after}</div>}
      </div>
      {(() => {
        // Excel's status bar, as in Assessment: Sum and Count of two or more selected figures.
        const rows = selRows();
        const col = cellSelection?.columnKey;
        if (rows.length < 2 || (col !== 'billAllowed' && col !== 'billedTaxable')) return null;
        const sum = rows.reduce((t, r) => t + (col === 'billAllowed' ? (r.billAllowed ?? r.assessed ?? 0) : (r.billedTaxable ?? 0)), 0);
        return (
          <div className="border-t border-border bg-muted/50 px-4 py-1 text-right text-[11px] text-muted-foreground">
            Sum <span className="font-semibold text-foreground">{sum.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            {' · '}Count <span className="font-semibold text-foreground">{rows.length}</span>
          </div>
        );
      })()}
    </div>

    {pendingAllowance && (
      <AllowanceScopeDialog
        assessed={pendingAllowance.assessed}
        proposed={pendingAllowance.proposed}
        onCancel={() => setPendingAllowance(null)}
        onChoose={(scope, amount) => {
          updateAssessmentRow(
            pendingAllowance.id,
            scope === 'both'
              ? { assessed: amount, billAllowed: undefined }
              : { billAllowed: amount },
          );
          setPendingAllowance(null);
        }}
      />
    )}
    </>
  );
}
