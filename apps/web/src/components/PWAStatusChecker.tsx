'use client';

import { useEffect, useState } from 'react';

interface PWAStatus {
  serviceWorker: 'supported' | 'not-supported' | 'registered' | 'failed';
  manifest: 'valid' | 'invalid' | 'missing';
  installable: boolean;
  notifications: 'granted' | 'denied' | 'default' | 'not-supported';
  standalone: boolean;
  cacheAPI: boolean;
  pushAPI: boolean;
}

export function PWAStatusChecker() {
  const [status, setStatus] = useState<PWAStatus | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const checkPWAStatus = async () => {
      const newStatus: PWAStatus = {
        serviceWorker: 'not-supported',
        manifest: 'missing',
        installable: false,
        notifications: 'not-supported',
        standalone: window.matchMedia('(display-mode: standalone)').matches,
        cacheAPI: 'caches' in window,
        pushAPI: 'PushManager' in window,
      };

      // Check Service Worker
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            newStatus.serviceWorker = 'registered';
          } else {
            newStatus.serviceWorker = 'supported';
          }
        } catch (error) {
          newStatus.serviceWorker = 'failed';
        }
      }

      // Check Manifest
      try {
        const response = await fetch('/manifest.json');
        if (response.ok) {
          const manifest = await response.json();
          if (manifest.name && manifest.icons && manifest.start_url) {
            newStatus.manifest = 'valid';
          } else {
            newStatus.manifest = 'invalid';
          }
        }
      } catch (error) {
        newStatus.manifest = 'missing';
      }

      // Check installability
      newStatus.installable =
        newStatus.serviceWorker === 'registered' && newStatus.manifest === 'valid';

      // Check Notifications
      if ('Notification' in window) {
        newStatus.notifications = Notification.permission;
      }

      setStatus(newStatus);
    };

    checkPWAStatus();

    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data.type === 'SW_ACTIVATED') {
          checkPWAStatus(); // Recheck status
        }
      });
    }
  }, []);

  if (!status || process.env.NODE_ENV !== 'development') return null;

  const getStatusIcon = (feature: keyof PWAStatus) => {
    const value = status[feature];
    if (typeof value === 'boolean') {
      return value ? '✅' : '❌';
    }
    switch (value) {
      case 'registered':
      case 'valid':
      case 'granted':
        return '✅';
      case 'supported':
      case 'default':
        return '⚠️';
      case 'not-supported':
      case 'failed':
      case 'invalid':
      case 'missing':
      case 'denied':
        return '❌';
      default:
        return '❓';
    }
  };

  const getStatusText = (feature: keyof PWAStatus) => {
    const value = status[feature];
    if (typeof value === 'boolean') {
      return value ? 'Supported' : 'Not Supported';
    }
    return value.charAt(0).toUpperCase() + value.slice(1).replace('-', ' ');
  };

  return (
    <div className="fixed top-4 left-4 z-40">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-full text-xs font-medium shadow-lg transition-colors"
      >
        PWA Status {status.serviceWorker === 'registered' ? '✅' : '❌'}
      </button>

      {isExpanded && (
        <div className="absolute top-12 left-0 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 w-80 max-h-96 overflow-y-auto">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">PWA Features Status</h3>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Service Worker:</span>
              <span className="text-sm font-medium">
                {getStatusIcon('serviceWorker')} {getStatusText('serviceWorker')}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Manifest:</span>
              <span className="text-sm font-medium">
                {getStatusIcon('manifest')} {getStatusText('manifest')}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Installable:</span>
              <span className="text-sm font-medium">
                {getStatusIcon('installable')} {getStatusText('installable')}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Notifications:</span>
              <span className="text-sm font-medium">
                {getStatusIcon('notifications')} {getStatusText('notifications')}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Standalone:</span>
              <span className="text-sm font-medium">
                {getStatusIcon('standalone')} {getStatusText('standalone')}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Cache API:</span>
              <span className="text-sm font-medium">
                {getStatusIcon('cacheAPI')} {getStatusText('cacheAPI')}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Push API:</span>
              <span className="text-sm font-medium">
                {getStatusIcon('pushAPI')} {getStatusText('pushAPI')}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Open browser DevTools → Application tab to inspect PWA features
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
