'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useClaimStore } from '@/stores/claim-store';
import { useExtractionStore } from '@/stores/extraction-store';
import { useProfileStore } from '@/stores/profile-store';
import { extractDocument } from '@/lib/ai/processor';
import { stripPageTags } from '@/lib/ai/row-check';
import { buildEstimateRows, type EstimateApplyMode } from '@/stores/slices/aiDataSlice';
import {
  planEstimateFix,
  sheetToEstimateData,
  type EstimateFixChange,
  type EstimateFixPlan,
  type EstimateFixSource,
} from '@/lib/ai/estimate-fix';

interface FixEstimateDialogProps {
  open: boolean;
  onClose: () => void;
}

type Stage = 'ask' | 'reading' | 'review';

const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const FIELD_LABELS: Record<keyof EstimateFixChange['before'], string> = {
  particulars: 'Item',
  estimated: 'Estimate',
  gst: 'GST%',
  quantity: 'Qty',
  partType: 'Type',
};

/** Only the fields that differ, as "Label: old → new". */
function changeLines(c: EstimateFixChange): string[] {
  const val = (side: EstimateFixChange['before'], k: keyof typeof FIELD_LABELS) =>
    k === 'quantity' ? (side.quantity ?? 1) : side[k]; // a missing quantity means 1
  const shown = (k: keyof typeof FIELD_LABELS, v: unknown) =>
    k === 'estimated' ? `₹${INR.format(Number(v))}` : String(v);
  return (Object.keys(FIELD_LABELS) as (keyof typeof FIELD_LABELS)[])
    .filter((k) => val(c.before, k) !== val(c.after, k))
    .map((k) => `${FIELD_LABELS[k]}: ${shown(k, val(c.before, k))} → ${shown(k, val(c.after, k))}`);
}

/** A file uploaded as a supplementary defaults to Supplementary; another picked file defaults to Original. */
export function defaultFixSource(rememberedMode: EstimateApplyMode | undefined, pickedAnother: boolean): EstimateFixSource {
  return !pickedAnother && rememberedMode === 'append' ? 'supplementary' : 'estimate';
}

const SOURCE_OPTIONS: { value: EstimateFixSource; label: string }[] = [
  { value: 'estimate', label: 'Original estimate' },
  { value: 'supplementary', label: 'Supplementary estimate' },
];

export function FixSourceToggle({ value, onChange }: { value: EstimateFixSource; onChange: (v: EstimateFixSource) => void }) {
  return (
    <div role="radiogroup" aria-label="This file is" className="flex items-center gap-3 text-xs">
      <span className="font-medium">This file is:</span>
      {SOURCE_OPTIONS.map((o) => (
        <label key={o.value} className="flex items-center gap-1">
          <input type="radio" name="fix-source" checked={value === o.value} onChange={() => onChange(o.value)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

/**
 * Replaces the floating "Fix Extraction" chat pill. The surveyor says what the
 * AI got wrong, ONE re-read runs, the result is compared with the sheet, and
 * the surveyor ticks what to apply. Nothing is deleted; nothing is applied
 * without a tick.
 */
export function FixEstimateDialog({ open, onClose }: FixEstimateDialogProps) {
  const [stage, setStage] = useState<Stage>('ask');
  const [note, setNote] = useState('');
  const [chosen, setChosen] = useState<File | null>(null);
  const [pickedSource, setPickedSource] = useState<EstimateFixSource | null>(null);
  const [progress, setProgress] = useState('');
  const [plan, setPlan] = useState<EstimateFixPlan | null>(null);
  const [missingIds, setMissingIds] = useState<string[]>([]);
  const [changedIds, setChangedIds] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const storedFile = useExtractionStore((s) => s.files.estimate);
  const storedMode = useExtractionStore((s) => s.fileModes.estimate);
  const rememberFile = useExtractionStore((s) => s.rememberFile);
  const aiDocMode = useProfileStore((s) => s.profile.aiDocMode);
  const applyEstimateFixToClaim = useClaimStore((s) => s.applyEstimateFixToClaim);

  useEffect(() => () => abortRef.current?.abort(), []);

  if (!open) return null;

  const file = chosen ?? storedFile;
  const source = pickedSource ?? defaultFixSource(storedMode, !!chosen);
  const canSend = note.trim() !== '' && !!file;

  const close = () => {
    abortRef.current?.abort();
    setStage('ask');
    setNote('');
    setChosen(null);
    setPickedSource(null);
    setPlan(null);
    onClose();
  };

  const send = async () => {
    const sheet = useClaimStore.getState().currentClaim?.assessmentRows ?? [];
    if (!file || !canSend) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress('Preparing...');
    setStage('reading');
    if (chosen) rememberFile('estimate', chosen, source === 'supplementary' ? 'append' : undefined);
    try {
      const forceDocMode = !aiDocMode || aiDocMode === 'auto' ? undefined : aiDocMode;
      const { data } = await extractDocument(
        'estimate', [file], (msg: string) => setProgress(msg), note.trim(),
        sheetToEstimateData(sheet), forceDocMode, controller.signal,
      );
      if (controller.signal.aborted) return;
      const next = planEstimateFix(sheet, buildEstimateRows(stripPageTags(data), source, 1), source);
      setPlan(next);
      setMissingIds(next.missing.map((m) => m.id)); // missing rows ticked by default
      setChangedIds([]); // changed rows are opt-in
      setStage('review');
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return; // deliberate Cancel
      toast.error(`Re-read failed: ${err instanceof Error ? err.message : 'unknown error'}`);
      setStage('ask');
    }
  };

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const apply = () => {
    if (plan) applyEstimateFixToClaim(plan, { missingIds, changedRowIds: changedIds });
    close();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl p-6 flex flex-col gap-4 shadow-2xl bg-card border border-border">
        <h2 className="text-sm font-medium text-foreground">Fix estimate reading</h2>

        {stage === 'ask' && (
          <>
            <label className="flex flex-col gap-1.5 text-xs font-medium">
              Tell the AI what it got wrong
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-[80px] resize-none text-sm font-normal"
              />
              <span className="text-[11px] font-normal text-muted-foreground">
                e.g. items 38–52 missing · last column is taxable, without GST · page 3 not read
              </span>
            </label>
            <div className="flex flex-col gap-1.5 text-xs">
              {file ? (
                <span>Re-reading: <span className="font-medium">{file.name}</span></span>
              ) : (
                <span className="font-medium">Choose the estimate file again</span>
              )}
              {file && <span className="text-[11px] text-muted-foreground">Choose another file</span>}
              <input
                type="file"
                accept="image/*,application/pdf"
                aria-label={file ? 'Choose another file' : 'Choose the estimate file again'}
                onChange={(e) => {
                  setChosen(e.target.files?.[0] ?? null);
                  setPickedSource(null); // a different file defaults back to Original
                }}
                className="text-xs"
              />
            </div>
            <FixSourceToggle value={source} onChange={setPickedSource} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={close}>Cancel</Button>
              <Button onClick={() => void send()} disabled={!canSend}>Send</Button>
            </div>
          </>
        )}

        {stage === 'reading' && (
          <>
            <p className="text-xs text-muted-foreground">{progress}</p>
            <div className="flex justify-end">
              <Button variant="outline" onClick={close}>Cancel</Button>
            </div>
          </>
        )}

        {stage === 'review' && plan && (
          <>
            {plan.missing.length === 0 && plan.changed.length === 0 && (
              <p className="text-xs text-muted-foreground">The re-read found nothing new or different.</p>
            )}
            {plan.missing.length > 0 && (
              <section className="flex flex-col gap-1.5">
                <h3 className="text-xs font-semibold">Missing on the sheet ({plan.missing.length})</h3>
                {plan.missing.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={missingIds.includes(m.id)}
                      onChange={() => toggle(missingIds, setMissingIds, m.id)}
                    />
                    <span className="w-8 text-muted-foreground">{m.srNo ?? ''}</span>
                    <span className="flex-1">{m.particulars}</span>
                    <span className="tabular-nums">₹{INR.format(m.estimated)}</span>
                  </label>
                ))}
              </section>
            )}
            {plan.changed.length > 0 && (
              <section className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold">Changed ({plan.changed.length})</h3>
                  <Button variant="outline" size="sm" onClick={() => setChangedIds(plan.changed.map((c) => c.rowId))}>
                    Accept all changes
                  </Button>
                </div>
                {plan.changed.map((c) => (
                  <label key={c.rowId} className="flex items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={changedIds.includes(c.rowId)}
                      onChange={() => toggle(changedIds, setChangedIds, c.rowId)}
                    />
                    <span className="flex flex-col">
                      <span className="font-medium">{c.before.particulars}</span>
                      {changeLines(c).map((line) => (
                        <span key={line} className="text-muted-foreground">{line}</span>
                      ))}
                    </span>
                  </label>
                ))}
              </section>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={close}>Cancel</Button>
              {(plan.missing.length > 0 || plan.changed.length > 0) && (
                <Button onClick={apply} disabled={missingIds.length + changedIds.length === 0}>Apply ticked</Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
