'use client';

import { useEffect } from 'react';

// Tabs a surveyor needs at the vehicle. Importing them once while online puts
// their chunks in the service-worker cache so they open without signal later.
const WARM_TABS: Array<() => Promise<unknown>> = [
  () => import('@/components/tabs/DetailsTab'),
  () => import('@/components/tabs/PhotosTab'),
  () => import('@/components/tabs/DocumentsTab'),
];

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(() => Promise.all(WARM_TABS.map((load) => load().catch(() => null))))
      .catch(() => { /* app keeps working exactly as before without a SW */ });
    // Asks the browser not to evict unsynced photos under storage pressure.
    void navigator.storage?.persist?.().catch(() => false);
  }, []);
  return null;
}
