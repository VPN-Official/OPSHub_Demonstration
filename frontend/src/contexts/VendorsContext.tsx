import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAll, getById } from "../db/dbClient";
import { putWithAudit, removeWithAudit } from "../db/dbClient"
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { loadConfig } from "../config/configLoader";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------

export interface Vendor {
  id: string;
  name: string;
  description?: string;
  tier: string;     // config.business.vendors.tiers
  region?: string;  // config.business.vendors.regions
  industry?: string;// config.business.vendors.industries
  created_at: string;
  updated_at: string;

  // Relationships
  asset_ids: string[];
  contract_ids: string[];
  business_service_ids: string[];
  account_manager_user_id?: string;

  // Contact Info
  primary_contact_name?: string;
  primary_contact_email?: string;
  primary_contact_phone?: string;
  support_url?: string;

  // Financials
  annual_spend?: number;
  currency?: string; // config.business.vendors.currencies

  // Risk & Compliance
  risk_score?: number;
  compliance_certifications?: string[]; // config.business.vendors.compliance_certifications

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

interface VendorsContextType {
  vendors: Vendor[];
  addVendor: (vendor: Vendor, userId?: string) => Promise<void>;
  updateVendor: (vendor: Vendor, userId?: string) => Promise<void>;
  deleteVendor: (id: string, userId?: string) => Promise<void>;
  refreshVendors: () => Promise<void>;
  getVendor: (id: string) => Promise<Vendor | undefined>;

  // NEW: expose config
  config: {
    tiers: string[];
    regions: string[];
    industries: string[];
    currencies: string[];
    compliance_certifications: string[];
  };
}

const VendorsContext = createContext<VendorsContextType | undefined>(undefined);

// ---------------------------------
// Provider
// ---------------------------------

export const VendorsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueue } = useSync();
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const config = loadConfig(tenantId).business.vendors;

  const refreshVendors = async () => {
    const all = await getAll<Vendor>(tenantId, "vendors");
    setVendors(all);
  };

  const getVendor = async (id: string) => {
    return getById<Vendor>(tenantId, "vendors", id);
  };

  const addVendor = async (vendor: Vendor, userId?: string) => {
    // ✅ Validate against config
    if (!config.tiers.includes(vendor.tier)) {
      throw new Error(`Invalid vendor tier: ${vendor.tier}`);
    }
    if (vendor.region && !config.regions.includes(vendor.region)) {
      throw new Error(`Invalid region: ${vendor.region}`);
    }
    if (vendor.industry && !config.industries.includes(vendor.industry)) {
      throw new Error(`Invalid industry: ${vendor.industry}`);
    }
    if (vendor.currency && !config.currencies.includes(vendor.currency)) {
      throw new Error(`Invalid currency: ${vendor.currency}`);
    }
    if (vendor.compliance_certifications) {
      vendor.compliance_certifications.forEach(cert => {
        if (!config.compliance_certifications.includes(cert)) {
          throw new Error(`Invalid compliance certification: ${cert}`);
        }
      });
    }

    await putWithAudit(
      tenantId,
      "vendors",
      vendor,
      userId,
      { action: "create", description: `Vendor "${vendor.name}" created` },
      enqueue
    );
    await refreshVendors();
  };

  const updateVendor = async (vendor: Vendor, userId?: string) => {
    await putWithAudit(
      tenantId,
      "vendors",
      vendor,
      userId,
      { action: "update", description: `Vendor "${vendor.name}" updated` },
      enqueue
    );
    await refreshVendors();
  };

  const deleteVendor = async (id: string, userId?: string) => {
    await removeWithAudit(
      tenantId,
      "vendors",
      id,
      userId,
      { description: `Vendor ${id} deleted` },
      enqueue
    );
    await refreshVendors();
  };

  useEffect(() => {
    refreshVendors();
  }, [tenantId]);

  return (
    <VendorsContext.Provider
      value={{
        vendors,
        addVendor,
        updateVendor,
        deleteVendor,
        refreshVendors,
        getVendor,
        config,
      }}
    >
      {children}
    </VendorsContext.Provider>
  );
};

// ---------------------------------
// Hooks
// ---------------------------------

export const useVendors = () => {
  const ctx = useContext(VendorsContext);
  if (!ctx) throw new Error("useVendors must be used within VendorsProvider");
  return ctx;
};

export const useVendorDetails = (id: string) => {
  const { vendors } = useVendors();
  return vendors.find((v) => v.id === id) || null;
};