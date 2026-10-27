'use client';

import type { ReactNode } from 'react';
import { ClipboardList, FileText, Camera, Printer, MoreHorizontal } from 'lucide-react';
import { useClaimStore } from '@/stores/claim-store';
import { useUIStore, type AppTab } from '@/stores/ui-store';
import { isNavItemVisible } from '@/lib/navigation/visible-nav';
import { cn } from '@/lib/utils';

const ITEMS: { id: AppTab; label: string; icon: ReactNode }[] = [
  { id: 'details', label: 'Details', icon: <ClipboardList size={20} /> },
  { id: 'documents', label: 'Documents', icon: <FileText size={20} /> },
  { id: 'photos', label: 'Photos', icon: <Camera size={20} /> },
  { id: 'reports', label: 'Report', icon: <Printer size={20} /> },
];

/** Phone-only. "More" opens the existing drawer, which holds every other tab. */
export function MobileBottomBar() {
  const claim = useClaimStore((s) => s.currentClaim);
  const { activeTab, setActiveTab, setSidebarMobileOpen } = useUIStore();
  if (!claim) return null;

  const items = ITEMS.filter((i) => isNavItemVisible(i.id, claim.surveyType));
  const base = 'flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[56px] text-[11px]';

  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card pb-[env(safe-area-inset-bottom)]" aria-label="Claim navigation">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setActiveTab(item.id)}
          aria-current={activeTab === item.id ? 'page' : undefined}
          className={cn(base, activeTab === item.id ? 'text-primary font-medium' : 'text-muted-foreground')}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
      <button type="button" onClick={() => setSidebarMobileOpen(true)} className={cn(base, 'text-muted-foreground')}>
        <MoreHorizontal size={20} />
        More
      </button>
    </nav>
  );
}
