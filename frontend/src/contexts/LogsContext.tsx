import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAll, getById } from "../db/dbClient";
import { putWithAudit, removeWithAudit } from "../db/dbClient"
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";

export interface Log {
  id: string;
  source_system: string;
  message: string;
  level: "debug" | "info" | "warn" | "error";
  captured_at: string;

  asset_id?: string | null;
  service_component_id?: string | null;
  business_service_id?: string | null;

  trace_id?: string | null;
  span_id?: string | null;

  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
}

interface LogsContextType {
  logs: Log[];
  addLog: (log: Log, userId?: string) => Promise<void>;
  updateLog: (log: Log, userId?: string) => Promise<void>;
  deleteLog: (id: string, userId?: string) => Promise<void>;
  refreshLogs: () => Promise<void>;
  getLog: (id: string) => Promise<Log | undefined>;
}

const LogsContext = createContext<LogsContextType | undefined>(undefined);

export const LogsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const [logs, setLogs] = useState<Log[]>([]);

  const refreshLogs = async () => {
    const all = await getAll<Log>(tenantId, "logs");
    setLogs(all);
  };

  const getLog = async (id: string) => {
    return getById<Log>(tenantId, "logs", id);
  };

  const addLog = async (log: Log, userId?: string) => {
    await putWithAudit(
      tenantId,
      "logs",
      log,
      userId,
      { action: "create", description: `Log from ${log.source_system} created` },
      enqueue
    );
    await refreshLogs();
  };

  const updateLog = async (log: Log, userId?: string) => {
    await putWithAudit(
      tenantId,
      "logs",
      log,
      userId,
      { action: "update", description: `Log ${log.id} updated` },
      enqueue
    );
    await refreshLogs();
  };

  const deleteLog = async (id: string, userId?: string) => {
    await removeWithAudit(
      tenantId,
      "logs",
      id,
      userId,
      { description: `Log ${id} deleted` },
      enqueue
    );
    await refreshLogs();
  };

  useEffect(() => { refreshLogs(); }, [tenantId]);

  return (
    <LogsContext.Provider value={{ logs, addLog, updateLog, deleteLog, refreshLogs, getLog }}>
      {children}
    </LogsContext.Provider>
  );
};

export const useLogs = () => {
  const ctx = useContext(LogsContext);
  if (!ctx) throw new Error("useLogs must be used within LogsProvider");
  return ctx;
};

export const useLogDetails = (id: string) => {
  const { logs } = useLogs();
  return logs.find((l) => l.id === id) || null;
};