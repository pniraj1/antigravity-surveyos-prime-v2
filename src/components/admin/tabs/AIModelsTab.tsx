'use client';

import { useEffect, useState } from 'react';
import { Cpu, RefreshCw, Check, Star, Power, Save, Loader2, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import { useProfileStore } from '@/stores/profile-store';
import { useAIConfigStore } from '@/stores/ai-config-store';
import {
  AIModelsConfig, ProviderId, formatCtx,
  loadAIModelsConfig, saveAIModelsConfig,
} from '@/lib/ai/models-config';
import { runModelTest, type ModelTestResult, type AITestOverride } from '@/lib/ai/service';
import { runFullProbe } from '@/lib/ai/probe-runner';
import {
  loadModelProbes, saveModelProbes, EMPTY_PROBES,
  type ModelProbes, type ProbeResult,
} from '@/lib/ai/probe-types';
import { diffProbes } from '@/lib/ai/probe-diff';
import { reconcileEnabledModels } from '@/lib/ai/probe-reconcile';

const PROVIDER_META: Record<ProviderId, { label: string; color: string; keyField: 'geminiApiKeys' | 'groqApiKeys' | 'nvidiaApiKeys' }> = {
  gemini: { label: 'Google Gemini', color: '#D4AF37', keyField: 'geminiApiKeys' },
  groq:   { label: 'Groq',          color: '#F26639', keyField: 'groqApiKeys' },
  nvidia: { label: 'NVIDIA NIM',    color: '#76B900', keyField: 'nvidiaApiKeys' },
};

const PROVIDERS: ProviderId[] = ['gemini', 'groq', 'nvidia'];

/** Only measured facts — nothing inferred from the model name. */
function badge(r: ProbeResult): string {
  const parts = [r.vision ? 'vision' : 'text only'];
  if (r.vision && r.imageCap !== null) parts.push(`${r.imageCap} img/call`);
  if (r.ctxWindow !== null) parts.push(`${formatCtx(r.ctxWindow)} ctx`);
  parts.push(r.slow || r.msPerPage === null ? '>90s/page' : `${Math.round(r.msPerPage / 1000)}s/page`);
  return parts.join(' · ');
}

export function AIModelsTab({ adminEmail }: { adminEmail: string }) {
  const { profile } = useProfileStore();
  const setStoreConfig = useAIConfigStore(s => s.setConfig);
  const [config, setConfig] = useState<AIModelsConfig | null>(null);
  const [probes, setProbes] = useState<ModelProbes>(EMPTY_PROBES);
  // The probe this one replaced. Kept so the NEW badge can be computed from the
  // diff — once `probes` is overwritten the comparison is no longer available.
  const [prevProbes, setPrevProbes] = useState<ModelProbes>(EMPTY_PROBES);
  const [probing, setProbing] = useState(false);
  const [probeStatus, setProbeStatus] = useState('');
  const [showUnusable, setShowUnusable] = useState<Record<ProviderId, boolean>>({ gemini: false, groq: false, nvidia: false });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null); // `${provider}:${modelId}`
  const [testResult, setTestResult] = useState<Record<string, ModelTestResult>>({});
  const [testProgress, setTestProgress] = useState('');

  useEffect(() => {
    loadAIModelsConfig().then(setConfig);
    loadModelProbes().then(setProbes);
  }, []);

  if (!config) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading config…</div>;

  const adminKey = (p: ProviderId): string | undefined =>
    (profile[PROVIDER_META[p].keyField] as string[] | undefined)?.[0]?.trim();

  async function probeAll() {
    const keys = {
      gemini: adminKey('gemini'),
      groq: adminKey('groq'),
      nvidia: adminKey('nvidia'),
    };
    if (!keys.gemini && !keys.groq && !keys.nvidia) {
      toast.error('Add at least one provider key in your Profile to run a probe.');
      return;
    }

    setProbing(true);
    setProbeStatus('Starting… a full probe takes roughly 20-30 minutes. Leave this tab open.');
    try {
      const previous = probes;
      // Persisted after each provider so closing the tab part-way through
      // keeps the providers that already finished.
      let running: ModelProbes = { ...previous };
      const next = await runFullProbe(
        keys,
        previous,
        (p, done, total) => setProbeStatus(`${PROVIDER_META[p].label}: ${done} of ${total}`),
        async (p, result) => {
          running = { ...running, providers: { ...running.providers, [p]: result } };
          await saveModelProbes(running, adminEmail);
          setProbes(running);
        },
      );

      await saveModelProbes(next, adminEmail);
      setPrevProbes(previous);
      setProbes(next);

      // Dead models leave the surveyor-facing config immediately — waiting for
      // a Save click would leave surveyors extracting against a model that
      // cannot answer. Enabling still requires an explicit Save.
      const { config: reconciled, removed } = reconcileEnabledModels(config!, next);
      if (removed.length > 0) {
        setConfig(reconciled);
        await saveAIModelsConfig(reconciled, adminEmail);
        setStoreConfig(reconciled);
        toast.warning(
          `Removed ${removed.length} model${removed.length === 1 ? '' : 's'} that stopped working: ` +
          removed.map(r => r.id).join(', '),
          { duration: 10000 },
        );
      }

      const totalWorking = PROVIDERS.reduce(
        (n, pid) => n + diffProbes(previous.providers[pid], next.providers[pid]).working.length, 0);
      toast.success(`Probe complete — ${totalWorking} usable models.`);
    } catch (e: unknown) {
      toast.error(`Probe failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setProbing(false);
      setProbeStatus('');
    }
  }

  function isEnabled(p: ProviderId, id: string) { return config!.providers[p].models.some(m => m.id === id); }

  function toggleModel(p: ProviderId, row: ProbeResult) {
    setConfig(prev => {
      if (!prev) return prev;
      const block = prev.providers[p];
      const exists = block.models.some(m => m.id === row.id);
      const models = exists
        ? block.models.filter(m => m.id !== row.id)
        : [...block.models, {
            id: row.id,
            label: row.id.split('/').pop() ?? row.id,
            note: '',
            ctxWindow: row.ctxWindow,
            vision: row.vision,
            imageCap: row.imageCap,
          }];
      const defaultModel = exists && block.defaultModel === row.id ? (models[0]?.id ?? '') : block.defaultModel;
      return { ...prev, providers: { ...prev.providers, [p]: { ...block, models, defaultModel } } };
    });
  }

  function setDefault(p: ProviderId, id: string) {
    setConfig(prev => prev ? { ...prev, providers: { ...prev.providers, [p]: { ...prev.providers[p], defaultModel: id } } } : prev);
  }

  function setNote(p: ProviderId, id: string, note: string) {
    setConfig(prev => prev ? { ...prev, providers: { ...prev.providers, [p]: {
      ...prev.providers[p], models: prev.providers[p].models.map(m => m.id === id ? { ...m, note } : m),
    } } } : prev);
  }

  function toggleProvider(p: ProviderId) {
    setConfig(prev => prev ? { ...prev, providers: { ...prev.providers, [p]: { ...prev.providers[p], enabled: !prev.providers[p].enabled } } } : prev);
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
      await saveAIModelsConfig(config!, adminEmail);
      setStoreConfig(config!);
      toast.success('AI model config saved — live for all surveyors.');
    } catch (e: unknown) {
      toast.error(`Save failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Probed with <strong>your</strong> profile keys. Only models verified to work are shown.</p>
          {probes.probedAt > 0 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Last probed {new Date(probes.probedAt).toLocaleString()} by {probes.probedBy || 'unknown'}
            </p>
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

      {PROVIDERS.map(p => {
        const meta = PROVIDER_META[p];
        const block = config.providers[p];
        const providerProbe = probes.providers[p];
        const d = diffProbes(prevProbes.providers[p], providerProbe);
        const addedSet = new Set(d.added);
        const unusable = Object.values(providerProbe.models).filter(m => m.status !== 'ok');

        return (
          <div key={p} className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 flex items-center gap-3 border-b border-border bg-card">
              <Cpu size={16} style={{ color: meta.color }} />
              <h2 className="text-sm font-medium text-foreground">{meta.label}</h2>
              <button onClick={() => toggleProvider(p)}
                className={`ml-2 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium ${block.enabled ? 'bg-status-success-tint text-status-success' : 'bg-neutral-100 text-neutral-600'}`}>
                <Power size={11} /> {block.enabled ? 'Enabled' : 'Disabled'}
              </button>
              {d.working.length > 0 && (
                <span className="ml-auto text-[10px] text-muted-foreground">{d.working.length} usable</span>
              )}
            </div>

            {providerProbe.error ? (
              <div className="px-6 py-4 text-xs text-status-danger">
                Probe did not run: {providerProbe.error} — previous results kept.
              </div>
            ) : d.working.length === 0 ? (
              <div className="px-6 py-4 text-xs text-muted-foreground">
                No probe results yet — click &quot;Refresh &amp; probe&quot;.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {d.working.map(row => {
                  const enabled = isEnabled(p, row.id);
                  const isDefault = block.defaultModel === row.id;
                  const note = block.models.find(m => m.id === row.id)?.note ?? '';
                  const tag = `${p}:${row.id}`;
                  return (
                    <div key={row.id} className="px-6 py-3 flex items-start gap-3">
                      <button onClick={() => toggleModel(p, row)}
                        className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${enabled ? 'bg-foreground text-white' : 'border border-border'}`}>
                        {enabled && <Check size={12} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="text-xs font-medium text-foreground">{row.id.split('/').pop()}</code>
                          {addedSet.has(row.id) && (
                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-status-success-tint text-status-success">NEW</span>
                          )}
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-card text-muted-foreground">{badge(row)}</span>
                          {row.slow && (
                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-status-warning-tint text-status-warning">SLOW</span>
                          )}
                          {enabled && (
                            <button onClick={() => setDefault(p, row.id)}
                              className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-1 ${isDefault ? 'bg-status-warning-tint text-status-warning' : 'text-muted-foreground'}`}>
                              <Star size={9} /> {isDefault ? 'Default' : 'Set default'}
                            </button>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">{row.id}</div>
                        {enabled && (
                          <input value={note} onChange={e => setNote(p, row.id, e.target.value)}
                            placeholder="Admin note"
                            className="mt-1.5 w-full text-[11px] px-2 py-1 rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary" />
                        )}
                        {enabled && (
                          <div className="mt-2">
                            <label className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-lg border border-border cursor-pointer hover:bg-card">
                              {testing === tag ? <Loader2 size={11} className="animate-spin" /> : <FlaskConical size={11} />}
                              Test with estimate PDF
                              <input type="file" accept="application/pdf,image/*" className="hidden"
                                disabled={testing !== null || probing}
                                onChange={e => { const f = e.target.files?.[0]; if (f) runTest(p, row.id, f); e.currentTarget.value = ''; }} />
                            </label>
                            {testing === tag && <span className="ml-2 text-[10px] text-muted-foreground">{testProgress}</span>}
                            {testResult[tag] && (
                              <pre className={`mt-1.5 max-h-48 overflow-auto text-[10px] p-2 rounded-lg border ${testResult[tag].ok ? 'border-status-success-tint bg-status-success-tint' : 'border-status-danger-tint bg-status-danger-tint'}`}>
                                {testResult[tag].ok
                                  ? `✅ ${(testResult[tag].ms / 1000).toFixed(1)}s\n` + JSON.stringify(testResult[tag].data, null, 2)
                                  : `❌ ${testResult[tag].error}`}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {unusable.length > 0 && (
                  <div className="px-6 py-3">
                    <button onClick={() => setShowUnusable(s => ({ ...s, [p]: !s[p] }))}
                      className="text-[10px] font-medium text-muted-foreground hover:text-foreground">
                      {showUnusable[p] ? 'Hide' : 'Show'} {unusable.length} unusable
                    </button>
                    {showUnusable[p] && (
                      <div className="mt-2 space-y-1">
                        {unusable.map(m => (
                          <div key={m.id} className="text-[10px] text-muted-foreground">
                            <span className="font-mono">{m.id}</span>
                            {' — '}
                            <span className="font-medium">{m.status}</span>
                            {m.reason ? `: ${m.reason}` : ''}
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
      })}
    </div>
  );
}
