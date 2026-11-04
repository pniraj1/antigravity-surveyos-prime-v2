'use client';

import { HelpCircle, ExternalLink, Mail, RotateCcw, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useUIStore, type AppTab } from '@/stores/ui-store';
import { useClaimStore } from '@/stores/claim-store';
import { reopenSetupGuide } from '@/lib/onboarding/setup';
import { startDashboardTour } from '@/lib/onboarding/dashboard-tour';
import { TAB_HELP, getNextClaimTab, getTabLabel } from '@/lib/onboarding/tab-help';
import type { SurveyType } from '@/types/report';

export interface HelpContentProps {
  activeTab: AppTab;
  surveyType?: SurveyType;
  onReplaySetup: () => void;
  onStartTour?: () => void;
  onGoNext?: (tab: AppTab) => void;
}

export function HelpContent({ activeTab, surveyType, onReplaySetup, onStartTour, onGoNext }: HelpContentProps) {
  const currentHelp = TAB_HELP[activeTab] || {
    title: 'SurveyOS Prime',
    what: 'Motor insurance survey management platform.',
    tip: 'Lead with less paperwork; AI drafts while the surveyor decides.',
  };

  const nextTab = getNextClaimTab(activeTab, surveyType);

  return (
    <div className="space-y-4 py-2 text-xs">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
          <HelpCircle size={18} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Help &amp; Surveyor Guide
          </h2>
          <p className="text-xs text-muted-foreground">
            Guidance for your current screen, setup, and support.
          </p>
        </div>
      </div>

      {/* Section 1: About Current Screen */}
      <section className="rounded-xl border border-border bg-card p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
            Current Tab
          </span>
          <span className="font-medium text-foreground">{currentHelp.title}</span>
        </div>
        <p className="text-foreground font-medium">{currentHelp.what}</p>
        <p className="text-muted-foreground leading-relaxed">{currentHelp.tip}</p>

        {nextTab && (
          <div className="pt-2 border-t border-border/60 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Next in workflow:</span>
            <button
              type="button"
              onClick={() => onGoNext?.(nextTab)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline cursor-pointer"
            >
              {getTabLabel(nextTab)} <ArrowRight size={13} />
            </button>
          </div>
        )}
      </section>

      {/* Section 2: Replay Setup Guide & Tour */}
      <section className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-semibold text-foreground">Profile Setup Guide</span>
            <p className="text-muted-foreground mt-0.5">
              Review your name, licence number, signature, stamp, and AI key settings anytime.
            </p>
          </div>
          <button
            type="button"
            onClick={onReplaySetup}
            className="min-h-9 px-3 rounded-lg border border-border bg-background hover:bg-muted font-medium text-foreground transition-colors inline-flex items-center gap-1.5 cursor-pointer text-xs flex-shrink-0 ml-2"
          >
            <RotateCcw size={13} /> Replay Guide
          </button>
        </div>

        {onStartTour && (
          <div className="pt-2.5 border-t border-border/60 flex items-center justify-between">
            <div>
              <span className="font-semibold text-foreground">Dashboard Tour</span>
              <p className="text-muted-foreground mt-0.5">
                Walk through the core desktop actions and claims table.
              </p>
            </div>
            <button
              type="button"
              onClick={onStartTour}
              className="min-h-9 px-3 rounded-lg border border-border bg-background hover:bg-muted font-medium text-foreground transition-colors inline-flex items-center gap-1.5 cursor-pointer text-xs flex-shrink-0 ml-2"
            >
              Start Tour
            </button>
          </div>
        )}
      </section>

      {/* Section 3: FAQ & Support */}
      <section className="space-y-2 pt-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <a
            href="/faq"
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-11 flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-foreground font-medium"
          >
            <span>Read FAQ</span>
            <ExternalLink size={13} className="text-muted-foreground" />
          </a>
          <a
            href="mailto:surveyosprime@gmail.com"
            className="min-h-11 flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-foreground font-medium"
          >
            <span>Email Support</span>
            <Mail size={13} className="text-muted-foreground" />
          </a>
        </div>
        <p className="text-[11px] text-center text-muted-foreground pt-1">
          Practising surveyor support:{' '}
          <a href="mailto:surveyosprime@gmail.com" className="underline text-foreground">
            surveyosprime@gmail.com
          </a>
        </p>
      </section>
    </div>
  );
}

export function HelpDialog() {
  const isOpen = useUIStore((s) => s.isHelpDialogOpen);
  const setIsOpen = useUIStore((s) => s.setHelpDialogOpen);
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const claim = useClaimStore((s) => s.currentClaim);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent aria-label="Help and Surveyor Guide" className="sm:max-w-md max-h-[90dvh] overflow-y-auto print:hidden">
        <HelpContent
          activeTab={activeTab}
          surveyType={claim?.surveyType}
          onReplaySetup={() => {
            setIsOpen(false);
            reopenSetupGuide();
          }}
          onStartTour={() => {
            setIsOpen(false);
            if (activeTab !== 'dashboard') {
              setActiveTab('dashboard');
              setTimeout(() => startDashboardTour(), 150);
            } else {
              startDashboardTour();
            }
          }}
          onGoNext={(next) => {
            setIsOpen(false);
            setActiveTab(next);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
