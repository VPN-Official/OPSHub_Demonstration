import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAll, getById } from "../db/dbClient";
import { putWithAudit, removeWithAudit } from "../db/dbClient"
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { loadConfig } from "../config/configLoader";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  description?: string;
  department?: string;  // must match config.business.cost_centers.departments
  region?: string;      // must match config.business.cost_centers.regions
  created_at: string;
  updated_at: string;

  // Relationships
  business_service_ids: string[];
  asset_ids: string[];
  contract_ids: string[];
  owner_user_id?: string | null;
  owner_team_id?: string | null;

  // Financials
  annual_budget: number;
  currency: string;     // must match config.business.cost_centers.currencies
  spent_ytd?: number;
  forecast_spend?: number;
  variance?: number;

  // Risk & Compliance
  risk_score?: number;
  compliance_requirement_ids: string[];

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
}

// ---------------------------------
// Context Interface
// ---------------------------------

interface CostCentersContextType {
  costCenters: CostCenter[];
  addCostCenter: (cc: CostCenter, userId?: string) => Promise<void>;
  updateCostCenter: (cc: CostCenter, userId?: string) => Promise<void>;
  deleteCostCenter: (id: string, userId?: string) => Promise<void>;
  refreshCostCenters: () => Promise<void>;
  getCostCenter: (id: string) => Promise<CostCenter | undefined>;

  // NEW: expose config
  config: {
    departments: string[];
    regions: string[];
    currencies: string[];
  };
}

const CostCentersContext = createContext<CostCentersContextType | undefined>(undefined);

// ---------------------------------
// Provider
// ---------------------------------

export const CostCentersProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueue } = useSync();
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);

  const config = loadConfig(tenantId).business.cost_centers;

  const refreshCostCenters = async () => {
    const all = await getAll<CostCenter>(tenantId, "cost_centers");
    setCostCenters(all);
  };

  const getCostCenter = async (id: string) => {
    return getById<CostCenter>(tenantId, "cost_centers", id);
  };

  const addCostCenter = async (cc: CostCenter, userId?: string) => {
    // ✅ Validate against config
    if (cc.department && !config.departments.includes(cc.department)) {
      throw new Error(`Invalid department: ${cc.department}`);
    }
    if (cc.region && !config.regions.includes(cc.region)) {
      throw new Error(`Invalid region: ${cc.region}`);
    }
    if (!config.currencies.includes(cc.currency)) {
      throw new Error(`Invalid currency: ${cc.currency}`);
    }

    await putWithAudit(
      tenantId,
      "cost_centers",
      cc,
      userId,
      { action: "create", description: `Cost Center "${cc.name}" created` },
      enqueue
    );
    await refreshCostCenters();
  };

  const updateCostCenter = async (cc: CostCenter, userId?: string) => {
    await putWithAudit(
      tenantId,
      "cost_centers",
      cc,
      userId,
      { action: "update", description: `Cost Center "${cc.name}" updated` },
      enqueue
    );
    await refreshCostCenters();
  };

  const deleteCostCenter = async (id: string, userId?: string) => {
    await removeWithAudit(
      tenantId,
      "cost_centers",
      id,
      userId,
      { description: `Cost Center ${id} deleted` },
      enqueue
    );
    await refreshCostCenters();
  };

  useEffect(() => {
    refreshCostCenters();
  }, [tenantId]);

  return (
    <CostCentersContext.Provider
      value={{
        costCenters,
        addCostCenter,
        updateCostCenter,
        deleteCostCenter,
        refreshCostCenters,
        getCostCenter,
        config,
      }}
    >
      {children}
    </CostCentersContext.Provider>
  );
};

// ---------------------------------
// Hooks
// ---------------------------------

export const useCostCenters = () => {
  const ctx = useContext(CostCentersContext);
  if (!ctx) throw new Error("useCostCenters must be used within CostCentersProvider");
  return ctx;
};

export const useCostCenterDetails = (id: string) => {
  const { costCenters } = useCostCenters();
  return costCenters.find((c) => c.id === id) || null;
};