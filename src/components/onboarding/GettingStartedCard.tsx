'use client';

import { CheckCircle2, Circle } from 'lucide-react';
import { useProfileStore } from '@/stores/profile-store';
import { useUIStore } from '@/stores/ui-store';
import { useClaimStore } from '@/stores/claim-store';
import { getChecklist, markOnboarding, type ChecklistId, type ChecklistItem } from '@/lib/onboarding/rules';
import { checklistAction, checklistClaimTarget, isChecklistVisible } from '@/lib/onboarding/setup';
import { openClaim } from '@/lib/claims/open-claim';

interface ChecklistViewProps {
  items: ChecklistItem[];
  onHide: () => void;
  onOpen: (id: ChecklistId) => void;
  hasClaims: boolean;
}

export function ChecklistView({ items, onHide, onOpen, hasClaims }: ChecklistViewProps) {
  const done = items.filter((i) => i.done).length;
  const firstOpen = items.find((i) => !i.done)?.id;
  return (
    <section aria-label="Getting started" className="print:hidden bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">Getting started</h2>
          <p className="text-xs text-muted-foreground">{done} of {items.length} done</p>
        </div>
        <button type="button" onClick={onHide} className="min-h-11 px-3 text-xs font-medium text-muted-foreground underline">
          Hide
        </button>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden="true">
        <div className="h-full bg-primary" style={{ width: `${(done / items.length) * 100}%` }} />
      </div>
      <ul className="mt-3 space-y-1">
        {items.map((item) => {
          const rowClass = `w-full min-h-11 flex items-center gap-3 px-2 rounded-lg text-left text-sm ${
            item.id === firstOpen ? 'font-medium text-foreground bg-primary/5' : 'text-muted-foreground'
          }`;
          const content = (
            <>
              {item.done ? <CheckCircle2 size={16} className="text-status-success" /> : <Circle size={16} />}
              <span className={item.done ? 'line-through' : ''}>{item.label}</span>
              <span className="sr-only">{item.done ? '(done)' : '(not done yet)'}</span>
            </>
          );
          return (
            <li key={item.id}>
              {checklistAction(item.id, hasClaims) ? (
                <button type="button" onClick={() => onOpen(item.id)} className={`${rowClass} hover:bg-muted`}>
                  {content}
                </button>
              ) : (
                <div className={rowClass}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function GettingStartedCard() {
  const profile = useProfileStore((s) => s.profile);
  const loginSyncDone = useUIStore((s) => s.loginSyncDone);
  const isDriveConnected = useUIStore((s) => s.isDriveConnected);
  const claimsList = useClaimStore((s) => s.claimsList);

  const items = getChecklist(profile, claimsList, isDriveConnected);
  if (!isChecklistVisible(profile, loginSyncDone, items)) return null;

  const open = (id: ChecklistId) => {
    const action = checklistAction(id, claimsList.length > 0);
    const ui = useUIStore.getState();
    if (action?.kind === 'setup') ui.setSetupStep(action.step);
    else if (action?.kind === 'newClaim') ui.setNewClaimDialogOpen(true);
    else if (action?.kind === 'openClaim') {
      const target = checklistClaimTarget(id, claimsList);
      if (target) void openClaim(target.claimId, target.tab);
      else ui.setNewClaimDialogOpen(true);
    }
  };

  return (
    <ChecklistView
      items={items}
      onHide={() => markOnboarding({ checklistHiddenAt: new Date().toISOString() })}
      onOpen={open}
      hasClaims={claimsList.length > 0}
    />
  );
}
