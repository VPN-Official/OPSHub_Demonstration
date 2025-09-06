// src/contexts/VendorsContext.tsx (ENTERPRISE FRONTEND-ONLY REFACTOR)
import React, { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  ReactNode, 
  useCallback,
  useMemo,
  useRef
} from "react";
import { getAll, getById, putWithAudit, removeWithAudit } from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";

// ---------------------------------
// 1. Frontend AsyncState Interface
// ---------------------------------
export interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  lastFetch: string | null;
  isStale: boolean;
}

// ---------------------------------
// 2. Vendor Entity Type (UI-Focused)
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

  // Relationships (IDs only for UI linking)
  asset_ids: string[];
  contract_ids: string[];
  business_service_ids: string[];
  account_manager_user_id?: string;

  // Contact Info (display only)
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

  // Backend-provided calculated fields
  annual_spend?: number;
  currency?: string;
  payment_terms?: string;
  discount_percentage?: number;
  risk_score?: number;
  compliance_certifications?: string[];
  security_clearance?: string;
  sla_compliance_percentage?: number;
  response_time_hours?: number;
  resolution_time_hours?: number;
  incident_count?: number;
  last_incident_date?: string;
  contract_renewal_date?: string;
  vendor_status?: "active" | "inactive" | "under_review" | "terminated";

  // UI Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "synced" | "syncing" | "error" | "conflict";
  tenantId?: string;
}

// ---------------------------------
// 3. Frontend Context Interface
// ---------------------------------
interface VendorsContextType {
  // Core async state
  vendors: AsyncState<Vendor[]>;
  
  // Basic CRUD (API orchestration only)
  createVendor: (vendor: Omit<Vendor, 'id' | 'created_at' | 'updated_at'>, userId?: string) => Promise<void>;
  updateVendor: (vendor: Vendor, userId?: string) => Promise<void>;
  deleteVendor: (id: string, userId?: string) => Promise<void>;
  refreshVendors: () => Promise<void>;
  getVendor: (id: string) => Promise<Vendor | undefined>;
  
  // Simple API operations (delegate all logic to backend)
  updateVendorPerformance: (vendorId: string, performanceData: any, userId?: string) => Promise<void>;
  addEscalationContact: (vendorId: string, contact: any, userId?: string) => Promise<void>;
  removeEscalationContact: (vendorId: string, contactIndex: number, userId?: string) => Promise<void>;
  renewVendorContract: (vendorId: string, renewalData: any, userId?: string) => Promise<void>;
  updateVendorRiskScore: (vendorId: string, riskScore: number, reason: string, userId?: string) => Promise<void>;
  
  // Client-side UI helpers only (not business logic)
  getVendorsByTier: (tier: string) => Vendor[];
  getVendorsByRegion: (region: string) => Vendor[];
  getVendorsByStatus: (status: string) => Vendor[];
  searchVendors: (query: string) => Vendor[];
  
  // UI configuration from backend
  config: AsyncState<{
    tiers: string[];
    regions: string[];
    industries: string[];
    currencies: string[];
    compliance_certifications: string[];
    vendor_statuses: string[];
  }>;
  
  // Cache management
  clearCache: () => void;
  isDataStale: boolean;
}

const VendorsContext = createContext<VendorsContextType | undefined>(undefined);

// ---------------------------------
// 4. Frontend Provider
// ---------------------------------
export const VendorsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();

  // AsyncState for vendors
  const [vendors, setVendors] = useState<AsyncState<Vendor[]>>({
    data: null,
    isLoading: false,
    error: null,
    lastFetch: null,
    isStale: false,
  });

  // AsyncState for vendor-specific config
  const [config, setConfig] = useState<AsyncState<VendorsContextType['config']['data']>>({
    data: null,
    isLoading: false,
    error: null,
    lastFetch: null,
    isStale: false,
  });

  // Cache TTL (5 minutes for UI performance)
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const cacheTimerRef = useRef<NodeJS.Timeout>();

  // Extract vendor-specific config from global config
  const vendorConfig = useMemo(() => {
    if (!globalConfig) return null;

    return {
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
      vendor_statuses: globalConfig?.business?.vendors?.statuses || 
                       ['active', 'inactive', 'under_review', 'terminated'],
    };
  }, [globalConfig]);

  // Update config state when globalConfig changes
  useEffect(() => {
    if (vendorConfig) {
      setConfig(prev => ({
        ...prev,
        data: vendorConfig,
        lastFetch: new Date().toISOString(),
        error: null,
      }));
    }
  }, [vendorConfig]);

  // Basic UI validation (not business logic)
  const validateForUI = useCallback((vendor: Partial<Vendor>) => {
    if (!vendor.name || vendor.name.trim().length < 2) {
      throw new Error("Vendor name must be at least 2 characters long");
    }
    if (vendor.primary_contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vendor.primary_contact_email)) {
      throw new Error("Invalid email format");
    }
  }, []);

  // Ensure UI metadata (not business logic)
  const ensureUIMetadata = useCallback((vendor: Partial<Vendor>): Vendor => {
    const now = new Date().toISOString();
    return {
      id: vendor.id || crypto.randomUUID(),
      name: vendor.name || '',
      tier: vendor.tier || 'approved',
      created_at: vendor.created_at || now,
      updated_at: now,
      tenantId,
      tags: vendor.tags || [],
      health_status: vendor.health_status || "gray",
      sync_status: vendor.sync_status || "syncing",
      synced_at: vendor.synced_at || now,
      asset_ids: vendor.asset_ids || [],
      contract_ids: vendor.contract_ids || [],
      business_service_ids: vendor.business_service_ids || [],
      escalation_contacts: vendor.escalation_contacts || [],
      compliance_certifications: vendor.compliance_certifications || [],
      vendor_status: vendor.vendor_status || "active",
      ...vendor,
    } as Vendor;
  }, [tenantId]);

  // Check if data is stale
  const isDataStale = useMemo(() => {
    if (!vendors.lastFetch) return true;
    const lastFetch = new Date(vendors.lastFetch);
    const now = new Date();
    return (now.getTime() - lastFetch.getTime()) > CACHE_TTL_MS;
  }, [vendors.lastFetch]);

  // Update stale status
  useEffect(() => {
    if (vendors.lastFetch && !vendors.isLoading) {
      const timer = setTimeout(() => {
        setVendors(prev => ({ ...prev, isStale: true }));
      }, CACHE_TTL_MS);

      return () => clearTimeout(timer);
    }
  }, [vendors.lastFetch, vendors.isLoading]);

  // Refresh vendors from API
  const refreshVendors = useCallback(async () => {
    if (!tenantId) {
      setVendors(prev => ({ ...prev, error: "No tenant selected" }));
      return;
    }
    
    setVendors(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const all = await getAll<Vendor>(tenantId, "vendors");
      
      // Simple UI sorting (not business logic)
      all.sort((a, b) => {
        // Health status priority for UI display
        const healthOrder = { red: 0, orange: 1, yellow: 2, green: 3, gray: 4 };
        const aHealth = healthOrder[a.health_status] ?? 4;
        const bHealth = healthOrder[b.health_status] ?? 4;
        if (aHealth !== bHealth) return aHealth - bHealth;
        
        // Alphabetical by name
        return a.name.localeCompare(b.name);
      });
      
      setVendors({
        data: all,
        isLoading: false,
        error: null,
        lastFetch: new Date().toISOString(),
        isStale: false,
      });
    } catch (error) {
      setVendors(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load vendors',
        isStale: true,
      }));
    }
  }, [tenantId]);

  // Get single vendor (with caching)
  const getVendor = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    
    // Try cache first
    const cached = vendors.data?.find(v => v.id === id);
    if (cached && !isDataStale) return cached;
    
    // Fetch from API
    return getById<Vendor>(tenantId, "vendors", id);
  }, [tenantId, vendors.data, isDataStale]);

  // Create vendor (API orchestration with optimistic updates)
  const createVendor = useCallback(async (
    vendorData: Omit<Vendor, 'id' | 'created_at' | 'updated_at'>, 
    userId?: string
  ) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateForUI(vendorData);
    const vendor = ensureUIMetadata(vendorData);

    // Optimistic UI update
    setVendors(prev => ({
      ...prev,
      data: prev.data ? [...prev.data, vendor] : [vendor],
    }));

    try {
      // Backend handles ALL validation, business rules, calculations
      await putWithAudit(
        tenantId,
        "vendors",
        vendor,
        userId,
        {
          action: "create",
          description: `Created vendor: ${vendor.name}`,
          tags: ["vendor", "create", vendor.tier],
          metadata: { tier: vendor.tier, region: vendor.region },
        }
      );

      await enqueueItem({
        storeName: "vendors",
        entityId: vendor.id,
        action: "create",
        payload: vendor,
        priority: vendor.tier === 'strategic' ? 'high' : 'normal',
      });

      // Refresh to get backend-calculated fields
      await refreshVendors();
    } catch (error) {
      // Rollback optimistic update
      setVendors(prev => ({
        ...prev,
        data: prev.data?.filter(v => v.id !== vendor.id) || null,
        error: error instanceof Error ? error.message : 'Failed to create vendor',
      }));
      throw error;
    }
  }, [tenantId, validateForUI, ensureUIMetadata, enqueueItem, refreshVendors]);

  // Update vendor (API orchestration with optimistic updates)
  const updateVendor = useCallback(async (vendor: Vendor, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateForUI(vendor);
    const enriched = ensureUIMetadata(vendor);

    // Optimistic UI update
    setVendors(prev => ({
      ...prev,
      data: prev.data?.map(v => v.id === vendor.id ? enriched : v) || null,
    }));

    try {
      // Backend handles ALL business logic
      await putWithAudit(
        tenantId,
        "vendors",
        enriched,
        userId,
        {
          action: "update",
          description: `Updated vendor: ${vendor.name}`,
          tags: ["vendor", "update"],
          metadata: { tier: vendor.tier },
        }
      );

      await enqueueItem({
        storeName: "vendors",
        entityId: enriched.id,
        action: "update",
        payload: enriched,
      });

      // Refresh to get backend-calculated fields
      await refreshVendors();
    } catch (error) {
      // Rollback optimistic update & refresh to restore correct state
      await refreshVendors();
      setVendors(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to update vendor',
      }));
      throw error;
    }
  }, [tenantId, validateForUI, ensureUIMetadata, enqueueItem, refreshVendors]);

  // Delete vendor (API orchestration with optimistic updates)
  const deleteVendor = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    const vendor = vendors.data?.find(v => v.id === id);
    if (!vendor) throw new Error(`Vendor ${id} not found`);

    // Optimistic UI update
    setVendors(prev => ({
      ...prev,
      data: prev.data?.filter(v => v.id !== id) || null,
    }));

    try {
      // Backend handles ALL business logic and constraints
      await removeWithAudit(
        tenantId,
        "vendors",
        id,
        userId,
        {
          action: "delete",
          description: `Deleted vendor: ${vendor.name}`,
          tags: ["vendor", "delete"],
          metadata: { tier: vendor.tier },
        }
      );

      await enqueueItem({
        storeName: "vendors",
        entityId: id,
        action: "delete",
        payload: null,
      });
    } catch (error) {
      // Rollback optimistic update
      setVendors(prev => ({
        ...prev,
        data: prev.data ? [...prev.data, vendor] : [vendor],
        error: error instanceof Error ? error.message : 'Failed to delete vendor',
      }));
      throw error;
    }
  }, [tenantId, vendors.data, enqueueItem]);

  // Simple API operations (delegate ALL logic to backend)
  const updateVendorPerformance = useCallback(async (vendorId: string, performanceData: any, userId?: string) => {
    const vendor = await getVendor(vendorId);
    if (!vendor) throw new Error(`Vendor ${vendorId} not found`);

    // Backend API handles all performance calculations and business logic
    await fetch(`/api/vendors/${vendorId}/performance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...performanceData, userId }),
    });

    await refreshVendors(); // Get updated calculated metrics from backend
  }, [getVendor, refreshVendors]);

  const addEscalationContact = useCallback(async (vendorId: string, contact: any, userId?: string) => {
    // Backend API handles all business logic
    await fetch(`/api/vendors/${vendorId}/escalation-contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact, userId }),
    });
    
    await refreshVendors();
  }, [refreshVendors]);

  const removeEscalationContact = useCallback(async (vendorId: string, contactIndex: number, userId?: string) => {
    // Backend API handles all business logic
    await fetch(`/api/vendors/${vendorId}/escalation-contacts/${contactIndex}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    
    await refreshVendors();
  }, [refreshVendors]);

  const renewVendorContract = useCallback(async (vendorId: string, renewalData: any, userId?: string) => {
    // Backend API handles all business logic and validations
    await fetch(`/api/vendors/${vendorId}/renew-contract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...renewalData, userId }),
    });
    
    await refreshVendors();
  }, [refreshVendors]);

  const updateVendorRiskScore = useCallback(async (vendorId: string, riskScore: number, reason: string, userId?: string) => {
    // Backend API handles all risk calculations and business logic
    await fetch(`/api/vendors/${vendorId}/risk-score`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ riskScore, reason, userId }),
    });
    
    await refreshVendors();
  }, [refreshVendors]);

  // Client-side UI filtering only (not business logic)
  const getVendorsByTier = useCallback((tier: string) => {
    return vendors.data?.filter(v => v.tier === tier) || [];
  }, [vendors.data]);

  const getVendorsByRegion = useCallback((region: string) => {
    return vendors.data?.filter(v => v.region === region) || [];
  }, [vendors.data]);

  const getVendorsByStatus = useCallback((status: string) => {
    return vendors.data?.filter(v => v.vendor_status === status) || [];
  }, [vendors.data]);

  const searchVendors = useCallback((query: string) => {
    if (!query.trim() || !vendors.data) return [];
    
    const lowerQuery = query.toLowerCase();
    return vendors.data.filter(v => 
      v.name.toLowerCase().includes(lowerQuery) ||
      v.description?.toLowerCase().includes(lowerQuery) ||
      v.industry?.toLowerCase().includes(lowerQuery) ||
      v.tier.toLowerCase().includes(lowerQuery) ||
      v.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }, [vendors.data]);

  // Cache management
  const clearCache = useCallback(() => {
    setVendors(prev => ({
      ...prev,
      data: null,
      lastFetch: null,
      isStale: true,
    }));
  }, []);

  // Initialize when tenant changes
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshVendors();
    } else {
      setVendors({
        data: null,
        isLoading: false,
        error: null,
        lastFetch: null,
        isStale: false,
      });
    }
  }, [tenantId, globalConfig, refreshVendors]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (cacheTimerRef.current) {
        clearTimeout(cacheTimerRef.current);
      }
    };
  }, []);

  return (
    <VendorsContext.Provider
      value={{
        vendors,
        createVendor,
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
        getVendorsByStatus,
        searchVendors,
        config,
        clearCache,
        isDataStale,
      }}
    >
      {children}
    </VendorsContext.Provider>
  );
};

// ---------------------------------
// 5. Hooks
// ---------------------------------
export const useVendors = () => {
  const ctx = useContext(VendorsContext);
  if (!ctx) throw new Error("useVendors must be used within VendorsProvider");
  return ctx;
};

export const useVendorDetails = (id: string) => {
  const { vendors } = useVendors();
  return vendors.data?.find((v) => v.id === id) || null;
};

// Selective subscription hooks for performance
export const useVendorsByTier = (tier: string) => {
  const { getVendorsByTier } = useVendors();
  return useMemo(() => getVendorsByTier(tier), [getVendorsByTier, tier]);
};

export const useVendorsByRegion = (region: string) => {
  const { getVendorsByRegion } = useVendors();
  return useMemo(() => getVendorsByRegion(region), [getVendorsByRegion, region]);
};

export const useVendorsByStatus = (status: string) => {
  const { getVendorsByStatus } = useVendors();
  return useMemo(() => getVendorsByStatus(status), [getVendorsByStatus, status]);
};

export const useVendorSearch = (query: string) => {
  const { searchVendors } = useVendors();
  return useMemo(() => searchVendors(query), [searchVendors, query]);
};