'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Register service worker in both dev and production for PWA testing
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Registration can fail in unsupported browsers or restricted contexts - non-fatal.
      });
    }
  }, []);

  return null;
}
