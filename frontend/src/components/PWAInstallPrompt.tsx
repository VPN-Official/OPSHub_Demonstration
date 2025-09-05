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

// 2. Create frontend/src/components/OfflineStatusIndicator.tsx
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

  const handleClick = () => {
    // Navigate to sync/conflicts page or show sync details
    if (syncConflicts.length > 0) {
      // Could open conflicts resolution modal
      console.log('Navigate to conflict resolution');
    } else {
      // Could show sync queue details
      console.log('Show sync queue details');
    }
  };

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-3 text-sm text-center text-white cursor-pointer transition-all duration-300 ${statusConfig.bgColor}`}
      onClick={handleClick}
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

// 4. Update your main App.tsx or AppLayout.tsx
import React, { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../providers/ThemeProvider';
import { useNotifications } from '../providers/NotificationProvider';
import { useOfflineCapability } from '../contexts/OfflineCapabilityContext';

// Import PWA components
import { PWAInstallPrompt } from '../components/PWAInstallPrompt';
import { OfflineStatusIndicator } from '../components/OfflineStatusIndicator';
import { ServiceWorkerUpdateNotification } from '../components/ServiceWorkerUpdateNotification';

export const AppLayout = ({ children }: { children?: ReactNode }) => {
  const { mode, toggleTheme } = useTheme();
  const { activeCount } = useNotifications();
  const { serviceWorkerState } = useOfflineCapability();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Handle service worker controller changes (updates)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleControllerChange = () => {
        console.log('[App] Service worker updated, reloading...');
        window.location.reload();
      };

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
      
      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      };
    }
  }, []);

  // Handle PWA display mode changes
  useEffect(() => {
    const handleDisplayModeChange = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      if (isStandalone) {
        document.body.classList.add('pwa-standalone');
      } else {
        document.body.classList.remove('pwa-standalone');
      }
    };

    handleDisplayModeChange();
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', handleDisplayModeChange);

    return () => {
      mediaQuery.removeEventListener('change', handleDisplayModeChange);
    };
  }, []);

  const menuItems = [
    { 
      label: "Pulse", 
      icon: "📊", 
      path: "/pulse",
      active: location.pathname === "/pulse"
    },
    { 
      label: "SmartQueue", 
      icon: "📋", 
      path: "/smartqueue",
      active: location.pathname === "/smartqueue"  
    },
    { 
      label: "Schedule", 
      icon: "📅", 
      path: "/schedule",
      active: location.pathname === "/schedule"
    },
    { 
      label: "Intelligence", 
      icon: "🤖", 
      path: "/intelligence",
      active: location.pathname === "/intelligence"
    },
    { 
      label: "Notifications", 
      icon: "🔔", 
      path: "/notifications",
      active: location.pathname === "/notifications"
    },
  ];

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* PWA Status and Update Components */}
      <OfflineStatusIndicator />
      <ServiceWorkerUpdateNotification />
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed md:relative z-50 md:z-auto
        w-64 h-full bg-white dark:bg-gray-900 
        border-r border-gray-200 dark:border-gray-700
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              🚀 OpsHub
            </h1>
            <button 
              className="md:hidden text-gray-500"
              onClick={() => setSidebarOpen(false)}
            >
              ✕
            </button>
          </div>
          
          <nav className="space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left
                  transition-colors duration-200
                  ${item.active 
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }
                `}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
                {item.label === "Notifications" && activeCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-1">
                    {activeCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              className="md:hidden text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              onClick={() => setSidebarOpen(true)}
            >
              <span className="text-xl">☰</span>
            </button>
            
            <div className="flex items-center gap-4">
              {/* Service Worker Status Indicator */}
              {serviceWorkerState.registration && (
                <div className={`w-2 h-2 rounded-full ${
                  serviceWorkerState.updateAvailable 
                    ? 'bg-green-500' 
                    : serviceWorkerState.isControlled 
                    ? 'bg-blue-500' 
                    : 'bg-gray-400'
                }`} title={
                  serviceWorkerState.updateAvailable 
                    ? 'Update available' 
                    : serviceWorkerState.isControlled 
                    ? 'Service worker active' 
                    : 'Service worker loading'
                } />
              )}
              
              <button
                onClick={toggleTheme}
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {mode === 'light' ? '🌙' : '☀️'}
              </button>
              
              <button className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <span className="text-lg">👤</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children || <Outlet />}
        </main>
      </div>
      
      {/* PWA Install Prompt - shown at the bottom */}
      <PWAInstallPrompt />
    </div>
  );
};

// 5. Add these CSS animations to your global CSS file (frontend/src/index.css or tailwind.css)
/*
Add these animations to your CSS:

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slide-down {
  from {
    opacity: 0;
    transform: translateY(-100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slide-up {
  animation: slide-up 0.3s ease-out;
}

.animate-slide-down {
  animation: slide-down 0.3s ease-out;
}

/* PWA-specific styles
.pwa-standalone {
  /* Styles for when app is installed and running standalone
  --safe-area-inset-top: env(safe-area-inset-top);
  --safe-area-inset-bottom: env(safe-area-inset-bottom);
}

.pwa-standalone .fixed.top-0 {
  top: var(--safe-area-inset-top, 0);
}
*/