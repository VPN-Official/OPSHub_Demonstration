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
// Audit Log Entry (Updated interface)
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
  hash: string; // Renamed from immutable_hash for consistency
  tenantId: string;
  metadata?: Record<string, any>;
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
  userId?: string,
  auditMetadata?: AuditMetadata
) => {
  if (!tenantId) {
    throw new Error("tenantId is required");
  }
  if (!entity.id) {
    throw new Error("Entity must have an id field");
  }

  const db = await getDB(tenantId);
  const timestamp = new Date().toISOString();

  try {
    // Check if entity exists to determine if this is create or update
    const existing = await db.get(storeName, entity.id);
    const action = existing ? "update" : "create";

    // Add metadata fields to entity
    const enrichedEntity = {
      ...entity,
      updated_at: timestamp,
      ...(action === "create" && { created_at: timestamp }),
    };

    // Store entity
    await db.put(storeName, enrichedEntity);

    // Log audit event (async)
    await logAuditEvent(
      tenantId,
      storeName,
      entity.id,
      auditMetadata?.action || action,
      userId,
      auditMetadata?.description,
      auditMetadata?.tags,
      auditMetadata?.metadata
    );

    // Log activity event
    await logActivityEvent(tenantId, {
      id: generateSecureId(),
      tenantId,
      timestamp,
      message:
        auditMetadata?.description ||
        `${action === "create" ? "Created" : "Updated"} ${storeName} (${entity.id})`,
      storeName: storeName.toString(),
      recordId: entity.id,
      action: action as "create" | "update",
      userId,
      metadata: auditMetadata?.metadata,
    });

    // Enqueue for sync
    await enqueue(tenantId, {
      id: generateSecureId(),
      storeName: storeName.toString(),
      entityId: entity.id,
      action,
      payload: enrichedEntity,
      timestamp,
      tenantId,
      status: 'pending',
    });

    // Notify watchers
    notifyWatchers(storeName, enrichedEntity, action);

    return enrichedEntity;
  } catch (error) {
    console.error(`Failed to put entity ${entity.id} to ${storeName}:`, error);
    throw error;
  }
};

export const removeWithAudit = async (
  tenantId: string,
  storeName: keyof AIOpsDB,
  entityId: string,
  userId?: string,
  auditMetadata?: AuditMetadata
) => {
  if (!tenantId) {
    throw new Error("tenantId is required");
  }
  if (!entityId) {
    throw new Error("entityId is required");
  }

  const db = await getDB(tenantId);
  const timestamp = new Date().toISOString();

  try {
    // Get entity before deletion for audit purposes
    const entity = await db.get(storeName, entityId);
    if (!entity) {
      throw new Error(`Entity ${entityId} not found in ${storeName}`);
    }

    // Delete entity
    await db.delete(storeName, entityId);

    // Log audit event (async)
    await logAuditEvent(
      tenantId,
      storeName,
      entityId,
      "delete",
      userId,
      auditMetadata?.description,
      auditMetadata?.tags,
      auditMetadata?.metadata
    );

    // Log activity event
    await logActivityEvent(tenantId, {
      id: generateSecureId(),
      tenantId,
      timestamp,
      message:
        auditMetadata?.description ||
        `Deleted ${storeName} (${entityId})`,
      storeName: storeName.toString(),
      recordId: entityId,
      action: "delete",
      userId,
      metadata: auditMetadata?.metadata,
    });

    // Enqueue for sync
    await enqueue(tenantId, {
      id: generateSecureId(),
      storeName: storeName.toString(),
      entityId,
      action: "delete",
      payload: null,
      timestamp,
      tenantId,
      status: 'pending',
    });

    // Notify watchers
    notifyWatchers(storeName, { id: entityId, deleted: true }, "delete");

    return entity;
  } catch (error) {
    console.error(`Failed to delete entity ${entityId} from ${storeName}:`, error);
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
// Sync Status Management
// ---------------------------------
export const markSynced = async (
  tenantId: string,
  storeName: keyof AIOpsDB,
  entityId: string
) => {
  const entity = await getById(tenantId, storeName, entityId);
  if (entity) {
    const updated = { 
      ...entity, 
      sync_status: 'clean' as const,
      synced_at: new Date().toISOString()
    };
    const db = await getDB(tenantId);
    await db.put(storeName, updated);
    return updated;
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