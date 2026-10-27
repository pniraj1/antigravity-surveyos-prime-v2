'use client';

import { Printer, X } from 'lucide-react';
import { useClaimStore } from '@/stores/claim-store';
import { policyCheckStatus } from '@/lib/policy/policy-check';
import { PolicyCheckCard } from '@/components/policy/PolicyCheckCard';
import type { ClaimData } from '@/types/claim';

interface BeforePrintDialogProps {
  showUiic: boolean;
  /** Policy check card; Print stays disabled until all four are answered. */
  showPolicy: boolean;
  onPrint: () => void;
  onCancel: () => void;
  printLabel?: string;
}

const INPUT = 'w-full px-3 py-2 rounded-lg border border-border outline-none text-sm font-medium';
const LABEL = 'text-[10px] font-medium uppercase tracking-widest text-muted-foreground block mb-1.5';

const DATE_FIELDS = [
  { key: 'riAppointmentDate', label: 'Reinspection appointment date' },
  { key: 'repairAuthDate', label: 'Repair Authorisation Date' },
  { key: 'estCompletionDate', label: 'Est. Repair Completion Date' },
  { key: 'actualCompletionDate', label: 'Actual Repair Completion Date' },
] as const;

/** Asked at print time so the UIIC report never goes out with these blank by accident. */
export function BeforePrintDialog(props: BeforePrintDialogProps) {
  const claim = useClaimStore(s => s.currentClaim); // live: Print enables as the surveyor answers in the card
  const updateReinspection = useClaimStore(s => s.updateReinspection);
  return <BeforePrintDialogView {...props} claim={claim} updateReinspection={updateReinspection} />;
}

// ponytail: split from the store wrapper so tests can render with a claim (renderToStaticMarkup reads zustand initial state)
export function BeforePrintDialogView({ showUiic, showPolicy, claim, updateReinspection, onPrint, onCancel, printLabel }: BeforePrintDialogProps & {
  claim: ClaimData | null;
  updateReinspection: (updates: Partial<ClaimData['reinspection']>) => void;
}) {
  const reinspection = claim?.reinspection;
  const blocked = showPolicy && !!claim && !policyCheckStatus(claim).complete;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5 shadow-2xl animate-in fade-in zoom-in duration-200 bg-card border border-border">
        <h2 className="text-sm font-medium text-foreground">{showUiic ? 'Before printing — UIIC' : 'Before printing'}</h2>

        {showPolicy && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-foreground">Policy check — confirm before printing</h3>
            <PolicyCheckCard />
          </div>
        )}

        {showUiic && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {DATE_FIELDS.map(({ key, label }) => (
                <div key={key}>
                  <label htmlFor={`bp-${key}`} className={LABEL}>{label}</label>
                  <input id={`bp-${key}`} type="date" className={INPUT}
                    value={reinspection?.[key] || ''}
                    onChange={e => updateReinspection({ [key]: e.target.value })} />
                </div>
              ))}
            </div>
            <div>
              <span id="bp-repairs-label" className={LABEL}>Repairs as per assessment</span>
              <div role="group" aria-labelledby="bp-repairs-label" className="flex gap-2">
                {(['YES', 'NO', 'PARTIAL'] as const).map(val => (
                  <button
                    key={val}
                    onClick={() => updateReinspection({ repairsAsAssessed: val })}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      reinspection?.repairsAsAssessed === val
                        ? 'bg-primary text-[var(--color-neutral-900)]'
                        : 'bg-[var(--color-neutral-50)] border border-border text-muted-foreground'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Blank dates are allowed if reinspection is not done yet.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={onPrint}
            disabled={blocked}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium bg-primary text-primary-foreground transition-all hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
          >
            <Printer size={14} />
            {printLabel ?? 'Print'}
          </button>
          <button
            onClick={onCancel}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground transition-all"
          >
            <X size={14} />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
