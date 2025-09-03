// src/contexts/ServiceComponentsContext.tsx (STANDARDIZED)
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { getAll, getById, putWithAudit, removeWithAudit } from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------
export interface ServiceComponent {
  id: string;
  name: string;
  description: string;
  type: string;   // config-driven
  status: string; // config-driven
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
  criticality?: string; // config-driven

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
  tenantId?: string;
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------
interface ServiceComponentsContextType {
  serviceComponents: ServiceComponent[];
  addServiceComponent: (sc: ServiceComponent, userId?: string) => Promise<void>;
  updateServiceComponent: (sc: ServiceComponent, userId?: string) => Promise<void>;
  deleteServiceComponent: (id: string, userId?: string) => Promise<void>;
  refreshServiceComponents: () => Promise<void>;
  getServiceComponent: (id: string) => Promise<ServiceComponent | undefined>;

  // Service component-specific operations
  updateComponentSLA: (componentId: string, slaData: Partial<ServiceComponent>, userId?: string) => Promise<void>;
  addComponentDependency: (componentId: string, dependencyId: string, userId?: string) => Promise<void>;
  removeComponentDependency: (componentId: string, dependencyId: string, userId?: string) => Promise<void>;
  getComponentsByBusinessService: (businessServiceId: string) => ServiceComponent[];
  getComponentsByType: (type: string) => ServiceComponent[];
  getCriticalComponents: () => ServiceComponent[];
  getComponentsWithSLABreach: () => ServiceComponent[];
  getComponentMetrics: (componentId: string) => Promise<{ uptime: number; responseTime: number; errorRate: number }>;

  // Config integration
  config: {
    types: string[];
    statuses: string[];
    criticality_levels: string[];
  };
}

const ServiceComponentsContext = createContext<ServiceComponentsContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------
export const ServiceComponentsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig, validateEnum } = useConfig();
  const [serviceComponents, setServiceComponents] = useState<ServiceComponent[]>([]);

  // Extract service component-specific config from global config
  const config = {
    types: globalConfig?.business?.service_components?.types || 
           ['application', 'database', 'middleware', 'infrastructure', 'network', 'security', 'monitoring'],
    statuses: globalConfig?.statuses?.service_components || 
              ['operational', 'degraded', 'outage', 'maintenance', 'retired'],
    criticality_levels: globalConfig?.business?.service_components?.criticality_levels || 
                       ['low', 'medium', 'high', 'critical'],
  };

  const validateServiceComponent = useCallback((sc: ServiceComponent) => {
    if (!globalConfig) {
      throw new Error("Configuration not loaded");
    }

    // Validate type against config
    if (!config.types.includes(sc.type)) {
      throw new Error(`Invalid service component type: ${sc.type}. Valid options: ${config.types.join(', ')}`);
    }

    // Validate status using config provider validation
    if (!validateEnum('statuses', sc.status)) {
      throw new Error(`Invalid status: ${sc.status}. Valid options: ${config.statuses.join(', ')}`);
    }

    // Validate criticality level
    if (sc.criticality && !config.criticality_levels.includes(sc.criticality)) {
      throw new Error(`Invalid criticality level: ${sc.criticality}. Valid options: ${config.criticality_levels.join(', ')}`);
    }

    // Validate required fields
    if (!sc.name || sc.name.trim().length < 2) {
      throw new Error("Name must be at least 2 characters long");
    }

    if (!sc.description || sc.description.trim().length < 5) {
      throw new Error("Description must be at least 5 characters long");
    }

    if (!sc.business_service_id) {
      throw new Error("Business service ID is required");
    }

    // Validate SLA values if provided
    if (sc.sla_target_uptime !== undefined && (sc.sla_target_uptime < 0 || sc.sla_target_uptime > 100)) {
      throw new Error("SLA target uptime must be between 0 and 100 percent");
    }

    if (sc.response_time_ms !== undefined && sc.response_time_ms < 0) {
      throw new Error("Response time must be a positive number");
    }

    if (sc.error_rate !== undefined && (sc.error_rate < 0 || sc.error_rate > 100)) {
      throw new Error("Error rate must be between 0 and 100 percent");
    }
  }, [globalConfig, validateEnum, config]);

  const ensureMetadata = useCallback((sc: ServiceComponent): ServiceComponent => {
    const now = new Date().toISOString();
    return {
      ...sc,
      tenantId,
      tags: sc.tags || [],
      health_status: sc.health_status || "gray",
      sync_status: sc.sync_status || "dirty",
      synced_at: sc.synced_at || now,
      asset_ids: sc.asset_ids || [],
      dependency_component_ids: sc.dependency_component_ids || [],
      compliance_requirement_ids: sc.compliance_requirement_ids || [],
    };
  }, [tenantId]);

  const refreshServiceComponents = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      const all = await getAll<ServiceComponent>(tenantId, "service_components");
      
      // Sort by criticality and health status
      all.sort((a, b) => {
        // Critical components first
        const criticalityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aCriticality = criticalityOrder[a.criticality as keyof typeof criticalityOrder] || 0;
        const bCriticality = criticalityOrder[b.criticality as keyof typeof criticalityOrder] || 0;
        if (aCriticality !== bCriticality) return bCriticality - aCriticality;
        
        // Health status priority
        const healthOrder = { red: 5, orange: 4, yellow: 3, green: 2, gray: 1 };
        const aHealth = healthOrder[a.health_status] || 0;
        const bHealth = healthOrder[b.health_status] || 0;
        if (aHealth !== bHealth) return bHealth - aHealth;
        
        // Finally by name
        return a.name.localeCompare(b.name);
      });
      
      setServiceComponents(all);
    } catch (error) {
      console.error("Failed to refresh service components:", error);
    }
  }, [tenantId]);

  const getServiceComponent = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    return getById<ServiceComponent>(tenantId, "service_components", id);
  }, [tenantId]);

  const addServiceComponent = useCallback(async (sc: ServiceComponent, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateServiceComponent(sc);

    const now = new Date().toISOString();
    const enriched = ensureMetadata({
      ...sc,
      created_at: now,
      updated_at: now,
    });

    const priority = sc.criticality === 'critical' ? 'critical' : 
                    sc.criticality === 'high' ? 'high' : 'normal';

    await putWithAudit(
      tenantId,
      "service_components",
      enriched,
      userId,
      {
        action: "create",
        description: `Created service component: ${sc.name}`,
        tags: ["service_component", "create", sc.type, sc.criticality || "medium"],
        metadata: {
          type: sc.type,
          business_service_id: sc.business_service_id,
          criticality: sc.criticality,
          sla_target_uptime: sc.sla_target_uptime,
        },
      }
    );

    await enqueueItem({
      storeName: "service_components",
      entityId: enriched.id,
      action: "create",
      payload: enriched,
      priority,
    });

    await refreshServiceComponents();
  }, [tenantId, validateServiceComponent, ensureMetadata, enqueueItem, refreshServiceComponents]);

  const updateServiceComponent = useCallback(async (sc: ServiceComponent, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateServiceComponent(sc);

    const enriched = ensureMetadata({
      ...sc,
      updated_at: new Date().toISOString(),
    });

    await putWithAudit(
      tenantId,
      "service_components",
      enriched,
      userId,
      {
        action: "update",
        description: `Updated service component: ${sc.name}`,
        tags: ["service_component", "update", sc.type],
        metadata: {
          type: sc.type,
          business_service_id: sc.business_service_id,
          criticality: sc.criticality,
        },
      }
    );

    await enqueueItem({
      storeName: "service_components",
      entityId: enriched.id,
      action: "update",
      payload: enriched,
    });

    await refreshServiceComponents();
  }, [tenantId, validateServiceComponent, ensureMetadata, enqueueItem, refreshServiceComponents]);

  const deleteServiceComponent = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    const component = await getServiceComponent(id);
    if (!component) throw new Error(`Service component ${id} not found`);

    await removeWithAudit(
      tenantId,
      "service_components",
      id,
      userId,
      {
        action: "delete",
        description: `Deleted service component: ${component.name}`,
        tags: ["service_component", "delete", component.type],
        metadata: {
          type: component.type,
          business_service_id: component.business_service_id,
        },
      }
    );

    await enqueueItem({
      storeName: "service_components",
      entityId: id,
      action: "delete",
      payload: null,
    });

    await refreshServiceComponents();
  }, [tenantId, getServiceComponent, enqueueItem, refreshServiceComponents]);

  // Service component-specific operations
  const updateComponentSLA = useCallback(async (componentId: string, slaData: Partial<ServiceComponent>, userId?: string) => {
    const component = await getServiceComponent(componentId);
    if (!component) throw new Error(`Service component ${componentId} not found`);

    const updated = { ...component, ...slaData };
    await updateServiceComponent(updated, userId);
  }, [getServiceComponent, updateServiceComponent]);

  const addComponentDependency = useCallback(async (componentId: string, dependencyId: string, userId?: string) => {
    const component = await getServiceComponent(componentId);
    if (!component) throw new Error(`Service component ${componentId} not found`);

    const updatedDependencies = [...component.dependency_component_ids, dependencyId];
    const updated = { ...component, dependency_component_ids: updatedDependencies };

    await updateServiceComponent(updated, userId);
  }, [getServiceComponent, updateServiceComponent]);

  const removeComponentDependency = useCallback(async (componentId: string, dependencyId: string, userId?: string) => {
    const component = await getServiceComponent(componentId);
    if (!component) throw new Error(`Service component ${componentId} not found`);

    const updatedDependencies = component.dependency_component_ids.filter(id => id !== dependencyId);
    const updated = { ...component, dependency_component_ids: updatedDependencies };

    await updateServiceComponent(updated, userId);
  }, [getServiceComponent, updateServiceComponent]);

  // Filtering functions
  const getComponentsByBusinessService = useCallback((businessServiceId: string) => {
    return serviceComponents.filter(c => c.business_service_id === businessServiceId);
  }, [serviceComponents]);

  const getComponentsByType = useCallback((type: string) => {
    return serviceComponents.filter(c => c.type === type);
  }, [serviceComponents]);

  const getCriticalComponents = useCallback(() => {
    return serviceComponents.filter(c => 
      c.criticality === 'critical' || 
      c.health_status === 'red' ||
      (c.sla_target_uptime && c.sla_target_uptime >= 99.9)
    );
  }, [serviceComponents]);

  const getComponentsWithSLABreach = useCallback(() => {
    return serviceComponents.filter(c => 
      c.health_status === 'red' || 
      c.health_status === 'orange' ||
      (c.error_rate && c.error_rate > 5) ||
      (c.response_time_ms && c.response_time_ms > 5000)
    );
  }, [serviceComponents]);

  const getComponentMetrics = useCallback(async (componentId: string) => {
    // This would typically fetch from metrics store
    // For now, return mock data based on component status
    const component = await getServiceComponent(componentId);
    if (!component) {
      throw new Error(`Service component ${componentId} not found`);
    }

    // Mock metrics based on health status
    const baseMetrics = {
      green: { uptime: 99.95, responseTime: 150, errorRate: 0.1 },
      yellow: { uptime: 99.5, responseTime: 300, errorRate: 1.0 },
      orange: { uptime: 98.0, responseTime: 800, errorRate: 3.0 },
      red: { uptime: 95.0, responseTime: 2000, errorRate: 8.0 },
      gray: { uptime: 0, responseTime: 0, errorRate: 0 },
    };

    return baseMetrics[component.health_status];
  }, [getServiceComponent]);

  // Initialize when tenant and config are ready
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshServiceComponents();
    }
  }, [tenantId, globalConfig, refreshServiceComponents]);

  return (
    <ServiceComponentsContext.Provider
      value={{
        serviceComponents,
        addServiceComponent,
        updateServiceComponent,
        deleteServiceComponent,
        refreshServiceComponents,
        getServiceComponent,
        updateComponentSLA,
        addComponentDependency,
        removeComponentDependency,
        getComponentsByBusinessService,
        getComponentsByType,
        getCriticalComponents,
        getComponentsWithSLABreach,
        getComponentMetrics,
        config,
      }}
    >
      {children}
    </ServiceComponentsContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
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

// Utility hooks
export const useServiceComponentsByBusinessService = (businessServiceId: string) => {
  const { getComponentsByBusinessService } = useServiceComponents();
  return getComponentsByBusinessService(businessServiceId);
};

export const useCriticalServiceComponents = () => {
  const { getCriticalComponents } = useServiceComponents();
  return getCriticalComponents();
};

export const useServiceComponentsWithSLABreach = () => {
  const { getComponentsWithSLABreach } = useServiceComponents();
  return getComponentsWithSLABreach();
};

export const useServiceComponentMetrics = (componentId: string) => {
  const { getComponentMetrics } = useServiceComponents();
  const [metrics, setMetrics] = useState<{ uptime: number; responseTime: number; errorRate: number } | null>(null);

  useEffect(() => {
    if (componentId) {
      getComponentMetrics(componentId)
        .then(setMetrics)
        .catch(console.error);
    }
  }, [componentId, getComponentMetrics]);

  return metrics;
};