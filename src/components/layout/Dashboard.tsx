'use client';

import React, { useState } from 'react';
import dynamicImport from 'next/dynamic';
import { useUIStore } from '@/stores/ui-store';
import { useClaimStore } from '@/stores/claim-store';
import { getClaim, saveClaim } from '@/lib/storage/indexeddb';
import {
  LayoutDashboard,
  Plus,
  Clock,
  TrendingUp,
  FileCheck,
  Zap,
  FolderOpen,
  Archive,
  ArchiveRestore,
  Search,
  ArrowUpDown,
  CheckCircle,
  HardDrive,
} from 'lucide-react';

import { BankReconcileDialog } from '@/components/dialogs/BankReconcileDialog';
import { IRDAISummaryDialog } from '@/components/dialogs/IRDAISummaryDialog';
import { NewClaimDialog } from '@/components/dialogs/NewClaimDialog';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { Sidebar, MobileMenuButton } from '@/components/layout/sidebar';
import { FloatingReportPreview } from '@/components/layout/FloatingReportPreview';

// Dynamically import ALL tabs with ssr:false — they all use browser-only APIs:
const DetailsTab    = dynamicImport(() => import('@/components/tabs/DetailsTab').then(m    => ({ default: m.DetailsTab    })), { ssr: false });
const AssessmentTab = dynamicImport(() => import('@/components/tabs/AssessmentTab').then(m => ({ default: m.AssessmentTab })), { ssr: false });
const PhotosTab     = dynamicImport(() => import('@/components/tabs/PhotosTab').then(m     => ({ default: m.PhotosTab     })), { ssr: false });
const ReportTab     = dynamicImport(() => import('@/components/tabs/ReportTab').then(m     => ({ default: m.ReportTab     })), { ssr: false });
const DocumentsTab  = dynamicImport(() => import('@/components/tabs/DocumentsTab').then(m  => ({ default: m.DocumentsTab  })), { ssr: false });
const ReviewTab     = dynamicImport(() => import('@/components/tabs/ReviewTab').then(m     => ({ default: m.ReviewTab     })), { ssr: false });
const BillCheckTab  = dynamicImport(() => import('@/components/tabs/BillCheckTab').then(m  => ({ default: m.BillCheckTab  })), { ssr: false });
const FeesTab       = dynamicImport(() => import('@/components/tabs/FeesTab').then(m       => ({ default: m.FeesTab       })), { ssr: false });
const ProfileTab    = dynamicImport(() => import('@/components/tabs/ProfileTab').then(m    => ({ default: m.ProfileTab    })), { ssr: false });
const AdminDashboard = dynamicImport(() => import('@/components/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })), { ssr: false });
const CloudVaultTab = dynamicImport(() => import('@/components/tabs/CloudVaultTab').then(m => ({ default: m.CloudVaultTab })), { ssr: false });

// ─── Dashboard Tab Content ──────────────────────────────
export function DashboardContent() {
  const { setNewClaimDialogOpen, setClaimsListOpen } = useUIStore();
  const { claimsList } = useClaimStore();
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [showReconcile, setShowReconcile] = useState(false);
  const [showIRDAI, setShowIRDAI] = useState(false);

  const activeClaims = claimsList.filter(c => c.isActive);
  const today = new Date().toDateString();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const claimsToday = activeClaims.filter(c => new Date(c.updatedAt).toDateString() === today).length;
  const claimsWeek = activeClaims.filter(c => new Date(c.updatedAt).getTime() >= weekAgo).length;
  const claimsPending = activeClaims.filter(c => !c.isCompleted).length;
  const archivedCount = claimsList.filter(c => !c.isActive).length;

  const feesBilled = activeClaims.reduce((sum, c) => sum + (c.feeTotal || 0), 0);
  const feesReceived = activeClaims.filter(c => c.feePaid).reduce((sum, c) => sum + (c.feeTotal || 0), 0);
  const feesOutstanding = activeClaims.filter(c => !c.feePaid && c.feeTotal > 0).reduce((sum, c) => sum + (c.feeTotal || 0), 0);

  const filteredClaims = claimsList.filter(c => {
    // Stage 1: Active/Archived
    if (showArchived ? c.isActive : !c.isActive) return false;
    
    // Stage 2: Text Search
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.reportNo || '').toLowerCase().includes(q) ||
      (c.vehicleNo || '').toLowerCase().includes(q) ||
      (c.insurerName || '').toLowerCase().includes(q) ||
      (c.insuredName || '').toLowerCase().includes(q)
    );
  });

  const displayClaims = filteredClaims.sort((a, b) => {
    const timeA = new Date(a.updatedAt).getTime();
    const timeB = new Date(b.updatedAt).getTime();
    return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });

  return (
    <div className="h-full overflow-y-auto" style={{ background: '#F8F9FA' }}>
      {/* ── Hero Banner ─────────────────────────────────── */}
      <div
        className="relative overflow-hidden px-8 py-10 lg:px-14 lg:py-14"
        style={{
          background: 'linear-gradient(135deg, #0D1B2A 0%, #1e3a5f 55%, #0D1B2A 100%)',
        }}
      >
        {/* Decorative gold orb */}
        <div
          className="absolute -top-16 -right-16 w-72 h-72 rounded-full opacity-10 blur-3xl"
          style={{ background: '#D4AF37' }}
        />
        <div
          className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full opacity-5 blur-2xl"
          style={{ background: '#D4AF37' }}
        />

        <div className="relative max-w-4xl mx-auto">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] mb-6"
            style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            AI-Powered · Offline-First · IRDAI Compliant
          </div>

          <h1 className="text-3xl lg:text-5xl font-black tracking-tight mb-3" style={{ color: '#F8F9FA', letterSpacing: '-0.02em' }}>
            SurveyOS{' '}
            <span
              className="px-3 py-1 rounded-lg"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #f0d870)', color: '#0D1B2A', display: 'inline-block' }}
            >
              Prime V2
            </span>
          </h1>
          <p className="text-base lg:text-lg font-medium mb-8" style={{ color: 'rgba(232,236,240,0.7)' }}>
            Motor Insurance Survey Platform for Independent Loss Adjusters
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setNewClaimDialogOpen(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all"
              style={{
                background: 'linear-gradient(135deg, #D4AF37 0%, #f0d870 100%)',
                color: '#0D1B2A',
                boxShadow: '0 4px 20px rgba(212,175,55,0.4)',
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 6px 28px rgba(212,175,55,0.6)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(212,175,55,0.4)')}
            >
              <Plus size={16} />
              New Claim
            </button>
            <button
              onClick={() => setClaimsListOpen(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all"
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: '#F8F9FA',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            >
              <FolderOpen size={16} />
              Open Saved
            </button>
          </div>
        </div>
      </div>

      {/* ── Content Area ────────────────────────────────── */}
      <div className="px-6 lg:px-14 py-10 max-w-6xl mx-auto space-y-10">

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Claims Today', value: String(claimsToday), icon: <LayoutDashboard size={16} />, accent: '#D4AF37' },
            { label: 'This Week', value: String(claimsWeek), icon: <TrendingUp size={16} />, accent: '#22c55e' },
            { label: 'Pending', value: String(claimsPending), icon: <Clock size={16} />, accent: '#f59e0b' },
            { label: 'Total Claims', value: String(claimsList.length), icon: <FileCheck size={16} />, accent: '#0D1B2A' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-5 rounded-2xl relative overflow-hidden"
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E6EA',
                boxShadow: '0 1px 3px rgba(13,27,42,0.04)',
              }}
            >
              <div
                className="absolute top-0 left-0 w-full h-[3px] rounded-t-2xl"
                style={{ background: stat.accent }}
              />
              <div className="flex items-center gap-2 mb-3 mt-1">
                <span style={{ color: stat.accent }}>{stat.icon}</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: '#8D99AE' }}>
                  {stat.label}
                </span>
              </div>
              <div className="text-3xl font-black tracking-tight" style={{ color: '#0D1B2A' }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Fees Overview */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: '#8D99AE' }}>
              Fees Overview
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowIRDAI(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={{ background: 'rgba(34,197,94,0.08)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.25)' }}
              >
                Export Annual Summary
              </button>
              <button
                onClick={() => setShowReconcile(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={{ background: 'rgba(212,175,55,0.1)', color: '#92400E', border: '1px solid rgba(212,175,55,0.3)' }}
              >
                Reconcile Bank Statement
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: 'Total Billed',
                value: feesBilled > 0 ? `₹${feesBilled.toLocaleString('en-IN')}` : '—',
                accent: '#4A4E69',
                desc: 'across active claims',
              },
              {
                label: 'Fees Received',
                value: feesReceived > 0 ? `₹${feesReceived.toLocaleString('en-IN')}` : '—',
                accent: '#10B981',
                desc: `${activeClaims.filter(c => c.feePaid).length} claim(s) paid`,
              },
              {
                label: 'Outstanding',
                value: feesOutstanding > 0 ? `₹${feesOutstanding.toLocaleString('en-IN')}` : '—',
                accent: '#EF4444',
                desc: `${activeClaims.filter(c => !c.feePaid && c.feeTotal > 0).length} claim(s) unpaid`,
              },
            ].map((card) => (
              <div
                key={card.label}
                className="p-5 rounded-2xl relative overflow-hidden"
                style={{ background: '#FFFFFF', border: '1px solid #E2E6EA', boxShadow: '0 1px 3px rgba(13,27,42,0.04)' }}
              >
                <div className="absolute top-0 left-0 w-full h-[3px] rounded-t-2xl" style={{ background: card.accent }} />
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2 mt-1" style={{ color: '#8D99AE' }}>
                  {card.label}
                </div>
                <div className="text-2xl font-black tracking-tight mb-1" style={{ color: card.accent }}>
                  {card.value}
                </div>
                <div className="text-[10px]" style={{ color: '#8D99AE' }}>{card.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: '#8D99AE' }}>
              Quick Actions
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: 'New Claim',
                desc: 'Start a comprehensive survey',
                icon: <Plus size={20} />,
                accent: '#D4AF37',
                bg: 'rgba(212,175,55,0.08)',
                onClick: () => setNewClaimDialogOpen(true),
              },
              {
                label: 'Open Claim',
                desc: `${claimsList.length} saved locally`,
                icon: <FileCheck size={20} />,
                accent: '#0D1B2A',
                bg: 'rgba(13,27,42,0.04)',
                onClick: () => setClaimsListOpen(true),
              },
              {
                label: 'AI Extract',
                desc: 'Upload & auto-scan documents',
                icon: <Zap size={20} />,
                accent: '#4A4E69',
                bg: 'rgba(74,78,105,0.06)',
                onClick: () => setNewClaimDialogOpen(true),
              },
            ].map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                className="group flex items-center gap-4 p-5 rounded-2xl text-left transition-all"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E6EA',
                  boxShadow: '0 1px 3px rgba(13,27,42,0.04)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(13,27,42,0.09)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderColor = action.accent;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(13,27,42,0.04)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = '#E2E6EA';
                }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                  style={{ background: action.bg, color: action.accent }}
                >
                  {action.icon}
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: '#0D1B2A' }}>{action.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#8D99AE' }}>{action.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Claims Table */}
        <div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-4">
            <div className="flex items-center space-x-4">
              <h2 className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: '#8D99AE' }}>
                {showArchived ? 'Archived Claims' : 'Recent Claims'}
              </h2>
              <div className="flex space-x-1" style={{ background: '#F0F2F5', padding: '2px', borderRadius: '8px' }}>
                <button
                  className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${
                    !showArchived ? 'bg-white text-[#0D1B2A] shadow-sm' : 'text-[#8D99AE] hover:text-[#0D1B2A]'
                  }`}
                  onClick={() => setShowArchived(false)}
                >
                  Active
                </button>
                <button
                  className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1.5 ${
                    showArchived ? 'bg-white text-[#0D1B2A] shadow-sm' : 'text-[#8D99AE] hover:text-[#0D1B2A]'
                  }`}
                  onClick={() => setShowArchived(true)}
                >
                  Archived
                  {archivedCount > 0 && (
                    <span
                      className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                      style={{ background: showArchived ? '#E2E6EA' : 'rgba(239,68,68,0.12)', color: showArchived ? '#0D1B2A' : '#EF4444' }}
                    >
                      {archivedCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by Report No, Vehicle, Insured..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl text-xs font-medium focus:outline-none focus:ring-2"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E6EA',
                    color: '#0D1B2A',
                  }}
                />
              </div>
              <button
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E6EA',
                  color: '#4A4E69',
                }}
                title={`Sort by Date: ${sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}`}
              >
                <ArrowUpDown size={14} />
                <span className="hidden sm:inline">Sort {sortOrder === 'desc' ? '(New)' : '(Old)'}</span>
              </button>
              <span
                className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg flex-shrink-0"
                style={{ background: '#0D1B2A', color: '#D4AF37' }}
              >
                {displayClaims.length} total
              </span>
            </div>
          </div>

          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: '#FFFFFF', border: '1px solid #E2E6EA', boxShadow: '0 1px 3px rgba(13,27,42,0.04)' }}
          >
            {displayClaims.length === 0 ? (
              <div className="p-16 text-center flex flex-col items-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: '#F0F2F5' }}
                >
                  <FileCheck size={28} style={{ color: '#8D99AE' }} />
                </div>
                <div className="text-base font-bold mb-1" style={{ color: '#0D1B2A' }}>No claims yet</div>
                <div className="text-sm" style={{ color: '#8D99AE' }}>
                  Click &ldquo;New Claim&rdquo; to start your first offline survey.
                </div>
                <button
                  onClick={() => setNewClaimDialogOpen(true)}
                  className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
                  style={{
                    background: '#0D1B2A',
                    color: '#D4AF37',
                  }}
                >
                  <Plus size={14} />
                  New Claim
                </button>
              </div>
            ) : (
              <div>
                <div
                  className="px-6 py-3 grid grid-cols-[1.5fr_1fr_2fr_100px_100px_120px_60px] gap-4 text-[10px] font-black uppercase tracking-[0.15em] items-center"
                  style={{ borderBottom: '1px solid #E2E6EA', color: '#8D99AE', background: '#FAFAFA' }}
                >
                  <span>Report No.</span>
                  <span>Stage</span>
                  <span>Vehicle & Parties</span>
                  <span>Status</span>
                  <span>Fee</span>
                  <span>Date</span>
                  <span className="text-right">Action</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {displayClaims.slice(0, 50).map((claim) => (
                    <div
                      key={claim.id}
                      onClick={async () => {
                        const fullClaim = await getClaim(claim.id);
                        if (fullClaim) {
                          useClaimStore.getState().loadClaim(fullClaim);
                          useUIStore.getState().setActiveTab('details');
                        }
                      }}
                      className="px-6 py-4 grid grid-cols-[1.5fr_1fr_2fr_100px_100px_120px_60px] gap-4 items-center cursor-pointer transition-all"
                      style={{ borderBottom: '1px solid #F0F2F5' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-bold truncate" style={{ color: '#0D1B2A' }}>
                          {claim.reportNo || 'Draft'}
                        </span>
                        {claim.gDriveFolderId && (
                          <span title="Synced to Google Drive">
                            <HardDrive size={11} style={{ color: '#16a34a', flexShrink: 0 }} />
                          </span>
                        )}
                      </div>
                      <div>
                        <span
                          className="text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider"
                          style={
                            claim.stage === 'spot'
                              ? { background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }
                              : claim.stage === 'final'
                              ? { background: '#D1FAE5', color: '#065F46', border: '1px solid #A7F3D0' }
                              : claim.stage === 'reinspection'
                              ? { background: '#E0E7FF', color: '#3730A3', border: '1px solid #C7D2FE' }
                              : { background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }
                          }
                        >
                          {claim.stage}
                        </span>
                      </div>
                      <div className="flex flex-col truncate">
                        <span className="text-sm font-bold uppercase" style={{ color: '#0D1B2A' }}>{claim.vehicleNo || 'Unknown'}</span>
                        <div className="flex gap-2 text-[10px] text-muted-foreground truncate opacity-80 mt-0.5">
                          {claim.insuredName && <span className="truncate" title={`Insured: ${claim.insuredName}`}>👤 {claim.insuredName}</span>}
                          {claim.insurerName && <span className="truncate" title={`Insurer: ${claim.insurerName}`}>🏛 {claim.insurerName}</span>}
                          {!claim.insuredName && !claim.insurerName && <span>No Party Details</span>}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase" style={claim.isActive ? (claim.isCompleted ? { borderColor: '#10B981', color: '#10B981' } : { borderColor: '#F59E0B', color: '#F59E0B' }) : { borderColor: '#EF4444', color: '#EF4444' }}>
                           {!claim.isActive ? 'Archived' : (claim.isCompleted ? 'Done' : 'Active')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase" style={claim.feePaid ? { borderColor: '#10B981', color: '#10B981' } : { borderColor: '#EF4444', color: '#EF4444' }}>
                          {claim.feePaid ? 'Paid' : 'Unpaid'}
                        </span>
                      </div>
                      <div className="text-xs font-medium" style={{ color: '#8D99AE' }}>
                        {new Date(claim.updatedAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const fullClaim = await getClaim(claim.id);
                            if (fullClaim) {
                              await saveClaim({ ...fullClaim, isCompleted: !fullClaim.isCompleted });
                              // We simulate an update to trigger useClaimsLoader Broadcast Channel since it's an indexeddb operation.
                              const channel = new BroadcastChannel('surveyos_claims_sync');
                              channel.postMessage('CLAIMS_UPDATED');
                              channel.close();
                            }
                          }}
                          className={`p-1.5 rounded-lg transition-colors ${claim.isCompleted ? 'bg-green-100 text-green-600' : 'text-gray-400 hover:bg-gray-100 hover:text-green-600'}`}
                          title={claim.isCompleted ? "Mark Incomplete" : "Mark Completed"}
                        >
                          <CheckCircle size={16} />
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const fullClaim = await getClaim(claim.id);
                            if (fullClaim) {
                              await saveClaim({ ...fullClaim, isActive: !fullClaim.isActive });
                              const channel = new BroadcastChannel('surveyos_claims_sync');
                              channel.postMessage('CLAIMS_UPDATED');
                              channel.close();
                            }
                          }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
                          title={claim.isActive ? "Archive Claim" : "Restore Claim"}
                        >
                          {claim.isActive ? <Archive size={16} /> : <ArchiveRestore size={16} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showReconcile && <BankReconcileDialog onClose={() => setShowReconcile(false)} />}
      {showIRDAI && <IRDAISummaryDialog onClose={() => setShowIRDAI(false)} />}
    </div>
  );
}

// ─── Tab Router ──────────────────────────────────────────
export function TabPlaceholder({ tab }: { tab: string }) {
  if (tab === 'documents')   return <DocumentsTab />;
  if (tab === 'review')      return <ReviewTab />;
  if (tab === 'details')     return <DetailsTab />;
  if (tab === 'assessment')  return <AssessmentTab />;
  if (tab === 'photos')      return <PhotosTab />;
  if (tab === 'reports')     return <ReportTab />;
  if (tab === 'bill-check')  return <BillCheckTab />;
  if (tab === 'fees')        return <FeesTab />;
  if (tab === 'profile')     return <ProfileTab />;
  if (tab === 'admin')       return <AdminDashboard />;
  if (tab === 'cloud-vault') return <CloudVaultTab />;

  // Genuinely unimplemented
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
      <div className="text-center">
        <div className="text-4xl mb-3 opacity-20" style={{ filter: 'grayscale(1)' }}>🔧</div>
        <div className="text-base font-bold capitalize" style={{ color: '#0D1B2A' }}>{tab}</div>
        <div className="text-sm mt-1" style={{ color: '#8D99AE' }}>Coming soon</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { activeTab } = useUIStore();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <MobileMenuButton />

      <main className="flex-1 overflow-y-auto bg-background">
        <ErrorBoundary key={activeTab}>
          {activeTab === 'dashboard' ? <DashboardContent /> : <TabPlaceholder tab={activeTab} />}
        </ErrorBoundary>
      </main>

      {/* Global Modals */}
      <NewClaimDialog />

      {/* Floating live report preview — visible on all tabs except Reports */}
      <FloatingReportPreview />
    </div>
  );
}
