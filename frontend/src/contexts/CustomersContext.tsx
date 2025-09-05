// src/contexts/CustomersContext.tsx (ENTERPRISE FRONTEND ONLY)
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { getAll, getById, putWithAudit, removeWithAudit } from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";

// ---------------------------------
// 1. Frontend UI State Types
// ---------------------------------

/**
 * Async state wrapper for UI state management
 * Provides loading states, error states, and data staleness for optimal UX
 */
export interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  lastFetch: string | null;
  stale: boolean;
}

/**
 * UI-focused filters for client-side responsiveness
 * Complex business filtering is handled by backend APIs
 */
export interface CustomerUIFilters {
  tier?: string;
  region?: string;
  industry?: string;
  healthStatus?: "green" | "yellow" | "orange" | "red" | "gray";
  churnRisk?: "low" | "medium" | "high" | "critical";
  hasContacts?: boolean;
  hasSLABreach?: boolean;
  searchQuery?: string;
}

/**
 * Optimistic update state for better UX during API calls
 */
export interface OptimisticUpdate {
  entityId: string;
  operation: "create" | "update" | "delete";
  data: any;
  timestamp: string;
}

/**
 * Core customer entity - only UI metadata, business logic in backend
 */
export interface CustomerContact {
  id: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  is_primary: boolean;
  is_technical: boolean;
  is_billing: boolean;
  notification_preferences?: {
    incidents: boolean;
    maintenance: boolean;
    billing: boolean;
    marketing: boolean;
  };
}

export interface Customer {
  id: string;
  name: string;
  description?: string;
  industry?: string;
  region?: string;
  tier: string;
  created_at: string;
  updated_at: string;

  // Relationship IDs (frontend doesn't manage relationships, just displays)
  end_user_ids: string[];
  business_service_ids: string[];
  contract_ids: string[];
  account_manager_user_id?: string;
  customer_success_manager_id?: string;
  technical_account_manager_id?: string;

  // Contact Management
  contacts: CustomerContact[];
  primary_contact_id?: string;
  billing_contact_id?: string;
  technical_contact_id?: string;

  // Business metrics (provided by backend, displayed by frontend)
  annual_contract_value?: number;
  monthly_recurring_revenue?: number;
  currency?: string;
  payment_terms?: string;
  billing_frequency?: "monthly" | "quarterly" | "annually";

  // Health metrics (calculated by backend)
  health_score?: number;
  satisfaction_score?: number;
  net_promoter_score?: number;
  churn_risk?: "low" | "medium" | "high" | "critical";
  renewal_probability?: number;

  // Support metrics (provided by backend)
  current_sla_compliance?: number;
  sla_breach_count_30d?: number;
  ticket_count_30d?: number;
  average_resolution_time_hours?: number;
  escalation_count_30d?: number;

  // UI metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
  tenantId?: string;
}

// ---------------------------------
// 2. Frontend Context Interface
// ---------------------------------
interface CustomersContextType {
  // Core async state
  customers: AsyncState<Customer[]>;
  
  // CRUD Operations (thin API wrappers)
  addCustomer: (customer: Customer, userId?: string) => Promise<void>;
  updateCustomer: (customer: Customer, userId?: string) => Promise<void>;
  deleteCustomer: (id: string, userId?: string) => Promise<void>;
  refreshCustomers: () => Promise<void>;
  getCustomer: (id: string) => Promise<Customer | undefined>;

  // Customer-specific API operations
  updateCustomerHealth: (customerId: string, userId?: string) => Promise<void>;
  addCustomerContact: (customerId: string, contact: CustomerContact, userId?: string) => Promise<void>;
  updateCustomerContact: (customerId: string, contactId: string, updates: Partial<CustomerContact>, userId?: string) => Promise<void>;
  removeCustomerContact: (customerId: string, contactId: string, userId?: string) => Promise<void>;
  recordCustomerInteraction: (customerId: string, interaction: { type: string; notes: string }, userId?: string) => Promise<void>;

  // Client-side UI helpers (for immediate responsiveness)
  getFilteredCustomers: (filters: CustomerUIFilters) => Customer[];
  searchCustomers: (query: string) => Customer[];
  sortCustomers: (customers: Customer[], sortBy: string, sortOrder: 'asc' | 'desc') => Customer[];

  // Optimistic updates for better UX
  optimisticUpdates: OptimisticUpdate[];
  
  // UI configuration from backend
  config: {
    tiers: string[];
    industries: string[];
    regions: string[];
    currencies: string[];
    payment_terms: string[];
    health_statuses: string[];
    churn_risk_levels: string[];
  };

  // Cache management
  clearCache: () => void;
  refreshCache: () => Promise<void>;
  isCacheStale: boolean;
}

const CustomersContext = createContext<CustomersContextType | undefined>(undefined);

// ---------------------------------
// 3. Enterprise Provider
// ---------------------------------
export const CustomersProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig } = useConfig();
  
  // Async state for customers
  const [customers, setCustomers] = useState<AsyncState<Customer[]>>({
    data: [],
    loading: false,
    error: null,
    lastFetch: null,
    stale: true
  });
  
  // Optimistic updates state
  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticUpdate[]>([]);
  
  // Cache configuration
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  
  // Extract customer config from global config
  const config = useMemo(() => ({
    tiers: globalConfig?.business?.customers?.tiers || 
           ['enterprise', 'premium', 'standard', 'starter'],
    industries: globalConfig?.business?.customers?.industries || 
                ['technology', 'financial_services', 'healthcare', 'manufacturing'],
    regions: globalConfig?.business?.customers?.regions || 
             ['north_america', 'europe', 'asia_pacific', 'latin_america'],
    currencies: globalConfig?.business?.customers?.currencies || 
                ['USD', 'EUR', 'GBP', 'JPY'],
    payment_terms: ['net_15', 'net_30', 'net_45', 'net_60'],
    health_statuses: ['green', 'yellow', 'orange', 'red', 'gray'],
    churn_risk_levels: ['low', 'medium', 'high', 'critical'],
  }), [globalConfig]);

  // Check if cache is stale
  const isCacheStale = useMemo(() => {
    if (!customers.lastFetch) return true;
    const lastFetch = new Date(customers.lastFetch).getTime();
    const now = Date.now();
    return now - lastFetch > CACHE_TTL_MS;
  }, [customers.lastFetch]);

  // Basic UI validation (NOT business rules)
  const validateCustomerForUI = useCallback((customer: Customer) => {
    const errors: string[] = [];
    
    if (!customer.name?.trim()) {
      errors.push("Customer name is required");
    }
    
    if (customer.contacts) {
      customer.contacts.forEach((contact, index) => {
        if (!contact.name?.trim()) {
          errors.push(`Contact ${index + 1} name is required`);
        }
        if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
          errors.push(`Contact ${index + 1} has invalid email format`);
        }
      });
    }
    
    if (errors.length > 0) {
      throw new Error(`UI Validation failed: ${errors.join(', ')}`);
    }
  }, []);

  // Error state management
  const setError = useCallback((error: string | Error | null) => {
    const errorMessage = error instanceof Error ? error.message : error;
    setCustomers(prev => ({ ...prev, error: errorMessage, loading: false }));
  }, []);

  // Loading state management
  const setLoading = useCallback((loading: boolean) => {
    setCustomers(prev => ({ ...prev, loading, error: loading ? null : prev.error }));
  }, []);

  // Optimistic update helpers
  const addOptimisticUpdate = useCallback((update: OptimisticUpdate) => {
    setOptimisticUpdates(prev => [...prev, update]);
  }, []);

  const removeOptimisticUpdate = useCallback((entityId: string) => {
    setOptimisticUpdates(prev => prev.filter(u => u.entityId !== entityId));
  }, []);

  const rollbackOptimisticUpdate = useCallback((entityId: string) => {
    removeOptimisticUpdate(entityId);
    // Refresh to get server state
    refreshCustomers();
  }, []);

  // Refresh customers from API
  const refreshCustomers = useCallback(async () => {
    if (!tenantId) return;
    
    setLoading(true);
    
    try {
      // API call - backend handles all business logic
      const data = await getAll<Customer>(tenantId, "customers");
      
      setCustomers({
        data,
        loading: false,
        error: null,
        lastFetch: new Date().toISOString(),
        stale: false
      });
    } catch (error) {
      console.error("Failed to refresh customers:", error);
      setError(error instanceof Error ? error.message : "Failed to load customers");
    }
  }, [tenantId, setLoading, setError]);

  // Get single customer
  const getCustomer = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    
    // Check local cache first
    const cached = customers.data.find(c => c.id === id);
    if (cached && !isCacheStale) {
      return cached;
    }
    
    try {
      return await getById<Customer>(tenantId, "customers", id);
    } catch (error) {
      console.error(`Failed to get customer ${id}:`, error);
      return undefined;
    }
  }, [tenantId, customers.data, isCacheStale]);

  // Add customer with optimistic updates
  const addCustomer = useCallback(async (customer: Customer, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    // Basic UI validation only
    validateCustomerForUI(customer);

    const now = new Date().toISOString();
    const customerWithMetadata = {
      ...customer,
      tenantId,
      created_at: now,
      updated_at: now,
      tags: customer.tags || [],
      end_user_ids: customer.end_user_ids || [],
      business_service_ids: customer.business_service_ids || [],
      contract_ids: customer.contract_ids || [],
      contacts: customer.contacts || [],
      health_status: customer.health_status || "gray" as const,
      sync_status: "dirty" as const,
    };

    // Optimistic update for immediate UI feedback
    addOptimisticUpdate({
      entityId: customer.id,
      operation: "create",
      data: customerWithMetadata,
      timestamp: now
    });

    // Update UI immediately
    setCustomers(prev => ({
      ...prev,
      data: [...prev.data, customerWithMetadata]
    }));

    try {
      // Backend handles ALL business logic and validation
      await putWithAudit(
        tenantId,
        "customers",
        customerWithMetadata,
        userId,
        {
          action: "create",
          description: `Created customer: ${customer.name}`,
          tags: ["customer", "create"],
        }
      );

      await enqueueItem({
        storeName: "customers",
        entityId: customer.id,
        action: "create",
        payload: customerWithMetadata,
      });

      removeOptimisticUpdate(customer.id);
      await refreshCustomers(); // Get authoritative server state
    } catch (error) {
      console.error("Failed to add customer:", error);
      rollbackOptimisticUpdate(customer.id);
      throw error;
    }
  }, [tenantId, validateCustomerForUI, addOptimisticUpdate, enqueueItem, removeOptimisticUpdate, refreshCustomers, rollbackOptimisticUpdate]);

  // Update customer with optimistic updates
  const updateCustomer = useCallback(async (customer: Customer, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateCustomerForUI(customer);

    const updatedCustomer = {
      ...customer,
      updated_at: new Date().toISOString(),
      sync_status: "dirty" as const,
    };

    // Optimistic update
    addOptimisticUpdate({
      entityId: customer.id,
      operation: "update",
      data: updatedCustomer,
      timestamp: new Date().toISOString()
    });

    setCustomers(prev => ({
      ...prev,
      data: prev.data.map(c => c.id === customer.id ? updatedCustomer : c)
    }));

    try {
      await putWithAudit(
        tenantId,
        "customers",
        updatedCustomer,
        userId,
        {
          action: "update",
          description: `Updated customer: ${customer.name}`,
          tags: ["customer", "update"],
        }
      );

      await enqueueItem({
        storeName: "customers",
        entityId: customer.id,
        action: "update",
        payload: updatedCustomer,
      });

      removeOptimisticUpdate(customer.id);
      await refreshCustomers();
    } catch (error) {
      console.error("Failed to update customer:", error);
      rollbackOptimisticUpdate(customer.id);
      throw error;
    }
  }, [tenantId, validateCustomerForUI, addOptimisticUpdate, enqueueItem, removeOptimisticUpdate, refreshCustomers, rollbackOptimisticUpdate]);

  // Delete customer
  const deleteCustomer = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    const customer = customers.data.find(c => c.id === id);
    if (!customer) throw new Error(`Customer ${id} not found`);

    // Optimistic update
    addOptimisticUpdate({
      entityId: id,
      operation: "delete",
      data: null,
      timestamp: new Date().toISOString()
    });

    setCustomers(prev => ({
      ...prev,
      data: prev.data.filter(c => c.id !== id)
    }));

    try {
      await removeWithAudit(
        tenantId,
        "customers",
        id,
        userId,
        {
          action: "delete",
          description: `Deleted customer: ${customer.name}`,
          tags: ["customer", "delete"],
        }
      );

      await enqueueItem({
        storeName: "customers",
        entityId: id,
        action: "delete",
        payload: null,
      });

      removeOptimisticUpdate(id);
    } catch (error) {
      console.error("Failed to delete customer:", error);
      rollbackOptimisticUpdate(id);
      throw error;
    }
  }, [tenantId, customers.data, addOptimisticUpdate, enqueueItem, removeOptimisticUpdate, rollbackOptimisticUpdate]);

  // Customer-specific operations (API wrappers)
  const updateCustomerHealth = useCallback(async (customerId: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    try {
      // Backend calculates health metrics
      const response = await fetch(`/api/customers/${customerId}/health`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${userId}` }
      });
      
      if (!response.ok) throw new Error('Failed to update customer health');
      
      await refreshCustomers(); // Get updated data
    } catch (error) {
      console.error("Failed to update customer health:", error);
      throw error;
    }
  }, [tenantId, refreshCustomers]);

  const addCustomerContact = useCallback(async (customerId: string, contact: CustomerContact, userId?: string) => {
    const customer = customers.data.find(c => c.id === customerId);
    if (!customer) throw new Error(`Customer ${customerId} not found`);

    const updatedCustomer = {
      ...customer,
      contacts: [...customer.contacts, { ...contact, id: contact.id || crypto.randomUUID() }]
    };

    await updateCustomer(updatedCustomer, userId);
  }, [customers.data, updateCustomer]);

  const updateCustomerContact = useCallback(async (customerId: string, contactId: string, updates: Partial<CustomerContact>, userId?: string) => {
    const customer = customers.data.find(c => c.id === customerId);
    if (!customer) throw new Error(`Customer ${customerId} not found`);

    const updatedCustomer = {
      ...customer,
      contacts: customer.contacts.map(contact =>
        contact.id === contactId ? { ...contact, ...updates } : contact
      )
    };

    await updateCustomer(updatedCustomer, userId);
  }, [customers.data, updateCustomer]);

  const removeCustomerContact = useCallback(async (customerId: string, contactId: string, userId?: string) => {
    const customer = customers.data.find(c => c.id === customerId);
    if (!customer) throw new Error(`Customer ${customerId} not found`);

    const updatedCustomer = {
      ...customer,
      contacts: customer.contacts.filter(contact => contact.id !== contactId)
    };

    await updateCustomer(updatedCustomer, userId);
  }, [customers.data, updateCustomer]);

  const recordCustomerInteraction = useCallback(async (customerId: string, interaction: { type: string; notes: string }, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");
    
    try {
      // Backend handles interaction recording logic
      const response = await fetch(`/api/customers/${customerId}/interactions`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userId}`
        },
        body: JSON.stringify(interaction)
      });
      
      if (!response.ok) throw new Error('Failed to record interaction');
      
      await refreshCustomers(); // Get updated data
    } catch (error) {
      console.error("Failed to record customer interaction:", error);
      throw error;
    }
  }, [tenantId, refreshCustomers]);

  // Client-side UI helpers for immediate responsiveness
  const getFilteredCustomers = useCallback((filters: CustomerUIFilters) => {
    let filtered = customers.data;

    if (filters.tier) {
      filtered = filtered.filter(c => c.tier === filters.tier);
    }
    if (filters.region) {
      filtered = filtered.filter(c => c.region === filters.region);
    }
    if (filters.industry) {
      filtered = filtered.filter(c => c.industry === filters.industry);
    }
    if (filters.healthStatus) {
      filtered = filtered.filter(c => c.health_status === filters.healthStatus);
    }
    if (filters.churnRisk) {
      filtered = filtered.filter(c => c.churn_risk === filters.churnRisk);
    }
    if (filters.hasContacts !== undefined) {
      filtered = filtered.filter(c => 
        filters.hasContacts ? c.contacts.length > 0 : c.contacts.length === 0
      );
    }
    if (filters.hasSLABreach) {
      filtered = filtered.filter(c => 
        c.sla_breach_count_30d && c.sla_breach_count_30d > 0
      );
    }
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query) ||
        c.contacts.some(contact => 
          contact.name.toLowerCase().includes(query) ||
          contact.email?.toLowerCase().includes(query)
        )
      );
    }

    return filtered;
  }, [customers.data]);

  const searchCustomers = useCallback((query: string) => {
    return getFilteredCustomers({ searchQuery: query });
  }, [getFilteredCustomers]);

  const sortCustomers = useCallback((customersList: Customer[], sortBy: string, sortOrder: 'asc' | 'desc') => {
    return [...customersList].sort((a, b) => {
      let aVal: any = a[sortBy as keyof Customer];
      let bVal: any = b[sortBy as keyof Customer];
      
      // Handle undefined values
      if (aVal === undefined) aVal = '';
      if (bVal === undefined) bVal = '';
      
      // Handle different types
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      // Default string comparison
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortOrder === 'asc' 
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, []);

  // Cache management
  const clearCache = useCallback(() => {
    setCustomers({
      data: [],
      loading: false,
      error: null,
      lastFetch: null,
      stale: true
    });
    setOptimisticUpdates([]);
  }, []);

  const refreshCache = useCallback(async () => {
    await refreshCustomers();
  }, [refreshCustomers]);

  // Initialize when tenant is ready
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshCustomers();
    }
  }, [tenantId, globalConfig, refreshCustomers]);

  // Auto-refresh stale data
  useEffect(() => {
    if (isCacheStale && !customers.loading) {
      refreshCustomers();
    }
  }, [isCacheStale, customers.loading, refreshCustomers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearCache();
    };
  }, [clearCache]);

  const contextValue = useMemo(() => ({
    customers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    refreshCustomers,
    getCustomer,
    updateCustomerHealth,
    addCustomerContact,
    updateCustomerContact,
    removeCustomerContact,
    recordCustomerInteraction,
    getFilteredCustomers,
    searchCustomers,
    sortCustomers,
    optimisticUpdates,
    config,
    clearCache,
    refreshCache,
    isCacheStale,
  }), [
    customers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    refreshCustomers,
    getCustomer,
    updateCustomerHealth,
    addCustomerContact,
    updateCustomerContact,
    removeCustomerContact,
    recordCustomerInteraction,
    getFilteredCustomers,
    searchCustomers,
    sortCustomers,
    optimisticUpdates,
    config,
    clearCache,
    refreshCache,
    isCacheStale,
  ]);

  return (
    <CustomersContext.Provider value={contextValue}>
      {children}
    </CustomersContext.Provider>
  );
};

// ---------------------------------
// 4. Optimized Hooks
// ---------------------------------
export const useCustomers = () => {
  const ctx = useContext(CustomersContext);
  if (!ctx) throw new Error("useCustomers must be used within CustomersProvider");
  return ctx;
};

// Selective subscription hooks for performance
export const useCustomersData = () => {
  const { customers } = useCustomers();
  return customers;
};

export const useCustomerById = (id: string) => {
  const { customers } = useCustomers();
  return useMemo(() => 
    customers.data.find(c => c.id === id) || null,
    [customers.data, id]
  );
};

export const useCustomersByStatus = (healthStatus: string) => {
  const { customers } = useCustomers();
  return useMemo(() => 
    customers.data.filter(c => c.health_status === healthStatus),
    [customers.data, healthStatus]
  );
};

export const useCustomersByTier = (tier: string) => {
  const { customers } = useCustomers();
  return useMemo(() => 
    customers.data.filter(c => c.tier === tier),
    [customers.data, tier]
  );
};

export const useCustomersSearch = (query: string) => {
  const { searchCustomers } = useCustomers();
  return useMemo(() => 
    query ? searchCustomers(query) : [],
    [searchCustomers, query]
  );
};

// Performance hooks
export const useCustomersLoading = () => {
  const { customers } = useCustomers();
  return customers.loading;
};

export const useCustomersError = () => {
  const { customers } = useCustomers();
  return customers.error;
};

export const useCustomersStats = () => {
  const { customers } = useCustomers();
  return useMemo(() => ({
    total: customers.data.length,
    byTier: customers.data.reduce((acc, c) => {
      acc[c.tier] = (acc[c.tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byHealth: customers.data.reduce((acc, c) => {
      acc[c.health_status] = (acc[c.health_status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    loading: customers.loading,
    lastUpdated: customers.lastFetch,
  }), [customers]);
};