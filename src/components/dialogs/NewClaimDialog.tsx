'use client';

import { useUIStore } from '@/stores/ui-store';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { getOrCreateClaimFolder } from '@/lib/drive';
import { getAllClaims } from '@/lib/storage/indexeddb';
import { normalizeVehicleNumber } from '@/lib/utils/vehicle';
import { useState, useEffect, useRef } from 'react';
import type { VehicleType } from '@/types';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle2, Loader2, Car } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DuplicateMatch {
  id: string;
  registrationNumber: string;
  reportNo?: string;
  surveyType?: string;
  updatedAt?: string;
}

type DupState = 'idle' | 'checking' | 'duplicate' | 'clear';

// ─── Component ────────────────────────────────────────────────────────────────

export function NewClaimDialog() {
  const { isNewClaimDialogOpen, setNewClaimDialogOpen, setActiveTab } = useUIStore();
  const { newClaim } = useClaimStore();

  const [vehicleNo, setVehicleNo]   = useState('');
  const [surveyType, setSurveyType] = useState<'spot' | 'final'>('final');
  const [vehicleType, setVehicleType] = useState<VehicleType>('private');

  // Duplicate detection state
  const [dupState, setDupState]     = useState<DupState>('idle');
  const [dupMatches, setDupMatches] = useState<DuplicateMatch[]>([]);
  const [confirmed, setConfirmed]   = useState(false); // user explicitly chose to proceed
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Reset state when dialog opens ────────────────────────────
  useEffect(() => {
    if (isNewClaimDialogOpen) {
      setVehicleNo('');
      setDupState('idle');
      setDupMatches([]);
      setConfirmed(false);
    }
  }, [isNewClaimDialogOpen]);

  // ── Debounced duplicate check ─────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const normalized = normalizeVehicleNumber(vehicleNo);
    if (!normalized || normalized.length < 4) {
      setDupState('idle');
      setDupMatches([]);
      setConfirmed(false);
      return;
    }

    setDupState('checking');
    setConfirmed(false);

    debounceRef.current = setTimeout(async () => {
      try {
        const allClaims = await getAllClaims();
        const matches: DuplicateMatch[] = allClaims
          .filter(c => {
            const reg = c.vehicle?.registrationNumber ?? '';
            return reg.trim().length > 0 &&
              normalizeVehicleNumber(reg) === normalized;
          })
          .map(c => ({
            id: c.id,
            registrationNumber: c.vehicle?.registrationNumber ?? '',
            reportNo: c.reportNo,
            surveyType: c.surveyType,
            updatedAt: c.updatedAt,
          }));

        if (matches.length > 0) {
          setDupMatches(matches);
          setDupState('duplicate');
        } else {
          setDupMatches([]);
          setDupState('clear');
        }
      } catch {
        // IndexedDB not ready yet — treat as clear
        setDupState('clear');
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleNo]);

  if (!isNewClaimDialogOpen) return null;

  // ── Create handler ─────────────────────────────────────────────
  const handleCreate = () => {
    if (!vehicleNo.trim()) return;
    // Block if duplicate detected and not yet confirmed
    if (dupState === 'duplicate' && !confirmed) return;

    const reportNo = useProfileStore.getState().getNextReportNumber(surveyType);

    newClaim(surveyType, vehicleType);
    useClaimStore.getState().updateVehicle({ registrationNumber: vehicleNo.toUpperCase() });
    useClaimStore.getState().updateClaim({ reportNo });

    const { currentClaimId } = useClaimStore.getState();
    if (currentClaimId) {
      const label = vehicleNo.toUpperCase();
      getOrCreateClaimFolder(currentClaimId, label).catch(e =>
        console.warn('[Drive] Folder creation skipped (Drive not linked):', e.message)
      );
    }

    setVehicleNo('');
    setNewClaimDialogOpen(false);
    setActiveTab('details');
  };

  const isCreateDisabled =
    !vehicleNo.trim() ||
    dupState === 'checking' ||
    (dupState === 'duplicate' && !confirmed);

  // ─── Shared styles ─────────────────────────────────────────────
  const surveyBtn = (type: 'spot' | 'final') =>
    `flex-1 py-2 text-sm font-semibold rounded-md border transition-all ${
      surveyType === type
        ? 'border-primary bg-primary/10 text-primary'
        : 'border-border text-muted-foreground hover:bg-muted/50'
    }`;

  const vtBtn = (type: VehicleType) =>
    `flex-1 py-1.5 px-1 text-xs font-semibold rounded-md border leading-tight transition-all ${
      vehicleType === type
        ? 'border-primary bg-primary/10 text-primary'
        : 'border-border text-muted-foreground hover:bg-muted/50'
    }`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car size={18} />
            Create New Claim
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">

          {/* ── Vehicle No Input ─────────────────────────────── */}
          <div className="space-y-2">
            <Label>Vehicle Registration No.</Label>
            <div className="relative">
              <Input
                autoFocus
                className="uppercase text-lg font-bold pr-10"
                placeholder="e.g. MH01AB1234"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isCreateDisabled) handleCreate();
                }}
              />
              {/* Status icon inside input */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {dupState === 'checking' && (
                  <Loader2 size={15} className="animate-spin text-muted-foreground" />
                )}
                {dupState === 'clear' && (
                  <CheckCircle2 size={15} className="text-emerald-500" />
                )}
                {dupState === 'duplicate' && (
                  <AlertTriangle size={15} className="text-amber-500" />
                )}
              </div>
            </div>

            {/* ── Duplicate warning banner ─── */}
            {dupState === 'duplicate' && (
              <div
                className="rounded-xl overflow-hidden border border-amber-300"
                style={{ background: 'rgba(251,191,36,0.08)' }}
              >
                {/* Header */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-400/10 border-b border-amber-300/40">
                  <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                  <span className="text-xs font-black text-amber-700 uppercase tracking-wide">
                    Duplicate Vehicle Number
                  </span>
                </div>

                {/* Matches */}
                <div className="px-4 py-2 space-y-1.5">
                  <p className="text-[11px] text-amber-800/80 mb-2 leading-snug">
                    This vehicle number already exists in your records.
                    Different separators like dashes, dots, or spaces are treated as the same number.
                  </p>
                  {dupMatches.map(m => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between py-1.5 px-3 rounded-lg"
                      style={{ background: 'rgba(251,191,36,0.12)' }}
                    >
                      <div>
                        <span className="text-xs font-black text-amber-900">
                          {m.registrationNumber.toUpperCase()}
                        </span>
                        {m.reportNo && (
                          <span className="ml-2 text-[10px] text-amber-700/70">
                            Report: {m.reportNo}
                          </span>
                        )}
                      </div>
                      <span
                        className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full"
                        style={{
                          background: m.surveyType === 'spot'
                            ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
                          color: m.surveyType === 'spot' ? '#2563eb' : '#059669',
                        }}
                      >
                        {m.surveyType ?? 'claim'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Confirmation toggle */}
                <div className="px-4 py-3 border-t border-amber-300/40">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 w-4 h-4 accent-amber-500 flex-shrink-0"
                      checked={confirmed}
                      onChange={e => setConfirmed(e.target.checked)}
                    />
                    <span className="text-[11px] text-amber-800 font-semibold leading-snug">
                      I understand this is a duplicate entry and still want to create a new claim.
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* ── All-clear badge ─── */}
            {dupState === 'clear' && vehicleNo.trim().length >= 4 && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold px-1">
                <CheckCircle2 size={12} />
                No existing claim found for this vehicle number.
              </div>
            )}
          </div>

          {/* ── Survey Type ──────────────────────────────────── */}
          <div className="space-y-2">
            <Label>Survey Type</Label>
            <div className="flex gap-2">
              <button onClick={() => setSurveyType('spot')} className={surveyBtn('spot')}>Spot</button>
              <button onClick={() => setSurveyType('final')} className={surveyBtn('final')}>Final</button>
            </div>
          </div>

          {/* ── Vehicle Type ─────────────────────────────────── */}
          <div className="space-y-2">
            <Label>Vehicle Type</Label>
            <div className="flex gap-2 text-center">
              <button onClick={() => setVehicleType('private')} className={vtBtn('private')}>
                Private<br/>Vehicle
              </button>
              <button onClick={() => setVehicleType('comm-goods')} className={vtBtn('comm-goods')}>
                Commercial<br/>Goods
              </button>
              <button onClick={() => setVehicleType('comm-passenger')} className={vtBtn('comm-passenger')}>
                Commercial<br/>Passenger
              </button>
            </div>
          </div>

        </CardContent>

        <CardFooter className="flex justify-end gap-2 mt-2">
          <button
            onClick={() => setNewClaimDialogOpen(false)}
            className="px-4 py-2 rounded-md text-sm font-semibold text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreateDisabled}
            className="px-4 py-2 rounded-md text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-40 transition-opacity"
          >
            {dupState === 'duplicate' && !confirmed
              ? 'Confirm duplicate ↑'
              : 'Create Claim'}
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}
