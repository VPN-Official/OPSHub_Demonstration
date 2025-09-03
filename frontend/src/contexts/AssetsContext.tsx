// src/contexts/AssetsContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
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
// 1. Type Definitions
// ---------------------------------
export interface MaintenanceSchedule {
  id: string;
  description: string;
  frequency: string; // daily, weekly, monthly, quarterly, annually
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
  mtbf_hours?: number; // Mean Time Between Failures
  mttr_minutes?: number; // Mean Time To Repair
  utilization_percentage?: number;
  error_rate?: number;
}

export interface Asset {
  id: string;
  name: string;
  description: string;
  type: string;   // config-driven
  status: string; // config-driven
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

  // Financial information
  purchase_cost?: number;
  annual_cost?: number;
  depreciation_rate?: number;
  current_value?: number;
  currency?: string;

  // Performance and monitoring
  metrics: AssetMetrics;
  monitoring_enabled: boolean;
  backup_enabled: boolean;
  security_patching_enabled: boolean;

  // Risk and compliance
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
interface AssetsContextType {
  assets: Asset[];
  addAsset: (asset: Asset, userId?: string) => Promise<void>;
  updateAsset: (asset: Asset, userId?: string) => Promise<void>;
  deleteAsset: (id: string, userId?: string) => Promise<void>;
  refreshAssets: () => Promise<void>;
  getAsset: (id: string) => Promise<Asset | undefined>;

  // Asset-specific operations
  scheduleMaintenanceForAsset: (assetId: string, maintenance: MaintenanceSchedule, userId?: string) => Promise<void>;
  updateAssetMetrics: (assetId: string, metrics: Partial<AssetMetrics>) => Promise<void>;
  addAssetDependency: (assetId: string, dependency: AssetDependency) => Promise<void>;
  removeAssetDependency: (assetId: string, dependencyAssetId: string) => Promise<void>;
  decommissionAsset: (assetId: string, userId: string, reason: string) => Promise<void>;

  // Filtering and querying
  getAssetsByType: (type: string) => Asset[];
  getAssetsByStatus: (status: string) => Asset[];
  getAssetsByLocation: (location: string) => Asset[];
  getAssetsByVendor: (vendorId: string) => Asset[];
  getAssetsByBusinessService: (serviceId: string) => Asset[];
  getCriticalAssets: () => Asset[];
  getAssetsNeedingMaintenance: () => Asset[];
  getAssetsNearEOL: (months?: number) => Asset[];
  getAssetsWithExpiredWarranty: () => Asset[];
  getHighRiskAssets: () => Asset[];

  // Config integration
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
// 3. Provider
// ---------------------------------
export const AssetsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig, validateEnum } = useConfig();
  const [assets, setAssets] = useState<Asset[]>([]);

  // Extract asset-specific config
  const config = {
    types: ['server', 'network_device', 'storage', 'database', 'application', 'workstation', 'mobile_device', 'iot_device'],
    statuses: globalConfig?.statuses?.assets || [],
    locations: ['datacenter_1', 'datacenter_2', 'office_hq', 'office_branch', 'cloud', 'remote'],
    cloudProviders: ['aws', 'azure', 'gcp', 'oracle', 'ibm', 'on_premises'],
    maintenanceFrequencies: ['daily', 'weekly', 'monthly', 'quarterly', 'semi_annually', 'annually'],
    securityClassifications: ['public', 'internal', 'confidential', 'restricted'],
  };

  const refreshAssets = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      const all = await getAll<Asset>(tenantId, "assets");
      
      // Sort by criticality and health status
      all.sort((a, b) => {
        // Critical assets first
        const aCritical = a.dependencies.some(d => d.criticality === 'critical') ? 1 : 0;
        const bCritical = b.dependencies.some(d => d.criticality === 'critical') ? 1 : 0;
        if (aCritical !== bCritical) return bCritical - aCritical;
        
        // Health status priority
        const healthOrder = { red: 5, orange: 4, yellow: 3, green: 2, gray: 1 };
        const aHealth = healthOrder[a.health_status] || 0;
        const bHealth = healthOrder[b.health_status] || 0;
        if (aHealth !== bHealth) return bHealth - aHealth;
        
        // Finally by name
        return a.name.localeCompare(b.name);
      });
      
      setAssets(all);
    } catch (error) {
      console.error("Failed to refresh assets:", error);
    }
  }, [tenantId]);

  const getAsset = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    return getById<Asset>(tenantId, "assets", id);
  }, [tenantId]);

  const validateAsset = useCallback((asset: Asset) => {
    if (!globalConfig) {
      throw new Error("Configuration not loaded");
    }

    // Validate type
    if (!config.types.includes(asset.type)) {
      throw new Error(`Invalid asset type: ${asset.type}. Valid options: ${config.types.join(', ')}`);
    }

    // Validate status
    if (!validateEnum('statuses', asset.status)) {
      throw new Error(`Invalid status: ${asset.status}. Valid options: ${config.statuses.join(', ')}`);
    }

    // Validate location if provided
    if (asset.location && !config.locations.includes(asset.location)) {
      throw new Error(`Invalid location: ${asset.location}. Valid options: ${config.locations.join(', ')}`);
    }

    // Validate cloud provider if provided
    if (asset.cloud_provider && !config.cloudProviders.includes(asset.cloud_provider)) {
      throw new Error(`Invalid cloud provider: ${asset.cloud_provider}. Valid options: ${config.cloudProviders.join(', ')}`);
    }

    // Validate security classification if provided
    if (asset.security_classification && !config.securityClassifications.includes(asset.security_classification)) {
      throw new Error(`Invalid security classification: ${asset.security_classification}. Valid options: ${config.securityClassifications.join(', ')}`);
    }

    // Validate maintenance schedules
    if (asset.maintenance_schedules) {
      asset.maintenance_schedules.forEach(schedule => {
        if (!config.maintenanceFrequencies.includes(schedule.frequency)) {
          throw new Error(`Invalid maintenance frequency: ${schedule.frequency}. Valid options: ${config.maintenanceFrequencies.join(', ')}`);
        }
      });
    }

    // Validate required fields
    if (!asset.name || asset.name.trim().length < 2) {
      throw new Error("Name must be at least 2 characters long");
    }

    if (!asset.description || asset.description.trim().length < 5) {
      throw new Error("Description must be at least 5 characters long");
    }

    // Validate IP address format if provided
    if (asset.ip_address && !/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(asset.ip_address)) {
      throw new Error("Invalid IP address format");
    }
  }, [globalConfig, validateEnum, config]);

  const ensureMetadata = useCallback((asset: Asset): Asset => {
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

  const addAsset = useCallback(async (asset: Asset, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateAsset(asset);

    const now = new Date().toISOString();
    const enriched = ensureMetadata({
      ...asset,
      created_at: now,
      updated_at: now,
    });

    await putWithAudit(
      tenantId,
      "assets",
      enriched,
      userId,
      {
        action: "create",
        description: `Created asset: ${asset.name}`,
        tags: ["asset", "create", asset.type, asset.status],
        metadata: {
          asset_type: asset.type,
          location: asset.location,
          vendor_id: asset.vendor_id,
          purchase_cost: asset.purchase_cost,
        },
      }
    );

    await enqueueItem({
      storeName: "assets",
      entityId: enriched.id,
      action: "create",
      payload: enriched,
      priority: 'normal',
    });

    await refreshAssets();
  }, [tenantId, validateAsset, ensureMetadata, enqueueItem, refreshAssets]);

  const updateAsset = useCallback(async (asset: Asset, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateAsset(asset);

    const enriched = ensureMetadata({
      ...asset,
      updated_at: new Date().toISOString(),
    });

    await putWithAudit(
      tenantId,
      "assets",
      enriched,
      userId,
      {
        action: "update",
        description: `Updated asset: ${asset.name}`,
        tags: ["asset", "update", asset.status],
        metadata: {
          status_change: asset.status,
          health_status: asset.health_status,
        },
      }
    );

    await enqueueItem({
      storeName: "assets",
      entityId: enriched.id,
      action: "update",
      payload: enriched,
      priority: 'normal',
    });

    await refreshAssets();
  }, [tenantId, validateAsset, ensureMetadata, enqueueItem, refreshAssets]);

  const deleteAsset = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    const asset = await getAsset(id);
    
    await removeWithAudit(
      tenantId,
      "assets",
      id,
      userId,
      {
        action: "delete",
        description: `Deleted asset: ${asset?.name || id}`,
        tags: ["asset", "delete"],
        metadata: {
          asset_type: asset?.type,
          decommission_reason: "Asset deleted",
        },
      }
    );

    await enqueueItem({
      storeName: "assets",
      entityId: id,
      action: "delete",
      payload: null,
    });

    await refreshAssets();
  }, [tenantId, getAsset, enqueueItem, refreshAssets]);

  // Asset-specific operations
  const scheduleMaintenanceForAsset = useCallback(async (
    assetId: string, 
    maintenance: MaintenanceSchedule, 
    userId?: string
  ) => {
    const asset = await getAsset(assetId);
    if (!asset) throw new Error(`Asset ${assetId} not found`);

    const updatedSchedules = [...asset.maintenance_schedules, maintenance];
    const updated = { ...asset, maintenance_schedules: updatedSchedules };

    await updateAsset(updated, userId);
  }, [getAsset, updateAsset]);

  const updateAssetMetrics = useCallback(async (assetId: string, metrics: Partial<AssetMetrics>) => {
    const asset = await getAsset(assetId);
    if (!asset) throw new Error(`Asset ${assetId} not found`);

    const updatedMetrics = { ...asset.metrics, ...metrics };
    const updated = { ...asset, metrics: updatedMetrics };

    // Update health status based on metrics
    if (metrics.uptime_percentage !== undefined) {
      if (metrics.uptime_percentage >= 99.5) updated.health_status = "green";
      else if (metrics.uptime_percentage >= 95) updated.health_status = "yellow";
      else if (metrics.uptime_percentage >= 90) updated.health_status = "orange";
      else updated.health_status = "red";
    }

    await updateAsset(updated);
  }, [getAsset, updateAsset]);

  const addAssetDependency = useCallback(async (assetId: string, dependency: AssetDependency) => {
    const asset = await getAsset(assetId);
    if (!asset) throw new Error(`Asset ${assetId} not found`);

    const existingDependency = asset.dependencies.find(d => d.asset_id === dependency.asset_id);
    if (existingDependency) {
      throw new Error(`Dependency on asset ${dependency.asset_id} already exists`);
    }

    const updatedDependencies = [...asset.dependencies, dependency];
    const updated = { ...asset, dependencies: updatedDependencies };

    await updateAsset(updated);
  }, [getAsset, updateAsset]);

  const removeAssetDependency = useCallback(async (assetId: string, dependencyAssetId: string) => {
    const asset = await getAsset(assetId);
    if (!asset) throw new Error(`Asset ${assetId} not found`);

    const updatedDependencies = asset.dependencies.filter(d => d.asset_id !== dependencyAssetId);
    const updated = { ...asset, dependencies: updatedDependencies };

    await updateAsset(updated);
  }, [getAsset, updateAsset]);

  const decommissionAsset = useCallback(async (assetId: string, userId: string, reason: string) => {
    const asset = await getAsset(assetId);
    if (!asset) throw new Error(`Asset ${assetId} not found`);

    const updated = {
      ...asset,
      status: 'retired',
      decommission_date: new Date().toISOString(),
      custom_fields: {
        ...asset.custom_fields,
        decommission_reason: reason,
        decommissioned_by: userId,
      },
    };

    await updateAsset(updated, userId);
  }, [getAsset, updateAsset]);

  // Filtering functions
  const getAssetsByType = useCallback((type: string) => {
    return assets.filter(a => a.type === type);
  }, [assets]);

  const getAssetsByStatus = useCallback((status: string) => {
    return assets.filter(a => a.status === status);
  }, [assets]);

  const getAssetsByLocation = useCallback((location: string) => {
    return assets.filter(a => a.location === location);
  }, [assets]);

  const getAssetsByVendor = useCallback((vendorId: string) => {
    return assets.filter(a => a.vendor_id === vendorId);
  }, [assets]);

  const getAssetsByBusinessService = useCallback((serviceId: string) => {
    return assets.filter(a => 
      a.business_service_id === serviceId || 
      a.supports_business_service_ids.includes(serviceId)
    );
  }, [assets]);

  const getCriticalAssets = useCallback(() => {
    return assets.filter(a => 
      a.dependencies.some(d => d.criticality === 'critical') ||
      a.health_status === 'red' ||
      a.security_classification === 'restricted'
    );
  }, [assets]);

  const getAssetsNeedingMaintenance = useCallback(() => {
    const now = new Date();
    return assets.filter(a => 
      a.maintenance_schedules.some(schedule => 
        new Date(schedule.next_due_date) <= now
      )
    );
  }, [assets]);

  const getAssetsNearEOL = useCallback((months: number = 6) => {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() + months);
    
    return assets.filter(a => 
      a.expected_eol && new Date(a.expected_eol) <= cutoffDate
    );
  }, [assets]);

  const getAssetsWithExpiredWarranty = useCallback(() => {
    const now = new Date();
    return assets.filter(a => 
      a.warranty_expiry && new Date(a.warranty_expiry) < now
    );
  }, [assets]);

  const getHighRiskAssets = useCallback(() => {
    return assets.filter(a => 
      (a.risk_score && a.risk_score > 7) ||
      a.health_status === 'red' ||
      a.incident_count_ytd && a.incident_count_ytd > 5
    );
  }, [assets]);

  // Initialize
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshAssets();
    }
  }, [tenantId, globalConfig, refreshAssets]);

  return (
    <AssetsContext.Provider
      value={{
        assets,
        addAsset,
        updateAsset,
        deleteAsset,
        refreshAssets,
        getAsset,
        scheduleMaintenanceForAsset,
        updateAssetMetrics,
        addAssetDependency,
        removeAssetDependency,
        decommissionAsset,
        getAssetsByType,
        getAssetsByStatus,
        getAssetsByLocation,
        getAssetsByVendor,
        getAssetsByBusinessService,
        getCriticalAssets,
        getAssetsNeedingMaintenance,
        getAssetsNearEOL,
        getAssetsWithExpiredWarranty,
        getHighRiskAssets,
        config,
      }}
    >
      {children}
    </AssetsContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------
export const useAssets = () => {
  const ctx = useContext(AssetsContext);
  if (!ctx) throw new Error("useAssets must be used within AssetsProvider");
  return ctx;
};

export const useAssetDetails = (id: string) => {
  const { assets } = useAssets();
  return assets.find((a) => a.id === id) || null;
};

// Utility hooks
export const useCriticalAssets = () => {
  const { getCriticalAssets } = useAssets();
  return getCriticalAssets();
};

export const useAssetsNeedingMaintenance = () => {
  const { getAssetsNeedingMaintenance } = useAssets();
  return getAssetsNeedingMaintenance();
};

export const useAssetsNearEOL = (months?: number) => {
  const { getAssetsNearEOL } = useAssets();
  return getAssetsNearEOL(months);
};

export const useHighRiskAssets = () => {
  const { getHighRiskAssets } = useAssets();
  return getHighRiskAssets();
};