// src/providers/AppProviders.tsx
import React, { ReactNode } from 'react';
import { TenantProvider } from './TenantProvider';
import { ConfigProvider } from './ConfigProvider';
import { SyncProvider } from './SyncProvider';
import { NotificationProvider } from './NotificationProvider';
import { AuditLogsProvider } from './AuditLogsProvider';
import { ActivityTimelineProvider } from './ActivityTimelineProvider';
import { ThemeProvider } from './ThemeProvider';
import { OfflineCapabilityProvider } from '../contexts/OfflineCapabilityContext';
import { RealtimeStreamProvider } from '../contexts/RealtimeStreamContext';

// Import entity context providers
import { IncidentsProvider } from '../contexts/IncidentsContext';
import { ProblemsProvider } from '../contexts/ProblemsContext';
import { ChangeRequestsProvider } from '../contexts/ChangeRequestsContext';
import { ServiceRequestsProvider } from '../contexts/ServiceRequestsContext';
import { AlertsProvider } from '../contexts/AlertsContext';
import { MaintenanceProvider } from '../contexts/MaintenanceContext';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Main provider composition following the canonical order:
 * 1. ThemeProvider (outermost - affects all UI)
 * 2. TenantProvider (core tenant context)
 * 3. ConfigProvider (depends on tenant)
 * 4. SyncProvider (depends on tenant)
 * 5. RealtimeStreamProvider (depends on sync)
 * 6. OfflineCapabilityProvider (depends on sync and realtime)
 * 7. NotificationProvider (depends on tenant + sync)
 * 8. AuditLogsProvider (depends on tenant)
 * 9. ActivityTimelineProvider (depends on audit)
 * 10. Entity Providers (depend on all infrastructure providers)
 */
export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <ThemeProvider>
      <TenantProvider>
        <ConfigProvider>
          <SyncProvider>
            <RealtimeStreamProvider>
              <OfflineCapabilityProvider>
                <NotificationProvider>
                  <AuditLogsProvider>
                    <ActivityTimelineProvider>
                      {/* Entity context providers */}
                      <IncidentsProvider>
                        <ProblemsProvider>
                          <ChangeRequestsProvider>
                            <ServiceRequestsProvider>
                              <AlertsProvider>
                                <MaintenanceProvider>
                                  {children}
                                </MaintenanceProvider>
                              </AlertsProvider>
                            </ServiceRequestsProvider>
                          </ChangeRequestsProvider>
                        </ProblemsProvider>
                      </IncidentsProvider>
                    </ActivityTimelineProvider>
                  </AuditLogsProvider>
                </NotificationProvider>
              </OfflineCapabilityProvider>
            </RealtimeStreamProvider>
          </SyncProvider>
        </ConfigProvider>
      </TenantProvider>
    </ThemeProvider>
  );
};