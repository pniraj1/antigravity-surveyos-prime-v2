'use client';

import React, { useState, useRef } from 'react';
import { getClaim, saveClaim } from '@/lib/storage/indexeddb';
import { useClaimStore } from '@/stores/claim-store';
import { extractBankStatement, BankTransaction } from '@/lib/ai/bank-statement-extractor';
import {
  X, Upload, Loader2, CheckCircle, AlertCircle, BanknoteIcon, FileText, RefreshCw,
} from 'lucide-react';

interface Match {
  tx: BankTransaction;
  claimId: string;
  reportNo: string;
  vehicleNo: string;
  feeTotal: number;
  confirmed: boolean;
}

interface Props {
  onClose: () => void;
}

export function BankReconcileDialog({ onClose }: Props) {
  const { claimsList } = useClaimStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<'idle' | 'extracting' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [unmatched, setUnmatched] = useState<BankTransaction[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const unpaidClaims = claimsList.filter(c => c.isActive && !c.feePaid && c.feeTotal > 0);

  async function handleFile(file: File) {
    setStatus('extracting');
    setErrorMsg('');
    setMatches([]);
    setUnmatched([]);
    try {
      const transactions = await extractBankStatement(file);
      if (!transactions.length) {
        setErrorMsg('No credit transactions found in the statement.');
        setStatus('error');
        return;
      }

      const matched: Match[] = [];
      const unmatched: BankTransaction[] = [];

      for (const tx of transactions) {
        // Match within ±1 rupee tolerance for rounding
        const claim = unpaidClaims.find(c => Math.abs(c.feeTotal - tx.amount) <= 1);
        if (claim) {
          // Avoid duplicate matches for same claim
          const alreadyMatched = matched.some(m => m.claimId === claim.id);
          if (!alreadyMatched) {
            matched.push({
              tx,
              claimId: claim.id,
              reportNo: claim.reportNo || 'Draft',
              vehicleNo: claim.vehicleNo || '—',
              feeTotal: claim.feeTotal,
              confirmed: true,
            });
            continue;
          }
        }
        unmatched.push(tx);
      }

      setMatches(matched);
      setUnmatched(unmatched);
      setStatus('done');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Extraction failed. Check your AI API key in Profile settings.');
      setStatus('error');
    }
  }

  function toggleConfirm(idx: number) {
    setMatches(prev => prev.map((m, i) => i === idx ? { ...m, confirmed: !m.confirmed } : m));
  }

  async function applyMatches() {
    setSaving(true);
    let count = 0;
    for (const match of matches.filter(m => m.confirmed)) {
      try {
        const fullClaim = await getClaim(match.claimId);
        if (fullClaim) {
          await saveClaim({
            ...fullClaim,
            feeBill: {
              ...fullClaim.feeBill,
              feePaid: true,
              cashReceived: fullClaim.feeBill.cashReceived
                ? fullClaim.feeBill.cashReceived
                : `₹${match.tx.amount.toLocaleString('en-IN')} — ${match.tx.narration} (${match.tx.date})`,
            },
          });
          count++;
        }
      } catch {
        // continue with others
      }
    }
    setSavedCount(count);
    setSaving(false);
    // Broadcast to reload dashboard
    const channel = new BroadcastChannel('surveyos_claims_sync');
    channel.postMessage('CLAIMS_UPDATED');
    channel.close();
  }

  const confirmedCount = matches.filter(m => m.confirmed).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(13,27,42,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ background: '#FFFFFF' }}
      >
        {/* Header */}
        <div
          className="px-6 py-5 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #0D1B2A, #1e3a5f)', borderRadius: '16px 16px 0 0' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.2)' }}>
              <BanknoteIcon size={18} style={{ color: '#D4AF37' }} />
            </div>
            <div>
              <h2 className="text-base font-black" style={{ color: '#F8F9FA' }}>Reconcile Bank Statement</h2>
              <p className="text-[11px]" style={{ color: 'rgba(232,236,240,0.6)' }}>
                Match incoming payments to outstanding fee bills
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: 'rgba(232,236,240,0.6)' }}>
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Unpaid summary */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}>
            <AlertCircle size={15} style={{ color: '#92400E' }} />
            <span className="text-xs font-semibold" style={{ color: '#92400E' }}>
              {unpaidClaims.length} unpaid claim{unpaidClaims.length !== 1 ? 's' : ''} outstanding — upload your bank statement to auto-match payments
            </span>
          </div>

          {/* Upload area */}
          {status !== 'done' && (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.csv"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={status === 'extracting'}
                className="w-full flex flex-col items-center justify-center gap-3 py-10 rounded-2xl border-2 border-dashed transition-all"
                style={{ borderColor: '#D4AF37', background: 'rgba(212,175,55,0.04)' }}
              >
                {status === 'extracting' ? (
                  <>
                    <Loader2 size={28} className="animate-spin" style={{ color: '#D4AF37' }} />
                    <span className="text-sm font-bold" style={{ color: '#4A4E69' }}>Extracting transactions with AI…</span>
                    <span className="text-xs" style={{ color: '#8D99AE' }}>This may take 10–20 seconds for multi-page PDFs</span>
                  </>
                ) : (
                  <>
                    <Upload size={28} style={{ color: '#D4AF37' }} />
                    <span className="text-sm font-bold" style={{ color: '#0D1B2A' }}>Upload Bank Statement</span>
                    <span className="text-xs" style={{ color: '#8D99AE' }}>PDF or CSV — credit entries will be extracted automatically</span>
                  </>
                )}
              </button>
              {status === 'error' && (
                <p className="mt-3 text-xs font-semibold text-center" style={{ color: '#EF4444' }}>{errorMsg}</p>
              )}
            </div>
          )}

          {/* Results */}
          {status === 'done' && savedCount === 0 && (
            <>
              {matches.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-widest" style={{ color: '#8D99AE' }}>
                      Matched Payments ({matches.length})
                    </h3>
                    <button
                      onClick={() => { setStatus('idle'); setMatches([]); setUnmatched([]); }}
                      className="flex items-center gap-1 text-xs font-semibold"
                      style={{ color: '#4A4E69' }}
                    >
                      <RefreshCw size={12} /> Upload another
                    </button>
                  </div>

                  {matches.map((m, i) => (
                    <div
                      key={i}
                      onClick={() => toggleConfirm(i)}
                      className="flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all"
                      style={{
                        border: `1px solid ${m.confirmed ? '#10B981' : '#E2E6EA'}`,
                        background: m.confirmed ? 'rgba(16,185,129,0.04)' : '#FAFAFA',
                      }}
                    >
                      <div
                        className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                        style={{ borderColor: m.confirmed ? '#10B981' : '#D1D5DB', background: m.confirmed ? '#10B981' : 'transparent' }}
                      >
                        {m.confirmed && <CheckCircle size={14} color="white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black" style={{ color: '#0D1B2A' }}>{m.vehicleNo}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: '#F0F2F5', color: '#4A4E69' }}>{m.reportNo}</span>
                        </div>
                        <div className="text-[11px] truncate mt-0.5" style={{ color: '#8D99AE' }}>
                          {m.tx.narration} · {m.tx.date}
                          {m.tx.reference && ` · Ref: ${m.tx.reference}`}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-black" style={{ color: '#10B981' }}>
                          ₹{m.tx.amount.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px]" style={{ color: '#8D99AE' }}>
                          Billed ₹{m.feeTotal.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  ))}

                  {unmatched.length > 0 && (
                    <div className="px-4 py-3 rounded-xl" style={{ background: '#F8F9FA', border: '1px solid #E2E6EA' }}>
                      <p className="text-[11px]" style={{ color: '#8D99AE' }}>
                        <span className="font-bold">{unmatched.length} transaction{unmatched.length !== 1 ? 's' : ''}</span> could not be matched to any unpaid claim:&nbsp;
                        {unmatched.map(t => `₹${t.amount.toLocaleString('en-IN')} (${t.date})`).join(', ')}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={applyMatches}
                    disabled={saving || confirmedCount === 0}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all"
                    style={{
                      background: confirmedCount > 0 ? 'linear-gradient(135deg, #D4AF37, #f0d870)' : '#E2E6EA',
                      color: confirmedCount > 0 ? '#0D1B2A' : '#8D99AE',
                    }}
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                    {saving ? 'Marking as Paid…' : `Mark ${confirmedCount} Claim${confirmedCount !== 1 ? 's' : ''} as Fee Received`}
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText size={32} className="mx-auto mb-3" style={{ color: '#D1D5DB' }} />
                  <p className="text-sm font-bold" style={{ color: '#4A4E69' }}>No matches found</p>
                  <p className="text-xs mt-1" style={{ color: '#8D99AE' }}>
                    None of the credit amounts matched your outstanding fee bills.
                    {unmatched.length > 0 && ` Found ${unmatched.length} credit transaction(s) but amounts didn't match.`}
                  </p>
                  <button
                    onClick={() => { setStatus('idle'); setMatches([]); setUnmatched([]); }}
                    className="mt-4 text-xs font-bold underline"
                    style={{ color: '#4A4E69' }}
                  >
                    Try another file
                  </button>
                </div>
              )}
            </>
          )}

          {/* Success state */}
          {savedCount > 0 && (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
                <CheckCircle size={28} style={{ color: '#10B981' }} />
              </div>
              <p className="text-base font-black" style={{ color: '#0D1B2A' }}>
                {savedCount} claim{savedCount !== 1 ? 's' : ''} marked as Fee Received
              </p>
              <p className="text-xs mt-1" style={{ color: '#8D99AE' }}>Dashboard totals have been updated</p>
              <button
                onClick={onClose}
                className="mt-5 px-6 py-2.5 rounded-xl text-sm font-black"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #f0d870)', color: '#0D1B2A' }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
