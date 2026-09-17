'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useProfileStore } from '@/stores/profile-store';
import { useAIConfigStore } from '@/stores/ai-config-store';
import { useProbesStore } from '@/stores/probes-store';
import {
  type AIModelsConfig, type ProviderId, type ProviderConfig,
  loadAIModelsConfig, saveAIModelsConfig, migrateConfig,
} from '@/lib/ai/models-config';
import { applyGuardRails } from '@/lib/ai/guard-rails';
import { runModelTest, type ModelTestResult, type AITestOverride } from '@/lib/ai/service';
import { runFullProbe, runProviderProbe } from '@/lib/ai/probe-runner';
import { loadModelProbes, saveModelProbes, EMPTY_PROBES, type ModelProbes } from '@/lib/ai/probe-types';
import { diffProbes } from '@/lib/ai/probe-diff';
import { discoveryCounts } from '@/lib/ai/admin-rank';
import { RankedLists } from '@/components/admin/ai/RankedLists';
import { ProviderCard } from '@/components/admin/ai/ProviderCard';

const PROVIDER_META: Record<ProviderId, { label: string; color: string; keyField: 'geminiApiKeys' | 'groqApiKeys' | 'nvidiaApiKeys' | 'ollamaApiKeys' }> = {
  gemini: { label: 'Google Gemini', color: '#D4AF37', keyField: 'geminiApiKeys' },
  groq:   { label: 'Groq',          color: '#F26639', keyField: 'groqApiKeys' },
  nvidia: { label: 'NVIDIA NIM',    color: '#76B900', keyField: 'nvidiaApiKeys' },
  ollama: { label: 'Ollama Cloud',  color: '#000000', keyField: 'ollamaApiKeys' },
};

const PROVIDERS: ProviderId[] = ['gemini', 'groq', 'nvidia', 'ollama'];

/** Totals for the post-probe toast. */
function chainCounts(config: AIModelsConfig, probes: ModelProbes): { inChain: number; auto: number } {
  return PROVIDERS.reduce((acc, p) => {
    const c = discoveryCounts(config.providers[p], probes.providers[p]);
    return { inChain: acc.inChain + c.inChain, auto: acc.auto + c.autoExcluded };
  }, { inChain: 0, auto: 0 });
}

export function AIModelsTab({ adminEmail }: { adminEmail: string }) {
  const { profile } = useProfileStore();
  const setStoreConfig = useAIConfigStore(s => s.setConfig);
  const [config, setConfig] = useState<AIModelsConfig | null>(null);
  const [probes, setProbes] = useState<ModelProbes>(EMPTY_PROBES);
  // The probe this one replaced — the NEW badge is a diff against it.
  const [prevProbes, setPrevProbes] = useState<ModelProbes>(EMPTY_PROBES);
  const [probing, setProbing] = useState(false);
  const [probeStatus, setProbeStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null); // `${provider}:${modelId}`
  const [testResult, setTestResult] = useState<Record<string, ModelTestResult>>({});
  const [testProgress, setTestProgress] = useState('');

  useEffect(() => {
    Promise.all([loadAIModelsConfig(), loadModelProbes()]).then(([cfg, pr]) => {
      setProbes(pr);
      setConfig(migrateConfig(cfg, pr.probedAt > 0 ? pr : null));
    });
  }, []);

  if (!config) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading config…</div>;

  const adminKey = (p: ProviderId): string | undefined =>
    (profile[PROVIDER_META[p].keyField] as string[] | undefined)?.[0]?.trim();

  const patch = (p: ProviderId, fn: (b: ProviderConfig) => Partial<ProviderConfig>) =>
    setConfig(prev => prev ? { ...prev, providers: { ...prev.providers, [p]: { ...prev.providers[p], ...fn(prev.providers[p]) } } } : prev);

  const without = <T,>(rec: Record<string, T>, id: string): Record<string, T> => Object.fromEntries(Object.entries(rec).filter(([k]) => k !== id));

  const onExclude = (p: ProviderId, id: string) => patch(p, b => ({
    excluded: b.excluded.includes(id) ? b.excluded : [...b.excluded, id], excludedReason: without(b.excludedReason, id) }));
  const onInclude = (p: ProviderId, id: string) => patch(p, b => ({
    excluded: b.excluded.filter(x => x !== id), excludedReason: without(b.excludedReason, id),
    keep: b.excludedReason[id] && !b.keep.includes(id) ? [...b.keep, id] : b.keep }));
  const onLimit = (p: ProviderId, id: string, v: number | null) => patch(p, b => ({ limits: v === null ? without(b.limits, id) : { ...b.limits, [id]: v } }));
  const onNote = (p: ProviderId, id: string, note: string) => patch(p, b => ({ notes: { ...b.notes, [id]: note } }));
  const toggleProvider = (p: ProviderId) => patch(p, b => ({ enabled: !b.enabled }));

  /** Guard rails run on every probe; the result is live immediately (a slow model must not wait for Save). */
  async function commitProbe(previous: ModelProbes, next: ModelProbes) {
    await saveModelProbes(next, adminEmail);
    setPrevProbes(previous);
    setProbes(next);
    const railed = applyGuardRails(config!, next);
    setConfig(railed);
    await saveAIModelsConfig(railed, adminEmail);
    setStoreConfig(railed);
    useProbesStore.getState().setProbes(next);
    const { inChain, auto } = chainCounts(railed, next);
    toast.success(`Probe complete — ${inChain} in chain, ${auto} auto-excluded (see Excluded).`);
  }

  async function probeAll() {
    const keys = { gemini: adminKey('gemini'), groq: adminKey('groq'), nvidia: adminKey('nvidia'), ollama: adminKey('ollama') };
    if (!Object.values(keys).some(Boolean)) { toast.error('Add at least one provider key in your Profile to run a probe.'); return; }
    setProbing(true);
    setProbeStatus('Starting… a full probe takes roughly 20-30 minutes. Leave this tab open.');
    try {
      const previous = probes;
      // Persisted after each provider so closing the tab part-way keeps the finished ones.
      let running: ModelProbes = { ...previous };
      const next = await runFullProbe(
        keys, previous,
        (p, done, total) => setProbeStatus(`${PROVIDER_META[p].label}: ${done} of ${total}`),
        async (p, result) => {
          running = { ...running, providers: { ...running.providers, [p]: result } };
          await saveModelProbes(running, adminEmail);
          setProbes(running);
        },
      );
      await commitProbe(previous, next);
    } catch (e: unknown) {
      toast.error(`Probe failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally { setProbing(false); setProbeStatus(''); }
  }

  async function probeOne(p: ProviderId) {
    const key = adminKey(p);
    if (!key) { toast.error(`Add a ${PROVIDER_META[p].label} key in your Profile first.`); return; }
    setProbing(true);
    setProbeStatus(`${PROVIDER_META[p].label}: starting…`);
    try {
      const previous = probes;
      const result = await runProviderProbe(p, key, previous.providers[p],
        (done, total) => setProbeStatus(`${PROVIDER_META[p].label}: ${done} of ${total}`));
      await commitProbe(previous, { ...previous, providers: { ...previous.providers, [p]: result } });
    } catch (e: unknown) {
      toast.error(`Probe failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally { setProbing(false); setProbeStatus(''); }
  }

  async function runTest(p: ProviderId, modelId: string, file: File) {
    const key = adminKey(p);
    if (!key) { toast.error(`Add a ${PROVIDER_META[p].label} key in your Profile first.`); return; }
    const tag = `${p}:${modelId}`;
    setTesting(tag);
    setTestProgress('Uploading…');
    const override: AITestOverride = { provider: p, model: modelId, key };
    const result = await runModelTest(override, 'estimate', file, setTestProgress);
    setTestResult(prev => ({ ...prev, [tag]: result }));
    setTesting(null);
    setTestProgress('');
    toast[result.ok ? 'success' : 'error'](result.ok ? `Extraction OK in ${(result.ms / 1000).toFixed(1)}s` : `Failed: ${result.error}`);
  }

  async function save() {
    setSaving(true);
    try {
      const next: AIModelsConfig = { ...config!, schema: 2 };
      await saveAIModelsConfig(next, adminEmail);
      setStoreConfig(next);
      toast.success('AI model config saved — live for all surveyors.');
    } catch (e: unknown) {
      toast.error(`Save failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally { setSaving(false); }
  }

  const diffs = Object.fromEntries(PROVIDERS.map(p => [p, diffProbes(prevProbes.providers[p], probes.providers[p])])) as Record<ProviderId, ReturnType<typeof diffProbes>>;
  const newIds = new Set(PROVIDERS.flatMap(p => diffs[p].added));

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Probed with <strong>your</strong> profile keys. Every working model is in the chain unless you exclude it.</p>
          {probes.probedAt > 0 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">Last probed {new Date(probes.probedAt).toLocaleString()} by {probes.probedBy || 'unknown'}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={probeAll} disabled={probing || saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium border border-border text-foreground disabled:opacity-50">
            {probing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh &amp; probe
          </button>
          <button onClick={save} disabled={saving || probing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-foreground text-primary disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Config
          </button>
        </div>
      </div>

      {probing && (
        <div className="px-4 py-3 rounded-xl bg-card border border-border text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 size={13} className="animate-spin" /> {probeStatus}
        </div>
      )}

      <RankedLists config={config} probes={probes.probedAt > 0 ? probes : null} newIds={newIds}
        onExclude={onExclude} onInclude={onInclude} onLimit={onLimit} />

      {PROVIDERS.map(p => (
        <ProviderCard key={p} provider={p} meta={PROVIDER_META[p]} block={config.providers[p]} probe={probes.providers[p]} diff={diffs[p]}
          hasKey={Boolean(adminKey(p))} probing={probing || saving}
          onToggleProvider={() => toggleProvider(p)} onProbe={() => probeOne(p)}
          onTest={(id, f) => runTest(p, id, f)} testing={testing} testResult={testResult} testProgress={testProgress}
          onNote={(id, note) => onNote(p, id, note)} />
      ))}
    </div>
  );
}
