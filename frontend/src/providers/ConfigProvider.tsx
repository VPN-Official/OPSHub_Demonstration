// src/providers/ConfigProvider.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { useTenant } from "./TenantProvider";
import { loadConfig } from "../config/loadConfig";
import type { AIOpsConfig, ConfigSection } from "../config/types";

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
// Provider
// ---------------------------------
export const ConfigProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId, config: tenantConfig } = useTenant();
  
  const [config, setConfig] = useState<AIOpsConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Load config when tenant changes or tenant config updates
  useEffect(() => {
    if (tenantId) {
      if (tenantConfig) {
        // Use config from TenantProvider if available
        setConfig(tenantConfig);
        setLastUpdated(new Date().toISOString());
        setError(null);
      } else {
        // Load config directly
        refreshConfig();
      }
    } else {
      // Clear config when no tenant selected
      setConfig(null);
      setError(null);
      setLastUpdated(null);
    }
  }, [tenantId, tenantConfig]);

  const refreshConfig = useCallback(async () => {
    if (!tenantId) {
      console.warn("Cannot refresh config: no tenant selected");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log(`Loading config for tenant: ${tenantId}`);
      const loadedConfig = await loadConfig(tenantId);
      
      setConfig(loadedConfig);
      setLastUpdated(new Date().toISOString());
      
      console.log("Config loaded successfully:", {
        tenant: tenantId,
        sections: Object.keys(loadedConfig),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load configuration';
      console.error(`Config loading error for tenant ${tenantId}:`, errorMessage);
      setError(errorMessage);
      setConfig(null);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

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
    
    // Handle different section structures
    if (Array.isArray(sectionData)) {
      return sectionData.includes(value) ? value : null;
    } else if (typeof sectionData === 'object') {
      const item = sectionData[value];
      if (!item) return null;
      
      // Check if it's an object with a label property
      if (typeof item === 'object' && 'label' in item) {
        return item.label;
      }
      
      // Return the value itself as label
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
    if (!config?.slas || !entityType || !priority) return null;
    
    const entitySLAs = config.slas[entityType];
    if (!entitySLAs || typeof entitySLAs !== 'object') return null;
    
    const prioritySLA = entitySLAs[priority];
    if (typeof prioritySLA === 'number') return prioritySLA;
    if (typeof prioritySLA === 'object' && 'target_minutes' in prioritySLA) {
      return prioritySLA.target_minutes;
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

// Convenience hooks for specific config sections
export const useStatuses = () => {
  const { statuses, validateEnum, getEnumOptions } = useConfig();
  return {
    statuses,
    validateStatus: (entityType: string, status: string) => 
      validateEnum('statuses', status) && statuses?.[entityType]?.includes(status),
    getStatusOptions: (entityType: string) => statuses?.[entityType] || [],
    allStatusOptions: getEnumOptions('statuses'),
  };
};

export const usePriorities = () => {
  const { priorities, validateEnum, getEnumOptions, getEnumLabel, getEnumColor } = useConfig();
  return {
    priorities,
    validatePriority: (priority: string) => validateEnum('priorities', priority),
    getPriorityOptions: () => getEnumOptions('priorities'),
    getPriorityLabel: (priority: string) => getEnumLabel('priorities', priority),
    getPriorityColor: (priority: string) => getEnumColor('priorities', priority),
  };
};

export const useSeverities = () => {
  const { severities, validateEnum, getEnumOptions, getEnumLabel, getEnumColor } = useConfig();
  return {
    severities,
    validateSeverity: (severity: string) => validateEnum('severities', severity),
    getSeverityOptions: () => getEnumOptions('severities'),
    getSeverityLabel: (severity: string) => getEnumLabel('severities', severity),
    getSeverityColor: (severity: string) => getEnumColor('severities', severity),
  };
};

export const useTiers = () => {
  const { tiers, validateEnum, getEnumOptions } = useConfig();
  return {
    tiers,
    validateTier: (tier: string) => validateEnum('tiers', tier),
    getTierOptions: () => getEnumOptions('tiers'),
  };
};

export const useSLAs = () => {
  const { slas, getSLATarget } = useConfig();
  return {
    slas,
    getSLATarget,
    hasSLA: (entityType: string) => Boolean(slas?.[entityType]),
  };
};

export const useKPIs = () => {
  const { kpis } = useConfig();
  return {
    kpis: kpis || [],
    getKPIByType: (type: string) => kpis?.filter(kpi => kpi.type === type) || [],
  };
};

// Validation hook for form validation
export const useConfigValidation = () => {
  const { validateEnum } = useConfig();
  
  return {
    validateField: (section: ConfigSection, value: string) => {
      if (!value) return { valid: false, message: 'Value is required' };
      
      const isValid = validateEnum(section, value);
      return {
        valid: isValid,
        message: isValid ? '' : `Invalid ${section} value: ${value}`
      };
    },
    
    validateMultiple: (validations: Array<{ section: ConfigSection; value: string; field: string }>) => {
      const errors: Record<string, string> = {};
      
      validations.forEach(({ section, value, field }) => {
        if (!value) {
          errors[field] = 'This field is required';
        } else if (!validateEnum(section, value)) {
          errors[field] = `Invalid ${section} value`;
        }
      });
      
      return {
        isValid: Object.keys(errors).length === 0,
        errors
      };
    }
  };
};