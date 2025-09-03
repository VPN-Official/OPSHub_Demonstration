// src/providers/AppProviders.tsx
import React, { ReactNode } from 'react';
import { TenantProvider } from './TenantProvider';
import { ConfigProvider } from './ConfigProvider';
import { SyncProvider } from './SyncProvider';
import { NotificationProvider } from './NotificationProvider';
import { AuditLogsProvider } from './AuditLogsProvider';
import { ActivityTimelineProvider } from './ActivityTimelineProvider';
import { ThemeProvider } from './ThemeProvider';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Main provider composition following the canonical order:
 * 1. ThemeProvider (outermost - affects all UI)
 * 2. TenantProvider (core tenant context)
 * 3. ConfigProvider (depends on tenant)
 * 4. SyncProvider (depends on tenant)
 * 5. NotificationProvider (depends on tenant + sync)
 * 6. AuditLogsProvider (depends on tenant)
 * 7. ActivityTimelineProvider (innermost - depends on all audit/activity)
 */
export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <ThemeProvider>
      <TenantProvider>
        <ConfigProvider>
          <SyncProvider>
            <NotificationProvider>
              <AuditLogsProvider>
                <ActivityTimelineProvider>
                  {children}
                </ActivityTimelineProvider>
              </AuditLogsProvider>
            </NotificationProvider>
          </SyncProvider>
        </ConfigProvider>
      </TenantProvider>
    </ThemeProvider>
  );
};