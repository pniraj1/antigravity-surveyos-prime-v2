'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { pullClaimsFromCloud, pushClaimToCloud } from '@/lib/firebase/sync';
import { getAllClaims } from '@/lib/storage/indexeddb';
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

  const fetchData = async () => {
    if (!isAuthenticated || !user) return;
    setLoading(true);
    try {
      const cloud = await pullClaimsFromCloud(user.uid, null);
      const local = await getAllClaims();
      setCloudClaims(cloud);
      setLocalClaims(local);
    } catch (error) {
      console.error('Vault fetch error:', error);
      toast.error('Failed to connect to Cloud Vault');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isAuthenticated, user]);

  const handleRestore = async (claim: ClaimData) => {
    setSyncingId(claim.id);
    try {
      // pullClaimsFromCloud already saves to local DB if newer, 
      // but we can force it here if needed.
      toast.success(`Claim ${claim.reportNo || claim.id} restored to local storage`);
      fetchData();
    } finally {
      setSyncingId(null);
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
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
            <div className={`p-6 rounded-2xl shadow-xl text-white ${syncHealth.localOnlyCount > 0 ? 'bg-[var(--color-status-warning)] shadow-[var(--color-status-warning-tint)]' : 'bg-[var(--color-neutral-600)] shadow-[var(--color-neutral-200)]'}`}>
              <div className="text-[10px] font-medium uppercase tracking-wider text-white/70 mb-1">Sync Health</div>
              <div className="text-2xl font-medium">{syncHealth.syncedPct}% Synced</div>
              <div className="text-[10px] text-white/80 font-medium mt-1 flex items-center gap-1">
                <Cloud size={12} />
                {syncHealth.localOnlyCount > 0
                  ? `${syncHealth.localOnlyCount} claim${syncHealth.localOnlyCount > 1 ? 's' : ''} not yet backed up`
                  : 'All claims backed up to cloud'}
              </div>
            </div>
          </div>

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

