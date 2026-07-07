'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { pullClaimsFromCloud, pushClaimToCloud } from '@/lib/firebase/sync';
import { getAllClaims, saveClaim, getAllDriveBackedAt } from '@/lib/storage/indexeddb';
import { backupClaimToDrive, backupAllPendingToDrive, getDriveToken } from '@/lib/drive';
import { computeSyncHealth } from '@/lib/sync/sync-health';
import { ClaimData } from '@/types';
import {
  Cloud,
  RefreshCw,
  Download,
  FileCheck,
  AlertCircle,
  Clock,
  ArrowRight,
  Database,
  HardDrive,
  Search,
  Filter,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

export function CloudVaultTab() {
  const { user, isAuthenticated } = useAuthStore();
  const [cloudClaims, setCloudClaims] = useState<ClaimData[]>([]);
  const [localClaims, setLocalClaims] = useState<ClaimData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [driveMap, setDriveMap] = useState<Map<string, string>>(new Map());
  const [driveLinked, setDriveLinked] = useState(false);
  const [bulkDriveSyncing, setBulkDriveSyncing] = useState(false);
  const pendingRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    if (!isAuthenticated || !user) return;
    setLoading(true);
    try {
      const cloud = await pullClaimsFromCloud(user.uid, null);
      const local = await getAllClaims();
      const drive = await getAllDriveBackedAt();
      setCloudClaims(cloud);
      setLocalClaims(local);
      setDriveMap(drive);
      setDriveLinked(!!getDriveToken());
    } catch (error) {
      console.error('Vault fetch error:', error);
      toast.error('Failed to connect to Cloud Vault');
    } finally {
      setLoading(false);
    }
  };

  // A claim's Drive replica is current when its backed-up updatedAt is at least
  // as new as the claim's own updatedAt (device-local knowledge, see driveTracking).
  const isDriveSynced = (claim: ClaimData): boolean => {
    const v = driveMap.get(claim.id);
    return !!v && v >= claim.updatedAt;
  };

  useEffect(() => {
    fetchData();
  }, [isAuthenticated, user]);

  // Cloud → local: actually persist the claim to this device's IndexedDB.
  const handleRestore = async (claim: ClaimData) => {
    setSyncingId(claim.id);
    try {
      await saveClaim(claim);
      toast.success(`Claim ${claim.reportNo || claim.id} restored to this device.`);
      fetchData();
    } catch {
      toast.error('Restore failed. Try again.');
    } finally {
      setSyncingId(null);
    }
  };

  // Local → cloud: push a single local-only claim to the Firestore vault,
  // then mirror it to Google Drive and report both results.
  const handlePushOne = async (claim: ClaimData) => {
    if (!user) return;
    setSyncingId(claim.id);
    try {
      await pushClaimToCloud(user.uid, claim, { mirrorToDrive: false });
      const drive = await backupClaimToDrive(claim);
      const label = claim.reportNo || claim.id;
      if (drive === 'ok') {
        toast.success(`Claim ${label} backed up to Vault + Drive.`);
      } else if (drive === 'skipped') {
        toast.success(`Claim ${label} backed up to Vault. Link Google Drive to back up there too.`);
      } else {
        toast.warning(`Claim ${label} backed up to Vault. Drive backup failed — will retry on next sync.`);
      }
      fetchData();
    } catch {
      toast.error('Sync failed. Check your connection and try again.');
    } finally {
      setSyncingId(null);
    }
  };

  // Local → cloud: push every local-only claim to the vault and mirror each to
  // Drive. Failures on individual claims don't abort the rest — the toast
  // reports how many reached the Vault and how many reached Drive.
  const handleSyncAll = async () => {
    if (!user || localOnlyClaims.length === 0) return;
    setBulkSyncing(true);
    let success = 0;
    let driveOk = 0;
    for (const claim of localOnlyClaims) {
      try {
        await pushClaimToCloud(user.uid, claim, { mirrorToDrive: false });
        success++;
        if ((await backupClaimToDrive(claim)) === 'ok') driveOk++;
      } catch {
        /* continue with the remaining claims */
      }
    }
    toast.success(
      `${success} of ${localOnlyClaims.length} claims synced to Vault` +
      (driveLinked ? `, ${driveOk} to Drive.` : ' (link Google Drive to also back up there).')
    );
    fetchData();
    setBulkSyncing(false);
  };

  // Back up every claim whose Drive replica is missing/stale, in one go.
  // Duplicate-safe (serialized in the drive layer) and idempotent.
  const handleBackupAllDrive = async () => {
    if (!driveLinked || bulkDriveSyncing) return;
    setBulkDriveSyncing(true);
    const toastId = toast.loading('Backing up claims to Drive…');
    try {
      const { backedUp, failed, total } = await backupAllPendingToDrive();
      if (total === 0) {
        toast.success('All claims already backed up to Drive.', { id: toastId });
      } else if (failed === 0) {
        toast.success(`${backedUp} claim${backedUp > 1 ? 's' : ''} backed up to Drive.`, { id: toastId });
      } else {
        toast.warning(`${backedUp} backed up, ${failed} failed — will retry on next sync.`, { id: toastId });
      }
    } catch {
      toast.error('Drive backup failed. Try again.', { id: toastId });
    } finally {
      setBulkDriveSyncing(false);
      fetchData();
    }
  };

  const filteredClaims = cloudClaims.filter(c =>
    (c.reportNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.vehicle?.registrationNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.policy?.insuredName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const syncHealth = computeSyncHealth(
    localClaims.map(c => c.id),
    cloudClaims.map(c => c.id),
  );

  // Claims that live on this device but are not yet in the cloud vault.
  // Reuses the already-fetched arrays — no extra network/DB cost.
  const cloudIdSet = new Set(cloudClaims.map(c => c.id));
  const localOnlyClaims = localClaims.filter(c => !cloudIdSet.has(c.id));

  // Drive backup health — how many of this device's claims have a current
  // Drive replica (based on the local driveTracking store).
  const driveSyncedCount = localClaims.filter(isDriveSynced).length;
  const drivePct = localClaims.length ? Math.round((driveSyncedCount / localClaims.length) * 100) : 100;
  const drivePending = localClaims.length - driveSyncedCount;

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-neutral-50">
        <div className="w-16 h-16 rounded-3xl bg-[var(--color-neutral-100)] flex items-center justify-center text-[var(--color-neutral-400)] mb-6">
          <Cloud size={32} />
        </div>
        <h2 className="text-xl font-medium text-[var(--color-neutral-900)] mb-2">Cloud Vault Locked</h2>
        <p className="text-sm text-[var(--color-neutral-400)] max-w-sm">Sign in to your SurveyOS account to access your cross-device claim backups.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-neutral-50)]">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="px-8 py-8 border-b bg-card border-border">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]">
                <Database size={24} />
              </div>
              <h1 className="text-2xl font-medium tracking-tight text-foreground">Digital Cloud Vault</h1>
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              Your secure, cross-device archive of all processed claims and surveys.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                type="text"
                placeholder="Search vault..."
                className="pl-10 pr-4 py-2.5 rounded-xl border border-border text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              onClick={fetchData}
              className="p-2.5 rounded-xl border border-border text-foreground hover:bg-[var(--color-neutral-50)] transition-all bg-card"
              title="Refresh Vault"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin opacity-50' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto">
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Total Vault Storage</div>
              <div className="text-2xl font-medium text-foreground">{cloudClaims.length} Claims</div>
              <div className="text-[10px] text-[var(--color-status-success)] font-medium mt-1 flex items-center gap-1">
                <FileCheck size={12} /> Encrypted & Secure
              </div>
            </div>
            <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Local Registry</div>
              <div className="text-2xl font-medium text-foreground">{localClaims.length} Active</div>
              <div className="text-[10px] text-[var(--color-neutral-600)] font-medium mt-1 flex items-center gap-1">
                <Database size={12} /> IndexedDB Status
              </div>
            </div>
            <div
              onClick={() => pendingRef.current?.scrollIntoView({ behavior: 'smooth' })}
              role={syncHealth.localOnlyCount > 0 ? 'button' : undefined}
              className={`p-6 rounded-2xl shadow-xl text-white transition-opacity ${syncHealth.localOnlyCount > 0 ? 'bg-[var(--color-status-warning)] shadow-[var(--color-status-warning-tint)] cursor-pointer hover:opacity-90' : 'bg-[var(--color-neutral-600)] shadow-[var(--color-neutral-200)]'}`}
            >
              <div className="text-[10px] font-medium uppercase tracking-wider text-white/70 mb-1">Sync Health</div>
              <div className="text-2xl font-medium">{syncHealth.syncedPct}% Synced</div>
              <div className="text-[10px] text-white/80 font-medium mt-1 flex items-center gap-1">
                <Cloud size={12} />
                {syncHealth.localOnlyCount > 0
                  ? `${syncHealth.localOnlyCount} claim${syncHealth.localOnlyCount > 1 ? 's' : ''} not yet backed up`
                  : 'All claims backed up to cloud'}
              </div>
            </div>

            {/* Drive Backup status */}
            <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Drive Backup</div>
              <div className="text-2xl font-medium text-foreground">
                {driveLinked ? `${drivePct}% on Drive` : 'Not Linked'}
              </div>
              <div className="text-[10px] font-medium mt-1 flex items-center gap-1 text-[var(--color-neutral-600)]">
                <HardDrive size={12} />
                {!driveLinked
                  ? 'Link Google Drive in Profile'
                  : drivePending > 0
                  ? `${drivePending} claim${drivePending > 1 ? 's' : ''} not on Drive`
                  : 'All claims mirrored to Drive'}
              </div>
              {driveLinked && drivePending > 0 && (
                <button
                  onClick={handleBackupAllDrive}
                  disabled={bulkDriveSyncing}
                  className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wider bg-primary text-white hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
                >
                  {bulkDriveSyncing ? <RefreshCw size={12} className="animate-spin" /> : <HardDrive size={12} />}
                  Back up {drivePending} to Drive
                </button>
              )}
            </div>
          </div>

          {/* ── Pending Backup: local-only claims not yet in the cloud ── */}
          {localOnlyClaims.length > 0 && (
            <div ref={pendingRef} className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-status-warning)]">
                  Pending Backup — {localOnlyClaims.length} claim{localOnlyClaims.length > 1 ? 's' : ''} not yet in cloud
                </h2>
                <button
                  onClick={handleSyncAll}
                  disabled={bulkSyncing}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-[var(--color-status-warning)] text-white hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
                >
                  {bulkSyncing ? <RefreshCw size={12} className="animate-spin" /> : <Cloud size={12} />}
                  Sync All to Cloud
                </button>
              </div>
              <div className="space-y-3">
                {localOnlyClaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="p-4 rounded-2xl bg-[var(--color-status-warning-tint)] border border-[var(--color-status-warning)]/30 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[var(--color-status-warning)]/10 text-[var(--color-status-warning)]">
                        <AlertCircle size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground flex items-center gap-2">
                          {claim.reportNo || 'UNTITLED REPORT'}
                          <span className="px-2 py-0.5 rounded-md bg-[var(--color-neutral-100)] text-muted-foreground text-[10px] font-medium">
                            {claim.vehicle?.registrationNumber || 'NO REG'}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground font-medium mt-0.5 flex items-center gap-3">
                          <span className="flex items-center gap-1 uppercase tracking-wider text-[10px]">
                            <Clock size={12} /> Updated {new Date(claim.updatedAt).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-[var(--color-neutral-200)]" />
                            {claim.policy?.insuredName || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handlePushOne(claim)}
                      disabled={syncingId === claim.id}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-status-warning)] text-white text-[10px] font-medium uppercase tracking-wider hover:opacity-90 transition-all active:scale-95 shadow-lg disabled:opacity-50"
                    >
                      {syncingId === claim.id ? <RefreshCw className="animate-spin" size={12} /> : <Cloud size={12} />}
                      Sync Now
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && filteredClaims.length === 0 ? (
            <div className="py-20 text-center bg-card rounded-3xl border border-border">
              <div className="w-20 h-20 rounded-full bg-[var(--color-neutral-50)] flex items-center justify-center mx-auto mb-4 border border-dashed border-[var(--color-neutral-200)]">
                <Cloud size={32} className="text-[var(--color-neutral-200)]" />
              </div>
              <h3 className="text-lg font-medium text-foreground">No claims found in cloud</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">Either your vault is empty or no claims match your current search.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredClaims.map((claim) => {
                const isLocal = localClaims.some(l => l.id === claim.id);
                return (
                  <div key={claim.id} className="p-4 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all shadow-sm flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner ${
                        isLocal ? 'bg-[var(--color-status-success-tint)] text-[var(--color-status-success)]' : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]'
                      }`}>
                        {isLocal ? <FileCheck size={20} /> : <Download size={20} />}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground flex items-center gap-2">
                          {claim.reportNo || 'UNTITLED REPORT'}
                          <span className="px-2 py-0.5 rounded-md bg-[var(--color-neutral-100)] text-muted-foreground text-[10px] font-medium">
                            {claim.vehicle?.registrationNumber || 'NO REG'}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground font-medium mt-0.5 flex items-center gap-3">
                          <span className="flex items-center gap-1 uppercase tracking-wider text-[10px]">
                            <Clock size={12} /> Updated {new Date(claim.updatedAt).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-[var(--color-neutral-200)]" />
                            {claim.policy?.insuredName || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {driveLinked && (
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-medium uppercase tracking-wider select-none ${
                          isDriveSynced(claim)
                            ? 'bg-[var(--color-status-success-tint)] text-[var(--color-status-success)]'
                            : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-400)]'
                        }`}>
                          <HardDrive size={12} />
                          {isDriveSynced(claim) ? 'Drive Synced' : 'Drive Pending'}
                        </div>
                      )}
                      {isLocal ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--color-neutral-50)] text-[var(--color-neutral-600)] text-[10px] font-medium uppercase tracking-wider select-none">
                          <FileCheck size={12} />
                          Local Synced
                        </div>
                      ) : (
                        <button
                          onClick={() => handleRestore(claim)}
                          disabled={syncingId === claim.id}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-[10px] font-medium uppercase tracking-wider hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/20 disabled:opacity-50"
                        >
                          {syncingId === claim.id ? <RefreshCw className="animate-spin" size={12} /> : <Download size={12} />}
                          Restore Locally
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* ── Footer ──────────────────────────────────────── */}
      <div className="px-8 py-4 border-t bg-card border-border text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Motor SurveyOS • Multi-Device Cloud Vault Protection • Powered by Google Cloud
        </p>
      </div>
    </div>
  );
}

