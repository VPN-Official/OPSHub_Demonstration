// src/providers/TenantProvider.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { getDB, resetDB, reseedDB, healthCheck, invalidateCache } from "../db/dbClient";
import { getQueueStats } from "../db/syncQueue";
import { loadConfig } from "../config/loadConfig";
import type { AIOpsConfig } from "../config/types";

interface TenantContextType {
  tenantId: string | null;
  config: AIOpsConfig | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Core operations
  setTenant: (tenantId: string) => Promise<void>;
  refreshTenant: () => Promise<void>;
  resetTenantData: () => Promise<void>;
  reseedTenantData: (mode?: 'minimal' | 'demo') => Promise<void>;
  
  // Health & monitoring
  getTenantHealth: () => Promise<{
    healthy: boolean;
    dbHealth: boolean;
    configLoaded: boolean;
    syncQueueSize: number;
    error?: string;
  }>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

// ---------------------------------
// Provider
// ---------------------------------
export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const [tenantId, setTenantId] = useState<string | null>(
    localStorage.getItem("tenantId")
  );
  const [config, setConfig] = useState<AIOpsConfig | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize tenant when tenantId changes
  useEffect(() => {
    if (!tenantId) {
      setConfig(null);
      setIsInitialized(false);
      setError(null);
      return;
    }

    initializeTenant(tenantId);
  }, [tenantId]);

  const initializeTenant = async (newTenantId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Initializing tenant: ${newTenantId}`);
      
      // 1. Initialize database connection
      await getDB(newTenantId);
      
      // 2. Load tenant configuration
      const tenantConfig = await loadConfig(newTenantId);
      setConfig(tenantConfig);
      
      // 3. Verify tenant health
      const health = await healthCheck(newTenantId);
      if (!health.healthy) {
        throw new Error(`Tenant ${newTenantId} health check failed: ${health.error}`);
      }
      
      setIsInitialized(true);
      console.log(`Tenant ${newTenantId} initialized successfully`);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error during tenant initialization';
      console.error(`Failed to initialize tenant ${newTenantId}:`, errorMessage);
      setError(errorMessage);
      setIsInitialized(false);
    } finally {
      setIsLoading(false);
    }
  };

  const setTenant = async (newTenantId: string) => {
    if (!newTenantId) {
      throw new Error("Tenant ID is required");
    }
    
    if (newTenantId === tenantId) {
      console.log("Same tenant selected, skipping switch");
      return;
    }
    
    console.log(`Switching from tenant ${tenantId} to ${newTenantId}`);
    
    // Clear previous tenant cache
    if (tenantId) {
      invalidateCache(tenantId);
    }
    
    // Update localStorage and state
    localStorage.setItem("tenantId", newTenantId);
    setTenantId(newTenantId);
    // initializeTenant will be called via useEffect
  };

  const refreshTenant = useCallback(async () => {
    if (!tenantId) {
      throw new Error("No tenant selected");
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Invalidate cache and re-initialize
      invalidateCache(tenantId);
      await initializeTenant(tenantId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh tenant';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  const resetTenantData = useCallback(async () => {
    if (!tenantId) {
      throw new Error("No tenant selected");
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Resetting data for tenant: ${tenantId}`);
      await resetDB(tenantId);
      
      // Invalidate cache and re-initialize
      invalidateCache(tenantId);
      await initializeTenant(tenantId);
      
      console.log(`Tenant ${tenantId} data reset completed`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset tenant data';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  const reseedTenantData = useCallback(async (mode: 'minimal' | 'demo' = 'demo') => {
    if (!tenantId) {
      throw new Error("No tenant selected");
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Reseeding tenant ${tenantId} with ${mode} data`);
      await reseedDB(tenantId, mode);
      
      // Refresh tenant to reload config and verify health
      await refreshTenant();
      
      console.log(`Tenant ${tenantId} reseed completed`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reseed tenant data';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, refreshTenant]);

  const getTenantHealth = useCallback(async () => {
    if (!tenantId) {
      return {
        healthy: false,
        dbHealth: false,
        configLoaded: false,
        syncQueueSize: 0,
        error: "No tenant selected"
      };
    }
    
    try {
      // Check database health
      const dbHealth = await healthCheck(tenantId);
      
      // Check sync queue stats
      const queueStats = await getQueueStats(tenantId);
      
      // Overall health assessment
      const healthy = dbHealth.healthy && config !== null;
      
      return {
        healthy,
        dbHealth: dbHealth.healthy,
        configLoaded: config !== null,
        syncQueueSize: queueStats.total,
        error: dbHealth.error || error || undefined
      };
    } catch (err) {
      return {
        healthy: false,
        dbHealth: false,
        configLoaded: false,
        syncQueueSize: 0,
        error: err instanceof Error ? err.message : 'Health check failed'
      };
    }
  }, [tenantId, config, error]);

  return (
    <TenantContext.Provider
      value={{
        tenantId,
        config,
        isInitialized,
        isLoading,
        error,
        setTenant,
        refreshTenant,
        resetTenantData,
        reseedTenantData,
        getTenantHealth,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

// ---------------------------------
// Hook
// ---------------------------------
export const useTenant = () => {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error("useTenant must be used within TenantProvider");
  }
  return ctx;
};

// Additional utility hooks
export const useTenantId = () => {
  const { tenantId } = useTenant();
  return tenantId;
};

export const useTenantConfig = () => {
  const { config } = useTenant();
  return config;
};

export const useIsInitialized = () => {
  const { isInitialized, isLoading, error } = useTenant();
  return { isInitialized, isLoading, error };
};