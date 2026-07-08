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
  Archive,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { signInWithGoogle, signOutUser } from '@/lib/firebase/auth';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
  { id: 'reports',        label: 'Report Center',  icon: <Printer size={17} />,        group: 'output', requiresClaim: true },
  { id: 'insured-report', label: 'Insured Report', icon: <FileText size={17} />,       group: 'output', requiresClaim: true },
  { id: 'bill-check',    label: 'Bill Check',     icon: <ClipboardCheck size={17} />, group: 'output', requiresClaim: true },
  { id: 'photos',      label: 'Photo Sheet',    icon: <Camera size={17} />,     group: 'output',   requiresClaim: true },
  { id: 'fees',        label: 'Survey Fees Bill', icon: <Receipt size={17} />,    group: 'output',   requiresClaim: true },
  { id: 'reinspection',label: 'Reinspection',  icon: <RotateCcw size={17} />,  group: 'output',   requiresClaim: true },
  { id: 'valuation',   label: 'Valuation',     icon: <CarFront size={17} />,   group: 'output',   requiresClaim: true },
  { id: 'profile', label: 'Profile', icon: <User size={17} />, group: 'settings' },
  { id: 'cloud-vault', label: 'Cloud Vault', icon: <Cloud size={17} />, group: 'settings' },
  { id: 'recovered-claims', label: 'Recovered', icon: <Archive size={17} />, group: 'settings' },
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

    if (targetTab === 'dashboard') {
      // Batch both state updates synchronously so React processes them in a
      // single render cycle. This minimises the window between closeClaim()
      // clearing the store and setActiveTab() switching the view, which
      // previously allowed useRouteSync Effect 1 to race and reload the claim.
      useClaimStore.getState().closeClaim();
      setActiveTab('dashboard');
      return;
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
          bg-white border-r border-[var(--color-neutral-200)]
          ${sidebarCollapsed ? 'w-[64px]' : 'w-[258px]'}
          lg:relative
        `}
      >
        {/* ─── Brand Header ──────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-4 py-5 border-b border-[var(--color-neutral-100)]"
        >
          {/* Logo mark */}
          <div
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center font-medium text-sm shadow-sm bg-[var(--color-neutral-900)] text-primary"
          >
            {isAuthenticated && user
              ? <img src={user.photoURL || ''} alt="" className="w-full h-full object-cover rounded-lg" />
              : <Shield size={16} />
            }
          </div>

          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium tracking-tight text-[var(--color-neutral-900)]" style={{ letterSpacing: '-0.01em' }}>
                {isAuthenticated && user ? user.displayName : (profile.name || 'SurveyOS')}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="text-[10px] font-medium uppercase tracking-widest text-primary" style={{ opacity: 0.9 }}>
                  {isAuthenticated && user ? 'Surveyor' : 'V2 · Executive'}
                </div>
                <span
                  className="text-[8px] font-medium font-mono px-1 py-0.5 rounded bg-[var(--color-neutral-100)] text-[var(--color-neutral-400)]"
                  style={{ letterSpacing: '0.05em' }}
                  title="Deployed build version"
                >
                  v{process.env.NEXT_PUBLIC_APP_VERSION}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={toggleSidebar}
            className="hidden lg:flex items-center justify-center w-6 h-6 rounded-md transition-colors text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-900)]"
          >
            {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* ─── Quick Actions ────────────────────────────── */}
        <div
          className={`flex gap-2 px-4 py-4 border-b border-[var(--color-neutral-100)] ${sidebarCollapsed ? 'flex-col items-center' : ''}`}
        >
          <Button
            onClick={() => setNewClaimDialogOpen(true)}
            title="New claim"
            className="flex-1 justify-center gap-2"
          >
            <Plus size={14} />
            {!sidebarCollapsed && 'New claim'}
          </Button>
          {!sidebarCollapsed && (
            <button
              onClick={() => setClaimsListOpen(true)}
              title="Open claim"
              className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors border border-[var(--color-neutral-200)] text-[var(--color-neutral-400)] hover:border-[var(--color-neutral-900)] hover:text-[var(--color-neutral-900)]"
            >
              <FolderOpen size={16} />
            </button>
          )}
        </div>

        {/* ─── Active Claim Badge ───────────────────────── */}
        {hasClaim && !sidebarCollapsed && (
          <div
            className="mx-4 mt-4 px-4 py-3 rounded-lg relative overflow-hidden bg-[var(--color-neutral-50)] border border-[var(--color-neutral-200)]"
          >
            <div
              className="absolute top-0 left-0 w-[3px] h-full rounded-r-full bg-primary"
            />
            <div className="text-[9px] font-medium uppercase tracking-[0.2em] pl-1 text-[var(--color-neutral-400)]">
              {currentClaim.surveyType} Survey
            </div>
            <div className="text-sm font-medium truncate mt-0.5 pl-1 text-[var(--color-neutral-900)]">
              {currentClaim.vehicle.registrationNumber || currentClaim.reportNo || 'New claim'}
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
                    className="px-3 pb-2 text-[9px] font-medium uppercase tracking-[0.25em] text-[var(--color-neutral-400)]"
                    style={{ opacity: 0.6 }}
                  >
                    {GROUP_LABELS[group]}
                  </div>
                )}
                <div className="space-y-0.5">
                  {items.map((item) => {
                    // Hide admin tab from non-admins
                    if (item.id === 'admin' && !profile.isAdmin) return null;

                    const disabled = item.requiresClaim && !hasClaim;
                    const isActive = activeTab === item.id;

                    return (
                      <button
                        key={item.id}
                        onClick={() => !disabled && handleTabChange(item.id)}
                        disabled={disabled}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm relative transition-colors',
                          sidebarCollapsed ? 'justify-center' : '',
                          isActive
                            ? 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-900)] font-medium'
                            : disabled
                              ? 'text-[var(--color-neutral-200)] cursor-not-allowed'
                              : 'text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-50)] hover:text-[var(--color-neutral-900)]'
                        )}
                      >
                        {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-[55%] w-[3px] rounded-r-full bg-primary" />}
                        <span className={isActive ? 'text-primary' : ''}>{item.icon}</span>
                        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
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
          className="p-4 space-y-3 border-t border-[var(--color-neutral-100)]"
        >
          {isAuthenticated ? (
            user?.email === 'pniraj.india@gmail.com' ? (
              <div
                className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors opacity-50 cursor-not-allowed ${sidebarCollapsed ? 'justify-center' : ''}`}
                style={{ color: 'var(--color-neutral-900)' }}
                title="Admin session permanently active"
              >
                <ShieldCheck size={15} className="text-primary" />
                {!sidebarCollapsed && 'Admin active'}
              </div>
            ) : (
              <button
                onClick={() => { signOutUser(); toast.success('Signed out'); }}
                className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors text-[var(--color-status-danger)] hover:bg-[var(--color-status-danger-tint)] ${sidebarCollapsed ? 'justify-center' : ''}`}
                title="Sign out"
              >
                <LogOut size={15} />
                {!sidebarCollapsed && 'Sign out'}
              </button>
            )
          ) : (
            <button
              onClick={async () => {
                try { await signInWithGoogle(); toast.success('Signed in'); }
                catch { toast.error('Sign in failed'); }
              }}
              className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors bg-[var(--color-neutral-50)] text-[var(--color-neutral-900)] border border-[var(--color-neutral-200)] hover:bg-[var(--color-neutral-100)] ${sidebarCollapsed ? 'justify-center' : ''}`}
              title="Sign in"
            >
              <LogIn size={15} className="text-primary" />
              {!sidebarCollapsed && 'Sign in with Google'}
            </button>
          )}

          {mounted && !sidebarCollapsed && (
            <div className="space-y-2 pt-2 border-t border-[var(--color-neutral-100)]">
              <div className={`flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest ${isOnline ? 'text-emerald-600' : 'text-amber-600'}`}>
                {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                {isOnline ? (isAuthenticated ? 'Cloud linked' : 'Online · Guest') : 'Offline · Local'}
              </div>
              <div className={`flex items-center gap-2 text-[10px] font-medium ${isDriveConnected ? 'text-primary' : 'text-[var(--color-neutral-400)]'}`}>
                <Cloud size={12} />
                {isDriveConnected ? driveEmail : 'Drive unlinked'}
              </div>
            </div>
          )}
          {mounted && sidebarCollapsed && (
            <div className="flex flex-col items-center gap-3">
              {isOnline ? <Wifi size={13} className="text-emerald-400" /> : <WifiOff size={13} className="text-amber-400" />}
              <Cloud size={13} className={isDriveConnected ? 'text-primary' : 'text-[var(--color-neutral-200)]'} />
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
      className="lg:hidden fixed top-3 left-3 z-50 p-2.5 rounded-lg shadow-lg bg-[var(--color-neutral-900)] text-white"
      onClick={() => useUIStore.getState().setSidebarMobileOpen(true)}
    >
      <Menu size={18} />
    </button>
  );
}
