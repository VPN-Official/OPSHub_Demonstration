import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAll, getById } from "../db/dbClient";
import { putWithAudit, removeWithAudit } from "../db/dbClient"
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { loadConfig } from "../config/configLoader";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------

export interface MaintenanceSchedule {
  id: string;
  description: string;
  frequency: string; // config.business.assets.maintenance_frequencies
  next_due_date: string;
  last_performed_at?: string | null;
}

export interface Asset {
  id: string;
  name: string;
  description: string;
  type: string;   // config.business.assets.types
  status: string; // config.business.assets.statuses
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

  // Lifecycle
  purchase_date?: string | null;
  warranty_expiry?: string | null;
  expected_eol?: string | null;
  maintenance_schedules: MaintenanceSchedule[];

  // Technical
  hostname?: string;
  ip_address?: string;
  location?: string;       // config.business.assets.locations
  serial_number?: string;
  cloud_provider?: string; // config.business.assets.cloud_providers
  configuration?: Record<string, any>;

  // Risk & Compliance
  risk_score?: number;
  compliance_requirement_ids: string[];

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

interface AssetsContextType {
  assets: Asset[];
  addAsset: (asset: Asset, userId?: string) => Promise<void>;
  updateAsset: (asset: Asset, userId?: string) => Promise<void>;
  deleteAsset: (id: string, userId?: string) => Promise<void>;
  refreshAssets: () => Promise<void>;
  getAsset: (id: string) => Promise<Asset | undefined>;

  // NEW: expose config
  config: {
    types: string[];
    statuses: string[];
    maintenance_frequencies: string[];
    locations: string[];
    cloud_providers: string[];
  };
}

const AssetsContext = createContext<AssetsContextType | undefined>(undefined);

// ---------------------------------
// Provider
// ---------------------------------

export const AssetsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueue } = useSync();
  const [assets, setAssets] = useState<Asset[]>([]);

  const config = loadConfig(tenantId).business.assets;

  const refreshAssets = async () => {
    const all = await getAll<Asset>(tenantId, "assets");
    setAssets(all);
  };

  const getAsset = async (id: string) => {
    return getById<Asset>(tenantId, "assets", id);
  };

  const addAsset = async (asset: Asset, userId?: string) => {
    // ✅ Validate against config
    if (!config.types.includes(asset.type)) {
      throw new Error(`Invalid asset type: ${asset.type}`);
    }
    if (!config.statuses.includes(asset.status)) {
      throw new Error(`Invalid asset status: ${asset.status}`);
    }
    if (asset.location && !config.locations.includes(asset.location)) {
      throw new Error(`Invalid location: ${asset.location}`);
    }
    if (asset.cloud_provider && !config.cloud_providers.includes(asset.cloud_provider)) {
      throw new Error(`Invalid cloud provider: ${asset.cloud_provider}`);
    }
    for (const sched of asset.maintenance_schedules) {
      if (!config.maintenance_frequencies.includes(sched.frequency)) {
        throw new Error(`Invalid maintenance frequency: ${sched.frequency}`);
      }
    }

    await putWithAudit(
      tenantId,
      "assets",
      asset,
      userId,
      { action: "create", description: `Asset "${asset.name}" created` },
      enqueue
    );
    await refreshAssets();
  };

  const updateAsset = async (asset: Asset, userId?: string) => {
    await putWithAudit(
      tenantId,
      "assets",
      asset,
      userId,
      { action: "update", description: `Asset "${asset.name}" updated` },
      enqueue
    );
    await refreshAssets();
  };

  const deleteAsset = async (id: string, userId?: string) => {
    await removeWithAudit(
      tenantId,
      "assets",
      id,
      userId,
      { description: `Asset ${id} deleted` },
      enqueue
    );
    await refreshAssets();
  };

  useEffect(() => {
    refreshAssets();
  }, [tenantId]);

  return (
    <AssetsContext.Provider
      value={{
        assets,
        addAsset,
        updateAsset,
        deleteAsset,
        refreshAssets,
        getAsset,
        config,
      }}
    >
      {children}
    </AssetsContext.Provider>
  );
};

// ---------------------------------
// Hooks
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