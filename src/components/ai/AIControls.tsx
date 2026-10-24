'use client';

import { useState } from 'react';
import { useProfileStore } from '@/stores/profile-store';
import { useUIStore } from '@/stores/ui-store';
import { useAIConfigStore } from '@/stores/ai-config-store';
import { useProbesStore } from '@/stores/probes-store';
import { buildPool } from '@/lib/ai/service';
import { Sparkles, ChevronDown, Zap, Eye, FileText, Wand2, Cpu } from 'lucide-react';

// ─── Provider Health Badge ────────────────────────────────────────────────────
export function ProviderHealthBadge() {
  const { aiProviderHealth } = useUIStore();
  const { profile } = useProfileStore();
  const provider = profile.aiProvider ?? 'gemini';
  const healthKey = provider === 'groq' ? 'groq' : 'gemini';
  const health = aiProviderHealth[healthKey];
  // The ranker — not the surveyor's saved model — decides which model actually
  // runs each call, so the badge names the provider, not a specific model.
  const providerLabel = provider === 'gemini' ? 'Gemini' : provider === 'nvidia' ? 'NVIDIA' : provider === 'groq' ? 'Groq' : provider;
  const pick = profile.preferredAI;
  const PICK_LABELS = { gemini: 'Gemini', groq: 'Groq', nvidia: 'NVIDIA', ollama: 'Ollama' } as const;
  const shortModel = pick && pick !== 'auto'
    ? `${profile.preferredModel ? profile.preferredModel.split('/').pop() : PICK_LABELS[pick]} first`
    : `${providerLabel} · auto`;

  const dot = health === 'ok'           ? 'var(--color-status-success)'
            : health === 'rate-limited' ? 'var(--color-status-warning)'
            : health === 'error'        ? 'var(--color-status-danger)'
            :                            'var(--color-neutral-400)';
  const label = health === 'ok'           ? 'Ready'
              : health === 'rate-limited' ? 'Rate Limited'
              : health === 'error'        ? 'Key Error — check Profile'
              :                            'Not tested yet';

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-medium"
      style={{ background: 'var(--color-neutral-100)', border: '1px solid var(--color-neutral-200)' }}
      title={`${shortModel} · ${label}`}
    >
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dot }} />
      <span style={{ color: 'var(--color-neutral-700)' }}>{shortModel}</span>
      <span style={{ color: 'var(--color-neutral-400)' }}>·</span>
      <span style={{ color: dot }}>{label}</span>
    </div>
  );
}

// ─── Model Selector ───────────────────────────────────────────────────────────
// Lists exactly what the gateway can use for the AI picked in ProviderToggle
// (admin-enabled, not vetoed, surveyor has a key). The pick is tried first —
// see GatewaySession.preferModel. Hidden on Auto.
export function ModelSelector() {
  const { profile, updateProfile } = useProfileStore();
  const [open, setOpen] = useState(false);
  useAIConfigStore(s => s.config);   // re-render when admin config or probes change —
  useProbesStore(s => s.probes);     // buildPool reads both stores directly

  const provider = profile.preferredAI;
  if (!provider || provider === 'auto') return null;
  const ANY = { id: '', label: 'Any model', note: 'Normal order within this AI' };
  const models = [ANY, ...buildPool(profile).filter(e => e.provider === provider).map(e => e.model)];
  const activeId = profile.preferredModel ?? '';
  const active = models.find(m => m.id === activeId) ?? ANY;

  function select(id: string) {
    updateProfile({ preferredModel: id });
    setOpen(false);
  }

  const accentColor = provider === 'groq' ? 'var(--color-status-warning)' : provider === 'nvidia' ? 'var(--color-status-success)' : 'var(--color-primary)';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all"
        style={{
          background: 'var(--color-neutral-100)',
          border: '1px solid var(--color-neutral-200)',
          color: 'var(--color-neutral-600)',
        }}
      >
        <span style={{ color: accentColor }}>{active.label}</span>
        <ChevronDown size={10} style={{ opacity: 0.6, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1.5 z-20 rounded-xl overflow-hidden py-1"
            style={{
              background: 'var(--color-neutral-900)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              minWidth: 220,
            }}
          >
            {models.map(m => {
              const isActive = m.id === activeId;
              return (
                <button
                  key={m.id}
                  onClick={() => select(m.id)}
                  className="w-full flex items-start gap-2 px-4 py-2.5 text-left transition-colors"
                  style={{ background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isActive ? 'rgba(255,255,255,0.06)' : 'transparent'; }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium" style={{ color: isActive ? accentColor : 'var(--color-neutral-50)' }}>
                        {m.label}
                      </span>
                      {isActive && (
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10" style={{ color: accentColor }}>
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'rgba(232,236,240,0.45)' }}>{m.note}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Doc Mode Toggle ──────────────────────────────────────────────────────────
// Lets the user force text-layer or vision mode instead of auto-detection.
export function DocModeToggle() {
  const { profile, updateProfile } = useProfileStore();
  const mode = profile.aiDocMode ?? 'auto';

  const options: { id: 'auto' | 'text' | 'vision'; label: string; icon: React.ReactNode; tip: string }[] = [
    { id: 'auto',   label: 'Auto',   icon: <Wand2 size={10} />,    tip: 'Smart detect: uses text layer when available, vision otherwise' },
    { id: 'text',   label: 'Text',   icon: <FileText size={10} />, tip: 'Force text layer — faster, cheaper, best for digital PDFs' },
    { id: 'vision', label: 'Vision', icon: <Eye size={10} />,      tip: 'Force vision/image mode — best for scanned or handwritten docs' },
  ];

  return (
    <div
      className="flex items-center gap-1 p-0.5 rounded-lg"
      style={{ background: 'var(--color-neutral-100)', border: '1px solid var(--color-neutral-200)' }}
      title="PDF extraction mode"
    >
      {options.map(opt => {
        const isActive = mode === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => updateProfile({ aiDocMode: opt.id })}
            title={opt.tip}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all"
            style={{
              background: isActive ? 'var(--color-primary)' : 'transparent',
              color: isActive ? 'var(--color-neutral-900)' : 'var(--color-neutral-600)',
            }}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Provider Toggle ──────────────────────────────────────────────────────────
// Auto = admin-ranked order. A provider = tried first for every scan, normal order
// after it (see GatewaySession.prefer). Only providers the surveyor has a key for.
export function ProviderToggle() {
  const { profile, updateProfile } = useProfileStore();
  const config = useAIConfigStore(s => s.config);

  type Pick = NonNullable<typeof profile.preferredAI>;
  const PROVIDERS: { id: Pick; label: string; icon: React.ReactNode; activeBg: string; activeColor: string }[] = [
    { id: 'auto',   label: 'Auto',   icon: <Wand2 size={11} />,    activeBg: 'var(--color-neutral-900)',      activeColor: 'var(--color-neutral-50)' },
    { id: 'gemini', label: 'Gemini', icon: <Sparkles size={11} />, activeBg: 'var(--color-primary)',          activeColor: 'var(--color-neutral-900)' },
    { id: 'groq',   label: 'Groq',   icon: <Zap size={11} />,      activeBg: 'var(--color-status-warning)',   activeColor: 'var(--color-neutral-50)' },
    { id: 'nvidia', label: 'NVIDIA', icon: <Cpu size={11} />,      activeBg: 'var(--color-status-success)',   activeColor: 'var(--color-neutral-900)' },
    { id: 'ollama', label: 'Ollama', icon: <Zap size={11} />,      activeBg: 'var(--color-neutral-900)',      activeColor: 'var(--color-neutral-50)' },
  ];
  const hasKey = (id: Pick) => id === 'auto'
    || ((profile[`${id}ApiKeys` as const] ?? []).some(k => k?.trim()))
    || (id === 'gemini' && !!profile.geminiApiKey?.trim());
  const enabled = PROVIDERS.filter(p => p.id === 'auto' || (config.providers[p.id]?.enabled && hasKey(p.id)));
  if (enabled.length <= 2) return null;   // one provider: Auto already is that provider
  const current = enabled.some(p => p.id === profile.preferredAI) ? profile.preferredAI : 'auto';

  return (
    <div
      className="flex items-center p-1 rounded-xl gap-1"
      style={{ background: 'var(--color-neutral-100)', border: '1px solid var(--color-neutral-200)' }}
      title="Auto uses the normal order. Pick an AI to try it first — if it fails, the normal order takes over."
    >
      {enabled.map(p => {
        const active = current === p.id;
        return (
          <button
            key={p.id}
            onClick={() => updateProfile({ preferredAI: p.id, preferredModel: '' })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
            style={{ background: active ? p.activeBg : 'transparent', color: active ? p.activeColor : 'var(--color-neutral-600)' }}
          >
            {p.icon}{p.label}
          </button>
        );
      })}
    </div>
  );
}
