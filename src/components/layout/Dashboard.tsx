'use client';

import React, { useState } from 'react';
import dynamicImport from 'next/dynamic';
import { useUIStore } from '@/stores/ui-store';
import { useClaimStore } from '@/stores/claim-store';
import { getClaim, saveClaim, deleteClaim } from '@/lib/storage/indexeddb';
import { toggleFeePaid } from '@/lib/claims/fee-status';
import { toast } from 'sonner';
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
  User,
  Building2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

import { StageBadge } from '@/components/ui/StageBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { BankReconcileDialog } from '@/components/dialogs/BankReconcileDialog';
import { IRDAISummaryDialog } from '@/components/dialogs/IRDAISummaryDialog';
import { NewClaimDialog } from '@/components/dialogs/NewClaimDialog';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { Sidebar, MobileMenuButton } from '@/components/layout/sidebar';
import { FloatingReportPreview } from '@/components/layout/FloatingReportPreview';
import { ClaimHeader } from '@/components/layout/ClaimHeader';
import { useRouteSync } from '@/hooks/useRouteSync';
import { useAIConfig } from '@/hooks/useAIConfig';

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
const CloudVaultTab    = dynamicImport(() => import('@/components/tabs/CloudVaultTab').then(m    => ({ default: m.CloudVaultTab    })), { ssr: false });
const ReinspectionTab  = dynamicImport(() => import('@/components/tabs/ReinspectionTab').then(m  => ({ default: m.ReinspectionTab  })), { ssr: false });
const ValuationTab        = dynamicImport(() => import('@/components/tabs/ValuationTab').then(m        => ({ default: m.ValuationTab        })), { ssr: false });
const InsuredReportTab    = dynamicImport(() => import('@/components/tabs/InsuredReportTab').then(m    => ({ default: m.InsuredReportTab    })), { ssr: false });

// ─── Dashboard Tab Content ──────────────────────────────
export function DashboardContent() {
  const { setNewClaimDialogOpen, setClaimsListOpen } = useUIStore();
  const { claimsList } = useClaimStore();
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [showReconcile, setShowReconcile] = useState(false);
  const [showIRDAI, setShowIRDAI] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; vehicleNo: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; vehicleNo: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

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
    <div className="h-full overflow-y-auto bg-background text-foreground">
      {/* ── Hero Banner ─────────────────────────────────── */}
      <div className="px-8 py-10 lg:px-14 lg:py-14 bg-[var(--color-neutral-900)] text-white">
        <div className="max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-medium uppercase tracking-[0.2em] mb-6 bg-primary/15 text-primary border border-primary/30">
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            AI-powered · Cloud-native · IRDAI compliant
          </div>

          <h1 className="text-3xl lg:text-5xl font-medium tracking-tight mb-3 text-white">
            Motor SurveyOS{' '}
            <span className="px-3 py-1 rounded-lg bg-primary text-[var(--color-neutral-900)] inline-block">
              Prime
            </span>
          </h1>
          <p className="text-base lg:text-lg font-medium mb-8 text-white/70">
            Motor Insurance Survey Platform for Independent Loss Adjusters
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setNewClaimDialogOpen(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all bg-primary text-[var(--color-neutral-900)] hover:bg-primary/90"
            >
              <Plus size={16} />
              New claim
            </button>
            <button
              onClick={() => setClaimsListOpen(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all bg-white/10 text-white border border-white/15 hover:bg-white/20"
            >
              <FolderOpen size={16} />
              Open saved
            </button>
          </div>
        </div>
      </div>

      {/* ── Content Area ────────────────────────────────── */}
      <div className="px-6 lg:px-14 py-10 max-w-6xl mx-auto space-y-10">

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Claims Today', value: String(claimsToday), icon: <LayoutDashboard size={16} /> },
            { label: 'This Week', value: String(claimsWeek), icon: <TrendingUp size={16} /> },
            { label: 'Pending', value: String(claimsPending), icon: <Clock size={16} /> },
            { label: 'Total Claims', value: String(claimsList.length), icon: <FileCheck size={16} /> },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-5 rounded-2xl relative overflow-hidden bg-card border border-border shadow-sm"
            >
              <div className="absolute top-0 left-0 w-full h-[3px] rounded-t-2xl bg-primary" />
              <div className="flex items-center gap-2 mb-3 mt-1">
                <span className="text-[var(--color-neutral-400)]">{stat.icon}</span>
                <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                  {stat.label}
                </span>
              </div>
              <div className="text-3xl font-medium tracking-tight text-foreground">
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Fees Overview */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Fees overview
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowIRDAI(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all bg-[var(--color-status-success-tint)] text-[var(--color-status-success)] border border-[var(--color-status-success)]/30 hover:opacity-90"
              >
                Export annual summary
              </button>
              <button
                onClick={() => setShowReconcile(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all bg-[var(--color-status-warning-tint)] text-[var(--color-status-warning)] border border-[var(--color-status-warning)]/30 hover:opacity-90"
              >
                Reconcile bank statement
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: 'Total Billed',
                value: feesBilled > 0 ? `₹${feesBilled.toLocaleString('en-IN')}` : '—',
                bgClass: 'bg-[var(--color-neutral-600)]', textClass: 'text-[var(--color-neutral-900)]',
                desc: 'across active claims',
              },
              {
                label: 'Fees Received',
                value: feesReceived > 0 ? `₹${feesReceived.toLocaleString('en-IN')}` : '—',
                bgClass: 'bg-[var(--color-status-success)]', textClass: 'text-[var(--color-status-success)]',
                desc: `${activeClaims.filter(c => c.feePaid).length} claim(s) paid`,
              },
              {
                label: 'Outstanding',
                value: feesOutstanding > 0 ? `₹${feesOutstanding.toLocaleString('en-IN')}` : '—',
                bgClass: 'bg-[var(--color-status-danger)]', textClass: 'text-[var(--color-status-danger)]',
                desc: `${activeClaims.filter(c => !c.feePaid && c.feeTotal > 0).length} claim(s) unpaid`,
              },
            ].map((card) => (
              <div
                key={card.label}
                className="p-5 rounded-2xl relative overflow-hidden bg-card border border-border shadow-sm"
              >
                <div className={`absolute top-0 left-0 w-full h-[3px] rounded-t-2xl ${card.bgClass}`} />
                <div className="text-[10px] font-medium uppercase tracking-[0.15em] mb-2 mt-1 text-muted-foreground">
                  {card.label}
                </div>
                <div className={`text-2xl font-medium tracking-tight mb-1 ${card.textClass}`}>
                  {card.value}
                </div>
                <div className="text-[10px] text-muted-foreground">{card.desc}</div>
              </div>
            ))}
          </div>
        </div>


        {/* Recent Claims Table */}
        <div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-4">
            <div className="flex items-center space-x-4">
              <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-neutral-400)]">
                {showArchived ? 'Archived claims' : 'Recent claims'}
              </h2>
              <div className="flex space-x-1 bg-[var(--color-neutral-100)]" style={{ padding: '2px', borderRadius: '8px' }}>
                <button
                  className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all ${
                    !showArchived ? 'bg-card text-[var(--color-neutral-900)] shadow-sm' : 'text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-900)]'
                  }`}
                  onClick={() => setShowArchived(false)}
                >
                  Active
                </button>
                <button
                  className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all flex items-center gap-1.5 ${
                    showArchived ? 'bg-card text-[var(--color-neutral-900)] shadow-sm' : 'text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-900)]'
                  }`}
                  onClick={() => setShowArchived(true)}
                >
                  Archived
                  {archivedCount > 0 && (
                    <span
                      className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                        showArchived
                          ? 'bg-[var(--color-neutral-200)] text-[var(--color-neutral-900)]'
                          : 'bg-[var(--color-status-danger-tint)] text-[var(--color-status-danger)]'
                      }`}
                    >
                      {archivedCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-neutral-400)]" />
                <input
                  type="text"
                  placeholder="Search by Report No, Vehicle, Insured..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 bg-card border border-border text-[var(--color-neutral-900)]"
                />
              </div>
              <button
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all bg-card border border-border text-[var(--color-neutral-600)]"
                title={`Sort by Date: ${sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}`}
              >
                <ArrowUpDown size={14} />
                <span className="hidden sm:inline">Sort {sortOrder === 'desc' ? '(New)' : '(Old)'}</span>
              </button>
              <span className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg flex-shrink-0 bg-[var(--color-neutral-900)] text-primary">
                {displayClaims.length} total
              </span>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden bg-card border border-border shadow-sm">
            {displayClaims.length === 0 ? (
              <div className="p-16 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 bg-[var(--color-neutral-100)]">
                  <FileCheck size={28} className="text-[var(--color-neutral-400)]" />
                </div>
                <div className="text-base font-medium mb-1 text-[var(--color-neutral-900)]">No claims yet</div>
                <div className="text-sm text-[var(--color-neutral-400)]">
                  Click &ldquo;New Claim&rdquo; to start your first digital survey.
                </div>
                <button
                  onClick={() => setNewClaimDialogOpen(true)}
                  className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-[var(--color-neutral-900)] text-primary"
                >
                  <Plus size={14} />
                  New claim
                </button>
              </div>
            ) : (
              <div>
                <div className="px-6 py-3 grid grid-cols-[1.5fr_1fr_2fr_100px_100px_120px_60px] gap-4 text-[10px] font-medium uppercase tracking-[0.15em] items-center border-b border-border text-[var(--color-neutral-400)] bg-[var(--color-neutral-50)]">
                  <span>Report No.</span>
                  <span>Stage</span>
                  <span>Vehicle & Parties</span>
                  <span>Status</span>
                  <span>Fee</span>
                  <span>Date</span>
                  <span className="text-right">Action</span>
                </div>
                <div className="divide-y divide-[var(--color-neutral-100)]">
                  {displayClaims.slice(0, 50).map((claim) => (
                    <div
                      key={claim.id}
                      onClick={async () => {
                        // Set ID synchronously so Effect 2 in useRouteSync sees
                        // the correct currentClaimId before the async gap below.
                        useUIStore.getState().setCurrentClaimId(claim.id);
                        try {
                          const fullClaim = await getClaim(claim.id);
                          if (fullClaim) {
                            useClaimStore.getState().loadClaim(fullClaim);
                            useUIStore.getState().setActiveTab('details');
                          } else {
                            useUIStore.getState().setCurrentClaimId(null);
                          }
                        } catch {
                          useUIStore.getState().setCurrentClaimId(null);
                        }
                      }}
                      className="px-6 py-4 grid grid-cols-[1.5fr_1fr_2fr_100px_100px_120px_60px] gap-4 items-center cursor-pointer border-b border-[var(--color-neutral-100)] transition-colors hover:bg-[var(--color-neutral-50)]"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-medium truncate text-[var(--color-neutral-900)]">
                          {claim.reportNo || 'Draft'}
                        </span>
                        {claim.gDriveFolderId && (
                          <span title="Synced to Google Drive">
                            <HardDrive size={11} className="text-[var(--color-status-success)] shrink-0" />
                          </span>
                        )}
                      </div>
                      <div>
                        <StageBadge stage={claim.stage} />
                      </div>
                      <div className="flex flex-col truncate">
                        <span className="text-sm font-medium uppercase text-[var(--color-neutral-900)]">{claim.vehicleNo || 'Unknown'}</span>
                        <div className="flex gap-2 text-[10px] text-muted-foreground truncate opacity-80 mt-0.5">
                          {claim.insuredName && <span className="inline-flex items-center gap-1 truncate" title={`Insured: ${claim.insuredName}`}><User size={10} /> {claim.insuredName}</span>}
                          {claim.insurerName && <span className="inline-flex items-center gap-1 truncate" title={`Insurer: ${claim.insurerName}`}><Building2 size={10} /> {claim.insurerName}</span>}
                          {!claim.insuredName && !claim.insurerName && <span>No Party Details</span>}
                        </div>
                      </div>
                      <div>
                        <StatusBadge tone={!claim.isActive ? 'danger' : claim.isCompleted ? 'success' : 'warning'}>
                          {!claim.isActive ? 'Archived' : claim.isCompleted ? 'Done' : 'Active'}
                        </StatusBadge>
                      </div>
                      <div>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const fullClaim = await getClaim(claim.id);
                            if (!fullClaim) return;
                            await saveClaim(toggleFeePaid(fullClaim));
                            const channel = new BroadcastChannel('surveyos_claims_sync');
                            channel.postMessage('CLAIMS_UPDATED');
                            channel.close();
                          }}
                          title={claim.feePaid ? 'Mark fee unpaid' : 'Mark fee paid'}
                          className="text-xs rounded-md border px-2 py-0.5 transition-colors"
                          style={
                            claim.feePaid
                              ? { borderColor: 'var(--color-status-success)', color: 'var(--color-status-success)' }
                              : { borderColor: 'var(--color-status-danger)', color: 'var(--color-status-danger)' }
                          }
                        >
                          {claim.feePaid ? 'Paid' : 'Unpaid'}
                        </button>
                      </div>
                      <div className="text-xs font-medium text-[var(--color-neutral-400)]">
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
                              const channel = new BroadcastChannel('surveyos_claims_sync');
                              channel.postMessage('CLAIMS_UPDATED');
                              channel.close();
                            }
                          }}
                          className={`p-1.5 rounded-lg transition-colors ${claim.isCompleted ? 'bg-[var(--color-status-success-tint)] text-[var(--color-status-success)]' : 'text-[var(--color-neutral-400)] hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-status-success)]'}`}
                          title={claim.isCompleted ? "Mark Incomplete" : "Mark Completed"}
                        >
                          <CheckCircle size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (claim.isActive) {
                              if (!claim.isCompleted) return;
                              setArchiveTarget({ id: claim.id, vehicleNo: claim.vehicleNo || 'Unknown' });
                            } else {
                              // Restore doesn't need confirmation
                              (async () => {
                                const fullClaim = await getClaim(claim.id);
                                if (fullClaim) {
                                  await saveClaim({ ...fullClaim, isActive: true });
                                  const channel = new BroadcastChannel('surveyos_claims_sync');
                                  channel.postMessage('CLAIMS_UPDATED');
                                  channel.close();
                                  toast.success('Claim restored');
                                }
                              })();
                            }
                          }}
                          className={`p-1.5 rounded-lg transition-colors ${
                            claim.isActive && !claim.isCompleted
                              ? 'text-[var(--color-neutral-200)] cursor-not-allowed'
                              : 'text-[var(--color-neutral-400)] hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-neutral-600)]'
                          }`}
                          title={
                            claim.isActive
                              ? claim.isCompleted
                                ? "Archive Claim"
                                : "Complete all sections before archiving"
                              : "Restore Claim"
                          }
                        >
                          {claim.isActive ? <Archive size={16} /> : <ArchiveRestore size={16} />}
                        </button>
                        {/* Delete button — only on archived claims */}
                        {!claim.isActive && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({ id: claim.id, vehicleNo: claim.vehicleNo || 'Unknown' });
                              setDeleteConfirmText('');
                            }}
                            className="p-1.5 rounded-lg transition-colors text-[var(--color-neutral-400)] hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-status-danger)]"
                            title="Delete Permanently"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
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

      {/* Archive Confirmation Dialog */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setArchiveTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-status-warning-tint)] flex items-center justify-center">
                <AlertTriangle size={20} className="text-[var(--color-status-warning)]" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-[var(--color-neutral-900)]">Archive this claim?</h3>
                <p className="text-xs text-[var(--color-neutral-400)] mt-0.5">{archiveTarget.vehicleNo}</p>
              </div>
            </div>
            <p className="text-xs text-[var(--color-neutral-600)] mb-5 leading-relaxed">
              Photos will be removed from local storage to free space.
              {useUIStore.getState().isDriveConnected
                ? ' They are safely backed up on Google Drive.'
                : ' ⚠️ Google Drive is not connected — photos not backed up.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setArchiveTarget(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const fullClaim = await getClaim(archiveTarget.id);
                  if (fullClaim) {
                    await saveClaim({ ...fullClaim, isActive: false, photos: [] });
                    const docTypes = ['rc','dl','policy','fitness','permit','fir','claim','estimate','final-bill','photos'];
                    docTypes.forEach(t => sessionStorage.removeItem(`evidence_${fullClaim.id}_${t}`));
                    const channel = new BroadcastChannel('surveyos_claims_sync');
                    channel.postMessage('CLAIMS_UPDATED');
                    channel.close();
                    toast.success('Claim archived');
                  }
                  setArchiveTarget(null);
                }}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-[var(--color-status-warning)] text-white hover:opacity-90 transition-colors"
              >
                Archive claim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog — Double confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-status-danger-tint)] flex items-center justify-center">
                <Trash2 size={20} className="text-[var(--color-status-danger)]" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-[var(--color-neutral-900)]">Permanently delete this claim?</h3>
                <p className="text-xs text-[var(--color-neutral-400)] mt-0.5">{deleteTarget.vehicleNo}</p>
              </div>
            </div>
            <p className="text-xs text-[var(--color-neutral-600)] mb-4 leading-relaxed">
              This action <strong>cannot be undone</strong>. The claim and all associated data will be permanently removed from local storage and cloud.
            </p>
            <div className="mb-5">
              <label className="text-[10px] font-medium uppercase tracking-widest text-[var(--color-neutral-400)] mb-1.5 block">
                Type the vehicle number to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder={deleteTarget.vehicleNo}
                className="w-full px-3 py-2.5 rounded-lg text-sm font-medium border border-border focus:outline-none focus:ring-2 focus:ring-[var(--color-status-danger)]/30 focus:border-[var(--color-status-danger)]"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)] transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={deleteConfirmText.trim().toLowerCase() !== deleteTarget.vehicleNo.trim().toLowerCase()}
                onClick={async () => {
                  await deleteClaim(deleteTarget.id);
                  const channel = new BroadcastChannel('surveyos_claims_sync');
                  channel.postMessage('CLAIMS_UPDATED');
                  channel.close();
                  toast.success('Claim permanently deleted');
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-[var(--color-status-danger)] text-white hover:opacity-90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Delete forever
              </button>
            </div>
          </div>
        </div>
      )}
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
  if (tab === 'reports')         return <ReportTab />;
  if (tab === 'insured-report')  return <InsuredReportTab />;
  if (tab === 'bill-check')      return <BillCheckTab />;
  if (tab === 'fees')        return <FeesTab />;
  if (tab === 'profile')     return <ProfileTab />;
  if (tab === 'admin')       return <AdminDashboard />;
  if (tab === 'cloud-vault')  return <CloudVaultTab />;
  if (tab === 'reinspection') return <ReinspectionTab />;
  if (tab === 'valuation')   return <ValuationTab />;

  // Genuinely unimplemented
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 mx-auto bg-[var(--color-neutral-100)]">
          <Zap size={24} className="text-[var(--color-neutral-400)]" />
        </div>
        <div className="text-base font-medium capitalize text-[var(--color-neutral-900)]">{tab}</div>
        <div className="text-sm mt-1 text-[var(--color-neutral-400)]">Coming soon</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { activeTab } = useUIStore();
  useRouteSync();
  useAIConfig();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <MobileMenuButton />

      <main className="flex-1 overflow-y-auto bg-background">
        <ClaimHeader />
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
