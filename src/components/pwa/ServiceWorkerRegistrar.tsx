'use client';

import { useEffect } from 'react';

// Tabs a surveyor needs at the vehicle. Importing them once while online puts
// their chunks in the service-worker cache so they open without signal later.
const WARM_TABS: Array<() => Promise<unknown>> = [
  () => import('@/components/tabs/SiteTab'),
  () => import('@/components/tabs/DetailsTab'),
  () => import('@/components/tabs/PhotosTab'),
  () => import('@/components/tabs/DocumentsTab'),
];

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(async (registration) => {
        await Promise.all(WARM_TABS.map((load) => load().catch(() => null)));
        // Chunks fetched before the worker took control were never cached; hand them over.
        const urls = performance.getEntriesByType('resource')
          .map((e) => e.name)
          .filter((name) => {
            const u = new URL(name);
            return u.origin === location.origin && u.pathname.startsWith('/_next/static/');
          });
        registration.active?.postMessage({ type: 'CACHE_URLS', urls });
      })
      .catch(() => { /* app keeps working exactly as before without a SW */ });
    // Asks the browser not to evict unsynced photos under storage pressure.
    void navigator.storage?.persist?.().catch(() => false);
  }, []);
  return null;
}
