import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAll, getById } from "../db/dbClient";
import { putWithAudit, removeWithAudit } from "../db/dbClient"
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { loadConfig } from "../config/configLoader";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------

export interface Trace {
  id: string;
  source_system: string;   // from config.telemetry.traces.source_systems
  trace_id: string;
  span_id: string;
  parent_span_id?: string | null;
  operation: string;       // from config.telemetry.traces.allowed_operations
  duration_ms: number;
  captured_at: string;

  asset_id?: string | null;
  service_component_id?: string | null;
  business_service_id?: string | null;

  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
}

interface TracesContextType {
  traces: Trace[];
  addTrace: (trace: Trace, userId?: string) => Promise<void>;
  updateTrace: (trace: Trace, userId?: string) => Promise<void>;
  deleteTrace: (id: string, userId?: string) => Promise<void>;
  refreshTraces: () => Promise<void>;
  getTrace: (id: string) => Promise<Trace | undefined>;

  // Config-driven enums
  config: {
    source_systems: string[];
    allowed_operations: string[];
    sampling_rules: Record<string, any>;
  };
}

const TracesContext = createContext<TracesContextType | undefined>(undefined);

// ---------------------------------
// 2. Provider
// ---------------------------------

export const TracesProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueue } = useSync();
  const [traces, setTraces] = useState<Trace[]>([]);

  // 🔑 Tenant-specific config
  const config = loadConfig(tenantId).telemetry.traces;

  const refreshTraces = async () => {
    const all = await getAll<Trace>(tenantId, "traces");
    setTraces(all);
  };

  const getTrace = async (id: string) => {
    return getById<Trace>(tenantId, "traces", id);
  };

  const addTrace = async (trace: Trace, userId?: string) => {
    // ✅ Config validation
    if (!config.source_systems.includes(trace.source_system)) {
      throw new Error(`Invalid source system: ${trace.source_system}`);
    }
    if (!config.allowed_operations.includes(trace.operation)) {
      throw new Error(`Invalid operation: ${trace.operation}`);
    }

    await putWithAudit(
      tenantId,
      "traces",
      trace,
      userId,
      { action: "create", description: `Trace ${trace.trace_id} created` },
      enqueue
    );
    await refreshTraces();
  };

  const updateTrace = async (trace: Trace, userId?: string) => {
    await putWithAudit(
      tenantId,
      "traces",
      trace,
      userId,
      { action: "update", description: `Trace ${trace.trace_id} updated` },
      enqueue
    );
    await refreshTraces();
  };

  const deleteTrace = async (id: string, userId?: string) => {
    await removeWithAudit(
      tenantId,
      "traces",
      id,
      userId,
      { description: `Trace ${id} deleted` },
      enqueue
    );
    await refreshTraces();
  };

  useEffect(() => {
    refreshTraces();
  }, [tenantId]);

  return (
    <TracesContext.Provider
      value={{
        traces,
        addTrace,
        updateTrace,
        deleteTrace,
        refreshTraces,
        getTrace,
        config,
      }}
    >
      {children}
    </TracesContext.Provider>
  );
};

// ---------------------------------
// 3. Hooks
// ---------------------------------

export const useTraces = () => {
  const ctx = useContext(TracesContext);
  if (!ctx) throw new Error("useTraces must be used within TracesProvider");
  return ctx;
};

export const useTraceDetails = (id: string) => {
  const { traces } = useTraces();
  return traces.find((t) => t.id === id) || null;
};