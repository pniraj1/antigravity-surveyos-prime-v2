'use client';

import React from 'react';
import { AlertTriangle, Cpu, RefreshCcw, BookOpen } from 'lucide-react';

export function DevNotesTab() {
  return (
    <div className="space-y-6 max-w-3xl">

      {/* AI Model Management */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 flex items-center gap-3 border-b border-border" style={{ background: 'var(--color-neutral-50)' }}>
          <Cpu size={16} className="text-primary" />
          <h2 className="text-sm font-medium text-foreground">AI Model Management</h2>
          <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full border" style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-600)', borderColor: 'var(--color-neutral-200)' }}>src/lib/ai/service.ts</span>
        </div>
        <div className="p-6 space-y-5 text-sm text-muted-foreground leading-relaxed">

          <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-status-warning)', background: 'var(--color-status-warning-tint)' }}>
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--color-status-warning)' }} />
              <p className="text-xs font-medium" style={{ color: 'var(--color-status-warning)' }}>
                The model dropdown in the Documents tab auto-fetches live models from the Gemini API using the surveyor&apos;s key. The developer only needs to act when a model is <em>retired</em> — not when new ones are added.
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-medium uppercase tracking-wider text-foreground mb-3">How the model system works</h3>
            <ol className="space-y-2 text-xs font-medium list-none">
              {[
                'When a surveyor opens the Documents tab, the app calls GET /v1beta/models using their first Gemini API key.',
                'The API returns all models currently active on their account — new models appear automatically, retired ones disappear.',
                'The dropdown shows this live list. If the fetch fails (offline / bad key), it falls back to the static PROVIDER_MODELS list in service.ts.',
                'On extraction, the chosen model is sent to the Gemini API. If it returns 404 (retired), GEMINI_FALLBACK_CHAIN steps through alternatives automatically.',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-medium flex items-center justify-center mt-0.5" style={{ background: 'var(--color-neutral-900)', color: 'var(--color-neutral-50)' }}>{i + 1}</span>
                  <span className="text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-status-success)', background: 'var(--color-status-success-tint)' }}>
            <p className="text-xs font-medium" style={{ color: 'var(--color-status-success)' }}>
              Model lists are now managed in the <strong>AI Models</strong> tab — no code edit needed.
              Discovery pulls live models from each provider using your profile keys; check/uncheck to
              expose them to surveyors, set a default, and use "Test with estimate PDF" to verify
              multi-page extraction before enabling. The static lists in <code>service.ts</code> remain
              only as an offline fallback.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-medium uppercase tracking-wider text-foreground mb-3">Currently active Gemini free-tier models (April 2026)</h3>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border" style={{ background: 'var(--color-neutral-50)' }}>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Model ID</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground uppercase tracking-wider text-[10px]">RPM</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground uppercase tracking-wider text-[10px]">RPD</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground uppercase tracking-wider text-[10px]">TPM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { id: 'gemini-2.5-flash-lite', rpm: '15', rpd: '1,000', tpm: '250,000' },
                    { id: 'gemini-2.5-flash', rpm: '10', rpd: '500', tpm: '250,000' },
                    { id: 'gemini-3-flash-preview', rpm: 'Shared', rpd: '~160', tpm: '250,000' },
                  ].map(m => (
                    <tr key={m.id} className="hover:bg-card">
                      <td className="px-4 py-2.5 font-mono font-medium text-foreground">{m.id}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{m.rpm}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{m.rpd}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{m.tpm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Fallback Chain */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 flex items-center gap-3 border-b border-border" style={{ background: 'var(--color-neutral-50)' }}>
          <RefreshCcw size={16} className="text-primary" />
          <h2 className="text-sm font-medium text-foreground">Provider Fallback Chain</h2>
        </div>
        <div className="p-6 space-y-4 text-xs text-muted-foreground">
          <p>Every extraction attempt walks this chain automatically — the surveyor never sees provider switching unless all fail:</p>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: 'Gemini', sub: '503 → retry 2× (1.5s)', color: '#4285F4' },
              { label: '→ Groq', sub: 'if all Gemini keys fail', color: '#F26639' },
              { label: '→ NVIDIA NIM', sub: 'last resort (free, 40 RPM)', color: '#76B900' },
              { label: '→ Firestore master key', sub: 'admin-configured fallback', color: '#D4AF37' },
            ].map(p => (
              <div key={p.label} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border" style={{ background: 'var(--color-neutral-50)' }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                <div>
                  <div className="font-medium text-foreground text-[11px]">{p.label}</div>
                  <div className="text-[10px] text-muted-foreground">{p.sub}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] font-medium text-muted-foreground mt-2">
            Groq default model: <code className="px-1.5 py-0.5 rounded font-mono text-foreground" style={{ background: 'var(--color-neutral-100)' }}>llama-4-maverick-17b-128e-instruct</code> (upgraded from Scout — better structured extraction for Indian estimates).
          </p>
        </div>
      </div>

      {/* Quick reference */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 flex items-center gap-3 border-b border-border" style={{ background: 'var(--color-neutral-50)' }}>
          <BookOpen size={16} className="text-primary" />
          <h2 className="text-sm font-medium text-foreground">Key Files Quick Reference</h2>
        </div>
        <div className="p-6">
          <div className="space-y-2">
            {[
              { file: 'src/lib/ai/service.ts', desc: 'All AI provider logic — models, keys, retry, fallback chain, live fetch' },
              { file: 'src/lib/ai/processor.ts', desc: 'PDF → images conversion, chunking for multi-page estimates' },
              { file: 'src/lib/ai/prompts.ts', desc: 'Extraction prompts for each document type (RC, DL, estimate, etc.)' },
              { file: 'src/stores/profile-store.ts', desc: 'Surveyor profile + API keys storage (gemini/groq/nvidia key arrays)' },
              { file: 'src/stores/ui-store.ts', desc: 'Live Gemini model list cache (availableGeminiModels)' },
              { file: 'src/components/tabs/DocumentsTab.tsx', desc: 'ModelSelector component — provider toggle + live model dropdown' },
              { file: 'src/components/admin/AdminDashboard.tsx', desc: 'This file — surveyor management + these dev notes' },
            ].map(item => (
              <div key={item.file} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                <code className="text-[10px] font-mono font-medium text-foreground px-2 py-1 rounded flex-shrink-0 mt-0.5" style={{ background: 'var(--color-neutral-100)' }}>{item.file}</code>
                <span className="text-xs text-muted-foreground">{item.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
