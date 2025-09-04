
// src/providers/AuditLogsProvider.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { getAll } from "../db/dbClient";
import { useTenant } from "./TenantProvider";
import { useConfig } from "./ConfigProvider";
import { useSync } from "./SyncProvider";
import { useNotification } from "./NotificationProvider";

interface AuditLogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  description: string;
  timestamp: string;
  user_id: string | null;
  tags: string[];
  hash: string;
  tenantId: string;
  metadata?: Record<string, any>;
}

interface AuditLogsContextType {
  auditLogs: AuditLogEntry[];
  isLoading: boolean;
  error: string | null;
  
  // Filtering methods
  getLogsByEntity: (entityType: string, entityId?: string) => AuditLogEntry[];
  getLogsByUser: (userId: string) => AuditLogEntry[];
  getLogsByAction: (action: string) => AuditLogEntry[];
  getLogsByDateRange: (startDate: string, endDate: string) => AuditLogEntry[];
  getLogsByTags: (tags: string[]) => AuditLogEntry[];
  
  // Operations
  refreshAuditLogs: () => Promise<void>;
  searchLogs: (query: string) => AuditLogEntry[];
}

const AuditLogsContext = createContext<AuditLogsContextType | undefined>(undefined);

export const AuditLogsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId, isInitialized, isLoading: tenantLoading, error: tenantError } = useTenant();
  const { config, isLoading: configLoading, error: configError } = useConfig();
  const { error: syncError } = useSync();
  const { error: notificationError } = useNotification();
  
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Propagate parent errors
  useEffect(() => {
    if (tenantError) {
      setError(`Tenant error: ${tenantError}`);
      setAuditLogs([]);
    } else if (configError) {
      setError(`Config error: ${configError}`);
      setAuditLogs([]);
    } else if (syncError) {
      setError(`Sync error: ${syncError}`);
    } else if (notificationError) {
      setError(`Notification error: ${notificationError}`);
    }
  }, [tenantError, configError, syncError, notificationError]);

  // Load audit logs when all dependencies are ready
  useEffect(() => {
    if (tenantId && isInitialized && !tenantLoading && config && !tenantError && !configError && !syncError && !notificationError) {
      refreshAuditLogs();
    } else if (!tenantId) {
      setAuditLogs([]);
      if (!tenantError && !configError && !syncError && !notificationError) {
        setError(null);
      }
    }
  }, [tenantId, isInitialized, tenantLoading, config, tenantError, configError, syncError, notificationError]);

  const refreshAuditLogs = useCallback(async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const logs = await getAll<AuditLogEntry>(tenantId, 'audit_logs');
      
      // Sort by timestamp (newest first)
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setAuditLogs(logs);
      console.log(`Loaded ${logs.length} audit log entries for tenant ${tenantId}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load audit logs';
      console.error('Audit logs loading error:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  // Filtering methods
  const getLogsByEntity = useCallback((entityType: string, entityId?: string) => {
    return auditLogs.filter(log => 
      log.entity_type === entityType && 
      (!entityId || log.entity_id === entityId)
    );
  }, [auditLogs]);

  const getLogsByUser = useCallback((userId: string) => {
    return auditLogs.filter(log => log.user_id === userId);
  }, [auditLogs]);

  const getLogsByAction = useCallback((action: string) => {
    return auditLogs.filter(log => log.action === action);
  }, [auditLogs]);

  const getLogsByDateRange = useCallback((startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return auditLogs.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= start && logDate <= end;
    });
  }, [auditLogs]);

  const getLogsByTags = useCallback((tags: string[]) => {
    return auditLogs.filter(log => 
      tags.some(tag => log.tags.includes(tag))
    );
  }, [auditLogs]);

  const searchLogs = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return auditLogs.filter(log => 
      log.description.toLowerCase().includes(lowerQuery) ||
      log.action.toLowerCase().includes(lowerQuery) ||
      log.entity_type.toLowerCase().includes(lowerQuery) ||
      log.entity_id.toLowerCase().includes(lowerQuery) ||
      log.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }, [auditLogs]);

  return (
    <AuditLogsContext.Provider
      value={{
        auditLogs,
        isLoading,
        error,
        getLogsByEntity,
        getLogsByUser,
        getLogsByAction,
        getLogsByDateRange,
        getLogsByTags,
        refreshAuditLogs,
        searchLogs,
      }}
    >
      {children}
    </AuditLogsContext.Provider>
  );
};

export const useAuditLogs = () => {
  const ctx = useContext(AuditLogsContext);
  if (!ctx) {
    throw new Error("useAuditLogs must be used within AuditLogsProvider");
  }
  return ctx;
};
