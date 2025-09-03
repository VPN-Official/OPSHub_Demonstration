// src/contexts/AuditLogsContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { 
  getAll,
  getById,
} from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { generateImmutableHash } from "../utils/auditUtils";

// ---------------------------------
// 1. Type Definitions
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

export interface AuditLogEntry {
  id: string;
  entity_type: string; // "incident", "change", "user", "contract", etc.
  entity_id: string;
  entity_name?: string;
  action: AuditAction;
  description: string;
  timestamp: string;
  
  // Actor information (immutable once set)
  user_id?: string | null;
  user_name?: string;
  team_id?: string | null;
  team_name?: string;
  ai_agent_id?: string | null;
  automation_rule_id?: string | null;
  
  // Session and security context
  session_id?: string;
  ip_address?: string;
  user_agent?: string;
  location?: string; // Geolocation if available
  device_id?: string;
  device_fingerprint?: string;
  
  // Change tracking (before/after values)
  field_changes?: Array<{
    field: string;
    old_value?: any;
    new_value?: any;
    field_type?: string;
  }>;
  
  // Business and compliance context
  business_service_id?: string;
  customer_id?: string;
  cost_center_id?: string;
  contract_id?: string;
  risk_level: AuditRisk;
  compliance_frameworks: ComplianceFramework[];
  data_classification?: "public" | "internal" | "confidential" | "restricted";
  
  // Audit metadata (immutable)
  hash: string; // Tamper-proof cryptographic hash
  previous_hash?: string; // Chain of audit entries
  sequence_number?: number; // Order in the audit chain
  audit_source: "system" | "user" | "api" | "import" | "migration";
  
  // Retention and legal hold
  retention_period_days?: number;
  legal_hold?: boolean;
  legal_hold_reason?: string;
  
  // Additional context
  correlation_id?: string; // Group related audit entries
  parent_audit_id?: string; // Parent transaction
  child_audit_ids: string[]; // Child transactions
  
  // Compliance flags and violations
  compliance_flags?: string[];
  policy_violations?: Array<{
    policy_id: string;
    policy_name: string;
    violation_type: string;
    severity: "low" | "medium" | "high" | "critical";
  }>;
  
  // Metadata (cannot be modified after creation)
  tags: string[];
  metadata?: Record<string, any>;
  tenantId: string;
}

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
}

export interface AuditStats {
  totalEntries: number;
  uniqueUsers: number;
  riskDistribution: Record<AuditRisk, number>;
  actionDistribution: Record<string, number>;
  complianceViolations: number;
  failedActions: number;
  suspiciousActivities: number;
  entriesOnLegalHold: number;
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------
interface AuditLogsContextType {
  auditLogs: AuditLogEntry[];
  refreshAuditLogs: () => Promise<void>;
  
  // Read-only operations (audit logs are append-only)
  getAuditLog: (id: string) => Promise<AuditLogEntry | undefined>;
  
  // Filtering and search
  getLogsByEntity: (entityType: string, entityId?: string) => AuditLogEntry[];
  getLogsByUser: (userId: string) => AuditLogEntry[];
  getLogsByAction: (action: AuditAction) => AuditLogEntry[];
  getLogsByRisk: (riskLevel: AuditRisk) => AuditLogEntry[];
  getLogsByCompliance: (framework: ComplianceFramework) => AuditLogEntry[];
  getLogsByDateRange: (startDate: string, endDate: string) => AuditLogEntry[];
  getLogsByTags: (tags: string[]) => AuditLogEntry[];
  getLogsWithViolations: () => AuditLogEntry[];
  getLogsOnLegalHold: () => AuditLogEntry[];
  getSuspiciousActivities: () => AuditLogEntry[];
  getFailedActions: () => AuditLogEntry[];
  
  // Advanced search
  searchLogs: (query: string) => AuditLogEntry[];
  filterLogs: (filters: AuditSearchFilters) => AuditLogEntry[];
  
  // Analytics and reporting
  getAuditStats: (timeframe?: "day" | "week" | "month" | "year") => AuditStats;
  getComplianceReport: (framework: ComplianceFramework, dateRange: { start: string; end: string }) => {
    totalEntries: number;
    violations: number;
    riskBreakdown: Record<AuditRisk, number>;
    topViolations: Array<{ type: string; count: number }>;
    timeline: Array<{ date: string; entries: number; violations: number }>;
  };
  
  // Integrity verification
  verifyAuditChain: () => Promise<{ valid: boolean; brokenAt?: number; errors: string[] }>;
  validateEntry: (entry: AuditLogEntry) => Promise<{ valid: boolean; error?: string }>;
  
  // Legal and compliance
  setLegalHold: (entryIds: string[], reason: string) => Promise<void>;
  removeLegalHold: (entryIds: string[]) => Promise<void>;
  exportForCompliance: (filters: AuditSearchFilters, format: "json" | "csv" | "pdf") => Promise<Blob>;
}

const AuditLogsContext = createContext<AuditLogsContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------
export const AuditLogsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const refreshAuditLogs = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      const all = await getAll<AuditLogEntry>(tenantId, "audit_logs");
      
      // Sort by sequence number and timestamp (newest first)
      all.sort((a, b) => {
        if (a.sequence_number !== undefined && b.sequence_number !== undefined) {
          return b.sequence_number - a.sequence_number;
        }
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
      
      setAuditLogs(all);
    } catch (error) {
      console.error("Failed to refresh audit logs:", error);
    }
  }, [tenantId]);

  const getAuditLog = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    return getById<AuditLogEntry>(tenantId, "audit_logs", id);
  }, [tenantId]);

  // Filtering functions
  const getLogsByEntity = useCallback((entityType: string, entityId?: string) => {
    return auditLogs.filter(log => 
      log.entity_type === entityType && 
      (!entityId || log.entity_id === entityId)
    );
  }, [auditLogs]);

  const getLogsByUser = useCallback((userId: string) => {
    return auditLogs.filter(log => log.user_id === userId);
  }, [auditLogs]);

  const getLogsByAction = useCallback((action: AuditAction) => {
    return auditLogs.filter(log => log.action === action);
  }, [auditLogs]);

  const getLogsByRisk = useCallback((riskLevel: AuditRisk) => {
    return auditLogs.filter(log => log.risk_level === riskLevel);
  }, [auditLogs]);

  const getLogsByCompliance = useCallback((framework: ComplianceFramework) => {
    return auditLogs.filter(log => log.compliance_frameworks.includes(framework));
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

  const getLogsWithViolations = useCallback(() => {
    return auditLogs.filter(log => 
      log.policy_violations && log.policy_violations.length > 0
    );
  }, [auditLogs]);

  const getLogsOnLegalHold = useCallback(() => {
    return auditLogs.filter(log => log.legal_hold === true);
  }, [auditLogs]);

  const getSuspiciousActivities = useCallback(() => {
    return auditLogs.filter(log => {
      // Define suspicious activity criteria
      const suspiciousIndicators = [
        log.risk_level === 'critical',
        log.action === 'delete' && log.risk_level === 'high',
        log.policy_violations && log.policy_violations.length > 0,
        log.compliance_flags && log.compliance_flags.includes('suspicious'),
        // Multiple failed attempts from same IP
        // Unusual timing patterns
        // Access to restricted data
      ];
      
      return suspiciousIndicators.some(Boolean);
    });
  }, [auditLogs]);

  const getFailedActions = useCallback(() => {
    return auditLogs.filter(log => 
      log.tags.includes('failed') || 
      log.tags.includes('error') ||
      log.compliance_flags?.includes('failed')
    );
  }, [auditLogs]);

  const searchLogs = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return auditLogs.filter(log => 
      log.description.toLowerCase().includes(lowerQuery) ||
      log.entity_type.toLowerCase().includes(lowerQuery) ||
      log.entity_id.toLowerCase().includes(lowerQuery) ||
      log.action.toLowerCase().includes(lowerQuery) ||
      log.user_name?.toLowerCase().includes(lowerQuery) ||
      log.entity_name?.toLowerCase().includes(lowerQuery) ||
      log.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      (log.ip_address && log.ip_address.includes(query))
    );
  }, [auditLogs]);

  const filterLogs = useCallback((filters: AuditSearchFilters) => {
    return auditLogs.filter(log => {
      if (filters.entityType && log.entity_type !== filters.entityType) return false;
      if (filters.entityId && log.entity_id !== filters.entityId) return false;
      if (filters.userId && log.user_id !== filters.userId) return false;
      if (filters.action && log.action !== filters.action) return false;
      if (filters.riskLevel && log.risk_level !== filters.riskLevel) return false;
      if (filters.complianceFramework && !log.compliance_frameworks.includes(filters.complianceFramework)) return false;
      if (filters.ipAddress && log.ip_address !== filters.ipAddress) return false;
      if (filters.businessServiceId && log.business_service_id !== filters.businessServiceId) return false;
      if (filters.customerId && log.customer_id !== filters.customerId) return false;
      if (filters.hasViolations !== undefined && !!(log.policy_violations?.length) !== filters.hasViolations) return false;
      if (filters.legalHold !== undefined && log.legal_hold !== filters.legalHold) return false;
      
      if (filters.startDate || filters.endDate) {
        const logDate = new Date(log.timestamp);
        if (filters.startDate && logDate < new Date(filters.startDate)) return false;
        if (filters.endDate && logDate > new Date(filters.endDate)) return false;
      }
      
      if (filters.textSearch) {
        const searchResult = searchLogs(filters.textSearch);
        return searchResult.some(result => result.id === log.id);
      }
      
      return true;
    });
  }, [auditLogs, searchLogs]);

  const getAuditStats = useCallback((timeframe: "day" | "week" | "month" | "year" = "week") => {
    const now = new Date();
    let startDate: Date;
    
    switch (timeframe) {
      case "day":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
    }
    
    const filteredLogs = auditLogs.filter(log => new Date(log.timestamp) >= startDate);
    const uniqueUsers = new Set(filteredLogs.map(log => log.user_id).filter(Boolean)).size;
    
    // Risk distribution
    const riskDistribution = filteredLogs.reduce((acc, log) => {
      acc[log.risk_level] = (acc[log.risk_level] || 0) + 1;
      return acc;
    }, {} as Record<AuditRisk, number>);
    
    // Action distribution
    const actionDistribution = filteredLogs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const complianceViolations = filteredLogs.filter(log => 
      log.policy_violations && log.policy_violations.length > 0
    ).length;
    
    const failedActions = getFailedActions().filter(log => 
      new Date(log.timestamp) >= startDate
    ).length;
    
    const suspiciousActivities = getSuspiciousActivities().filter(log => 
      new Date(log.timestamp) >= startDate
    ).length;
    
    const entriesOnLegalHold = filteredLogs.filter(log => log.legal_hold).length;
    
    return {
      totalEntries: filteredLogs.length,
      uniqueUsers,
      riskDistribution,
      actionDistribution,
      complianceViolations,
      failedActions,
      suspiciousActivities,
      entriesOnLegalHold,
    };
  }, [auditLogs, getFailedActions, getSuspiciousActivities]);

  const getComplianceReport = useCallback((
    framework: ComplianceFramework, 
    dateRange: { start: string; end: string }
  ) => {
    const relevantLogs = getLogsByCompliance(framework).filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= new Date(dateRange.start) && logDate <= new Date(dateRange.end);
    });
    
    const violations = relevantLogs.filter(log => 
      log.policy_violations && log.policy_violations.length > 0
    ).length;
    
    const riskBreakdown = relevantLogs.reduce((acc, log) => {
      acc[log.risk_level] = (acc[log.risk_level] || 0) + 1;
      return acc;
    }, {} as Record<AuditRisk, number>);
    
    // Top violation types
    const violationCounts: Record<string, number> = {};
    relevantLogs.forEach(log => {
      log.policy_violations?.forEach(violation => {
        violationCounts[violation.violation_type] = (violationCounts[violation.violation_type] || 0) + 1;
      });
    });
    
    const topViolations = Object.entries(violationCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([type, count]) => ({ type, count }));
    
    // Timeline (daily breakdown)
    const timeline: Array<{ date: string; entries: number; violations: number }> = [];
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayLogs = relevantLogs.filter(log => log.timestamp.startsWith(dateStr));
      const dayViolations = dayLogs.filter(log => 
        log.policy_violations && log.policy_violations.length > 0
      ).length;
      
      timeline.push({
        date: dateStr,
        entries: dayLogs.length,
        violations: dayViolations,
      });
    }
    
    return {
      totalEntries: relevantLogs.length,
      violations,
      riskBreakdown,
      topViolations,
      timeline,
    };
  }, [getLogsByCompliance]);

  const verifyAuditChain = useCallback(async (): Promise<{ valid: boolean; brokenAt?: number; errors: string[] }> => {
    const errors: string[] = [];
    
    try {
      // Sort logs by sequence number
      const sortedLogs = [...auditLogs].sort((a, b) => 
        (a.sequence_number || 0) - (b.sequence_number || 0)
      );
      
      let previousHash = '';
      
      for (let i = 0; i < sortedLogs.length; i++) {
        const log = sortedLogs[i];
        
        // Verify hash integrity
        const expectedHash = await generateImmutableHash({
          entity_type: log.entity_type,
          entity_id: log.entity_id,
          action: log.action,
          timestamp: log.timestamp,
          user_id: log.user_id,
          description: log.description,
          previous_hash: previousHash,
          sequence_number: log.sequence_number,
        });
        
        if (log.hash !== expectedHash) {
          errors.push(`Hash mismatch at sequence ${log.sequence_number || i}: expected ${expectedHash}, got ${log.hash}`);
        }
        
        // Verify chain continuity
        if (i > 0 && log.previous_hash !== previousHash) {
          errors.push(`Chain break at sequence ${log.sequence_number || i}: previous hash mismatch`);
          return { valid: false, brokenAt: log.sequence_number || i, errors };
        }
        
        previousHash = log.hash;
      }
      
      return { valid: errors.length === 0, errors };
    } catch (error) {
      return { 
        valid: false, 
        errors: [`Chain verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      };
    }
  }, [auditLogs]);

  const validateEntry = useCallback(async (entry: AuditLogEntry): Promise<{ valid: boolean; error?: string }> => {
    try {
      const expectedHash = await generateImmutableHash({
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
        action: entry.action,
        timestamp: entry.timestamp,
        user_id: entry.user_id,
        description: entry.description,
        previous_hash: entry.previous_hash,
        sequence_number: entry.sequence_number,
      });
      
      if (entry.hash !== expectedHash) {
        return { valid: false, error: `Hash validation failed: expected ${expectedHash}, got ${entry.hash}` };
      }
      
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }, []);

  const setLegalHold = useCallback(async (entryIds: string[], reason: string) => {
    // Note: This would typically require special permissions and audit trail
    // For now, we'll just log that a legal hold was requested
    console.log(`Legal hold requested for ${entryIds.length} audit entries. Reason: ${reason}`);
    
    // In a real implementation, this would update the entries in the database
    // But since audit logs are immutable, this might create new entries indicating the hold
  }, []);

  const removeLegalHold = useCallback(async (entryIds: string[]) => {
    // Similar to setLegalHold, this would be a controlled operation
    console.log(`Legal hold removal requested for ${entryIds.length} audit entries`);
  }, []);

  const exportForCompliance = useCallback(async (
    filters: AuditSearchFilters, 
    format: "json" | "csv" | "pdf"
  ): Promise<Blob> => {
    const filteredLogs = filterLogs(filters);
    
    if (format === "json") {
      const jsonData = JSON.stringify(filteredLogs, null, 2);
      return new Blob([jsonData], { type: "application/json" });
    } else if (format === "csv") {
      // Convert to CSV format
      const headers = ["timestamp", "entity_type", "entity_id", "action", "user_id", "description", "risk_level"];
      const csvData = [
        headers.join(","),
        ...filteredLogs.map(log => headers.map(h => (log as any)[h] || "").join(","))
      ].join("\n");
      return new Blob([csvData], { type: "text/csv" });
    } else {
      // PDF format would require a PDF library
      throw new Error("PDF export not implemented");
    }
  }, [filterLogs]);

  // Initialize
  useEffect(() => {
    if (tenantId) {
      refreshAuditLogs();
    } else {
      setAuditLogs([]);
    }
  }, [tenantId, refreshAuditLogs]);

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
        getSuspiciousActivities,
        getFailedActions,
        searchLogs,
        filterLogs,
        getAuditStats,
        getComplianceReport,
        verifyAuditChain,
        validateEntry,
        setLegalHold,
        removeLegalHold,
        exportForCompliance,
      }}
    >
      {children}
    </AuditLogsContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------
export const useAuditLogs = () => {
  const ctx = useContext(AuditLogsContext);
  if (!ctx) throw new Error("useAuditLogs must be used within AuditLogsProvider");
  return ctx;
};

export const useEntityAuditLogs = (entityType: string, entityId?: string) => {
  const { getLogsByEntity } = useAuditLogs();
  return getLogsByEntity(entityType, entityId);
};

export const useUserAuditLogs = (userId: string) => {
  const { getLogsByUser } = useAuditLogs();
  return getLogsByUser(userId);
};

export const useComplianceAuditLogs = (framework: ComplianceFramework) => {
  const { getLogsByCompliance } = useAuditLogs();
  return getLogsByCompliance(framework);
};

export const useSuspiciousActivities = () => {
  const { getSuspiciousActivities } = useAuditLogs();
  return getSuspiciousActivities();
};

export const useAuditStats = (timeframe?: "day" | "week" | "month" | "year") => {
  const { getAuditStats } = useAuditLogs();
  return getAuditStats(timeframe);
};