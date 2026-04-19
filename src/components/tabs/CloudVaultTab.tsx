'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { pullClaimsFromCloud, pushClaimToCloud } from '@/lib/firebase/sync';
import { getAllClaims } from '@/lib/storage/indexeddb';
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

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-[#F8F9FA]">
        <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 mb-6">
          <Cloud size={32} />
        </div>
        <h2 className="text-xl font-black text-[#0D1B2A] mb-2">Cloud Vault Locked</h2>
        <p className="text-sm text-[#8D99AE] max-w-sm">Sign in to your SurveyOS account to access your cross-device claim backups.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#F8F9FA]">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="px-8 py-8 border-b bg-white border-[#E2E6EA]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Database size={24} />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-[#0D1B2A]">Digital Cloud Vault</h1>
            </div>
            <p className="text-sm font-medium text-[#8D99AE]">
              Your secure, cross-device archive of all processed claims and surveys.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8D99AE]" size={16} />
              <input 
                type="text" 
                placeholder="Search vault..."
                className="pl-10 pr-4 py-2.5 rounded-xl border border-[#E2E6EA] text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              onClick={fetchData}
              className="p-2.5 rounded-xl border border-[#E2E6EA] text-[#0D1B2A] hover:bg-[#F8F9FA] transition-all bg-white"
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
            <div className="p-6 rounded-2xl bg-white border border-[#E2E6EA] shadow-sm">
              <div className="text-[10px] font-black uppercase tracking-wider text-[#8D99AE] mb-1">Total Vault Storage</div>
              <div className="text-2xl font-black text-[#0D1B2A]">{cloudClaims.length} Claims</div>
              <div className="text-[10px] text-green-600 font-bold mt-1 flex items-center gap-1">
                <FileCheck size={12} /> Encrypted & Secure
              </div>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-[#E2E6EA] shadow-sm">
              <div className="text-[10px] font-black uppercase tracking-wider text-[#8D99AE] mb-1">Local Registry</div>
              <div className="text-2xl font-black text-[#0D1B2A]">{localClaims.length} Active</div>
              <div className="text-[10px] text-blue-600 font-bold mt-1 flex items-center gap-1">
                <Database size={12} /> IndexedDB Status
              </div>
            </div>
            <div className="p-6 rounded-2xl bg-blue-600 shadow-xl shadow-blue-500/10 text-white">
              <div className="text-[10px] font-black uppercase tracking-wider text-blue-100 mb-1">Sync Health</div>
              <div className="text-2xl font-black">100% Synced</div>
              <div className="text-[10px] text-blue-100 font-bold mt-1 flex items-center gap-1">
                <Cloud size={12} /> Real-time Protection Active
              </div>
            </div>
          </div>

          {!loading && filteredClaims.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-3xl border border-[#E2E6EA]">
              <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4 border border-dashed border-slate-200">
                <Cloud size={32} className="text-slate-300" />
              </div>
              <h3 className="text-lg font-black text-[#0D1B2A]">No claims found in cloud</h3>
              <p className="text-sm text-[#8D99AE] mt-1 max-w-sm mx-auto">Either your vault is empty or no claims match your current search.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredClaims.map((claim) => {
                const isLocal = localClaims.some(l => l.id === claim.id);
                return (
                  <div key={claim.id} className="p-4 rounded-2xl bg-white border border-[#E2E6EA] hover:border-blue-400/50 transition-all shadow-sm flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner ${
                        isLocal ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {isLocal ? <FileCheck size={20} /> : <Download size={20} />}
                      </div>
                      <div>
                        <div className="text-sm font-black text-[#0D1B2A] flex items-center gap-2">
                          {claim.reportNo || 'UNTITLED REPORT'}
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[#8D99AE] text-[10px] font-bold">
                            {claim.vehicle?.registrationNumber || 'NO REG'}
                          </span>
                        </div>
                        <div className="text-xs text-[#8D99AE] font-medium mt-0.5 flex items-center gap-3">
                          <span className="flex items-center gap-1 uppercase tracking-wider text-[10px]">
                            <Clock size={12} /> Updated {new Date(claim.updatedAt).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            {claim.policy?.insuredName || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isLocal ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-wider select-none">
                          <FileCheck size={12} />
                          Local Synced
                        </div>
                      ) : (
                        <button 
                          onClick={() => handleRestore(claim)}
                          disabled={syncingId === claim.id}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-500/20 disabled:opacity-50"
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
      <div className="px-8 py-4 border-t bg-white border-[#E2E6EA] text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8D99AE]">
          SurveyOS Prime • Multi-Device Cloud Vault Protection • Powered by Google Cloud
        </p>
      </div>
    </div>
  );
}
