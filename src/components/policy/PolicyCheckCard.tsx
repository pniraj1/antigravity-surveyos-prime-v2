'use client';

import { useClaimStore } from '@/stores/claim-store';
import { policyCheckStatus } from '@/lib/policy/policy-check';
import { Input } from '@/components/ui/input';
import type { ClaimData, PolicyCheck } from '@/types/claim';

type PillKey = 'nilDep' | 'imt23' | 'consumables';

const PILLS: { key: PillKey; label: string; options: [string, string][] }[] = [
  { key: 'nilDep', label: 'Nil / Zero Dep', options: [['yes', 'Yes'], ['no', 'No']] },
  { key: 'imt23', label: 'IMT 23', options: [['yes', 'Yes'], ['no', 'No'], ['na', 'N.A.']] },
  { key: 'consumables', label: 'Consumables cover', options: [['yes', 'Yes'], ['no', 'No']] },
];

const label = (v: string) => (v === 'yes' ? 'Yes' : 'No');

interface ViewProps {
  claim: ClaimData;
  setPolicyCheck: (updates: Partial<Omit<PolicyCheck, 'aiRead'>>) => void;
  updateFeeBill: (updates: Partial<ClaimData['feeBill']>) => void;
}

/** The surveyor's four policy answers. The AI read is shown beside each, never applied for them. */
export function PolicyCheckCard() {
  const claim = useClaimStore(s => s.currentClaim);
  const setPolicyCheck = useClaimStore(s => s.setPolicyCheck);
  const updateFeeBill = useClaimStore(s => s.updateFeeBill);
  if (!claim) return null;
  return <PolicyCheckCardView claim={claim} setPolicyCheck={setPolicyCheck} updateFeeBill={updateFeeBill} />;
}

// ponytail: split from the store wrapper so tests can render with a claim (renderToStaticMarkup reads zustand initial state)
export function PolicyCheckCardView({ claim: currentClaim, setPolicyCheck, updateFeeBill }: ViewProps) {
  const pc: PolicyCheck = currentClaim.policyCheck ?? {};
  const ai = pc.aiRead ?? {};
  const fb = currentClaim.feeBill ?? {}; // old claims may have no feeBill
  const { warnings } = policyCheckStatus(currentClaim);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 text-sm">
      {PILLS.map(({ key, label: text, options }) => (
        <div key={key} className="flex flex-wrap items-center gap-3">
          <span className="w-40 font-medium">{text}</span>
          <div className="flex gap-1">
            {options.map(([value, caption]) => (
              <button
                key={value}
                type="button"
                aria-pressed={pc[key] === value}
                onClick={() => setPolicyCheck({ [key]: value })}
                className={`px-3 h-7 rounded-full border text-xs font-medium ${
                  pc[key] === value ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input'
                }`}
              >
                {caption}
              </button>
            ))}
          </div>
          {ai[key] && <span className="text-xs text-muted-foreground">AI read: {label(ai[key])}</span>}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <span className="w-40 font-medium">Excess</span>
        <label className="flex items-center gap-1 text-xs">
          Compulsory
          <Input
            type="number"
            className="w-24 h-8 text-right"
            value={fb.compulsoryExcess || ''}
            placeholder="0"
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              updateFeeBill({ compulsoryExcess: val, lessExcess: val });
            }}
          />
        </label>
        <label className="flex items-center gap-1 text-xs">
          Voluntary
          <Input
            type="number"
            className="w-24 h-8 text-right"
            value={fb.voluntaryExcess || ''}
            placeholder="0"
            onChange={(e) => updateFeeBill({ voluntaryExcess: parseFloat(e.target.value) || 0 })}
          />
        </label>
        <label className="flex items-center gap-1 text-xs font-medium">
          <input
            type="checkbox"
            checked={!!pc.excessConfirmed}
            onChange={(e) => setPolicyCheck({ excessConfirmed: e.target.checked })}
          />
          Confirm
        </label>
        {(ai.compulsoryExcess !== undefined || ai.voluntaryExcess !== undefined) && (
          <span className="text-xs text-muted-foreground">
            AI read: ₹{ai.compulsoryExcess ?? 0} compulsory, ₹{ai.voluntaryExcess ?? 0} voluntary
          </span>
        )}
      </div>

      {warnings.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-amber-700">
          {warnings.map(w => <li key={w}>{w}</li>)}
        </ul>
      )}
    </div>
  );
}
