// src/contexts/BusinessServicesContext.tsx (STANDARDIZED)
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { getAll, getById, putWithAudit, removeWithAudit } from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------
export interface CustomKpi {
  name: string;
  target: number;
  unit: string;
  current?: number;
  description?: string;
  measurement_frequency?: "real_time" | "hourly" | "daily" | "weekly" | "monthly";
}

export interface BusinessServiceHealthCheck {
  endpoint?: string;
  method?: "GET" | "POST" | "HEAD";
  expected_status?: number;
  timeout_ms?: number;
  interval_minutes?: number;
  last_check_at?: string;
  last_status?: "healthy" | "degraded" | "unhealthy";
}

export interface BusinessService {
  id: string;
  name: string;
  description: string;
  tier?: string;  // config-driven
  created_at: string;
  updated_at: string;

  // Ownership
  service_owner_user_id?: string | null;
  service_owner_team_id?: string | null;
  technical_owner_user_id?: string | null;
  business_owner_user_id?: string | null;

  // Parent Value Stream
  value_stream_id: string;

  // Relationships
  service_component_ids: string[];
  customer_ids: string[];
  contract_ids: string[];
  cost_center_ids: string[];
  dependency_service_ids: string[];

  // KPIs
  enterprise_kpi_ids: string[];
  custom_kpis: CustomKpi[];

  // SLA & Reliability
  sla_target_uptime?: number;
  sla_target_response_ms?: number;
  mttr_minutes?: number;
  mtta_minutes?: number;
  rpo_minutes?: number; // Recovery Point Objective
  rto_minutes?: number; // Recovery Time Objective

  // Health Monitoring
  health_check?: BusinessServiceHealthCheck;
  current_uptime_percentage?: number;
  current_response_time_ms?: number;
  last_incident_at?: string;
  incident_count_30d?: number;

  // Risk & Compliance
  risk_score?: number;
  compliance_requirement_ids: string[];
  data_classification?: "public" | "internal" | "confidential" | "restricted";
  privacy_impact_assessment?: boolean;

  // Business Impact
  revenue_dependency?: number | null;
  customer_tier_impact?: string; // config-driven
  criticality_level?: "low" | "medium" | "high" | "critical";
  business_continuity_plan?: boolean;
  disaster_recovery_plan?: boolean;

  // Operational
  maintenance_window?: {
    day_of_week: number; // 0-6 (Sunday = 0)
    start_time: string; // "02:00"
    duration_minutes: number;
    timezone: string;
  };
  change_approval_required?: boolean;
  automated_deployment?: boolean;
  monitoring_enabled?: boolean;

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
interface BusinessServicesContextType {
  businessServices: BusinessService[];
  addBusinessService: (svc: BusinessService, userId?: string) => Promise<void>;
  updateBusinessService: (svc: BusinessService, userId?: string) => Promise<void>;
  deleteBusinessService: (id: string, userId?: string) => Promise<void>;
  refreshBusinessServices: () => Promise<void>;
  getBusinessService: (id: string) => Promise<BusinessService | undefined>;

  // Business service-specific operations
  updateServiceSLA: (serviceId: string, slaData: Partial<BusinessService>, userId?: string) => Promise<void>;
  updateServiceKPIs: (serviceId: string, kpis: CustomKpi[], userId?: string) => Promise<void>;
  addServiceDependency: (serviceId: string, dependencyId: string, userId?: string) => Promise<void>;
  removeServiceDependency: (serviceId: string, dependencyId: string, userId?: string) => Promise<void>;
  updateHealthCheck: (serviceId: string, healthCheck: BusinessServiceHealthCheck, userId?: string) => Promise<void>;
  calculateServiceHealth: (serviceId: string) => Promise<{ status: string; score: number; factors: string[] }>;

  // Filtering and querying
  getServicesByTier: (tier: string) => BusinessService[];
  getServicesByValueStream: (valueStreamId: string) => BusinessService[];
  getCriticalServices: () => BusinessService[];
  getServicesWithSLABreach: () => BusinessService[];
  getServicesWithRecentIncidents: (days?: number) => BusinessService[];
  getServicesRequiringMaintenance: () => BusinessService[];
  getServicesWithExpiredHealthChecks: () => BusinessService[];
  searchServices: (query: string) => BusinessService[];

  // Analytics
  getServiceReliabilityStats: () => {
    averageUptime: number;
    averageResponseTime: number;
    averageMTTR: number;
    averageMTTA: number;
    servicesWithSLABreach: number;
    totalIncidents30d: number;
    criticalServices: number;
  };

  getServiceAvailabilityTrend: (serviceId: string, days?: number) => Promise<Array<{
    date: string;
    uptime: number;
    incidents: number;
  }>>;

  // Config integration
  config: {
    tiers: string[];
    impact_levels: string[];
    sla_targets: Record<string, number>;
    criticality_levels: string[];
    data_classifications: string[];
  };
}

const BusinessServicesContext = createContext<BusinessServicesContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------
export const BusinessServicesProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig, validateEnum, getSLATarget } = useConfig();
  const [businessServices, setBusinessServices] = useState<BusinessService[]>([]);

  // Extract business service-specific config from global config
  const config = {
    tiers: globalConfig?.business?.business_services?.tiers || 
           ['tier1', 'tier2', 'tier3', 'tier4'],
    impact_levels: globalConfig?.business?.business_services?.impact_levels || 
                   ['low', 'medium', 'high', 'critical'],
    sla_targets: globalConfig?.slas?.business_services || {},
    criticality_levels: ['low', 'medium', 'high', 'critical'],
    data_classifications: ['public', 'internal', 'confidential', 'restricted'],
  };

  const validateBusinessService = useCallback((svc: BusinessService) => {
    if (!globalConfig) {
      throw new Error("Configuration not loaded");
    }

    // Validate tier
    if (svc.tier && !config.tiers.includes(svc.tier)) {
      throw new Error(`Invalid business service tier: ${svc.tier}. Valid options: ${config.tiers.join(', ')}`);
    }

    // Validate customer tier impact
    if (svc.customer_tier_impact && !config.impact_levels.includes(svc.customer_tier_impact)) {
      throw new Error(`Invalid customer tier impact: ${svc.customer_tier_impact}. Valid options: ${config.impact_levels.join(', ')}`);
    }

    // Validate criticality level
    if (svc.criticality_level && !config.criticality_levels.includes(svc.criticality_level)) {
      throw new Error(`Invalid criticality level: ${svc.criticality_level}. Valid options: ${config.criticality_levels.join(', ')}`);
    }

    // Validate data classification
    if (svc.data_classification && !config.data_classifications.includes(svc.data_classification)) {
      throw new Error(`Invalid data classification: ${svc.data_classification}. Valid options: ${config.data_classifications.join(', ')}`);
    }

    // Validate required fields
    if (!svc.name || svc.name.trim().length < 2) {
      throw new Error("Business service name must be at least 2 characters long");
    }

    if (!svc.description || svc.description.trim().length < 10) {
      throw new Error("Description must be at least 10 characters long");
    }

    if (!svc.value_stream_id) {
      throw new Error("Value stream ID is required");
    }

    // Validate SLA values
    if (svc.sla_target_uptime !== undefined && (svc.sla_target_uptime < 0 || svc.sla_target_uptime > 100)) {
      throw new Error("SLA target uptime must be between 0 and 100 percent");
    }

    if (svc.sla_target_response_ms !== undefined && svc.sla_target_response_ms < 0) {
      throw new Error("SLA target response time must be a positive number");
    }

    // Validate recovery objectives
    if (svc.rpo_minutes !== undefined && svc.rpo_minutes < 0) {
      throw new Error("RPO must be a positive number");
    }

    if (svc.rto_minutes !== undefined && svc.rto_minutes < 0) {
      throw new Error("RTO must be a positive number");
    }

    // Validate KPIs
    if (svc.custom_kpis) {
      svc.custom_kpis.forEach((kpi, index) => {
        if (!kpi.name || kpi.name.trim().length < 2) {
          throw new Error(`KPI at index ${index} must have a name of at least 2 characters`);
        }
        if (typeof kpi.target !== 'number') {
          throw new Error(`KPI "${kpi.name}" must have a numeric target value`);
        }
      });
    }

    // Validate health check configuration
    if (svc.health_check) {
      if (svc.health_check.endpoint && !svc.health_check.endpoint.startsWith('http')) {
        throw new Error("Health check endpoint must be a valid HTTP(S) URL");
      }
      if (svc.health_check.timeout_ms && svc.health_check.timeout_ms < 100) {
        throw new Error("Health check timeout must be at least 100ms");
      }
    }
  }, [globalConfig, config]);

  const ensureMetadata = useCallback((svc: BusinessService): BusinessService => {
    const now = new Date().toISOString();
    return {
      ...svc,
      tenantId,
      tags: svc.tags || [],
      health_status: svc.health_status || "gray",
      sync_status: svc.sync_status || "dirty",
      synced_at: svc.synced_at || now,
      service_component_ids: svc.service_component_ids || [],
      customer_ids: svc.customer_ids || [],
      contract_ids: svc.contract_ids || [],
      cost_center_ids: svc.cost_center_ids || [],
      dependency_service_ids: svc.dependency_service_ids || [],
      enterprise_kpi_ids: svc.enterprise_kpi_ids || [],
      custom_kpis: svc.custom_kpis || [],
      compliance_requirement_ids: svc.compliance_requirement_ids || [],
      criticality_level: svc.criticality_level || "medium",
    };
  }, [tenantId]);

  const refreshBusinessServices = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      const all = await getAll<BusinessService>(tenantId, "business_services");
      
      // Sort by criticality and health status
      all.sort((a, b) => {
        // Critical services first
        const criticalityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aCriticality = criticalityOrder[a.criticality_level as keyof typeof criticalityOrder] || 0;
        const bCriticality = criticalityOrder[b.criticality_level as keyof typeof criticalityOrder] || 0;
        if (aCriticality !== bCriticality) return bCriticality - aCriticality;
        
        // Health status priority
        const healthOrder = { red: 5, orange: 4, yellow: 3, green: 2, gray: 1 };
        const aHealth = healthOrder[a.health_status] || 0;
        const bHealth = healthOrder[b.health_status] || 0;
        if (aHealth !== bHealth) return bHealth - aHealth;
        
        // Finally by name
        return a.name.localeCompare(b.name);
      });
      
      setBusinessServices(all);
    } catch (error) {
      console.error("Failed to refresh business services:", error);
    }
  }, [tenantId]);

  const getBusinessService = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    return getById<BusinessService>(tenantId, "business_services", id);
  }, [tenantId]);

  const addBusinessService = useCallback(async (svc: BusinessService, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateBusinessService(svc);

    const now = new Date().toISOString();
    const enriched = ensureMetadata({
      ...svc,
      created_at: now,
      updated_at: now,
    });

    const priority = svc.criticality_level === 'critical' ? 'critical' : 
                    svc.criticality_level === 'high' ? 'high' : 'normal';

    await putWithAudit(
      tenantId,
      "business_services",
      enriched,
      userId,
      {
        action: "create",
        description: `Created business service: ${svc.name}`,
        tags: ["business_service", "create", svc.tier || "unspecified", svc.criticality_level || "medium"],
        metadata: {
          tier: svc.tier,
          value_stream_id: svc.value_stream_id,
          criticality_level: svc.criticality_level,
          sla_target_uptime: svc.sla_target_uptime,
          customer_count: svc.customer_ids.length,
        },
      }
    );

    await enqueueItem({
      storeName: "business_services",
      entityId: enriched.id,
      action: "create",
      payload: enriched,
      priority,
    });

    await refreshBusinessServices();
  }, [tenantId, validateBusinessService, ensureMetadata, enqueueItem, refreshBusinessServices]);

  const updateBusinessService = useCallback(async (svc: BusinessService, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateBusinessService(svc);

    const enriched = ensureMetadata({
      ...svc,
      updated_at: new Date().toISOString(),
    });

    await putWithAudit(
      tenantId,
      "business_services",
      enriched,
      userId,
      {
        action: "update",
        description: `Updated business service: ${svc.name}`,
        tags: ["business_service", "update", svc.tier || "unspecified"],
        metadata: {
          tier: svc.tier,
          criticality_level: svc.criticality_level,
          sla_target_uptime: svc.sla_target_uptime,
        },
      }
    );

    await enqueueItem({
      storeName: "business_services",
      entityId: enriched.id,
      action: "update",
      payload: enriched,
    });

    await refreshBusinessServices();
  }, [tenantId, validateBusinessService, ensureMetadata, enqueueItem, refreshBusinessServices]);

  const deleteBusinessService = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    const service = await getBusinessService(id);
    if (!service) throw new Error(`Business service ${id} not found`);

    await removeWithAudit(
      tenantId,
      "business_services",
      id,
      userId,
      {
        action: "delete",
        description: `Deleted business service: ${service.name}`,
        tags: ["business_service", "delete", service.tier || "unspecified"],
        metadata: {
          tier: service.tier,
          value_stream_id: service.value_stream_id,
          criticality_level: service.criticality_level,
        },
      }
    );

    await enqueueItem({
      storeName: "business_services",
      entityId: id,
      action: "delete",
      payload: null,
    });

    await refreshBusinessServices();
  }, [tenantId, getBusinessService, enqueueItem, refreshBusinessServices]);

  // Business service-specific operations
  const updateServiceSLA = useCallback(async (serviceId: string, slaData: Partial<BusinessService>, userId?: string) => {
    const service = await getBusinessService(serviceId);
    if (!service) throw new Error(`Business service ${serviceId} not found`);

    const updated = { ...service, ...slaData };
    await updateBusinessService(updated, userId);
  }, [getBusinessService, updateBusinessService]);

  const updateServiceKPIs = useCallback(async (serviceId: string, kpis: CustomKpi[], userId?: string) => {
    const service = await getBusinessService(serviceId);
    if (!service) throw new Error(`Business service ${serviceId} not found`);

    const updated = { ...service, custom_kpis: kpis };
    await updateBusinessService(updated, userId);
  }, [getBusinessService, updateBusinessService]);

  const addServiceDependency = useCallback(async (serviceId: string, dependencyId: string, userId?: string) => {
    const service = await getBusinessService(serviceId);
    if (!service) throw new Error(`Business service ${serviceId} not found`);

    const updatedDependencies = [...service.dependency_service_ids, dependencyId];
    const updated = { ...service, dependency_service_ids: updatedDependencies };

    await updateBusinessService(updated, userId);
  }, [getBusinessService, updateBusinessService]);

  const removeServiceDependency = useCallback(async (serviceId: string, dependencyId: string, userId?: string) => {
    const service = await getBusinessService(serviceId);
    if (!service) throw new Error(`Business service ${serviceId} not found`);

    const updatedDependencies = service.dependency_service_ids.filter(id => id !== dependencyId);
    const updated = { ...service, dependency_service_ids: updatedDependencies };

    await updateBusinessService(updated, userId);
  }, [getBusinessService, updateBusinessService]);

  const updateHealthCheck = useCallback(async (serviceId: string, healthCheck: BusinessServiceHealthCheck, userId?: string) => {
    const service = await getBusinessService(serviceId);
    if (!service) throw new Error(`Business service ${serviceId} not found`);

    const updated = { ...service, health_check: healthCheck };
    await updateBusinessService(updated, userId);
  }, [getBusinessService, updateBusinessService]);

  const calculateServiceHealth = useCallback(async (serviceId: string) => {
    const service = await getBusinessService(serviceId);
    if (!service) throw new Error(`Business service ${serviceId} not found`);

    // Calculate health score based on various factors
    let score = 100;
    const factors: string[] = [];

    // Uptime factor
    if (service.current_uptime_percentage !== undefined) {
      if (service.current_uptime_percentage < 99) {
        score -= (99 - service.current_uptime_percentage) * 2;
        factors.push(`Low uptime: ${service.current_uptime_percentage}%`);
      }
    }

    // Response time factor
    if (service.current_response_time_ms !== undefined && service.sla_target_response_ms) {
      if (service.current_response_time_ms > service.sla_target_response_ms) {
        const ratio = service.current_response_time_ms / service.sla_target_response_ms;
        score -= Math.min(20, (ratio - 1) * 10);
        factors.push(`Slow response time: ${service.current_response_time_ms}ms`);
      }
    }

    // Recent incidents factor
    if (service.incident_count_30d && service.incident_count_30d > 0) {
      score -= Math.min(15, service.incident_count_30d * 3);
      factors.push(`Recent incidents: ${service.incident_count_30d} in 30 days`);
    }

    // Health check factor
    if (service.health_check?.last_status === 'unhealthy') {
      score -= 25;
      factors.push('Health check failing');
    } else if (service.health_check?.last_status === 'degraded') {
      score -= 10;
      factors.push('Health check degraded');
    }

    // Determine status based on score
    let status: string;
    if (score >= 95) status = 'green';
    else if (score >= 85) status = 'yellow';
    else if (score >= 70) status = 'orange';
    else status = 'red';

    return { status, score: Math.max(0, score), factors };
  }, [getBusinessService]);

  // Filtering functions
  const getServicesByTier = useCallback((tier: string) => {
    return businessServices.filter(s => s.tier === tier);
  }, [businessServices]);

  const getServicesByValueStream = useCallback((valueStreamId: string) => {
    return businessServices.filter(s => s.value_stream_id === valueStreamId);
  }, [businessServices]);

  const getCriticalServices = useCallback(() => {
    return businessServices.filter(s => 
      s.criticality_level === 'critical' || 
      s.health_status === 'red' ||
      (s.sla_target_uptime && s.sla_target_uptime >= 99.9)
    );
  }, [businessServices]);

  const getServicesWithSLABreach = useCallback(() => {
    return businessServices.filter(s => 
      s.health_status === 'red' || 
      s.health_status === 'orange' ||
      (s.current_uptime_percentage && s.sla_target_uptime && s.current_uptime_percentage < s.sla_target_uptime) ||
      (s.current_response_time_ms && s.sla_target_response_ms && s.current_response_time_ms > s.sla_target_response_ms)
    );
  }, [businessServices]);

  const getServicesWithRecentIncidents = useCallback((days: number = 30) => {
    return businessServices.filter(s => {
      if (s.incident_count_30d && s.incident_count_30d > 0) return true;
      if (s.last_incident_at) {
        const incidentDate = new Date(s.last_incident_at);
        const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
        return incidentDate > cutoffDate;
      }
      return false;
    });
  }, [businessServices]);

  const getServicesRequiringMaintenance = useCallback(() => {
    return businessServices.filter(s => 
      s.health_status === 'yellow' || 
      s.health_status === 'orange' ||
      (s.health_check?.last_status === 'degraded')
    );
  }, [businessServices]);

  const getServicesWithExpiredHealthChecks = useCallback(() => {
    const now = new Date();
    return businessServices.filter(s => {
      if (!s.health_check?.last_check_at || !s.health_check?.interval_minutes) return false;
      const lastCheck = new Date(s.health_check.last_check_at);
      const expectedNextCheck = new Date(lastCheck.getTime() + (s.health_check.interval_minutes * 60 * 1000));
      return now > expectedNextCheck;
    });
  }, [businessServices]);

  const searchServices = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return businessServices.filter(s => 
      s.name.toLowerCase().includes(lowerQuery) ||
      s.description.toLowerCase().includes(lowerQuery) ||
      s.tier?.toLowerCase().includes(lowerQuery) ||
      s.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      s.custom_kpis.some(kpi => kpi.name.toLowerCase().includes(lowerQuery))
    );
  }, [businessServices]);

  // Analytics functions
  const getServiceReliabilityStats = useCallback(() => {
    const servicesWithUptime = businessServices.filter(s => s.current_uptime_percentage !== undefined);
    const servicesWithResponseTime = businessServices.filter(s => s.current_response_time_ms !== undefined);
    const servicesWithMTTR = businessServices.filter(s => s.mttr_minutes !== undefined);
    const servicesWithMTTA = businessServices.filter(s => s.mtta_minutes !== undefined);

    const averageUptime = servicesWithUptime.length > 0
      ? servicesWithUptime.reduce((sum, s) => sum + (s.current_uptime_percentage || 0), 0) / servicesWithUptime.length
      : 0;

    const averageResponseTime = servicesWithResponseTime.length > 0
      ? servicesWithResponseTime.reduce((sum, s) => sum + (s.current_response_time_ms || 0), 0) / servicesWithResponseTime.length
      : 0;

    const averageMTTR = servicesWithMTTR.length > 0
      ? servicesWithMTTR.reduce((sum, s) => sum + (s.mttr_minutes || 0), 0) / servicesWithMTTR.length
      : 0;

    const averageMTTA = servicesWithMTTA.length > 0
      ? servicesWithMTTA.reduce((sum, s) => sum + (s.mtta_minutes || 0), 0) / servicesWithMTTA.length
      : 0;

    const servicesWithSLABreach = getServicesWithSLABreach().length;
    const totalIncidents30d = businessServices.reduce((sum, s) => sum + (s.incident_count_30d || 0), 0);
    const criticalServices = getCriticalServices().length;

    return {
      averageUptime,
      averageResponseTime,
      averageMTTR,
      averageMTTA,
      servicesWithSLABreach,
      totalIncidents30d,
      criticalServices,
    };
  }, [businessServices, getServicesWithSLABreach, getCriticalServices]);

  const getServiceAvailabilityTrend = useCallback(async (serviceId: string, days: number = 30) => {
    // This would typically fetch from metrics/monitoring store
    // For now, return mock trend data
    const service = await getBusinessService(serviceId);
    if (!service) throw new Error(`Business service ${serviceId} not found`);

    const trend = [];
    const baseUptime = service.current_uptime_percentage || 99.5;
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Simulate uptime variation
      const variation = (Math.random() - 0.5) * 2; // ±1%
      const uptime = Math.min(100, Math.max(95, baseUptime + variation));
      
      // Simulate incidents (lower probability for higher uptime)
      const incidentProbability = (100 - uptime) / 100;
      const incidents = Math.random() < incidentProbability ? Math.floor(Math.random() * 3) + 1 : 0;
      
      trend.push({
        date: date.toISOString().split('T')[0],
        uptime: Math.round(uptime * 100) / 100,
        incidents,
      });
    }

    return trend;
  }, [getBusinessService]);

  // Initialize when tenant and config are ready
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshBusinessServices();
    }
  }, [tenantId, globalConfig, refreshBusinessServices]);

  return (
    <BusinessServicesContext.Provider
      value={{
        businessServices,
        addBusinessService,
        updateBusinessService,
        deleteBusinessService,
        refreshBusinessServices,
        getBusinessService,
        updateServiceSLA,
        updateServiceKPIs,
        addServiceDependency,
        removeServiceDependency,
        updateHealthCheck,
        calculateServiceHealth,
        getServicesByTier,
        getServicesByValueStream,
        getCriticalServices,
        getServicesWithSLABreach,
        getServicesWithRecentIncidents,
        getServicesRequiringMaintenance,
        getServicesWithExpiredHealthChecks,
        searchServices,
        getServiceReliabilityStats,
        getServiceAvailabilityTrend,
        config,
      }}
    >
      {children}
    </BusinessServicesContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
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

// Utility hooks
export const useCriticalBusinessServices = () => {
  const { getCriticalServices } = useBusinessServices();
  return getCriticalServices();
};

export const useBusinessServicesWithSLABreach = () => {
  const { getServicesWithSLABreach } = useBusinessServices();
  return getServicesWithSLABreach();
};

export const useBusinessServiceReliabilityStats = () => {
  const { getServiceReliabilityStats } = useBusinessServices();
  return getServiceReliabilityStats();
};

export const useBusinessServiceHealth = (serviceId: string) => {
  const { calculateServiceHealth } = useBusinessServices();
  const [health, setHealth] = useState<{ status: string; score: number; factors: string[] } | null>(null);

  useEffect(() => {
    if (serviceId) {
      calculateServiceHealth(serviceId)
        .then(setHealth)
        .catch(console.error);
    }
  }, [serviceId, calculateServiceHealth]);

  return health;
};

export const useBusinessServiceAvailability = (serviceId: string, days?: number) => {
  const { getServiceAvailabilityTrend } = useBusinessServices();
  const [trend, setTrend] = useState<Array<{ date: string; uptime: number; incidents: number }> | null>(null);

  useEffect(() => {
    if (serviceId) {
      getServiceAvailabilityTrend(serviceId, days)
        .then(setTrend)
        .catch(console.error);
    }
  }, [serviceId, days, getServiceAvailabilityTrend]);

  return trend;
};