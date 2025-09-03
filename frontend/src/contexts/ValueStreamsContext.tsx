// src/contexts/ValueStreamsContext.tsx (STANDARDIZED)
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { getAll, getById, putWithAudit, removeWithAudit } from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useConfig } from "../providers/ConfigProvider";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------
export interface CustomKpi {
  name: string;
  target: number;
  unit: string;
  current?: number;
  description?: string;
  measurement_frequency?: "real_time" | "hourly" | "daily" | "weekly" | "monthly";
  data_source?: string;
  calculation_method?: string;
  threshold_warning?: number;
  threshold_critical?: number;
}

export interface ValueStreamStakeholder {
  user_id: string;
  role: "owner" | "sponsor" | "contributor" | "consumer";
  responsibilities?: string[];
}

export interface ValueStream {
  id: string;
  name: string;
  description: string;
  industry?: string; // config-driven
  tier?: string;     // config-driven
  created_at: string;
  updated_at: string;

  // Ownership & Governance
  business_owner_user_id?: string | null;
  business_owner_team_id?: string | null;
  technical_owner_user_id?: string | null;
  product_owner_user_id?: string | null;
  stakeholders: ValueStreamStakeholder[];

  // Relationships
  business_service_ids: string[];
  customer_ids: string[];
  cost_center_ids: string[];
  contract_ids: string[];
  parent_value_stream_id?: string | null;
  child_value_stream_ids: string[];

  // KPIs & Metrics
  enterprise_kpi_ids: string[];
  custom_kpis: CustomKpi[];
  
  // Performance Metrics
  lead_time_days?: number;
  cycle_time_days?: number;
  deployment_frequency?: number; // per month
  change_failure_rate?: number; // percentage
  customer_satisfaction_score?: number; // 1-10
  net_promoter_score?: number; // -100 to 100

  // Risk & Compliance
  risk_score?: number;
  compliance_requirement_ids: string[];
  regulatory_requirements?: string[];
  data_privacy_classification?: "public" | "internal" | "confidential" | "restricted";

  // Business Impact
  revenue_impact_per_hour?: number | null;
  annual_value?: number | null;
  strategic_importance?: string; // config-driven
  market_segment?: string;
  geographic_reach?: string[];
  competitive_advantage?: boolean;

  // Operational
  automation_level?: "manual" | "semi_automated" | "fully_automated";
  digitization_score?: number; // 0-100
  operational_maturity?: "basic" | "managed" | "defined" | "quantitatively_managed" | "optimizing";
  change_velocity?: "low" | "medium" | "high" | "very_high";

  // Planning & Strategy
  roadmap_items?: Array<{
    id: string;
    title: string;
    description: string;
    target_date: string;
    status: "planned" | "in_progress" | "completed" | "cancelled";
    investment_amount?: number;
  }>;

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  synced_at?: string;
  sync_status?: "clean" | "dirty" | "conflict";
  tenantId?: string;
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------
interface ValueStreamsContextType {
  valueStreams: ValueStream[];
  addValueStream: (vs: ValueStream, userId?: string) => Promise<void>;
  updateValueStream: (vs: ValueStream, userId?: string) => Promise<void>;
  deleteValueStream: (id: string, userId?: string) => Promise<void>;
  refreshValueStreams: () => Promise<void>;
  getValueStream: (id: string) => Promise<ValueStream | undefined>;

  // Value stream-specific operations
  updateValueStreamKPIs: (streamId: string, kpis: CustomKpi[], userId?: string) => Promise<void>;
  addStakeholder: (streamId: string, stakeholder: ValueStreamStakeholder, userId?: string) => Promise<void>;
  removeStakeholder: (streamId: string, userId: string, removedBy?: string) => Promise<void>;
  updateStakeholderRole: (streamId: string, userId: string, newRole: ValueStreamStakeholder['role'], updatedBy?: string) => Promise<void>;
  addRoadmapItem: (streamId: string, item: ValueStream['roadmap_items'][0], userId?: string) => Promise<void>;
  updateRoadmapItem: (streamId: string, itemId: string, updates: Partial<ValueStream['roadmap_items'][0]>, userId?: string) => Promise<void>;
  calculateValueStreamHealth: (streamId: string) => Promise<{ status: string; score: number; factors: string[] }>;

  // Filtering and querying
  getValueStreamsByIndustry: (industry: string) => ValueStream[];
  getValueStreamsByTier: (tier: string) => ValueStream[];
  getHighValueStreams: (revenueThreshold?: number) => ValueStream[];
  getValueStreamsWithRiskIssues: (riskThreshold?: number) => ValueStream[];
  getValueStreamsByOwner: (ownerId: string, ownerType: 'user' | 'team') => ValueStream[];
  getValueStreamsByMaturity: (maturity: ValueStream['operational_maturity']) => ValueStream[];
  searchValueStreams: (query: string) => ValueStream[];

  // Analytics
  getValueStreamPerformanceStats: () => {
    totalStreams: number;
    averageLeadTime: number;
    averageCycleTime: number;
    averageCustomerSat: number;
    averageNPS: number;
    highPerformingStreams: number;
    underperformingStreams: number;
    totalAnnualValue: number;
  };

  getValueStreamTrends: () => {
    improving: ValueStream[];
    stable: ValueStream[];
    declining: ValueStream[];
  };

  // Config integration
  config: {
    industries: string[];
    tiers: string[];
    importance_levels: string[];
    maturity_levels: string[];
    automation_levels: string[];
    change_velocities: string[];
  };
}

const ValueStreamsContext = createContext<ValueStreamsContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------
export const ValueStreamsProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId } = useTenant();
  const { enqueueItem } = useSync();
  const { config: globalConfig, validateEnum } = useConfig();
  const [valueStreams, setValueStreams] = useState<ValueStream[]>([]);

  // Extract value stream-specific config from global config
  const config = {
    industries: globalConfig?.business?.value_streams?.industries || 
               ['technology', 'manufacturing', 'financial_services', 'healthcare', 'retail', 'consulting'],
    tiers: globalConfig?.business?.value_streams?.tiers || 
           ['strategic', 'core', 'supporting', 'experimental'],
    importance_levels: globalConfig?.business?.value_streams?.importance_levels || 
                      ['critical', 'high', 'medium', 'low'],
    maturity_levels: ['basic', 'managed', 'defined', 'quantitatively_managed', 'optimizing'],
    automation_levels: ['manual', 'semi_automated', 'fully_automated'],
    change_velocities: ['low', 'medium', 'high', 'very_high'],
  };

  const validateValueStream = useCallback((vs: ValueStream) => {
    if (!globalConfig) {
      throw new Error("Configuration not loaded");
    }

    // Validate industry
    if (vs.industry && !config.industries.includes(vs.industry)) {
      throw new Error(`Invalid industry: ${vs.industry}. Valid options: ${config.industries.join(', ')}`);
    }

    // Validate tier
    if (vs.tier && !config.tiers.includes(vs.tier)) {
      throw new Error(`Invalid tier: ${vs.tier}. Valid options: ${config.tiers.join(', ')}`);
    }

    // Validate strategic importance
    if (vs.strategic_importance && !config.importance_levels.includes(vs.strategic_importance)) {
      throw new Error(`Invalid strategic importance: ${vs.strategic_importance}. Valid options: ${config.importance_levels.join(', ')}`);
    }

    // Validate operational maturity
    if (vs.operational_maturity && !config.maturity_levels.includes(vs.operational_maturity)) {
      throw new Error(`Invalid operational maturity: ${vs.operational_maturity}. Valid options: ${config.maturity_levels.join(', ')}`);
    }

    // Validate automation level
    if (vs.automation_level && !config.automation_levels.includes(vs.automation_level)) {
      throw new Error(`Invalid automation level: ${vs.automation_level}. Valid options: ${config.automation_levels.join(', ')}`);
    }

    // Validate change velocity
    if (vs.change_velocity && !config.change_velocities.includes(vs.change_velocity)) {
      throw new Error(`Invalid change velocity: ${vs.change_velocity}. Valid options: ${config.change_velocities.join(', ')}`);
    }

    // Validate required fields
    if (!vs.name || vs.name.trim().length < 2) {
      throw new Error("Value stream name must be at least 2 characters long");
    }

    if (!vs.description || vs.description.trim().length < 10) {
      throw new Error("Description must be at least 10 characters long");
    }

    // Validate performance metrics
    if (vs.lead_time_days !== undefined && vs.lead_time_days < 0) {
      throw new Error("Lead time must be a positive number");
    }

    if (vs.cycle_time_days !== undefined && vs.cycle_time_days < 0) {
      throw new Error("Cycle time must be a positive number");
    }

    if (vs.change_failure_rate !== undefined && (vs.change_failure_rate < 0 || vs.change_failure_rate > 100)) {
      throw new Error("Change failure rate must be between 0 and 100 percent");
    }

    if (vs.customer_satisfaction_score !== undefined && (vs.customer_satisfaction_score < 1 || vs.customer_satisfaction_score > 10)) {
      throw new Error("Customer satisfaction score must be between 1 and 10");
    }

    if (vs.net_promoter_score !== undefined && (vs.net_promoter_score < -100 || vs.net_promoter_score > 100)) {
      throw new Error("Net Promoter Score must be between -100 and 100");
    }

    if (vs.digitization_score !== undefined && (vs.digitization_score < 0 || vs.digitization_score > 100)) {
      throw new Error("Digitization score must be between 0 and 100");
    }

    // Validate KPIs
    if (vs.custom_kpis) {
      vs.custom_kpis.forEach((kpi, index) => {
        if (!kpi.name || kpi.name.trim().length < 2) {
          throw new Error(`KPI at index ${index} must have a name of at least 2 characters`);
        }
        if (typeof kpi.target !== 'number') {
          throw new Error(`KPI "${kpi.name}" must have a numeric target value`);
        }
      });
    }

    // Validate stakeholders
    if (vs.stakeholders) {
      const validRoles = ['owner', 'sponsor', 'contributor', 'consumer'];
      vs.stakeholders.forEach((stakeholder, index) => {
        if (!stakeholder.user_id) {
          throw new Error(`Stakeholder at index ${index} must have a user_id`);
        }
        if (!validRoles.includes(stakeholder.role)) {
          throw new Error(`Stakeholder role "${stakeholder.role}" is invalid. Valid options: ${validRoles.join(', ')}`);
        }
      });
    }
  }, [globalConfig, config]);

  const ensureMetadata = useCallback((vs: ValueStream): ValueStream => {
    const now = new Date().toISOString();
    return {
      ...vs,
      tenantId,
      tags: vs.tags || [],
      health_status: vs.health_status || "gray",
      sync_status: vs.sync_status || "dirty",
      synced_at: vs.synced_at || now,
      business_service_ids: vs.business_service_ids || [],
      customer_ids: vs.customer_ids || [],
      cost_center_ids: vs.cost_center_ids || [],
      contract_ids: vs.contract_ids || [],
      child_value_stream_ids: vs.child_value_stream_ids || [],
      enterprise_kpi_ids: vs.enterprise_kpi_ids || [],
      custom_kpis: vs.custom_kpis || [],
      compliance_requirement_ids: vs.compliance_requirement_ids || [],
      stakeholders: vs.stakeholders || [],
      roadmap_items: vs.roadmap_items || [],
      regulatory_requirements: vs.regulatory_requirements || [],
      geographic_reach: vs.geographic_reach || [],
    };
  }, [tenantId]);

  const refreshValueStreams = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      const all = await getAll<ValueStream>(tenantId, "value_streams");
      
      // Sort by strategic importance and health status
      all.sort((a, b) => {
        // Strategic streams first
        const importanceOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aImportance = importanceOrder[a.strategic_importance as keyof typeof importanceOrder] || 0;
        const bImportance = importanceOrder[b.strategic_importance as keyof typeof importanceOrder] || 0;
        if (aImportance !== bImportance) return bImportance - aImportance;
        
        // Health status priority
        const healthOrder = { green: 5, yellow: 4, orange: 3, red: 2, gray: 1 };
        const aHealth = healthOrder[a.health_status] || 0;
        const bHealth = healthOrder[b.health_status] || 0;
        if (aHealth !== bHealth) return bHealth - aHealth;
        
        // Finally by annual value (descending)
        const aValue = a.annual_value || 0;
        const bValue = b.annual_value || 0;
        if (aValue !== bValue) return bValue - aValue;
        
        // Finally by name
        return a.name.localeCompare(b.name);
      });
      
      setValueStreams(all);
    } catch (error) {
      console.error("Failed to refresh value streams:", error);
    }
  }, [tenantId]);

  const getValueStream = useCallback(async (id: string) => {
    if (!tenantId) return undefined;
    return getById<ValueStream>(tenantId, "value_streams", id);
  }, [tenantId]);

  const addValueStream = useCallback(async (vs: ValueStream, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateValueStream(vs);

    const now = new Date().toISOString();
    const enriched = ensureMetadata({
      ...vs,
      created_at: now,
      updated_at: now,
    });

    const priority = vs.strategic_importance === 'critical' ? 'critical' : 
                    vs.strategic_importance === 'high' ? 'high' : 'normal';

    await putWithAudit(
      tenantId,
      "value_streams",
      enriched,
      userId,
      {
        action: "create",
        description: `Created value stream: ${vs.name}`,
        tags: ["value_stream", "create", vs.industry || "unspecified", vs.strategic_importance || "medium"],
        metadata: {
          industry: vs.industry,
          tier: vs.tier,
          strategic_importance: vs.strategic_importance,
          annual_value: vs.annual_value,
          customer_count: vs.customer_ids.length,
        },
      }
    );

    await enqueueItem({
      storeName: "value_streams",
      entityId: enriched.id,
      action: "create",
      payload: enriched,
      priority,
    });

    await refreshValueStreams();
  }, [tenantId, validateValueStream, ensureMetadata, enqueueItem, refreshValueStreams]);

  const updateValueStream = useCallback(async (vs: ValueStream, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    validateValueStream(vs);

    const enriched = ensureMetadata({
      ...vs,
      updated_at: new Date().toISOString(),
    });

    await putWithAudit(
      tenantId,
      "value_streams",
      enriched,
      userId,
      {
        action: "update",
        description: `Updated value stream: ${vs.name}`,
        tags: ["value_stream", "update", vs.industry || "unspecified"],
        metadata: {
          industry: vs.industry,
          tier: vs.tier,
          strategic_importance: vs.strategic_importance,
          annual_value: vs.annual_value,
        },
      }
    );

    await enqueueItem({
      storeName: "value_streams",
      entityId: enriched.id,
      action: "update",
      payload: enriched,
    });

    await refreshValueStreams();
  }, [tenantId, validateValueStream, ensureMetadata, enqueueItem, refreshValueStreams]);

  const deleteValueStream = useCallback(async (id: string, userId?: string) => {
    if (!tenantId) throw new Error("No tenant selected");

    const valueStream = await getValueStream(id);
    if (!valueStream) throw new Error(`Value stream ${id} not found`);

    await removeWithAudit(
      tenantId,
      "value_streams",
      id,
      userId,
      {
        action: "delete",
        description: `Deleted value stream: ${valueStream.name}`,
        tags: ["value_stream", "delete", valueStream.industry || "unspecified"],
        metadata: {
          industry: valueStream.industry,
          tier: valueStream.tier,
          strategic_importance: valueStream.strategic_importance,
          annual_value: valueStream.annual_value,
        },
      }
    );

    await enqueueItem({
      storeName: "value_streams",
      entityId: id,
      action: "delete",
      payload: null,
    });

    await refreshValueStreams();
  }, [tenantId, getValueStream, enqueueItem, refreshValueStreams]);

  // Value stream-specific operations
  const updateValueStreamKPIs = useCallback(async (streamId: string, kpis: CustomKpi[], userId?: string) => {
    const stream = await getValueStream(streamId);
    if (!stream) throw new Error(`Value stream ${streamId} not found`);

    const updated = { ...stream, custom_kpis: kpis };
    await updateValueStream(updated, userId);
  }, [getValueStream, updateValueStream]);

  const addStakeholder = useCallback(async (streamId: string, stakeholder: ValueStreamStakeholder, userId?: string) => {
    const stream = await getValueStream(streamId);
    if (!stream) throw new Error(`Value stream ${streamId} not found`);

    // Check if stakeholder already exists
    const existingIndex = stream.stakeholders.findIndex(s => s.user_id === stakeholder.user_id);
    if (existingIndex >= 0) {
      throw new Error(`User ${stakeholder.user_id} is already a stakeholder`);
    }

    const updatedStakeholders = [...stream.stakeholders, stakeholder];
    const updated = { ...stream, stakeholders: updatedStakeholders };

    await updateValueStream(updated, userId);
  }, [getValueStream, updateValueStream]);

  const removeStakeholder = useCallback(async (streamId: string, userId: string, removedBy?: string) => {
    const stream = await getValueStream(streamId);
    if (!stream) throw new Error(`Value stream ${streamId} not found`);

    const updatedStakeholders = stream.stakeholders.filter(s => s.user_id !== userId);
    const updated = { ...stream, stakeholders: updatedStakeholders };

    await updateValueStream(updated, removedBy);
  }, [getValueStream, updateValueStream]);

  const updateStakeholderRole = useCallback(async (streamId: string, userId: string, newRole: ValueStreamStakeholder['role'], updatedBy?: string) => {
    const stream = await getValueStream(streamId);
    if (!stream) throw new Error(`Value stream ${streamId} not found`);

    const updatedStakeholders = stream.stakeholders.map(s => 
      s.user_id === userId ? { ...s, role: newRole } : s
    );
    const updated = { ...stream, stakeholders: updatedStakeholders };

    await updateValueStream(updated, updatedBy);
  }, [getValueStream, updateValueStream]);

  const addRoadmapItem = useCallback(async (streamId: string, item: ValueStream['roadmap_items'][0], userId?: string) => {
    const stream = await getValueStream(streamId);
    if (!stream) throw new Error(`Value stream ${streamId} not found`);

    const updatedRoadmap = [...stream.roadmap_items, item];
    const updated = { ...stream, roadmap_items: updatedRoadmap };

    await updateValueStream(updated, userId);
  }, [getValueStream, updateValueStream]);

  const updateRoadmapItem = useCallback(async (streamId: string, itemId: string, updates: Partial<ValueStream['roadmap_items'][0]>, userId?: string) => {
    const stream = await getValueStream(streamId);
    if (!stream) throw new Error(`Value stream ${streamId} not found`);

    const updatedRoadmap = stream.roadmap_items.map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    );
    const updated = { ...stream, roadmap_items: updatedRoadmap };

    await updateValueStream(updated, userId);
  }, [getValueStream, updateValueStream]);

  const calculateValueStreamHealth = useCallback(async (streamId: string) => {
    const stream = await getValueStream(streamId);
    if (!stream) throw new Error(`Value stream ${streamId} not found`);

    // Calculate health score based on various factors
    let score = 100;
    const factors: string[] = [];

    // Customer satisfaction factor
    if (stream.customer_satisfaction_score !== undefined) {
      if (stream.customer_satisfaction_score < 7) {
        score -= (7 - stream.customer_satisfaction_score) * 5;
        factors.push(`Low customer satisfaction: ${stream.customer_satisfaction_score}/10`);
      }
    }

    // NPS factor
    if (stream.net_promoter_score !== undefined) {
      if (stream.net_promoter_score < 0) {
        score -= Math.abs(stream.net_promoter_score) / 2;
        factors.push(`Negative NPS: ${stream.net_promoter_score}`);
      }
    }

    // Change failure rate factor
    if (stream.change_failure_rate !== undefined && stream.change_failure_rate > 15) {
      score -= (stream.change_failure_rate - 15) * 2;
      factors.push(`High change failure rate: ${stream.change_failure_rate}%`);
    }

    // Lead time factor (assume > 30 days is concerning)
    if (stream.lead_time_days !== undefined && stream.lead_time_days > 30) {
      score -= Math.min(20, (stream.lead_time_days - 30) * 0.5);
      factors.push(`Long lead time: ${stream.lead_time_days} days`);
    }

    // Risk score factor
    if (stream.risk_score !== undefined && stream.risk_score > 70) {
      score -= (stream.risk_score - 70) * 0.5;
      factors.push(`High risk score: ${stream.risk_score}`);
    }

    // Determine status based on score
    let status: string;
    if (score >= 90) status = 'green';
    else if (score >= 75) status = 'yellow';
    else if (score >= 60) status = 'orange';
    else status = 'red';

    return { status, score: Math.max(0, score), factors };
  }, [getValueStream]);

  // Filtering functions
  const getValueStreamsByIndustry = useCallback((industry: string) => {
    return valueStreams.filter(vs => vs.industry === industry);
  }, [valueStreams]);

  const getValueStreamsByTier = useCallback((tier: string) => {
    return valueStreams.filter(vs => vs.tier === tier);
  }, [valueStreams]);

  const getHighValueStreams = useCallback((revenueThreshold: number = 1000000) => {
    return valueStreams.filter(vs => 
      (vs.annual_value && vs.annual_value >= revenueThreshold) ||
      vs.strategic_importance === 'critical'
    );
  }, [valueStreams]);

  const getValueStreamsWithRiskIssues = useCallback((riskThreshold: number = 70) => {
    return valueStreams.filter(vs => 
      (vs.risk_score && vs.risk_score >= riskThreshold) ||
      vs.health_status === 'red' ||
      vs.health_status === 'orange'
    );
  }, [valueStreams]);

  const getValueStreamsByOwner = useCallback((ownerId: string, ownerType: 'user' | 'team') => {
    if (ownerType === 'user') {
      return valueStreams.filter(vs => 
        vs.business_owner_user_id === ownerId ||
        vs.technical_owner_user_id === ownerId ||
        vs.product_owner_user_id === ownerId ||
        vs.stakeholders.some(s => s.user_id === ownerId)
      );
    } else {
      return valueStreams.filter(vs => vs.business_owner_team_id === ownerId);
    }
  }, [valueStreams]);

  const getValueStreamsByMaturity = useCallback((maturity: ValueStream['operational_maturity']) => {
    return valueStreams.filter(vs => vs.operational_maturity === maturity);
  }, [valueStreams]);

  const searchValueStreams = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return valueStreams.filter(vs => 
      vs.name.toLowerCase().includes(lowerQuery) ||
      vs.description.toLowerCase().includes(lowerQuery) ||
      vs.industry?.toLowerCase().includes(lowerQuery) ||
      vs.tier?.toLowerCase().includes(lowerQuery) ||
      vs.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      vs.custom_kpis.some(kpi => kpi.name.toLowerCase().includes(lowerQuery))
    );
  }, [valueStreams]);

  // Analytics functions
  const getValueStreamPerformanceStats = useCallback(() => {
    const streamsWithLeadTime = valueStreams.filter(vs => vs.lead_time_days !== undefined);
    const streamsWithCycleTime = valueStreams.filter(vs => vs.cycle_time_days !== undefined);
    const streamsWithCustomerSat = valueStreams.filter(vs => vs.customer_satisfaction_score !== undefined);
    const streamsWithNPS = valueStreams.filter(vs => vs.net_promoter_score !== undefined);

    const averageLeadTime = streamsWithLeadTime.length > 0
      ? streamsWithLeadTime.reduce((sum, vs) => sum + (vs.lead_time_days || 0), 0) / streamsWithLeadTime.length
      : 0;

    const averageCycleTime = streamsWithCycleTime.length > 0
      ? streamsWithCycleTime.reduce((sum, vs) => sum + (vs.cycle_time_days || 0), 0) / streamsWithCycleTime.length
      : 0;

    const averageCustomerSat = streamsWithCustomerSat.length > 0
      ? streamsWithCustomerSat.reduce((sum, vs) => sum + (vs.customer_satisfaction_score || 0), 0) / streamsWithCustomerSat.length
      : 0;

    const averageNPS = streamsWithNPS.length > 0
      ? streamsWithNPS.reduce((sum, vs) => sum + (vs.net_promoter_score || 0), 0) / streamsWithNPS.length
      : 0;

    const highPerformingStreams = valueStreams.filter(vs => 
      vs.health_status === 'green' &&
      (!vs.customer_satisfaction_score || vs.customer_satisfaction_score >= 8) &&
      (!vs.change_failure_rate || vs.change_failure_rate <= 10)
    ).length;

    const underperformingStreams = valueStreams.filter(vs => 
      vs.health_status === 'red' ||
      vs.health_status === 'orange' ||
      (vs.customer_satisfaction_score && vs.customer_satisfaction_score < 6) ||
      (vs.change_failure_rate && vs.change_failure_rate > 20)
    ).length;

    const totalAnnualValue = valueStreams.reduce((sum, vs) => sum + (vs.annual_value || 0), 0);

    return {
      totalStreams: valueStreams.length,
      averageLeadTime,
      averageCycleTime,
      averageCustomerSat,
      averageNPS,
      highPerformingStreams,
      underperformingStreams,
      totalAnnualValue,
    };
  }, [valueStreams]);

  const getValueStreamTrends = useCallback(() => {
    // This would typically compare current vs historical metrics
    // For now, categorize based on current health status
    const improving = valueStreams.filter(vs => vs.health_status === 'green');
    const stable = valueStreams.filter(vs => vs.health_status === 'yellow');
    const declining = valueStreams.filter(vs => vs.health_status === 'red' || vs.health_status === 'orange');

    return { improving, stable, declining };
  }, [valueStreams]);

  // Initialize when tenant and config are ready
  useEffect(() => {
    if (tenantId && globalConfig) {
      refreshValueStreams();
    }
  }, [tenantId, globalConfig, refreshValueStreams]);

  return (
    <ValueStreamsContext.Provider
      value={{
        valueStreams,
        addValueStream,
        updateValueStream,
        deleteValueStream,
        refreshValueStreams,
        getValueStream,
        updateValueStreamKPIs,
        addStakeholder,
        removeStakeholder,
        updateStakeholderRole,
        addRoadmapItem,
        updateRoadmapItem,
        calculateValueStreamHealth,
        getValueStreamsByIndustry,
        getValueStreamsByTier,
        getHighValueStreams,
        getValueStreamsWithRiskIssues,
        getValueStreamsByOwner,
        getValueStreamsByMaturity,
        searchValueStreams,
        getValueStreamPerformanceStats,
        getValueStreamTrends,
        config,
      }}
    >
      {children}
    </ValueStreamsContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------
export const useValueStreams = () => {
  const ctx = useContext(ValueStreamsContext);
  if (!ctx) throw new Error("useValueStreams must be used within ValueStreamsProvider");
  return ctx;
};

export const useValueStreamDetails = (id: string) => {
  const { valueStreams } = useValueStreams();
  return valueStreams.find((vs) => vs.id === id) || null;
};

// Utility hooks
export const useHighValueStreams = () => {
  const { getHighValueStreams } = useValueStreams();
  return getHighValueStreams();
};

export const useValueStreamPerformanceStats = () => {
  const { getValueStreamPerformanceStats } = useValueStreams();
  return getValueStreamPerformanceStats();
};

export const useValueStreamHealth = (streamId: string) => {
  const { calculateValueStreamHealth } = useValueStreams();
  const [health, setHealth] = useState<{ status: string; score: number; factors: string[] } | null>(null);

  useEffect(() => {
    if (streamId) {
      calculateValueStreamHealth(streamId)
        .then(setHealth)
        .catch(console.error);
    }
  }, [streamId, calculateValueStreamHealth]);

  return health;
};