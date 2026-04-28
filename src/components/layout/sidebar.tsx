'use client';

import { useUIStore, type AppTab } from '@/stores/ui-store';
import { useProfileStore } from '@/stores/profile-store';
import { useClaimStore } from '@/stores/claim-store';
import { getConflictFields } from '@/lib/ai/reconciliation';
import {
  LayoutDashboard,
  FileText,
  ScanSearch,
  ClipboardList,
  ClipboardCheck,
  Calculator,
  Printer,
  Camera,
  Receipt,
  RotateCcw,
  User,
  Brain,
  Plus,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Menu,
  Wifi,
  WifiOff,
  Cloud,
  LogIn,
  LogOut,
  Shield,
  ShieldCheck,
  Zap,
  CarFront,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { signInWithGoogle, signOutUser } from '@/lib/firebase/auth';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

interface NavItem {
  id: AppTab;
  label: string;
  icon: React.ReactNode;
  group: 'main' | 'claim' | 'output' | 'settings';
  requiresClaim?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={17} />, group: 'main' },
  { id: 'documents', label: 'Documents', icon: <FileText size={17} />, group: 'claim', requiresClaim: true },
  { id: 'review', label: 'AI Review', icon: <ScanSearch size={17} />, group: 'claim', requiresClaim: true },
  { id: 'details', label: 'Claim Details', icon: <ClipboardList size={17} />, group: 'claim', requiresClaim: true },
  { id: 'assessment', label: 'Assessment', icon: <Calculator size={17} />, group: 'claim', requiresClaim: true },
  { id: 'reports',      label: 'Report Center',   icon: <Printer size={17} />,    group: 'output',   requiresClaim: true },
  { id: 'bill-check',  label: 'Bill Check',     icon: <ClipboardCheck size={17} />, group: 'output', requiresClaim: true },
  { id: 'photos',      label: 'Photo Sheet',    icon: <Camera size={17} />,     group: 'output',   requiresClaim: true },
  { id: 'fees',        label: 'Survey Fees Bill', icon: <Receipt size={17} />,    group: 'output',   requiresClaim: true },
  { id: 'reinspection',label: 'Reinspection',  icon: <RotateCcw size={17} />,  group: 'output',   requiresClaim: true },
  { id: 'valuation',   label: 'Valuation',     icon: <CarFront size={17} />,   group: 'output',   requiresClaim: true },
  { id: 'profile', label: 'Profile', icon: <User size={17} />, group: 'settings' },
  { id: 'cloud-vault', label: 'Cloud Vault', icon: <Cloud size={17} />, group: 'settings' },
  { id: 'learning', label: 'Learning', icon: <Brain size={17} />, group: 'settings' },
  { id: 'admin', label: 'Admin Panel', icon: <ShieldCheck size={17} />, group: 'settings' },
  { id: 'landing' as AppTab, label: 'Feature Overview', icon: <Zap size={17} />, group: 'settings' },
];

const GROUP_LABELS: Record<string, string> = {
  main: '',
  claim: 'CLAIM WORKFLOW',
  output: 'OUTPUT',
  settings: 'SETTINGS',
};

export function Sidebar() {
  const [mounted, setMounted] = useState(false);
  const { activeTab, setActiveTab, sidebarCollapsed, toggleSidebar, isOnline, isDriveConnected, driveEmail } = useUIStore();
  const { setNewClaimDialogOpen, setClaimsListOpen } = useUIStore();
  const { getInitials, profile } = useProfileStore();
  const { currentClaim } = useClaimStore();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => { setMounted(true); }, []);

  const hasClaim = !!currentClaim;
  const groups = ['main', 'claim', 'output', 'settings'] as const;

  const handleTabChange = (targetTab: AppTab) => {
    // Landing page is a separate route
    if ((targetTab as string) === 'landing') {
      window.location.href = '/landing';
      return;
    }

    // Show a soft warning if navigating away with unresolved AI conflicts
    if (activeTab === 'documents' && currentClaim) {
      const conflicts = getConflictFields(currentClaim);
      if (conflicts.length > 0) {
        useUIStore.getState().setSidebarMobileOpen(false); // Close mobile menu if open
        toast.warning(`You have ${conflicts.length} unresolved AI data discrepancies that need attention.`);
        // Note: No return statement here, so it allows navigation (soft block)
      }
    }
    setActiveTab(targetTab);
  };

  return (
    <>
      {/* Mobile overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
        style={{ display: useUIStore.getState().sidebarMobileOpen ? 'block' : 'none' }}
        onClick={() => useUIStore.getState().setSidebarMobileOpen(false)}
      />

      <aside
        className={`
          fixed top-0 left-0 z-50 h-full flex flex-col
          transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? 'w-[64px]' : 'w-[258px]'}
          lg:relative
        `}
        style={{ background: '#FFFFFF', borderRight: '1px solid #E2E6EA' }}
      >
        {/* ─── Brand Header ──────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-4 py-5"
          style={{ borderBottom: '1px solid #F0F2F5' }}
        >
          {/* Logo mark */}
          <div
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm shadow-sm"
            style={{ background: 'linear-gradient(135deg, #0D1B2A, #1e3a5f)', color: '#D4AF37' }}
          >
            {isAuthenticated && user
              ? <img src={user.photoURL || ''} alt="" className="w-full h-full object-cover rounded-lg" />
              : <Shield size={16} />
            }
          </div>

          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-black tracking-tight" style={{ color: '#0D1B2A', letterSpacing: '-0.01em' }}>
                {isAuthenticated && user ? user.displayName : (profile.name || 'SurveyOS')}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#D4AF37', opacity: 0.9 }}>
                  {isAuthenticated && user ? 'Surveyor' : 'V2 · Executive'}
                </div>
                <span
                  className="text-[8px] font-black font-mono px-1 py-0.5 rounded"
                  style={{ background: 'rgba(13,27,42,0.06)', color: '#8D99AE', letterSpacing: '0.05em' }}
                  title="Deployed build version"
                >
                  v{process.env.NEXT_PUBLIC_APP_VERSION}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={toggleSidebar}
            className="hidden lg:flex items-center justify-center w-6 h-6 rounded-md transition-all"
            style={{ color: '#8D99AE' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#0D1B2A')}
            onMouseLeave={e => (e.currentTarget.style.color = '#8D99AE')}
          >
            {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* ─── Quick Actions ────────────────────────────── */}
        <div
          className={`flex gap-2 px-4 py-4 ${sidebarCollapsed ? 'flex-col items-center' : ''}`}
          style={{ borderBottom: '1px solid #F0F2F5' }}
        >
          <button
            onClick={() => setNewClaimDialogOpen(true)}
            title="New Claim"
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold flex-1 justify-center transition-all shadow-sm"
            style={{
              background: 'linear-gradient(135deg, #0D1B2A, #1e3a5f)',
              color: '#F8F9FA',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <Plus size={14} style={{ color: '#D4AF37' }} />
            {!sidebarCollapsed && 'New Claim'}
          </button>
          {!sidebarCollapsed && (
            <button
              onClick={() => setClaimsListOpen(true)}
              title="Open Claim"
              className="flex items-center justify-center w-9 h-9 rounded-lg transition-all"
              style={{ border: '1px solid #E2E6EA', color: '#8D99AE' }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#0D1B2A';
                e.currentTarget.style.color = '#0D1B2A';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#E2E6EA';
                e.currentTarget.style.color = '#8D99AE';
              }}
            >
              <FolderOpen size={16} />
            </button>
          )}
        </div>

        {/* ─── Active Claim Badge ───────────────────────── */}
        {hasClaim && !sidebarCollapsed && (
          <div
            className="mx-4 mt-4 px-4 py-3 rounded-lg relative overflow-hidden"
            style={{ background: 'rgba(13,27,42,0.03)', border: '1px solid #E2E6EA' }}
          >
            <div
              className="absolute top-0 left-0 w-[3px] h-full rounded-r-full"
              style={{ background: '#D4AF37' }}
            />
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] pl-1" style={{ color: '#8D99AE' }}>
              {currentClaim.surveyType} Survey
            </div>
            <div className="text-sm font-extrabold truncate mt-0.5 pl-1" style={{ color: '#0D1B2A' }}>
              {currentClaim.vehicle.registrationNumber || currentClaim.reportNo || 'New Claim'}
            </div>
          </div>
        )}

        {/* ─── Navigation ──────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
          {groups.map((group) => {
            const items = NAV_ITEMS.filter((item) => {
              if (item.group !== group) return false;
              
              // Workflow Logic: Restrict tabs based on Survey Type
              if (currentClaim?.surveyType === 'spot') {
                // Spot surveys never see assessment/billing/reinspection tabs
                const restrictedTabs: AppTab[] = ['assessment', 'bill-check', 'reinspection', 'valuation'];
                if (restrictedTabs.includes(item.id)) return false;
              }

              if (currentClaim?.surveyType === 'final') {
                if (item.id === 'valuation') return false;
              }

              if (currentClaim?.surveyType === 'valuation') {
                // Valuation report only needs: details, valuation, photos, fees, reports
                const restrictedTabs: AppTab[] = ['assessment', 'bill-check', 'reinspection', 'review', 'documents'];
                if (restrictedTabs.includes(item.id)) return false;
              }

              if (!currentClaim && item.id === 'valuation') return false;
              
              return true;
            });

            if (!items.length) return null;

            return (
              <div key={group}>
                {GROUP_LABELS[group] && !sidebarCollapsed && (
                  <div
                    className="px-3 pb-2 text-[9px] font-bold uppercase tracking-[0.25em]"
                    style={{ color: '#8D99AE', opacity: 0.6 }}
                  >
                    {GROUP_LABELS[group]}
                  </div>
                )}
                <div className="space-y-0.5">
                  {items.map((item) => {
                    // Hide admin tab from non-admins
                    // Master admin UID always gets access regardless of profile flag
                    const MASTER_ADMIN_UID = process.env.NEXT_PUBLIC_MASTER_ADMIN_UID;
                    const isAdminUser = profile.isAdmin || user?.uid === MASTER_ADMIN_UID;
                    if (item.id === 'admin' && !isAdminUser) return null;

                    const disabled = item.requiresClaim && !hasClaim;
                    const isActive = activeTab === item.id;

                    return (
                      <button
                        key={item.id}
                        onClick={() => !disabled && handleTabChange(item.id)}
                        disabled={disabled}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium relative transition-all ${sidebarCollapsed ? 'justify-center' : ''}`}
                        style={{
                          color: isActive
                            ? '#0D1B2A'
                            : disabled
                            ? '#E2E6EA'
                            : '#4A4E69',
                          background: isActive ? '#F0F2F5' : 'transparent',
                          cursor: disabled ? 'not-allowed' : 'pointer',
                        }}
                        onMouseEnter={e => {
                          if (!disabled && !isActive) {
                            e.currentTarget.style.background = '#F8F9FA';
                            e.currentTarget.style.color = '#0D1B2A';
                          }
                        }}
                        onMouseLeave={e => {
                          if (!disabled && !isActive) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#4A4E69';
                          }
                        }}
                      >
                        {/* Gold active bar */}
                        {isActive && (
                          <span
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full"
                            style={{ height: '55%', background: '#D4AF37' }}
                          />
                        )}
                        <span style={{ color: isActive ? '#D4AF37' : 'inherit' }}>
                          {item.icon}
                        </span>
                        {!sidebarCollapsed && (
                          <span className="truncate font-semibold">{item.label}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* ─── Footer: Auth + Status ────────────────────── */}
        <div
          className="p-4 space-y-3"
          style={{ borderTop: '1px solid #F0F2F5' }}
        >
          {isAuthenticated ? (
            user?.email === 'pniraj.india@gmail.com' ? (
              <div
                className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-xs font-bold transition-all opacity-50 cursor-not-allowed ${sidebarCollapsed ? 'justify-center' : ''}`}
                style={{ color: '#0D1B2A' }}
                title="Admin session permanently active"
              >
                <ShieldCheck size={15} className="text-primary" />
                {!sidebarCollapsed && 'Admin Active'}
              </div>
            ) : (
              <button
                onClick={() => { signOutUser(); toast.success('Signed out'); }}
                className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-xs font-bold transition-all ${sidebarCollapsed ? 'justify-center' : ''}`}
                style={{ color: '#EF4444' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                title="Sign Out"
              >
                <LogOut size={15} />
                {!sidebarCollapsed && 'Sign Out'}
              </button>
            )
          ) : (
            <button
              onClick={async () => {
                try { await signInWithGoogle(); toast.success('Signed in'); }
                catch { toast.error('Sign in failed'); }
              }}
              className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-xs font-bold transition-all ${sidebarCollapsed ? 'justify-center' : ''}`}
              style={{
                background: '#F8F9FA',
                color: '#0D1B2A',
                border: '1px solid #E2E6EA',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F0F2F5')}
              onMouseLeave={e => (e.currentTarget.style.background = '#F8F9FA')}
              title="Sign In"
            >
              <LogIn size={15} style={{ color: '#D4AF37' }} />
              {!sidebarCollapsed && 'Sign In with Google'}
            </button>
          )}

          {mounted && !sidebarCollapsed && (
            <div className="space-y-2 pt-2" style={{ borderTop: '1px solid #F0F2F5' }}>
              <div className={`flex items-center gap-2 text-[10px] font-black tracking-widest uppercase ${isOnline ? 'text-emerald-600' : 'text-amber-600'}`}>
                {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                {isOnline ? (isAuthenticated ? 'Cloud Linked' : 'Online · Guest') : 'Offline · Local'}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold" style={{ color: isDriveConnected ? '#D4AF37' : '#8D99AE' }}>
                <Cloud size={12} />
                {isDriveConnected ? driveEmail : 'Drive Unlinked'}
              </div>
            </div>
          )}
          {mounted && sidebarCollapsed && (
            <div className="flex flex-col items-center gap-3">
              {isOnline ? <Wifi size={13} className="text-emerald-400" /> : <WifiOff size={13} className="text-amber-400" />}
              <Cloud size={13} style={{ color: isDriveConnected ? '#D4AF37' : 'rgba(255,255,255,0.25)' }} />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export function MobileMenuButton() {
  return (
    <button
      className="lg:hidden fixed top-3 left-3 z-50 p-2.5 rounded-lg shadow-lg"
      style={{ background: '#0D1B2A', color: '#F8F9FA' }}
      onClick={() => useUIStore.getState().setSidebarMobileOpen(true)}
    >
      <Menu size={18} />
    </button>
  );
}
