'use client';

import React from 'react';
import { AlertTriangle, Cpu, RefreshCcw, BookOpen } from 'lucide-react';

export function DevNotesTab() {
  return (
    <div className="space-y-6 max-w-3xl">

      {/* AI Model Management */}
      <div className="bg-white rounded-2xl border border-[#E2E6EA] shadow-sm overflow-hidden">
        <div className="px-6 py-4 flex items-center gap-3 border-b border-[#F0F2F5] bg-[#FAFAFA]">
          <Cpu size={16} className="text-[#D4AF37]" />
          <h2 className="text-sm font-black text-[#0D1B2A]">AI Model Management</h2>
          <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">src/lib/ai/service.ts</span>
        </div>
        <div className="p-6 space-y-5 text-sm text-[#4A4E69] leading-relaxed">

          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs font-bold text-amber-800">
                The model dropdown in the Documents tab auto-fetches live models from the Gemini API using the surveyor&apos;s key. The developer only needs to act when a model is <em>retired</em> — not when new ones are added.
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-[#0D1B2A] mb-3">How the model system works</h3>
            <ol className="space-y-2 text-xs font-medium list-none">
              {[
                'When a surveyor opens the Documents tab, the app calls GET /v1beta/models using their first Gemini API key.',
                'The API returns all models currently active on their account — new models appear automatically, retired ones disappear.',
                'The dropdown shows this live list. If the fetch fails (offline / bad key), it falls back to the static PROVIDER_MODELS list in service.ts.',
                'On extraction, the chosen model is sent to the Gemini API. If it returns 404 (retired), GEMINI_FALLBACK_CHAIN steps through alternatives automatically.',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#D4AF37] text-[#0D1B2A] text-[10px] font-black flex items-center justify-center mt-0.5">{i + 1}</span>
                  <span className="text-[#4A4E69]">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-[#0D1B2A] mb-3">When a Gemini model is retired — update these 4 things</h3>
            <div className="space-y-3">
              {[
                {
                  label: 'CURRENT_MODELS.gemini',
                  line: '~line 22',
                  action: 'Change the default model ID to the new best free-tier model.',
                  example: "gemini: 'gemini-2.5-flash'  →  'gemini-3-flash'",
                },
                {
                  label: 'DEPRECATED_GEMINI_MODELS',
                  line: '~line 50',
                  action: 'Add the retired model ID → new model ID mapping so any surveyor who has the old model saved in their profile gets auto-migrated on next load.',
                  example: "'gemini-2.5-flash': 'gemini-3-flash'",
                },
                {
                  label: 'GEMINI_FALLBACK_CHAIN',
                  line: '~line 37',
                  action: 'Replace the retired model with the new one in the fallback array. Order: best → lighter → preview.',
                  example: "['gemini-3-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']",
                },
                {
                  label: 'PROVIDER_MODELS.gemini',
                  line: '~line 75',
                  action: 'Update the static fallback list (used when live fetch fails). Remove retired model, add new one with correct RPM/RPD note.',
                  example: "{ id: 'gemini-3-flash', label: '3 Flash', note: '15 RPM · 1000/day' }",
                },
              ].map(item => (
                <div key={item.label} className="rounded-xl border border-[#E2E6EA] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-[#F8F9FA] border-b border-[#E2E6EA]">
                    <code className="text-xs font-black text-[#0D1B2A]">{item.label}</code>
                    <span className="text-[10px] font-bold text-[#8D99AE]">{item.line}</span>
                  </div>
                  <div className="px-4 py-3 space-y-1.5">
                    <p className="text-xs text-[#4A4E69]">{item.action}</p>
                    <code className="block text-[11px] bg-[#F0F2F5] rounded-lg px-3 py-2 text-[#0D1B2A] font-mono">{item.example}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-[#0D1B2A] mb-3">Currently active Gemini free-tier models (April 2026)</h3>
            <div className="rounded-xl border border-[#E2E6EA] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#FAFAFA] border-b border-[#E2E6EA]">
                    <th className="px-4 py-2.5 text-left font-black text-[#8D99AE] uppercase tracking-wider text-[10px]">Model ID</th>
                    <th className="px-4 py-2.5 text-left font-black text-[#8D99AE] uppercase tracking-wider text-[10px]">RPM</th>
                    <th className="px-4 py-2.5 text-left font-black text-[#8D99AE] uppercase tracking-wider text-[10px]">RPD</th>
                    <th className="px-4 py-2.5 text-left font-black text-[#8D99AE] uppercase tracking-wider text-[10px]">TPM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F2F5]">
                  {[
                    { id: 'gemini-2.5-flash-lite', rpm: '15', rpd: '1,000', tpm: '250,000' },
                    { id: 'gemini-2.5-flash', rpm: '10', rpd: '500', tpm: '250,000' },
                    { id: 'gemini-3-flash-preview', rpm: 'Shared', rpd: '~160', tpm: '250,000' },
                  ].map(m => (
                    <tr key={m.id} className="hover:bg-[#FAFAFA]">
                      <td className="px-4 py-2.5 font-mono font-bold text-[#0D1B2A]">{m.id}</td>
                      <td className="px-4 py-2.5 text-[#4A4E69]">{m.rpm}</td>
                      <td className="px-4 py-2.5 text-[#4A4E69]">{m.rpd}</td>
                      <td className="px-4 py-2.5 text-[#4A4E69]">{m.tpm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Fallback Chain */}
      <div className="bg-white rounded-2xl border border-[#E2E6EA] shadow-sm overflow-hidden">
        <div className="px-6 py-4 flex items-center gap-3 border-b border-[#F0F2F5] bg-[#FAFAFA]">
          <RefreshCcw size={16} className="text-[#D4AF37]" />
          <h2 className="text-sm font-black text-[#0D1B2A]">Provider Fallback Chain</h2>
        </div>
        <div className="p-6 space-y-4 text-xs text-[#4A4E69]">
          <p>Every extraction attempt walks this chain automatically — the surveyor never sees provider switching unless all fail:</p>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: 'Gemini', sub: '503 → retry 2× (1.5s)', color: '#4285F4' },
              { label: '→ Groq', sub: 'if all Gemini keys fail', color: '#F26639' },
              { label: '→ NVIDIA NIM', sub: 'last resort (free, 40 RPM)', color: '#76B900' },
              { label: '→ Firestore master key', sub: 'admin-configured fallback', color: '#D4AF37' },
            ].map(p => (
              <div key={p.label} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E2E6EA] bg-[#F8F9FA]">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                <div>
                  <div className="font-black text-[#0D1B2A] text-[11px]">{p.label}</div>
                  <div className="text-[10px] text-[#8D99AE]">{p.sub}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] font-bold text-[#8D99AE] mt-2">
            Groq default model: <code className="bg-[#F0F2F5] px-1.5 py-0.5 rounded font-mono text-[#0D1B2A]">llama-4-maverick-17b-128e-instruct</code> (upgraded from Scout — better structured extraction for Indian estimates).
          </p>
        </div>
      </div>

      {/* Quick reference */}
      <div className="bg-white rounded-2xl border border-[#E2E6EA] shadow-sm overflow-hidden">
        <div className="px-6 py-4 flex items-center gap-3 border-b border-[#F0F2F5] bg-[#FAFAFA]">
          <BookOpen size={16} className="text-[#D4AF37]" />
          <h2 className="text-sm font-black text-[#0D1B2A]">Key Files Quick Reference</h2>
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
              <div key={item.file} className="flex items-start gap-3 py-2 border-b border-[#F0F2F5] last:border-0">
                <code className="text-[10px] font-mono font-bold text-[#0D1B2A] bg-[#F0F2F5] px-2 py-1 rounded flex-shrink-0 mt-0.5">{item.file}</code>
                <span className="text-xs text-[#4A4E69]">{item.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
