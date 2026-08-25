'use client';

import { useEffect, useState } from 'react';

export function PWANotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);

      // Show notification prompt after 10 seconds if not already granted/denied
      if (Notification.permission === 'default') {
        const timer = setTimeout(() => {
          setShowNotificationPrompt(true);
        }, 10000);

        return () => clearTimeout(timer);
      }
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      setShowNotificationPrompt(false);

      if (permission === 'granted') {
        // Subscribe to push notifications
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          const registration = await navigator.serviceWorker.ready;

          // Check if already subscribed
          const existingSubscription = await registration.pushManager.getSubscription();

          if (!existingSubscription) {
            // You would typically get this from your server
            const vapidPublicKey = 'YOUR_VAPID_PUBLIC_KEY'; // Replace with actual key

            try {
              await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: vapidPublicKey,
              });

              // Send subscription to your server
              // await fetch('/api/subscribe', {
              //   method: 'POST',
              //   headers: { 'Content-Type': 'application/json' },
              //   body: JSON.stringify(subscription)
              // });
            } catch (subscribeError) {
              // Push subscription requires real VAPID keys to succeed - not configured yet.
            }
          }
        }

        // Show welcome notification
        showWelcomeNotification();
      }
    } catch (error) {
      setShowNotificationPrompt(false);
    }
  };

  const showWelcomeNotification = () => {
    if (permission === 'granted') {
      new Notification('Welcome to IronLog! 💪', {
        body: "You'll now receive workout reminders and updates",
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: 'welcome',
      });
    }
  };

  const testNotification = () => {
    if (permission === 'granted') {
      new Notification('Test Notification 🔔', {
        body: 'Your PWA notifications are working perfectly!',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: 'test',
      });
    }
  };

  if (!showNotificationPrompt && permission !== 'granted') return null;

  return (
    <>
      {showNotificationPrompt && (
        <div className="fixed top-4 left-4 right-4 z-[9999] md:left-auto md:right-4 md:w-80">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 backdrop-blur-sm">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xl">🔔</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  Enable Notifications
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Get workout reminders and progress updates
                </p>
                <div className="flex space-x-2 mt-3">
                  <button
                    onClick={requestNotificationPermission}
                    className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded transition-colors"
                  >
                    Enable
                  </button>
                  <button
                    onClick={() => setShowNotificationPrompt(false)}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-medium rounded transition-colors"
                  >
                    Not now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test notification button for debugging */}
      {permission === 'granted' && process.env.NODE_ENV === 'development' && (
        <button
          onClick={testNotification}
          className="fixed bottom-4 left-4 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-xs font-medium z-40"
        >
          Test Notification
        </button>
      )}
    </>
  );
}
