'use client';
import dynamicImport from 'next/dynamic';

import { Sidebar, MobileMenuButton } from '@/components/layout/sidebar';
import { useUIStore } from '@/stores/ui-store';
import { useClaimStore } from '@/stores/claim-store';
import {
  LayoutDashboard,
  Plus,
  Clock,
  TrendingUp,
  FileCheck,
  Zap,
  FolderOpen,
} from 'lucide-react';

// ─── Dashboard Tab Content ──────────────────────────────
function DashboardContent() {
  const { setNewClaimDialogOpen, setClaimsListOpen } = useUIStore();
  const { claimsList } = useClaimStore();

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
            { label: 'Claims Today', value: '0', icon: <LayoutDashboard size={16} />, accent: '#D4AF37' },
            { label: 'This Week', value: '0', icon: <TrendingUp size={16} />, accent: '#22c55e' },
            { label: 'Pending', value: '0', icon: <Clock size={16} />, accent: '#f59e0b' },
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
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: '#8D99AE' }}>
              Recent Claims
            </h2>
            <span
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
              style={{ background: '#0D1B2A', color: '#D4AF37' }}
            >
              {claimsList.length} total
            </span>
          </div>

          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: '#FFFFFF', border: '1px solid #E2E6EA', boxShadow: '0 1px 3px rgba(13,27,42,0.04)' }}
          >
            {claimsList.length === 0 ? (
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
                  className="px-6 py-3 grid grid-cols-[1fr_120px_120px] gap-4 text-[10px] font-black uppercase tracking-[0.15em]"
                  style={{ borderBottom: '1px solid #E2E6EA', color: '#8D99AE', background: '#FAFAFA' }}
                >
                  <span>Claim</span>
                  <span>Type</span>
                  <span>Date</span>
                </div>
                <div>
                  {claimsList.slice(0, 10).map((claim) => (
                    <div
                      key={claim.id}
                      className="px-6 py-4 grid grid-cols-[1fr_120px_120px] gap-4 items-center cursor-pointer transition-all"
                      style={{ borderBottom: '1px solid #F0F2F5' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div className="text-sm font-bold truncate" style={{ color: '#0D1B2A' }}>
                        {claim.label || 'Untitled Claim'}
                      </div>
                      <div>
                        <span
                          className="text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider"
                          style={
                            claim.surveyType === 'spot'
                              ? { background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }
                              : claim.surveyType === 'final'
                              ? { background: '#D1FAE5', color: '#065F46', border: '1px solid #A7F3D0' }
                              : { background: '#E8ECF0', color: '#4A4E69', border: '1px solid #D1D5DB' }
                          }
                        >
                          {claim.surveyType}
                        </span>
                      </div>
                      <div className="text-xs font-medium" style={{ color: '#8D99AE' }}>
                        {new Date(claim.updatedAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


import { NewClaimDialog } from '@/components/dialogs/NewClaimDialog';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';

// Dynamically import ALL tabs with ssr:false — they all use browser-only APIs:
// - DetailsTab: pdfjs-dist (DOMMatrix), IndexedDB
// - PhotosTab: @react-pdf/renderer
// - ReportTab: @react-pdf/renderer, docx, file-saver
const DetailsTab    = dynamicImport(() => import('@/components/tabs/DetailsTab').then(m    => ({ default: m.DetailsTab    })), { ssr: false });
const AssessmentTab = dynamicImport(() => import('@/components/tabs/AssessmentTab').then(m => ({ default: m.AssessmentTab })), { ssr: false });
const SpotTab       = dynamicImport(() => import('@/components/tabs/SpotTab').then(m       => ({ default: m.SpotTab       })), { ssr: false });
const PhotosTab     = dynamicImport(() => import('@/components/tabs/PhotosTab').then(m     => ({ default: m.PhotosTab     })), { ssr: false });
const ReportTab     = dynamicImport(() => import('@/components/tabs/ReportTab').then(m     => ({ default: m.ReportTab     })), { ssr: false });
const DocumentsTab  = dynamicImport(() => import('@/components/tabs/DocumentsTab').then(m  => ({ default: m.DocumentsTab  })), { ssr: false });
const ReviewTab     = dynamicImport(() => import('@/components/tabs/ReviewTab').then(m     => ({ default: m.ReviewTab     })), { ssr: false });
const BillCheckTab  = dynamicImport(() => import('@/components/tabs/BillCheckTab').then(m  => ({ default: m.BillCheckTab  })), { ssr: false });
const FeesTab       = dynamicImport(() => import('@/components/tabs/FeesTab').then(m       => ({ default: m.FeesTab       })), { ssr: false });
const ProfileTab    = dynamicImport(() => import('@/components/tabs/ProfileTab').then(m    => ({ default: m.ProfileTab    })), { ssr: false });
const AdminDashboard = dynamicImport(() => import('@/components/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })), { ssr: false });
const CloudVaultTab = dynamicImport(() => import('@/components/tabs/CloudVaultTab').then(m => ({ default: m.CloudVaultTab })), { ssr: false });

// ─── Tab Router ──────────────────────────────────────────
function TabPlaceholder({ tab }: { tab: string }) {
  if (tab === 'documents')   return <DocumentsTab />;
  if (tab === 'review')      return <ReviewTab />;
  if (tab === 'details')     return <DetailsTab />;
  if (tab === 'assessment')  return <AssessmentTab />;
  if (tab === 'spot')        return <SpotTab />;
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

// ─── Main Page ──────────────────────────────────────────
export default function Home() {
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
    </div>
  );
}
