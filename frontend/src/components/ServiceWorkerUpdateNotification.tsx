// 3. Create frontend/src/components/ServiceWorkerUpdateNotification.tsx
import React, { useState, useEffect } from 'react';
import { useOfflineCapability } from '../contexts/OfflineCapabilityContext';

export const ServiceWorkerUpdateNotification: React.FC = () => {
  const { serviceWorkerState } = useOfflineCapability();
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    if (serviceWorkerState.updateAvailable) {
      setShowUpdate(true);
    }
  }, [serviceWorkerState.updateAvailable]);

  if (!showUpdate) return null;

  const handleUpdate = () => {
    // Skip waiting and reload
    if (serviceWorkerState.registration?.waiting) {
      serviceWorkerState.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  return (
    <div className="fixed top-4 right-4 bg-green-600 text-white rounded-lg shadow-lg p-4 max-w-sm z-50 animate-slide-down">
      <div className="flex items-start gap-3">
        <div className="text-xl">🎉</div>
        <div className="flex-1">
          <h4 className="font-semibold">Update Available!</h4>
          <p className="text-sm opacity-90 mt-1">
            A new version of OpsHub is ready to install.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleUpdate}
              className="px-3 py-1 bg-white text-green-600 text-sm rounded hover:bg-gray-100 font-medium"
            >
              Update Now
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-1 text-white text-sm hover:bg-green-700 rounded"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};