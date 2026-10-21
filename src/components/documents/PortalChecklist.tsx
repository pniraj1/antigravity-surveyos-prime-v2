'use client';
import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, XCircle } from 'lucide-react';
import type { ClaimData } from '@/types/claim';
import type { BoxState } from '@/lib/documents/kit/checklist';
import type { BoxError } from '@/lib/documents/kit/orchestrate';
import { canBuild, countsLine, sourceLine } from '@/lib/documents/kit/panel';
import type { BuiltFile, DocumentKit } from '@/lib/documents/kit/useDocumentKit';
import { UploadReview } from './UploadReview';

interface Props {
  claim: ClaimData;
  kit: DocumentKit;
}

type Flow = NonNullable<ClaimData['portalFlow']>;
const FLOWS: Array<{ id: Flow; label: string }> = [
  { id: 'nontieup', label: 'Non-tieup' },
  { id: 'kia', label: 'KIA tie-up' },
];

function StatusWord({ status }: { status: BoxState['status'] }) {
  switch (status) {
    case 'ready': return <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 size={13} /> Ready ✓</span>;
    case 'check': return <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700"><AlertTriangle size={13} /> Check !</span>;
    case 'missing': return <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"><XCircle size={13} /> Missing ✗</span>;
    case 'notNeeded': return <span className="text-xs font-semibold text-muted-foreground">Not needed</span>;
    default: return <span className="text-xs font-medium text-muted-foreground">Optional</span>;
  }
}

function BoxRow({ s, claim, error, onNotNeeded }: { s: BoxState; claim: ClaimData; error?: string; onNotNeeded: (notNeeded: boolean) => void }) {
  const source = sourceLine(s.parts, claim.documents ?? {});
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-2.5">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{s.box.label}</span>
          <StatusWord status={s.status} />
          {s.alternatives > 0 && <span className="text-[11px] text-muted-foreground">{s.alternatives + 1} found</span>}
        </div>
        {source && <div className="truncate font-mono text-[11px] text-muted-foreground">{source}</div>}
        {s.reasons.map((r) => <div key={r} className="text-[11px] text-amber-800">{r}</div>)}
        {error && <div className="text-[11px] text-red-600">Not built: {error}</div>}
      </div>
      <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <input type="checkbox" checked={s.status === 'notNeeded'} onChange={(e) => onNotNeeded(e.target.checked)} />
        Not needed for this claim
      </label>
    </div>
  );
}

export function PortalChecklist({ claim, kit }: Props) {
  const { recipe, states, missingText } = kit;
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  // Why a box got no file in the last build; tagged with its claim like the built files.
  const [boxErrors, setBoxErrors] = useState<{ claimId: string; errors: BoxError[] } | null>(null);
  const errors = boxErrors?.claimId === claim.id ? boxErrors.errors : [];
  // The built blobs live here only (never stored); each is tagged with its claim so a claim switch drops them.
  const [built, setBuilt] = useState<{ claimId: string; files: BuiltFile[] } | null>(null);
  const [reviewFor, setReviewFor] = useState<string | null>(null);
  const files = built?.claimId === claim.id ? built.files : null;
  const set = kit.review.set;
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!recipe) {
    return <div className="rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">No portal list for this insurer yet.</div>;
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(missingText);
    } catch {
      return; // clipboard blocked: leave the button as it was rather than claim it copied
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  const build = async () => {
    setBuilding(true);
    setBuildError(null);
    const result = await kit.build();
    setBuilding(false);
    setBoxErrors({ claimId: claim.id, errors: result.errors ?? [] });
    if (!result.ok) { setBuildError(result.reason); return; }
    setBuilt({ claimId: claim.id, files: result.files });
    setReviewFor(claim.id);
  };

  return (
    <>
    <div id="portal-checklist" className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{recipe.title}</div>
          <div className="text-[11px] text-muted-foreground">{countsLine(states)}</div>
        </div>
        {recipe.portal === 'nia' && (
          <div className="inline-flex overflow-hidden rounded-lg border border-border" role="group" aria-label="Portal flow">
            {FLOWS.map((f) => (
              <button
                key={f.id} type="button" aria-pressed={recipe.flow === f.id} onClick={() => kit.setFlow(f.id)}
                className={`px-2.5 py-1 text-xs font-medium ${recipe.flow === f.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {recipe.provisional && <div className="px-4 pt-2 text-[11px] text-muted-foreground">This list is provisional. Check it against the portal.</div>}

      <div className="divide-y divide-border">
        {states.map((s) => (
          <BoxRow
            key={s.box.id} s={s} claim={claim} error={errors.find((e) => e.boxId === s.box.id)?.reason}
            onNotNeeded={(v) => kit.setNotNeeded(s.box.id, v)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2">
        <button
          type="button" onClick={copy} disabled={missingText === ''}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40"
        >
          <Copy size={12} /> {copied ? 'Copied' : 'Copy missing-documents message'}
        </button>
        <button
          type="button" onClick={() => document.getElementById('document-pages')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
        >
          Label pages
        </button>
        <button
          type="button" onClick={build} disabled={building || !canBuild(states)}
          className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-40"
        >
          {building ? 'Building…' : 'Build upload files'}
        </button>
        {set && reviewFor !== claim.id && (
          <button type="button" onClick={() => setReviewFor(claim.id)} className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted">
            Review upload set
          </button>
        )}
        {buildError && <span className="text-xs text-red-600">{buildError}</span>}
      </div>
    </div>
    {set && reviewFor === claim.id && <UploadReview kit={kit} set={set} files={files} />}
    </>
  );
}
