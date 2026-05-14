import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useUIStore } from '@/stores/ui-store';
import { useClaimStore } from '@/stores/claim-store';
import { getClaim } from '@/lib/storage/indexeddb';

export function useRouteSync() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const { activeTab, currentClaimId } = useUIStore();
  const { loadClaim } = useClaimStore();

  // Tracks whether a URL→Store sync is in flight so the Store→URL
  // effect doesn't immediately clobber the URL before Zustand settles.
  const syncingFromUrl = useRef(false);

  // ── Effect 1: URL → Store ─────────────────────────────────────────────────
  // Fires only when the URL changes (browser Back/Forward, initial mount).
  useEffect(() => {
    const urlClaimId = searchParams.get('claim');
    const urlTab     = searchParams.get('tab');

    async function applyUrl() {
      syncingFromUrl.current = true;
      try {
        const { setActiveTab, setCurrentClaimId } = useUIStore.getState();
        const { currentClaimId: storeClaimId }    = useClaimStore.getState();

        if (urlClaimId) {
          // ── Stale-URL guard ───────────────────────────────────────────────
          // If the store was already intentionally cleared (closeClaim was
          // called) but the URL hasn't been cleaned yet (Effect 2 is in
          // flight), do NOT re-load the claim from this stale URL.
          // Effect 2 (Store→URL) will push the clean URL and this effect
          // will re-run with no ?claim param, correctly landing on dashboard.
          if (!storeClaimId && urlClaimId) {
            syncingFromUrl.current = false;
            return;
          }
          // ─────────────────────────────────────────────────────────────────

          // Only load from IndexedDB if the claim actually changed.
          if (urlClaimId !== storeClaimId) {
            const fullClaim = await getClaim(urlClaimId);
            if (fullClaim) {
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
      }
    }

    applyUrl();
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 2: Store → URL ─────────────────────────────────────────────────
  // Fires only when Zustand state changes (user navigates inside the app).
  useEffect(() => {
    if (syncingFromUrl.current) return;

    const currentUrlClaimId = searchParams.get('claim');
    const currentUrlTab     = searchParams.get('tab');

    const desiredClaim = currentClaimId ?? null;
    const desiredTab   = activeTab === 'dashboard' ? null : activeTab;

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
    router.push(newUrl, { scroll: false });
  }, [activeTab, currentClaimId]); // eslint-disable-line react-hooks/exhaustive-deps
}
