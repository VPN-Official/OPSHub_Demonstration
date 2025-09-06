// src/contexts/BusinessServicesContext.tsx (FRONTEND-FOCUSED REFACTOR)
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { AsyncState, AsyncStateHelpers } from "../types/asyncState";
import { getAll, getById, putWithAudit, removeWithAudit } from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";
import { ExternalSystemFields } from "../types/externalSystem";

// ---------------------------------
// 1. Frontend-Only Type Definitions
// ---------------------------------

// AsyncState interface for UI state management


// UI-focused custom KPI interface
export interface CustomKpi {
  name: string;
  target: number;
  unit: string;
  current?: number;
  description?: string;
  measurement_frequency?: "real_time" | "hourly" | "daily" | "weekly" | "monthly";
}

// UI-focused health check interface
export interface BusinessServiceHealthCheck {
  endpoint?: string;
  method?: "GET" | "POST" | "HEAD";
  expected_status?: number;
  timeout_ms?: number;
  interval_minutes?: number;
  last_check_at?: string;
  last_status?: "healthy" | "degraded" | "unhealthy";
}

// Core business service interface (UI state focused)
export interface BusinessService extends ExternalSystemFields {
  id: string;
  name: string;
  description: string;
  tier?: string;
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

  // KPIs (display data from backend)
  enterprise_kpi_ids: string[];
  custom_kpis: CustomKpi[];

  // SLA & Reliability (display values)
  sla_target_uptime?: number;
  sla_target_response_ms?: number;
  mttr_minutes?: number;
  mtta_minutes?: number;
  rpo_minutes?: number;
  rto_minutes?: number;

  // Health Monitoring (backend-calculated values)
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

  // Business Impact (display values)
  revenue_dependency?: number | null;
  customer_tier_impact?: string;
  criticality_level?: "low" | "medium" | "high" | "critical";
  business_continuity_plan?: boolean;
  disaster_recovery_plan?: boolean;

  // Operational
  maintenance_window?: {
    day_of_week: number;
    start_time: string;
    duration_minutes: number;
    timezone: string;
  };
  change_approval_required?: boolean;
  automated_deployment?: boolean;
  monitoring_enabled?: boolean;

  // UI Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  tenantId?: string;
}

// UI filtering interface
export interface BusinessServiceFilters {
  tier?: string;
  valueStreamId?: string;
  healthStatus?: BusinessService['health_status'][];
  criticalityLevel?: BusinessService['criticality_level'][];
  searchQuery?: string;
  tags?: string[];
  hasRecentIncidents?: boolean;
  hasSLABreach?: boolean;
  requiresMaintenance?: boolean;
}

// UI sorting options
export interface BusinessServiceSortOptions {
  field: 'name' | 'created_at' | 'updated_at' | 'criticality_level' | 'health_status' | 'uptime';
  direction: 'asc' | 'desc';
}

// Backend API response types
export interface BusinessServiceHealthData {
  status: string;
  score: number;
  factors: string[];
}

export interface BusinessServiceAvailabilityTrend {
  date: string;
  uptime: number;
  incidents: number;
}

export interface BusinessServiceReliabilityStats {
  averageUptime: number;
  averageResponseTime: number;
  averageMTTR: number;
  averageMTTA: number;
  servicesWithSLABreach: number;
  totalIncidents30d: number;
  criticalServices: number;
}

// ---------------------------------
// 2. Frontend Context Interface
// ---------------------------------
interface BusinessServicesContextType {
  // Core async state
  businessServices: AsyncState<BusinessService[]>;
  
  // CRUD operations (thin API wrappers)
  addBusinessService: (svc: Omit<BusinessService, 'id' | 'created_at' | 'updated_at'>, userId?: string) => Promise<BusinessService>;
  updateBusinessService: (svc: BusinessService, userId?: string) => Promise<BusinessService>;
  deleteBusinessService: (id: string, userId?: string) => Promise<void>;
  refreshBusinessServices: () => Promise<void>;
  getBusinessService: (id: string) => Promise<BusinessService | undefined>;

  // Optimistic UI operations
  optimisticUpdate: (id: string, changes: Partial<BusinessService>) => void;
  rollbackOptimisticUpdate: (id: string) => void;

  // Client-side filtering & search (for immediate UI responsiveness)
  filteredServices: BusinessService[];
  applyFilters: (filters: BusinessServiceFilters) => void;
  applySorting: (sort: BusinessServiceSortOptions) => void;
  searchServices: (query: string) => void;
  clearFilters: () => void;

  // Current UI state
  currentFilters: BusinessServiceFilters;
  currentSort: BusinessServiceSortOptions;
  
  // Backend API integration (data fetching only)
  fetchServiceHealth: (serviceId: string) => Promise<BusinessServiceHealthData>;
  fetchServiceAvailabilityTrend: (serviceId: string, days?: number) => Promise<BusinessServiceAvailabilityTrend[]>;
  fetchReliabilityStats: () => Promise<BusinessServiceReliabilityStats>;

  // UI configuration from backend
  uiConfig: {
    tiers: string[];
    impactLevels: string[];
    slaTargets: Record<string, number>;
    criticalityLevels: string[];
    dataClassifications: string[];
  };

  // Cache management
  invalidateCache: (serviceId?: string) => void;
  refreshCache: () => Promise<void>;
}

const BusinessServicesContext = createContext<BusinessServicesContextType | undefined>(undefined);

// ---------------------------------
// 3. UI State Management Provider
// ---------------------------------
export const BusinessServicesProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();

  // Core async state
  const [businessServices, setBusinessServices] = useState<AsyncState<BusinessService[]>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: undefined,
    isStale: false,
  });

  // Optimistic updates tracking
  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, Partial<BusinessService>>>({});
  const [originalData, setOriginalData] = useState<Record<string, BusinessService>>({});

  // UI state
  const [currentFilters, setCurrentFilters] = useState<BusinessServiceFilters>({});
  const [currentSort, setCurrentSort] = useState<BusinessServiceSortOptions>({
    field: 'name',
    direction: 'asc',
  });

  // Cache TTL management (5 minutes default)
  const CACHE_TTL = 5 * 60 * 1000;

  // Extract UI configuration from backend config
  const uiConfig = useMemo(() => ({
    tiers: globalConfig?.business?.business_services?.tiers || ['tier1', 'tier2', 'tier3', 'tier4'],
    impactLevels: globalConfig?.business?.business_services?.impact_levels || ['low', 'medium', 'high', 'critical'],
    slaTargets: globalConfig?.slas?.business_services || {},
    criticalityLevels: ['low', 'medium', 'high', 'critical'],
    dataClassifications: ['public', 'internal', 'confidential', 'restricted'],
  }), [globalConfig]);

  // Basic UI validation (no business logic)
  const validateUIFields = useCallback((svc: Partial<BusinessService>) => {
    const errors: string[] = [];
    
    if (svc.name && svc.name.trim().length < 2) {
      errors.push("Service name must be at least 2 characters");
    }
    
    if (svc.description && svc.description.trim().length < 10) {
      errors.push("Description must be at least 10 characters");
    }
    
    if (svc.tier && !uiConfig.tiers.includes(svc.tier)) {
      errors.push(`Invalid tier: ${svc.tier}`);
    }

    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
  }, [uiConfig]);

  // Ensure UI metadata for consistency
  const ensureUIMetadata = useCallback((svc: BusinessService): BusinessService => {
    const now = new Date().toISOString();
    return {
      ...svc,
      tenantId,
      tags: svc.tags || [],
      health_status: svc.health_status || "gray",
      sync_status: svc.sync_status || "syncing",
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

  // Check if cache is stale
  const isCacheStale = useCallback(() => {
    if (!businessServices.lastFetch) return true;
    const lastFetch = new Date(businessServices.lastFetch);
    const now = new Date();
    return (now.getTime() - lastFetch.getTime()) > CACHE_TTL;
  }, [businessServices.lastFetch]);

  // Refresh business services from API/database
  const refreshBusinessServices = useCallback(async () => {
    if (!tenantId) return;
    
    setBusinessServices(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const services = await getAll<BusinessService>(tenantId, "business_services");
      
      // Simple client-side sorting for UI responsiveness
      services.sort((a, b) => {
        const criticalityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aCriticality = criticalityOrder[a.criticality_level as keyof typeof criticalityOrder] || 0;
        const bCriticality = criticalityOrder[b.criticality_level as keyof typeof criticalityOrder] || 0;
        if (aCriticality !== bCriticality) return bCriticality - aCriticality;
        
        const healthOrder = { red: 5, orange: 4, yellow: 3, green: 2, gray: 1 };
        const aHealth = healthOrder[a.health_status] || 0;
        const bHealth = healthOrder[b.health_status] || 0;
        if (aHealth !== bHealth) return bHealth - aHealth;
        
        return a.name.localeCompare(b.name);
      });
      
      setBusinessServices({
        data: services,
        loading: false,
        error: null,
        lastFetch: new Date().toISOString(),
        isStale: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh business services';
      setBusinessServices(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
        isStale: true,
      }));
    }
  }, [tenantId]);

  // Get single business service
  const getBusinessService = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    
    // Check local cache first
    const cached = businessServices.data.find(s => s.id === id);
    if (cached && !isCacheStale()) {
      return cached;
    }
    
    // Fetch from database
    return getById<BusinessService>(tenantId, "business_services", id);
  }, [tenantId, businessServices.data, isCacheStale]);

  // Add business service (optimistic UI)
  const addBusinessService = useCallback(async (
    svc: Omit<BusinessService, 'id' | 'created_at' | 'updated_at'>, 
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateUIFields(svc);

    const now = new Date().toISOString();
    const newService = ensureUIMetadata({
      ...svc,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    } as BusinessService);

    // Optimistic UI update
    setBusinessServices(prev => ({
      ...prev,
      data: [newService, ...prev.data],
    }));

    try {
      // Backend API call - all business logic handled by backend
      await putWithAudit(
        tenantId,
        "business_services",
        newService,
        userId,
        {
          action: "create",
          description: `Created business service: ${svc.name}`,
          tags: ["business_service", "create", svc.tier || "unspecified"],
          metadata: {
            tier: svc.tier,
            value_stream_id: svc.value_stream_id,
            criticality_level: svc.criticality_level,
          },
        }
      );

      // Queue for sync
      const priority = svc.criticality_level === 'critical' ? 'critical' : 
                      svc.criticality_level === 'high' ? 'high' : 'normal';

      await enqueueItem({
        storeName: "business_services",
        entityId: newService.id,
        action: "create",
        payload: newService,
        priority,
      });

      return newService;
    } catch (error) {
      // Rollback optimistic update on error
      setBusinessServices(prev => ({
        ...prev,
        data: prev.data.filter(s => s.id !== newService.id),
        error: error instanceof Error ? error.message : 'Failed to create business service',
      }));
      throw error;
    }
  }, [tenantId, validateUIFields, ensureUIMetadata, enqueueItem]);

  // Update business service (optimistic UI)
  const updateBusinessService = useCallback(async (svc: BusinessService, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateUIFields(svc);

    const updatedService = ensureUIMetadata({
      ...svc,
      updated_at: new Date().toISOString(),
    });

    // Store original for rollback
    const original = businessServices.data.find(s => s.id === svc.id);
    if (original) {
      setOriginalData(prev => ({ ...prev, [svc.id]: original }));
    }

    // Optimistic UI update
    setBusinessServices(prev => ({
      ...prev,
      data: prev.data.map(s => s.id === svc.id ? updatedService : s),
    }));

    try {
      // Backend API call
      await putWithAudit(
        tenantId,
        "business_services",
        updatedService,
        userId,
        {
          action: "update",
          description: `Updated business service: ${svc.name}`,
          tags: ["business_service", "update"],
          metadata: {
            tier: svc.tier,
            criticality_level: svc.criticality_level,
          },
        }
      );

      // Queue for sync
      await enqueueItem({
        storeName: "business_services",
        entityId: updatedService.id,
        action: "update",
        payload: updatedService,
      });

      // Clear rollback data
      setOriginalData(prev => {
        const { [svc.id]: _, ...rest } = prev;
        return rest;
      });

      return updatedService;
    } catch (error) {
      // Rollback optimistic update
      rollbackOptimisticUpdate(svc.id);
      throw error;
    }
  }, [tenantId, validateUIFields, ensureUIMetadata, enqueueItem, businessServices.data]);

  // Delete business service (optimistic UI)
  const deleteBusinessService = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    const service = businessServices.data.find(s => s.id === id);
    if (!service) throw new Error(`Business service ${id} not found`);

    // Store original for rollback
    setOriginalData(prev => ({ ...prev, [id]: service }));

    // Optimistic UI update
    setBusinessServices(prev => ({
      ...prev,
      data: prev.data.filter(s => s.id !== id),
    }));

    try {
      // Backend API call
      await removeWithAudit(
        tenantId,
        "business_services",
        id,
        userId,
        {
          action: "delete",
          description: `Deleted business service: ${service.name}`,
          tags: ["business_service", "delete"],
          metadata: {
            tier: service.tier,
            value_stream_id: service.value_stream_id,
          },
        }
      );

      // Queue for sync
      await enqueueItem({
        storeName: "business_services",
        entityId: id,
        action: "delete",
        payload: null,
      });

      // Clear rollback data
      setOriginalData(prev => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
    } catch (error) {
      // Rollback optimistic update
      setBusinessServices(prev => ({
        ...prev,
        data: [...prev.data, service].sort((a, b) => a.name.localeCompare(b.name)),
        error: error instanceof Error ? error.message : 'Failed to delete business service',
      }));
      throw error;
    }
  }, [tenantId, businessServices.data, enqueueItem]);

  // Optimistic update helpers
  const optimisticUpdate = useCallback((id: string, changes: Partial<BusinessService>) => {
    const original = businessServices.data.find(s => s.id === id);
    if (original) {
      setOriginalData(prev => ({ ...prev, [id]: original }));
      setOptimisticUpdates(prev => ({ ...prev, [id]: { ...prev[id], ...changes } }));
      
      setBusinessServices(prev => ({
        ...prev,
        data: prev.data.map(s => s.id === id ? { ...s, ...changes } : s),
      }));
    }
  }, [businessServices.data]);

  const rollbackOptimisticUpdate = useCallback((id: string) => {
    const original = originalData[id];
    if (original) {
      setBusinessServices(prev => ({
        ...prev,
        data: prev.data.map(s => s.id === id ? original : s),
      }));
      
      setOptimisticUpdates(prev => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
      
      setOriginalData(prev => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
    }
  }, [originalData]);

  // Client-side filtering for immediate UI responsiveness
  const filteredServices = useMemo(() => {
    let filtered = [...businessServices.data];

    // Apply optimistic updates
    filtered = filtered.map(service => ({
      ...service,
      ...optimisticUpdates[service.id],
    }));

    // Apply filters
    if (currentFilters.tier) {
      filtered = filtered.filter(s => s.tier === currentFilters.tier);
    }

    if (currentFilters.valueStreamId) {
      filtered = filtered.filter(s => s.value_stream_id === currentFilters.valueStreamId);
    }

    if (currentFilters.healthStatus?.length) {
      filtered = filtered.filter(s => currentFilters.healthStatus!.includes(s.health_status));
    }

    if (currentFilters.criticalityLevel?.length) {
      filtered = filtered.filter(s => 
        s.criticality_level && currentFilters.criticalityLevel!.includes(s.criticality_level)
      );
    }

    if (currentFilters.searchQuery) {
      const query = currentFilters.searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (currentFilters.tags?.length) {
      filtered = filtered.filter(s =>
        currentFilters.tags!.some(tag => s.tags.includes(tag))
      );
    }

    if (currentFilters.hasRecentIncidents) {
      filtered = filtered.filter(s => s.incident_count_30d && s.incident_count_30d > 0);
    }

    if (currentFilters.hasSLABreach) {
      filtered = filtered.filter(s => 
        s.health_status === 'red' || 
        s.health_status === 'orange' ||
        (s.current_uptime_percentage && s.sla_target_uptime && 
         s.current_uptime_percentage < s.sla_target_uptime)
      );
    }

    if (currentFilters.requiresMaintenance) {
      filtered = filtered.filter(s => 
        s.health_status === 'yellow' || 
        s.health_status === 'orange'
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (currentSort.field) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'created_at':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'updated_at':
          aValue = new Date(a.updated_at).getTime();
          bValue = new Date(b.updated_at).getTime();
          break;
        case 'criticality_level':
          const criticalityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          aValue = criticalityOrder[a.criticality_level as keyof typeof criticalityOrder] || 0;
          bValue = criticalityOrder[b.criticality_level as keyof typeof criticalityOrder] || 0;
          break;
        case 'health_status':
          const healthOrder = { red: 5, orange: 4, yellow: 3, green: 2, gray: 1 };
          aValue = healthOrder[a.health_status] || 0;
          bValue = healthOrder[b.health_status] || 0;
          break;
        case 'uptime':
          aValue = a.current_uptime_percentage || 0;
          bValue = b.current_uptime_percentage || 0;
          break;
        default:
          aValue = a.name;
          bValue = b.name;
      }

      if (aValue < bValue) return currentSort.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return currentSort.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [businessServices.data, optimisticUpdates, currentFilters, currentSort]);

  // UI filter and search actions
  const applyFilters = useCallback((filters: BusinessServiceFilters) => {
    setCurrentFilters(filters);
  }, []);

  const applySorting = useCallback((sort: BusinessServiceSortOptions) => {
    setCurrentSort(sort);
  }, []);

  const searchServices = useCallback((query: string) => {
    setCurrentFilters(prev => ({ ...prev, searchQuery: query }));
  }, []);

  const clearFilters = useCallback(() => {
    setCurrentFilters({});
  }, []);

  // Backend API integration (pure data fetching)
  const fetchServiceHealth = useCallback(async (serviceId: string): Promise<BusinessServiceHealthData> => {
    // This would call a backend API endpoint
    // Backend handles all business logic for health calculation
    const response = await fetch(`/api/business-services/${serviceId}/health`);
    if (!response.ok) throw new Error('Failed to fetch service health');
    return response.json();
  }, []);

  const fetchServiceAvailabilityTrend = useCallback(async (
    serviceId: string, 
    days: number = 30
  ): Promise<BusinessServiceAvailabilityTrend[]> => {
    // Backend API call for availability trend data
    const response = await fetch(`/api/business-services/${serviceId}/availability-trend?days=${days}`);
    if (!response.ok) throw new Error('Failed to fetch availability trend');
    return response.json();
  }, []);

  const fetchReliabilityStats = useCallback(async (): Promise<BusinessServiceReliabilityStats> => {
    // Backend API call for reliability statistics
    const response = await fetch('/api/business-services/reliability-stats');
    if (!response.ok) throw new Error('Failed to fetch reliability stats');
    return response.json();
  }, []);

  // Cache management
  const invalidateCache = useCallback((serviceId?: string) => {
    if (serviceId) {
      // Invalidate specific service (for selective updates)
      setBusinessServices(prev => ({
        ...prev,
        data: prev.data.map(s => s.id === serviceId ? { ...s, sync_status: 'syncing' } : s),
        isStale: true,
      }));
    } else {
      // Invalidate all
      setBusinessServices(prev => ({
        ...prev,
        isStale: true,
        lastFetch: undefined,
      }));
    }
  }, []);

  const refreshCache = useCallback(async () => {
    await refreshBusinessServices();
  }, [refreshBusinessServices]);

  // Initialize and auto-refresh
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshBusinessServices();
    }
  }, [tenantId, globalConfig, refreshBusinessServices]);

  // Auto-refresh stale data
  useEffect(() => {
    if (businessServices.isStale && !businessServices.loading) {
      const timer = setTimeout(() => {
        refreshBusinessServices();
      }, 1000); // Brief delay to avoid rapid refreshes

      return () => clearTimeout(timer);
    }
  }, [businessServices.isStale, businessServices.loading, refreshBusinessServices]);

  // Cleanup optimistic updates on unmount
  useEffect(() => {
    return () => {
      setOptimisticUpdates({});
      setOriginalData({});
    };
  }, []);

  const contextValue = useMemo(() => ({
    businessServices,
    addBusinessService,
    updateBusinessService,
    deleteBusinessService,
    refreshBusinessServices,
    getBusinessService,
    optimisticUpdate,
    rollbackOptimisticUpdate,
    filteredServices,
    applyFilters,
    applySorting,
    searchServices,
    clearFilters,
    currentFilters,
    currentSort,
    fetchServiceHealth,
    fetchServiceAvailabilityTrend,
    fetchReliabilityStats,
    uiConfig,
    invalidateCache,
    refreshCache,
  }), [
    businessServices,
    addBusinessService,
    updateBusinessService,
    deleteBusinessService,
    refreshBusinessServices,
    getBusinessService,
    optimisticUpdate,
    rollbackOptimisticUpdate,
    filteredServices,
    applyFilters,
    applySorting,
    searchServices,
    clearFilters,
    currentFilters,
    currentSort,
    fetchServiceHealth,
    fetchServiceAvailabilityTrend,
    fetchReliabilityStats,
    uiConfig,
    invalidateCache,
    refreshCache,
  ]);

  return (
    <BusinessServicesContext.Provider value={contextValue}>
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

// Selective subscription hooks for performance
export const useBusinessServiceById = (id: string) => {
  const { businessServices, getBusinessService } = useBusinessServices();
  const [service, setService] = useState<BusinessService | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cachedService = businessServices.data.find(s => s.id === id);
    if (cachedService) {
      setService(cachedService);
    } else if (!businessServices.loading) {
      setLoading(true);
      getBusinessService(id)
        .then(setService)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id, businessServices.data, businessServices.loading, getBusinessService]);

  return { service, loading };
};

export const useBusinessServicesByStatus = (status: BusinessService['health_status']) => {
  const { filteredServices } = useBusinessServices();
  return useMemo(() => 
    filteredServices.filter(s => s.health_status === status),
    [filteredServices, status]
  );
};

export const useCriticalBusinessServices = () => {
  const { filteredServices } = useBusinessServices();
  return useMemo(() => 
    filteredServices.filter(s => 
      s.criticality_level === 'critical' || 
      s.health_status === 'red'
    ),
    [filteredServices]
  );
};

// UI state hooks
export const useBusinessServiceFilters = () => {
  const { currentFilters, applyFilters, clearFilters, searchServices } = useBusinessServices();
  return { currentFilters, applyFilters, clearFilters, searchServices };
};

export const useBusinessServiceHealth = (serviceId: string) => {
  const { fetchServiceHealth } = useBusinessServices();
  const [health, setHealth] = useState<BusinessServiceHealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!serviceId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchServiceHealth(serviceId);
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health data');
    } finally {
      setLoading(false);
    }
  }, [serviceId, fetchServiceHealth]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { health, loading, error, refresh };
};

export const useBusinessServiceAvailability = (serviceId: string, days?: number) => {
  const { fetchServiceAvailabilityTrend } = useBusinessServices();
  const [trend, setTrend] = useState<BusinessServiceAvailabilityTrend[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!serviceId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchServiceAvailabilityTrend(serviceId, days);
      setTrend(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch availability data');
    } finally {
      setLoading(false);
    }
  }, [serviceId, days, fetchServiceAvailabilityTrend]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { trend, loading, error, refresh };
};