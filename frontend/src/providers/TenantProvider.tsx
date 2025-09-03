// src/providers/TenantProvider.tsx - SIMPLIFIED without loadConfig dependency
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

interface TenantContextType {
  tenantId: string | null;
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
    syncQueueSize: number;
    error?: string;
  }>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

// ---------------------------------
// Provider - SIMPLIFIED
// ---------------------------------
export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const [tenantId, setTenantId] = useState<string | null>(
    localStorage.getItem("tenantId")
  );
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize tenant when tenantId changes
  useEffect(() => {
    if (!tenantId) {
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
      
      // 2. Verify tenant health  
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

  const setTenant = useCallback(async (newTenantId: string) => {
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
  }, [tenantId]);

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
      
      // Refresh tenant to verify health
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
        syncQueueSize: 0,
        error: "No tenant selected"
      };
    }
    
    try {
      // Check database health
      const dbHealth = await healthCheck(tenantId);
      
      // Check sync queue stats
      const queueStats = await getQueueStats(tenantId);
      
      return {
        healthy: dbHealth.healthy,
        dbHealth: dbHealth.healthy,
        syncQueueSize: queueStats.total,
        error: dbHealth.error || error || undefined
      };
    } catch (err) {
      return {
        healthy: false,
        dbHealth: false,
        syncQueueSize: 0,
        error: err instanceof Error ? err.message : 'Health check failed'
      };
    }
  }, [tenantId, error]);

  return (
    <TenantContext.Provider
      value={{
        tenantId,
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

export const useIsInitialized = () => {
  const { isInitialized, isLoading, error } = useTenant();
  return { isInitialized, isLoading, error };
};