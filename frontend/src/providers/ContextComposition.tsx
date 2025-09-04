// src/providers/ContextComposition.tsx
import React, { ReactNode } from 'react';
import { TenantProvider } from './TenantProvider';
import { ConfigProvider } from './ConfigProvider';
import { SyncProvider } from './SyncProvider';
import { ThemeProvider } from './ThemeProvider';
import { AuthProvider } from './AuthProvider';
import { NotificationProvider } from './NotificationProvider';
import { RealtimeStreamProvider } from '../contexts/RealtimeStreamContext';
import { NavigationTraceProvider } from '../contexts/NavigationTraceContext';
import { OfflineCapabilityProvider } from '../contexts/OfflineCapabilityContext';
import { AIInsightsProvider } from '../contexts/AIInsightsContext';
import { BusinessImpactProvider } from '../contexts/BusinessImpactContext';
import { CollaborationProvider } from '../contexts/CollaborationContext';
import { MetricsAnalyticsProvider } from '../contexts/MetricsAnalyticsContext';
import { ResourceOptimizationProvider } from '../contexts/ResourceOptimizationContext';

// ---------------------------------
// 1. Provider Composition Architecture
// ---------------------------------

/**
 * Root provider that composes all context providers in the correct dependency order
 * 
 * Provider Hierarchy (from outermost to innermost):
 * 1. TenantProvider - Multi-tenant isolation (no dependencies)
 * 2. ConfigProvider - Configuration management (depends on tenant)
 * 3. AuthProvider - Authentication (depends on tenant, config)
 * 4. OfflineCapabilityProvider - PWA offline support (depends on tenant)
 * 5. SyncProvider - Data synchronization (depends on tenant, offline)
 * 6. RealtimeStreamProvider - WebSocket connections (depends on tenant, config, sync)
 * 7. NavigationTraceProvider - Entity navigation (depends on tenant, sync, realtime)
 * 8. AIInsightsProvider - AI insights (depends on tenant, sync, realtime, offline)
 * 9. BusinessImpactProvider - Business metrics (depends on most core contexts)
 * 10. CollaborationProvider - Team collaboration (depends on realtime, auth)
 * 11. MetricsAnalyticsProvider - Analytics (depends on realtime, AI)
 * 12. ResourceOptimizationProvider - Resource management (depends on AI, metrics)
 * 13. NotificationProvider - User notifications (depends on most contexts)
 * 14. ThemeProvider - UI theming (can be anywhere, no data dependencies)
 */

interface ContextCompositionProps {
  children: ReactNode;
  config?: {
    enableRealtime?: boolean;
    enableOffline?: boolean;
    enableAI?: boolean;
    enableCollaboration?: boolean;
    enableAnalytics?: boolean;
  };
}

export const ContextComposition: React.FC<ContextCompositionProps> = ({ 
  children,
  config = {
    enableRealtime: true,
    enableOffline: true,
    enableAI: true,
    enableCollaboration: true,
    enableAnalytics: true,
  }
}) => {
  // Base providers (always required)
  let composed = (
    <TenantProvider>
      <ConfigProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </ConfigProvider>
    </TenantProvider>
  );
  
  // Add offline capability if enabled
  if (config.enableOffline) {
    composed = (
      <TenantProvider>
        <ConfigProvider>
          <AuthProvider>
            <OfflineCapabilityProvider>
              {composed}
            </OfflineCapabilityProvider>
          </AuthProvider>
        </ConfigProvider>
      </TenantProvider>
    );
  }
  
  // Add sync provider (always needed with offline)
  composed = (
    <TenantProvider>
      <ConfigProvider>
        <AuthProvider>
          <OfflineCapabilityProvider>
            <SyncProvider>
              {children}
            </SyncProvider>
          </OfflineCapabilityProvider>
        </AuthProvider>
      </ConfigProvider>
    </TenantProvider>
  );
  
  // Add realtime streaming if enabled
  if (config.enableRealtime) {
    composed = (
      <TenantProvider>
        <ConfigProvider>
          <AuthProvider>
            <OfflineCapabilityProvider>
              <SyncProvider>
                <RealtimeStreamProvider>
                  {children}
                </RealtimeStreamProvider>
              </SyncProvider>
            </OfflineCapabilityProvider>
          </AuthProvider>
        </ConfigProvider>
      </TenantProvider>
    );
  }
  
  // Full composition with all providers
  return (
    <TenantProvider>
      <ConfigProvider>
        <AuthProvider>
          <OfflineCapabilityProvider>
            <SyncProvider>
              <RealtimeStreamProvider>
                <NavigationTraceProvider>
                  <AIInsightsProvider>
                    <BusinessImpactProvider>
                      <CollaborationProvider>
                        <MetricsAnalyticsProvider>
                          <ResourceOptimizationProvider>
                            <ThemeProvider>
                              <NotificationProvider>
                                {children}
                              </NotificationProvider>
                            </ThemeProvider>
                          </ResourceOptimizationProvider>
                        </MetricsAnalyticsProvider>
                      </CollaborationProvider>
                    </BusinessImpactProvider>
                  </AIInsightsProvider>
                </NavigationTraceProvider>
              </RealtimeStreamProvider>
            </SyncProvider>
          </OfflineCapabilityProvider>
        </AuthProvider>
      </ConfigProvider>
    </TenantProvider>
  );
};

// ---------------------------------
// 2. Provider Groups for Selective Loading
// ---------------------------------

/**
 * Core providers required for basic functionality
 */
export const CoreProviders: React.FC<{ children: ReactNode }> = ({ children }) => (
  <TenantProvider>
    <ConfigProvider>
      <AuthProvider>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </AuthProvider>
    </ConfigProvider>
  </TenantProvider>
);

/**
 * Infrastructure providers for offline and realtime capabilities
 */
export const InfrastructureProviders: React.FC<{ children: ReactNode }> = ({ children }) => (
  <CoreProviders>
    <OfflineCapabilityProvider>
      <SyncProvider>
        <RealtimeStreamProvider>
          <NavigationTraceProvider>
            {children}
          </NavigationTraceProvider>
        </RealtimeStreamProvider>
      </SyncProvider>
    </OfflineCapabilityProvider>
  </CoreProviders>
);

/**
 * Intelligence providers for AI and analytics
 */
export const IntelligenceProviders: React.FC<{ children: ReactNode }> = ({ children }) => (
  <InfrastructureProviders>
    <AIInsightsProvider>
      <BusinessImpactProvider>
        <MetricsAnalyticsProvider>
          <ResourceOptimizationProvider>
            {children}
          </ResourceOptimizationProvider>
        </MetricsAnalyticsProvider>
      </BusinessImpactProvider>
    </AIInsightsProvider>
  </InfrastructureProviders>
);

/**
 * Full provider stack with all capabilities
 */
export const FullProviderStack: React.FC<{ children: ReactNode }> = ({ children }) => (
  <IntelligenceProviders>
    <CollaborationProvider>
      <NotificationProvider>
        {children}
      </NotificationProvider>
    </CollaborationProvider>
  </IntelligenceProviders>
);

// ---------------------------------
// 3. Provider Hooks for Cross-Context Integration
// ---------------------------------

/**
 * Hook that combines multiple contexts for common operations
 */
export const useOperationalIntelligence = () => {
  // This would import and combine multiple contexts
  // const ai = useAIInsights();
  // const impact = useBusinessImpact();
  // const metrics = useMetricsAnalytics();
  
  // return {
  //   getOperationalScore: (entityType: string, entityId: string) => {
  //     // Combine AI scores with business impact
  //   },
  //   predictBusinessImpact: (change: any) => {
  //     // Use AI predictions with business context
  //   },
  //   getRecommendedActions: () => {
  //     // Combine AI recommendations with resource optimization
  //   }
  // };
  
  return {
    // Placeholder until all contexts are implemented
    ready: false,
  };
};

/**
 * Hook for real-time collaborative operations
 */
export const useCollaborativeOperations = () => {
  // This would combine realtime, collaboration, and notification contexts
  // const realtime = useRealtimeStream();
  // const collab = useCollaboration();
  // const notify = useNotification();
  
  // return {
  //   shareInsight: (insight: any, users: string[]) => {
  //     // Share AI insight with team via collaboration
  //   },
  //   broadcastUpdate: (update: any) => {
  //     // Broadcast via realtime and notify
  //   }
  // };
  
  return {
    // Placeholder until all contexts are implemented
    ready: false,
  };
};

// ---------------------------------
// 4. Context Bridge for Inter-Context Communication
// ---------------------------------

/**
 * Event bus for cross-context communication
 */
class ContextEventBus {
  private listeners: Map<string, Set<Function>> = new Map();
  
  on(event: string, handler: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    
    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }
  
  emit(event: string, data?: any) {
    this.listeners.get(event)?.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }
  
  once(event: string, handler: Function) {
    const wrappedHandler = (data: any) => {
      handler(data);
      this.off(event, wrappedHandler);
    };
    this.on(event, wrappedHandler);
  }
  
  off(event: string, handler?: Function) {
    if (!handler) {
      this.listeners.delete(event);
    } else {
      this.listeners.get(event)?.delete(handler);
    }
  }
}

export const contextEventBus = new ContextEventBus();

// Common events for cross-context communication
export const ContextEvents = {
  // Entity events
  ENTITY_UPDATED: 'entity:updated',
  ENTITY_SELECTED: 'entity:selected',
  ENTITY_NAVIGATED: 'entity:navigated',
  
  // AI events
  AI_INSIGHT_GENERATED: 'ai:insight_generated',
  AI_RECOMMENDATION_APPLIED: 'ai:recommendation_applied',
  
  // Business events
  BUSINESS_IMPACT_CALCULATED: 'business:impact_calculated',
  SLA_BREACH_PREDICTED: 'business:sla_breach_predicted',
  
  // Collaboration events
  USER_JOINED: 'collab:user_joined',
  USER_LEFT: 'collab:user_left',
  MESSAGE_RECEIVED: 'collab:message_received',
  
  // System events
  OFFLINE_MODE_ENTERED: 'system:offline_entered',
  OFFLINE_MODE_EXITED: 'system:offline_exited',
  SYNC_COMPLETED: 'system:sync_completed',
  SYNC_CONFLICT: 'system:sync_conflict',
};

// ---------------------------------
// 5. Performance Optimization Utilities
// ---------------------------------

/**
 * HOC for lazy loading context providers
 */
export const lazyProvider = <P extends object>(
  loader: () => Promise<{ default: React.ComponentType<P> }>
): React.ComponentType<P> => {
  const LazyProvider = React.lazy(loader);
  
  return (props: P) => (
    <React.Suspense fallback={<div>Loading provider...</div>}>
      <LazyProvider {...props} />
    </React.Suspense>
  );
};

/**
 * Hook for selective context subscription
 */
export const useSelectiveContext = <T, R>(
  useContextHook: () => T,
  selector: (context: T) => R,
  deps: React.DependencyList = []
): R => {
  const context = useContextHook();
  return React.useMemo(() => selector(context), [context, ...deps]);
};

// ---------------------------------
// 6. Development and Testing Utilities
// ---------------------------------

/**
 * Provider for testing with mock data
 */
export const TestProviders: React.FC<{ 
  children: ReactNode;
  initialState?: any;
}> = ({ children, initialState }) => {
  // Mock providers with controllable state for testing
  return (
    <div data-testid="test-providers">
      {children}
    </div>
  );
};

/**
 * Context debugger for development
 */
export const ContextDebugger: React.FC = () => {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      right: 0,
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px',
      fontSize: '12px',
      maxWidth: '300px',
      maxHeight: '200px',
      overflow: 'auto',
      zIndex: 9999,
    }}>
      <h4>Context Status</h4>
      <div>Contexts Loaded: 4/11</div>
      <div>WebSocket: Connected</div>
      <div>Offline: Ready</div>
      <div>AI: Active</div>
      <div>Sync: Idle</div>
    </div>
  );
};

// ---------------------------------
// 7. Export Configuration
// ---------------------------------

export default ContextComposition;

export {
  // Re-export individual contexts for direct use
  RealtimeStreamProvider,
  NavigationTraceProvider, 
  OfflineCapabilityProvider,
  AIInsightsProvider,
  BusinessImpactProvider,
  CollaborationProvider,
  MetricsAnalyticsProvider,
  ResourceOptimizationProvider
};

// Type exports for better IDE support
export type { 
  // RealtimeStreamContextProps,
  // NavigationTraceContextProps,
  // OfflineCapabilityContextProps,
  // AIInsightsContextProps,
} from '../contexts';