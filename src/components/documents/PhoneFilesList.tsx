'use client';
import { Smartphone, ExternalLink } from 'lucide-react';
import { useClaimStore } from '@/stores/claim-store';
import { DOC_TYPE_LABEL, type ClaimDocument } from '@/types/documents';
import { phoneListGroups } from '@/lib/scan-import/cards';

interface Props {
  onOpen: (doc: ClaimDocument) => void;
}

/** Phone files with no AI card: the surveyor ticks each one after checking it, before the portal upload. Never sent to AI. */
export function PhoneFilesList({ onOpen }: Props) {
  const claim = useClaimStore((s) => s.currentClaim);
  const updateClaim = useClaimStore((s) => s.updateClaim);
  const groups = claim ? phoneListGroups(claim) : [];
  const all = groups.flatMap((g) => g.docs);
  if (all.length === 0) return null;
  const checked = all.filter((d) => d.portalChecked).length;

  const toggle = (id: string) => {
    const docs = useClaimStore.getState().currentClaim?.documents; // latest, not the render snapshot
    const doc = docs?.[id];
    if (!doc) return;
    updateClaim({ documents: { ...docs, [id]: { ...doc, portalChecked: !doc.portalChecked } } });
  };

  return (
    <div className="rounded-2xl bg-card border border-[var(--color-neutral-200)] px-5 py-4" style={{ boxShadow: '0 1px 3px rgba(13,27,42,0.04)' }}>
      <div className="flex items-center gap-2.5 mb-3">
        <Smartphone size={16} className="text-primary" />
        <span className="text-xs font-medium text-[var(--color-neutral-900)]">Phone files</span>
        <span className="text-[11px] text-[var(--color-neutral-400)]">· Checked {checked} of {all.length}</span>
      </div>
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.type}>
            <div className="text-[11px] font-medium text-[var(--color-neutral-600)] mb-1">
              {DOC_TYPE_LABEL[g.type]} <span className="text-[var(--color-neutral-400)]">({g.docs.length})</span>
            </div>
            <div className="flex flex-col divide-y divide-[var(--color-neutral-100)]">
              {g.docs.map((d) => (
                <div key={d.id} className="flex items-center gap-2.5 py-2">
                  <input
                    type="checkbox"
                    checked={!!d.portalChecked}
                    onChange={() => toggle(d.id)}
                    aria-label={`Checked for portal: ${d.relPath}`}
                  />
                  <span className="text-xs text-[var(--color-neutral-900)] truncate flex-1 min-w-0" title={d.relPath}>
                    {d.relPath.split('/').pop()}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpen(d)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-primary hover:bg-[var(--color-status-warning-tint)] transition-colors"
                  >
                    Open <ExternalLink size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
