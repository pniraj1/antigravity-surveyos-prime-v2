'use client';

import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useUIStore, type AppTab } from '@/stores/ui-store';
import { getReportGuide, type ReportGuide, type ReportSectionItem } from '@/lib/onboarding/report-guide';

export interface ReportSectionGuideViewProps {
  guide: ReportGuide;
  activeTab?: AppTab;
  onNavigateTab?: (tab: AppTab) => void;
  defaultExpanded?: boolean;
}

export function ReportSectionGuideView({
  guide,
  onNavigateTab,
  defaultExpanded = false,
}: ReportSectionGuideViewProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  return (
    <aside
      aria-label="Report Section Guide"
      className="print:hidden mb-5 rounded-2xl border border-primary/20 bg-card overflow-hidden shadow-sm transition-all"
    >
      {/* Banner / Header Toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 sm:px-5 py-3 text-left transition-colors hover:bg-neutral-50/80 active:bg-neutral-100 min-h-[44px]"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--color-primary-tint, rgba(13,27,42,0.08))', color: 'var(--color-primary, #0D1B2A)' }}
          >
            <BookOpen size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-semibold text-foreground">
                Report Section Guide
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider bg-primary/10 text-primary">
                {guide.title}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground truncate hidden sm:block">
              Learn what insurers look for in each section and jump directly to where to edit it.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 text-xs font-medium text-primary">
          <span className="hidden sm:inline">{isExpanded ? 'Hide Guide' : 'Show Guide'}</span>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded Content Panel */}
      {isExpanded && (
        <div className="border-t border-border/60 p-4 sm:p-5 bg-gradient-to-b from-neutral-50/50 to-background space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {guide.description} Click any section below to jump straight to the source tab.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {guide.sections.map((section: ReportSectionItem) => {
              const isSelected = selectedSectionId === section.id;

              return (
                <div
                  key={section.id}
                  className="rounded-xl border border-border/80 bg-card p-3.5 flex flex-col justify-between transition-all hover:border-primary/40 hover:shadow-sm"
                >
                  <div className="space-y-1.5 mb-3">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-semibold text-foreground leading-snug">
                        {section.title}
                      </h4>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-muted text-muted-foreground uppercase flex-shrink-0">
                        {section.subtitle}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {section.purpose}
                    </p>

                    {section.tips && section.tips.length > 0 && (
                      <div className="mt-2 space-y-1 pt-2 border-t border-dashed border-border/60">
                        {section.tips.map((tip, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 text-[10.5px] text-foreground/80">
                            <CheckCircle2 size={12} className="text-status-success flex-shrink-0 mt-0.5" />
                            <span>{tip}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Source tab: <strong className="text-foreground">{section.fixTab}</strong>
                    </span>

                    <button
                      type="button"
                      onClick={() => onNavigateTab?.(section.fixTab)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary bg-primary/10 hover:bg-primary hover:text-primary-foreground transition-all active:scale-95 min-h-[36px]"
                    >
                      <span>{section.fixLabel}</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}

export interface ReportSectionGuideProps {
  reportType: 'spot' | 'survey' | 'valuation';
}

export function ReportSectionGuide({ reportType }: ReportSectionGuideProps) {
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const guide = getReportGuide(reportType);

  return (
    <ReportSectionGuideView
      guide={guide}
      onNavigateTab={(tab) => {
        setActiveTab(tab);
      }}
    />
  );
}
