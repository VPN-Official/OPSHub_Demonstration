import React from 'react';
import { useOfflineCapability } from '../contexts/OfflineCapabilityContext';

export const OfflineStatusIndicator: React.FC = () => {
  const { 
    isOnline, 
    syncStatus, 
    queuedActions, 
    syncProgress,
    syncConflicts 
  } = useOfflineCapability();

  // Don't show when fully online and synced
  if (isOnline && syncStatus === 'synced' && queuedActions.length === 0) return null;

  const getStatusConfig = () => {
    if (!isOnline) {
      return {
        bgColor: 'bg-red-600',
        icon: '📡',
        message: `Offline - ${queuedActions.length} actions queued`,
        details: 'Changes will sync when connection is restored'
      };
    }
    
    if (syncStatus === 'syncing') {
      return {
        bgColor: 'bg-blue-600',
        icon: '🔄',
        message: `Syncing... ${syncProgress}%`,
        details: `Processing ${queuedActions.length} queued actions`
      };
    }
    
    if (syncConflicts.length > 0) {
      return {
        bgColor: 'bg-orange-600',
        icon: '⚠️',
        message: `${syncConflicts.length} sync conflicts`,
        details: 'Tap to resolve conflicts'
      };
    }
    
    if (queuedActions.length > 0) {
      return {
        bgColor: 'bg-yellow-600',
        icon: '⏳',
        message: `${queuedActions.length} actions pending sync`,
        details: 'Will sync automatically when possible'
      };
    }

    return null;
  };

  const statusConfig = getStatusConfig();
  if (!statusConfig) return null;

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-3 text-sm text-center text-white cursor-pointer transition-all duration-300 ${statusConfig.bgColor}`}
    >
      <div className="flex items-center justify-center gap-2">
        <span className="animate-pulse">{statusConfig.icon}</span>
        <div>
          <div className="font-medium">{statusConfig.message}</div>
          <div className="text-xs opacity-90">{statusConfig.details}</div>
        </div>
        {syncStatus === 'syncing' && (
          <div className="ml-4 w-16 bg-white bg-opacity-20 rounded-full h-2">
            <div 
              className="bg-white h-2 rounded-full transition-all duration-300"
              style={{ width: `${syncProgress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};