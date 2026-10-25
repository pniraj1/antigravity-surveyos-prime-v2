'use client';

import { useClaimStore } from '@/stores/claim-store';
import { Input } from '@/components/ui/input';
import { DocSection } from '@/components/claim/form-bits';

const DV_DOCS = [
  { id: 'rc', label: 'RC' },
  { id: 'dl', label: 'DL' },
  { id: 'permit', label: 'Permit' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'loadChallan', label: 'Load Challan' },
  { id: 'fireReport', label: 'Fire Report' },
  { id: 'fir', label: 'FIR' },
];

const STATUSES = [
  { value: 'YES', color: 'var(--color-status-success)' },
  { value: 'NO', color: 'var(--color-status-danger)' },
  { value: 'N.A.', color: 'var(--color-neutral-500)' },
];

export function DocumentChecklist() {
  const currentClaim = useClaimStore(s => s.currentClaim);
  const updateClaim = useClaimStore(s => s.updateClaim);
  if (!currentClaim) return null;

  const dvFlags: any = currentClaim.documentVerification || {};
  const obtained = DV_DOCS.filter((d) => dvFlags[d.id]?.status === 'YES').length;
  const setDoc = (id: string, patch: Record<string, string>) => {
    const cur = dvFlags[id] || { status: 'NO', detail: '' };
    updateClaim({ documentVerification: { ...dvFlags, [id]: { ...cur, ...patch } } });
  };

  return (
    <DocSection
      title="Documents Obtained"
      action={
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground shrink-0">
          {obtained} / {DV_DOCS.length} obtained
        </span>
      }
      footer={
        <>
          <p className="text-xs text-muted-foreground mb-4">Mark whether a photocopy of each document was obtained.</p>
          <div className="grid grid-cols-1 @md:grid-cols-2 @4xl:grid-cols-3 gap-3">
            {DV_DOCS.map((doc) => {
              const status: string | undefined = dvFlags[doc.id]?.status;
              return (
                <div key={doc.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/20">
                  <span className="text-xs font-bold uppercase w-20 shrink-0 truncate" title={doc.label}>{doc.label}</span>
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <div className="inline-flex rounded-md border border-input overflow-hidden self-start">
                      {STATUSES.map((s) => {
                        const active = status === s.value;
                        return (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => setDoc(doc.id, { status: s.value })}
                            className="px-2.5 py-1 text-[10px] font-semibold transition-colors border-r border-input last:border-r-0"
                            style={active
                              ? { background: s.color, color: '#fff' }
                              : { background: 'transparent', color: 'var(--color-neutral-500)' }}
                          >
                            {s.value}
                          </button>
                        );
                      })}
                    </div>
                    {status === 'YES' && (
                      <Input
                        placeholder="e.g. Original seen"
                        className="h-7 text-[11px] px-2"
                        value={dvFlags[doc.id]?.detail || ''}
                        onChange={(e) => setDoc(doc.id, { detail: e.target.value })}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      }
    />
  );
}
