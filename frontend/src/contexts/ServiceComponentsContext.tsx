import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAll, getById } from "../db/dbClient";
import { putWithAudit, removeWithAudit } from "../db/dbClient"
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { loadConfig } from "../config/configLoader";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------

export interface ServiceComponent {
  id: string;
  name: string;
  description: string;
  type: string;   // config.business.service_components.types
  status: string; // config.business.service_components.statuses
  created_at: string;
  updated_at: string;

  // Parent Business Service
  business_service_id: string;

  // Relationships
  asset_ids: string[];
  vendor_id?: string | null;
  team_id?: string | null;
  dependency_component_ids: string[];

  // SLAs & Metrics
  sla_target_uptime?: number;
  response_time_ms?: number;
  error_rate?: number;

  // Risk & Compliance
  risk_score?: number;
  compliance_requirement_ids: string[];

  // Business Impact
  criticality?: string; // config.business.service_components.criticality_levels

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

interface ServiceComponentsContextType {
  serviceComponents: ServiceComponent[];
  addServiceComponent: (sc: ServiceComponent, userId?: string) => Promise<void>;
  updateServiceComponent: (sc: ServiceComponent, userId?: string) => Promise<void>;
  deleteServiceComponent: (id: string, userId?: string) => Promise<void>;
  refreshServiceComponents: () => Promise<void>;
  getServiceComponent: (id: string) => Promise<ServiceComponent | undefined>;

  // NEW: expose config
  config: {
    types: string[];
    statuses: string[];
    criticality_levels: string[];
  };
}

const ServiceComponentsContext = createContext<ServiceComponentsContextType | undefined>(undefined);

// ---------------------------------
// Provider
// ---------------------------------

export const ServiceComponentsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueue } = useSync();
  const [serviceComponents, setServiceComponents] = useState<ServiceComponent[]>([]);

  const config = loadConfig(tenantId).business.service_components;

  const refreshServiceComponents = async () => {
    const all = await getAll<ServiceComponent>(tenantId, "service_components");
    setServiceComponents(all);
  };

  const getServiceComponent = async (id: string) => {
    return getById<ServiceComponent>(tenantId, "service_components", id);
  };

  const addServiceComponent = async (sc: ServiceComponent, userId?: string) => {
    // ✅ Validate against config
    if (!config.types.includes(sc.type)) {
      throw new Error(`Invalid component type: ${sc.type}`);
    }
    if (!config.statuses.includes(sc.status)) {
      throw new Error(`Invalid component status: ${sc.status}`);
    }
    if (sc.criticality && !config.criticality_levels.includes(sc.criticality)) {
      throw new Error(`Invalid criticality level: ${sc.criticality}`);
    }

    await putWithAudit(
      tenantId,
      "service_components",
      sc,
      userId,
      { action: "create", description: `Service Component "${sc.name}" created` },
      enqueue
    );
    await refreshServiceComponents();
  };

  const updateServiceComponent = async (sc: ServiceComponent, userId?: string) => {
    await putWithAudit(
      tenantId,
      "service_components",
      sc,
      userId,
      { action: "update", description: `Service Component "${sc.name}" updated` },
      enqueue
    );
    await refreshServiceComponents();
  };

  const deleteServiceComponent = async (id: string, userId?: string) => {
    await removeWithAudit(
      tenantId,
      "service_components",
      id,
      userId,
      { description: `Service Component ${id} deleted` },
      enqueue
    );
    await refreshServiceComponents();
  };

  useEffect(() => {
    refreshServiceComponents();
  }, [tenantId]);

  return (
    <ServiceComponentsContext.Provider
      value={{
        serviceComponents,
        addServiceComponent,
        updateServiceComponent,
        deleteServiceComponent,
        refreshServiceComponents,
        getServiceComponent,
        config,
      }}
    >
      {children}
    </ServiceComponentsContext.Provider>
  );
};

// ---------------------------------
// Hooks
// ---------------------------------

export const useServiceComponents = () => {
  const ctx = useContext(ServiceComponentsContext);
  if (!ctx) throw new Error("useServiceComponents must be used within ServiceComponentsProvider");
  return ctx;
};

export const useServiceComponentDetails = (id: string) => {
  const { serviceComponents } = useServiceComponents();
  return serviceComponents.find((c) => c.id === id) || null;
};