import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAll, getById } from "../db/dbClient";
import { putWithAudit, removeWithAudit } from "../db/dbClient"
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { loadConfig } from "../config/configLoader";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------
export interface Kpi {
  id: string;
  name: string;
  description: string;
  category?: string;   // config-driven
  unit: string;
  calculation_method?: string;
  industry_standard?: string;
  created_at: string;
  updated_at: string;

  // Governance
  owner_user_id?: string | null;
  owner_team_id?: string | null;

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------
interface KpisContextType {
  kpis: Kpi[];
  addKpi: (kpi: Kpi, userId?: string) => Promise<void>;
  updateKpi: (kpi: Kpi, userId?: string) => Promise<void>;
  deleteKpi: (id: string, userId?: string) => Promise<void>;
  refreshKpis: () => Promise<void>;
  getKpi: (id: string) => Promise<Kpi | undefined>;

  // Config-driven enums for UI
  config: {
    categories: string[];
  };
}

const KpisContext = createContext<KpisContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------
export const KpisProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueue } = useSync();
  const [kpis, setKpis] = useState<Kpi[]>([]);

  const config = loadConfig(tenantId).kpis;

  const refreshKpis = async () => {
    const all = await getAll<Kpi>(tenantId, "kpis");
    setKpis(all);
  };

  const getKpi = async (id: string) => {
    return getById<Kpi>(tenantId, "kpis", id);
  };

  const addKpi = async (kpi: Kpi, userId?: string) => {
    // ✅ Tenant-aware validation
    if (kpi.category && !config.categories.includes(kpi.category)) {
      throw new Error(`Invalid KPI category: ${kpi.category}`);
    }

    await putWithAudit(
      tenantId,
      "kpis",
      kpi,
      userId,
      { action: "create", description: `KPI "${kpi.name}" created` },
      enqueue
    );
    await refreshKpis();
  };

  const updateKpi = async (kpi: Kpi, userId?: string) => {
    if (kpi.category && !config.categories.includes(kpi.category)) {
      throw new Error(`Invalid KPI category: ${kpi.category}`);
    }

    await putWithAudit(
      tenantId,
      "kpis",
      kpi,
      userId,
      { action: "update", description: `KPI "${kpi.name}" updated` },
      enqueue
    );
    await refreshKpis();
  };

  const deleteKpi = async (id: string, userId?: string) => {
    await removeWithAudit(
      tenantId,
      "kpis",
      id,
      userId,
      { description: `KPI ${id} deleted` },
      enqueue
    );
    await refreshKpis();
  };

  useEffect(() => {
    refreshKpis();
  }, [tenantId]);

  return (
    <KpisContext.Provider
      value={{ kpis, addKpi, updateKpi, deleteKpi, refreshKpis, getKpi, config }}
    >
      {children}
    </KpisContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------
export const useKpis = () => {
  const ctx = useContext(KpisContext);
  if (!ctx) throw new Error("useKpis must be used within KpisProvider");
  return ctx;
};

export const useKpiDetails = (id: string) => {
  const { kpis } = useKpis();
  return kpis.find((k) => k.id === id) || null;
};