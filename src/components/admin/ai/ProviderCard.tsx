'use client';

import { useState } from 'react';
import { Cpu, RefreshCw, Power, Loader2, FlaskConical } from 'lucide-react';
import { formatCtx, type ProviderId, type ProviderConfig } from '@/lib/ai/models-config';
import type { ProviderProbe, ProbeResult } from '@/lib/ai/probe-types';
import type { ProbeDiff } from '@/lib/ai/probe-diff';
import type { ModelTestResult } from '@/lib/ai/service';
import { discoveryCounts } from '@/lib/ai/admin-rank';

interface Props {
  provider: ProviderId;
  meta: { label: string; color: string };
  block: ProviderConfig;
  probe: ProviderProbe;
  diff: ProbeDiff;
  hasKey: boolean;
  probing: boolean;
  onToggleProvider: () => void;
  onProbe: () => void;
  onTest: (modelId: string, file: File) => void;
  testing: string | null;
  testResult: Record<string, ModelTestResult>;
  testProgress: string;
  onNote: (id: string, note: string) => void;
}

/** Only measured facts — nothing inferred from the model name. */
function badge(r: ProbeResult): string {
  const parts = [r.vision ? 'vision' : 'text only'];
  if (r.vision && r.imageCap !== null) parts.push(`${r.imageCap} img/call`);
  if (r.ctxWindow !== null) parts.push(`${formatCtx(r.ctxWindow)} ctx`);
  parts.push(r.slow || r.msPerPage === null ? '>90s/page' : `${Math.round(r.msPerPage / 1000)}s/page`);
  return parts.join(' · ');
}

/** One provider: header, discovery line, in-chain models (test + note), hidden group. */
export function ProviderCard({ provider, meta, block, probe, diff, hasKey, probing, onToggleProvider, onProbe, onTest, testing, testResult, testProgress, onNote }: Props) {
  const [showHidden, setShowHidden] = useState(false);
  const counts = discoveryCounts(block, probe);
  const inChain = diff.working.filter(r => !block.excluded.includes(r.id));
  const unusable = Object.values(probe.models).filter(m => m.status !== 'ok');
  const retired = diff.gone.filter(g => !probe.models[g.id]);
  const hiddenCount = unusable.length + retired.length;

  return (
    <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 py-4 flex items-center gap-3 border-b border-border bg-card">
        <Cpu size={16} style={{ color: meta.color }} />
        <h2 className="text-sm font-medium text-foreground">{meta.label}</h2>
        <button onClick={onToggleProvider}
          className={`ml-2 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium ${block.enabled ? 'bg-status-success-tint text-status-success' : 'bg-neutral-100 text-neutral-600'}`}>
          <Power size={11} /> {block.enabled ? 'Enabled' : 'Disabled'}
        </button>
        {!hasKey && <span className="text-[10px] text-muted-foreground">no key in your Profile</span>}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={onProbe} disabled={probing || !hasKey}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium border border-border disabled:opacity-50">
            <RefreshCw size={11} /> Probe
          </button>
        </div>
      </div>

      {probe.error ? (
        <div className="px-6 py-4 text-xs text-status-danger">Probe did not run: {probe.error} — previous results kept.</div>
      ) : counts.found === 0 ? (
        <div className="px-6 py-4 text-xs text-muted-foreground">No probe results yet — click &quot;Refresh &amp; probe&quot;.</div>
      ) : (
        <div className="divide-y divide-border">
          <div className="px-6 py-2 text-[10px] text-muted-foreground">
            {counts.found} found · {counts.inChain} in chain · {diff.added.length} NEW · {counts.autoExcluded} auto-excluded · {counts.byAdmin} excluded by you · {counts.hidden} not served / paid / retired (hidden)
          </div>
          {inChain.map(row => {
            const tag = `${provider}:${row.id}`;
            const result = testResult[tag];
            return (
              <div key={row.id} className="px-6 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-xs font-medium text-foreground">{row.id.split('/').pop()}</code>
                  {diff.added.includes(row.id) && <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-status-success-tint text-status-success">NEW</span>}
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-card text-muted-foreground">{badge(row)}</span>
                  {row.slow && <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-status-warning-tint text-status-warning">SLOW</span>}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">{row.id}</div>
                <textarea value={block.notes[row.id] ?? ''} onChange={e => onNote(row.id, e.target.value)} placeholder="Admin note" rows={1}
                  className="mt-1.5 w-full text-[11px] px-2 py-1 rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary" />
                <div className="mt-2">
                  <label className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-lg border border-border cursor-pointer hover:bg-card">
                    {testing === tag ? <Loader2 size={11} className="animate-spin" /> : <FlaskConical size={11} />}
                    Test with estimate PDF
                    <input type="file" accept="application/pdf,image/*" className="hidden" disabled={testing !== null || probing}
                      onChange={e => { const f = e.target.files?.[0]; if (f) onTest(row.id, f); e.currentTarget.value = ''; }} />
                  </label>
                  {testing === tag && <span className="ml-2 text-[10px] text-muted-foreground">{testProgress}</span>}
                  {result && (
                    <pre className={`mt-1.5 max-h-48 overflow-auto text-[10px] p-2 rounded-lg border ${result.ok ? 'border-status-success-tint bg-status-success-tint' : 'border-status-danger-tint bg-status-danger-tint'}`}>
                      {result.ok ? `✅ ${(result.ms / 1000).toFixed(1)}s\n` + JSON.stringify(result.data, null, 2) : `❌ ${result.error}`}
                    </pre>
                  )}
                </div>
              </div>
            );
          })}
          {hiddenCount > 0 && (
            <div className="px-6 py-3">
              <button onClick={() => setShowHidden(s => !s)} className="text-[10px] font-medium text-muted-foreground hover:text-foreground">
                {showHidden ? 'Hide' : 'Show'} {hiddenCount} hidden
              </button>
              {showHidden && (
                <div className="mt-2 space-y-1">
                  {unusable.map(m => (
                    <div key={m.id} className="text-[10px] text-muted-foreground">
                      <span className="font-mono">{m.id}</span> — <span className="font-medium">{m.status}</span>{m.reason ? `: ${m.reason}` : ''}
                    </div>
                  ))}
                  {retired.map(g => (
                    <div key={g.id} className="text-[10px] text-muted-foreground">
                      <span className="font-mono">{g.id}</span> — <span className="font-medium">retired</span>: {g.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
