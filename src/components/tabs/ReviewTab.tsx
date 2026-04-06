'use client';

import { useClaimStore } from '@/stores/claim-store';
import { useUIStore } from '@/stores/ui-store';
import {
  CheckCircle2, Clock, FileText, ChevronRight, Sparkles,
  Car, CreditCard, Shield, FileCheck, Wrench, Camera,
  ScrollText, Receipt, AlertCircle,
} from 'lucide-react';

const DOC_META: Record<string, { label: string; icon: any; color: string }> = {
  rc:          { label: 'RC Book',          icon: Car,         color: '#0D1B2A' },
  dl:          { label: 'Driving Licence',  icon: CreditCard,  color: '#1e3a5f' },
  policy:      { label: 'Policy Schedule',  icon: Shield,      color: '#D4AF37' },
  claim:       { label: 'Claim Form',       icon: FileCheck,   color: '#4A4E69' },
  estimate:    { label: 'Repair Estimate',  icon: Wrench,      color: '#059669' },
  photos:      { label: 'Damage Photos',    icon: Camera,      color: '#7c3aed' },
  permit:      { label: 'Vehicle Permit',   icon: ScrollText,  color: '#b45309' },
  auth:        { label: 'Auth Cert.',       icon: FileText,    color: '#0369a1' },
  fitness:     { label: 'Fitness Cert.',    icon: Receipt,     color: '#be185d' },
};

export function ReviewTab() {
  const currentClaim = useClaimStore(s => s.currentClaim);
  const extractedDocs = currentClaim?.extractedData ?? {};
  const { setActiveTab } = useUIStore();

  if (!currentClaim) return null;

  const scannedKeys = Object.keys(extractedDocs);
  const allKeys = Object.keys(DOC_META);
  const pendingKeys = allKeys.filter(k => !scannedKeys.includes(k));

  return (
    <div className="h-full overflow-y-auto" style={{ background: '#F8F9FA' }}>

      {/* ── Header ─────────────────────────────────────── */}
      <div
        className="px-8 py-8 lg:px-12"
        style={{
          background: 'linear-gradient(135deg, #0D1B2A 0%, #1e3a5f 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="max-w-4xl mx-auto">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] mb-4"
            style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}
          >
            <Sparkles size={11} />
            AI Extraction Results
          </div>
          <h1 className="text-2xl lg:text-3xl font-black mb-2" style={{ color: '#F8F9FA', letterSpacing: '-0.02em' }}>
            Document Review
          </h1>
          <p className="text-sm" style={{ color: 'rgba(232,236,240,0.65)' }}>
            Review all AI-extracted data below. Go to <strong style={{ color: '#D4AF37' }}>Claim Details</strong> to see auto-filled fields.
          </p>

          {/* Summary chips */}
          <div className="flex items-center gap-3 mt-5 flex-wrap">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: 'rgba(5,150,105,0.15)', color: '#34d399' }}
            >
              <CheckCircle2 size={13} />
              {scannedKeys.length} Scanned
            </div>
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
            >
              <Clock size={13} />
              {pendingKeys.length} Pending
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-12 py-8 max-w-4xl mx-auto space-y-6">

        {/* ── No docs yet ──────────────────────────────── */}
        {scannedKeys.length === 0 && (
          <div
            className="rounded-2xl p-12 flex flex-col items-center text-center"
            style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: '#F0F2F5' }}
            >
              <AlertCircle size={28} style={{ color: '#8D99AE' }} />
            </div>
            <div className="text-base font-bold mb-1" style={{ color: '#0D1B2A' }}>
              No documents scanned yet
            </div>
            <div className="text-sm mb-6" style={{ color: '#8D99AE' }}>
              Go to the Documents tab and upload your first document for AI extraction.
            </div>
            <button
              onClick={() => setActiveTab('documents')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: 'linear-gradient(135deg, #D4AF37, #f0d870)',
                color: '#0D1B2A',
                boxShadow: '0 4px 16px rgba(212,175,55,0.3)',
              }}
            >
              <Sparkles size={14} />
              Go to Documents Tab
            </button>
          </div>
        )}

        {/* ── Scanned Document Cards ────────────────────── */}
        {scannedKeys.map(key => {
          const meta = DOC_META[key] ?? { label: key.toUpperCase(), icon: FileText, color: '#4A4E69' };
          const Icon = meta.icon;
          const data = extractedDocs[key];
          const fields = typeof data === 'object' && data !== null ? Object.entries(data) : [];

          return (
            <div
              key={key}
              className="rounded-2xl overflow-hidden"
              style={{ background: '#FFFFFF', border: '1px solid #E2E6EA', boxShadow: '0 1px 4px rgba(13,27,42,0.04)' }}
            >
              {/* Card header */}
              <div
                className="px-6 py-4 flex items-center gap-3"
                style={{ borderBottom: '1px solid #F0F2F5', background: '#FAFAFA' }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${meta.color}15`, color: meta.color }}
                >
                  <Icon size={17} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-black" style={{ color: '#0D1B2A' }}>{meta.label}</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8D99AE' }}>
                    AI Extracted
                  </div>
                </div>
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
                  style={{ background: `${meta.color}15`, color: meta.color }}
                >
                  <CheckCircle2 size={11} />
                  {fields.length} fields
                </div>
              </div>

              {/* Fields grid */}
              {fields.length > 0 ? (
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {fields
                    .filter(([, v]) => v !== '' && v !== null && v !== undefined)
                    .map(([field, value]) => (
                      <div key={field} className="space-y-0.5">
                        <div
                          className="text-[9px] font-black uppercase tracking-[0.2em]"
                          style={{ color: '#8D99AE' }}
                        >
                          {field.replace(/_/g, ' ')}
                        </div>
                        <div
                          className="text-sm font-semibold truncate"
                          style={{ color: '#0D1B2A' }}
                          title={typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        >
                          {typeof value === 'object'
                            ? Array.isArray(value)
                              ? `${value.length} items`
                              : JSON.stringify(value)
                            : String(value) || '—'}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="p-6 text-sm text-center" style={{ color: '#8D99AE' }}>
                  No fields extracted — try re-scanning with a clearer image.
                </div>
              )}
            </div>
          );
        })}

        {/* ── Pending docs shortcut ─────────────────────── */}
        {pendingKeys.length > 0 && scannedKeys.length > 0 && (
          <div
            className="rounded-2xl p-5 flex items-center justify-between gap-3"
            style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}
          >
            <div>
              <div className="text-sm font-bold" style={{ color: '#0D1B2A' }}>
                {pendingKeys.length} documents not yet scanned
              </div>
              <div className="text-xs mt-0.5" style={{ color: '#8D99AE' }}>
                {pendingKeys.map(k => DOC_META[k]?.label ?? k).join(', ')}
              </div>
            </div>
            <button
              onClick={() => setActiveTab('documents')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold flex-shrink-0 transition-all"
              style={{ background: '#0D1B2A', color: '#D4AF37' }}
            >
              Scan More <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
