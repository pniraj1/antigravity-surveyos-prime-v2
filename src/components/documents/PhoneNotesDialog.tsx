'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useClaimStore } from '@/stores/claim-store';
import { applyNotes, type Change, type NotesPlan } from '@/lib/scan-import/notes';

interface Props {
  plan: NotesPlan;
  /** The claim the plan was made for; Apply refuses if another claim is open. */
  claimId: string;
  onClose: () => void;
}

/** Prime stores isInsurable as a boolean; show it the way the phone says it. */
const show = (c: Change, v: string) =>
  c.key === 'valuationDetails.isInsurable' && (v === 'true' || v === 'false') ? (v === 'true' ? 'yes' : 'no') : v || '(empty)';

/** Reviews SurveyOS Scan phone notes. Nothing is written until Apply. */
export function PhoneNotesDialog({ plan, claimId, onClose }: Props) {
  // fill: false = unticked (default on). differ: true = Use phone (default Keep Prime).
  const [picks, setPicks] = useState<Record<string, boolean>>({});
  const panelRows = useClaimStore((s) => s.currentClaim?.valuationDetails?.panelRows) ?? [];
  const { damage, parts, partConditions } = plan.rows;
  const rowCount = damage.length + parts.length + partConditions.length;
  const pick = (key: string, v: boolean) => setPicks((p) => ({ ...p, [key]: v }));

  const apply = () => {
    const { currentClaim, updateClaim } = useClaimStore.getState();
    if (currentClaim?.id !== claimId) {
      toast.error('Another claim is open. Phone notes were not applied.');
      onClose();
      return;
    }
    const updates = applyNotes(currentClaim, plan, picks);
    updateClaim(updates);
    // Only scanImport means every item was kept or unticked: the choices are saved, no field changed.
    toast.success(Object.keys(updates).length > 1 ? 'Phone notes applied.' : 'Phone notes saved. No field changed.');
    onClose();
  };

  const seg = (on: boolean) =>
    `min-h-[36px] px-3 text-xs ${on ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground'} disabled:opacity-40`;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Phone notes</DialogTitle>
        </DialogHeader>

        {plan.fill.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Will fill</h3>
            {plan.fill.map((c) => (
              <label key={c.key} className="flex items-start gap-2 rounded-md border border-border p-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={picks[c.key] !== false}
                  onChange={(e) => pick(c.key, e.target.checked)}
                />
                <span>
                  <span className="font-medium">{c.label}:</span> {show(c, c.phone)}
                  {c.prime && <span className="text-muted-foreground"> (replaces Prime: {show(c, c.prime)})</span>}
                </span>
              </label>
            ))}
          </section>
        )}

        {plan.differ.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Phone notes differ</h3>
            {plan.differ.map((c) => (
              <div key={c.key} className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900 space-y-2">
                <div className="font-medium">{c.label}</div>
                <div className="text-xs">Prime: “{show(c, c.prime)}” · Phone: “{show(c, c.phone)}”</div>
                {!c.writable && <div className="text-xs">The phone value can&apos;t be used here. Edit it by hand if it is right.</div>}
                <div className="inline-flex overflow-hidden rounded-md border border-border">
                  <button type="button" className={seg(picks[c.key] !== true)} onClick={() => pick(c.key, false)}>Keep Prime</button>
                  <button type="button" className={seg(picks[c.key] === true)} disabled={!c.writable} onClick={() => pick(c.key, true)}>Use phone</button>
                </div>
              </div>
            ))}
          </section>
        )}

        {rowCount > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Rows to add</h3>
            {damage.map((r, i) => (
              <div key={`d${i}`} className="rounded-md border border-border p-2 text-sm">Damage: {r.component} — {r.damage}</div>
            ))}
            {parts.map((r, i) => (
              <div key={`p${i}`} className="rounded-md border border-border p-2 text-sm">Part: {r.component}{r.condition ? ` — ${r.condition}` : ''}</div>
            ))}
            {partConditions.map((r) => (
              <div key={r.id} className="rounded-md border border-border p-2 text-sm">
                Part condition: {panelRows.find((p) => p.id === r.id)?.component ?? 'part'} — {r.condition}
              </div>
            ))}
          </section>
        )}

        <DialogFooter className="gap-2">
          <button type="button" onClick={onClose} className="min-h-[44px] rounded-md border border-border px-4 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            className="min-h-[44px] rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Apply
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
