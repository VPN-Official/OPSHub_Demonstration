// src/config/types.ts
export type ConfigSection = 
  | 'statuses' 
  | 'priorities' 
  | 'severities' 
  | 'tiers' 
  | 'slas' 
  | 'kpis'
  | 'automation'
  | 'ai_agents';

export interface PriorityConfig {
  label: string;
  color: string;
  sla_minutes: number;
  escalation_rules?: {
    notify_after_minutes: number;
    escalate_after_minutes: number;
    escalation_path: string[];
  };
}

export interface SeverityConfig {
  label: string;
  color: string;
  impact_level: number; // 1-5
  auto_escalate: boolean;
}

export interface TierConfig {
  label: string;
  description: string;
  sla_multiplier: number; // multiplier for base SLAs
}

export interface SLAConfig {
  target_minutes: number;
  warning_threshold: number; // percentage (e.g., 80 for 80%)
  breach_threshold: number; // percentage (e.g., 100 for 100%)
  escalation_rules?: {
    warning_actions: string[];
    breach_actions: string[];
  };
}

export interface KPIConfig {
  id: string;
  name: string;
  description: string;
  type: 'availability' | 'performance' | 'quality' | 'cost' | 'compliance';
  unit: string;
  target_value: number;
  target_operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  calculation_method: string;
  data_source: string;
  refresh_interval: number; // minutes
  enabled: boolean;
}

export interface AutomationConfig {
  id: string;
  name: string;
  description: string;
  trigger_conditions: Record<string, any>;
  actions: Array<{
    type: string;
    parameters: Record<string, any>;
  }>;
  enabled: boolean;
}

export interface AIAgentConfig {
  id: string;
  name: string;
  description: string;
  type: 'diagnostic' | 'predictive' | 'remediation' | 'optimization';
  model_config: Record<string, any>;
  triggers: string[];
  confidence_threshold: number;
  enabled: boolean;
}

export interface AIOpsConfig {
  // Entity statuses by type
  statuses: {
    incidents: string[];
    problems: string[];
    change_requests: string[];
    service_requests: string[];
    maintenances: string[];
    alerts: string[];
    [key: string]: string[];
  };
  
  // Priority configurations
  priorities: Record<string, PriorityConfig>;
  
  // Severity configurations  
  severities: Record<string, SeverityConfig>;
  
  // Tier configurations
  tiers: Record<string, TierConfig>;
  
  // SLA configurations by entity type and priority
  slas: {
    [entityType: string]: {
      [priority: string]: SLAConfig;
    };
  };
  
  // KPI definitions
  kpis: KPIConfig[];
  
  // Automation rules
  automation: AutomationConfig[];
  
  // AI agent configurations
  ai_agents: AIAgentConfig[];
  
  // Tenant-specific settings
  tenant_settings: {
    timezone: string;
    business_hours: {
      start: string; // HH:mm format
      end: string;   // HH:mm format
      days: number[]; // 0-6 (Sunday-Saturday)
    };
    notification_settings: {
      email_enabled: boolean;
      sms_enabled: boolean;
      slack_enabled: boolean;
      default_channels: string[];
    };
    compliance_frameworks: string[];
  };
  
  // Validation rules
  validation: {
    required_fields: {
      [entityType: string]: string[];
    };
    field_constraints: {
      [entityType: string]: {
        [field: string]: {
          type: 'string' | 'number' | 'boolean' | 'date' | 'enum';
          min_length?: number;
          max_length?: number;
          min_value?: number;
          max_value?: number;
          enum_values?: string[];
          pattern?: string;
        };
      };
    };
  };
}

// src/config/loadConfig.ts
import defaultConfig from './default.json';
import { getById } from '../db/dbClient';
import type { AIOpsConfig } from './types';

// In-memory cache for configs
const configCache = new Map<string, AIOpsConfig>();

export const loadConfig = async (tenantId: string): Promise<AIOpsConfig> => {
  if (!tenantId) {
    throw new Error('Tenant ID is required to load configuration');
  }

  // Check cache first
  const cachedConfig = configCache.get(tenantId);
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    // Load default configuration
    const baseConfig = defaultConfig as AIOpsConfig;
    
    // Try to load tenant-specific overrides from database
    let tenantOverrides = null;
    try {
      tenantOverrides = await getById<Partial<AIOpsConfig>>(
        tenantId, 
        'tenant_configs', 
        tenantId
      );
    } catch (error) {
      console.log(`No tenant-specific config found for ${tenantId}, using defaults`);
    }

    // Merge configurations (tenant overrides take precedence)
    const mergedConfig = tenantOverrides 
      ? mergeConfigs(baseConfig, tenantOverrides)
      : baseConfig;

    // Validate the configuration
    validateConfig(mergedConfig);

    // Cache the result
    configCache.set(tenantId, mergedConfig);
    
    console.log(`Configuration loaded for tenant ${tenantId}`, {
      hasOverrides: Boolean(tenantOverrides),
      sections: Object.keys(mergedConfig),
    });

    return mergedConfig;
  } catch (error) {
    console.error(`Failed to load configuration for tenant ${tenantId}:`, error);
    throw new Error(`Configuration loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Clear config cache (useful for testing or config updates)
export const clearConfigCache = (tenantId?: string) => {
  if (tenantId) {
    configCache.delete(tenantId);
  } else {
    configCache.clear();
  }
};

// Deep merge two configuration objects
function mergeConfigs(base: AIOpsConfig, override: Partial<AIOpsConfig>): AIOpsConfig {
  const merged = JSON.parse(JSON.stringify(base)); // Deep clone
  
  for (const [key, value] of Object.entries(override)) {
    if (value === null || value === undefined) {
      continue;
    }
    
    if (Array.isArray(value)) {
      // Replace arrays entirely
      (merged as any)[key] = value;
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Deep merge objects
      (merged as any)[key] = {
        ...(merged as any)[key],
        ...value,
      };
    } else {
      // Replace primitives
      (merged as any)[key] = value;
    }
  }
  
  return merged;
}

// Validate configuration structure
function validateConfig(config: AIOpsConfig): void {
  const requiredSections = ['statuses', 'priorities', 'severities', 'tiers', 'slas', 'kpis'];
  
  for (const section of requiredSections) {
    if (!(section in config)) {
      throw new Error(`Missing required configuration section: ${section}`);
    }
  }
  
  // Validate statuses
  if (!config.statuses || typeof config.statuses !== 'object') {
    throw new Error('Invalid statuses configuration');
  }
  
  // Validate priorities
  if (!config.priorities || typeof config.priorities !== 'object') {
    throw new Error('Invalid priorities configuration');
  }
  
  for (const [key, priority] of Object.entries(config.priorities)) {
    if (!priority.label || !priority.color || typeof priority.sla_minutes !== 'number') {
      throw new Error(`Invalid priority configuration for ${key}`);
    }
  }
  
  // Validate KPIs
  if (!Array.isArray(config.kpis)) {
    throw new Error('KPIs configuration must be an array');
  }
  
  for (const kpi of config.kpis) {
    if (!kpi.id || !kpi.name || !kpi.type) {
      throw new Error(`Invalid KPI configuration: missing required fields`);
    }
  }
  
  console.log('Configuration validation passed');
}

// Helper to get enum values from config
export const getConfigEnum = (config: AIOpsConfig, section: keyof AIOpsConfig, entityType?: string): string[] => {
  const sectionData = config[section];
  
  if (section === 'statuses' && entityType) {
    return (sectionData as any)[entityType] || [];
  }
  
  if (Array.isArray(sectionData)) {
    return sectionData;
  }
  
  if (typeof sectionData === 'object' && sectionData !== null) {
    return Object.keys(sectionData);
  }
  
  return [];
};

// Helper to validate enum value
export const validateConfigEnum = (
  config: AIOpsConfig, 
  section: keyof AIOpsConfig, 
  value: string, 
  entityType?: string
): boolean => {
  const validValues = getConfigEnum(config, section, entityType);
  return validValues.includes(value);
};