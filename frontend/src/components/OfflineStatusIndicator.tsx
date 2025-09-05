import React from 'react';
import { useOfflineCapability } from '../contexts/OfflineCapabilityContext';

export const OfflineStatusIndicator: React.FC = () => {
  const { isOnline, syncStatus, queuedActions } = useOfflineCapability();

  if (isOnline && syncStatus === 'synced') return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-sm text-center text-white ${
      !isOnline ? 'bg-red-600' : 
      syncStatus === 'syncing' ? 'bg-yellow-600' : 
      'bg-blue-600'
    }`}>
      {!isOnline ? (
        <span>📡 Offline - {queuedActions.length} actions queued</span>
      ) : syncStatus === 'syncing' ? (
        <span>🔄 Syncing changes...</span>
      ) : (
        <span>⏳ {queuedActions.length} actions pending sync</span>
      )}
    </div>
  );
};