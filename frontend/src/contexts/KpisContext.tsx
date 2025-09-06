// src/contexts/KpisContext.tsx - REFACTORED FOR FRONTEND-ONLY
import React, { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  ReactNode, 
  useCallback,
  useMemo,
} from "react";
import { AsyncState, AsyncStateHelpers } from "../types/asyncState";
import { 
  getAll, 
  getById, 
  putWithAudit, 
  removeWithAudit 
} from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";
import { ExternalSystemFields } from "../types/externalSystem";

// ---------------------------------
// 1. Frontend State Management Types
// ---------------------------------

/**
 * Generic async state wrapper for UI state management
 */


/**
 * Cache configuration for UI performance
 */
interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxItems: number;
  staleWhileRevalidate: boolean;
}

/**
 * UI filters for client-side responsiveness only
 */
export interface KpiUIFilters {
  category?: string;
  type?: string;
  performance_status?: string;
  owner_type?: 'user' | 'team';
  owner_id?: string;
  business_service_id?: string;
  search_query?: string;
  show_critical_only?: boolean;
  show_outdated?: boolean;
  show_missing_targets?: boolean;
  // External system filtering
  sourceSystems?: string[];
  syncStatus?: ('synced' | 'syncing' | 'error' | 'conflict')[];
  hasConflicts?: boolean;
  hasLocalChanges?: boolean;
  dataCompleteness?: { min: number; max: number };
}

/**
 * Optimistic update state for better UX
 */
interface OptimisticUpdate<T> {
  id: string;
  action: 'create' | 'update' | 'delete';
  entity: T;
  timestamp: string;
}

// ---------------------------------
// 2. Core Entity Types (No Business Logic)
// ---------------------------------

export interface KpiTarget {
  period: "daily" | "weekly" | "monthly" | "quarterly" | "annually";
  target_value: number;
  threshold_warning?: number;
  threshold_critical?: number;
  target_date?: string;
}

export interface KpiDataPoint {
  timestamp: string;
  value: number;
  source?: string;
  notes?: string;
  validated?: boolean;
  validated_by?: string;
  validated_at?: string;
}

export interface KpiFormula {
  numerator?: string;
  denominator?: string;
  calculation_method: "sum" | "average" | "count" | "ratio" | "percentage" | "custom";
  custom_formula?: string;
  data_sources: string[];
}

export interface Kpi extends ExternalSystemFields {
  id: string;
  name: string;
  description: string;
  category: string;
  type: string;
  unit: string;
  created_at: string;
  updated_at: string;

  // Calculation & Formula
  formula: KpiFormula;
  calculation_frequency: "real_time" | "hourly" | "daily" | "weekly" | "monthly";
  automated_collection: boolean;

  // Targets & Current State
  targets: KpiTarget[];
  current_value?: number;
  trend_direction?: "up" | "down" | "stable";
  trend_percentage?: number;

  // Historical Data
  data_points: KpiDataPoint[];
  baseline_value?: number;
  baseline_period?: string;

  // Relationships
  business_service_ids: string[];
  asset_ids: string[];
  related_kpi_ids: string[];
  dependent_on_kpi_ids: string[];

  // Governance & Ownership
  owner_user_id?: string | null;
  owner_team_id?: string | null;
  data_steward_user_id?: string | null;
  
  // Quality & Validation (FROM BACKEND)
  data_quality_score?: number; // 0-100
  last_validated_at?: string;
  validation_required?: boolean;
  data_source_reliability?: "high" | "medium" | "low";

  // Benchmarking (FROM BACKEND)
  industry_standard?: number;
  industry_percentile?: number;
  benchmark_source?: string;
  peer_comparison?: Array<{
    peer_name: string;
    peer_value: number;
    comparison_date: string;
  }>;

  // Reporting & Visibility
  report_frequency: "daily" | "weekly" | "monthly" | "quarterly";
  dashboard_visible: boolean;
  executive_visibility: boolean;
  stakeholder_groups: string[];

  // Performance Status (FROM BACKEND)
  performance_status: "excellent" | "good" | "warning" | "critical" | "unknown";
  last_updated_at?: string;
  update_source?: "manual" | "automated" | "api";

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  // synced_at and sync_status inherited from ExternalSystemFields
  tenantId?: string;
}

export interface KpiDetails extends Kpi {
  related_kpis?: Kpi[];
  dependent_kpis?: Kpi[];
  business_services?: any[];
  recent_data_points?: KpiDataPoint[];
  trend_analysis?: {
    short_term_trend: "improving" | "declining" | "stable";
    long_term_trend: "improving" | "declining" | "stable";
    volatility: "low" | "medium" | "high";
    seasonality_detected: boolean;
  };
}

// ---------------------------------
// 3. Dashboard Data Types (FROM BACKEND)
// ---------------------------------

export interface KpiDashboardData {
  totalKpis: number;
  criticalKpis: number;
  kpisOnTarget: number;
  kpisBelowTarget: number;
  averageDataQuality: number;
  kpisByCategory: Record<string, number>;
  performanceDistribution: Record<string, number>;
}

export interface KpiTrendData {
  date: string;
  improving: number;
  declining: number;
  stable: number;
}

export interface KpiReportData {
  summary: {
    totalKpis: number;
    onTarget: number;
    belowTarget: number;
    dataPoints: number;
  };
  kpiData: Array<{
    kpi: Kpi;
    currentValue: number;
    targetValue?: number;
    performance: string;
    trend: string;
    dataPoints: KpiDataPoint[];
  }>;
}

// ---------------------------------
// 4. Frontend-Only Context Interface
// ---------------------------------
interface KpisContextType {
  // Core async state
  kpis: AsyncState<Kpi[]>;
  dashboardData: AsyncState<KpiDashboardData>;
  trends: AsyncState<KpiTrendData[]>;
  
  // Optimistic updates state
  optimisticUpdates: OptimisticUpdate<Kpi>[];
  
  // UI operations (lightweight, no business logic)
  refreshKpis: () => Promise<void>;
  getKpi: (id: string) => Promise<Kpi | null>;
  
  // API orchestration (backend handles business logic)
  createKpi: (kpi: Omit<Kpi, 'id' | 'created_at' | 'updated_at'>, userId?: string) => Promise<void>;
  updateKpi: (kpi: Kpi, userId?: string) => Promise<void>;
  deleteKpi: (id: string, userId?: string) => Promise<void>;
  
  // Backend API calls (no frontend business logic)
  updateKpiValue: (kpiId: string, value: number, source?: string, notes?: string, userId?: string) => Promise<void>;
  validateKpiData: (kpiId: string, dataPointIds: string[], userId: string) => Promise<void>;
  addKpiTarget: (kpiId: string, target: KpiTarget, userId?: string) => Promise<void>;
  linkKpis: (parentKpiId: string, childKpiId: string, userId?: string) => Promise<void>;
  
  // Client-side helpers for UI responsiveness only
  filterKpis: (filters: KpiUIFilters) => Kpi[];
  searchKpis: (query: string) => Kpi[];
  getKpisByCategory: (category: string) => Kpi[];
  getKpisByOwner: (ownerId: string, ownerType: 'user' | 'team') => Kpi[];
  getCriticalKpis: () => Kpi[];
  
  // Backend-provided analytics (no frontend calculations)
  loadDashboardData: () => Promise<void>;
  loadTrends: (timeframe?: "week" | "month" | "quarter") => Promise<void>;
  generateReport: (kpiIds: string[], dateRange: { start: string; end: string }) => Promise<KpiReportData>;
  
  // Cache management
  invalidateCache: () => void;
  getCacheInfo: () => { size: number; lastCleared: string | null };
  
  // Config from backend
  config: {
    categories: string[];
    types: string[];
    calculation_methods: string[];
    performance_statuses: string[];
    trend_directions: string[];
    data_quality_levels: string[];
  };
}

const KpisContext = createContext<KpisContextType | undefined>(undefined);

// ---------------------------------
// 5. Frontend-Only Provider
// ---------------------------------
export const KpisProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();

  // Cache configuration
  const cacheConfig: CacheConfig = {
    ttl: 5 * 60 * 1000, // 5 minutes
    maxItems: 1000,
    staleWhileRevalidate: true,
  };

  // Core async state
  const [kpis, setKpis] = useState<AsyncState<Kpi[]>>({
    data: null,
    loading: false,
    error: null,
    lastFetch: null,
    stale: true,
  });

  const [dashboardData, setDashboardData] = useState<AsyncState<KpiDashboardData>>({
    data: null,
    loading: false,
    error: null,
    lastFetch: null,
    stale: true,
  });

  const [trends, setTrends] = useState<AsyncState<KpiTrendData[]>>({
    data: null,
    loading: false,
    error: null,
    lastFetch: null,
    stale: true,
  });

  // Optimistic updates for better UX
  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticUpdate<Kpi>[]>([]);
  
  // Cache metadata
  const [cacheInfo, setCacheInfo] = useState({ size: 0, lastCleared: null as string | null });

  // Extract KPI-specific config from backend
  const config = useMemo(() => ({
    categories: globalConfig?.kpis?.categories || 
                ['performance', 'quality', 'efficiency', 'customer', 'financial', 'operational'],
    types: globalConfig?.kpis?.types || 
           ['leading', 'lagging', 'diagnostic', 'predictive'],
    calculation_methods: ['sum', 'average', 'count', 'ratio', 'percentage', 'custom'],
    performance_statuses: ['excellent', 'good', 'warning', 'critical', 'unknown'],
    trend_directions: ['up', 'down', 'stable'],
    data_quality_levels: ['high', 'medium', 'low'],
  }), [globalConfig]);

  // ---------------------------------
  // Helper Functions
  // ---------------------------------
  
  const isStale = useCallback((lastFetch: string | null): boolean => {
    if (!lastFetch) return true;
    return Date.now() - new Date(lastFetch).getTime() > cacheConfig.ttl;
  }, [cacheConfig.ttl]);

  const ensureUIMetadata = useCallback((kpi: Partial<Kpi>): Kpi => {
    const now = new Date().toISOString();
    return {
      tags: [],
      health_status: "gray",
      sync_status: "syncing",
      synced_at: now,
      business_service_ids: [],
      asset_ids: [],
      related_kpi_ids: [],
      dependent_on_kpi_ids: [],
      targets: [],
      data_points: [],
      stakeholder_groups: [],
      peer_comparison: [],
      automated_collection: false,
      dashboard_visible: true,
      executive_visibility: false,
      validation_required: false,
      report_frequency: "monthly",
      calculation_frequency: "daily",
      performance_status: "unknown",
      tenantId,
      ...kpi,
    } as Kpi;
  }, [tenantId]);

  const addOptimisticUpdate = useCallback(<T,>(action: OptimisticUpdate<T>['action'], entity: T) => {
    const update: OptimisticUpdate<T> = {
      id: (entity as any).id,
      action,
      entity,
      timestamp: new Date().toISOString(),
    };
    setOptimisticUpdates(prev => [...prev, update as OptimisticUpdate<Kpi>]);
  }, []);

  const removeOptimisticUpdate = useCallback((id: string) => {
    setOptimisticUpdates(prev => prev.filter(update => update.id !== id));
  }, []);

  const rollbackOptimisticUpdate = useCallback((id: string) => {
    removeOptimisticUpdate(id);
    // Force refresh to get accurate state
    refreshKpis();
  }, []);

  // ---------------------------------
  // Core Data Operations
  // ---------------------------------

  const refreshKpis = useCallback(async (): Promise<void> => {
    if (!tenantId) return;

    // Check if we have fresh data and it's not stale
    if (kpis.data && !isStale(kpis.lastFetch) && !kpis.stale) {
      return;
    }

    setKpis(prev => ({ ...prev, loading: true, error: null }));

    try {
      const fetchedKpis = await getAll<Kpi>(tenantId, "kpis");
      
      // Basic client-side sorting for UI performance only
      fetchedKpis.sort((a, b) => {
        // Critical first (UI display priority only)
        if (a.performance_status === 'critical' && b.performance_status !== 'critical') return -1;
        if (b.performance_status === 'critical' && a.performance_status !== 'critical') return 1;
        
        // Then by name
        return a.name.localeCompare(b.name);
      });

      const now = new Date().toISOString();
      setKpis({
        data: fetchedKpis,
        loading: false,
        error: null,
        lastFetch: now,
        stale: false,
      });

      setCacheInfo(prev => ({ ...prev, size: fetchedKpis.length }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch KPIs";
      setKpis(prev => ({ 
        ...prev, 
        loading: false, 
        error: errorMessage,
        stale: true,
      }));
    }
  }, [tenantId, kpis.data, kpis.lastFetch, kpis.stale, isStale]);

  const getKpi = useCallback(async (id: string): Promise<Kpi | null> => {
    if (!tenantId) return null;
    
    // Check local cache first for UI responsiveness
    if (kpis.data) {
      const cached = kpis.data.find(k => k.id === id);
      if (cached && !isStale(kpis.lastFetch)) {
        return cached;
      }
    }
    
    try {
      const kpi = await getById<Kpi>(tenantId, "kpis", id);
      return kpi || null;
    } catch (error) {
      console.error(`Failed to fetch KPI ${id}:`, error);
      return null;
    }
  }, [tenantId, kpis.data, kpis.lastFetch, isStale]);

  // ---------------------------------
  // API Orchestration (No Business Logic)
  // ---------------------------------

  const createKpi = useCallback(async (kpiData: Omit<Kpi, 'id' | 'created_at' | 'updated_at'>, userId?: string): Promise<void> => {
    if (!tenantId) throw new Error("No tenant selected");

    const now = new Date().toISOString();
    const kpi = ensureUIMetadata({
      ...kpiData,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    });

    // Optimistic UI update
    addOptimisticUpdate('create', kpi);

    try {
      // Backend handles ALL validation and business logic
      await putWithAudit(
        tenantId,
        "kpis",
        kpi,
        userId,
        {
          action: "create",
          description: `Created KPI: ${kpi.name}`,
          tags: ["kpi", "create", kpi.category, kpi.type],
          metadata: {
            category: kpi.category,
            type: kpi.type,
            unit: kpi.unit,
            calculation_method: kpi.formula.calculation_method,
          },
        }
      );

      await enqueueItem({
        storeName: "kpis",
        entityId: kpi.id,
        action: "create",
        payload: kpi,
        priority: 'normal',
      });

      // Remove optimistic update and refresh
      removeOptimisticUpdate(kpi.id);
      await refreshKpis();
    } catch (error) {
      // Rollback optimistic update on failure
      rollbackOptimisticUpdate(kpi.id);
      throw error;
    }
  }, [tenantId, ensureUIMetadata, addOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate, enqueueItem, refreshKpis]);

  const updateKpi = useCallback(async (kpi: Kpi, userId?: string): Promise<void> => {
    if (!tenantId) throw new Error("No tenant selected");

    const updated = {
      ...kpi,
      updated_at: new Date().toISOString(),
    };

    // Optimistic UI update
    addOptimisticUpdate('update', updated);

    try {
      // Backend handles ALL validation and business logic
      await putWithAudit(
        tenantId,
        "kpis",
        updated,
        userId,
        {
          action: "update",
          description: `Updated KPI: ${kpi.name}`,
          tags: ["kpi", "update", kpi.performance_status],
          metadata: {
            performance_status: kpi.performance_status,
            current_value: kpi.current_value,
          },
        }
      );

      await enqueueItem({
        storeName: "kpis",
        entityId: updated.id,
        action: "update",
        payload: updated,
      });

      // Remove optimistic update and refresh
      removeOptimisticUpdate(updated.id);
      await refreshKpis();
    } catch (error) {
      // Rollback optimistic update on failure
      rollbackOptimisticUpdate(updated.id);
      throw error;
    }
  }, [tenantId, addOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate, enqueueItem, refreshKpis]);

  const deleteKpi = useCallback(async (id: string, userId?: string): Promise<void> => {
    if (!tenantId) throw new Error("No tenant selected");

    const kpi = await getKpi(id);
    if (!kpi) throw new Error(`KPI ${id} not found`);

    // Optimistic UI update (remove from list)
    addOptimisticUpdate('delete', kpi);

    try {
      await removeWithAudit(
        tenantId,
        "kpis",
        id,
        userId,
        {
          action: "delete",
          description: `Deleted KPI: ${kpi.name}`,
          tags: ["kpi", "delete"],
          metadata: {
            category: kpi.category,
            type: kpi.type,
          },
        }
      );

      await enqueueItem({
        storeName: "kpis",
        entityId: id,
        action: "delete",
        payload: null,
      });

      // Remove optimistic update and refresh
      removeOptimisticUpdate(id);
      await refreshKpis();
    } catch (error) {
      // Rollback optimistic update on failure
      rollbackOptimisticUpdate(id);
      throw error;
    }
  }, [tenantId, getKpi, addOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate, enqueueItem, refreshKpis]);

  // ---------------------------------
  // Backend API Calls (No Business Logic)
  // ---------------------------------

  const updateKpiValue = useCallback(async (kpiId: string, value: number, source?: string, notes?: string, userId?: string): Promise<void> => {
    // Backend API handles all calculation, validation, and trend analysis
    try {
      const response = await fetch(`/api/kpis/${kpiId}/update-value`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, source, notes, userId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update KPI value: ${response.statusText}`);
      }

      // Refresh UI to show updated data from backend
      await refreshKpis();
    } catch (error) {
      console.error(`Failed to update KPI ${kpiId} value:`, error);
      throw error;
    }
  }, [refreshKpis]);

  const validateKpiData = useCallback(async (kpiId: string, dataPointIds: string[], userId: string): Promise<void> => {
    // Backend handles all validation logic
    try {
      const response = await fetch(`/api/kpis/${kpiId}/validate-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataPointIds, userId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to validate KPI data: ${response.statusText}`);
      }

      await refreshKpis();
    } catch (error) {
      console.error(`Failed to validate KPI ${kpiId} data:`, error);
      throw error;
    }
  }, [refreshKpis]);

  const addKpiTarget = useCallback(async (kpiId: string, target: KpiTarget, userId?: string): Promise<void> => {
    // Backend handles target validation and business rules
    try {
      const response = await fetch(`/api/kpis/${kpiId}/targets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, userId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to add KPI target: ${response.statusText}`);
      }

      await refreshKpis();
    } catch (error) {
      console.error(`Failed to add target to KPI ${kpiId}:`, error);
      throw error;
    }
  }, [refreshKpis]);

  const linkKpis = useCallback(async (parentKpiId: string, childKpiId: string, userId?: string): Promise<void> => {
    // Backend handles relationship validation and business rules
    try {
      const response = await fetch(`/api/kpis/${parentKpiId}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childKpiId, userId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to link KPIs: ${response.statusText}`);
      }

      await refreshKpis();
    } catch (error) {
      console.error(`Failed to link KPIs ${parentKpiId} -> ${childKpiId}:`, error);
      throw error;
    }
  }, [refreshKpis]);

  // ---------------------------------
  // Client-Side Helpers (UI Only)
  // ---------------------------------

  const getAvailableKpis = useCallback((): Kpi[] => {
    const baseKpis = kpis.data || [];
    
    // Apply optimistic updates for immediate UI feedback
    const optimizedKpis = [...baseKpis];
    
    optimisticUpdates.forEach(update => {
      const index = optimizedKpis.findIndex(k => k.id === update.id);
      
      switch (update.action) {
        case 'create':
          if (index === -1) {
            optimizedKpis.push(update.entity);
          }
          break;
        case 'update':
          if (index !== -1) {
            optimizedKpis[index] = update.entity;
          }
          break;
        case 'delete':
          if (index !== -1) {
            optimizedKpis.splice(index, 1);
          }
          break;
      }
    });
    
    return optimizedKpis;
  }, [kpis.data, optimisticUpdates]);

  const filterKpis = useCallback((filters: KpiUIFilters): Kpi[] => {
    const availableKpis = getAvailableKpis();
    
    return availableKpis.filter(kpi => {
      if (filters.category && kpi.category !== filters.category) return false;
      if (filters.type && kpi.type !== filters.type) return false;
      if (filters.performance_status && kpi.performance_status !== filters.performance_status) return false;
      if (filters.business_service_id && !kpi.business_service_ids.includes(filters.business_service_id)) return false;
      if (filters.show_critical_only && kpi.performance_status !== 'critical') return false;
      if (filters.show_outdated && kpi.last_updated_at) {
        const daysOld = (Date.now() - new Date(kpi.last_updated_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysOld < 7) return false; // Not outdated
      }
      if (filters.show_missing_targets && kpi.targets.length > 0) return false;
      
      if (filters.owner_type && filters.owner_id) {
        if (filters.owner_type === 'user' && kpi.owner_user_id !== filters.owner_id) return false;
        if (filters.owner_type === 'team' && kpi.owner_team_id !== filters.owner_id) return false;
      }
      
      return true;
    });
  }, [getAvailableKpis]);

  const searchKpis = useCallback((query: string): Kpi[] => {
    if (!query.trim()) return getAvailableKpis();
    
    const lowerQuery = query.toLowerCase();
    return getAvailableKpis().filter(kpi => 
      kpi.name.toLowerCase().includes(lowerQuery) ||
      kpi.description.toLowerCase().includes(lowerQuery) ||
      kpi.category.toLowerCase().includes(lowerQuery) ||
      kpi.type.toLowerCase().includes(lowerQuery) ||
      kpi.unit.toLowerCase().includes(lowerQuery) ||
      kpi.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }, [getAvailableKpis]);

  const getKpisByCategory = useCallback((category: string): Kpi[] => {
    return getAvailableKpis().filter(k => k.category === category);
  }, [getAvailableKpis]);

  const getKpisByOwner = useCallback((ownerId: string, ownerType: 'user' | 'team'): Kpi[] => {
    return getAvailableKpis().filter(k => {
      if (ownerType === 'user') return k.owner_user_id === ownerId;
      return k.owner_team_id === ownerId;
    });
  }, [getAvailableKpis]);

  const getCriticalKpis = useCallback((): Kpi[] => {
    return getAvailableKpis().filter(k => k.performance_status === 'critical');
  }, [getAvailableKpis]);

  // ---------------------------------
  // Backend Analytics (No Frontend Calculations)
  // ---------------------------------

  const loadDashboardData = useCallback(async (): Promise<void> => {
    if (!tenantId) return;
    
    if (dashboardData.data && !isStale(dashboardData.lastFetch) && !dashboardData.stale) {
      return;
    }

    setDashboardData(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Backend calculates all dashboard metrics
      const response = await fetch(`/api/kpis/dashboard?tenant=${tenantId}`);
      if (!response.ok) {
        throw new Error(`Dashboard data fetch failed: ${response.statusText}`);
      }

      const data = await response.json();
      const now = new Date().toISOString();
      
      setDashboardData({
        data,
        loading: false,
        error: null,
        lastFetch: now,
        stale: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load dashboard data";
      setDashboardData(prev => ({ 
        ...prev, 
        loading: false, 
        error: errorMessage,
        stale: true,
      }));
    }
  }, [tenantId, dashboardData.data, dashboardData.lastFetch, dashboardData.stale, isStale]);

  const loadTrends = useCallback(async (timeframe: "week" | "month" | "quarter" = "month"): Promise<void> => {
    if (!tenantId) return;
    
    setTrends(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Backend calculates all trend analytics
      const response = await fetch(`/api/kpis/trends?tenant=${tenantId}&timeframe=${timeframe}`);
      if (!response.ok) {
        throw new Error(`Trends data fetch failed: ${response.statusText}`);
      }

      const data = await response.json();
      const now = new Date().toISOString();
      
      setTrends({
        data,
        loading: false,
        error: null,
        lastFetch: now,
        stale: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load trends";
      setTrends(prev => ({ 
        ...prev, 
        loading: false, 
        error: errorMessage,
        stale: true,
      }));
    }
  }, [tenantId]);

  const generateReport = useCallback(async (kpiIds: string[], dateRange: { start: string; end: string }): Promise<KpiReportData> => {
    if (!tenantId) throw new Error("No tenant selected");

    // Backend handles all report generation and calculations
    const response = await fetch(`/api/kpis/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant: tenantId,
        kpiIds,
        dateRange,
      }),
    });

    if (!response.ok) {
      throw new Error(`Report generation failed: ${response.statusText}`);
    }

    return response.json();
  }, [tenantId]);

  // ---------------------------------
  // Cache Management
  // ---------------------------------

  const invalidateCache = useCallback(() => {
    setKpis(prev => ({ ...prev, stale: true }));
    setDashboardData(prev => ({ ...prev, stale: true }));
    setTrends(prev => ({ ...prev, stale: true }));
    setCacheInfo({ size: 0, lastCleared: new Date().toISOString() });
  }, []);

  const getCacheInfo = useCallback(() => cacheInfo, [cacheInfo]);

  // ---------------------------------
  // Initialization & Cleanup
  // ---------------------------------

  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshKpis();
    } else {
      // Clear state when no tenant
      setKpis({
        data: null,
        loading: false,
        error: null,
        lastFetch: null,
        stale: true,
      });
    }
  }, [tenantId, globalConfig, refreshKpis]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setOptimisticUpdates([]);
      invalidateCache();
    };
  }, []);

  return (
    <KpisContext.Provider
      value={{
        kpis,
        dashboardData,
        trends,
        optimisticUpdates,
        refreshKpis,
        getKpi,
        createKpi,
        updateKpi,
        deleteKpi,
        updateKpiValue,
        validateKpiData,
        addKpiTarget,
        linkKpis,
        filterKpis,
        searchKpis,
        getKpisByCategory,
        getKpisByOwner,
        getCriticalKpis,
        loadDashboardData,
        loadTrends,
        generateReport,
        invalidateCache,
        getCacheInfo,
        config,
      }}
    >
      {children}
    </KpisContext.Provider>
  );
};

// ---------------------------------
// 6. Optimized Hooks
// ---------------------------------

export const useKpis = () => {
  const ctx = useContext(KpisContext);
  if (!ctx) throw new Error("useKpis must be used within KpisProvider");
  return ctx;
};

/**
 * Hook for KPI details with selective subscription
 */
export const useKpiDetails = (id: string) => {
  const { kpis, getKpi } = useKpis();
  const [kpiDetails, setKpiDetails] = useState<Kpi | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;

    const loadKpi = async () => {
      setLoading(true);
      try {
        const kpi = await getKpi(id);
        setKpiDetails(kpi);
      } finally {
        setLoading(false);
      }
    };

    // Check cache first
    const cached = kpis.data?.find(k => k.id === id);
    if (cached) {
      setKpiDetails(cached);
    } else {
      loadKpi();
    }
  }, [id, getKpi, kpis.data]);

  return { data: kpiDetails, loading };
};

/**
 * Hook for critical KPIs with memoization
 */
export const useCriticalKpis = () => {
  const { getCriticalKpis } = useKpis();
  return useMemo(() => getCriticalKpis(), [getCriticalKpis]);
};

/**
 * Hook for KPIs by category with memoization
 */
export const useKpisByCategory = (category: string) => {
  const { getKpisByCategory } = useKpis();
  return useMemo(() => getKpisByCategory(category), [getKpisByCategory, category]);
};

/**
 * Hook for dashboard data with auto-loading
 */
export const useKpiDashboard = () => {
  const { dashboardData, loadDashboardData } = useKpis();
  
  useEffect(() => {
    if (!dashboardData.data || dashboardData.stale) {
      loadDashboardData();
    }
  }, [dashboardData.data, dashboardData.stale, loadDashboardData]);

  return dashboardData;
};

/**
 * Hook for trends with auto-loading
 */
export const useKpiTrends = (timeframe?: "week" | "month" | "quarter") => {
  const { trends, loadTrends } = useKpis();
  
  useEffect(() => {
    if (!trends.data || trends.stale) {
      loadTrends(timeframe);
    }
  }, [trends.data, trends.stale, loadTrends, timeframe]);

  return trends;
};