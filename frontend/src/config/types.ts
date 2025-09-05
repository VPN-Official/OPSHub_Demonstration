// src/config/types.ts - SIMPLIFIED to match your actual needs
export type ConfigSection = 
  | 'statuses' 
  | 'priorities' 
  | 'severities' 
  | 'tiers' 
  | 'slas' 
  | 'kpis';

export interface PriorityConfig {
  label: string;
  color: string;
  sla_minutes: number;
  escalation_rules?: {
    notify_after_minutes: number;
    escalate_after_minutes: number;
    escalation_path?: string[];
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
}

export interface KPIConfig {
  name: string;
  unit: string;
  target: number;
  warning_threshold: number;
  critical_threshold: number;
}

// Main configuration interface - simplified to match default.json structure
export interface AIOpsConfig {
  // Entity statuses by type - matches your seed data
  statuses: {
    incidents: string[];
    problems: string[];
    change_requests: string[];
    service_requests: string[];
    maintenances: string[];
    alerts: string[];
    business_services: string[];
    service_components: string[];
    assets: string[];
    // Allow any additional status arrays
    [key: string]: string[];
  };
  
  // Priority configurations - matches your default.json
  priorities: Record<string, PriorityConfig>;
  
  // Severity configurations  
  severities: Record<string, SeverityConfig>;
  
  // Tier configurations
  tiers: Record<string, TierConfig>;
  
  // SLA configurations - simple structure
  slas: Record<string, SLAConfig>;
  
  // KPI definitions - simple structure
  kpis: Record<string, KPIConfig>;
}