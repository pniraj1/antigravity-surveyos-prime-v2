'use client';

import { useUIStore } from '@/stores/ui-store';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { getOrCreateClaimFolder } from '@/lib/drive';
import { getAllClaims, getClaim, saveClaim } from '@/lib/storage/indexeddb';
import { normalizeVehicleNumber } from '@/lib/utils/vehicle';
import { claimLandingTab } from '@/lib/claims/landing-tab';
import { useState, useEffect, useRef } from 'react';
import type { VehicleType } from '@/types';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle2, Loader2, Car, Archive, AlertCircle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DuplicateMatch {
  id: string;
  registrationNumber: string;
  reportNo?: string;
  surveyType?: string;
  updatedAt?: string;
}

type DupState = 'idle' | 'checking' | 'duplicate' | 'clear';

interface ActiveClaimSummary {
  id: string;
  registrationNumber: string;
  reportNo?: string;
  surveyType?: string;
  updatedAt?: string;
  isCompleted: boolean;
}

const ACTIVE_CLAIM_LIMIT = 50;

// ─── Archive-first screen ─────────────────────────────────────────────────────

function ArchiveFirstScreen({
  activeClaims,
  onArchived,
  onClose,
}: {
  activeClaims: ActiveClaimSummary[];
  onArchived: () => void;
  onClose: () => void;
}) {
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const handleArchive = async (id: string) => {
    setArchivingId(id);
    try {
      const fullClaim = await getClaim(id);
      if (fullClaim) {
        await saveClaim({ ...fullClaim, isActive: false, photos: [] });
        const docTypes = ['rc','dl','policy','fitness','permit','fir','claim','estimate','final-bill','photos'];
        docTypes.forEach(t => sessionStorage.removeItem(`evidence_${id}_${t}`));
        const channel = new BroadcastChannel('surveyos_claims_sync');
        channel.postMessage('CLAIMS_UPDATED');
        channel.close();
        onArchived();
      }
    } finally {
      setArchivingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-status-warning">
            <AlertCircle size={18} />
            Active Claim Limit Reached
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            You have {activeClaims.length} active claims — the maximum is {ACTIVE_CLAIM_LIMIT}.
            Archive at least one completed claim to create a new one.
          </p>
        </CardHeader>

        <CardContent>
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {activeClaims.map(c => (
              <div
                key={c.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg border bg-neutral-50"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {c.registrationNumber || 'No reg. no.'}
                  </div>
                  <div className="text-[11px] text-muted-foreground flex gap-2">
                    {c.reportNo && <span>{c.reportNo}</span>}
                    {c.surveyType && (
                      <span className="capitalize">{c.surveyType}</span>
                    )}
                    {c.updatedAt && (
                      <span>{new Date(c.updatedAt).toLocaleDateString('en-IN')}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleArchive(c.id)}
                  disabled={archivingId === c.id || !c.isCompleted}
                  title={!c.isCompleted ? 'Complete this claim before archiving' : undefined}
                  className="ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors flex-shrink-0"
                  style={{
                    borderColor: !c.isCompleted ? 'var(--color-neutral-200)' : 'var(--color-primary)',
                    color: (archivingId === c.id || !c.isCompleted) ? 'var(--color-neutral-600)' : 'var(--color-primary)',
                    background: (archivingId === c.id || !c.isCompleted) ? 'var(--color-neutral-100)' : 'rgb(212 175 55 / 0.08)',
                    cursor: (archivingId === c.id || !c.isCompleted) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {archivingId === c.id
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Archive size={12} />}
                  {!c.isCompleted ? 'Not Complete' : archivingId === c.id ? 'Archiving…' : 'Archive'}
                </button>
              </div>
            ))}
          </div>
        </CardContent>

        <CardFooter className="justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-semibold text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function NewClaimDialog() {
  const { isNewClaimDialogOpen, setNewClaimDialogOpen, setActiveTab } = useUIStore();
  const { newClaim } = useClaimStore();

  const [vehicleNo, setVehicleNo]   = useState('');
  const [surveyType, setSurveyType] = useState<'spot' | 'final' | 'valuation'>('final');
  const [vehicleType, setVehicleType] = useState<VehicleType>('private');
  const [activeClaims, setActiveClaims] = useState<ActiveClaimSummary[]>([]);
  const [limitReached, setLimitReached] = useState(false);

  const [dupState, setDupState]     = useState<DupState>('idle');
  const [dupMatches, setDupMatches] = useState<DuplicateMatch[]>([]);
  const [confirmed, setConfirmed]   = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check active claim count whenever dialog opens
  useEffect(() => {
    if (!isNewClaimDialogOpen) return;
    setVehicleNo('');
    setDupState('idle');
    setDupMatches([]);
    setConfirmed(false);

    getAllClaims().then(all => {
      const active = all
        .filter(c => c.isActive)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .map(c => ({
          id: c.id,
          registrationNumber: c.vehicle?.registrationNumber ?? '',
          reportNo: c.reportNo,
          surveyType: c.surveyType,
          updatedAt: c.updatedAt,
          isCompleted: c.isCompleted,
        }));
      setActiveClaims(active);
      setLimitReached(active.length >= ACTIVE_CLAIM_LIMIT);
    });
  }, [isNewClaimDialogOpen]);

  // Re-check after an archive action
  const refreshActiveCount = () => {
    getAllClaims().then(all => {
      const active = all
        .filter(c => c.isActive)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .map(c => ({
          id: c.id,
          registrationNumber: c.vehicle?.registrationNumber ?? '',
          reportNo: c.reportNo,
          surveyType: c.surveyType,
          updatedAt: c.updatedAt,
          isCompleted: c.isCompleted,
        }));
      setActiveClaims(active);
      setLimitReached(active.length >= ACTIVE_CLAIM_LIMIT);
    });
  };

  // Debounced duplicate check
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
        setDupState('clear');
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleNo]);

  if (!isNewClaimDialogOpen) return null;

  // Show archive-first screen if at limit
  if (limitReached) {
    return (
      <ArchiveFirstScreen
        activeClaims={activeClaims}
        onArchived={refreshActiveCount}
        onClose={() => setNewClaimDialogOpen(false)}
      />
    );
  }

  const handleCreate = () => {
    if (!vehicleNo.trim()) return;
    if (dupState === 'duplicate' && !confirmed) return;

    const reportNo = useProfileStore.getState().getNextReportNumber(surveyType);
    newClaim(surveyType, vehicleType);
    useClaimStore.getState().updateVehicle({ registrationNumber: vehicleNo.toUpperCase() });
    useClaimStore.getState().updateClaim({ reportNo });

    const { currentClaimId } = useClaimStore.getState();
    if (currentClaimId) {
      const label = vehicleNo.toUpperCase();
      getOrCreateClaimFolder(currentClaimId, label).catch(e =>
        console.warn('[Drive] Folder creation skipped:', e.message)
      );
    }

    setVehicleNo('');
    setNewClaimDialogOpen(false);
    // Valuation surveys don't get a Documents tab — see claimLandingTab.
    setActiveTab(claimLandingTab(surveyType));
  };

  const isCreateDisabled =
    !vehicleNo.trim() ||
    dupState === 'checking' ||
    (dupState === 'duplicate' && !confirmed);

  const surveyBtn = (type: 'spot' | 'final' | 'valuation') =>
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

          <div className="space-y-2">
            <Label>Vehicle Registration No.</Label>
            <div className="relative">
              <Input
                autoFocus
                className="uppercase text-lg font-medium pr-10"
                placeholder="e.g. MH01AB1234"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isCreateDisabled) handleCreate();
                }}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {dupState === 'checking' && <Loader2 size={15} className="animate-spin text-muted-foreground" />}
                {dupState === 'clear'    && <CheckCircle2 size={15} className="text-status-success" />}
                {dupState === 'duplicate' && <AlertTriangle size={15} className="text-status-warning" />}
              </div>
            </div>

            {dupState === 'duplicate' && (
              <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--color-status-warning)', background: 'var(--color-status-warning-tint)' }}>
                <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ background: 'var(--color-status-warning-tint)', borderBottomColor: 'var(--color-status-warning)' }}>
                  <AlertTriangle size={14} className="text-status-warning flex-shrink-0" />
                  <span className="text-xs font-medium text-status-warning uppercase tracking-wide">Duplicate Vehicle Number</span>
                </div>
                <div className="px-4 py-2 space-y-1.5">
                  <p className="text-[11px] text-status-warning mb-2 leading-snug" style={{ opacity: 0.8 }}>
                    This vehicle number already exists in your records.
                  </p>
                  {dupMatches.map(m => (
                    <div key={m.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg" style={{ background: 'var(--color-status-warning-tint)' }}>
                      <div>
                        <span className="text-xs font-medium text-status-warning">{m.registrationNumber.toUpperCase()}</span>
                        {m.reportNo && <span className="ml-2 text-[10px] text-status-warning" style={{ opacity: 0.7 }}>Report: {m.reportNo}</span>}
                      </div>
                      <span className="text-[9px] font-medium uppercase px-2 py-0.5 rounded-full"
                        style={{ background: m.surveyType === 'spot' ? 'rgb(59 130 246 / 0.15)' : 'rgb(16 185 129 / 0.15)', color: m.surveyType === 'spot' ? 'var(--color-primary)' : 'var(--color-status-success)' }}>
                        {m.surveyType ?? 'claim'}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 border-t" style={{ borderTopColor: 'var(--color-status-warning)' }}>
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input type="checkbox" className="mt-0.5 w-4 h-4 flex-shrink-0" style={{ accentColor: 'var(--color-status-warning)' }} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
                    <span className="text-[11px] text-status-warning font-medium leading-snug">
                      I understand this is a duplicate entry and still want to create a new claim.
                    </span>
                  </label>
                </div>
              </div>
            )}

            {dupState === 'clear' && vehicleNo.trim().length >= 4 && (
              <div className="flex items-center gap-1.5 text-[11px] text-status-success font-medium px-1">
                <CheckCircle2 size={12} />
                No existing claim found for this vehicle number.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Survey Type</Label>
            <div className="flex gap-2">
              <button onClick={() => setSurveyType('spot')} className={surveyBtn('spot')}>Spot</button>
              <button onClick={() => setSurveyType('final')} className={surveyBtn('final')}>Final</button>
              <button onClick={() => setSurveyType('valuation')} className={surveyBtn('valuation')}>
                Valuation
              </button>
            </div>
            {surveyType === 'valuation' && (
              <p className="text-[11px] text-status-warning font-medium px-1">
                Break-in inspection — RC upload auto-fills vehicle details, surveyor fills condition manually.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Vehicle Type</Label>
            <div className="flex gap-2 text-center">
              <button onClick={() => setVehicleType('private')} className={vtBtn('private')}>Private<br/>Vehicle</button>
              <button onClick={() => setVehicleType('comm-goods')} className={vtBtn('comm-goods')}>Commercial<br/>Goods</button>
              <button onClick={() => setVehicleType('comm-passenger')} className={vtBtn('comm-passenger')}>Commercial<br/>Passenger</button>
            </div>
          </div>

        </CardContent>

        <CardFooter className="flex justify-end gap-2 mt-2">
          <button onClick={() => setNewClaimDialogOpen(false)} className="px-4 py-2 rounded-md text-sm font-semibold text-muted-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreateDisabled}
            className="px-4 py-2 rounded-md text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-40 transition-opacity"
          >
            {dupState === 'duplicate' && !confirmed ? 'Confirm duplicate ↑' : 'Create Claim'}
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}
