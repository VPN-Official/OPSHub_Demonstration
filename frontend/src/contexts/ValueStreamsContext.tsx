import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAll, getById } from "../db/dbClient";
import { putWithAudit, removeWithAudit } from "../db/dbClient"
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { loadConfig } from "../config/configLoader";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------

export interface CustomKpi {
  name: string;
  target: number;
  unit: string;
  current?: number;
}

export interface ValueStream {
  id: string;
  name: string;
  description: string;
  industry?: string; // must match config.business.value_streams.industries
  tier?: string;     // must match config.business.value_streams.tiers
  created_at: string;
  updated_at: string;

  // Ownership
  business_owner_user_id?: string | null;
  business_owner_team_id?: string | null;

  // Relationships
  business_service_ids: string[];
  customer_ids: string[];
  cost_center_ids: string[];

  // KPIs
  enterprise_kpi_ids: string[];
  custom_kpis: CustomKpi[];

  // Risk & Compliance
  risk_score?: number;
  compliance_requirement_ids: string[];

  // Business Impact
  revenue_impact_per_hour?: number | null;
  annual_value?: number | null;
  strategic_importance?: string; // must match config.business.value_streams.importance_levels

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------
interface ValueStreamsContextType {
  valueStreams: ValueStream[];
  addValueStream: (vs: ValueStream, userId?: string) => Promise<void>;
  updateValueStream: (vs: ValueStream, userId?: string) => Promise<void>;
  deleteValueStream: (id: string, userId?: string) => Promise<void>;
  refreshValueStreams: () => Promise<void>;
  getValueStream: (id: string) => Promise<ValueStream | undefined>;

  // NEW: expose config for UI
  config: {
    industries: string[];
    tiers: string[];
    importance_levels: string[];
  };
}

const ValueStreamsContext = createContext<ValueStreamsContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------
export const ValueStreamsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueue } = useSync();
  const [valueStreams, setValueStreams] = useState<ValueStream[]>([]);

  const config = loadConfig(tenantId).business.value_streams;

  const refreshValueStreams = async () => {
    const all = await getAll<ValueStream>(tenantId, "value_streams");
    setValueStreams(all);
  };

  const getValueStream = async (id: string) => {
    return getById<ValueStream>(tenantId, "value_streams", id);
  };

  const addValueStream = async (vs: ValueStream, userId?: string) => {
    // ✅ Validate against tenant config
    if (vs.industry && !config.industries.includes(vs.industry)) {
      throw new Error(`Invalid industry: ${vs.industry}`);
    }
    if (vs.tier && !config.tiers.includes(vs.tier)) {
      throw new Error(`Invalid tier: ${vs.tier}`);
    }
    if (vs.strategic_importance && !config.importance_levels.includes(vs.strategic_importance)) {
      throw new Error(`Invalid importance level: ${vs.strategic_importance}`);
    }

    await putWithAudit(
      tenantId,
      "value_streams",
      vs,
      userId,
      { action: "create", description: `Value Stream "${vs.name}" created` },
      enqueue
    );
    await refreshValueStreams();
  };

  const updateValueStream = async (vs: ValueStream, userId?: string) => {
    await putWithAudit(
      tenantId,
      "value_streams",
      vs,
      userId,
      { action: "update", description: `Value Stream "${vs.name}" updated` },
      enqueue
    );
    await refreshValueStreams();
  };

  const deleteValueStream = async (id: string, userId?: string) => {
    await removeWithAudit(
      tenantId,
      "value_streams",
      id,
      userId,
      { description: `Value Stream ${id} deleted` },
      enqueue
    );
    await refreshValueStreams();
  };

  useEffect(() => {
    refreshValueStreams();
  }, [tenantId]);

  return (
    <ValueStreamsContext.Provider
      value={{
        valueStreams,
        addValueStream,
        updateValueStream,
        deleteValueStream,
        refreshValueStreams,
        getValueStream,
        config,
      }}
    >
      {children}
    </ValueStreamsContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------
export const useValueStreams = () => {
  const ctx = useContext(ValueStreamsContext);
  if (!ctx) throw new Error("useValueStreams must be used within ValueStreamsProvider");
  return ctx;
};

export const useValueStreamDetails = (id: string) => {
  const { valueStreams } = useValueStreams();
  return valueStreams.find((s) => s.id === id) || null;
};