'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { SiteNotesPlan } from '@/lib/site/site-notes';

interface Props { plan: SiteNotesPlan; onApply: () => void; onClose: () => void }

/** Shows what the notes would fill. Only `fills` and new damage rows are applied. */
export function SiteNotesReviewDialog({ plan, onApply, onClose }: Props) {
  const applyCount = plan.fills.length + plan.damageRows.length;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fill fields from notes</DialogTitle>
        </DialogHeader>

        {plan.fills.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Will be filled</h3>
            {plan.fills.map((f) => (
              <div key={f.path} className="rounded-md border border-border p-2 text-sm">
                <div className="font-medium">{f.label}: {f.value}</div>
                {f.evidence && <div className="text-xs text-muted-foreground">“{f.evidence}”</div>}
              </div>
            ))}
          </section>
        )}

        {plan.damageRows.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Damage rows to add</h3>
            {plan.damageRows.map((r, i) => (
              <div key={i} className="rounded-md border border-border p-2 text-sm">
                {r.component} — {r.damage}
              </div>
            ))}
          </section>
        )}

        {plan.conflicts.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Already filled — not changed</h3>
            <p className="text-xs text-muted-foreground">Edit these by hand if the note is right.</p>
            {plan.conflicts.map((c) => (
              <div key={c.path} className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
                {c.label}: kept “{c.current}”, notes say “{c.proposed}”
              </div>
            ))}
          </section>
        )}

        {plan.unmapped.length > 0 && (
          <section className="space-y-1">
            <h3 className="text-sm font-medium">Not understood</h3>
            {plan.unmapped.map((u, i) => (
              <div key={i} className="text-sm text-muted-foreground">“{u}”</div>
            ))}
          </section>
        )}

        <DialogFooter className="gap-2">
          <button type="button" onClick={onClose} className="min-h-[44px] rounded-md border border-border px-4 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={applyCount === 0}
            className="min-h-[44px] rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Apply {applyCount}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
