// src/types/team.ts
import { ExternalSystemFields } from './externalSystem';

/**
 * Shared Team Type Definitions
 * These types define the contract between frontend and backend
 * All business logic calculations are handled by backend
 */

export type TeamType =
  | "operations"
  | "sre"
  | "development"
  | "support"
  | "security"
  | "field_service"
  | "business"
  | "other";

export type HealthStatus = "green" | "yellow" | "orange" | "red" | "gray";

export type SkillProficiencyLevel = "basic" | "intermediate" | "advanced" | "expert";

export interface TeamSkill {
  skill_id: string;
  team_proficiency: SkillProficiencyLevel;
  certified_members: number;
  total_members: number;
}

/**
 * Team Metrics - All calculated by backend
 * Frontend NEVER calculates these values
 */
export interface TeamMetrics {
  // Response times (calculated by backend from incident data)
  mttr_minutes?: number;
  mtta_minutes?: number;
  
  // Workload metrics (calculated by backend)
  workload_score?: number;      // Backend calculates based on complexity + volume
  incidents_assigned: number;   // Backend maintains count
  incidents_resolved: number;   // Backend maintains count
  success_rate: number;         // Backend calculates: resolved / assigned
  avg_resolution_time: number;  // Backend calculates from resolution data
  
  // Performance trends (calculated by backend)
  mttr_trend?: "improving" | "stable" | "declining";
  workload_trend?: "increasing" | "stable" | "decreasing";
  
  // Comparative metrics (calculated by backend)
  industry_benchmark_score?: number;
  company_benchmark_score?: number;
}

/**
 * Base Team Entity
 * Frontend displays what backend provides, never calculates derived fields
 */
export interface Team extends ExternalSystemFields {
  // Core identification
  id: string;
  name: string;
  description?: string;
  type: TeamType;
  
  // Timestamps (backend managed)
  created_at: string;
  updated_at: string;
  
  // Foreign key relationships (IDs only)
  user_ids: string[];
  manager_user_id?: string | null;
  business_service_ids: string[];
  cost_center_id?: string | null;
  
  // OnCall/Escalation (backend managed)
  escalation_policies?: string[];
  oncall_schedule_id?: string | null;
  
  // Performance metrics (ALL calculated by backend)
  metrics: TeamMetrics;
  
  // Capacity (backend calculates and validates)
  max_concurrent_incidents?: number;
  current_workload?: number;           // Backend calculates in real-time
  capacity_utilization?: number;       // Backend calculates: current / max
  
  // Skills and capabilities
  team_skills: TeamSkill[];
  
  // Location and operational details
  primary_timezone?: string;
  office_location?: string;
  remote_friendly?: boolean;
  
  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: HealthStatus;         // Backend determines based on metrics
  
  // Note: synced_at and sync_status are now provided by ExternalSystemFields
  tenantId?: string;
}

/**
 * Extended Team with Related Entities
 * Backend joins and provides related data to avoid N+1 queries
 */
export interface TeamDetails extends Team {
  // Related entities (populated by backend)
  manager?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  
  users?: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    avatar?: string;
    skills: string[];
    availability_status: "available" | "busy" | "offline";
  }>;
  
  business_services?: Array<{
    id: string;
    name: string;
    tier: number;
    health_status: HealthStatus;
  }>;
  
  cost_center?: {
    id: string;
    name: string;
    code: string;
    budget_remaining: number;
  };
  
  // Real-time calculated data (backend provides)
  active_incidents?: Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
    assigned_to: string;
    created_at: string;
  }>;
  
  recent_activities?: Array<{
    id: string;
    type: string;
    description: string;
    user_id: string;
    user_name: string;
    timestamp: string;
  }>;
  
  // Performance analytics (backend calculated)
  performance_trends?: {
    mttr_7_days: number[];
    incident_volume_7_days: number[];
    resolution_rate_7_days: number[];
  };
  
  // Recommendations (backend AI/ML generated)
  recommendations?: Array<{
    type: "skill_gap" | "capacity" | "process" | "training";
    priority: "high" | "medium" | "low";
    title: string;
    description: string;
    estimated_impact: string;
  }>;
}

/**
 * Team Creation/Update Payloads
 * Frontend sends minimal data, backend handles validation and defaults
 */
export interface CreateTeamRequest {
  name: string;
  description?: string;
  type: TeamType;
  manager_user_id?: string;
  business_service_ids?: string[];
  cost_center_id?: string;
  max_concurrent_incidents?: number;
  primary_timezone?: string;
  office_location?: string;
  remote_friendly?: boolean;
  tags?: string[];
  custom_fields?: Record<string, any>;
}

export interface UpdateTeamRequest {
  name?: string;
  description?: string;
  type?: TeamType;
  manager_user_id?: string | null;
  business_service_ids?: string[];
  cost_center_id?: string | null;
  max_concurrent_incidents?: number;
  primary_timezone?: string;
  office_location?: string;
  remote_friendly?: boolean;
  tags?: string[];
  custom_fields?: Record<string, any>;
}

/**
 * API Response Types
 */
export interface TeamListResponse {
  teams: Team[];
  total: number;
  page: number;
  limit: number;
  filters_applied: string[];
}

export interface TeamRecommendation {
  team: Team;
  match_score: number;           // Backend calculated 0-100
  match_reasons: string[];       // Backend generated explanations
  estimated_capacity: number;    // Backend calculated available capacity
  estimated_response_time: number; // Backend predicted based on workload
}

export interface TeamPerformanceStats {
  team_id: string;
  timeframe: {
    start: string;
    end: string;
  };
  
  // Core metrics (backend calculated)
  mttr: number;
  mtta: number;
  incidents_this_period: number;
  resolved_this_period: number;
  success_rate: number;
  
  // Trends (backend analyzed)
  workload_trend: "increasing" | "stable" | "decreasing";
  performance_trend: "improving" | "stable" | "declining";
  
  // Comparative analysis (backend computed)
  benchmark_comparison: {
    industry_percentile: number;
    company_percentile: number;
    similar_teams_comparison: number;
  };
  
  // Predictive insights (backend ML/AI generated)
  capacity_forecast: {
    next_week: number;
    next_month: number;
    confidence: number;
  };
  
  risk_indicators: Array<{
    type: "burnout" | "skill_gap" | "capacity" | "quality";
    severity: "high" | "medium" | "low";
    description: string;
    recommended_action: string;
  }>;
}

/**
 * Bulk Operation Types
 */
export type BulkTeamOperation = {
  team_id: string;
  operation: "update" | "add_user" | "remove_user" | "update_skills";
  data: any;
};

export interface BulkOperationResult {
  total_operations: number;
  successful: number;
  failed: number;
  errors: Array<{
    team_id: string;
    operation: string;
    error_message: string;
    error_code: string;
  }>;
  processing_time_ms: number;
}

/**
 * Frontend-Only Types (UI State Management)
 */
export interface TeamUIState {
  loading: boolean;
  error: string | null;
  lastFetch: Date | null;
  stale: boolean;
  optimisticUpdates: Array<{
    id: string;
    type: "create" | "update" | "delete";
    data: any;
    timestamp: Date;
  }>;
}

export interface TeamFilters {
  types?: TeamType[];
  search?: string;
  manager_id?: string;
  business_service_id?: string;
  location?: string;
  timezone?: string;
  health_status?: HealthStatus[];
  has_skill?: string;
  min_skill_level?: SkillProficiencyLevel;
  available_only?: boolean;
  overloaded_only?: boolean;
  overloaded_threshold?: number;
  // External system filters
  sourceSystems?: string[];
  syncStatus?: ('synced' | 'syncing' | 'error' | 'conflict')[];
  hasConflicts?: boolean;
  hasLocalChanges?: boolean;
  dataCompleteness?: { min: number; max: number };
}

export interface TeamSortOptions {
  field: "name" | "type" | "health_status" | "workload" | "mttr" | "created_at";
  order: "asc" | "desc";
}

/**
 * Configuration Types (Backend Provided)
 */
export interface TeamConfig {
  team_types: Array<{
    value: TeamType;
    label: string;
    description: string;
  }>;
  
  skill_proficiency_levels: Array<{
    value: SkillProficiencyLevel;
    label: string;
    description: string;
  }>;
  
  timezones: Array<{
    value: string;
    label: string;
    offset: string;
  }>;
  
  locations: Array<{
    value: string;
    label: string;
    region: string;
  }>;
  
  health_status_thresholds: {
    green: { min_success_rate: number; max_mttr: number };
    yellow: { min_success_rate: number; max_mttr: number };
    orange: { min_success_rate: number; max_mttr: number };
    red: { min_success_rate: number; max_mttr: number };
  };
  
  capacity_thresholds: {
    normal: number;      // < 70%
    high: number;        // 70-85%
    critical: number;    // 85-95%
    overloaded: number;  // > 95%
  };
}

/**
 * Validation Error Types (Backend Provided)
 */
export interface TeamValidationError {
  field: string;
  message: string;
  code: string;
  current_value?: any;
  allowed_values?: any[];
}

export interface TeamAPIError {
  message: string;
  error_code: string;
  status_code: number;
  timestamp: string;
  validation_errors?: TeamValidationError[];
  suggestion?: string;
}