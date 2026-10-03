'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Camera, FileText, Images, MapPin, Phone, Loader2, Sparkles } from 'lucide-react';
import { useClaimStore } from '@/stores/claim-store';
import { useUIStore } from '@/stores/ui-store';
import { usePhotoUpload } from '@/hooks/usePhotoUpload';
import { DriveQueueChip } from '@/components/sync/DriveQueueChip';
import { SiteChecklistCard } from '@/components/site/SiteChecklistCard';
import { SiteNotesReviewDialog } from '@/components/site/SiteNotesReviewDialog';
import { siteChecklist, type ChecklistItem } from '@/lib/site/site-checklist';
import { readSiteNotes } from '@/lib/site/read-site-notes';
import { siteNotesUpdates, isEmptyPlan, type SiteNotesPlan } from '@/lib/site/site-notes';
import { mapsDirectionsUrl, telHref } from '@/lib/site/contact-links';

const BIG_BUTTON = 'flex flex-col items-center justify-center gap-1 rounded-xl border border-border bg-card p-4 min-h-[96px] text-sm font-medium';

export function SiteTab() {
  const claim = useClaimStore((s) => s.currentClaim);
  const updateClaim = useClaimStore((s) => s.updateClaim);
  const { setActiveTab, isOnline } = useUIStore();
  const { uploadPhotos, isProcessing, saveToCloudDialog } = usePhotoUpload();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [plan, setPlan] = useState<SiteNotesPlan | null>(null);

  if (!claim) return null;

  const { missing, confirm } = siteChecklist(claim);
  const navigate = mapsDirectionsUrl(claim.accident.workshopAddress || claim.accident.workshopName || '');
  const callWorkshop = telHref(claim.accident.workshopPhone || '');
  const callInsured = telHref(claim.policy.insuredMobile || '');

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) void uploadPhotos(e.target.files);
    e.target.value = '';
  };

  const pick = (item: ChecklistItem) => {
    if (item.target === 'camera') cameraRef.current?.click();
    else setActiveTab(item.target);
  };

  const fillFromNotes = async () => {
    setReading(true);
    try {
      const result = await readSiteNotes(claim);
      if (isEmptyPlan(result)) toast.info('Nothing to fill from these notes.');
      else setPlan(result);
    } catch {
      toast.error("Couldn't read the notes — try again. Your notes are saved.");
    } finally {
      setReading(false);
    }
  };

  const apply = () => {
    const current = useClaimStore.getState().currentClaim;
    if (current && plan) updateClaim(siteNotesUpdates(current, plan));
    setPlan(null);
    toast.success('Fields filled from notes.');
  };

  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 py-4 pb-24">
      {saveToCloudDialog}
      {plan && <SiteNotesReviewDialog plan={plan} onApply={apply} onClose={() => setPlan(null)} />}

      <header className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="truncate text-base font-medium">{claim.vehicle.registrationNumber || 'New claim'}</p>
          <p className="text-xs capitalize text-muted-foreground">
            {claim.surveyType} survey{claim.policy.insurerName ? ` · ${claim.policy.insurerName}` : ''}
          </p>
        </div>
        <DriveQueueChip />
      </header>

      <div className="grid grid-cols-3 gap-3">
        <button type="button" className={BIG_BUTTON} onClick={() => cameraRef.current?.click()} disabled={isProcessing}>
          {isProcessing ? <Loader2 size={24} className="animate-spin" /> : <Camera size={24} />}
          Damage photo
        </button>
        <button type="button" className={BIG_BUTTON} onClick={() => setActiveTab('documents')}>
          <FileText size={24} /> Documents
        </button>
        <button type="button" className={BIG_BUTTON} onClick={() => galleryRef.current?.click()} disabled={isProcessing}>
          <Images size={24} /> Gallery
        </button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFiles} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />

      <SiteChecklistCard title="Still missing before you leave" items={missing} onPick={pick} />
      <SiteChecklistCard title="Confirm before you leave" items={confirm} onPick={pick} />

      <section className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Site notes</h3>
        <textarea
          value={claim.siteNotes ?? ''}
          onChange={(e) => updateClaim({ siteNotes: e.target.value })}
          rows={6}
          placeholder="Tap the mic on your keyboard and speak — damage, odometer, airbags, police, workshop…"
          className="w-full rounded-lg border border-border bg-card p-3 text-base"
        />
        <button
          type="button"
          onClick={fillFromNotes}
          disabled={!isOnline || reading || !(claim.siteNotes ?? '').trim()}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {reading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          Fill fields from notes
        </button>
        {!isOnline && <p className="text-xs text-muted-foreground">Needs signal — your notes are saved.</p>}
      </section>

      {(navigate || callWorkshop || callInsured) && (
        <section className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contacts</h3>
          <div className="flex flex-wrap gap-2">
            {navigate && (
              <a href={navigate} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-border px-4 text-sm">
                <MapPin size={16} /> Navigate to workshop
              </a>
            )}
            {callWorkshop && (
              <a href={callWorkshop} className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-border px-4 text-sm">
                <Phone size={16} /> Call workshop
              </a>
            )}
            {callInsured && (
              <a href={callInsured} className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-border px-4 text-sm">
                <Phone size={16} /> Call insured
              </a>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
