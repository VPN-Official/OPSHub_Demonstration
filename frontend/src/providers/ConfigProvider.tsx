// src/providers/ConfigProvider.tsx - SIMPLIFIED without loadConfig.ts
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

// ---------------------------------
// Provider - SIMPLIFIED  
// ---------------------------------
export const ConfigProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  
  const [config, setConfig] = useState<AIOpsConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Load config when tenant changes
  useEffect(() => {
    if (tenantId) {
      loadConfigForTenant(tenantId);
    } else {
      // Clear config when no tenant selected
      setConfig(null);
      setError(null);
      setLastUpdated(null);
    }
  }, [tenantId]);

  // INLINE config loading - no separate file needed
  const loadConfigForTenant = useCallback(async (tenantId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`Loading config for tenant: ${tenantId}`);
      
      // Use default config directly - no complex loading needed for MVP
      const baseConfig = defaultConfigData as AIOpsConfig;
      
      // Validate basic structure
      if (!baseConfig.statuses || !baseConfig.priorities) {
        throw new Error('Invalid configuration structure');
      }
      
      setConfig(baseConfig);
      setLastUpdated(new Date().toISOString());
      
      console.log("Config loaded successfully:", {
        tenant: tenantId,
        sections: Object.keys(baseConfig),
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load configuration';
      console.error(`Config loading error for tenant ${tenantId}:`, errorMessage);
      setError(errorMessage);
      setConfig(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshConfig = useCallback(async () => {
    if (!tenantId) {
      console.warn("Cannot refresh config: no tenant selected");
      return;
    }
    await loadConfigForTenant(tenantId);
  }, [tenantId, loadConfigForTenant]);

  // Validation helper
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

  // Get enum options
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

  // Get enum label
  const getEnumLabel = useCallback((section: ConfigSection, value: string): string | null => {
    if (!config || !value) return null;
    
    const sectionData = config[section];
    if (!sectionData) return null;
    
    if (Array.isArray(sectionData)) {
      return sectionData.includes(value) ? value : null;
    } else if (typeof sectionData === 'object') {
      const item = sectionData[value];
      if (!item) return null;
      
      // Check if it's an object with a label property
      if (typeof item === 'object' && 'label' in item) {
        return item.label;
      }
      
      return value;
    }
    
    return null;
  }, [config]);

  // Get enum color
  const getEnumColor = useCallback((section: ConfigSection, value: string): string | null => {
    if (!config || !value) return null;
    
    const sectionData = config[section];
    if (!sectionData || typeof sectionData !== 'object' || Array.isArray(sectionData)) {
      return null;
    }
    
    const item = sectionData[value];
    if (typeof item === 'object' && 'color' in item) {
      return item.color;
    }
    
    return null;
  }, [config]);

  // Get SLA target
  const getSLATarget = useCallback((entityType: string, priority: string): number | null => {
    if (!config?.priorities || !priority) return null;
    
    const priorityConfig = config.priorities[priority];
    if (typeof priorityConfig === 'object' && 'sla_minutes' in priorityConfig) {
      return priorityConfig.sla_minutes;
    }
    
    return null;
  }, [config]);

  // Convenience getters
  const statuses = config?.statuses || null;
  const priorities = config?.priorities || null;
  const severities = config?.severities || null;
  const tiers = config?.tiers || null;
  const slas = config?.slas || null;
  const kpis = config?.kpis || null;

  return (
    <ConfigContext.Provider
      value={{
        config,
        isLoading,
        error,
        lastUpdated,
        statuses,
        priorities,
        severities,
        tiers,
        slas,
        kpis,
        refreshConfig,
        validateEnum,
        getEnumOptions,
        getEnumLabel,
        getEnumColor,
        getSLATarget,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
};

// ---------------------------------
// Hooks
// ---------------------------------
export const useConfig = () => {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error("useConfig must be used within ConfigProvider");
  }
  return ctx;
};

// Convenience hooks
export const useStatuses = () => {
  const { statuses } = useConfig();
  return statuses;
};

export const usePriorities = () => {
  const { priorities } = useConfig();
  return priorities;
};