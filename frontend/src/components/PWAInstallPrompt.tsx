// 1. Create frontend/src/components/PWAInstallPrompt.tsx
import React, { useState, useEffect } from 'react';
import { useOfflineCapability } from '../contexts/OfflineCapabilityContext';

export const PWAInstallPrompt: React.FC = () => {
  const { installPrompt, isInstalled, promptInstall } = useOfflineCapability();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if user previously dismissed the prompt
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      setIsDismissed(true);
      return;
    }

    // Show install prompt after user has used the app for a bit
    const timer = setTimeout(() => {
      if (installPrompt && !isInstalled && !isDismissed) {
        setShowPrompt(true);
      }
    }, 30000); // Show after 30 seconds

    return () => clearTimeout(timer);
  }, [installPrompt, isInstalled, isDismissed]);

  // Don't show if already installed, dismissed, or no prompt available
  if (!showPrompt || isInstalled || !installPrompt) return null;

  const handleInstall = async () => {
    try {
      await promptInstall();
      setShowPrompt(false);
    } catch (error) {
      console.error('PWA install failed:', error);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setIsDismissed(true);
    // Remember user dismissed it (for 7 days)
    const dismissedUntil = new Date();
    dismissedUntil.setDate(dismissedUntil.getDate() + 7);
    localStorage.setItem('pwa-install-dismissed', dismissedUntil.toISOString());
  };

  const handleLater = () => {
    setShowPrompt(false);
    // Show again in 24 hours
    const showAgainAt = new Date();
    showAgainAt.setHours(showAgainAt.getHours() + 24);
    localStorage.setItem('pwa-install-remind', showAgainAt.toISOString());
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 z-50 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="text-2xl">📱</div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Install OpsHub App
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Install OpsHub for faster access, offline capabilities, and native app experience.
          </p>
          
          {/* Features list */}
          <ul className="text-xs text-gray-500 dark:text-gray-400 mt-2 space-y-1">
            <li>✓ Works offline with sync when connected</li>
            <li>✓ Push notifications for critical incidents</li>
            <li>✓ Faster loading and app-like experience</li>
          </ul>
          
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleInstall}
              className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              Install App
            </button>
            <button
              onClick={handleLater}
              className="px-3 py-2 text-gray-600 dark:text-gray-400 text-sm hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Later
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-2 text-gray-500 dark:text-gray-500 text-sm hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              title="Don't show for 7 days"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};