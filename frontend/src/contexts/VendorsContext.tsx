// src/contexts/VendorsContext.tsx (STANDARDIZED)
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { getAll, getById, putWithAudit, removeWithAudit } from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------
export interface Vendor {
  id: string;
  name: string;
  description?: string;
  tier: string;     // config-driven
  region?: string;  // config-driven
  industry?: string;// config-driven
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
  escalation_contacts?: Array<{
    name: string;
    role: string;
    email?: string;
    phone?: string;
    level: "L1" | "L2" | "L3" | "executive";
  }>;

  // Financials
  annual_spend?: number;
  currency?: string; // config-driven
  payment_terms?: string;
  discount_percentage?: number;

  // Risk & Compliance
  risk_score?: number;
  compliance_certifications?: string[]; // config-driven
  security_clearance?: string;
  data_processing_agreement?: boolean;
  gdpr_compliant?: boolean;

  // Performance Metrics
  sla_compliance_percentage?: number;
  response_time_hours?: number;
  resolution_time_hours?: number;
  incident_count?: number;
  last_incident_date?: string;

  // Vendor Management
  contract_renewal_date?: string;
  procurement_contact_user_id?: string;
  vendor_status?: "active" | "inactive" | "under_review" | "terminated";
  onboarding_date?: string;
  last_review_date?: string;
  next_review_date?: string;

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
interface VendorsContextType {
  vendors: Vendor[];
  addVendor: (vendor: Vendor, userId?: string) => Promise<void>;
  updateVendor: (vendor: Vendor, userId?: string) => Promise<void>;
  deleteVendor: (id: string, userId?: string) => Promise<void>;
  refreshVendors: () => Promise<void>;
  getVendor: (id: string) => Promise<Vendor | undefined>;

  // Vendor-specific operations
  updateVendorPerformance: (vendorId: string, performanceData: Partial<Vendor>, userId?: string) => Promise<void>;
  addEscalationContact: (vendorId: string, contact: Vendor['escalation_contacts'][0], userId?: string) => Promise<void>;
  removeEscalationContact: (vendorId: string, contactIndex: number, userId?: string) => Promise<void>;
  renewVendorContract: (vendorId: string, renewalData: { renewal_date: string; terms?: string }, userId?: string) => Promise<void>;
  updateVendorRiskScore: (vendorId: string, riskScore: number, reason: string, userId?: string) => Promise<void>;
  
  // Filtering and querying
  getVendorsByTier: (tier: string) => Vendor[];
  getVendorsByRegion: (region: string) => Vendor[];
  getVendorsByIndustry: (industry: string) => Vendor[];
  getHighRiskVendors: (riskThreshold?: number) => Vendor[];
  getVendorsWithExpiredContracts: () => Vendor[];
  getVendorsWithUpcomingRenewals: (daysAhead?: number) => Vendor[];
  getUnderperformingVendors: (slaThreshold?: number) => Vendor[];
  searchVendors: (query: string) => Vendor[];

  // Analytics
  getVendorSpendAnalysis: () => {
    totalSpend: number;
    averageSpend: number;
    topSpenders: Vendor[];
    spendByTier: Record<string, number>;
    spendByRegion: Record<string, number>;
  };

  getVendorPerformanceStats: () => {
    averageSLACompliance: number;
    averageResponseTime: number;
    averageResolutionTime: number;
    totalIncidents: number;
    performingVendors: number;
    underperformingVendors: number;
  };

  // Config integration
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
// 3. Provider
// ---------------------------------
export const VendorsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig, validateEnum } = useConfig();
  const [vendors, setVendors] = useState<Vendor[]>([]);

  // Extract vendor-specific config from global config
  const config = {
    tiers: globalConfig?.business?.vendors?.tiers || 
           ['strategic', 'preferred', 'approved', 'restricted'],
    regions: globalConfig?.business?.vendors?.regions || 
             ['north_america', 'europe', 'asia_pacific', 'latin_america', 'africa', 'middle_east'],
    industries: globalConfig?.business?.vendors?.industries || 
                ['technology', 'telecommunications', 'manufacturing', 'financial_services', 'healthcare', 'consulting'],
    currencies: globalConfig?.business?.vendors?.currencies || 
                ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'],
    compliance_certifications: globalConfig?.business?.vendors?.compliance_certifications || 
                               ['ISO27001', 'SOC2', 'PCI-DSS', 'HIPAA', 'GDPR', 'FedRAMP'],
  };

  const validateVendor = useCallback((vendor: Vendor) => {
    if (!globalConfig) {
      throw new Error("Configuration not loaded");
    }

    // Validate tier
    if (!config.tiers.includes(vendor.tier)) {
      throw new Error(`Invalid vendor tier: ${vendor.tier}. Valid options: ${config.tiers.join(', ')}`);
    }

    // Validate region if provided
    if (vendor.region && !config.regions.includes(vendor.region)) {
      throw new Error(`Invalid region: ${vendor.region}. Valid options: ${config.regions.join(', ')}`);
    }

    // Validate industry if provided
    if (vendor.industry && !config.industries.includes(vendor.industry)) {
      throw new Error(`Invalid industry: ${vendor.industry}. Valid options: ${config.industries.join(', ')}`);
    }

    // Validate currency if provided
    if (vendor.currency && !config.currencies.includes(vendor.currency)) {
      throw new Error(`Invalid currency: ${vendor.currency}. Valid options: ${config.currencies.join(', ')}`);
    }

    // Validate compliance certifications if provided
    if (vendor.compliance_certifications) {
      vendor.compliance_certifications.forEach(cert => {
        if (!config.compliance_certifications.includes(cert)) {
          throw new Error(`Invalid compliance certification: ${cert}. Valid options: ${config.compliance_certifications.join(', ')}`);
        }
      });
    }

    // Validate required fields
    if (!vendor.name || vendor.name.trim().length < 2) {
      throw new Error("Vendor name must be at least 2 characters long");
    }

    // Validate email format if provided
    if (vendor.primary_contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vendor.primary_contact_email)) {
      throw new Error("Invalid primary contact email format");
    }

    // Validate financial values
    if (vendor.annual_spend !== undefined && vendor.annual_spend < 0) {
      throw new Error("Annual spend must be a positive number");
    }

    if (vendor.discount_percentage !== undefined && (vendor.discount_percentage < 0 || vendor.discount_percentage > 100)) {
      throw new Error("Discount percentage must be between 0 and 100");
    }

    // Validate risk score
    if (vendor.risk_score !== undefined && (vendor.risk_score < 0 || vendor.risk_score > 100)) {
      throw new Error("Risk score must be between 0 and 100");
    }

    // Validate performance metrics
    if (vendor.sla_compliance_percentage !== undefined && (vendor.sla_compliance_percentage < 0 || vendor.sla_compliance_percentage > 100)) {
      throw new Error("SLA compliance percentage must be between 0 and 100");
    }
  }, [globalConfig, config]);

  const ensureMetadata = useCallback((vendor: Vendor): Vendor => {
    const now = new Date().toISOString();
    return {
      ...vendor,
      tenantId,
      tags: vendor.tags || [],
      health_status: vendor.health_status || "gray",
      sync_status: vendor.sync_status || "dirty",
      synced_at: vendor.synced_at || now,
      asset_ids: vendor.asset_ids || [],
      contract_ids: vendor.contract_ids || [],
      business_service_ids: vendor.business_service_ids || [],
      escalation_contacts: vendor.escalation_contacts || [],
      compliance_certifications: vendor.compliance_certifications || [],
      vendor_status: vendor.vendor_status || "active",
    };
  }, [tenantId]);

  const refreshVendors = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      const all = await getAll<Vendor>(tenantId, "vendors");
      
      // Sort by tier priority and performance
      all.sort((a, b) => {
        // Strategic vendors first
        const tierOrder = { strategic: 4, preferred: 3, approved: 2, restricted: 1 };
        const aTier = tierOrder[a.tier as keyof typeof tierOrder] || 0;
        const bTier = tierOrder[b.tier as keyof typeof tierOrder] || 0;
        if (aTier !== bTier) return bTier - aTier;
        
        // Health status priority
        const healthOrder = { green: 5, yellow: 4, orange: 3, red: 2, gray: 1 };
        const aHealth = healthOrder[a.health_status] || 0;
        const bHealth = healthOrder[b.health_status] || 0;
        if (aHealth !== bHealth) return bHealth - aHealth;
        
        // Finally by name
        return a.name.localeCompare(b.name);
      });
      
      setVendors(all);
    } catch (error) {
      console.error("Failed to refresh vendors:", error);
    }
  }, [tenantId]);

  const getVendor = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    return getById<Vendor>(tenantId, "vendors", id);
  }, [tenantId]);

  const addVendor = useCallback(async (vendor: Vendor, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateVendor(vendor);

    const now = new Date().toISOString();
    const enriched = ensureMetadata({
      ...vendor,
      created_at: now,
      updated_at: now,
      onboarding_date: now,
    });

    const priority = vendor.tier === 'strategic' ? 'high' : 'normal';

    await putWithAudit(
      tenantId,
      "vendors",
      enriched,
      userId,
      {
        action: "create",
        description: `Created vendor: ${vendor.name}`,
        tags: ["vendor", "create", vendor.tier, vendor.industry || "unspecified"],
        metadata: {
          tier: vendor.tier,
          region: vendor.region,
          industry: vendor.industry,
          annual_spend: vendor.annual_spend,
        },
      }
    );

    await enqueueItem({
      storeName: "vendors",
      entityId: enriched.id,
      action: "create",
      payload: enriched,
      priority,
    });

    await refreshVendors();
  }, [tenantId, validateVendor, ensureMetadata, enqueueItem, refreshVendors]);

  const updateVendor = useCallback(async (vendor: Vendor, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateVendor(vendor);

    const enriched = ensureMetadata({
      ...vendor,
      updated_at: new Date().toISOString(),
    });

    await putWithAudit(
      tenantId,
      "vendors",
      enriched,
      userId,
      {
        action: "update",
        description: `Updated vendor: ${vendor.name}`,
        tags: ["vendor", "update", vendor.tier],
        metadata: {
          tier: vendor.tier,
          annual_spend: vendor.annual_spend,
          risk_score: vendor.risk_score,
        },
      }
    );

    await enqueueItem({
      storeName: "vendors",
      entityId: enriched.id,
      action: "update",
      payload: enriched,
    });

    await refreshVendors();
  }, [tenantId, validateVendor, ensureMetadata, enqueueItem, refreshVendors]);

  const deleteVendor = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    const vendor = await getVendor(id);
    if (!vendor) throw new Error(`Vendor ${id} not found`);

    await removeWithAudit(
      tenantId,
      "vendors",
      id,
      userId,
      {
        action: "delete",
        description: `Deleted vendor: ${vendor.name}`,
        tags: ["vendor", "delete", vendor.tier],
        metadata: {
          tier: vendor.tier,
          annual_spend: vendor.annual_spend,
        },
      }
    );

    await enqueueItem({
      storeName: "vendors",
      entityId: id,
      action: "delete",
      payload: null,
    });

    await refreshVendors();
  }, [tenantId, getVendor, enqueueItem, refreshVendors]);

  // Vendor-specific operations
  const updateVendorPerformance = useCallback(async (vendorId: string, performanceData: Partial<Vendor>, userId?: string) => {
    const vendor = await getVendor(vendorId);
    if (!vendor) throw new Error(`Vendor ${vendorId} not found`);

    const updated = { ...vendor, ...performanceData };
    await updateVendor(updated, userId);
  }, [getVendor, updateVendor]);

  const addEscalationContact = useCallback(async (vendorId: string, contact: Vendor['escalation_contacts'][0], userId?: string) => {
    const vendor = await getVendor(vendorId);
    if (!vendor) throw new Error(`Vendor ${vendorId} not found`);

    const updatedContacts = [...vendor.escalation_contacts, contact];
    const updated = { ...vendor, escalation_contacts: updatedContacts };

    await updateVendor(updated, userId);
  }, [getVendor, updateVendor]);

  const removeEscalationContact = useCallback(async (vendorId: string, contactIndex: number, userId?: string) => {
    const vendor = await getVendor(vendorId);
    if (!vendor) throw new Error(`Vendor ${vendorId} not found`);

    const updatedContacts = vendor.escalation_contacts.filter((_, index) => index !== contactIndex);
    const updated = { ...vendor, escalation_contacts: updatedContacts };

    await updateVendor(updated, userId);
  }, [getVendor, updateVendor]);

  const renewVendorContract = useCallback(async (vendorId: string, renewalData: { renewal_date: string; terms?: string }, userId?: string) => {
    const vendor = await getVendor(vendorId);
    if (!vendor) throw new Error(`Vendor ${vendorId} not found`);

    const updated = { 
      ...vendor, 
      contract_renewal_date: renewalData.renewal_date,
      last_review_date: new Date().toISOString(),
    };

    await updateVendor(updated, userId);
  }, [getVendor, updateVendor]);

  const updateVendorRiskScore = useCallback(async (vendorId: string, riskScore: number, reason: string, userId?: string) => {
    const vendor = await getVendor(vendorId);
    if (!vendor) throw new Error(`Vendor ${vendorId} not found`);

    const updated = { 
      ...vendor, 
      risk_score: riskScore,
      custom_fields: {
        ...vendor.custom_fields,
        risk_update_reason: reason,
        risk_updated_at: new Date().toISOString(),
      },
    };

    await updateVendor(updated, userId);
  }, [getVendor, updateVendor]);

  // Filtering functions
  const getVendorsByTier = useCallback((tier: string) => {
    return vendors.filter(v => v.tier === tier);
  }, [vendors]);

  const getVendorsByRegion = useCallback((region: string) => {
    return vendors.filter(v => v.region === region);
  }, [vendors]);

  const getVendorsByIndustry = useCallback((industry: string) => {
    return vendors.filter(v => v.industry === industry);
  }, [vendors]);

  const getHighRiskVendors = useCallback((riskThreshold: number = 70) => {
    return vendors.filter(v => 
      (v.risk_score && v.risk_score >= riskThreshold) ||
      v.health_status === 'red' ||
      (v.sla_compliance_percentage && v.sla_compliance_percentage < 90)
    );
  }, [vendors]);

  const getVendorsWithExpiredContracts = useCallback(() => {
    const now = new Date();
    return vendors.filter(v => {
      if (!v.contract_renewal_date) return false;
      return new Date(v.contract_renewal_date) < now;
    });
  }, [vendors]);

  const getVendorsWithUpcomingRenewals = useCallback((daysAhead: number = 90) => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + (daysAhead * 24 * 60 * 60 * 1000));
    
    return vendors.filter(v => {
      if (!v.contract_renewal_date) return false;
      const renewalDate = new Date(v.contract_renewal_date);
      return renewalDate >= now && renewalDate <= futureDate;
    });
  }, [vendors]);

  const getUnderperformingVendors = useCallback((slaThreshold: number = 95) => {
    return vendors.filter(v => 
      (v.sla_compliance_percentage && v.sla_compliance_percentage < slaThreshold) ||
      v.health_status === 'red' ||
      v.health_status === 'orange'
    );
  }, [vendors]);

  const searchVendors = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return vendors.filter(v => 
      v.name.toLowerCase().includes(lowerQuery) ||
      v.description?.toLowerCase().includes(lowerQuery) ||
      v.industry?.toLowerCase().includes(lowerQuery) ||
      v.tier.toLowerCase().includes(lowerQuery) ||
      v.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }, [vendors]);

  // Analytics functions
  const getVendorSpendAnalysis = useCallback(() => {
    const vendorsWithSpend = vendors.filter(v => v.annual_spend && v.annual_spend > 0);
    const totalSpend = vendorsWithSpend.reduce((sum, v) => sum + (v.annual_spend || 0), 0);
    const averageSpend = vendorsWithSpend.length > 0 ? totalSpend / vendorsWithSpend.length : 0;
    
    const topSpenders = vendorsWithSpend
      .sort((a, b) => (b.annual_spend || 0) - (a.annual_spend || 0))
      .slice(0, 10);

    const spendByTier = vendors.reduce((acc, v) => {
      if (v.annual_spend) {
        acc[v.tier] = (acc[v.tier] || 0) + v.annual_spend;
      }
      return acc;
    }, {} as Record<string, number>);

    const spendByRegion = vendors.reduce((acc, v) => {
      if (v.annual_spend && v.region) {
        acc[v.region] = (acc[v.region] || 0) + v.annual_spend;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      totalSpend,
      averageSpend,
      topSpenders,
      spendByTier,
      spendByRegion,
    };
  }, [vendors]);

  const getVendorPerformanceStats = useCallback(() => {
    const vendorsWithSLA = vendors.filter(v => v.sla_compliance_percentage !== undefined);
    const vendorsWithResponseTime = vendors.filter(v => v.response_time_hours !== undefined);
    const vendorsWithResolutionTime = vendors.filter(v => v.resolution_time_hours !== undefined);

    const averageSLACompliance = vendorsWithSLA.length > 0 
      ? vendorsWithSLA.reduce((sum, v) => sum + (v.sla_compliance_percentage || 0), 0) / vendorsWithSLA.length
      : 0;

    const averageResponseTime = vendorsWithResponseTime.length > 0
      ? vendorsWithResponseTime.reduce((sum, v) => sum + (v.response_time_hours || 0), 0) / vendorsWithResponseTime.length
      : 0;

    const averageResolutionTime = vendorsWithResolutionTime.length > 0
      ? vendorsWithResolutionTime.reduce((sum, v) => sum + (v.resolution_time_hours || 0), 0) / vendorsWithResolutionTime.length
      : 0;

    const totalIncidents = vendors.reduce((sum, v) => sum + (v.incident_count || 0), 0);
    const performingVendors = vendors.filter(v => 
      v.health_status === 'green' && 
      (!v.sla_compliance_percentage || v.sla_compliance_percentage >= 95)
    ).length;
    const underperformingVendors = vendors.filter(v => 
      v.health_status === 'red' || v.health_status === 'orange' ||
      (v.sla_compliance_percentage && v.sla_compliance_percentage < 90)
    ).length;

    return {
      averageSLACompliance,
      averageResponseTime,
      averageResolutionTime,
      totalIncidents,
      performingVendors,
      underperformingVendors,
    };
  }, [vendors]);

  // Initialize when tenant and config are ready
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshVendors();
    }
  }, [tenantId, globalConfig, refreshVendors]);

  return (
    <VendorsContext.Provider
      value={{
        vendors,
        addVendor,
        updateVendor,
        deleteVendor,
        refreshVendors,
        getVendor,
        updateVendorPerformance,
        addEscalationContact,
        removeEscalationContact,
        renewVendorContract,
        updateVendorRiskScore,
        getVendorsByTier,
        getVendorsByRegion,
        getVendorsByIndustry,
        getHighRiskVendors,
        getVendorsWithExpiredContracts,
        getVendorsWithUpcomingRenewals,
        getUnderperformingVendors,
        searchVendors,
        getVendorSpendAnalysis,
        getVendorPerformanceStats,
        config,
      }}
    >
      {children}
    </VendorsContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
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

// Utility hooks
export const useStrategicVendors = () => {
  const { getVendorsByTier } = useVendors();
  return getVendorsByTier('strategic');
};

export const useHighRiskVendors = () => {
  const { getHighRiskVendors } = useVendors();
  return getHighRiskVendors();
};

export const useVendorSpendAnalysis = () => {
  const { getVendorSpendAnalysis } = useVendors();
  return getVendorSpendAnalysis();
};

export const useVendorPerformanceStats = () => {
  const { getVendorPerformanceStats } = useVendors();
  return getVendorPerformanceStats();
};