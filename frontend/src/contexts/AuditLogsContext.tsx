// src/contexts/AuditLogsContext.tsx - ENTERPRISE FRONTEND REFACTORED
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import { 
  getAll,
  getById,
} from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useConfig } from "../providers/ConfigProvider";
import { ExternalSystemFields } from "../types/externalSystem";

// ---------------------------------
// 1. Frontend State Management Types
// ---------------------------------

/**
 * Generic async state interface for UI state management
 */
interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  lastFetch: number | null;
  stale: boolean;
}

/**
 * Cache configuration for UI performance
 */
interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  staleWhileRevalidate: boolean;
}

// ---------------------------------
// 2. Domain Types (Simplified for Frontend)
// ---------------------------------
export type AuditAction =
  | "create"
  | "update" 
  | "delete"
  | "read"
  | "execute"
  | "login"
  | "logout"
  | "approve"
  | "reject"
  | "escalate"
  | "assign"
  | "transfer"
  | "export"
  | "import"
  | "backup"
  | "restore"
  | "configure"
  | "install"
  | "uninstall"
  | "enable"
  | "disable"
  | "custom";

export type AuditRisk = "low" | "medium" | "high" | "critical";
export type ComplianceFramework = "SOX" | "PCI-DSS" | "HIPAA" | "GDPR" | "ISO27001" | "NIST" | "custom";

export interface AuditLogEntry extends ExternalSystemFields {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_name?: string;
  action: AuditAction;
  description: string;
  timestamp: string;
  
  // Actor information
  user_id?: string | null;
  user_name?: string;
  team_id?: string | null;
  team_name?: string;
  ai_agent_id?: string | null;
  automation_rule_id?: string | null;
  
  // Session context
  session_id?: string;
  ip_address?: string;
  user_agent?: string;
  location?: string;
  device_id?: string;
  device_fingerprint?: string;
  
  // Change tracking
  field_changes?: Array<{
    field: string;
    old_value?: any;
    new_value?: any;
    field_type?: string;
  }>;
  
  // Business context
  business_service_id?: string;
  customer_id?: string;
  cost_center_id?: string;
  contract_id?: string;
  risk_level: AuditRisk;
  compliance_frameworks: ComplianceFramework[];
  data_classification?: "public" | "internal" | "confidential" | "restricted";
  
  // Audit metadata
  hash: string;
  previous_hash?: string;
  sequence_number?: number;
  audit_source: "system" | "user" | "api" | "import" | "migration";
  
  // Legal hold
  retention_period_days?: number;
  legal_hold?: boolean;
  legal_hold_reason?: string;
  
  // Context
  correlation_id?: string;
  parent_audit_id?: string;
  child_audit_ids: string[];
  
  // Compliance
  compliance_flags?: string[];
  policy_violations?: Array<{
    policy_id: string;
    policy_name: string;
    violation_type: string;
    severity: "low" | "medium" | "high" | "critical";
  }>;
  
  // Metadata
  tags: string[];
  metadata?: Record<string, any>;
  tenantId: string;
}

/**
 * UI-focused search filters (validation handled by backend)
 */
export interface AuditSearchFilters {
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: AuditAction;
  riskLevel?: AuditRisk;
  complianceFramework?: ComplianceFramework;
  startDate?: string;
  endDate?: string;
  ipAddress?: string;
  businessServiceId?: string;
  customerId?: string;
  hasViolations?: boolean;
  legalHold?: boolean;
  textSearch?: string;
  // External system filtering
  sourceSystems?: string[];
  syncStatus?: ('synced' | 'syncing' | 'error' | 'conflict')[];
  hasConflicts?: boolean;
  hasLocalChanges?: boolean;
  dataCompleteness?: { min: number; max: number };
}

/**
 * Optimistic UI operation types
 */
interface OptimisticUpdate {
  id: string;
  type: 'legal_hold' | 'compliance_export';
  timestamp: number;
  originalState?: any;
}

// ---------------------------------
// 3. Frontend Context Interface
// ---------------------------------
interface AuditLogsContextType {
  // Core async state
  auditLogs: AsyncState<AuditLogEntry[]>;
  
  // API orchestration methods
  refreshAuditLogs: () => Promise<void>;
  getAuditLog: (id: string) => Promise<AuditLogEntry | undefined>;
  
  // Client-side helpers for UI responsiveness  
  getLogsByEntity: (entityType: string, entityId?: string) => AuditLogEntry[];
  getLogsByUser: (userId: string) => AuditLogEntry[];
  getLogsByAction: (action: AuditAction) => AuditLogEntry[];
  getLogsByRisk: (riskLevel: AuditRisk) => AuditLogEntry[];
  getLogsByCompliance: (framework: ComplianceFramework) => AuditLogEntry[];
  getLogsByDateRange: (startDate: string, endDate: string) => AuditLogEntry[];
  getLogsByTags: (tags: string[]) => AuditLogEntry[];
  getLogsWithViolations: () => AuditLogEntry[];
  getLogsOnLegalHold: () => AuditLogEntry[];
  
  // Simple client-side search for immediate UI feedback
  searchLogs: (query: string) => AuditLogEntry[];
  filterLogs: (filters: AuditSearchFilters) => AuditLogEntry[];
  
  // API calls with optimistic UI patterns
  setLegalHold: (entryIds: string[], reason: string) => Promise<void>;
  removeLegalHold: (entryIds: string[]) => Promise<void>;
  exportForCompliance: (filters: AuditSearchFilters, format: "json" | "csv" | "pdf") => Promise<Blob>;
  
  // UI state
  optimisticUpdates: OptimisticUpdate[];
  isPerformingBulkOperation: boolean;
  
  // Cache control
  invalidateCache: () => void;
  
  // Config from backend
  config: {
    actions: AuditAction[];
    risk_levels: AuditRisk[];
    compliance_frameworks: ComplianceFramework[];
    retention_periods: number[];
    export_formats: string[];
  };
}

const AuditLogsContext = createContext<AuditLogsContextType | undefined>(undefined);

// ---------------------------------
// 4. Cache Configuration
// ---------------------------------
const CACHE_CONFIG: CacheConfig = {
  ttl: 5 * 60 * 1000, // 5 minutes
  staleWhileRevalidate: true,
};

// ---------------------------------
// 5. Provider Implementation
// ---------------------------------
export const AuditLogsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { config: appConfig } = useConfig();
  
  // Core async state
  const [auditLogs, setAuditLogs] = useState<AsyncState<AuditLogEntry[]>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    stale: true,
  });
  
  // UI state
  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticUpdate[]>([]);
  const [isPerformingBulkOperation, setIsPerformingBulkOperation] = useState(false);
  
  // Config from backend
  const config = useMemo(() => ({
    actions: appConfig?.audit?.actions || [],
    risk_levels: appConfig?.audit?.risk_levels || [],
    compliance_frameworks: appConfig?.audit?.compliance_frameworks || [],
    retention_periods: appConfig?.audit?.retention_periods || [],
    export_formats: appConfig?.audit?.export_formats || ['json', 'csv'],
  }), [appConfig]);

  /**
   * Check if data is stale based on TTL
   */
  const isStale = useCallback((lastFetch: number | null): boolean => {
    if (!lastFetch) return true;
    return Date.now() - lastFetch > CACHE_CONFIG.ttl;
  }, []);

  /**
   * API orchestration - refresh audit logs
   */
  const refreshAuditLogs = useCallback(async (force = false) => {
    if (!tenantId) return;
    
    // Check cache freshness unless forced
    if (!force && !isStale(auditLogs.lastFetch)) {
      return;
    }
    
    setAuditLogs(prev => ({
      ...prev,
      loading: true,
      error: null,
    }));
    
    try {
      const all = await getAll<AuditLogEntry>(tenantId, "audit_logs");
      
      // Simple client-side sorting for UI (backend should handle complex sorting)
      const sorted = all.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      setAuditLogs({
        data: sorted,
        loading: false,
        error: null,
        lastFetch: Date.now(),
        stale: false,
      });
    } catch (error) {
      setAuditLogs(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to refresh audit logs',
      }));
    }
  }, [tenantId, auditLogs.lastFetch, isStale]);

  /**
   * API orchestration - get single audit log
   */
  const getAuditLog = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    
    // First check local cache
    const cached = auditLogs.data.find(log => log.id === id);
    if (cached && !auditLogs.stale) {
      return cached;
    }
    
    // Fetch from API if not in cache or stale
    try {
      return await getById<AuditLogEntry>(tenantId, "audit_logs", id);
    } catch (error) {
      console.error('Failed to fetch audit log:', error);
      return undefined;
    }
  }, [tenantId, auditLogs.data, auditLogs.stale]);

  // ---------------------------------
  // 6. Client-side Helpers (UI Performance Only)
  // ---------------------------------
  
  const getLogsByEntity = useCallback((entityType: string, entityId?: string) => {
    return auditLogs.data.filter(log => 
      log.entity_type === entityType && 
      (!entityId || log.entity_id === entityId)
    );
  }, [auditLogs.data]);

  const getLogsByUser = useCallback((userId: string) => {
    return auditLogs.data.filter(log => log.user_id === userId);
  }, [auditLogs.data]);

  const getLogsByAction = useCallback((action: AuditAction) => {
    return auditLogs.data.filter(log => log.action === action);
  }, [auditLogs.data]);

  const getLogsByRisk = useCallback((riskLevel: AuditRisk) => {
    return auditLogs.data.filter(log => log.risk_level === riskLevel);
  }, [auditLogs.data]);

  const getLogsByCompliance = useCallback((framework: ComplianceFramework) => {
    return auditLogs.data.filter(log => 
      log.compliance_frameworks.includes(framework)
    );
  }, [auditLogs.data]);

  const getLogsByDateRange = useCallback((startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return auditLogs.data.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= start && logDate <= end;
    });
  }, [auditLogs.data]);

  const getLogsByTags = useCallback((tags: string[]) => {
    return auditLogs.data.filter(log => 
      tags.some(tag => log.tags.includes(tag))
    );
  }, [auditLogs.data]);

  const getLogsWithViolations = useCallback(() => {
    return auditLogs.data.filter(log => 
      log.policy_violations && log.policy_violations.length > 0
    );
  }, [auditLogs.data]);

  const getLogsOnLegalHold = useCallback(() => {
    return auditLogs.data.filter(log => log.legal_hold === true);
  }, [auditLogs.data]);

  /**
   * Simple client-side search for immediate UI feedback
   * Complex search logic handled by backend APIs
   */
  const searchLogs = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return auditLogs.data;
    
    return auditLogs.data.filter(log => 
      log.description.toLowerCase().includes(lowerQuery) ||
      log.entity_type.toLowerCase().includes(lowerQuery) ||
      log.entity_id.toLowerCase().includes(lowerQuery) ||
      log.action.toLowerCase().includes(lowerQuery) ||
      log.user_name?.toLowerCase().includes(lowerQuery) ||
      log.entity_name?.toLowerCase().includes(lowerQuery) ||
      log.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      (log.ip_address && log.ip_address.includes(query))
    );
  }, [auditLogs.data]);

  /**
   * Simple client-side filtering for UI responsiveness
   * Complex business filtering handled by backend
   */
  const filterLogs = useCallback((filters: AuditSearchFilters) => {
    let filtered = auditLogs.data;
    
    if (filters.entityType) {
      filtered = filtered.filter(log => log.entity_type === filters.entityType);
    }
    if (filters.entityId) {
      filtered = filtered.filter(log => log.entity_id === filters.entityId);
    }
    if (filters.userId) {
      filtered = filtered.filter(log => log.user_id === filters.userId);
    }
    if (filters.action) {
      filtered = filtered.filter(log => log.action === filters.action);
    }
    if (filters.riskLevel) {
      filtered = filtered.filter(log => log.risk_level === filters.riskLevel);
    }
    if (filters.complianceFramework) {
      filtered = filtered.filter(log => 
        log.compliance_frameworks?.includes(filters.complianceFramework) || false
      );
    }
    if (filters.hasViolations !== undefined) {
      filtered = filtered.filter(log => 
        !!(log.policy_violations?.length) === filters.hasViolations
      );
    }
    if (filters.legalHold !== undefined) {
      filtered = filtered.filter(log => log.legal_hold === filters.legalHold);
    }
    if (filters.startDate || filters.endDate) {
      filtered = getLogsByDateRange(
        filters.startDate || '1970-01-01',
        filters.endDate || '2099-12-31'
      );
    }
    if (filters.textSearch) {
      filtered = searchLogs(filters.textSearch);
    }
    
    return filtered;
  }, [auditLogs.data, getLogsByDateRange, searchLogs]);

  // ---------------------------------
  // 7. API Operations with Optimistic UI
  // ---------------------------------

  /**
   * Set legal hold with optimistic UI feedback
   * Backend handles all business logic and validation
   */
  const setLegalHold = useCallback(async (entryIds: string[], reason: string) => {
    const optimisticId = `legal_hold_${Date.now()}`;
    
    // Add optimistic update for immediate UI feedback
    setOptimisticUpdates(prev => [...prev, {
      id: optimisticId,
      type: 'legal_hold',
      timestamp: Date.now(),
    }]);
    
    setIsPerformingBulkOperation(true);
    
    try {
      // Backend API call - handles all validation and business rules
      const response = await fetch(`/api/audit-logs/legal-hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryIds, reason, tenantId }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to set legal hold: ${response.statusText}`);
      }
      
      // Remove optimistic update
      setOptimisticUpdates(prev => prev.filter(u => u.id !== optimisticId));
      
      // Refresh data to get authoritative state from backend
      await refreshAuditLogs(true);
      
    } catch (error) {
      // Rollback optimistic update
      setOptimisticUpdates(prev => prev.filter(u => u.id !== optimisticId));
      
      setAuditLogs(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to set legal hold',
      }));
      
      throw error;
    } finally {
      setIsPerformingBulkOperation(false);
    }
  }, [tenantId, refreshAuditLogs]);

  /**
   * Remove legal hold with optimistic UI feedback
   */
  const removeLegalHold = useCallback(async (entryIds: string[]) => {
    const optimisticId = `remove_legal_hold_${Date.now()}`;
    
    setOptimisticUpdates(prev => [...prev, {
      id: optimisticId,
      type: 'legal_hold',
      timestamp: Date.now(),
    }]);
    
    setIsPerformingBulkOperation(true);
    
    try {
      const response = await fetch(`/api/audit-logs/legal-hold`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryIds, tenantId }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to remove legal hold: ${response.statusText}`);
      }
      
      setOptimisticUpdates(prev => prev.filter(u => u.id !== optimisticId));
      await refreshAuditLogs(true);
      
    } catch (error) {
      setOptimisticUpdates(prev => prev.filter(u => u.id !== optimisticId));
      
      setAuditLogs(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to remove legal hold',
      }));
      
      throw error;
    } finally {
      setIsPerformingBulkOperation(false);
    }
  }, [tenantId, refreshAuditLogs]);

  /**
   * Export audit logs - backend handles complex compliance logic
   */
  const exportForCompliance = useCallback(async (
    filters: AuditSearchFilters, 
    format: "json" | "csv" | "pdf"
  ): Promise<Blob> => {
    const optimisticId = `export_${Date.now()}`;
    
    setOptimisticUpdates(prev => [...prev, {
      id: optimisticId,
      type: 'compliance_export',
      timestamp: Date.now(),
    }]);
    
    try {
      const response = await fetch(`/api/audit-logs/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters, format, tenantId }),
      });
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      setOptimisticUpdates(prev => prev.filter(u => u.id !== optimisticId));
      return blob;
      
    } catch (error) {
      setOptimisticUpdates(prev => prev.filter(u => u.id !== optimisticId));
      throw error;
    }
  }, [tenantId]);

  /**
   * Invalidate cache and force refresh
   */
  const invalidateCache = useCallback(() => {
    setAuditLogs(prev => ({ ...prev, stale: true }));
  }, []);

  // ---------------------------------
  // 8. Lifecycle Management
  // ---------------------------------
  
  useEffect(() => {
    if (tenantId) {
      refreshAuditLogs();
    } else {
      setAuditLogs({
        data: [],
        loading: false,
        error: null,
        lastFetch: null,
        stale: true,
      });
    }
  }, [tenantId, refreshAuditLogs]);

  // Cleanup optimistic updates that are too old
  useEffect(() => {
    const cleanup = setInterval(() => {
      setOptimisticUpdates(prev => 
        prev.filter(update => Date.now() - update.timestamp < 30000) // 30 seconds
      );
    }, 10000); // Check every 10 seconds
    
    return () => clearInterval(cleanup);
  }, []);

  // Auto-refresh stale data when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && auditLogs.stale && CACHE_CONFIG.staleWhileRevalidate) {
        refreshAuditLogs();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [auditLogs.stale, refreshAuditLogs]);

  return (
    <AuditLogsContext.Provider
      value={{
        auditLogs,
        refreshAuditLogs,
        getAuditLog,
        getLogsByEntity,
        getLogsByUser,
        getLogsByAction,
        getLogsByRisk,
        getLogsByCompliance,
        getLogsByDateRange,
        getLogsByTags,
        getLogsWithViolations,
        getLogsOnLegalHold,
        searchLogs,
        filterLogs,
        setLegalHold,
        removeLegalHold,
        exportForCompliance,
        optimisticUpdates,
        isPerformingBulkOperation,
        invalidateCache,
        config,
      }}
    >
      {children}
    </AuditLogsContext.Provider>
  );
};

// ---------------------------------
// 9. Specialized Hooks for Selective Subscriptions
// ---------------------------------

export const useAuditLogs = () => {
  const ctx = useContext(AuditLogsContext);
  if (!ctx) throw new Error("useAuditLogs must be used within AuditLogsProvider");
  return ctx;
};

/**
 * Hook for entity-specific audit logs with memoization
 */
export const useEntityAuditLogs = (entityType: string, entityId?: string) => {
  const { getLogsByEntity } = useAuditLogs();
  return useMemo(
    () => getLogsByEntity(entityType, entityId),
    [getLogsByEntity, entityType, entityId]
  );
};

/**
 * Hook for user-specific audit logs with memoization
 */
export const useUserAuditLogs = (userId: string) => {
  const { getLogsByUser } = useAuditLogs();
  return useMemo(() => getLogsByUser(userId), [getLogsByUser, userId]);
};

/**
 * Hook for compliance-specific audit logs with memoization
 */
export const useComplianceAuditLogs = (framework: ComplianceFramework) => {
  const { getLogsByCompliance } = useAuditLogs();
  return useMemo(() => getLogsByCompliance(framework), [getLogsByCompliance, framework]);
};

/**
 * Hook for violations with memoization
 */
export const useAuditViolations = () => {
  const { getLogsWithViolations } = useAuditLogs();
  return useMemo(() => getLogsWithViolations(), [getLogsWithViolations]);
};

/**
 * Hook for legal hold entries with memoization
 */
export const useLegalHoldLogs = () => {
  const { getLogsOnLegalHold } = useAuditLogs();
  return useMemo(() => getLogsOnLegalHold(), [getLogsOnLegalHold]);
};