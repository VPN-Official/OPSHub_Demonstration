// src/db/dbClient.ts - UPDATED to use browser-compatible auditUtils
import { openDB, IDBPDatabase } from "idb";
import type { AIOpsDB } from "./seedIndexedDB";
import { enqueue } from "./syncQueue";
import { generateImmutableHash, generateSecureId } from "../utils/auditUtils";

// ---------------------------------
// DB cache per tenant
// ---------------------------------
const dbCache: Record<string, Promise<IDBPDatabase<AIOpsDB>>> = {};

export const getDB = async (tenantId: string) => {
  if (!tenantId) {
    throw new Error("tenantId is required for all DB operations");
  }

  if (!dbCache[tenantId]) {
    const { initDB } = await import("./seedIndexedDB");
    dbCache[tenantId] = initDB(tenantId);
  }
  return dbCache[tenantId];
};

// ---------------------------------
// Activity Event
// ---------------------------------
export interface ActivityEvent {
  id: string;
  timestamp: string;
  tenantId: string;
  message: string;
  storeName: string;
  recordId: string;
  action: "create" | "update" | "delete";
  userId?: string;
  metadata?: Record<string, any>;
}

// ---------------------------------
// Audit Log Entry (Enhanced for Compliance)
// ---------------------------------
export interface AuditLogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  description: string;
  timestamp: string;
  user_id: string | null;
  tags: string[];
  hash: string; // Immutable hash for audit integrity
  tenantId: string;
  metadata?: Record<string, any> & {
    classification?: 'public' | 'internal' | 'confidential' | 'sensitive';
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
    compliance_relevant?: boolean;
    retention_period_days?: number;
    gdpr_relevant?: boolean;
    sox_relevant?: boolean;
  };
}

// ---------------------------------
// Sync Queue Item
// ---------------------------------
export interface SyncQueueItem {
  id: string;
  storeName: string;
  entityId: string;
  action: string;
  payload: any;
  timestamp: string;
  tenantId: string;
  attempts?: number;
  lastError?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'failed' | 'conflict';
}

// ---------------------------------
// Watchers (observability)
// ---------------------------------
type WatchCallback<T> = (entity: T, action: 'create' | 'update' | 'delete') => void;
const watchers: Record<string, WatchCallback<any>[]> = {};

export const watch = <T>(
  storeName: keyof AIOpsDB,
  callback: WatchCallback<T>
) => {
  const key = storeName.toString();
  if (!watchers[key]) {
    watchers[key] = [];
  }
  watchers[key].push(callback as any);

  // Return unsubscribe function
  return () => {
    watchers[key] = watchers[key].filter((cb) => cb !== callback);
  };
};

const notifyWatchers = (
  storeName: keyof AIOpsDB,
  entity: any,
  action: 'create' | 'update' | 'delete' = 'update'
) => {
  const key = storeName.toString();
  if (watchers[key]) {
    watchers[key].forEach((cb) => cb(entity, action));
  }
};

// ---------------------------------
// Internal: Activity Timeline
// ---------------------------------
const logActivityEvent = async (
  tenantId: string,
  event: ActivityEvent
) => {
  try {
    const db = await getDB(tenantId);
    await db.add("activity_timeline", event);
  } catch (error) {
    console.error("Failed to log activity event:", error);
    // Don't throw - logging failures shouldn't break operations
  }
};

// ---------------------------------
// Internal: Audit Logging (UPDATED to use async hash generation)
// ---------------------------------
const logAuditEvent = async (
  tenantId: string,
  storeName: keyof AIOpsDB,
  entityId: string,
  action: string,
  userId?: string,
  description?: string,
  tags?: string[],
  metadata?: Record<string, any>
) => {
  const timestamp = new Date().toISOString();

  try {
    // Generate immutable hash using the new async function
    const hash = await generateImmutableHash({
      entity_type: storeName.toString(),
      entity_id: entityId,
      action,
      timestamp,
      tenantId,
      user_id: userId || null,
      description: description || `${storeName} ${action}`,
      metadata,
    });

    const auditLog: AuditLogEntry = {
      id: generateSecureId(),
      entity_type: storeName.toString(),
      entity_id: entityId,
      action,
      description: description || `${storeName} ${action}`,
      timestamp,
      user_id: userId || null,
      tags: tags || [],
      tenantId,
      metadata,
      hash, // Using the generated hash
    };

    const db = await getDB(tenantId);
    await db.add("audit_logs", auditLog);

    console.log(`Audit logged: ${auditLog.description} (${auditLog.id})`);
  } catch (error) {
    console.error("Failed to log audit event:", error);
    throw new Error(`Audit logging failed: ${error}`);
  }
};

// ---------------------------------
// CRUD with Audit + Activity + Sync (UPDATED)
// ---------------------------------
interface AuditMetadata {
  action?: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export const putWithAudit = async <T extends { id: string }>(
  tenantId: string,
  storeName: keyof AIOpsDB,
  entity: T,
  action: "create" | "update" | "system" | "conflict-resolution" | "preload",
  userId?: string,
  options: {
    description?: string;
    classification?: 'public' | 'internal' | 'confidential' | 'sensitive';
    reason?: string;
    ipAddress?: string;
    metadata?: Record<string, any>;
  } = {}
): Promise<T> => {
  if (!tenantId) {
    throw new Error("tenantId is required for all DB operations");
  }

  try {
    const db = await getDB(tenantId);
    const timestamp = new Date().toISOString();

    // ✅ CRITICAL: Ensure entity has tenantId and sync metadata
    const enrichedEntity = {
      ...entity,
      tenantId,                    // ✅ Ensure tenant isolation
      updated_at: timestamp,       // ✅ Update timestamp
      synced_at: null,            // ✅ Mark as unsynced
      sync_status: "dirty" as const, // ✅ Mark as needing sync
    } as T;

    // Save to IndexedDB
    await db.put(storeName, enrichedEntity);

    // Determine data classification based on store and content
    const classification = options.classification || determineDataClassification(storeName, entity);
    const isComplianceRelevant = ['sensitive', 'confidential'].includes(classification);
    
    // Create enhanced audit log entry for compliance
    const auditEntry: AuditLogEntry = {
      id: await generateSecureId(),
      tenantId,
      entity_type: storeName.toString(),
      entity_id: entity.id,
      action,
      description: options.description || `${action} ${storeName} ${entity.id}${options.reason ? ` - ${options.reason}` : ''}`,
      timestamp,
      user_id: userId || null,
      tags: ["dbclient", storeName.toString(), action, classification],
      hash: await generateImmutableHash({
        entity_type: storeName.toString(),
        entity_id: entity.id,
        action,
        timestamp,
        tenantId,
        user_id: userId,
        classification,
      }),
      metadata: {
        ...options.metadata,
        classification,
        reason: options.reason,
        ipAddress: options.ipAddress || (typeof window !== 'undefined' ? await getUserIP() : undefined),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
        compliance_relevant: isComplianceRelevant,
        retention_period_days: getRetentionPeriod(classification),
        gdpr_relevant: isGDPRRelevant(storeName, entity),
        sox_relevant: isSOXRelevant(storeName, action),
      },
    };

    await db.put("audit_logs", auditEntry);

    // Create activity timeline entry with classification
    await db.put("activity_timeline", {
      id: await generateSecureId(),
      tenantId,
      timestamp,
      message: options.description || `${action} ${storeName} (${entity.id})`,
      storeName: storeName.toString(),
      recordId: entity.id,
      action: action === 'system' || action === 'conflict-resolution' || action === 'preload' ? 'update' : action as "create" | "update",
      userId,
      metadata: {
        ...options.metadata,
        classification,
      },
    });

    // ✅ CRITICAL: Sync queue operations should not block main operations
    try {
      const queueItemId = await generateSecureId();
      await enqueue(tenantId, {
        id: queueItemId,              // ✅ Required field
        storeName: storeName.toString(),
        entityId: entity.id,
        action,
        payload: enrichedEntity,      // ✅ Include enriched entity with tenantId
        timestamp,                    // ✅ Required field
        tenantId,                     // ✅ Required field
        status: 'pending',            // ✅ Default status
        priority: 'normal',           // ✅ Default priority
        userId,                       // ✅ Pass userId if available
      });
    } catch (syncError) {
      console.warn('Sync enqueue failed, operation completed locally:', syncError);
      // Don't throw - allow local operation to succeed
    }

    // Notify watchers
    notifyWatchers(storeName, enrichedEntity, action);

    return enrichedEntity;
  } catch (error) {
    console.error(`Failed to put entity ${entity.id} to ${storeName}:`, error);
    throw error;
  }
};

// ✅ CRITICAL FIX: Enhanced removeWithAudit with proper tenant handling
export const removeWithAudit = async (
  tenantId: string,
  storeName: keyof AIOpsDB,
  entityId: string,
  action: "delete" | "system",
  userId?: string,
  options: {
    description?: string;
    classification?: 'public' | 'internal' | 'confidential' | 'sensitive';
    reason?: string;
    metadata?: Record<string, any>;
  } = {}
): Promise<void> => {
  if (!tenantId) {
    throw new Error("tenantId is required for all DB operations");
  }

  try {
    const db = await getDB(tenantId);
    const timestamp = new Date().toISOString();

    // Get existing entity for audit purposes
    const existingEntity = await db.get(storeName, entityId);
    if (!existingEntity) {
      throw new Error(`Entity ${entityId} not found in ${storeName}`);
    }

    // Delete from IndexedDB
    await db.delete(storeName, entityId);

    // Determine classification from existing entity
    const classification = options.classification || determineDataClassification(storeName, existingEntity);
    
    // Create enhanced audit log entry
    const auditEntry: AuditLogEntry = {
      id: await generateSecureId(),
      tenantId,
      entity_type: storeName.toString(),
      entity_id: entityId,
      action: action || "delete",
      description: options.description || `Deleted ${storeName} (${entityId})${options.reason ? ` - ${options.reason}` : ''}`,
      timestamp,
      user_id: userId || null,
      tags: ["dbclient", storeName.toString(), "delete", classification],
      hash: await generateImmutableHash({
        entity_type: storeName.toString(),
        entity_id: entityId,
        action: "delete",
        timestamp,
        tenantId,
        user_id: userId,
        deleted_data_hash: await generateImmutableHash(existingEntity), // Hash of deleted data for compliance
      }),
      metadata: {
        ...options.metadata,
        classification,
        reason: options.reason,
        compliance_relevant: ['sensitive', 'confidential'].includes(classification),
        deletion_timestamp: timestamp,
        gdpr_deletion: isGDPRRelevant(storeName, existingEntity),
      },
    };

    await db.put("audit_logs", auditEntry);

    // Create activity timeline entry
    await db.put("activity_timeline", {
      id: await generateSecureId(),
      tenantId,
      timestamp,
      message: auditMetadata?.description || `Deleted ${storeName} (${entityId})`,
      storeName: storeName.toString(),
      recordId: entityId,
      action: "delete",
      userId,
      metadata: auditMetadata?.metadata,
    });

    // ✅ CRITICAL: Sync queue operations should not block main operations
    try {
      const queueItemId = await generateSecureId();
      await enqueue(tenantId, {
        id: queueItemId,              // ✅ Required field
        storeName: storeName.toString(),
        entityId,
        action: "delete",
        payload: null,                // ✅ Null payload for deletions
        timestamp,                    // ✅ Required field
        tenantId,                     // ✅ Required field
        status: 'pending',            // ✅ Default status
        priority: 'normal',           // ✅ Default priority
        userId,                       // ✅ Pass userId if available
      });
    } catch (syncError) {
      console.warn('Sync enqueue failed, operation completed locally:', syncError);
      // Don't throw - allow local operation to succeed
    }

    // Notify watchers
    notifyWatchers(storeName, { id: entityId }, "delete");
  } catch (error) {
    console.error(`Failed to remove entity ${entityId} from ${storeName}:`, error);
    throw error;
  }
};

// ---------------------------------
// Generic CRUD Helpers
// ---------------------------------
export const getById = async <T>(
  tenantId: string,
  storeName: keyof AIOpsDB,
  id: string
): Promise<T | undefined> => {
  if (!tenantId) {
    throw new Error("tenantId is required");
  }
  if (!id) {
    throw new Error("id is required");
  }

  try {
    const db = await getDB(tenantId);
    return await db.get(storeName, id);
  } catch (error) {
    console.error(`Failed to get entity ${id} from ${storeName}:`, error);
    throw error;
  }
};

export const getAll = async <T>(
  tenantId: string,
  storeName: keyof AIOpsDB
): Promise<T[]> => {
  if (!tenantId) {
    throw new Error("tenantId is required");
  }

  try {
    const db = await getDB(tenantId);
    return await db.getAll(storeName);
  } catch (error) {
    console.error(`Failed to get all entities from ${storeName}:`, error);
    throw error;
  }
};

export const bulkPut = async <T extends { id: string }>(
  tenantId: string,
  storeName: keyof AIOpsDB,
  entities: T[],
  userId?: string,
  auditMetadata?: AuditMetadata
): Promise<T[]> => {
  if (!tenantId) {
    throw new Error("tenantId is required");
  }
  if (!entities || entities.length === 0) {
    return [];
  }

  const results: T[] = [];
  for (const entity of entities) {
    const result = await putWithAudit(
      tenantId,
      storeName,
      entity,
      userId,
      auditMetadata
    );
    results.push(result);
  }
  return results;
};

export const clear = async (
  tenantId: string,
  storeName: keyof AIOpsDB,
  userId?: string,
  auditMetadata?: AuditMetadata
) => {
  if (!tenantId) {
    throw new Error("tenantId is required");
  }

  const db = await getDB(tenantId);
  const timestamp = new Date().toISOString();

  try {
    // Get count before clearing for audit
    const entities = await db.getAll(storeName);
    const count = entities.length;

    // Clear the store
    await db.clear(storeName);

    // Log audit event (async)
    await logAuditEvent(
      tenantId,
      storeName,
      "bulk",
      "clear",
      userId,
      auditMetadata?.description || `Cleared all ${count} entities from ${storeName}`,
      auditMetadata?.tags,
      { ...auditMetadata?.metadata, count }
    );

    // Log activity event
    await logActivityEvent(tenantId, {
      id: generateSecureId(),
      tenantId,
      timestamp,
      message: `Cleared all ${count} entities from ${storeName}`,
      storeName: storeName.toString(),
      recordId: "bulk",
      action: "delete",
      userId,
      metadata: { count },
    });

    return count;
  } catch (error) {
    console.error(`Failed to clear ${storeName}:`, error);
    throw error;
  }
};

// ---------------------------------
// Compliance Helper Functions
// ---------------------------------
function determineDataClassification(storeName: keyof AIOpsDB, entity: any): 'public' | 'internal' | 'confidential' | 'sensitive' {
  // Sensitive data stores
  if (['users', 'end_users', 'customers', 'audit_logs'].includes(storeName.toString())) {
    return 'sensitive';
  }
  
  // Confidential data stores
  if (['contracts', 'vendors', 'compliance_controls', 'risks'].includes(storeName.toString())) {
    return 'confidential';
  }
  
  // Check for PII in entity
  if (entity && (entity.email || entity.ssn || entity.phone || entity.address)) {
    return 'sensitive';
  }
  
  // Check for financial data
  if (entity && (entity.salary || entity.budget || entity.cost || entity.revenue)) {
    return 'confidential';
  }
  
  // Internal by default for most operational data
  if (['incidents', 'problems', 'changes', 'service_requests'].includes(storeName.toString())) {
    return 'internal';
  }
  
  return 'public';
}

function getRetentionPeriod(classification: string): number {
  switch (classification) {
    case 'sensitive':
      return 2555; // 7 years for sensitive data (GDPR/SOX)
    case 'confidential':
      return 1825; // 5 years for confidential data
    case 'internal':
      return 365; // 1 year for internal data
    case 'public':
      return 90; // 90 days for public data
    default:
      return 365;
  }
}

function isGDPRRelevant(storeName: keyof AIOpsDB, entity: any): boolean {
  // GDPR applies to personal data
  const gdprStores = ['users', 'end_users', 'customers', 'audit_logs'];
  if (gdprStores.includes(storeName.toString())) {
    return true;
  }
  
  // Check for PII fields
  if (entity && (entity.email || entity.name || entity.phone || entity.address || entity.ip_address)) {
    return true;
  }
  
  return false;
}

function isSOXRelevant(storeName: keyof AIOpsDB, action: string): boolean {
  // SOX applies to financial controls and audit trails
  const soxStores = ['audit_logs', 'compliance_controls', 'contracts', 'vendors', 'cost_centers'];
  if (soxStores.includes(storeName.toString())) {
    return true;
  }
  
  // Any delete action on financial data is SOX relevant
  if (action === 'delete' && ['contracts', 'vendors', 'cost_centers'].includes(storeName.toString())) {
    return true;
  }
  
  return false;
}

async function getUserIP(): Promise<string | undefined> {
  try {
    // In production, this would call your backend API to get the real IP
    // For now, return a placeholder
    return 'client-ip';
  } catch {
    return undefined;
  }
}

// Data retention cleanup function
export async function cleanupExpiredData(tenantId: string): Promise<number> {
  if (!tenantId) throw new Error('tenantId required');
  
  const db = await getDB(tenantId);
  const now = new Date();
  let deletedCount = 0;
  
  try {
    // Check audit logs for expired entries
    const auditLogs = await db.getAll('audit_logs');
    
    for (const log of auditLogs) {
      const retentionDays = log.metadata?.retention_period_days || 365;
      const logDate = new Date(log.timestamp);
      const expiryDate = new Date(logDate.getTime() + (retentionDays * 24 * 60 * 60 * 1000));
      
      if (expiryDate < now && !log.metadata?.compliance_relevant) {
        // Only delete non-compliance-relevant expired logs
        await db.delete('audit_logs', log.id);
        deletedCount++;
        console.log(`[Compliance] Deleted expired audit log: ${log.id}`);
      }
    }
    
    // Clean up activity timeline older than 30 days
    const activities = await db.getAll('activity_timeline');
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    for (const activity of activities) {
      if (new Date(activity.timestamp) < thirtyDaysAgo) {
        await db.delete('activity_timeline', activity.id);
        deletedCount++;
      }
    }
    
    console.log(`[Compliance] Data retention cleanup completed. Deleted ${deletedCount} expired records.`);
  } catch (error) {
    console.error('[Compliance] Data retention cleanup failed:', error);
  }
  
  return deletedCount;
}

// ---------------------------------
// Sync Status Management
// ---------------------------------
export const markSynced = async (
  tenantId: string,
  storeName: keyof AIOpsDB,
  entityId: string
): Promise<void> => {
  if (!tenantId) {
    throw new Error("tenantId is required for sync operations");
  }

  try {
    const db = await getDB(tenantId);
    const entity = await db.get(storeName, entityId);

    if (entity) {
      const updatedEntity = {
        ...entity,
        synced_at: new Date().toISOString(),
        sync_status: "clean" as const,
      };
      await db.put(storeName, updatedEntity);
    }
  } catch (error) {
    console.error(`Failed to mark ${storeName}/${entityId} as synced:`, error);
    throw error;
  }
};

export const lastSynced = async (
  tenantId: string,
  storeName?: keyof AIOpsDB
): Promise<string | null> => {
  try {
    const db = await getDB(tenantId);
    const syncQueue = await db.getAll("sync_queue");

    if (storeName) {
      const storeItems = syncQueue
        .filter((item: any) => item.storeName === storeName && item.status === 'completed')
        .sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp));
      return storeItems[0]?.timestamp || null;
    } else {
      const completedItems = syncQueue
        .filter((item: any) => item.status === 'completed')
        .sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp));
      return completedItems[0]?.timestamp || null;
    }
  } catch (error) {
    console.error("Failed to get last synced timestamp:", error);
    return null;
  }
};

// ---------------------------------
// Reset + Reseed Helpers
// ---------------------------------
export const resetDB = async (tenantId: string) => {
  if (!tenantId) {
    throw new Error("tenantId is required");
  }

  try {
    const db = await getDB(tenantId);
    const storeNames = Array.from(db.objectStoreNames);

    for (const storeName of storeNames) {
      const tx = db.transaction(storeName, "readwrite");
      await tx.store.clear();
      await tx.done;
    }

    console.log(`Reset completed for tenant: ${tenantId}`);
  } catch (error) {
    console.error(`Failed to reset DB for tenant ${tenantId}:`, error);
    throw error;
  }
};

export const reseedDB = async (tenantId: string, mode: 'minimal' | 'demo' = 'demo') => {
  if (!tenantId) {
    throw new Error("tenantId is required");
  }

  try {
    const { seedIndexedDB } = await import("./seedIndexedDB");
    await seedIndexedDB(tenantId, mode);
    console.log(`Reseed completed for tenant: ${tenantId} (${mode} mode)`);
  } catch (error) {
    console.error(`Failed to reseed DB for tenant ${tenantId}:`, error);
    throw error;
  }
};

// ---------------------------------
// Cache Management
// ---------------------------------
export const invalidateCache = (tenantId?: string) => {
  if (tenantId) {
    delete dbCache[tenantId];
  } else {
    // Clear all cached DBs
    Object.keys(dbCache).forEach(key => delete dbCache[key]);
  }
};

// ---------------------------------
// Health Check
// ---------------------------------
export const healthCheck = async (tenantId: string) => {
  try {
    const db = await getDB(tenantId);
    const isHealthy = db && typeof db.get === 'function';
    return { healthy: isHealthy, tenantId };
  } catch (error) {
    return {
      healthy: false,
      tenantId,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};