'use client';

import { Info } from 'lucide-react';
import { useClaimStore } from '@/stores/claim-store';
import {
  checkValidityOnAccidentDate,
  suggestedNote,
  appendNote,
} from '@/lib/claims/validity-advisory';

function formatDMY(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface ValidityAdvisoryProps {
  /** Stable id used to remember dismissal, e.g. "dl-transport". */
  id: string;
  /** Human label used in the copy and the suggested note. */
  label: string;
  /** Expiry date of the document being checked (ISO). */
  expiryDate: string | undefined | null;
  /** Existing remarks the recorded note is appended to. */
  existingRemarks: string;
  /** Called with the merged remarks text when the surveyor chooses to record. */
  onRecord: (mergedRemarks: string) => void;
}

/**
 * Advice — never a verdict.
 *
 * The app can see that a document had expired on the accident date, so it says
 * so. It does NOT flag the claim, colour the field red, block anything, or
 * write to the report. Whether this matters is the surveyor's judgement, and
 * repudiation is the insurer's decision.
 *
 * Reusable on purpose: DL non-transport, DL transport, fitness, permit and
 * policy period are all the same "was this valid on the date of loss"
 * question. Only the two DL call sites are wired today.
 */
export function ValidityAdvisory({
  id,
  label,
  expiryDate,
  existingRemarks,
  onRecord,
}: ValidityAdvisoryProps) {
  const currentClaim = useClaimStore(s => s.currentClaim);
  const updateClaim = useClaimStore(s => s.updateClaim);

  const accidentDate = currentClaim?.accident?.dateAndTime;
  const advice = checkValidityOnAccidentDate(expiryDate, accidentDate);
  const dismissed = currentClaim?.dismissedAdvisories ?? [];

  if (!advice || dismissed.includes(id)) return null;

  const note = suggestedNote(label, advice, formatDMY);

  return (
    <div
      className="mt-1.5 rounded-md border px-2.5 py-2 text-[11px] leading-relaxed"
      style={{
        // Neutral, not danger: a red field reads as a verdict the software is
        // not entitled to deliver.
        background: 'var(--color-neutral-50, #fafafa)',
        borderColor: 'var(--color-neutral-300, #d4d4d4)',
        color: 'var(--color-neutral-700, #404040)',
      }}
    >
      <div className="flex gap-1.5">
        <Info size={13} className="mt-px shrink-0 opacity-60" />
        <div>
          <div className="font-medium">
            This licence had expired on the date of the accident.
          </div>
          <div className="mt-0.5 opacity-80">
            {label} ended {formatDMY(advice.expiryDate)}; the accident was {formatDMY(advice.accidentDate)}.
          </div>

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => onRecord(appendNote(existingRemarks, note))}
              className="rounded px-2 py-1 font-medium text-white"
              style={{ background: '#B03C26' }}
            >
              Record this
            </button>
            <button
              type="button"
              onClick={() => updateClaim({ dismissedAdvisories: [...dismissed, id] })}
              className="rounded px-2 py-1 opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
