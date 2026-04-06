'use client';

import React, { useState, useEffect } from 'react';
import { 
  collectionGroup, 
  getDocs, 
  query, 
  where, 
  doc, 
  updateDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { 
  Users, 
  Search, 
  ShieldCheck, 
  UserX, 
  Calendar, 
  ShieldAlert,
  Loader2,
  RefreshCw,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Clock,
  IdCard
} from 'lucide-react';

interface SurveyorAdminProfile {
  id: string; // The Firestore document ID (UID)
  name: string;
  email?: string;
  mobileNumber?: string;
  licenceNumber?: string;
  subscriptionStatus: 'active' | 'suspended' | 'expired';
  subscriptionExpiry: string;
  surveyorId: string;
  lastSync?: any;
  isAdmin?: boolean;
}

export function AdminDashboard() {
  const [surveyors, setSurveyors] = useState<SurveyorAdminProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // ─── Fetch All Profiles ─────────────────────────────────
  const fetchAllProfiles = async () => {
    setLoading(true);
    try {
      // Use collectionGroup to find all 'profile' sub-collections across all users
      const q = query(collectionGroup(db, 'profile'));
      const querySnapshot = await getDocs(q);
      
      const results: SurveyorAdminProfile[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        // The path is users/{uid}/profile/current
        // We can extract UID from the path if needed, but usually it's better to store it in the doc
        // For now, let's assume the parent doc ID is the UID
        const pathSegments = docSnap.ref.path.split('/');
        const uid = pathSegments[1]; // users is [0], uid is [1]

        results.push({
          id: uid,
          name: data.name || 'Unknown',
          email: data.email || 'N/A',
          mobileNumber: data.mobileNumber || 'N/A',
          licenceNumber: data.licenceNumber || 'N/A',
          subscriptionStatus: data.subscriptionStatus || 'active',
          subscriptionExpiry: data.subscriptionExpiry || '',
          surveyorId: data.surveyorId || '',
          lastSync: data.lastSync,
          isAdmin: data.isAdmin || false,
        });
      });
      
      setSurveyors(results);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllProfiles();
  }, []);

  // ─── Update Subscription ───────────────────────────────
  const handleUpdateStatus = async (uid: string, status: 'active' | 'suspended' | 'expired') => {
    setUpdatingId(uid);
    try {
      const profileRef = doc(db, 'users', uid, 'profile', 'current');
      await updateDoc(profileRef, {
        subscriptionStatus: status,
        updatedAt: Timestamp.now()
      });
      
      // Update local state
      setSurveyors(prev => prev.map(s => s.id === uid ? { ...s, subscriptionStatus: status } : s));
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update status. Check console.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUpdateExpiry = async (uid: string, date: string) => {
    setUpdatingId(uid);
    try {
      const profileRef = doc(db, 'users', uid, 'profile', 'current');
      await updateDoc(profileRef, {
        subscriptionExpiry: date,
        updatedAt: Timestamp.now()
      });
      
      // Update local state
      setSurveyors(prev => prev.map(s => s.id === uid ? { ...s, subscriptionExpiry: date } : s));
    } catch (error) {
      console.error('Failed to update expiry:', error);
      alert('Failed to update expiry. Check console.');
    } finally {
      setUpdatingId(null);
    }
  };
  
  const handleUpdateId = async (uid: string, idStr: string) => {
    setUpdatingId(uid);
    try {
      const profileRef = doc(db, 'users', uid, 'profile', 'current');
      await updateDoc(profileRef, {
        surveyorId: idStr,
        updatedAt: Timestamp.now()
      });
      
      setSurveyors(prev => prev.map(s => s.id === uid ? { ...s, surveyorId: idStr } : s));
    } catch (error) {
      console.error('Failed to update ID:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  // ─── Filtering ──────────────────────────────────────────
  const filteredSurveyors = surveyors.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA]">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="px-8 py-8 border-b bg-white border-[#E2E6EA]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <ShieldCheck size={24} />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-[#0D1B2A]">Regulator Dashboard</h1>
            </div>
            <p className="text-sm font-medium text-[#8D99AE]">
              Manage all active surveyors and their digital profile vaults.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8D99AE]" size={16} />
              <input 
                type="text" 
                placeholder="Search by name or UID..."
                className="pl-10 pr-4 py-2.5 rounded-xl border border-[#E2E6EA] text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              onClick={fetchAllProfiles}
              className="p-2.5 rounded-xl border border-[#E2E6EA] text-[#0D1B2A] hover:bg-[#F8F9FA] transition-all"
              title="Refresh Data"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto">
          
          {loading && surveyors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 size={40} className="animate-spin text-primary opacity-20 mb-4" />
              <p className="text-sm font-bold text-[#8D99AE]">Loading Surveyor Registry...</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E2E6EA] shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAFBFC] border-b border-[#E2E6EA]">
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">Surveyor / Digital ID</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">Platform ID</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">Licence</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">Subscription</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">Expiry Date</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F2F5]">
                  {filteredSurveyors.map((surveyor) => (
                    <tr key={surveyor.id} className="hover:bg-[#FAFBFC] transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#F0F2F5] flex items-center justify-center font-bold text-[#0D1B2A] text-lg">
                            {surveyor.name.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-[#0D1B2A] flex items-center gap-2">
                              {surveyor.name}
                              {surveyor.isAdmin && <ShieldCheck size={14} className="text-primary" />}
                            </div>
                            <div className="text-xs text-[#8D99AE] font-mono mt-0.5 flex items-center gap-1">
                              <IdCard size={10} /> {surveyor.id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <input 
                          type="text" 
                          placeholder="ASSIGN ID..."
                          className="bg-transparent border-b border-dashed border-[#E2E6EA] focus:border-primary focus:ring-0 text-sm p-0 w-24 font-black uppercase tracking-tight"
                          value={surveyor.surveyorId}
                          onChange={(e) => handleUpdateId(surveyor.id, e.target.value.toUpperCase())}
                          disabled={updatingId === surveyor.id}
                        />
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm font-medium text-[#0D1B2A]">{surveyor.licenceNumber}</div>
                        <div className="text-[10px] text-[#8D99AE]">{surveyor.mobileNumber}</div>
                      </td>
                      <td className="px-6 py-5">
                        <span 
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                            surveyor.subscriptionStatus === 'active' 
                              ? 'bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0]' 
                              : surveyor.subscriptionStatus === 'suspended'
                              ? 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]'
                              : 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]'
                          }`}
                        >
                          {surveyor.subscriptionStatus === 'active' ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                          {surveyor.subscriptionStatus}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-sm font-medium text-[#0D1B2A]">
                          <Calendar size={14} className="text-[#8D99AE]" />
                          <input 
                            type="date" 
                            className="bg-transparent border-none focus:ring-0 text-sm p-0 w-32 cursor-pointer"
                            value={surveyor.subscriptionExpiry}
                            onChange={(e) => handleUpdateExpiry(surveyor.id, e.target.value)}
                            disabled={updatingId === surveyor.id}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {surveyor.subscriptionStatus === 'suspended' ? (
                            <button 
                              onClick={() => handleUpdateStatus(surveyor.id, 'active')}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[#D1FAE5] text-[#065F46] hover:bg-[#A7F3D0] transition-all"
                            >
                              Activate
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleUpdateStatus(surveyor.id, 'suspended')}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FECACA] transition-all"
                            >
                              Suspend
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredSurveyors.length === 0 && (
                <div className="py-20 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#F8F9FA] flex items-center justify-center mx-auto mb-4">
                    <UserX size={32} className="text-[#8D99AE]" />
                  </div>
                  <h3 className="text-base font-bold text-[#0D1B2A]">No surveyors found</h3>
                  <p className="text-sm text-[#8D99AE] mt-1">Try adjusting your search criteria.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* ── Footer ──────────────────────────────────────── */}
      <div className="px-8 py-4 border-t bg-white border-[#E2E6EA] text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8D99AE]">
          SurveyOS Prime • Digital Profile Sync Registry • Administrative Access Only
        </p>
      </div>
    </div>
  );
}
