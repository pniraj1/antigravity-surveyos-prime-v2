'use client';

import { useEffect, useState } from 'react';
import { Cpu, RefreshCw, Check, Star, Power, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useProfileStore } from '@/stores/profile-store';
import { useAIConfigStore } from '@/stores/ai-config-store';
import {
  AIModelsConfig, ModelEntry, ProviderId,
  loadAIModelsConfig, saveAIModelsConfig,
} from '@/lib/ai/models-config';
import { fetchGeminiModelEntries } from '@/lib/ai/service';
import { fetchNvidiaModels, fetchGroqModels } from '@/lib/ai/discovery';

const PROVIDER_META: Record<ProviderId, { label: string; color: string; keyField: 'geminiApiKeys' | 'groqApiKeys' | 'nvidiaApiKeys' }> = {
  gemini: { label: 'Google Gemini', color: '#D4AF37', keyField: 'geminiApiKeys' },
  groq:   { label: 'Groq',          color: '#F26639', keyField: 'groqApiKeys' },
  nvidia: { label: 'NVIDIA NIM',    color: '#76B900', keyField: 'nvidiaApiKeys' },
};

export function AIModelsTab({ adminEmail }: { adminEmail: string }) {
  const { profile } = useProfileStore();
  const setStoreConfig = useAIConfigStore(s => s.setConfig);
  const [config, setConfig] = useState<AIModelsConfig | null>(null);
  const [discovered, setDiscovered] = useState<Record<ProviderId, ModelEntry[]>>({ gemini: [], groq: [], nvidia: [] });
  const [busy, setBusy] = useState<ProviderId | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAIModelsConfig().then(setConfig); }, []);

  if (!config) return <div className="flex items-center gap-2 text-sm text-[#8D99AE]"><Loader2 size={14} className="animate-spin" /> Loading config…</div>;

  const adminKey = (p: ProviderId): string | undefined =>
    (profile[PROVIDER_META[p].keyField] as string[] | undefined)?.[0]?.trim();

  async function refresh(p: ProviderId) {
    const key = adminKey(p);
    if (!key) { toast.error(`Add a ${PROVIDER_META[p].label} key in your Profile to discover models.`); return; }
    setBusy(p);
    try {
      const rows = p === 'gemini' ? await fetchGeminiModelEntries(key)
        : p === 'nvidia' ? await fetchNvidiaModels(key)
        : await fetchGroqModels(key);
      if (!rows) { toast.error(`Discovery failed for ${PROVIDER_META[p].label} — check the key.`); return; }
      setDiscovered(prev => ({ ...prev, [p]: rows }));
      toast.success(`Found ${rows.length} live ${PROVIDER_META[p].label} models.`);
    } finally { setBusy(null); }
  }

  function isEnabled(p: ProviderId, id: string) { return config!.providers[p].models.some(m => m.id === id); }

  function toggleModel(p: ProviderId, row: ModelEntry) {
    setConfig(prev => {
      if (!prev) return prev;
      const block = prev.providers[p];
      const exists = block.models.some(m => m.id === row.id);
      const models = exists ? block.models.filter(m => m.id !== row.id) : [...block.models, row];
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

  const providers: ProviderId[] = ['gemini', 'groq', 'nvidia'];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#4A4E69]">Curate which models each provider exposes to surveyors. Discovery uses <strong>your</strong> profile keys.</p>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-[#0D1B2A] text-[#D4AF37] disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Config
        </button>
      </div>

      {providers.map(p => {
        const meta = PROVIDER_META[p];
        const block = config.providers[p];
        const rows = discovered[p].length > 0 ? discovered[p] : block.models;
        return (
          <div key={p} className="bg-white rounded-2xl border border-[#E2E6EA] shadow-sm overflow-hidden">
            <div className="px-6 py-4 flex items-center gap-3 border-b border-[#F0F2F5] bg-[#FAFAFA]">
              <Cpu size={16} style={{ color: meta.color }} />
              <h2 className="text-sm font-black text-[#0D1B2A]">{meta.label}</h2>
              <button onClick={() => toggleProvider(p)}
                className={`ml-2 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black ${block.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                <Power size={11} /> {block.enabled ? 'Enabled' : 'Disabled'}
              </button>
              <button onClick={() => refresh(p)} disabled={busy === p}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black border border-[#E2E6EA] text-[#0D1B2A] disabled:opacity-50">
                {busy === p ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Refresh live list
              </button>
            </div>
            <div className="divide-y divide-[#F0F2F5]">
              {rows.length === 0 && <div className="px-6 py-4 text-xs text-[#8D99AE]">No models yet — click “Refresh live list”.</div>}
              {rows.map(row => {
                const enabled = isEnabled(p, row.id);
                const isDefault = block.defaultModel === row.id;
                const note = block.models.find(m => m.id === row.id)?.note ?? row.note;
                return (
                  <div key={row.id} className="px-6 py-3 flex items-start gap-3">
                    <button onClick={() => toggleModel(p, row)}
                      className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${enabled ? 'bg-[#0D1B2A] text-white' : 'border border-[#E2E6EA]'}`}>
                      {enabled && <Check size={12} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-xs font-black text-[#0D1B2A]">{row.label}</code>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F0F2F5] text-[#4A4E69]">{row.estimateCapacity}</span>
                        {enabled && (
                          <button onClick={() => setDefault(p, row.id)}
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-1 ${isDefault ? 'bg-amber-100 text-amber-700' : 'text-[#8D99AE]'}`}>
                            <Star size={9} /> {isDefault ? 'Default' : 'Set default'}
                          </button>
                        )}
                      </div>
                      <div className="text-[10px] text-[#8D99AE] mt-0.5 font-mono">{row.id}</div>
                      {enabled && (
                        <input value={note} onChange={e => setNote(p, row.id, e.target.value)}
                          placeholder="Admin note (e.g. great on 6-page estimates)"
                          className="mt-1.5 w-full text-[11px] px-2 py-1 rounded border border-[#E2E6EA] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
