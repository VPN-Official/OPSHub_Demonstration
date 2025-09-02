// src/sync/syncTypes.ts

export type SyncAction = 
  | "create" 
  | "update" 
  | "delete" 
  | "bulk_create" 
  | "bulk_update" 
  | "bulk_delete"
  | "upsert";  // Create or update

export type SyncStatus =
  | "pending"       // waiting in queue
  | "in_progress"   // actively syncing
  | "completed"     // synced successfully
  | "failed"        // permanently failed (after retries)
  | "conflict"      // conflict detected
  | "cancelled";    // cancelled by user/system

export type SyncPriority = 'low' | 'normal' | 'high' | 'critical';

export type ConflictResolution = 
  | 'manual'        // requires user intervention
  | 'server_wins'   // server version takes precedence
  | 'client_wins'   // client version takes precedence
  | 'merge'         // attempt to merge changes
  | 'latest_wins';  // most recent timestamp wins

export interface SyncMetadata {
  attemptCount: number;              // number of retries attempted
  maxAttempts?: number;              // max retry attempts (default: 3)
  lastAttemptAt?: string;            // ISO timestamp of last attempt
  errorMessage?: string;             // last error encountered
  conflictDetails?: ConflictDetails; // extra info if conflict
  priority?: SyncPriority;           // sync priority level
  retryAfter?: string;               // ISO timestamp for next retry
  userId?: string;                   // user who initiated the change
  correlationId?: string;            // for tracking related operations
  serverResponse?: any;              // response from successful sync
  cancellationReason?: string;       // reason for cancellation
  tags?: string[];                   // optional tags for categorization
  [key: string]: any;                // extensible for custom metadata
}

export interface ConflictDetails {
  serverVersion?: any;               // server's version of the entity
  clientVersion?: any;               // client's version of the entity
  conflictType?: ConflictType;       // type of conflict detected
  resolution?: ConflictResolution;   // how to resolve the conflict
  conflictFields?: string[];         // specific fields in conflict
  detectedAt?: string;               // when conflict was detected
  resolvedAt?: string;               // when conflict was resolved
  resolvedBy?: string;               // user/system that resolved conflict
  [key: string]: any;                // extensible for domain-specific conflicts
}

export type ConflictType =
  | 'version'       // version/etag mismatch
  | 'timestamp'     // concurrent modifications
  | 'delete'        // entity deleted on server
  | 'schema'        // schema/structure mismatch
  | 'permission'    // permission denied
  | 'validation'    // validation failed on server
  | 'custom';       // domain-specific conflict

export interface SyncItem<T = any> {
  id: string;                        // unique id for queue item
  tenantId: string;                  // tenant scope
  storeName: string;                 // store name (matches AIOpsDB schema)
  entityId: string;                  // actual business entity id
  action: SyncAction;                // what operation to perform
  payload: T | null;                 // full object (for create/update) or null (for delete)
  status: SyncStatus;                // current sync state
  enqueuedAt: string;                // ISO timestamp when enqueued
  timestamp: string;                 // ISO timestamp of the original operation
  metadata: SyncMetadata;            // retry + error + conflict details
}

// ---------------------------------
// Sync Engine Configuration
// ---------------------------------
export interface SyncEngineConfig {
  enabled: boolean;                  // whether sync engine is active
  batchSize: number;                 // items to process per batch
  maxAttempts: number;               // default max retry attempts
  retryDelays: Record<SyncPriority, number>; // retry delays by priority (ms)
  conflictResolution: {
    defaultStrategy: ConflictResolution;
    strategiesByStore: Record<string, ConflictResolution>;
  };
  monitoring: {
    enableMetrics: boolean;
    metricsRetentionDays: number;
    alertThresholds: {
      queueSize: number;
      failureRate: number;
      oldestPendingHours: number;
    };
  };
}

// ---------------------------------
// Sync Statistics
// ---------------------------------
export interface SyncStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  failed: number;
  conflict: number;
  cancelled: number;
  byStore: Record<string, number>;
  byPriority: Record<SyncPriority, number>;
  oldestPending: string | null;
  averageAttempts: number;
  successRate: number;
  lastProcessedAt?: string;
}

// ---------------------------------
// Sync Events (for observability)
// ---------------------------------
export type SyncEventType = 
  | 'enqueued'
  | 'processing_started'
  | 'processing_completed'
  | 'processing_failed'
  | 'conflict_detected'
  | 'conflict_resolved'
  | 'cancelled'
  | 'batch_started'
  | 'batch_completed';

export interface SyncEvent {
  id: string;
  type: SyncEventType;
  tenantId: string;
  syncItemId?: string;
  timestamp: string;
  details: Record<string, any>;
  correlationId?: string;
}

// ---------------------------------
// Sync Result Types
// ---------------------------------
export interface SyncResult<T = any> {
  success: boolean;
  syncItemId: string;
  action: SyncAction;
  storeName: string;
  entityId: string;
  serverResponse?: T;
  error?: string;
  conflictDetails?: ConflictDetails;
  duration?: number; // processing time in ms
}

export interface BatchSyncResult {
  batchId: string;
  tenantId: string;
  processedAt: string;
  totalItems: number;
  successful: number;
  failed: number;
  conflicts: number;
  cancelled: number;
  results: SyncResult[];
  duration: number; // total batch processing time in ms
}

// ---------------------------------
// Server Sync API Types
// ---------------------------------
export interface ServerSyncRequest<T = any> {
  tenantId: string;
  items: Array<{
    id: string;
    action: SyncAction;
    storeName: string;
    entityId: string;
    payload: T | null;
    timestamp: string;
    metadata?: Record<string, any>;
  }>;
}

export interface ServerSyncResponse<T = any> {
  results: Array<{
    id: string; // sync item id
    success: boolean;
    serverEntity?: T;
    error?: string;
    conflictDetails?: ConflictDetails;
  }>;
}

// ---------------------------------
// Utility Types
// ---------------------------------
export type SyncableEntity = {
  id: string;
  tenantId?: string;
  created_at?: string;
  updated_at?: string;
  sync_status?: 'clean' | 'dirty' | 'conflict';
  last_synced?: string;
  version?: number | string; // for optimistic concurrency
};

// Type guard functions
export const isSyncableEntity = (obj: any): obj is SyncableEntity => {
  return obj && typeof obj === 'object' && typeof obj.id === 'string';
};

export const isConflictStatus = (status: SyncStatus): boolean => {
  return status === 'conflict';
};

export const isFailedStatus = (status: SyncStatus): boolean => {
  return status === 'failed';
};

export const isPendingStatus = (status: SyncStatus): boolean => {
  return status === 'pending';
};

export const isCompletedStatus = (status: SyncStatus): boolean => {
  return status === 'completed';
};

export const isRetryableStatus = (status: SyncStatus): boolean => {
  return status === 'failed' || status === 'conflict';
};