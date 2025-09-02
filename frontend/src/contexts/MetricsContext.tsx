import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAll, getById } from "../db/dbClient";
import { putWithAudit, removeWithAudit } from "../db/dbClient"
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";

export interface Metric {
  id: string;
  source_system: string;
  name: string;
  value: number;
  unit?: string;
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

interface MetricsContextType {
  metrics: Metric[];
  addMetric: (metric: Metric, userId?: string) => Promise<void>;
  updateMetric: (metric: Metric, userId?: string) => Promise<void>;
  deleteMetric: (id: string, userId?: string) => Promise<void>;
  refreshMetrics: () => Promise<void>;
  getMetric: (id: string) => Promise<Metric | undefined>;
}

const MetricsContext = createContext<MetricsContextType | undefined>(undefined);

export const MetricsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueue } = useSync();
  const [metrics, setMetrics] = useState<Metric[]>([]);

  const refreshMetrics = async () => {
    const all = await getAll<Metric>(tenantId, "metrics");
    setMetrics(all);
  };

  const getMetric = async (id: string) => {
    return getById<Metric>(tenantId, "metrics", id);
  };

  const addMetric = async (metric: Metric, userId?: string) => {
    await putWithAudit(
      tenantId,
      "metrics",
      metric,
      userId,
      { action: "create", description: `Metric "${metric.name}" created` },
      enqueue
    );
    await refreshMetrics();
  };

  const updateMetric = async (metric: Metric, userId?: string) => {
    await putWithAudit(
      tenantId,
      "metrics",
      metric,
      userId,
      { action: "update", description: `Metric "${metric.name}" updated` },
      enqueue
    );
    await refreshMetrics();
  };

  const deleteMetric = async (id: string, userId?: string) => {
    await removeWithAudit(
      tenantId,
      "metrics",
      id,
      userId,
      { description: `Metric ${id} deleted` },
      enqueue
    );
    await refreshMetrics();
  };

  useEffect(() => { refreshMetrics(); }, [tenantId]);

  return (
    <MetricsContext.Provider value={{ metrics, addMetric, updateMetric, deleteMetric, refreshMetrics, getMetric }}>
      {children}
    </MetricsContext.Provider>
  );
};

export const useMetrics = () => {
  const ctx = useContext(MetricsContext);
  if (!ctx) throw new Error("useMetrics must be used within MetricsProvider");
  return ctx;
};

export const useMetricDetails = (id: string) => {
  const { metrics } = useMetrics();
  return metrics.find((m) => m.id === id) || null;
};