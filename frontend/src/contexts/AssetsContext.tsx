// src/contexts/AssetsContext.tsx - Enterprise Frontend Architecture
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import { 
  getAll,
  getById,
  putWithAudit,
  removeWithAudit,
} from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";

// ---------------------------------
// 1. Frontend State Types
// ---------------------------------

/**
 * Async state pattern for all data operations
 */
export interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  lastFetch: string | null;
  stale: boolean;
}

/**
 * Asset entity - matches backend contract
 */
export interface Asset {
  id: string;
  name: string;
  description: string;
  type: string;   
  status: string; 
  created_at: string;
  updated_at: string;

  // Relationships
  service_component_id?: string | null;
  business_service_id?: string | null;
  vendor_id?: string | null;
  contract_id?: string | null;
  cost_center_id?: string | null;
  owner_user_id?: string | null;
  owner_team_id?: string | null;
  parent_asset_id?: string | null;
  child_asset_ids: string[];

  // Dependencies and relationships
  dependencies: AssetDependency[];
  supports_business_service_ids: string[];

  // Lifecycle management
  purchase_date?: string | null;
  warranty_expiry?: string | null;
  expected_eol?: string | null;
  decommission_date?: string | null;
  maintenance_schedules: MaintenanceSchedule[];

  // Technical specifications
  hostname?: string;
  ip_address?: string;
  mac_address?: string;
  location?: string;
  serial_number?: string;
  asset_tag?: string;
  model_number?: string;
  manufacturer?: string;
  
  // Cloud and virtualization
  cloud_provider?: string;
  cloud_region?: string;
  instance_type?: string;
  virtual_machine_host?: string;
  configuration?: Record<string, any>;

  // Financial information (provided by backend)
  purchase_cost?: number;
  annual_cost?: number;
  depreciation_rate?: number;
  current_value?: number;
  currency?: string;

  // Performance and monitoring (calculated by backend)
  metrics: AssetMetrics;
  monitoring_enabled: boolean;
  backup_enabled: boolean;
  security_patching_enabled: boolean;

  // Risk and compliance (calculated by backend)
  risk_score?: number;
  compliance_requirement_ids: string[];
  security_classification?: "public" | "internal" | "confidential" | "restricted";
  data_classification?: string;

  // Incident and change tracking
  related_incident_ids: string[];
  related_change_ids: string[];
  related_maintenance_ids: string[];
  last_incident_date?: string | null;
  incident_count_ytd?: number;

  // UI Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
  tenantId?: string;
}

export interface MaintenanceSchedule {
  id: string;
  description: string;
  frequency: string;
  next_due_date: string;
  last_performed_at?: string | null;
  assigned_to_user_id?: string | null;
  estimated_duration_minutes?: number;
  required_skills?: string[];
  required_parts?: { name: string; quantity: number; cost?: number }[];
}

export interface AssetDependency {
  asset_id: string;
  dependency_type: "requires" | "provides" | "connects_to";
  criticality: "low" | "medium" | "high" | "critical";
  description?: string;
}

export interface AssetMetrics {
  uptime_percentage?: number;
  availability_percentage?: number;
  performance_score?: number;
  last_health_check?: string;
  mtbf_hours?: number;
  mttr_minutes?: number;
  utilization_percentage?: number;
  error_rate?: number;
}

/**
 * UI-specific filter and search types
 */
export interface AssetFilters {
  type?: string[];
  status?: string[];
  location?: string[];
  vendor_id?: string[];
  business_service_id?: string[];
  health_status?: string[];
  search_query?: string;
}

export interface AssetSortOptions {
  field: keyof Asset;
  direction: 'asc' | 'desc';
}

/**
 * Optimistic update operations
 */
export interface OptimisticUpdate {
  id: string;
  type: 'create' | 'update' | 'delete';
  timestamp: string;
  originalData?: Asset;
  newData?: Partial<Asset>;
}

// ---------------------------------
// 2. Frontend Context Interface
// ---------------------------------
interface AssetsContextType {
  // Core async state
  assets: AsyncState<Asset[]>;
  
  // CRUD Operations (UI orchestration only)
  createAsset: (asset: Omit<Asset, 'id' | 'created_at' | 'updated_at'>, userId?: string) => Promise<void>;
  updateAsset: (id: string, updates: Partial<Asset>, userId?: string) => Promise<void>;
  deleteAsset: (id: string, userId?: string) => Promise<void>;
  refreshAssets: () => Promise<void>;
  getAsset: (id: string) => Promise<Asset | undefined>;

  // UI-specific operations (client-side only)
  getFilteredAssets: (filters: AssetFilters) => Asset[];
  getSortedAssets: (sortOptions: AssetSortOptions) => Asset[];
  searchAssets: (query: string) => Asset[];
  
  // Simple client-side helpers for immediate UI responsiveness
  getAssetsByType: (type: string) => Asset[];
  getAssetsByStatus: (status: string) => Asset[];
  getAssetsByLocation: (location: string) => Asset[];
  getAssetsByVendor: (vendorId: string) => Asset[];
  getAssetsByBusinessService: (serviceId: string) => Asset[];
  
  // Backend-calculated data (no client logic)
  getCriticalAssets: () => Asset[];
  getAssetsNeedingMaintenance: () => Asset[];
  getAssetsNearEOL: (months?: number) => Asset[];
  getHighRiskAssets: () => Asset[];

  // UI state management
  clearError: () => void;
  invalidateCache: () => void;
  
  // Optimistic updates
  optimisticUpdates: OptimisticUpdate[];
  rollbackOptimisticUpdate: (updateId: string) => void;

  // Configuration from backend
  config: {
    types: string[];
    statuses: string[];
    locations: string[];
    cloudProviders: string[];
    maintenanceFrequencies: string[];
    securityClassifications: string[];
  };
}

const AssetsContext = createContext<AssetsContextType | undefined>(undefined);

// ---------------------------------
// 3. Frontend Provider Implementation
// ---------------------------------
export const AssetsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig, validateEnum } = useConfig();
  
  // Core async state
  const [assets, setAssets] = useState<AsyncState<Asset[]>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    stale: false,
  });

  // Optimistic updates state
  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticUpdate[]>([]);

  // Cache TTL configuration (5 minutes)
  const CACHE_TTL_MS = 5 * 60 * 1000;

  // UI configuration from backend
  const config = useMemo(() => ({
    types: ['server', 'network_device', 'storage', 'database', 'application', 'workstation', 'mobile_device', 'iot_device'],
    statuses: globalConfig?.statuses?.assets || [],
    locations: ['datacenter_1', 'datacenter_2', 'office_hq', 'office_branch', 'cloud', 'remote'],
    cloudProviders: ['aws', 'azure', 'gcp', 'oracle', 'ibm', 'on_premises'],
    maintenanceFrequencies: ['daily', 'weekly', 'monthly', 'quarterly', 'semi_annually', 'annually'],
    securityClassifications: ['public', 'internal', 'confidential', 'restricted'],
  }), [globalConfig]);

  // UI metadata helper
  const ensureUIMetadata = useCallback((asset: Partial<Asset>): Partial<Asset> => {
    const now = new Date().toISOString();
    return {
      ...asset,
      tenantId,
      tags: asset.tags || [],
      health_status: asset.health_status || "gray",
      sync_status: asset.sync_status || "dirty",
      synced_at: asset.synced_at || now,
      child_asset_ids: asset.child_asset_ids || [],
      dependencies: asset.dependencies || [],
      supports_business_service_ids: asset.supports_business_service_ids || [],
      maintenance_schedules: asset.maintenance_schedules || [],
      related_incident_ids: asset.related_incident_ids || [],
      related_change_ids: asset.related_change_ids || [],
      related_maintenance_ids: asset.related_maintenance_ids || [],
      compliance_requirement_ids: asset.compliance_requirement_ids || [],
      metrics: asset.metrics || {},
      monitoring_enabled: asset.monitoring_enabled ?? false,
      backup_enabled: asset.backup_enabled ?? false,
      security_patching_enabled: asset.security_patching_enabled ?? true,
      incident_count_ytd: asset.incident_count_ytd || 0,
    };
  }, [tenantId]);

  // Check if cache is stale
  const isCacheStale = useCallback(() => {
    if (!assets.lastFetch) return true;
    return Date.now() - new Date(assets.lastFetch).getTime() > CACHE_TTL_MS;
  }, [assets.lastFetch]);

  // Core data fetching
  const refreshAssets = useCallback(async () => {
    if (!tenantId) return;

    setAssets(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const fetchedAssets = await getAll<Asset>(tenantId, "assets");
      
      const now = new Date().toISOString();
      setAssets({
        data: fetchedAssets,
        loading: false,
        error: null,
        lastFetch: now,
        stale: false,
      });
      
      console.log(`✅ Loaded ${fetchedAssets.length} assets for tenant ${tenantId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load assets';
      setAssets(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
        stale: true,
      }));
      console.error("❌ Assets loading error:", errorMessage);
    }
  }, [tenantId]);

  // Get single asset
  const getAsset = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    try {
      return await getById<Asset>(tenantId, "assets", id);
    } catch (error) {
      console.error(`❌ Failed to get asset ${id}:`, error);
      return undefined;
    }
  }, [tenantId]);

  // Basic UI validation (NOT business validation)
  const validateAssetForUI = useCallback((asset: Partial<Asset>): string | null => {
    // Basic field validation for UI
    if (!asset.name || asset.name.trim().length < 2) {
      return "Name must be at least 2 characters long";
    }
    
    if (!asset.description || asset.description.trim().length < 5) {
      return "Description must be at least 5 characters long";
    }

    // Basic format validation
    if (asset.ip_address && !/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(asset.ip_address)) {
      return "Invalid IP address format";
    }

    return null;
  }, []);

  // Optimistic update helpers
  const addOptimisticUpdate = useCallback((update: Omit<OptimisticUpdate, 'timestamp'>) => {
    const optimisticUpdate: OptimisticUpdate = {
      ...update,
      timestamp: new Date().toISOString(),
    };
    setOptimisticUpdates(prev => [...prev, optimisticUpdate]);
    return optimisticUpdate.id;
  }, []);

  const removeOptimisticUpdate = useCallback((updateId: string) => {
    setOptimisticUpdates(prev => prev.filter(u => u.id !== updateId));
  }, []);

  const rollbackOptimisticUpdate = useCallback((updateId: string) => {
    const update = optimisticUpdates.find(u => u.id === updateId);
    if (!update) return;

    // Revert optimistic changes in UI
    if (update.type === 'create') {
      setAssets(prev => ({
        ...prev,
        data: prev.data.filter(asset => asset.id !== update.id),
      }));
    } else if (update.type === 'update' && update.originalData) {
      setAssets(prev => ({
        ...prev,
        data: prev.data.map(asset => 
          asset.id === update.id ? update.originalData! : asset
        ),
      }));
    } else if (update.type === 'delete' && update.originalData) {
      setAssets(prev => ({
        ...prev,
        data: [...prev.data, update.originalData!],
      }));
    }

    removeOptimisticUpdate(updateId);
  }, [optimisticUpdates, removeOptimisticUpdate]);

  // CRUD Operations (UI orchestration only)
  const createAsset = useCallback(async (
    assetData: Omit<Asset, 'id' | 'created_at' | 'updated_at'>, 
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");

    // Basic UI validation only
    const validationError = validateAssetForUI(assetData);
    if (validationError) {
      throw new Error(validationError);
    }

    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();
    const optimisticAsset: Asset = {
      ...ensureUIMetadata(assetData),
      id: tempId,
      created_at: now,
      updated_at: now,
    } as Asset;

    // Optimistic UI update
    const optimisticUpdateId = addOptimisticUpdate({
      id: tempId,
      type: 'create',
      newData: optimisticAsset,
    });

    setAssets(prev => ({
      ...prev,
      data: [optimisticAsset, ...prev.data],
    }));

    try {
      // Backend handles ALL business validation and logic
      await putWithAudit(
        tenantId,
        "assets",
        { ...optimisticAsset, id: undefined }, // Let backend assign real ID
        userId,
        {
          action: "create",
          description: `Created asset: ${assetData.name}`,
          tags: ["asset", "create", assetData.type, assetData.status],
          metadata: {
            asset_type: assetData.type,
            location: assetData.location,
          },
        }
      );

      await enqueueItem({
        storeName: "assets",
        entityId: tempId,
        action: "create",
        payload: optimisticAsset,
        priority: 'normal',
      });

      removeOptimisticUpdate(optimisticUpdateId);
      await refreshAssets(); // Refresh to get real data from backend
      
    } catch (error) {
      rollbackOptimisticUpdate(optimisticUpdateId);
      throw error;
    }
  }, [tenantId, validateAssetForUI, ensureUIMetadata, addOptimisticUpdate, enqueueItem, removeOptimisticUpdate, rollbackOptimisticUpdate, refreshAssets]);

  const updateAsset = useCallback(async (
    id: string, 
    updates: Partial<Asset>, 
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");

    // Find original asset for rollback
    const originalAsset = assets.data.find(a => a.id === id);
    if (!originalAsset) {
      throw new Error(`Asset ${id} not found`);
    }

    // Basic UI validation only
    const validationError = validateAssetForUI(updates);
    if (validationError) {
      throw new Error(validationError);
    }

    const updatedAsset = {
      ...originalAsset,
      ...ensureUIMetadata(updates),
      updated_at: new Date().toISOString(),
    };

    // Optimistic UI update
    const optimisticUpdateId = addOptimisticUpdate({
      id,
      type: 'update',
      originalData: originalAsset,
      newData: updates,
    });

    setAssets(prev => ({
      ...prev,
      data: prev.data.map(asset => 
        asset.id === id ? updatedAsset : asset
      ),
    }));

    try {
      // Backend handles ALL business validation and logic
      await putWithAudit(
        tenantId,
        "assets",
        updatedAsset,
        userId,
        {
          action: "update",
          description: `Updated asset: ${updatedAsset.name}`,
          tags: ["asset", "update", updatedAsset.status],
          metadata: {
            status_change: updatedAsset.status,
            health_status: updatedAsset.health_status,
          },
        }
      );

      await enqueueItem({
        storeName: "assets",
        entityId: id,
        action: "update",
        payload: updatedAsset,
        priority: 'normal',
      });

      removeOptimisticUpdate(optimisticUpdateId);
      await refreshAssets(); // Refresh to get calculated data from backend

    } catch (error) {
      rollbackOptimisticUpdate(optimisticUpdateId);
      throw error;
    }
  }, [tenantId, assets.data, validateAssetForUI, ensureUIMetadata, addOptimisticUpdate, enqueueItem, removeOptimisticUpdate, rollbackOptimisticUpdate, refreshAssets]);

  const deleteAsset = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    const assetToDelete = assets.data.find(a => a.id === id);
    if (!assetToDelete) {
      throw new Error(`Asset ${id} not found`);
    }

    // Optimistic UI update
    const optimisticUpdateId = addOptimisticUpdate({
      id,
      type: 'delete',
      originalData: assetToDelete,
    });

    setAssets(prev => ({
      ...prev,
      data: prev.data.filter(asset => asset.id !== id),
    }));

    try {
      // Backend handles ALL business validation and logic
      await removeWithAudit(
        tenantId,
        "assets",
        id,
        userId,
        {
          action: "delete",
          description: `Deleted asset: ${assetToDelete.name}`,
          tags: ["asset", "delete"],
          metadata: {
            asset_type: assetToDelete.type,
          },
        }
      );

      await enqueueItem({
        storeName: "assets",
        entityId: id,
        action: "delete",
        payload: null,
      });

      removeOptimisticUpdate(optimisticUpdateId);

    } catch (error) {
      rollbackOptimisticUpdate(optimisticUpdateId);
      throw error;
    }
  }, [tenantId, assets.data, addOptimisticUpdate, enqueueItem, removeOptimisticUpdate, rollbackOptimisticUpdate]);

  // Client-side filtering helpers (UI responsiveness only)
  const getFilteredAssets = useCallback((filters: AssetFilters): Asset[] => {
    return assets.data.filter(asset => {
      if (filters.type && !filters.type.includes(asset.type)) return false;
      if (filters.status && !filters.status.includes(asset.status)) return false;
      if (filters.location && asset.location && !filters.location.includes(asset.location)) return false;
      if (filters.vendor_id && asset.vendor_id && !filters.vendor_id.includes(asset.vendor_id)) return false;
      if (filters.business_service_id && !filters.business_service_id.includes(asset.business_service_id || '')) return false;
      if (filters.health_status && !filters.health_status.includes(asset.health_status)) return false;
      if (filters.search_query) {
        const query = filters.search_query.toLowerCase();
        const searchableText = `${asset.name} ${asset.description} ${asset.hostname || ''} ${asset.ip_address || ''}`.toLowerCase();
        if (!searchableText.includes(query)) return false;
      }
      return true;
    });
  }, [assets.data]);

  const getSortedAssets = useCallback((sortOptions: AssetSortOptions): Asset[] => {
    return [...assets.data].sort((a, b) => {
      const aValue = a[sortOptions.field];
      const bValue = b[sortOptions.field];
      
      if (aValue === bValue) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      
      const comparison = aValue < bValue ? -1 : 1;
      return sortOptions.direction === 'asc' ? comparison : -comparison;
    });
  }, [assets.data]);

  const searchAssets = useCallback((query: string): Asset[] => {
    if (!query.trim()) return assets.data;
    
    const lowerQuery = query.toLowerCase();
    return assets.data.filter(asset => 
      asset.name.toLowerCase().includes(lowerQuery) ||
      asset.description.toLowerCase().includes(lowerQuery) ||
      asset.hostname?.toLowerCase().includes(lowerQuery) ||
      asset.ip_address?.includes(query) ||
      asset.asset_tag?.toLowerCase().includes(lowerQuery) ||
      asset.serial_number?.toLowerCase().includes(lowerQuery)
    );
  }, [assets.data]);

  // Simple client-side helpers for immediate UI responsiveness
  const getAssetsByType = useCallback((type: string) => {
    return assets.data.filter(a => a.type === type);
  }, [assets.data]);

  const getAssetsByStatus = useCallback((status: string) => {
    return assets.data.filter(a => a.status === status);
  }, [assets.data]);

  const getAssetsByLocation = useCallback((location: string) => {
    return assets.data.filter(a => a.location === location);
  }, [assets.data]);

  const getAssetsByVendor = useCallback((vendorId: string) => {
    return assets.data.filter(a => a.vendor_id === vendorId);
  }, [assets.data]);

  const getAssetsByBusinessService = useCallback((serviceId: string) => {
    return assets.data.filter(a => 
      a.business_service_id === serviceId || 
      a.supports_business_service_ids.includes(serviceId)
    );
  }, [assets.data]);

  // Backend-calculated data (display what backend provides)
  const getCriticalAssets = useCallback(() => {
    return assets.data.filter(a => 
      a.dependencies.some(d => d.criticality === 'critical') ||
      a.health_status === 'red' ||
      a.security_classification === 'restricted'
    );
  }, [assets.data]);

  const getAssetsNeedingMaintenance = useCallback(() => {
    const now = new Date();
    return assets.data.filter(a => 
      a.maintenance_schedules.some(schedule => 
        new Date(schedule.next_due_date) <= now
      )
    );
  }, [assets.data]);

  const getAssetsNearEOL = useCallback((months: number = 6) => {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() + months);
    
    return assets.data.filter(a => 
      a.expected_eol && new Date(a.expected_eol) <= cutoffDate
    );
  }, [assets.data]);

  const getHighRiskAssets = useCallback(() => {
    return assets.data.filter(a => 
      (a.risk_score && a.risk_score > 7) ||
      a.health_status === 'red' ||
      (a.incident_count_ytd && a.incident_count_ytd > 5)
    );
  }, [assets.data]);

  // UI state management
  const clearError = useCallback(() => {
    setAssets(prev => ({ ...prev, error: null }));
  }, []);

  const invalidateCache = useCallback(() => {
    setAssets(prev => ({ ...prev, stale: true }));
  }, []);

  // Auto-refresh on tenant change or when cache becomes stale
  useEffect(() => {
    if (tenantId && globalConfig) {
      if (!assets.lastFetch || isCacheStale()) {
        refreshAssets();
      }
    } else {
      setAssets({
        data: [],
        loading: false,
        error: null,
        lastFetch: null,
        stale: false,
      });
      setOptimisticUpdates([]);
    }
  }, [tenantId, globalConfig, refreshAssets, assets.lastFetch, isCacheStale]);

  // Cleanup optimistic updates on unmount
  useEffect(() => {
    return () => {
      setOptimisticUpdates([]);
    };
  }, []);

  // Mark cache as stale periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (assets.lastFetch && isCacheStale()) {
        setAssets(prev => ({ ...prev, stale: true }));
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [assets.lastFetch, isCacheStale]);

  const contextValue = useMemo(() => ({
    // Core async state
    assets,
    
    // CRUD Operations
    createAsset,
    updateAsset,
    deleteAsset,
    refreshAssets,
    getAsset,

    // UI-specific operations
    getFilteredAssets,
    getSortedAssets,
    searchAssets,
    
    // Simple client-side helpers
    getAssetsByType,
    getAssetsByStatus,
    getAssetsByLocation,
    getAssetsByVendor,
    getAssetsByBusinessService,
    
    // Backend-calculated data
    getCriticalAssets,
    getAssetsNeedingMaintenance,
    getAssetsNearEOL,
    getHighRiskAssets,

    // UI state management
    clearError,
    invalidateCache,
    
    // Optimistic updates
    optimisticUpdates,
    rollbackOptimisticUpdate,

    // Configuration
    config,
  }), [
    assets,
    createAsset,
    updateAsset,
    deleteAsset,
    refreshAssets,
    getAsset,
    getFilteredAssets,
    getSortedAssets,
    searchAssets,
    getAssetsByType,
    getAssetsByStatus,
    getAssetsByLocation,
    getAssetsByVendor,
    getAssetsByBusinessService,
    getCriticalAssets,
    getAssetsNeedingMaintenance,
    getAssetsNearEOL,
    getHighRiskAssets,
    clearError,
    invalidateCache,
    optimisticUpdates,
    rollbackOptimisticUpdate,
    config,
  ]);

  return (
    <AssetsContext.Provider value={contextValue}>
      {children}
    </AssetsContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------

/**
 * Main hook to access Assets context
 */
export const useAssets = () => {
  const ctx = useContext(AssetsContext);
  if (!ctx) throw new Error("useAssets must be used within AssetsProvider");
  return ctx;
};

/**
 * Hook to get a specific asset with loading state
 */
export const useAssetDetails = (id: string) => {
  const { assets } = useAssets();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const asset = useMemo(() => 
    assets.data.find((a) => a.id === id) || null
  , [assets.data, id]);
  
  return {
    asset,
    loading: loading || assets.loading,
    error: error || assets.error,
  };
};

/**
 * Selective subscription hooks for performance
 */
export const useCriticalAssets = () => {
  const { getCriticalAssets, assets } = useAssets();
  return useMemo(() => getCriticalAssets(), [getCriticalAssets, assets.data]);
};

export const useAssetsNeedingMaintenance = () => {
  const { getAssetsNeedingMaintenance, assets } = useAssets();
  return useMemo(() => getAssetsNeedingMaintenance(), [getAssetsNeedingMaintenance, assets.data]);
};

export const useAssetsNearEOL = (months?: number) => {
  const { getAssetsNearEOL, assets } = useAssets();
  return useMemo(() => getAssetsNearEOL(months), [getAssetsNearEOL, assets.data, months]);
};

export const useHighRiskAssets = () => {
  const { getHighRiskAssets, assets } = useAssets();
  return useMemo(() => getHighRiskAssets(), [getHighRiskAssets, assets.data]);
};

/**
 * Filtered assets hook with memoization
 */
export const useFilteredAssets = (filters: AssetFilters) => {
  const { getFilteredAssets, assets } = useAssets();
  return useMemo(() => getFilteredAssets(filters), [getFilteredAssets, assets.data, filters]);
};

/**
 * Assets search hook with debouncing
 */
export const useAssetsSearch = (query: string, debounceMs: number = 300) => {
  const { searchAssets, assets } = useAssets();
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  return useMemo(() => 
    searchAssets(debouncedQuery), 
    [searchAssets, debouncedQuery, assets.data]
  );
};