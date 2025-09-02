import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------

export type SystemMetricCategory =
  | "operations"
  | "reliability"
  | "performance"
  | "business"
  | "automation"
  | "ai"
  | "custom";

export interface SystemMetric {
  id: string;
  name: string;                       // "MTTR", "Uptime %", "Automation Adoption"
  description?: string;
  category: SystemMetricCategory;
  value: number;
  unit?: string;                      // "%", "minutes", "count"
  captured_at: string;                // ISO datetime
  created_at: string;
  updated_at: string;

  // Relationships
  business_service_id?: string | null; // FK → BusinessServicesContext
  value_stream_id?: string | null;     // FK → ValueStreamsContext
  cost_center_id?: string | null;      // FK → CostCentersContext
  owner_user_id?: string | null;       // FK → UsersContext
  owner_team_id?: string | null;       // FK → TeamsContext

  // Target / Baseline
  target?: number;
  baseline?: number;
  variance?: number;                  // vs target or baseline

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------

interface SystemMetricsContextType {
  metrics: SystemMetric[];
  addMetric: (metric: SystemMetric) => void;
  updateMetric: (metric: SystemMetric) => void;
  deleteMetric: (id: string) => void;
  refreshMetrics: () => Promise<void>;
}

const SystemMetricsContext = createContext<SystemMetricsContextType | undefined>(
  undefined
);

// ---------------------------------
// 3. Provider
// ---------------------------------

export const SystemMetricsProvider = ({ children }: { children: ReactNode }) => {
  const [metrics, setMetrics] = useState<SystemMetric[]>([]);

  const refreshMetrics = async () => {
    // TODO: Load from IndexedDB + sync with Postgres
  };

  const addMetric = (metric: SystemMetric) => {
    setMetrics((prev) => [...prev, metric]);
    // TODO: Persist
  };

  const updateMetric = (metric: SystemMetric) => {
    setMetrics((prev) => prev.map((m) => (m.id === metric.id ? metric : m)));
    // TODO: Persist update
  };

  const deleteMetric = (id: string) => {
    setMetrics((prev) => prev.filter((m) => m.id !== id));
    // TODO: Delete
  };

  useEffect(() => {
    refreshMetrics();
  }, []);

  return (
    <SystemMetricsContext.Provider
      value={{ metrics, addMetric, updateMetric, deleteMetric, refreshMetrics }}
    >
      {children}
    </SystemMetricsContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------

export const useSystemMetrics = () => {
  const ctx = useContext(SystemMetricsContext);
  if (!ctx) throw new Error("useSystemMetrics must be used within SystemMetricsProvider");
  return ctx;
};

export const useSystemMetricDetails = (id: string) => {
  const { metrics } = useSystemMetrics();
  return metrics.find((m) => m.id === id) || null;
};