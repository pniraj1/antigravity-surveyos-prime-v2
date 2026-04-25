'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { getDepreciationRate, getVehicleAgeMonths } from '@/lib/calculations/depreciation';
import { formatCurrency } from '@/lib/calculations/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Trash2, PlusCircle, Wrench, ShieldAlert, Settings2, Eye, EyeOff, FileSearch } from 'lucide-react';
import type { PartType } from '@/types';
import { useEvidenceStore } from '@/components/evidence/DocumentEvidenceViewer';

// ─── Column Visibility Configuration ─────────────────────────────
// Keys for optional columns that the user can show/hide
type OptionalColumn =
  | 'partNumber'
  | 'hsnSac'
  | 'type'
  | 'quantity'
  | 'unitPrice'
  | 'gst'
  | 'action'
  | 'remarks';

interface ColumnMeta {
  key: OptionalColumn;
  label: string;
  description: string;
}

const OPTIONAL_COLUMNS: ColumnMeta[] = [
  { key: 'partNumber', label: 'Part No.',   description: 'OEM part number' },
  { key: 'hsnSac',     label: 'HSN/SAC',    description: 'Tax classification code' },
  { key: 'type',        label: 'Type',       description: 'Metal / Plastic / Glass / Labour' },
  { key: 'quantity',    label: 'Qty',        description: 'Quantity from estimate' },
  { key: 'unitPrice',   label: 'Estimate (taxable amt)',   description: 'Taxable amount from estimate (net, before GST)' },
  { key: 'gst',         label: 'GST %',      description: 'GST percentage' },
  { key: 'action',      label: 'Action',     description: 'Replace / Repair / Disallow' },
  { key: 'remarks',     label: 'Remarks',    description: 'Surveyor notes' },
];

const DEFAULT_VISIBLE: Record<OptionalColumn, boolean> = {
  partNumber: false,
  hsnSac: false,
  type: true,
  quantity: false,
  unitPrice: true,
  gst: true,
  action: true,
  remarks: false,
};

const STORAGE_KEY = 'surveyos-assessment-grid-columns';

function loadVisibility(): Record<OptionalColumn, boolean> {
  if (typeof window === 'undefined') return { ...DEFAULT_VISIBLE };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULT_VISIBLE, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return { ...DEFAULT_VISIBLE };
}

function saveVisibility(v: Record<OptionalColumn, boolean>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch { /* ignore */ }
}

// ─── Component ───────────────────────────────────────────────────
export function AssessmentGrid() {
  const {
    currentClaim,
    addAssessmentRow,
    updateAssessmentRow,
    deleteAssessmentRow,
    deleteAssessmentRows,
    toggleRowAllowed
  } = useClaimStore();

  const [visible, setVisible] = useState<Record<OptionalColumn, boolean>>(DEFAULT_VISIBLE);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = (rowIds: string[]) => {
    setSelected(prev => {
      const allSelected = rowIds.length > 0 && rowIds.every(id => prev.has(id));
      return allSelected ? new Set() : new Set(rowIds);
    });
  };
  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected row${selected.size === 1 ? '' : 's'}? This cannot be undone.`)) return;
    deleteAssessmentRows(Array.from(selected));
    setSelected(new Set());
  };
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    setVisible(loadVisibility());
  }, []);

  // Close settings panel on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    }
    if (showSettings) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings]);

  const toggleColumn = (key: OptionalColumn) => {
    const next = { ...visible, [key]: !visible[key] };
    setVisible(next);
    saveVisibility(next);
  };

  const showAll = () => {
    const next = Object.fromEntries(OPTIONAL_COLUMNS.map(c => [c.key, true])) as Record<OptionalColumn, boolean>;
    setVisible(next);
    saveVisibility(next);
  };

  const resetDefaults = () => {
    setVisible({ ...DEFAULT_VISIBLE });
    saveVisibility({ ...DEFAULT_VISIBLE });
  };

  const visibleCount = Object.values(visible).filter(Boolean).length;

  const handleGridNavigation = (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
    if (!e.shiftKey) return;
    
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT') return;

      const td = target.closest('td');
      const tr = td?.closest('tr');
      const tbody = tr?.closest('tbody');
      
      if (!td || !tr || !tbody) return;
      
      e.preventDefault();

      const tds = Array.from(tr.children);
      const colIndex = tds.indexOf(td);
      const trs = Array.from(tbody.children);
      const rowIndex = trs.indexOf(tr);

      let nextInput: HTMLElement | null = null;

      if (e.key === 'ArrowRight') {
        for (let i = colIndex + 1; i < tds.length; i++) {
          const input = tds[i].querySelector('input:not([disabled]), select:not([disabled])') as HTMLElement;
          if (input) {
            nextInput = input;
            break;
          }
        }
      } else if (e.key === 'ArrowLeft') {
        for (let i = colIndex - 1; i >= 0; i--) {
          const input = tds[i].querySelector('input:not([disabled]), select:not([disabled])') as HTMLElement;
          if (input) {
            nextInput = input;
            break;
          }
        }
      } else if (e.key === 'ArrowDown') {
        if (rowIndex < trs.length - 1) {
          nextInput = trs[rowIndex + 1].children[colIndex]?.querySelector('input:not([disabled]), select:not([disabled])') as HTMLElement;
        }
      } else if (e.key === 'ArrowUp') {
        if (rowIndex > 0) {
          nextInput = trs[rowIndex - 1].children[colIndex]?.querySelector('input:not([disabled]), select:not([disabled])') as HTMLElement;
        }
      }

      if (nextInput) {
        nextInput.focus();
        if (nextInput instanceof HTMLInputElement && nextInput.type !== 'checkbox') {
          nextInput.select();
        }
      }
    }
  };

  if (!currentClaim) return null;

  const { assessmentRows, vehicle, accident, depreciationType } = currentClaim;

  const ageMonths = getVehicleAgeMonths(
    vehicle.dateOfRegistration,
    vehicle.yearOfManufacture,
    accident.dateAndTime
  );

  // Find duplicate particulars
  const duplicateParticulars = new Set<string>();
  const seenParticulars = new Set<string>();
  
  assessmentRows.forEach(row => {
    if (row.particulars?.trim()) {
      const normalized = row.particulars.replace(/\s+/g, ' ').trim().toLowerCase();
      if (seenParticulars.has(normalized)) {
        duplicateParticulars.add(normalized);
      } else {
        seenParticulars.add(normalized);
      }
    }
  });

  // Dynamic column count: 8 always-on (Select, Sr, Allowed, Particulars, Assessed, Dep%, Net, Delete) + visible optionals
  const totalCols = 8 + visibleCount;
  const allRowIds = assessmentRows.map(r => r.id);
  const allSelected = allRowIds.length > 0 && allRowIds.every(id => selected.has(id));
  const someSelected = selected.size > 0 && !allSelected;

  return (
    <Card className="flex flex-col h-full border-border">
      <CardHeader className="border-b border-border bg-card/50 px-4 py-3 flex flex-row items-center justify-between sticky top-0 z-20 rounded-t-xl">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Wrench size={16} className="text-primary" />
          Parts Assessment Grid
        </CardTitle>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => addAssessmentRow('parts')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold transition-colors"
          >
            <PlusCircle size={14} /> Part Row
          </button>
          <button
            onClick={() => addAssessmentRow('labour')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary transition-colors border border-primary/20 text-xs font-semibold"
          >
            <PlusCircle size={14} /> Labour Row
          </button>

          {selected.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors"
              title={`Delete ${selected.size} selected row${selected.size === 1 ? '' : 's'}`}
            >
              <Trash2 size={14} /> Delete Selected ({selected.size})
            </button>
          )}

          {/* ─── Settings Gear ─────────────────────────── */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all border ${
                showSettings 
                  ? 'bg-primary text-primary-foreground border-primary shadow-md' 
                  : 'bg-muted/50 hover:bg-muted text-muted-foreground border-transparent hover:border-border'
              }`}
              title="Toggle column visibility"
            >
              <Settings2 size={14} />
              <span className="hidden sm:inline">Columns</span>
              <span className="ml-0.5 bg-primary/20 text-primary text-[10px] px-1 rounded-full font-bold leading-tight" style={showSettings ? { background: 'rgba(255,255,255,0.2)', color: 'inherit' } : {}}>
                {visibleCount}/{OPTIONAL_COLUMNS.length}
              </span>
            </button>

            {/* ─── Settings Dropdown Panel ─────────────── */}
            {showSettings && (
              <div className="absolute right-0 top-full mt-1.5 w-72 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-3 py-2.5 border-b border-border bg-muted/30">
                  <p className="text-xs font-semibold text-foreground">Column Visibility</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Toggle columns to keep the grid clean</p>
                </div>
                <div className="p-2 max-h-[300px] overflow-y-auto">
                  {OPTIONAL_COLUMNS.map((col) => (
                    <button
                      key={col.key}
                      onClick={() => toggleColumn(col.key)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                        visible[col.key]
                          ? 'bg-primary/8 hover:bg-primary/12'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className={`flex-shrink-0 w-7 h-4 rounded-full relative transition-colors ${
                        visible[col.key] ? 'bg-primary' : 'bg-muted-foreground/20'
                      }`}>
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${
                          visible[col.key] ? 'left-3.5' : 'left-0.5'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-foreground">{col.label}</span>
                        <span className="text-[10px] text-muted-foreground ml-1.5">{col.description}</span>
                      </div>
                      {visible[col.key] 
                        ? <Eye size={12} className="text-primary flex-shrink-0" /> 
                        : <EyeOff size={12} className="text-muted-foreground/40 flex-shrink-0" />
                      }
                    </button>
                  ))}
                </div>
                <div className="px-3 py-2 border-t border-border flex gap-2 bg-muted/20">
                  <button onClick={showAll} className="flex-1 text-[10px] font-semibold text-primary hover:bg-primary/10 rounded-md py-1.5 transition-colors">
                    Show All
                  </button>
                  <button onClick={resetDefaults} className="flex-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted rounded-md py-1.5 transition-colors">
                    Reset Defaults
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left" style={{ minWidth: visibleCount >= 6 ? '1200px' : '800px' }}>
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase sticky top-0 z-0 shadow-sm">
            <tr>
              {/* ─── Always-on columns ──────────────────── */}
              <th className="px-2 py-2 font-medium w-8 text-center" title="Select all">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={el => { if (el) el.indeterminate = someSelected; }}
                  onChange={() => toggleSelectAll(allRowIds)}
                  className="rounded border-border h-3.5 w-3.5 cursor-pointer accent-red-600"
                />
              </th>
              <th className="px-2 py-2 font-medium w-10 text-center">Sr</th>
              <th className="px-2 py-2 font-medium w-8 text-center" title="Allowed?"><ShieldAlert size={12} className="mx-auto opacity-50" /></th>
              <th className="px-2 py-2 font-medium min-w-[350px] w-[40%]">Particulars</th>

              {/* ─── Optional columns ──────────────────── */}
              {visible.partNumber && <th className="px-2 py-2 font-medium w-24">Part No.</th>}
              {visible.hsnSac && <th className="px-2 py-2 font-medium w-20">HSN/SAC</th>}
              {visible.type && <th className="px-2 py-2 font-medium w-24">Type</th>}
              {visible.quantity && <th className="px-2 py-2 font-medium w-12 text-center">Qty</th>}
              {visible.unitPrice && <th className="px-2 py-2 font-medium w-20">Estimate(taxable amount)</th>}
              {visible.gst && <th className="px-2 py-2 font-medium w-14 text-center">GST%</th>}


              {/* ─── Always-on assessment columns ──────── */}
              <th className="px-2 py-2 font-medium w-24 text-primary">Assessed</th>
              <th className="px-2 py-2 font-medium w-16 text-danger text-center">Dep%</th>
              <th className="px-2 py-2 font-medium w-24 text-right">Net (₹)</th>

              {/* ─── Optional trailing columns ─────────── */}
              {visible.action && <th className="px-2 py-2 font-medium w-20">Action</th>}
              {visible.remarks && <th className="px-2 py-2 font-medium w-28">Remarks</th>}

              {/* ─── Always-on delete ──────────────────── */}
              <th className="px-1 py-2 font-medium w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border" onKeyDown={handleGridNavigation}>
            {assessmentRows.length === 0 ? (
              <tr>
                <td colSpan={totalCols} className="px-6 py-12 text-center text-muted-foreground">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                    <Wrench size={20} className="opacity-50" />
                  </div>
                  <p className="text-sm">No items in assessment.</p>
                  <p className="text-xs opacity-60">Click the buttons above to add parts or labour.</p>
                </td>
              </tr>
            ) : (
              assessmentRows.map((row, idx) => {
                const depRate = getDepreciationRate(row.partType, ageMonths, depreciationType);
                const depFactor = depRate / 100;
                const netAssessed = row.assessed * (1 - depFactor);

                const handleEvidenceClick = () => {
                  if (!currentClaim?.id) return;
                  useEvidenceStore.getState().openField(currentClaim.id, {
                    docType: 'estimate',
                    fieldKey: 'particulars',
                    contextSnippet: row.particulars
                      ? `${row.particulars}${row.estimated ? ` — Taxable: ₹${row.estimated}` : ''}${row.partNumber ? ` (Part No: ${row.partNumber})` : ''}`
                      : 'Click any field in the estimate document.',
                  });
                };

                const normalizedParticulars = row.particulars?.replace(/\s+/g, ' ').trim().toLowerCase();
                const isDuplicate = normalizedParticulars ? duplicateParticulars.has(normalizedParticulars) : false;

                return (
                  <tr key={row.id} className={`hover:bg-accent/30 transition-colors ${selected.has(row.id) ? 'bg-red-500/5' : ''} ${!row.allowed ? 'opacity-40 bg-muted/20' : ''} ${isDuplicate ? 'bg-orange-500/10' : ''}`}>
                    {/* Select checkbox — always on */}
                    <td className={`px-2 py-1.5 text-center ${isDuplicate ? 'border-l-4 border-orange-500' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleSelect(row.id)}
                        className="rounded border-border h-3.5 w-3.5 cursor-pointer accent-red-600"
                      />
                    </td>
                    {/* Sr No — always on */}
                    <td className="px-2 py-1.5 text-xs font-medium text-muted-foreground text-center">
                      {row.srNo || idx + 1}
                    </td>
                    {/* Allowed — always on */}
                    <td className="px-2 py-1.5 text-center">
                      <input 
                        type="checkbox" 
                        checked={row.allowed}
                        onChange={() => toggleRowAllowed(row.id)}
                        className="rounded border-border focus:ring-primary h-3.5 w-3.5 cursor-pointer accent-primary" 
                      />
                    </td>
                    {/* Particulars — always on — click opens Evidence Viewer */}
                    <td className="px-2 py-1.5">
                      <div className="relative group flex items-center gap-1">
                        <Input
                          value={row.particulars}
                          onChange={(e) => updateAssessmentRow(row.id, { particulars: e.target.value })}
                          className="h-7 text-xs font-semibold bg-transparent border-transparent hover:border-input focus:bg-background"
                          placeholder="Item Description"
                          title={row.particulars}
                        />
                        <button
                          type="button"
                          onClick={handleEvidenceClick}
                          title="View in Evidence Viewer"
                          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
                        >
                          <FileSearch size={12} />
                        </button>
                      </div>
                    </td>

                    {/* ─── Optional columns ────────────────── */}
                    {visible.partNumber && (
                      <td className="px-1 py-1.5">
                        <Input
                          value={row.partNumber || ''}
                          onChange={(e) => updateAssessmentRow(row.id, { partNumber: e.target.value })}
                          className="h-7 text-[11px] bg-transparent border-transparent hover:border-input focus:bg-background px-1 font-mono"
                          placeholder="—"
                        />
                      </td>
                    )}
                    {visible.hsnSac && (
                      <td className="px-1 py-1.5">
                        <Input
                          value={row.hsnSac || ''}
                          onChange={(e) => updateAssessmentRow(row.id, { hsnSac: e.target.value })}
                          className="h-7 text-[11px] bg-transparent border-transparent hover:border-input focus:bg-background px-1 font-mono"
                          placeholder="—"
                        />
                      </td>
                    )}
                    {visible.type && (
                      <td className="px-1 py-1.5">
                        <select
                          value={row.partType}
                          onChange={(e) => {
                            const val = e.target.value as PartType;
                            updateAssessmentRow(row.id, { 
                              partType: val, 
                              section: (val === 'labour' || val === 'paint') ? val : 'parts' 
                            });
                          }}
                          className={`h-7 w-full text-[11px] rounded-md border border-transparent hover:border-input focus:border-input focus:bg-background bg-transparent px-1 disabled:cursor-not-allowed
                            ${row.partType === 'metal' ? 'text-blue-500' : 
                              row.partType === 'plastic' ? 'text-amber' : 
                              row.partType === 'fiberglass' ? 'text-fuchsia-500' :
                              row.partType === 'glass' ? 'text-teal' : 
                              row.partType === 'paint' ? 'text-purple-500' : 
                              'text-sidebar-foreground'} font-medium
                          `}
                        >
                          <option value="metal">🟦 Metal</option>
                          <option value="plastic">🟧 Plastic</option>
                          <option value="fiberglass">🟪 Fibre</option>
                          <option value="glass">🟩 Glass</option>
                          <option value="paint">🎨 Paint</option>
                          <option value="labour">⚙️ Labour</option>
                        </select>
                      </td>
                    )}
                    {visible.quantity && (
                      <td className="px-1 py-1.5">
                        <Input
                          type="number"
                          value={row.quantity || ''}
                          onChange={(e) => updateAssessmentRow(row.id, { quantity: parseInt(e.target.value) || 1 })}
                          className="h-7 text-[11px] text-center border-transparent hover:border-input focus:bg-background px-0"
                          placeholder="1"
                          min="1"
                        />
                      </td>
                    )}
                    {visible.unitPrice && (
                      <td className="px-1 py-1.5">
                        <Input
                          type="number"
                          value={row.estimated || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            updateAssessmentRow(row.id, {
                              estimated: val,
                              // if this row is already marked allowed, keep assessed in sync
                              ...(row.allowed && { assessed: val }),
                            });
                          }}
                          className="h-7 text-[11px] text-right bg-transparent border-transparent hover:border-input focus:bg-background px-1"
                          placeholder="0.00"
                          min="0"
                        />
                      </td>
                    )}
                    {visible.gst && (
                      <td className="px-1 py-1.5">
                        <Input
                          type="number"
                          value={row.gst}
                          onChange={(e) => updateAssessmentRow(row.id, { gst: parseInt(e.target.value) || 0 })}
                          className="h-7 text-[11px] text-center border-transparent hover:border-input focus:bg-background px-0"
                          placeholder="18"
                        />
                      </td>
                    )}


                    {/* ─── Always-on assessment columns ────── */}
                    <td className="px-1 py-1.5">
                      <Input
                        type="number"
                        value={row.assessed || ''}
                        onChange={(e) => updateAssessmentRow(row.id, { assessed: parseFloat(e.target.value) || 0 })}
                        className="h-7 text-[11px] text-right font-bold text-primary bg-transparent border-transparent hover:border-input focus:bg-background px-1"
                        placeholder="0.00"
                        min="0"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center text-[11px] font-bold text-danger bg-danger/5">
                      {row.allowed && row.section === 'parts' ? `${depRate}%` : '-'}
                    </td>
                    <td className="px-2 py-1.5 text-right text-xs font-black tabular-nums">
                      {row.allowed ? formatCurrency(netAssessed) : '₹0.00'}
                    </td>

                    {/* ─── Optional trailing columns ─────────── */}
                    {visible.action && (
                      <td className="px-1 py-1.5">
                        <select
                          value={row.action || ''}
                          onChange={(e) => updateAssessmentRow(row.id, { action: e.target.value as any })}
                          className="h-7 w-full text-[11px] rounded-md border border-transparent hover:border-input focus:border-input bg-transparent px-1 font-medium"
                        >
                          <option value="">—</option>
                          <option value="replace">Replace</option>
                          <option value="repair">Repair</option>
                          <option value="disallow">Disallow</option>
                        </select>
                      </td>
                    )}
                    {visible.remarks && (
                      <td className="px-1 py-1.5">
                        <Input
                          value={row.remarks || ''}
                          onChange={(e) => updateAssessmentRow(row.id, { remarks: e.target.value })}
                          className="h-7 text-[11px] bg-transparent border-transparent hover:border-input focus:bg-background px-1"
                          placeholder="—"
                        />
                      </td>
                    )}

                    {/* Delete — always on */}
                    <td className="px-1 py-1.5 text-center">
                      <button 
                        onClick={() => deleteAssessmentRow(row.id)}
                        className="text-muted-foreground hover:text-danger hover:bg-danger/10 p-1 rounded-md transition-colors"
                        title="Delete Row"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
