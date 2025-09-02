import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAll } from "../db/dbClient";
import { putWithAudit } from "../db/dbClientWithAudit"; // audit entries log themselves
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";

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
  | "custom";

export interface AuditLog {
  id: string;
  entity_type: string; // "incident", "change", "user", "contract"
  entity_id: string;
  action: AuditAction;
  timestamp: string;

  // Actor
  user_id?: string | null;
  team_id?: string | null;
  ai_agent_id?: string | null;
  automation_rule_id?: string | null;

  // Compliance Metadata
  ip_address?: string;
  location?: string;
  device_id?: string | null;
  immutable_hash: string;
  compliance_flags?: string[];

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
}

// ---------------------------------
// Context Interface
// ---------------------------------
interface AuditLogsContextType {
  auditLogs: AuditLog[];
  addAuditLog: (log: AuditLog) => Promise<void>; // append-only
  refreshAuditLogs: () => Promise<void>;
  getLogsByEntity: (entityId: string, entityType: string) => AuditLog[];
  clearAuditLogs: () => void; // local cache only
}

const AuditLogsContext = createContext<AuditLogsContextType | undefined>(undefined);

// ---------------------------------
// Provider
// ---------------------------------
export const AuditLogsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueue } = useSync();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const refreshAuditLogs = async () => {
    const all = await getAll<AuditLog>(tenantId, "audit_logs");
    setAuditLogs(all);
  };

  const addAuditLog = async (log: AuditLog) => {
    await putWithAudit(
      tenantId,
      "audit_logs",
      log,
      log.user_id,
      { action: log.action, description: `Audit log for ${log.entity_type}:${log.entity_id}` },
      enqueue
    );
    await refreshAuditLogs();
  };

  const getLogsByEntity = (entityId: string, entityType: string) => {
    return auditLogs.filter((a) => a.entity_id === entityId && a.entity_type === entityType);
  };

  const clearAuditLogs = () => {
    setAuditLogs([]);
    // NOTE: only clears local cache, server logs remain immutable
  };

  useEffect(() => {
    refreshAuditLogs();
  }, [tenantId]);

  return (
    <AuditLogsContext.Provider
      value={{ auditLogs, addAuditLog, refreshAuditLogs, getLogsByEntity, clearAuditLogs }}
    >
      {children}
    </AuditLogsContext.Provider>
  );
};

// ---------------------------------
// Hooks
// ---------------------------------
export const useAuditLogs = () => {
  const ctx = useContext(AuditLogsContext);
  if (!ctx) throw new Error("useAuditLogs must be used within AuditLogsProvider");
  return ctx;
};

export const useEntityAuditLogs = (entityId: string, entityType: string) => {
  const { getLogsByEntity } = useAuditLogs();
  return getLogsByEntity(entityId, entityType);
};