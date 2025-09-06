// src/contexts/OfflineCapabilityContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  getAll,
  getById,
  putWithAudit,
  removeWithAudit,
} from "../db/dbClient";
import type { AIOpsDB } from "../db/seedIndexedDB";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useRealtimeStream } from "./RealtimeStreamContext";
import { ExternalSystemFields } from "../types/externalSystem";

// ---------------------------------
// 1. Connection & Sync Types
// ---------------------------------

export type ConnectivityQuality = 'high' | 'medium' | 'low' | 'offline';
export type SyncStatus = 'synced' | 'pending' | 'conflicts' | 'error' | 'syncing';

export interface NetworkInfo {
  effectiveType?: '4g' | '3g' | '2g' | 'slow-2g';
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

export interface QueuedAction extends ExternalSystemFields {
  id: string;
  actionType: string;
  entityType?: string;
  entityId?: string;
  payload: any;
  metadata?: Record<string, any>;
  queuedAt: string;
  attemptCount: number;
  lastAttemptAt?: string;
  error?: string;
  priority: 'high' | 'normal' | 'low';
  expiresAt?: string;
}

export interface OfflineAction extends Omit<QueuedAction, 'id' | 'queuedAt' | 'attemptCount'> {
  optimisticUpdate?: OptimisticUpdate;
  conflictResolution?: 'local' | 'remote' | 'merge' | 'ask';
}

export interface OptimisticUpdate {
  storeName: string;
  key: string | string[];
  value: any;
  rollbackValue?: any;
}

// ---------------------------------
// 2. Conflict Resolution Types
// ---------------------------------

export interface SyncConflict {
  id: string;
  entityType: string;
  entityId: string;
  conflictType: 'version' | 'delete' | 'constraint' | 'business';
  localValue: any;
  remoteValue: any;
  baseValue?: any;
  localTimestamp: string;
  remoteTimestamp: string;
  autoResolvable: boolean;
  suggestedResolution?: 'local' | 'remote' | 'merge';
  mergedValue?: any;
  metadata?: Record<string, any>;
}

export interface ConflictResolution {
  conflictId: string;
  resolution: 'local' | 'remote' | 'merge' | 'custom';
  customValue?: any;
  reason?: string;
}

// ---------------------------------
// 3. Critical Data Management Types
// ---------------------------------

export interface CriticalDataCache {
  id: string;
  dataType: string;
  entityType?: string;
  entityIds?: string[];
  lastSyncedAt: string;
  expiresAt?: string;
  size: number;
  priority: 'critical' | 'important' | 'normal';
  updateFrequency: 'realtime' | 'frequent' | 'periodic' | 'static';
  compressionEnabled?: boolean;
}

export interface OfflineCapability {
  id: string;
  feature: string;
  availableOffline: boolean;
  degradedMode?: boolean;
  limitations?: string[];
  requiredData?: string[];
  fallbackBehavior?: string;
}

export interface DegradedCapability {
  feature: string;
  status: 'available' | 'limited' | 'unavailable';
  limitations: string[];
  alternativeAction?: string;
  estimatedAvailability?: string;
}

// ---------------------------------
// 4. Service Worker Types
// ---------------------------------

export interface ServiceWorkerState {
  registration: ServiceWorkerRegistration | null;
  updateAvailable: boolean;
  isControlled: boolean;
  scriptURL?: string;
}

export interface CacheStrategy {
  name: string;
  pattern: RegExp | string;
  strategy: 'cache-first' | 'network-first' | 'cache-only' | 'network-only' | 'stale-while-revalidate';
  cacheName?: string;
  maxAge?: number;
  maxEntries?: number;
}

// ---------------------------------
// 5. Background Sync Types
// ---------------------------------

export interface BackgroundSyncTask {
  id: string;
  tag: string;
  data: any;
  createdAt: string;
  lastSyncAttempt?: string;
  nextRetry?: string;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'syncing' | 'success' | 'failed';
}

// ---------------------------------
// 6. Offline Context Interface
// ---------------------------------

export interface OfflineCapabilityContextProps {
  // Connection state
  isOnline: boolean;
  lastOnlineAt: string | null;
  connectivityQuality: ConnectivityQuality;
  networkInfo: NetworkInfo | null;

  // Sync management
  syncStatus: SyncStatus;
  queuedActions: QueuedAction[];
  syncConflicts: SyncConflict[];
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  syncProgress: number; // 0-100

  // Offline actions
  enqueueAction: (action: OfflineAction) => Promise<string>;
  dequeueAction: (actionId: string) => Promise<void>;
  replayQueuedActions: () => Promise<void>;
  clearQueue: () => Promise<void>;
  retryFailedActions: () => Promise<void>;

  // Conflict resolution
  resolveConflicts: (resolutions: ConflictResolution[]) => Promise<void>;
  acceptRemoteChanges: (conflictIds: string[]) => Promise<void>;
  acceptLocalChanges: (conflictIds: string[]) => Promise<void>;
  autoResolveConflicts: () => Promise<number>;
  getConflictDetails: (conflictId: string) => SyncConflict | null;

  // Critical data caching
  criticalDataSets: CriticalDataCache[];
  offlineCapabilities: OfflineCapability[];
  refreshCriticalData: (dataTypes?: string[]) => Promise<void>;
  getCacheSize: () => Promise<number>;
  clearCache: (dataTypes?: string[]) => Promise<void>;
  preloadData: (entities: Array<{ type: string; ids?: string[] }>) => Promise<void>;

  // Degraded mode operations
  getDegradedCapabilities: () => DegradedCapability[];
  isFeatureAvailableOffline: (feature: string) => boolean;
  getFeatureLimitations: (feature: string) => string[];

  // Service Worker management
  serviceWorkerState: ServiceWorkerState;
  registerServiceWorker: () => Promise<void>;
  updateServiceWorker: () => Promise<void>;
  skipWaiting: () => Promise<void>;

  // Background sync
  backgroundSyncTasks: BackgroundSyncTask[];
  scheduleBackgroundSync: (tag: string, data: any) => Promise<void>;
  cancelBackgroundSync: (taskId: string) => Promise<void>;

  // PWA features
  installPrompt: any | null; // BeforeInstallPromptEvent
  canInstall: boolean;
  isInstalled: boolean;
  promptInstall: () => Promise<void>;

  // Utilities
  getOfflineStatistics: () => OfflineStatistics;
  exportOfflineData: () => Promise<Blob>;
  importOfflineData: (data: Blob) => Promise<void>;
}

export interface OfflineStatistics {
  queueSize: number;
  cacheSize: number;
  conflictCount: number;
  lastSyncDuration?: number;
  failedSyncCount: number;
  successfulSyncCount: number;
  averageSyncTime?: number;
  dataFreshness: Record<string, number>; // Age in seconds
}

// ---------------------------------
// 7. Offline Queue Manager
// ---------------------------------

class OfflineQueueManager {
  private queue: Map<string, QueuedAction> = new Map();
  private dbName: string;
  private processingQueue: boolean = false;

  constructor(dbName: string) {
    this.dbName = dbName;
    this.loadQueue();
  }

  private async loadQueue() {
    try {
      const stored = localStorage.getItem(`${this.dbName}_offline_queue`);
      if (stored) {
        const items = JSON.parse(stored);
        items.forEach((item: QueuedAction) => {
          this.queue.set(item.id, item);
        });
      }
    } catch (error) {
      console.error('[OfflineQueue] Failed to load queue:', error);
    }
  }

  private async saveQueue() {
    try {
      const items = Array.from(this.queue.values());
      localStorage.setItem(`${this.dbName}_offline_queue`, JSON.stringify(items));
    } catch (error) {
      console.error('[OfflineQueue] Failed to save queue:', error);
    }
  }

  public async enqueue(action: OfflineAction): Promise<string> {
    const id = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const queuedAction: QueuedAction = {
      ...action,
      id,
      queuedAt: new Date().toISOString(),
      attemptCount: 0,
    };

    // Apply optimistic update if provided
    if (action.optimisticUpdate) {
      await this.applyOptimisticUpdate(action.optimisticUpdate);
    }

    this.queue.set(id, queuedAction);
    await this.saveQueue();

    return id;
  }

  public async dequeue(actionId: string): Promise<void> {
    const action = this.queue.get(actionId);
    if (action && action.payload.optimisticUpdate) {
      // Rollback optimistic update
      await this.rollbackOptimisticUpdate(action.payload.optimisticUpdate);
    }

    this.queue.delete(actionId);
    await this.saveQueue();
  }

  public getQueue(): QueuedAction[] {
    return Array.from(this.queue.values()).sort((a, b) => {
      // Sort by priority then by queued time
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      return new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime();
    });
  }

  public async processQueue(
    executor: (action: QueuedAction) => Promise<void>,
    onConflict?: (conflict: SyncConflict) => void
  ): Promise<void> {
    if (this.processingQueue) return;

    this.processingQueue = true;
    const actions = this.getQueue();

    for (const action of actions) {
      try {
        // Check if action has expired
        if (action.expiresAt && new Date(action.expiresAt) < new Date()) {
          await this.dequeue(action.id);
          continue;
        }

        // Update attempt count
        action.attemptCount++;
        action.lastAttemptAt = new Date().toISOString();

        // Execute action
        await executor(action);

        // Success - remove from queue
        await this.dequeue(action.id);
      } catch (error: any) {
        console.error(`[OfflineQueue] Failed to process action ${action.id}:`, error);

        // Check if it's a conflict
        if (error.type === 'conflict' && onConflict) {
          onConflict({
            id: `conflict_${action.id}`,
            entityType: action.entityType || '',
            entityId: action.entityId || '',
            conflictType: 'version',
            localValue: action.payload,
            remoteValue: error.remoteValue,
            localTimestamp: action.queuedAt,
            remoteTimestamp: error.remoteTimestamp,
            autoResolvable: false,
          });
        } else {
          // Update error in queue
          action.error = error.message;
          this.queue.set(action.id, action);
        }
      }
    }

    await this.saveQueue();
    this.processingQueue = false;
  }

  private async applyOptimisticUpdate(update: OptimisticUpdate) {
    // Store rollback value
    try {
      const current = await getById('default', update.storeName as keyof AIOpsDB, update.key as string);
      update.rollbackValue = current;
    } catch {
      // No existing value
    }

    // Apply optimistic update
    await putWithAudit('default', update.storeName as keyof AIOpsDB, update.value, 'system');
  }

  private async rollbackOptimisticUpdate(update: OptimisticUpdate) {
    if (update.rollbackValue !== undefined) {
      await putWithAudit('default', update.storeName as keyof AIOpsDB, update.rollbackValue, 'system');
    } else {
      await removeWithAudit('default', update.storeName as keyof AIOpsDB, update.key as string, 'system');
    }
  }

  public clearQueue(): void {
    this.queue.clear();
    this.saveQueue();
  }

  public getStatistics(): { total: number; byPriority: Record<string, number>; failed: number } {
    const stats = {
      total: this.queue.size,
      byPriority: { high: 0, normal: 0, low: 0 },
      failed: 0,
    };

    this.queue.forEach(action => {
      stats.byPriority[action.priority]++;
      if (action.error) stats.failed++;
    });

    return stats;
  }
}

// ---------------------------------
// 8. Conflict Resolution Engine
// ---------------------------------

class ConflictResolutionEngine {
  private conflicts: Map<string, SyncConflict> = new Map();
  private resolutionStrategies: Map<string, (conflict: SyncConflict) => ConflictResolution> = new Map();

  constructor() {
    this.registerDefaultStrategies();
  }

  private registerDefaultStrategies() {
    // Last write wins
    this.resolutionStrategies.set('last-write-wins', (conflict) => ({
      conflictId: conflict.id,
      resolution: new Date(conflict.localTimestamp) > new Date(conflict.remoteTimestamp) ? 'local' : 'remote',
      reason: 'Last write wins',
    }));

    // Remote wins (server authority)
    this.resolutionStrategies.set('remote-wins', (conflict) => ({
      conflictId: conflict.id,
      resolution: 'remote',
      reason: 'Server authority',
    }));

    // Local wins (offline first)
    this.resolutionStrategies.set('local-wins', (conflict) => ({
      conflictId: conflict.id,
      resolution: 'local',
      reason: 'Offline first',
    }));

    // Merge arrays
    this.resolutionStrategies.set('merge-arrays', (conflict) => {
      if (Array.isArray(conflict.localValue) && Array.isArray(conflict.remoteValue)) {
        const merged = [...new Set([...conflict.localValue, ...conflict.remoteValue])];
        return {
          conflictId: conflict.id,
          resolution: 'merge',
          customValue: merged,
          reason: 'Merged arrays',
        };
      }
      return {
        conflictId: conflict.id,
        resolution: 'remote',
        reason: 'Cannot merge non-arrays',
      };
    });
  }

  public addConflict(conflict: SyncConflict): void {
    // Check if it's auto-resolvable
    if (this.canAutoResolve(conflict)) {
      conflict.autoResolvable = true;
      conflict.suggestedResolution = this.suggestResolution(conflict);
    }

    this.conflicts.set(conflict.id, conflict);
  }

  private canAutoResolve(conflict: SyncConflict): boolean {
    // Check for simple cases
    if (conflict.conflictType === 'version') {
      // If only metadata changed, can auto-resolve
      if (this.onlyMetadataChanged(conflict)) return true;

      // If changes don't overlap, can merge
      if (this.canMergeChanges(conflict)) return true;
    }

    return false;
  }

  private onlyMetadataChanged(conflict: SyncConflict): boolean {
    const metaFields = ['updatedAt', 'updatedBy', 'version', 'syncedAt'];
    const localKeys = Object.keys(conflict.localValue || {});
    const remoteKeys = Object.keys(conflict.remoteValue || {});

    const changedKeys = new Set([
      ...localKeys.filter(k => conflict.localValue[k] !== conflict.baseValue?.[k]),
      ...remoteKeys.filter(k => conflict.remoteValue[k] !== conflict.baseValue?.[k]),
    ]);

    return Array.from(changedKeys).every(key => metaFields.includes(key));
  }

  private canMergeChanges(conflict: SyncConflict): boolean {
    if (!conflict.baseValue) return false;

    const localChanges = this.getChangedFields(conflict.baseValue, conflict.localValue);
    const remoteChanges = this.getChangedFields(conflict.baseValue, conflict.remoteValue);

    // Check if changes overlap
    const overlap = localChanges.filter(field => remoteChanges.includes(field));
    return overlap.length === 0;
  }

  private getChangedFields(base: any, current: any): string[] {
    const changed: string[] = [];

    Object.keys(current || {}).forEach(key => {
      if (JSON.stringify(base?.[key]) !== JSON.stringify(current[key])) {
        changed.push(key);
      }
    });

    return changed;
  }

  private suggestResolution(conflict: SyncConflict): 'local' | 'remote' | 'merge' {
    // If can merge, suggest merge
    if (this.canMergeChanges(conflict)) return 'merge';

    // Otherwise, use timestamp
    return new Date(conflict.localTimestamp) > new Date(conflict.remoteTimestamp) ? 'local' : 'remote';
  }

  public resolveConflict(resolution: ConflictResolution): any {
    const conflict = this.conflicts.get(resolution.conflictId);
    if (!conflict) throw new Error('Conflict not found');

    let resolvedValue: any;

    switch (resolution.resolution) {
      case 'local':
        resolvedValue = conflict.localValue;
        break;
      case 'remote':
        resolvedValue = conflict.remoteValue;
        break;
      case 'merge':
        resolvedValue = this.mergeValues(conflict);
        break;
      case 'custom':
        resolvedValue = resolution.customValue;
        break;
    }

    // Remove resolved conflict
    this.conflicts.delete(resolution.conflictId);

    return resolvedValue;
  }

  private mergeValues(conflict: SyncConflict): any {
    if (!conflict.baseValue) {
      // No base, can't merge properly
      return conflict.remoteValue;
    }

    const merged = { ...conflict.baseValue };

    // Apply local changes
    const localChanges = this.getChangedFields(conflict.baseValue, conflict.localValue);
    localChanges.forEach(field => {
      merged[field] = conflict.localValue[field];
    });

    // Apply remote changes
    const remoteChanges = this.getChangedFields(conflict.baseValue, conflict.remoteValue);
    remoteChanges.forEach(field => {
      if (!localChanges.includes(field)) {
        merged[field] = conflict.remoteValue[field];
      }
    });

    return merged;
  }

  public autoResolveAll(): ConflictResolution[] {
    const resolutions: ConflictResolution[] = [];

    this.conflicts.forEach(conflict => {
      if (conflict.autoResolvable) {
        resolutions.push({
          conflictId: conflict.id,
          resolution: conflict.suggestedResolution || 'remote',
          reason: 'Auto-resolved',
        });
      }
    });

    return resolutions;
  }

  public getConflicts(): SyncConflict[] {
    return Array.from(this.conflicts.values());
  }

  public clearConflicts(): void {
    this.conflicts.clear();
  }
}

// ---------------------------------
// 9. Provider Component
// ---------------------------------

const OfflineCapabilityContext = createContext<OfflineCapabilityContextProps | null>(null);

export const OfflineCapabilityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { tenantId } = useTenant();
  const { triggerSync, syncState } = useSync();
  const { connectionStatus } = useRealtimeStream();

  // State management
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastOnlineAt, setLastOnlineAt] = useState<string | null>(null);
  const [connectivityQuality, setConnectivityQuality] = useState<ConnectivityQuality>('high');
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [syncConflicts, setSyncConflicts] = useState<SyncConflict[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [nextSyncAt, setNextSyncAt] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState(0);
  const [criticalDataSets, setCriticalDataSets] = useState<CriticalDataCache[]>([]);
  const [offlineCapabilities, setOfflineCapabilities] = useState<OfflineCapability[]>([]);
  const [serviceWorkerState, setServiceWorkerState] = useState<ServiceWorkerState>({
    registration: null,
    updateAvailable: false,
    isControlled: false,
  });
  const [backgroundSyncTasks, setBackgroundSyncTasks] = useState<BackgroundSyncTask[]>([]);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Managers
  const queueManager = useRef<OfflineQueueManager | null>(null);
  const conflictEngine = useRef(new ConflictResolutionEngine());
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize queue manager
  useEffect(() => {
    if (tenantId) {
      queueManager.current = new OfflineQueueManager(`opshub_${tenantId}`);
    }
  }, [tenantId]);

  // Define replayQueuedActions early to avoid temporal dead zone
  const replayQueuedActions = useCallback(async (): Promise<void> => {
    if (!queueManager.current || !isOnline) return;

    setSyncStatus('syncing');
    setSyncProgress(0);

    try {
      await queueManager.current.processQueue(
        async (action) => {
          // Execute action against backend
          const response = await fetch(`/api/${action.entityType}/${action.actionType}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action.payload),
          });

          if (!response.ok) {
            const error = await response.json();
            if (error.type === 'conflict') {
              throw { type: 'conflict', ...error };
            }
            throw new Error(error.message || 'Action failed');
          }

          // Update sync progress
          const queue = queueManager.current!.getQueue();
          const processed = queue.filter(a => a.attemptCount > 0).length;
          setSyncProgress(Math.round((processed / queue.length) * 100));
        },
        (conflict) => {
          conflictEngine.current.addConflict(conflict);
          setSyncConflicts(prev => [...prev, conflict]);
        }
      );

      setLastSyncAt(new Date().toISOString());
      setSyncStatus(syncConflicts.length > 0 ? 'conflicts' : 'synced');
      setSyncProgress(100);

      // Trigger main sync
      await triggerSync();
    } catch (error) {
      console.error('[OfflineCapability] Sync failed:', error);
      setSyncStatus('error');
    } finally {
      setSyncProgress(0);
    }
  }, [isOnline, triggerSync, syncConflicts.length]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineAt(new Date().toISOString());
      // Trigger sync when coming back online
      replayQueuedActions();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setConnectivityQuality('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [replayQueuedActions]);

  // Monitor network quality
  useEffect(() => {
    if (!isOnline) {
      setConnectivityQuality('offline');
      return;
    }

    const updateNetworkInfo = () => {
      const connection = (navigator as any).connection ||
        (navigator as any).mozConnection ||
        (navigator as any).webkitConnection;

      if (connection) {
        setNetworkInfo({
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData,
        });

        // Determine quality based on connection
        if (connection.effectiveType === '4g' && connection.rtt < 100) {
          setConnectivityQuality('high');
        } else if (connection.effectiveType === '3g' ||
          (connection.effectiveType === '4g' && connection.rtt < 300)) {
          setConnectivityQuality('medium');
        } else {
          setConnectivityQuality('low');
        }
      } else {
        // Fallback to WebSocket connection status
        if (connectionStatus === 'connected') {
          setConnectivityQuality('high');
        } else if (connectionStatus === 'reconnecting') {
          setConnectivityQuality('medium');
        } else {
          setConnectivityQuality('low');
        }
      }
    };

    updateNetworkInfo();
    const interval = setInterval(updateNetworkInfo, 10000);

    return () => clearInterval(interval);
  }, [isOnline, connectionStatus]);

  // Initialize offline capabilities
  useEffect(() => {
    const capabilities: OfflineCapability[] = [
      {
        id: 'view_entities',
        feature: 'View Entities',
        availableOffline: true,
        degradedMode: false,
        requiredData: ['entities', 'relationships'],
      },
      {
        id: 'create_incident',
        feature: 'Create Incident',
        availableOffline: true,
        degradedMode: true,
        limitations: ['No real-time validation', 'No duplicate detection'],
        requiredData: ['incident_templates', 'users', 'categories'],
      },
      {
        id: 'update_status',
        feature: 'Update Status',
        availableOffline: true,
        degradedMode: false,
        requiredData: ['statuses'],
      },
      {
        id: 'ai_recommendations',
        feature: 'AI Recommendations',
        availableOffline: false,
        limitations: ['Requires backend AI models'],
      },
      {
        id: 'generate_reports',
        feature: 'Generate Reports',
        availableOffline: true,
        degradedMode: true,
        limitations: ['Limited to cached data', 'No real-time metrics'],
        requiredData: ['historical_data', 'report_templates'],
      },
    ];

    setOfflineCapabilities(capabilities);
  }, []);

  // Initialize critical data sets
  useEffect(() => {
    const criticalData: CriticalDataCache[] = [
      {
        id: 'users',
        dataType: 'users',
        lastSyncedAt: new Date().toISOString(),
        size: 0,
        priority: 'critical',
        updateFrequency: 'periodic',
      },
      {
        id: 'active_incidents',
        dataType: 'incidents',
        entityIds: [], // Will be populated with active incident IDs
        lastSyncedAt: new Date().toISOString(),
        size: 0,
        priority: 'critical',
        updateFrequency: 'realtime',
      },
      {
        id: 'configurations',
        dataType: 'config',
        lastSyncedAt: new Date().toISOString(),
        size: 0,
        priority: 'important',
        updateFrequency: 'static',
      },
      {
        id: 'knowledge_base',
        dataType: 'knowledge',
        lastSyncedAt: new Date().toISOString(),
        size: 0,
        priority: 'normal',
        updateFrequency: 'periodic',
        compressionEnabled: true,
      },
    ];

    setCriticalDataSets(criticalData);
  }, []);

  // Define registerServiceWorker early to avoid temporal dead zone
  const registerServiceWorker = useCallback(async (): Promise<void> => {
    if (!('serviceWorker' in navigator)) return;

    try {
      // Clean up any existing interval
      if ((window as any).__serviceWorkerUpdateInterval) {
        clearInterval((window as any).__serviceWorkerUpdateInterval);
      }
      
      const registration = await navigator.serviceWorker.register('/service-worker.js');

      setServiceWorkerState({
        registration,
        updateAvailable: false,
        isControlled: !!navigator.serviceWorker.controller,
        scriptURL: registration.active?.scriptURL,
      });

      // Check for updates
      const handleUpdateFound = () => {
        setServiceWorkerState(prev => ({ ...prev, updateAvailable: true }));
      };
      registration.addEventListener('updatefound', handleUpdateFound);
      
      // Store handler for cleanup
      (registration as any).__updateFoundHandler = handleUpdateFound;

      // ADD: Listen for tenant changes to notify service worker
      const notifyTenantChange = (newTenantId: string) => {
        if (registration.active) {
          registration.active.postMessage({
            type: 'TENANT_CHANGED',
            tenantId: newTenantId
          });
        }
      };

      // Check for updates periodically
      const updateInterval = setInterval(() => registration.update(), 3600000); // Every hour
      
      // Store interval ID for cleanup
      (window as any).__serviceWorkerUpdateInterval = updateInterval;

      console.log('[OfflineCapability] Service worker registered successfully');
    } catch (error) {
      console.error('[ServiceWorker] Registration failed:', error);
    }
  }, []);

  // Service Worker registration
  useEffect(() => {
    const handleControllerChange = () => {
      setServiceWorkerState(prev => ({ ...prev, isControlled: true }));
    };
    
    if ('serviceWorker' in navigator) {
      registerServiceWorker();

      // Listen for updates
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    }

    // PWA install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      }
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [registerServiceWorker]);

  // Sync management
  useEffect(() => {
    // Update sync status based on sync state
    if (syncState === 'syncing') {
      setSyncStatus('syncing');
    } else if (syncConflicts.length > 0) {
      setSyncStatus('conflicts');
    } else if (queueManager.current?.getQueue().length) {
      setSyncStatus('pending');
    } else {
      setSyncStatus('synced');
    }
  }, [syncState, syncConflicts]);

  // Periodic sync
  useEffect(() => {
    if (!isOnline) return;

    const scheduleNextSync = () => {
      const interval = connectivityQuality === 'high' ? 30000 :
        connectivityQuality === 'medium' ? 60000 : 120000;

      setNextSyncAt(new Date(Date.now() + interval).toISOString());

      syncTimer.current = setTimeout(() => {
        replayQueuedActions();
        scheduleNextSync();
      }, interval);
    };

    scheduleNextSync();

    return () => {
      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
      }
    };
  }, [isOnline, connectivityQuality]);

  // Offline actions
  const enqueueAction = useCallback(async (action: OfflineAction): Promise<string> => {
    if (!queueManager.current) throw new Error('Queue manager not initialized');

    const actionId = await queueManager.current.enqueue(action);

    // If online and high quality, try to execute immediately
    if (isOnline && connectivityQuality === 'high') {
      setTimeout(() => replayQueuedActions(), 100);
    }

    return actionId;
  }, [isOnline, connectivityQuality]);

  const dequeueAction = useCallback(async (actionId: string): Promise<void> => {
    if (!queueManager.current) throw new Error('Queue manager not initialized');

    await queueManager.current.dequeue(actionId);
  }, []);

  const clearQueue = useCallback(async (): Promise<void> => {
    if (!queueManager.current) return;
    queueManager.current.clearQueue();
  }, []);

  const retryFailedActions = useCallback(async (): Promise<void> => {
    await replayQueuedActions();
  }, [replayQueuedActions]);

  // Conflict resolution
  const resolveConflicts = useCallback(async (resolutions: ConflictResolution[]): Promise<void> => {
    for (const resolution of resolutions) {
      const resolvedValue = conflictEngine.current.resolveConflict(resolution);

      // Apply resolved value
      const conflict = syncConflicts.find(c => c.id === resolution.conflictId);
      if (conflict) {
        await putWithAudit(
          conflict.entityType,
          conflict.entityId,
          resolvedValue,
          'conflict-resolution'
        );
      }
    }

    // Remove resolved conflicts
    setSyncConflicts(prev =>
      prev.filter(c => !resolutions.some(r => r.conflictId === c.id))
    );

    // Trigger sync after resolution
    await triggerSync();
  }, [syncConflicts, triggerSync]);

  const acceptRemoteChanges = useCallback(async (conflictIds: string[]): Promise<void> => {
    const resolutions = conflictIds.map(id => ({
      conflictId: id,
      resolution: 'remote' as const,
      reason: 'User chose remote',
    }));

    await resolveConflicts(resolutions);
  }, [resolveConflicts]);

  const acceptLocalChanges = useCallback(async (conflictIds: string[]): Promise<void> => {
    const resolutions = conflictIds.map(id => ({
      conflictId: id,
      resolution: 'local' as const,
      reason: 'User chose local',
    }));

    await resolveConflicts(resolutions);
  }, [resolveConflicts]);

  const autoResolveConflicts = useCallback(async (): Promise<number> => {
    const resolutions = conflictEngine.current.autoResolveAll();
    if (resolutions.length > 0) {
      await resolveConflicts(resolutions);
    }
    return resolutions.length;
  }, [resolveConflicts]);

  const getConflictDetails = useCallback((conflictId: string): SyncConflict | null => {
    return syncConflicts.find(c => c.id === conflictId) || null;
  }, [syncConflicts]);

  // Critical data management
  const refreshCriticalData = useCallback(async (dataTypes?: string[]): Promise<void> => {
    const typesToRefresh = dataTypes || criticalDataSets.map(d => d.dataType);

    for (const dataType of typesToRefresh) {
      try {
        const response = await fetch(`/api/offline/critical-data/${dataType}`);
        if (response.ok) {
          const data = await response.json();

          // Store in IndexedDB
          await putWithAudit(`critical_${dataType}`, 'data', data, 'system');

          // Update cache info
          setCriticalDataSets(prev => prev.map(cache =>
            cache.dataType === dataType
              ? { ...cache, lastSyncedAt: new Date().toISOString(), size: JSON.stringify(data).length }
              : cache
          ));
        }
      } catch (error) {
        console.error(`[OfflineCapability] Failed to refresh ${dataType}:`, error);
      }
    }
  }, [criticalDataSets]);

  const getCacheSize = useCallback(async (): Promise<number> => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return estimate.usage || 0;
    }
    return 0;
  }, []);

  const clearCache = useCallback(async (dataTypes?: string[]): Promise<void> => {
    const typesToClear = dataTypes || criticalDataSets.map(d => d.dataType);

    for (const dataType of typesToClear) {
      await removeWithAudit(`critical_${dataType}`, 'data', 'system');
    }

    if (!dataTypes) {
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
    }
  }, [criticalDataSets]);

  const preloadData = useCallback(async (entities: Array<{ type: string; ids?: string[] }>): Promise<void> => {
    for (const entity of entities) {
      try {
        const url = entity.ids
          ? `/api/${entity.type}?ids=${entity.ids.join(',')}`
          : `/api/${entity.type}`;

        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();

          // Store in IndexedDB
          if (entity.ids) {
            for (const item of data) {
              await putWithAudit(entity.type, item.id, item, 'preload');
            }
          } else {
            await putWithAudit(`preload_${entity.type}`, 'all', data, 'preload');
          }
        }
      } catch (error) {
        console.error(`[OfflineCapability] Failed to preload ${entity.type}:`, error);
      }
    }
  }, []);

  // Degraded mode operations
  const getDegradedCapabilities = useCallback((): DegradedCapability[] => {
    if (isOnline) return [];

    return offlineCapabilities.map(cap => ({
      feature: cap.feature,
      status: cap.availableOffline
        ? (cap.degradedMode ? 'limited' : 'available')
        : 'unavailable',
      limitations: cap.limitations || [],
      alternativeAction: cap.availableOffline ? undefined : 'Wait for connection',
    }));
  }, [isOnline, offlineCapabilities]);

  const isFeatureAvailableOffline = useCallback((feature: string): boolean => {
    const capability = offlineCapabilities.find(c => c.feature === feature);
    return capability?.availableOffline || false;
  }, [offlineCapabilities]);

  const getFeatureLimitations = useCallback((feature: string): string[] => {
    const capability = offlineCapabilities.find(c => c.feature === feature);
    return capability?.limitations || [];
  }, [offlineCapabilities]);

  // Service Worker management
  // Service Worker management
  // registerServiceWorker has been moved earlier to avoid temporal dead zone

  useEffect(() => {
    if (serviceWorkerState.registration?.active && tenantId) {
      serviceWorkerState.registration.active.postMessage({
        type: 'TENANT_CHANGED',
        tenantId: tenantId
      });
    }
  }, [tenantId, serviceWorkerState.registration]);

  const updateServiceWorker = useCallback(async (): Promise<void> => {
    if (!serviceWorkerState.registration) return;

    await serviceWorkerState.registration.update();
  }, [serviceWorkerState.registration]);

  const skipWaiting = useCallback(async (): Promise<void> => {
    if (!serviceWorkerState.registration?.waiting) return;

    serviceWorkerState.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }, [serviceWorkerState.registration]);

  // Background sync
  const scheduleBackgroundSync = useCallback(async (tag: string, data: any): Promise<void> => {
    if (!('serviceWorker' in navigator) || !serviceWorkerState.registration) return;

    const task: BackgroundSyncTask = {
      id: `sync_${Date.now()}`,
      tag,
      data,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      status: 'pending',
    };

    setBackgroundSyncTasks(prev => [...prev, task]);

    // Register sync with service worker
    if ('sync' in serviceWorkerState.registration) {
      await (serviceWorkerState.registration as any).sync.register(tag);
    }
  }, [serviceWorkerState.registration]);

  const cancelBackgroundSync = useCallback(async (taskId: string): Promise<void> => {
    setBackgroundSyncTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  // PWA install
  const promptInstall = useCallback(async (): Promise<void> => {
    if (!installPrompt) return;

    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
    }

    setInstallPrompt(null);
  }, [installPrompt]);

  // Utilities
  const getOfflineStatistics = useCallback((): OfflineStatistics => {
    const stats = queueManager.current?.getStatistics() || { total: 0, byPriority: {}, failed: 0 };

    return {
      queueSize: stats.total,
      cacheSize: criticalDataSets.reduce((sum, cache) => sum + cache.size, 0),
      conflictCount: syncConflicts.length,
      lastSyncDuration: undefined, // Would need to track this
      failedSyncCount: stats.failed,
      successfulSyncCount: stats.total - stats.failed,
      averageSyncTime: undefined, // Would need to track this
      dataFreshness: criticalDataSets.reduce((acc, cache) => {
        const age = cache.lastSyncedAt
          ? Math.floor((Date.now() - new Date(cache.lastSyncedAt).getTime()) / 1000)
          : -1;
        acc[cache.dataType] = age;
        return acc;
      }, {} as Record<string, number>),
    };
  }, [criticalDataSets, syncConflicts]);

  const exportOfflineData = useCallback(async (): Promise<Blob> => {
    const data = {
      queue: queueManager.current?.getQueue() || [],
      conflicts: syncConflicts,
      criticalData: criticalDataSets,
      capabilities: offlineCapabilities,
      statistics: getOfflineStatistics(),
    };

    return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  }, [syncConflicts, criticalDataSets, offlineCapabilities, getOfflineStatistics]);

  const importOfflineData = useCallback(async (data: Blob): Promise<void> => {
    try {
      const text = await data.text();
      const imported = JSON.parse(text);

      // Import queue
      if (imported.queue && queueManager.current) {
        for (const action of imported.queue) {
          await queueManager.current.enqueue(action);
        }
      }

      // Import conflicts
      if (imported.conflicts) {
        imported.conflicts.forEach((conflict: SyncConflict) => {
          conflictEngine.current.addConflict(conflict);
        });
        setSyncConflicts(imported.conflicts);
      }

      // Import critical data
      if (imported.criticalData) {
        setCriticalDataSets(imported.criticalData);
      }
    } catch (error) {
      console.error('[OfflineCapability] Import failed:', error);
      throw error;
    }
  }, []);

  // Memoized context value
  const value = useMemo<OfflineCapabilityContextProps>(() => ({
    // Connection state
    isOnline,
    lastOnlineAt,
    connectivityQuality,
    networkInfo,

    // Sync management
    syncStatus,
    queuedActions: queueManager.current?.getQueue() || [],
    syncConflicts,
    lastSyncAt,
    nextSyncAt,
    syncProgress,

    // Offline actions
    enqueueAction,
    dequeueAction,
    replayQueuedActions,
    clearQueue,
    retryFailedActions,

    // Conflict resolution
    resolveConflicts,
    acceptRemoteChanges,
    acceptLocalChanges,
    autoResolveConflicts,
    getConflictDetails,

    // Critical data caching
    criticalDataSets,
    offlineCapabilities,
    refreshCriticalData,
    getCacheSize,
    clearCache,
    preloadData,

    // Degraded mode operations
    getDegradedCapabilities,
    isFeatureAvailableOffline,
    getFeatureLimitations,

    // Service Worker management
    serviceWorkerState,
    registerServiceWorker,
    updateServiceWorker,
    skipWaiting,

    // Background sync
    backgroundSyncTasks,
    scheduleBackgroundSync,
    cancelBackgroundSync,

    // PWA features
    installPrompt,
    canInstall: !!installPrompt,
    isInstalled,
    promptInstall,

    // Utilities
    getOfflineStatistics,
    exportOfflineData,
    importOfflineData,
  }), [
    isOnline,
    lastOnlineAt,
    connectivityQuality,
    networkInfo,
    syncStatus,
    syncConflicts,
    lastSyncAt,
    nextSyncAt,
    syncProgress,
    criticalDataSets,
    offlineCapabilities,
    serviceWorkerState,
    backgroundSyncTasks,
    installPrompt,
    isInstalled,
    enqueueAction,
    dequeueAction,
    replayQueuedActions,
    clearQueue,
    retryFailedActions,
    resolveConflicts,
    acceptRemoteChanges,
    acceptLocalChanges,
    autoResolveConflicts,
    getConflictDetails,
    refreshCriticalData,
    getCacheSize,
    clearCache,
    preloadData,
    getDegradedCapabilities,
    isFeatureAvailableOffline,
    getFeatureLimitations,
    registerServiceWorker,
    updateServiceWorker,
    skipWaiting,
    scheduleBackgroundSync,
    cancelBackgroundSync,
    promptInstall,
    getOfflineStatistics,
    exportOfflineData,
    importOfflineData,
  ]);

  return (
    <OfflineCapabilityContext.Provider value={value}>
      {children}
    </OfflineCapabilityContext.Provider>
  );
};

// ---------------------------------
// 10. Custom Hooks
// ---------------------------------

export const useOfflineCapability = (): OfflineCapabilityContextProps => {
  const context = useContext(OfflineCapabilityContext);
  if (!context) {
    throw new Error('useOfflineCapability must be used within OfflineCapabilityProvider');
  }
  return context;
};

export const useOfflineStatus = () => {
  const { isOnline, connectivityQuality, syncStatus, queuedActions } = useOfflineCapability();

  return {
    isOnline,
    connectivityQuality,
    syncStatus,
    hasPendingActions: queuedActions.length > 0,
    queueSize: queuedActions.length,
  };
};

export const useOfflineAction = () => {
  const { enqueueAction, isOnline } = useOfflineCapability();

  const executeAction = useCallback(async (
    action: OfflineAction,
    options?: { forceOffline?: boolean }
  ) => {
    if (isOnline && !options?.forceOffline) {
      // Execute online
      try {
        const response = await fetch(`/api/${action.entityType}/${action.actionType}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.payload),
        });

        if (!response.ok) {
          throw new Error('Action failed');
        }

        return await response.json();
      } catch (error) {
        // Fall back to offline
        console.warn('[useOfflineAction] Online execution failed, queuing offline:', error);
        return enqueueAction(action);
      }
    } else {
      // Queue for offline execution
      return enqueueAction(action);
    }
  }, [isOnline, enqueueAction]);

  return { executeAction };
};

export const useConflictResolution = () => {
  const {
    syncConflicts,
    resolveConflicts,
    acceptLocalChanges,
    acceptRemoteChanges,
    autoResolveConflicts,
  } = useOfflineCapability();

  const hasConflicts = syncConflicts.length > 0;
  const autoResolvableCount = syncConflicts.filter(c => c.autoResolvable).length;

  return {
    conflicts: syncConflicts,
    hasConflicts,
    autoResolvableCount,
    resolveConflicts,
    acceptLocalChanges,
    acceptRemoteChanges,
    autoResolveConflicts,
  };
};