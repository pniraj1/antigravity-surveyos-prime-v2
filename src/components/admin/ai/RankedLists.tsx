'use client';
import { Ban, RotateCcw } from 'lucide-react';
import type { AIModelsConfig, ProviderId } from '@/lib/ai/models-config';
import type { ModelProbes } from '@/lib/ai/probe-types';
import { rankedLists, lastEligibleFor, ADMIN_JOBS, type RankedRow } from '@/lib/ai/admin-rank';
import { dailyLimit } from '@/lib/ai/quota';
import { toast } from 'sonner';

const PROVIDER_LABEL: Record<ProviderId, string> = { gemini: 'Gemini', groq: 'Groq', nvidia: 'NVIDIA', ollama: 'Ollama' };

interface Props {
  config: AIModelsConfig; probes: ModelProbes | null; newIds: ReadonlySet<string>;
  onExclude: (provider: ProviderId, id: string) => void;
  onInclude: (provider: ProviderId, id: string) => void;
  onLimit: (provider: ProviderId, id: string, value: number | null) => void;
}

/** What the surveyor's loop will try, per job, in order — with the one lever per row: Exclude. */
export function RankedLists({ config, probes, newIds, onExclude, onInclude, onLimit }: Props) {
  const lists = rankedLists(config, probes, newIds);
  const excluded = (Object.keys(config.providers) as ProviderId[]).flatMap(p =>
    config.providers[p].excluded.map(id => ({ provider: p, id, reason: config.providers[p].excludedReason[id] ?? 'excluded by you' })));

  const exclude = (row: RankedRow) => {
    const empty = lastEligibleFor(config, probes, row.provider, row.id);
    if (empty) { toast.error(`${empty} would have no model left.`); return; }
    onExclude(row.provider, row.id);
  };

  // A limit of 0 drops the model from every job's chain, same as Exclude — same last-model guard.
  const setLimit = (provider: ProviderId, id: string, value: number | null) => {
    if (value === 0) {
      const empty = lastEligibleFor(config, probes, provider, id);
      if (empty) { toast.error(`${empty} would have no model left.`); return; }
    }
    onLimit(provider, id, value);
  };

  return (
    <div className="space-y-4">
      {ADMIN_JOBS.map(({ job, label }) => (
        <div key={job} className="bg-white rounded-2xl border border-border shadow-sm p-4">
          <h3 className="text-sm font-medium text-foreground mb-2">{label}</h3>
          {lists[job].length === 0 ? (
            <p className="text-xs text-status-danger">No model — every candidate is excluded or off.</p>
          ) : (
            <ol className="space-y-1">
              {lists[job].map((row, i) => {
                const custom = config.providers[row.provider].limits[row.id];
                return (
                  <li key={`${row.provider}/${row.id}`} className="flex items-center gap-3 text-xs">
                    <span className="w-5 text-right text-muted-foreground tabular-nums">{i + 1}</span>
                    <span className="font-mono text-foreground truncate">{PROVIDER_LABEL[row.provider]} · {row.id}</span>
                    {row.isNew && <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-status-success-tint text-status-success">NEW</span>}
                    <span className="text-muted-foreground truncate flex-1">{row.reason}</span>
                    <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      /day
                      <input type="number" min={0}
                        className={`w-16 px-1.5 py-0.5 rounded border text-xs text-right ${typeof custom === 'number' && custom < 0 ? 'border-status-danger' : 'border-border'}`}
                        value={typeof custom === 'number' ? custom : ''}
                        placeholder={String(dailyLimit(row.provider, row.id) === Infinity ? '∞' : dailyLimit(row.provider, row.id))}
                        onChange={e => setLimit(row.provider, row.id, e.target.value === '' ? null : Number(e.target.value))} />
                    </label>
                    <button onClick={() => exclude(row)} title="Exclude from every job"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border border-border text-muted-foreground hover:text-status-danger">
                      <Ban size={11} /> Exclude
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      ))}
      {excluded.length > 0 && (
        <details className="bg-white rounded-2xl border border-border shadow-sm p-4">
          <summary className="text-sm font-medium text-foreground cursor-pointer">Excluded ({excluded.length})</summary>
          <ul className="mt-2 space-y-1">
            {excluded.map(x => (
              <li key={`${x.provider}/${x.id}`} className="flex items-center gap-3 text-xs">
                <span className="font-mono text-foreground">{PROVIDER_LABEL[x.provider]} · {x.id}</span>
                <span className="text-muted-foreground flex-1">{x.reason}</span>
                <button onClick={() => onInclude(x.provider, x.id)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border border-border text-muted-foreground hover:text-foreground">
                  <RotateCcw size={11} /> Include
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
