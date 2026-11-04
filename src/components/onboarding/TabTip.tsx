'use client';

import { Lightbulb, ArrowRight } from 'lucide-react';
import { useUIStore } from '@/stores/ui-store';
import { useProfileStore } from '@/stores/profile-store';
import { useClaimStore } from '@/stores/claim-store';
import {
  TAB_HELP,
  getNextClaimTab,
  getTabLabel,
  markTipSeen,
  shouldShowTip,
} from '@/lib/onboarding/tab-help';

export interface TabTipBannerProps {
  title: string;
  tip: string;
  nextTabLabel?: string | null;
  onNext?: () => void;
  onDismiss: () => void;
}

export function TabTipBanner({ title, tip, nextTabLabel, onNext, onDismiss }: TabTipBannerProps) {
  return (
    <aside
      aria-label={`${title} guide`}
      className="print:hidden mx-4 md:mx-6 mt-3 mb-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <Lightbulb size={16} className="text-primary flex-shrink-0 mt-0.5" />
          <div className="min-w-0 leading-relaxed">
            <span className="font-semibold text-foreground mr-1.5">{title}:</span>
            <span className="text-muted-foreground">{tip}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
          {nextTabLabel && onNext && (
            <button
              type="button"
              onClick={onNext}
              className="min-h-11 sm:min-h-9 px-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5 cursor-pointer text-xs"
            >
              Next: {nextTabLabel} <ArrowRight size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-11 sm:min-h-9 px-3 rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted font-medium transition-colors cursor-pointer text-xs"
            aria-label="Dismiss tip"
          >
            Got it
          </button>
        </div>
      </div>
    </aside>
  );
}

export function TabTip() {
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const loginSyncDone = useUIStore((s) => s.loginSyncDone);
  const profile = useProfileStore((s) => s.profile);
  const claim = useClaimStore((s) => s.currentClaim);

  const help = TAB_HELP[activeTab];
  if (!help) return null;
  // If it's a claim-specific tab, require a claim to be loaded before showing tip
  if (help.isClaimTab && !claim) return null;
  if (!shouldShowTip(activeTab, profile, loginSyncDone)) return null;

  const nextTab = getNextClaimTab(activeTab, claim?.surveyType);

  return (
    <TabTipBanner
      title={help.title}
      tip={help.tip}
      nextTabLabel={nextTab ? getTabLabel(nextTab) : null}
      onNext={() => {
        markTipSeen(activeTab);
        if (nextTab) {
          setActiveTab(nextTab);
        }
      }}
      onDismiss={() => {
        markTipSeen(activeTab);
      }}
    />
  );
}
