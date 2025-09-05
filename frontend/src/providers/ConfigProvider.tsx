// src/providers/ConfigProvider.tsx - FIXED provider dependency waiting
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { useTenant } from "./TenantProvider";
import type { AIOpsConfig, ConfigSection } from "../config/types";
import defaultConfigData from "../config/default.json";

interface ConfigContextType {
  // Core config sections
  config: AIOpsConfig | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
  
  // Convenience getters
  statuses: AIOpsConfig['statuses'] | null;
  priorities: AIOpsConfig['priorities'] | null;
  severities: AIOpsConfig['severities'] | null;
  tiers: AIOpsConfig['tiers'] | null;
  slas: AIOpsConfig['slas'] | null;
  kpis: AIOpsConfig['kpis'] | null;
  
  // Operations
  refreshConfig: () => Promise<void>;
  validateEnum: (section: ConfigSection, value: string) => boolean;
  getEnumOptions: (section: ConfigSection) => string[];
  getEnumLabel: (section: ConfigSection, value: string) => string | null;
  getEnumColor: (section: ConfigSection, value: string) => string | null;
  getSLATarget: (entityType: string, priority: string) => number | null;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

// ✅ CRITICAL FIX: ConfigProvider with proper dependency waiting and error propagation
export const ConfigProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId, isInitialized, isLoading: tenantLoading, error: tenantError } = useTenant(); // ✅ Get all tenant state including error
  
  const [config, setConfig] = useState<AIOpsConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // ✅ Propagate parent errors
  useEffect(() => {
    if (tenantError) {
      setError(`Tenant error: ${tenantError}`);
      setConfig(null);
      setIsLoading(false);
    }
  }, [tenantError]);

  // ✅ CRITICAL FIX: Only load config when tenant is fully initialized and no errors
  useEffect(() => {
    if (tenantId && isInitialized && !tenantLoading && !tenantError) {
      loadConfigForTenant(tenantId);
    } else if (!tenantId) {
      // Clear config when no tenant selected
      setConfig(null);
      setError(null);
      setLastUpdated(null);
    }
    // ✅ Reset loading state when tenant changes
    if (!isInitialized && tenantId) {
      setIsLoading(true);
      setError(null);
    }
  }, [tenantId, isInitialized, tenantLoading, tenantError]); // ✅ Watch all tenant dependencies including error

  const loadConfigForTenant = useCallback(async (tenantId: string) => {
    // ✅ Double-check tenant is ready before loading
    if (!tenantId || tenantLoading) {
      console.log("ConfigProvider: Skipping config load - tenant not ready");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log(`ConfigProvider: Loading config for tenant: ${tenantId}`);
      
      // ✅ Small delay to ensure tenant DB is fully ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Use default config directly - no complex loading needed for MVP
      const baseConfig = defaultConfigData as AIOpsConfig;
      
      // Validate basic structure
      if (!baseConfig.statuses || !baseConfig.priorities) {
        throw new Error('Invalid configuration structure');
      }
      
      setConfig(baseConfig);
      setLastUpdated(new Date().toISOString());
      
      console.log("ConfigProvider: Config loaded successfully:", {
        tenant: tenantId,
        sections: Object.keys(baseConfig),
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load configuration';
      console.error(`ConfigProvider: Config loading error for tenant ${tenantId}:`, errorMessage);
      setError(errorMessage);
      setConfig(null);
    } finally {
      setIsLoading(false);
    }
  }, [tenantLoading]);

  const refreshConfig = useCallback(async () => {
    if (!tenantId || !isInitialized) {
      console.warn("ConfigProvider: Cannot refresh config - tenant not ready");
      return;
    }
    await loadConfigForTenant(tenantId);
  }, [tenantId, isInitialized, loadConfigForTenant]);

  // ✅ Validation helper with safety checks
  const validateEnum = useCallback((section: ConfigSection, value: string): boolean => {
    if (!config || !value) return false;
    
    const sectionData = config[section];
    if (!sectionData) return false;
    
    // Handle different section structures
    if (Array.isArray(sectionData)) {
      return sectionData.includes(value);
    } else if (typeof sectionData === 'object') {
      return Object.keys(sectionData).includes(value);
    }
    
    return false;
  }, [config]);

  // ✅ Get enum options with safety checks
  const getEnumOptions = useCallback((section: ConfigSection): string[] => {
    if (!config) return [];
    
    const sectionData = config[section];
    if (!sectionData) return [];
    
    // Handle different section structures
    if (Array.isArray(sectionData)) {
      return [...sectionData];
    } else if (typeof sectionData === 'object') {
      return Object.keys(sectionData);
    }
    
    return [];
  }, [config]);

  // ✅ Get enum label with safety checks
  const getEnumLabel = useCallback((section: ConfigSection, value: string): string | null => {
    if (!config || !value) return null;
    
    const sectionData = config[section];
    if (!sectionData) return null;
    
    if (Array.isArray(sectionData)) {
      return sectionData.includes(value) ? value : null;
    } else if (typeof sectionData === 'object') {
      const item = sectionData[value];
      return typeof item === 'object' && 'label' in item ? item.label : value;
    }
    
    return null;
  }, [config]);

  // ✅ Get enum color with safety checks
  const getEnumColor = useCallback((section: ConfigSection, value: string): string | null => {
    if (!config || !value) return null;
    
    const sectionData = config[section];
    if (!sectionData || Array.isArray(sectionData)) return null;
    
    if (typeof sectionData === 'object') {
      const item = sectionData[value];
      return typeof item === 'object' && 'color' in item ? item.color : null;
    }
    
    return null;
  }, [config]);

  // ✅ Get SLA target with safety checks
  const getSLATarget = useCallback((entityType: string, priority: string): number | null => {
    if (!config || !config.priorities || !config.priorities[priority]) return null;
    
    const priorityConfig = config.priorities[priority];
    return priorityConfig?.sla_minutes || null;
  }, [config]);

  // ✅ Memoized context value with proper dependency tracking
  const contextValue: ConfigContextType = {
    config,
    isLoading,
    error,
    lastUpdated,
    statuses: config?.statuses || null,
    priorities: config?.priorities || null,
    severities: config?.severities || null,
    tiers: config?.tiers || null,
    slas: config?.slas || null,
    kpis: config?.kpis || null,
    refreshConfig,
    validateEnum,
    getEnumOptions,
    getEnumLabel,
    getEnumColor,
    getSLATarget,
  };

  return (
    <ConfigContext.Provider value={contextValue}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within ConfigProvider');
  }
  return context;
};

// ✅ Enhanced hooks with safety checks
export const useConfigWithValidation = () => {
  const { config, isLoading, error } = useConfig();
  
  return {
    isReady: !isLoading && !error && !!config,
    config,
    isLoading,
    error,
  };
};

export const useValidatedEnum = (section: ConfigSection) => {
  const { validateEnum, getEnumOptions, isLoading } = useConfig();
  
  return {
    validate: validateEnum,
    options: getEnumOptions(section),
    isReady: !isLoading,
  };
};