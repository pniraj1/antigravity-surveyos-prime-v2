'use client';

import { useState, useEffect } from 'react';
import { useProfileStore } from '@/stores/profile-store';
import { useUIStore } from '@/stores/ui-store';
import { CURRENT_MODELS, PROVIDER_MODELS, fetchAvailableGeminiModels } from '@/lib/ai/service';
import { Sparkles, ChevronDown, Zap, Eye, FileText, Wand2 } from 'lucide-react';

// ─── Provider Health Badge ────────────────────────────────────────────────────
export function ProviderHealthBadge() {
  const { aiProviderHealth } = useUIStore();
  const { profile } = useProfileStore();
  const provider = profile.aiProvider ?? 'gemini';
  const healthKey = provider === 'groq' ? 'groq' : 'gemini';
  const health = aiProviderHealth[healthKey];
  const model = provider === 'gemini'
    ? (profile.geminiModel?.trim() || CURRENT_MODELS.gemini)
    : provider === 'nvidia'
    ? (profile.nvidiaModel?.trim() || CURRENT_MODELS.nvidia)
    : (profile.groqModel?.trim() || CURRENT_MODELS.groq);
  const shortModel = model.split('/').pop()?.replace('gemini-', 'Gemini ').replace('-instruct', '') ?? model;

  const dot = health === 'ok'           ? '#22c55e'
            : health === 'rate-limited' ? '#f59e0b'
            : health === 'error'        ? '#ef4444'
            :                            '#8D99AE';
  const label = health === 'ok'           ? 'Ready'
              : health === 'rate-limited' ? 'Rate Limited'
              : health === 'error'        ? 'Key Error — check Profile'
              :                            'Not tested yet';

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold"
      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
      title={`${provider === 'gemini' ? 'Google Gemini' : 'Groq'} · ${model} · ${label}`}
    >
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dot }} />
      <span style={{ color: '#F8F9FA' }}>{shortModel}</span>
      <span style={{ color: 'rgba(232,236,240,0.5)' }}>·</span>
      <span style={{ color: dot }}>{label}</span>
    </div>
  );
}

// ─── Model Selector ───────────────────────────────────────────────────────────
export function ModelSelector() {
  const { profile, updateProfile } = useProfileStore();
  const { availableGeminiModels, setAvailableGeminiModels } = useUIStore();
  const [open, setOpen] = useState(false);

  const provider = (profile.aiProvider ?? 'gemini') as 'gemini' | 'groq' | 'nvidia';

  const models = provider === 'gemini'
    ? (availableGeminiModels ?? PROVIDER_MODELS.gemini)
    : PROVIDER_MODELS[provider] ?? [];

  const activeId = provider === 'gemini'
    ? (profile.geminiModel?.trim() || CURRENT_MODELS.gemini)
    : provider === 'nvidia'
    ? (profile.nvidiaModel?.trim() || CURRENT_MODELS.nvidia)
    : (profile.groqModel?.trim() || CURRENT_MODELS.groq);

  useEffect(() => {
    if (provider !== 'gemini' || availableGeminiModels !== null) return;
    const key = profile.geminiApiKeys?.[0]?.trim() || profile.geminiApiKey?.trim();
    if (!key) return;
    fetchAvailableGeminiModels(key).then(list => {
      if (list && list.length > 0) setAvailableGeminiModels(list);
    });
  }, [provider, availableGeminiModels, profile.geminiApiKeys, profile.geminiApiKey, setAvailableGeminiModels]);

  const active = models.find(m => m.id === activeId) ?? models[0];

  function select(id: string) {
    if (provider === 'gemini') updateProfile({ geminiModel: id });
    else if (provider === 'nvidia') updateProfile({ nvidiaModel: id });
    else updateProfile({ groqModel: id });
    setOpen(false);
  }

  const accentColor = provider === 'groq' ? '#F26639' : provider === 'nvidia' ? '#76B900' : '#D4AF37';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(232,236,240,0.85)',
        }}
      >
        <span style={{ color: accentColor }}>{active?.label ?? activeId.split('/').pop()}</span>
        <ChevronDown size={10} style={{ opacity: 0.6, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1.5 z-20 rounded-xl overflow-hidden py-1"
            style={{
              background: '#1a2d45',
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
                      <span className="text-[11px] font-black" style={{ color: isActive ? accentColor : '#F8F9FA' }}>
                        {m.label}
                      </span>
                      {isActive && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${accentColor}25`, color: accentColor }}>
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
      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
      title="PDF extraction mode"
    >
      {options.map(opt => {
        const isActive = mode === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => updateProfile({ aiDocMode: opt.id })}
            title={opt.tip}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black transition-all"
            style={{
              background: isActive ? 'rgba(212,175,55,0.85)' : 'transparent',
              color: isActive ? '#0D1B2A' : 'rgba(232,236,240,0.55)',
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
export function ProviderToggle() {
  const { profile, updateProfile } = useProfileStore();
  const aiProvider = profile.aiProvider ?? 'gemini';

  return (
    <div className="flex items-center p-1 rounded-xl gap-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
      <button
        onClick={() => updateProfile({ aiProvider: 'gemini' })}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black transition-all"
        style={{
          background: aiProvider === 'gemini' ? 'rgba(212,175,55,0.9)' : 'transparent',
          color: aiProvider === 'gemini' ? '#0D1B2A' : 'rgba(232,236,240,0.6)',
        }}
      >
        <Sparkles size={11} />
        Gemini
      </button>
      <button
        onClick={() => updateProfile({ aiProvider: 'groq' })}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black transition-all"
        style={{
          background: aiProvider === 'groq' ? 'rgba(242,102,57,0.9)' : 'transparent',
          color: aiProvider === 'groq' ? '#FFFFFF' : 'rgba(232,236,240,0.6)',
        }}
      >
        <Zap size={11} />
        Groq
      </button>
    </div>
  );
}
