import { toast } from 'sonner';
import { getClaim } from '@/lib/storage/indexeddb';
import { useClaimStore } from '@/stores/claim-store';
import { useUIStore, type AppTab } from '@/stores/ui-store';
import { claimLandingTab } from '@/lib/claims/landing-tab';
import { isNarrowViewport } from '@/lib/navigation/viewport';

/** Open a saved claim, on `tab` or the claim's landing tab. Used by the claims table and the setup checklist. */
export async function openClaim(id: string, tab?: AppTab): Promise<void> {
  // Fetch BEFORE touching navigation state.
  //
  // This used to set currentClaimId ahead of the await. That
  // published an inconsistent state — claim selected, but
  // activeTab still 'dashboard' — which useRouteSync Effect 2
  // wrote straight to the URL as ?claim=<id>&tab=dashboard.
  // Next's patched history.pushState feeds that back into
  // useSearchParams, waking Effect 1 (URL→Store), which then
  // raced this handler and set activeTab back to 'dashboard'.
  // Whichever getClaim() settled last won, so the claim opened
  // only some of the time — the rest of the time the surveyor
  // stayed on the dashboard with just the sidebar unlocking.
  try {
    const fullClaim = await getClaim(id);
    if (!fullClaim) {
      toast.error('Could not open this claim.');
      return;
    }
    // loadClaim sets currentClaimId itself (claimSlice.ts).
    // These two run back-to-back in one task, so React batches
    // them into a single render and Effect 2 only ever sees
    // the final, consistent state.
    useClaimStore.getState().loadClaim(fullClaim);
    useUIStore.getState().setActiveTab(tab ?? claimLandingTab(fullClaim.surveyType, isNarrowViewport()));
  } catch {
    toast.error('Could not open this claim.');
  }
}
