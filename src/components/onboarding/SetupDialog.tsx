'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useProfileStore } from '@/stores/profile-store';
import { useUIStore, type SetupStep } from '@/stores/ui-store';
import type { SurveyorProfile } from '@/types/vehicle';
import { canContinueDetails, closeSetup, licencePrefill } from '@/lib/onboarding/setup';
import { DetailsBody, KeyBody, MarksBody } from './SetupSteps';

const PATH = ['Documents', 'Check', 'Assess', 'Report'] as const;

const STEPS = {
  1: { title: 'Your report details', sub: 'These print on every report you generate.', Body: DetailsBody },
  2: { title: 'Signature and stamp', sub: 'A clear photo from your phone works. You can add these later.', Body: MarksBody },
  3: {
    title: 'Your AI key',
    sub: 'Prime uses this free key to read your documents. It stays on your own account.',
    Body: KeyBody,
  },
} as const;

const BTN = 'min-h-11 px-4 rounded-lg text-sm font-medium';
const PRIMARY = `${BTN} bg-primary text-primary-foreground disabled:opacity-50`;

export interface SetupStepContentProps {
  step: SetupStep;
  profile: SurveyorProfile;
  onProfile: (updates: Partial<SurveyorProfile>) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onFinish: () => void;
  onLater: () => void;
}

/** Body for one step, without the Dialog wrapper (so it can be rendered and tested alone). */
export function SetupStepContent(p: SetupStepContentProps) {
  if (p.step === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-medium text-foreground">Welcome to Motor SurveyOS Prime</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Turn your claim documents into a finished survey report, with far less paperwork.
          </p>
        </div>
        <ol className="flex flex-wrap items-center gap-2 text-xs font-medium">
          {PATH.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-full bg-primary/10 text-primary">{i + 1}. {label}</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2 justify-end">
          <button type="button" onClick={p.onLater} className={`${BTN} border border-border`}>Later</button>
          <button type="button" onClick={p.onNext} className={PRIMARY}>Set up my profile (3 min)</button>
        </div>
      </div>
    );
  }

  const { title, sub, Body } = STEPS[p.step];
  const blocked = p.step === 1 && !canContinueDetails(p.profile);
  const last = p.step === 3;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Step {p.step} of 3</p>
        <h2 className="text-lg font-medium text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{sub}</p>
      </div>
      <Body profile={p.profile} onProfile={p.onProfile} />
      {blocked && (
        <p role="status" className="text-xs font-medium text-status-warning">
          Name and licence number are needed to continue.
        </p>
      )}
      <div className="flex flex-wrap gap-2 justify-between">
        <div className="flex gap-2">
          {p.step > 1 && <button type="button" onClick={p.onBack} className={`${BTN} border border-border`}>Back</button>}
          <button type="button" onClick={p.onSkip} className={`${BTN} text-muted-foreground underline`}>Skip for now</button>
        </div>
        <button type="button" disabled={blocked} onClick={last ? p.onFinish : p.onNext} className={PRIMARY}>
          {last ? 'Finish' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

export function SetupDialog() {
  const step = useUIStore((s) => s.setupStep);
  const setStep = useUIStore((s) => s.setSetupStep);
  const profile = useProfileStore((s) => s.profile);
  const updateProfile = useProfileStore((s) => s.updateProfile);

  // Copy the registration licence into the report field the first time step 1 opens with it blank.
  useEffect(() => {
    if (step !== 1) return;
    const prefill = licencePrefill(useProfileStore.getState().profile);
    if (prefill) updateProfile({ licenceNumber: prefill });
  }, [step, updateProfile]);

  if (step === null) return null;
  const go = (next: SetupStep) => setStep(next);
  const forward = () => (step === 3 ? closeSetup() : go((step + 1) as SetupStep));

  return (
    <Dialog open onOpenChange={(open) => { if (!open) closeSetup(); }}>
      <DialogContent aria-label="Profile setup" className="sm:max-w-lg max-h-[90dvh] overflow-y-auto print:hidden">
        <SetupStepContent
          step={step}
          profile={profile}
          onProfile={updateProfile}
          onNext={() => go((step + 1) as SetupStep)}
          onBack={() => go((step - 1) as SetupStep)}
          onSkip={forward}
          onFinish={() => {
            closeSetup();
            toast.success('Setup saved. Create your first claim when you are ready.');
          }}
          onLater={closeSetup}
        />
      </DialogContent>
    </Dialog>
  );
}
