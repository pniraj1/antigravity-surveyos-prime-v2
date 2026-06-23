import { useEffect, useRef } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { useUIStore } from '@/stores/ui-store';
import { useClaimStore } from '@/stores/claim-store';
import { getClaim } from '@/lib/storage/indexeddb';

export function useRouteSync() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const { activeTab, currentClaimId } = useUIStore();
  const { loadClaim } = useClaimStore();

  // Tracks whether a URL→Store sync is in flight so the Store→URL
  // effect doesn't immediately clobber the URL before Zustand settles.
  const syncingFromUrl = useRef(false);
  // Prevents Effect 2 from firing before Effect 1 completes its first run.
  const initializedRef = useRef(false);

  // ── Effect 1: URL → Store ─────────────────────────────────────────────────
  // Fires only when the URL changes (browser Back/Forward, initial mount).
  useEffect(() => {
    const urlClaimId = searchParams.get('claim');
    const urlTab     = searchParams.get('tab');

    async function applyUrl() {
      syncingFromUrl.current = true;
      try {
        const { setActiveTab, setCurrentClaimId } = useUIStore.getState();
        // Read from UIStore — the single source of truth for navigation state.
        // claimSlice.currentClaimId is a mirror; reading from UIStore ensures
        // the stale-URL guard and the load check use the same ID.
        const { currentClaimId: storeClaimId } = useUIStore.getState();

        if (urlClaimId) {
          // ── Stale-URL guard ───────────────────────────────────────────────
          // If the store was intentionally cleared (closeClaim) but Effect 2
          // hasn't pushed the clean URL yet, do NOT reload from this stale URL.
          // closeClaim sets UIStore.currentClaimId = null synchronously, so
          // storeClaimId will be null while the URL still carries ?claim=<id>.
          //
          // This ONLY applies after init. On the very first run (page reload),
          // storeClaimId may legitimately be null because the persisted UIStore
          // hasn't hydrated yet — there the URL is authoritative and we must
          // restore the claim rather than drop the user to the dashboard.
          if (initializedRef.current && !storeClaimId) {
            syncingFromUrl.current = false;
            return;
          }
          // ─────────────────────────────────────────────────────────────────

          // Load from IndexedDB if the claim changed OR if the claim object is
          // missing (e.g. page reload: ID is persisted but claim data is not).
          const claimObjectMissing = !useClaimStore.getState().currentClaim;
          if (urlClaimId !== storeClaimId || claimObjectMissing) {
            const fullClaim = await getClaim(urlClaimId);
            if (fullClaim) {
              // Make UIStore (the navigation source of truth) match the URL so
              // Effect 2 doesn't subsequently strip ?claim from a reloaded URL.
              setCurrentClaimId(urlClaimId);
              loadClaim(fullClaim);
            } else {
              // Invalid / deleted claim in URL – fall back to dashboard.
              setCurrentClaimId(null);
              setActiveTab('dashboard');
              return;
            }
          }
          // Apply tab from URL, defaulting to 'details' when a claim is present.
          setActiveTab((urlTab ?? 'details') as Parameters<typeof setActiveTab>[0]);
        } else {
          // No claim in URL – apply tab from URL if present (e.g. admin, profile),
          // otherwise fall back to dashboard.
          if (storeClaimId) setCurrentClaimId(null);
          setActiveTab((urlTab ?? 'dashboard') as Parameters<typeof setActiveTab>[0]);
        }
      } finally {
        syncingFromUrl.current = false;
        initializedRef.current = true;
      }
    }

    applyUrl();
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 2: Store → URL ─────────────────────────────────────────────────
  // Fires only when Zustand state changes (user navigates inside the app).
  useEffect(() => {
    // Skip on initial mount — let Effect 1 establish state from the URL first.
    if (!initializedRef.current) return;
    if (syncingFromUrl.current) return;

    const currentUrlClaimId = searchParams.get('claim');
    const currentUrlTab     = searchParams.get('tab');

    const desiredClaim = currentClaimId ?? null;
    // Every tab — including the dashboard — gets an explicit ?tab=<id> in the
    // URL so a page reload restores the exact view. Without this the dashboard
    // had no URL identity and any reload landed back on it.
    const desiredTab   = activeTab;

    // Only push when the URL actually needs to change.
    if (desiredClaim === currentUrlClaimId && desiredTab === currentUrlTab) return;

    const params = new URLSearchParams(searchParams.toString());

    if (desiredClaim) {
      params.set('claim', desiredClaim);
    } else {
      params.delete('claim');
    }

    if (desiredTab) {
      params.set('tab', desiredTab);
    } else {
      params.delete('tab');
    }

    const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    // Use the History API directly instead of Next's router.push(). The URL here
    // is only a mirror of the Zustand navigation state (so reload + Back/Forward
    // can restore the view). In a static export (`output: 'export'`) router.push
    // tries to fetch an RSC payload for the navigation; with the catch-all
    // rewrite serving index.html it receives HTML instead and falls back to a
    // FULL PAGE RELOAD on every tab change. pushState updates the URL with no
    // navigation; Back/Forward still works because Next handles popstate and
    // re-runs Effect 1 (URL → Store).
    window.history.pushState(null, '', newUrl);
  }, [activeTab, currentClaimId]); // eslint-disable-line react-hooks/exhaustive-deps
}
