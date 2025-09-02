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

export interface BusinessService {
  id: string;
  name: string;
  description: string;
  tier?: string;  // config.business.business_services.tiers
  created_at: string;
  updated_at: string;

  // Ownership
  service_owner_user_id?: string | null;
  service_owner_team_id?: string | null;

  // Parent Value Stream
  value_stream_id: string;

  // Relationships
  service_component_ids: string[];
  customer_ids: string[];
  contract_ids: string[];
  cost_center_ids: string[];

  // KPIs
  enterprise_kpi_ids: string[];
  custom_kpis: CustomKpi[];

  // SLA & Reliability
  sla_target_uptime?: number;
  sla_target_response_ms?: number;
  mttr_minutes?: number;
  mtta_minutes?: number;

  // Risk & Compliance
  risk_score?: number;
  compliance_requirement_ids: string[];

  // Business Impact
  revenue_dependency?: number | null;
  customer_tier_impact?: string; // config.business.business_services.impact_levels

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
}

// ---------------------------------
// Context Interface
// ---------------------------------

interface BusinessServicesContextType {
  businessServices: BusinessService[];
  addBusinessService: (svc: BusinessService, userId?: string) => Promise<void>;
  updateBusinessService: (svc: BusinessService, userId?: string) => Promise<void>;
  deleteBusinessService: (id: string, userId?: string) => Promise<void>;
  refreshBusinessServices: () => Promise<void>;
  getBusinessService: (id: string) => Promise<BusinessService | undefined>;

  // NEW: expose config
  config: {
    tiers: string[];
    impact_levels: string[];
    sla_targets: Record<string, number>;
  };
}

const BusinessServicesContext = createContext<BusinessServicesContextType | undefined>(undefined);

// ---------------------------------
// Provider
// ---------------------------------

export const BusinessServicesProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueue } = useSync();
  const [businessServices, setBusinessServices] = useState<BusinessService[]>([]);

  const config = loadConfig(tenantId).business.business_services;

  const refreshBusinessServices = async () => {
    const all = await getAll<BusinessService>(tenantId, "business_services");
    setBusinessServices(all);
  };

  const getBusinessService = async (id: string) => {
    return getById<BusinessService>(tenantId, "business_services", id);
  };

  const addBusinessService = async (svc: BusinessService, userId?: string) => {
    // ✅ Validate against config
    if (svc.tier && !config.tiers.includes(svc.tier)) {
      throw new Error(`Invalid tier: ${svc.tier}`);
    }
    if (svc.customer_tier_impact && !config.impact_levels.includes(svc.customer_tier_impact)) {
      throw new Error(`Invalid impact level: ${svc.customer_tier_impact}`);
    }

    await putWithAudit(
      tenantId,
      "business_services",
      svc,
      userId,
      { action: "create", description: `Business Service "${svc.name}" created` },
      enqueue
    );
    await refreshBusinessServices();
  };

  const updateBusinessService = async (svc: BusinessService, userId?: string) => {
    await putWithAudit(
      tenantId,
      "business_services",
      svc,
      userId,
      { action: "update", description: `Business Service "${svc.name}" updated` },
      enqueue
    );
    await refreshBusinessServices();
  };

  const deleteBusinessService = async (id: string, userId?: string) => {
    await removeWithAudit(
      tenantId,
      "business_services",
      id,
      userId,
      { description: `Business Service ${id} deleted` },
      enqueue
    );
    await refreshBusinessServices();
  };

  useEffect(() => {
    refreshBusinessServices();
  }, [tenantId]);

  return (
    <BusinessServicesContext.Provider
      value={{
        businessServices,
        addBusinessService,
        updateBusinessService,
        deleteBusinessService,
        refreshBusinessServices,
        getBusinessService,
        config,
      }}
    >
      {children}
    </BusinessServicesContext.Provider>
  );
};

// ---------------------------------
// Hooks
// ---------------------------------

export const useBusinessServices = () => {
  const ctx = useContext(BusinessServicesContext);
  if (!ctx) throw new Error("useBusinessServices must be used within BusinessServicesProvider");
  return ctx;
};

export const useBusinessServiceDetails = (id: string) => {
  const { businessServices } = useBusinessServices();
  return businessServices.find((s) => s.id === id) || null;
};