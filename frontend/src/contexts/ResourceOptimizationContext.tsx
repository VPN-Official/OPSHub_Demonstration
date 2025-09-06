// src/contexts/ResourceOptimizationContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AsyncState, AsyncStateHelpers } from "../types/asyncState";
import { useTenant } from '../providers/TenantProvider';
import { useSync } from '../providers/SyncProvider';
import { useRealtimeStream } from './RealtimeStreamContext';
import { useAIInsights } from './AIInsightsContext';
import { useMetricsAnalytics } from './MetricsAnalyticsContext';
import { ExternalSystemFields } from '../types/externalSystem';

// ---------------------------------
// 1. Type Definitions
// ---------------------------------

export interface ResourceAllocation {
  id: string;
  resourceId: string;
  resourceType: 'cpu' | 'memory' | 'storage' | 'network' | 'license' | 'human';
  allocatedTo: string;
  allocationType: 'entity' | 'service' | 'team' | 'project';
  amount: number;
  unit: string;
  utilization: number;
  cost: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  startTime: Date;
  endTime?: Date;
  tags: string[];
}

export interface ResourcePool {
  id: string;
  name: string;
  type: 'compute' | 'storage' | 'network' | 'licensing' | 'human';
  totalCapacity: number;
  usedCapacity: number;
  availableCapacity: number;
  reservedCapacity: number;
  unit: string;
  costPerUnit: number;
  location?: string;
  provider?: string;
  healthStatus: 'healthy' | 'degraded' | 'critical';
  metadata: Record<string, any>;
}

export interface OptimizationRecommendation extends ExternalSystemFields {
  id: string;
  type: 'rightsizing' | 'consolidation' | 'migration' | 'decommission' | 'scaling';
  resourceId: string;
  resourceType: string;
  currentState: Record<string, any>;
  recommendedState: Record<string, any>;
  impact: {
    costSavings: number;
    performanceGain: number;
    riskScore: number;
    implementationEffort: 'low' | 'medium' | 'high';
  };
  confidence: number;
  reasoning: string;
  automationAvailable: boolean;
  approvalRequired: boolean;
  expiresAt: Date;
  // synced_at, sync_status removed - inherited from ExternalSystemFields
}

export interface CapacityForecast {
  resourceId: string;
  resourceType: string;
  predictions: Array<{
    timestamp: Date;
    predictedUsage: number;
    confidenceInterval: [number, number];
    probabilityOfExhaustion: number;
  }>;
  exhaustionDate?: Date;
  recommendedAction?: string;
  seasonalPatterns?: Array<{
    period: string;
    pattern: number[];
  }>;
}

export interface AutoScalingPolicy {
  id: string;
  name: string;
  resourcePoolId: string;
  enabled: boolean;
  triggers: Array<{
    metric: string;
    threshold: number;
    operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
    duration: number; // seconds
  }>;
  actions: Array<{
    type: 'scale_up' | 'scale_down' | 'scale_out' | 'scale_in';
    amount: number;
    cooldown: number; // seconds
  }>;
  constraints: {
    minCapacity: number;
    maxCapacity: number;
    maxCostPerHour?: number;
    allowedTimeWindows?: Array<{ start: string; end: string }>;
  };
  lastTriggered?: Date;
  history: Array<{
    timestamp: Date;
    trigger: string;
    action: string;
    result: 'success' | 'failure' | 'skipped';
  }>;
}

export interface CostOptimization {
  id: string;
  category: 'unused' | 'underutilized' | 'overprovisioned' | 'reserved_instance' | 'spot_opportunity';
  resourceIds: string[];
  currentCost: number;
  optimizedCost: number;
  savingsAmount: number;
  savingsPercentage: number;
  implementationSteps: string[];
  automationScript?: string;
  riskAssessment: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    mitigations: string[];
  };
}

export interface ResourceOptimizationContextProps {
  // Resource Pools
  resourcePools: AsyncState<ResourcePool[]>;
  getResourcePool: (id: string) => ResourcePool | undefined;
  updateResourcePool: (id: string, updates: Partial<ResourcePool>) => Promise<void>;
  
  // Allocations
  allocations: AsyncState<ResourceAllocation[]>;
  allocateResource: (allocation: Omit<ResourceAllocation, 'id'>) => Promise<ResourceAllocation>;
  deallocateResource: (allocationId: string) => Promise<void>;
  reallocateResource: (allocationId: string, newTarget: string) => Promise<void>;
  
  // Optimization
  recommendations: AsyncState<OptimizationRecommendation[]>;
  applyRecommendation: (recommendationId: string) => Promise<void>;
  dismissRecommendation: (recommendationId: string, reason?: string) => Promise<void>;
  scheduleOptimization: (recommendationId: string, scheduledTime: Date) => Promise<void>;
  
  // Forecasting
  forecasts: Map<string, CapacityForecast>;
  requestForecast: (resourceId: string, horizon: number) => Promise<CapacityForecast>;
  getCapacityTrends: (resourceType: string, period: 'hour' | 'day' | 'week' | 'month') => any[];
  
  // Auto-scaling
  scalingPolicies: AutoScalingPolicy[];
  createScalingPolicy: (policy: Omit<AutoScalingPolicy, 'id' | 'history'>) => Promise<AutoScalingPolicy>;
  updateScalingPolicy: (policyId: string, updates: Partial<AutoScalingPolicy>) => Promise<void>;
  deleteScalingPolicy: (policyId: string) => Promise<void>;
  evaluateScalingPolicies: () => Promise<void>;
  
  // Cost Optimization
  costOptimizations: AsyncState<CostOptimization[]>;
  analyzeCostOptimizations: () => Promise<CostOptimization[]>;
  implementCostOptimization: (optimizationId: string) => Promise<void>;
  getCostTrends: (period: 'day' | 'week' | 'month' | 'quarter') => any[];
  
  // Resource Discovery
  discoverResources: () => Promise<void>;
  importResourceInventory: (source: 'cloud' | 'onprem' | 'hybrid', config: any) => Promise<void>;
  
  // Capacity Planning
  planCapacity: (requirements: any, constraints: any) => Promise<any>;
  simulateCapacityScenario: (scenario: any) => Promise<any>;
  
  // Analytics
  getResourceUtilization: (resourceId?: string) => number;
  getEfficiencyScore: () => number;
  getWasteMetrics: () => any;
  getOptimizationHistory: (days: number) => any[];
  
  // Real-time monitoring
  subscribeToResourceMetrics: (resourceId: string, callback: (metrics: any) => void) => () => void;
  subscribeToOptimizationEvents: (callback: (event: any) => void) => () => void;
  
  // State
  loading: boolean;
  error: string | null;
  lastOptimizationRun: Date | null;
  optimizationStatus: 'idle' | 'analyzing' | 'optimizing' | 'completed';
}

// ---------------------------------
// 2. Optimization Engine
// ---------------------------------

class ResourceOptimizationEngine {
  private tenant: any;
  private aiInsights: any;
  private metricsAnalytics: any;
  private resourceCache: Map<string, any> = new Map();
  private optimizationQueue: any[] = [];
  private scalingEvaluator: NodeJS.Timeout | null = null;
  
  constructor(tenant: any, aiInsights: any, metricsAnalytics: any) {
    this.tenant = tenant;
    this.aiInsights = aiInsights;
    this.metricsAnalytics = metricsAnalytics;
  }
  
  // Resource Analysis
  analyzeResourceUtilization(allocations: ResourceAllocation[], pools: ResourcePool[]): any {
    const utilization: Record<string, any> = {};
    
    // Calculate utilization by resource type
    const typeGroups = this.groupBy(allocations, 'resourceType');
    Object.entries(typeGroups).forEach(([type, allocs]) => {
      const totalAllocated = (allocs as ResourceAllocation[]).reduce((sum, a) => sum + a.amount, 0);
      const pool = pools.find(p => p.type.includes(type));
      
      utilization[type] = {
        allocated: totalAllocated,
        capacity: pool?.totalCapacity || 0,
        percentage: pool ? (totalAllocated / pool.totalCapacity) * 100 : 0,
        trend: this.calculateTrend(type),
        forecast: this.forecastUtilization(type, 7)
      };
    });
    
    return utilization;
  }
  
  // Optimization Recommendations
  async generateOptimizationRecommendations(
    allocations: ResourceAllocation[],
    pools: ResourcePool[],
    historicalData: any[]
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    
    // 1. Identify underutilized resources
    const underutilized = allocations.filter(a => a.utilization < 30);
    underutilized.forEach(allocation => {
      recommendations.push({
        id: `rec_${Date.now()}_${allocation.id}`,
        type: 'rightsizing',
        resourceId: allocation.resourceId,
        resourceType: allocation.resourceType,
        currentState: {
          amount: allocation.amount,
          utilization: allocation.utilization,
          cost: allocation.cost
        },
        recommendedState: {
          amount: Math.ceil(allocation.amount * (allocation.utilization / 100) * 1.2),
          utilization: 80,
          cost: allocation.cost * 0.4
        },
        impact: {
          costSavings: allocation.cost * 0.6,
          performanceGain: 0,
          riskScore: 0.2,
          implementationEffort: 'low'
        },
        confidence: 0.85,
        reasoning: `Resource consistently underutilized at ${allocation.utilization}%`,
        automationAvailable: true,
        approvalRequired: allocation.priority === 'critical',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
    });
    
    // 2. Consolidation opportunities
    const consolidationCandidates = this.findConsolidationOpportunities(allocations);
    consolidationCandidates.forEach(group => {
      const totalCost = group.reduce((sum, a) => sum + a.cost, 0);
      const consolidatedCost = totalCost * 0.7;
      
      recommendations.push({
        id: `rec_consol_${Date.now()}`,
        type: 'consolidation',
        resourceId: group[0].resourceId,
        resourceType: group[0].resourceType,
        currentState: {
          resources: group.length,
          totalCost,
          avgUtilization: group.reduce((sum, a) => sum + a.utilization, 0) / group.length
        },
        recommendedState: {
          resources: 1,
          totalCost: consolidatedCost,
          avgUtilization: 75
        },
        impact: {
          costSavings: totalCost - consolidatedCost,
          performanceGain: 10,
          riskScore: 0.3,
          implementationEffort: 'medium'
        },
        confidence: 0.75,
        reasoning: `${group.length} similar resources can be consolidated`,
        automationAvailable: false,
        approvalRequired: true,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      });
    });
    
    // 3. AI-powered recommendations
    if (this.aiInsights) {
      const aiRecommendations = await this.aiInsights.generateRecommendations(
        'resource_optimization',
        { allocations, pools, historical: historicalData }
      );
      recommendations.push(...this.transformAIRecommendations(aiRecommendations));
    }
    
    return recommendations.sort((a, b) => b.impact.costSavings - a.impact.costSavings);
  }
  
  // Capacity Forecasting
  async forecastCapacity(
    resourceId: string,
    historicalData: any[],
    horizon: number
  ): Promise<CapacityForecast> {
    // Use metrics analytics for time series forecasting
    const predictions = await this.metricsAnalytics?.forecastMetric(
      `resource.${resourceId}.usage`,
      horizon
    );
    
    // Calculate exhaustion date
    const pool = this.resourceCache.get(resourceId);
    let exhaustionDate: Date | undefined;
    
    if (pool && predictions) {
      const capacityLimit = pool.totalCapacity;
      const exhaustionPoint = predictions.find((p: any) => p.value >= capacityLimit);
      if (exhaustionPoint) {
        exhaustionDate = new Date(exhaustionPoint.timestamp);
      }
    }
    
    // Detect seasonal patterns
    const seasonalPatterns = this.detectSeasonalPatterns(historicalData);
    
    return {
      resourceId,
      resourceType: pool?.type || 'unknown',
      predictions: predictions?.map((p: any) => ({
        timestamp: new Date(p.timestamp),
        predictedUsage: p.value,
        confidenceInterval: [p.lower, p.upper],
        probabilityOfExhaustion: this.calculateExhaustionProbability(p.value, pool?.totalCapacity)
      })) || [],
      exhaustionDate,
      recommendedAction: exhaustionDate 
        ? `Increase capacity before ${exhaustionDate.toLocaleDateString()}`
        : undefined,
      seasonalPatterns
    };
  }
  
  // Auto-scaling Evaluation
  evaluateScalingPolicy(
    policy: AutoScalingPolicy,
    currentMetrics: any,
    pool: ResourcePool
  ): { shouldScale: boolean; action?: any } {
    if (!policy.enabled) {
      return { shouldScale: false };
    }
    
    // Check cooldown period
    if (policy.lastTriggered) {
      const cooldownEnd = new Date(policy.lastTriggered.getTime() + 300000); // 5 min default
      if (new Date() < cooldownEnd) {
        return { shouldScale: false };
      }
    }
    
    // Evaluate triggers
    for (const trigger of policy.triggers) {
      const metricValue = currentMetrics[trigger.metric];
      if (!metricValue) continue;
      
      const triggered = this.evaluateTrigger(metricValue, trigger);
      if (triggered) {
        // Find appropriate action
        const action = policy.actions.find(a => {
          if (trigger.operator === 'gt' || trigger.operator === 'gte') {
            return a.type === 'scale_up' || a.type === 'scale_out';
          } else {
            return a.type === 'scale_down' || a.type === 'scale_in';
          }
        });
        
        if (action) {
          // Check constraints
          const newCapacity = this.calculateNewCapacity(pool, action);
          if (newCapacity >= policy.constraints.minCapacity &&
              newCapacity <= policy.constraints.maxCapacity) {
            return { shouldScale: true, action };
          }
        }
      }
    }
    
    return { shouldScale: false };
  }
  
  // Cost Analysis
  async analyzeCostOptimizations(
    allocations: ResourceAllocation[],
    pools: ResourcePool[],
    pricing: any
  ): Promise<CostOptimization[]> {
    const optimizations: CostOptimization[] = [];
    
    // 1. Find unused resources
    const unused = allocations.filter(a => a.utilization === 0);
    if (unused.length > 0) {
      const totalCost = unused.reduce((sum, a) => sum + a.cost, 0);
      optimizations.push({
        id: `cost_opt_unused_${Date.now()}`,
        category: 'unused',
        resourceIds: unused.map(a => a.resourceId),
        currentCost: totalCost,
        optimizedCost: 0,
        savingsAmount: totalCost,
        savingsPercentage: 100,
        implementationSteps: [
          'Verify resources are truly unused',
          'Back up any associated data',
          'Deallocate resources',
          'Clean up any dependencies'
        ],
        automationScript: this.generateDeallocationScript(unused),
        riskAssessment: {
          level: 'low',
          factors: ['Potential data loss if not backed up'],
          mitigations: ['Create backups before deallocation']
        }
      });
    }
    
    // 2. Reserved instance opportunities
    const onDemandResources = allocations.filter(a => !a.tags.includes('reserved'));
    const riOpportunity = this.calculateRISavings(onDemandResources, pricing);
    if (riOpportunity.savings > 0) {
      optimizations.push({
        id: `cost_opt_ri_${Date.now()}`,
        category: 'reserved_instance',
        resourceIds: riOpportunity.resourceIds,
        currentCost: riOpportunity.currentCost,
        optimizedCost: riOpportunity.optimizedCost,
        savingsAmount: riOpportunity.savings,
        savingsPercentage: (riOpportunity.savings / riOpportunity.currentCost) * 100,
        implementationSteps: [
          'Analyze usage patterns for stability',
          'Calculate optimal reservation term',
          'Purchase reserved instances',
          'Migrate workloads to reserved instances'
        ],
        riskAssessment: {
          level: 'medium',
          factors: [
            'Long-term commitment required',
            'Usage patterns may change'
          ],
          mitigations: [
            'Start with shorter reservation terms',
            'Monitor usage trends before committing'
          ]
        }
      });
    }
    
    // 3. Spot instance opportunities
    const spotCandidates = allocations.filter(a => 
      a.priority === 'low' && !a.tags.includes('spot')
    );
    const spotSavings = this.calculateSpotSavings(spotCandidates, pricing);
    if (spotSavings.savings > 0) {
      optimizations.push({
        id: `cost_opt_spot_${Date.now()}`,
        category: 'spot_opportunity',
        resourceIds: spotSavings.resourceIds,
        currentCost: spotSavings.currentCost,
        optimizedCost: spotSavings.optimizedCost,
        savingsAmount: spotSavings.savings,
        savingsPercentage: (spotSavings.savings / spotSavings.currentCost) * 100,
        implementationSteps: [
          'Identify interruption-tolerant workloads',
          'Implement spot instance handling',
          'Configure spot fleet or auto-scaling groups',
          'Set up fallback to on-demand if needed'
        ],
        riskAssessment: {
          level: 'high',
          factors: [
            'Instance interruptions possible',
            'Price volatility'
          ],
          mitigations: [
            'Implement graceful shutdown handling',
            'Use spot fleet for availability',
            'Set maximum spot price limits'
          ]
        }
      });
    }
    
    return optimizations.sort((a, b) => b.savingsAmount - a.savingsAmount);
  }
  
  // Helper methods
  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const groupKey = String(item[key]);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }
  
  private calculateTrend(resourceType: string): number {
    // Simplified trend calculation
    return Math.random() * 20 - 10; // -10% to +10%
  }
  
  private forecastUtilization(resourceType: string, days: number): number[] {
    // Simplified forecast
    const forecast = [];
    let current = Math.random() * 100;
    for (let i = 0; i < days; i++) {
      current = Math.max(0, Math.min(100, current + (Math.random() * 20 - 10)));
      forecast.push(current);
    }
    return forecast;
  }
  
  private findConsolidationOpportunities(allocations: ResourceAllocation[]): ResourceAllocation[][] {
    const groups: ResourceAllocation[][] = [];
    const processed = new Set<string>();
    
    allocations.forEach(allocation => {
      if (processed.has(allocation.id)) return;
      
      const similar = allocations.filter(a => 
        !processed.has(a.id) &&
        a.resourceType === allocation.resourceType &&
        a.utilization < 40 &&
        a.priority === allocation.priority
      );
      
      if (similar.length >= 2) {
        similar.forEach(a => processed.add(a.id));
        groups.push(similar);
      }
    });
    
    return groups;
  }
  
  private transformAIRecommendations(aiRecs: any[]): OptimizationRecommendation[] {
    return aiRecs.map(rec => ({
      id: rec.id || `ai_rec_${Date.now()}`,
      type: rec.type || 'rightsizing',
      resourceId: rec.resourceId,
      resourceType: rec.resourceType || 'unknown',
      currentState: rec.current || {},
      recommendedState: rec.recommended || {},
      impact: {
        costSavings: rec.savings || 0,
        performanceGain: rec.performanceGain || 0,
        riskScore: rec.risk || 0.5,
        implementationEffort: rec.effort || 'medium'
      },
      confidence: rec.confidence || 0.7,
      reasoning: rec.explanation || 'AI-generated recommendation',
      automationAvailable: rec.automatable || false,
      approvalRequired: rec.requiresApproval !== false,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }));
  }
  
  private detectSeasonalPatterns(data: any[]): Array<{ period: string; pattern: number[] }> {
    // Simplified seasonal pattern detection
    return [
      {
        period: 'daily',
        pattern: Array(24).fill(0).map((_, i) => 50 + Math.sin(i * Math.PI / 12) * 30)
      },
      {
        period: 'weekly',
        pattern: Array(7).fill(0).map((_, i) => i < 5 ? 80 : 40)
      }
    ];
  }
  
  private calculateExhaustionProbability(usage: number, capacity?: number): number {
    if (!capacity) return 0;
    const ratio = usage / capacity;
    return Math.min(1, Math.max(0, ratio * ratio));
  }
  
  private evaluateTrigger(value: number, trigger: any): boolean {
    switch (trigger.operator) {
      case 'gt': return value > trigger.threshold;
      case 'lt': return value < trigger.threshold;
      case 'gte': return value >= trigger.threshold;
      case 'lte': return value <= trigger.threshold;
      case 'eq': return value === trigger.threshold;
      default: return false;
    }
  }
  
  private calculateNewCapacity(pool: ResourcePool, action: any): number {
    let newCapacity = pool.totalCapacity;
    
    switch (action.type) {
      case 'scale_up':
      case 'scale_out':
        newCapacity += action.amount;
        break;
      case 'scale_down':
      case 'scale_in':
        newCapacity -= action.amount;
        break;
    }
    
    return newCapacity;
  }
  
  private generateDeallocationScript(resources: ResourceAllocation[]): string {
    return `#!/bin/bash
# Auto-generated deallocation script
# Generated: ${new Date().toISOString()}

# Resources to deallocate:
${resources.map(r => `# - ${r.resourceId} (${r.resourceType})`).join('\n')}

# Implementation would depend on resource type and platform
echo "Deallocation script would be implemented here"
`;
  }
  
  private calculateRISavings(resources: ResourceAllocation[], pricing: any): any {
    const currentCost = resources.reduce((sum, r) => sum + r.cost, 0);
    const optimizedCost = currentCost * 0.6; // Assume 40% savings with RI
    
    return {
      resourceIds: resources.map(r => r.resourceId),
      currentCost,
      optimizedCost,
      savings: currentCost - optimizedCost
    };
  }
  
  private calculateSpotSavings(resources: ResourceAllocation[], pricing: any): any {
    const currentCost = resources.reduce((sum, r) => sum + r.cost, 0);
    const optimizedCost = currentCost * 0.3; // Assume 70% savings with spot
    
    return {
      resourceIds: resources.map(r => r.resourceId),
      currentCost,
      optimizedCost,
      savings: currentCost - optimizedCost
    };
  }
  
  // Cleanup
  cleanup() {
    if (this.scalingEvaluator) {
      clearInterval(this.scalingEvaluator);
    }
    this.resourceCache.clear();
    this.optimizationQueue = [];
  }
}

// ---------------------------------
// 3. Context Implementation
// ---------------------------------

const ResourceOptimizationContext = createContext<ResourceOptimizationContextProps | undefined>(undefined);

export const ResourceOptimizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { syncData } = useSync();
  const { subscribe: subscribeRealtime } = useRealtimeStream();
  const aiInsights = useAIInsights();
  const metricsAnalytics = useMetricsAnalytics();
  
  // State
  const [resourcePools, setResourcePools] = useState<AsyncState<ResourcePool[]>>(AsyncStateHelpers.createEmpty([]));
  const [allocations, setAllocations] = useState<AsyncState<ResourceAllocation[]>>(AsyncStateHelpers.createEmpty([]));
  const [recommendations, setRecommendations] = useState<AsyncState<OptimizationRecommendation[]>>(AsyncStateHelpers.createEmpty([]));
  const [forecasts] = useState<Map<string, CapacityForecast>>(new Map());
  const [scalingPolicies, setScalingPolicies] = useState<AutoScalingPolicy[]>([]);
  const [costOptimizations, setCostOptimizations] = useState<AsyncState<CostOptimization[]>>(AsyncStateHelpers.createEmpty([]));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOptimizationRun, setLastOptimizationRun] = useState<Date | null>(null);
  const [optimizationStatus, setOptimizationStatus] = useState<'idle' | 'analyzing' | 'optimizing' | 'completed'>('idle');
  
  // Refs
  const engineRef = useRef<ResourceOptimizationEngine | null>(null);
  const subscriptionsRef = useRef<Map<string, () => void>>(new Map());
  const optimizationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Initialize optimization engine
  useEffect(() => {
    if (currentTenant) {
      engineRef.current = new ResourceOptimizationEngine(
        currentTenant,
        aiInsights,
        metricsAnalytics
      );
      
      // Start periodic optimization runs
      optimizationIntervalRef.current = setInterval(() => {
        runOptimizationAnalysis();
      }, 300000); // Every 5 minutes
      
      // Initial load
      loadResourceData();
      
      return () => {
        if (optimizationIntervalRef.current) {
          clearInterval(optimizationIntervalRef.current);
        }
        engineRef.current?.cleanup();
      };
    }
  }, [currentTenant]);
  
  // Load resource data
  const loadResourceData = async () => {
    setLoading(true);
    try {
      // Load from sync/backend
      const poolsData = await syncData('resourcePools');
      const allocationsData = await syncData('resourceAllocations');
      const policiesData = await syncData('scalingPolicies');
      
      setResourcePools(poolsData || []);
      setAllocations(allocationsData || []);
      setScalingPolicies(policiesData || []);
      
      setError(null);
    } catch (err) {
      console.error('Failed to load resource data:', err);
      setError('Failed to load resource data');
    } finally {
      setLoading(false);
    }
  };
  
  // Run optimization analysis
  const runOptimizationAnalysis = async () => {
    if (optimizationStatus !== 'idle' || !engineRef.current) return;
    
    setOptimizationStatus('analyzing');
    try {
      // Generate recommendations
      const newRecommendations = await engineRef.current.generateOptimizationRecommendations(
        allocations,
        resourcePools,
        [] // Historical data would come from metrics
      );
      setRecommendations(newRecommendations);
      
      // Analyze cost optimizations
      const costOpts = await engineRef.current.analyzeCostOptimizations(
        allocations,
        resourcePools,
        {} // Pricing data would come from config
      );
      setCostOptimizations(costOpts);
      
      setLastOptimizationRun(new Date());
      setOptimizationStatus('completed');
      
      // Reset status after delay
      setTimeout(() => setOptimizationStatus('idle'), 5000);
    } catch (err) {
      console.error('Optimization analysis failed:', err);
      setOptimizationStatus('idle');
    }
  };
  
  // Context methods
  const getResourcePool = useCallback((id: string) => {
    return resourcePools.find(p => p.id === id);
  }, [resourcePools]);
  
  const updateResourcePool = useCallback(async (id: string, updates: Partial<ResourcePool>) => {
    setResourcePools(prev => prev.map(p => 
      p.id === id ? { ...p, ...updates } : p
    ));
    await syncData('updateResourcePool', { id, updates });
  }, [syncData]);
  
  const allocateResource = useCallback(async (allocation: Omit<ResourceAllocation, 'id'>) => {
    const newAllocation = {
      ...allocation,
      id: `alloc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    } as ResourceAllocation;
    
    setAllocations(prev => [...prev, newAllocation]);
    await syncData('createAllocation', newAllocation);
    return newAllocation;
  }, [syncData]);
  
  const deallocateResource = useCallback(async (allocationId: string) => {
    setAllocations(prev => prev.filter(a => a.id !== allocationId));
    await syncData('deleteAllocation', { id: allocationId });
  }, [syncData]);
  
  const reallocateResource = useCallback(async (allocationId: string, newTarget: string) => {
    setAllocations(prev => prev.map(a => 
      a.id === allocationId ? { ...a, allocatedTo: newTarget } : a
    ));
    await syncData('updateAllocation', { id: allocationId, allocatedTo: newTarget });
  }, [syncData]);
  
  const applyRecommendation = useCallback(async (recommendationId: string) => {
    const recommendation = recommendations.find(r => r.id === recommendationId);
    if (!recommendation) return;
    
    setOptimizationStatus('optimizing');
    try {
      // Apply the recommendation based on type
      if (recommendation.automationAvailable) {
        await syncData('applyOptimization', { recommendation });
      }
      
      // Remove from recommendations
      setRecommendations(prev => prev.filter(r => r.id !== recommendationId));
      
      // Refresh data
      await loadResourceData();
      
      setOptimizationStatus('completed');
      setTimeout(() => setOptimizationStatus('idle'), 3000);
    } catch (err) {
      console.error('Failed to apply recommendation:', err);
      setOptimizationStatus('idle');
      throw err;
    }
  }, [recommendations, syncData]);
  
  const dismissRecommendation = useCallback(async (recommendationId: string, reason?: string) => {
    setRecommendations(prev => prev.filter(r => r.id !== recommendationId));
    await syncData('dismissRecommendation', { id: recommendationId, reason });
  }, [syncData]);
  
  const scheduleOptimization = useCallback(async (recommendationId: string, scheduledTime: Date) => {
    await syncData('scheduleOptimization', { id: recommendationId, scheduledTime });
  }, [syncData]);
  
  const requestForecast = useCallback(async (resourceId: string, horizon: number) => {
    if (!engineRef.current) throw new Error('Optimization engine not initialized');
    
    const forecast = await engineRef.current.forecastCapacity(
      resourceId,
      [], // Historical data would be fetched
      horizon
    );
    
    forecasts.set(resourceId, forecast);
    return forecast;
  }, [forecasts]);
  
  const getCapacityTrends = useCallback((resourceType: string, period: 'hour' | 'day' | 'week' | 'month') => {
    // Implementation would fetch and process historical data
    return [];
  }, []);
  
  const createScalingPolicy = useCallback(async (policy: Omit<AutoScalingPolicy, 'id' | 'history'>) => {
    const newPolicy = {
      ...policy,
      id: `policy_${Date.now()}`,
      history: []
    } as AutoScalingPolicy;
    
    setScalingPolicies(prev => [...prev, newPolicy]);
    await syncData('createScalingPolicy', newPolicy);
    return newPolicy;
  }, [syncData]);
  
  const updateScalingPolicy = useCallback(async (policyId: string, updates: Partial<AutoScalingPolicy>) => {
    setScalingPolicies(prev => prev.map(p => 
      p.id === policyId ? { ...p, ...updates } : p
    ));
    await syncData('updateScalingPolicy', { id: policyId, updates });
  }, [syncData]);
  
  const deleteScalingPolicy = useCallback(async (policyId: string) => {
    setScalingPolicies(prev => prev.filter(p => p.id !== policyId));
    await syncData('deleteScalingPolicy', { id: policyId });
  }, [syncData]);
  
  const evaluateScalingPolicies = useCallback(async () => {
    if (!engineRef.current) return;
    
    for (const policy of scalingPolicies) {
      const pool = resourcePools.find(p => p.id === policy.resourcePoolId);
      if (!pool) continue;
      
      // Get current metrics (would come from real-time data)
      const currentMetrics = {
        cpu: pool.usedCapacity / pool.totalCapacity * 100,
        memory: pool.usedCapacity / pool.totalCapacity * 100
      };
      
      const result = engineRef.current.evaluateScalingPolicy(policy, currentMetrics, pool);
      if (result.shouldScale && result.action) {
        // Apply scaling action
        await syncData('executeScalingAction', {
          policyId: policy.id,
          action: result.action
        });
        
        // Update policy history
        await updateScalingPolicy(policy.id, {
          lastTriggered: new Date(),
          history: [
            ...policy.history,
            {
              timestamp: new Date(),
              trigger: 'threshold',
              action: result.action.type,
              result: 'success'
            }
          ]
        });
      }
    }
  }, [scalingPolicies, resourcePools, syncData, updateScalingPolicy]);
  
  const analyzeCostOptimizations = useCallback(async () => {
    if (!engineRef.current) return [];
    
    const optimizations = await engineRef.current.analyzeCostOptimizations(
      allocations,
      resourcePools,
      {} // Pricing data
    );
    
    setCostOptimizations(optimizations);
    return optimizations;
  }, [allocations, resourcePools]);
  
  const implementCostOptimization = useCallback(async (optimizationId: string) => {
    const optimization = costOptimizations.find(o => o.id === optimizationId);
    if (!optimization) return;
    
    await syncData('implementCostOptimization', { optimization });
    
    // Remove from list
    setCostOptimizations(prev => prev.filter(o => o.id !== optimizationId));
    
    // Refresh data
    await loadResourceData();
  }, [costOptimizations, syncData]);
  
  const getCostTrends = useCallback((period: 'day' | 'week' | 'month' | 'quarter') => {
    // Implementation would fetch and process cost data
    return [];
  }, []);
  
  const discoverResources = useCallback(async () => {
    setLoading(true);
    try {
      const discovered = await syncData('discoverResources');
      // Process and add discovered resources
      setLoading(false);
    } catch (err) {
      console.error('Resource discovery failed:', err);
      setLoading(false);
      throw err;
    }
  }, [syncData]);
  
  const importResourceInventory = useCallback(async (source: 'cloud' | 'onprem' | 'hybrid', config: any) => {
    await syncData('importInventory', { source, config });
    await loadResourceData();
  }, [syncData]);
  
  const planCapacity = useCallback(async (requirements: any, constraints: any) => {
    return syncData('planCapacity', { requirements, constraints });
  }, [syncData]);
  
  const simulateCapacityScenario = useCallback(async (scenario: any) => {
    return syncData('simulateScenario', { scenario });
  }, [syncData]);
  
  const getResourceUtilization = useCallback((resourceId?: string) => {
    if (resourceId) {
      const allocation = allocations.find(a => a.resourceId === resourceId);
      return allocation?.utilization || 0;
    }
    
    // Overall utilization
    const totalUtil = allocations.reduce((sum, a) => sum + a.utilization, 0);
    return allocations.length > 0 ? totalUtil / allocations.length : 0;
  }, [allocations]);
  
  const getEfficiencyScore = useCallback(() => {
    // Calculate overall efficiency score
    const utilization = getResourceUtilization();
    const wasteFactor = costOptimizations.reduce((sum, o) => sum + o.savingsPercentage, 0) / 100;
    return Math.max(0, Math.min(100, utilization - wasteFactor * 10));
  }, [getResourceUtilization, costOptimizations]);
  
  const getWasteMetrics = useCallback(() => {
    return {
      unusedResources: allocations.filter(a => a.utilization === 0).length,
      underutilized: allocations.filter(a => a.utilization < 30).length,
      overprovisioned: allocations.filter(a => a.utilization < 50 && a.cost > 1000).length,
      potentialSavings: costOptimizations.reduce((sum, o) => sum + o.savingsAmount, 0)
    };
  }, [allocations, costOptimizations]);
  
  const getOptimizationHistory = useCallback((days: number) => {
    // Would fetch historical optimization data
    return [];
  }, []);
  
  const subscribeToResourceMetrics = useCallback((resourceId: string, callback: (metrics: any) => void) => {
    const unsubscribe = subscribeRealtime('metrics', (data: any) => {
      if (data.resourceId === resourceId) {
        callback(data.metrics);
      }
    });
    
    subscriptionsRef.current.set(`metrics_${resourceId}`, unsubscribe);
    return unsubscribe;
  }, [subscribeRealtime]);
  
  const subscribeToOptimizationEvents = useCallback((callback: (event: any) => void) => {
    const unsubscribe = subscribeRealtime('optimization', callback);
    subscriptionsRef.current.set('optimization_events', unsubscribe);
    return unsubscribe;
  }, [subscribeRealtime]);
  
  // Memoized context value
  const contextValue = useMemo(() => ({
    // Resource Pools
    resourcePools,
    getResourcePool,
    updateResourcePool,
    
    // Allocations
    allocations,
    allocateResource,
    deallocateResource,
    reallocateResource,
    
    // Optimization
    recommendations,
    applyRecommendation,
    dismissRecommendation,
    scheduleOptimization,
    
    // Forecasting
    forecasts,
    requestForecast,
    getCapacityTrends,
    
    // Auto-scaling
    scalingPolicies,
    createScalingPolicy,
    updateScalingPolicy,
    deleteScalingPolicy,
    evaluateScalingPolicies,
    
    // Cost Optimization
    costOptimizations,
    analyzeCostOptimizations,
    implementCostOptimization,
    getCostTrends,
    
    // Resource Discovery
    discoverResources,
    importResourceInventory,
    
    // Capacity Planning
    planCapacity,
    simulateCapacityScenario,
    
    // Analytics
    getResourceUtilization,
    getEfficiencyScore,
    getWasteMetrics,
    getOptimizationHistory,
    
    // Real-time monitoring
    subscribeToResourceMetrics,
    subscribeToOptimizationEvents,
    
    // State
    loading,
    error,
    lastOptimizationRun,
    optimizationStatus
  }), [
    resourcePools,
    allocations,
    recommendations,
    forecasts,
    scalingPolicies,
    costOptimizations,
    loading,
    error,
    lastOptimizationRun,
    optimizationStatus,
    getResourcePool,
    updateResourcePool,
    allocateResource,
    deallocateResource,
    reallocateResource,
    applyRecommendation,
    dismissRecommendation,
    scheduleOptimization,
    requestForecast,
    getCapacityTrends,
    createScalingPolicy,
    updateScalingPolicy,
    deleteScalingPolicy,
    evaluateScalingPolicies,
    analyzeCostOptimizations,
    implementCostOptimization,
    getCostTrends,
    discoverResources,
    importResourceInventory,
    planCapacity,
    simulateCapacityScenario,
    getResourceUtilization,
    getEfficiencyScore,
    getWasteMetrics,
    getOptimizationHistory,
    subscribeToResourceMetrics,
    subscribeToOptimizationEvents
  ]);
  
  return (
    <ResourceOptimizationContext.Provider value={contextValue}>
      {children}
    </ResourceOptimizationContext.Provider>
  );
};

// ---------------------------------
// 4. Custom Hook
// ---------------------------------

export const useResourceOptimization = () => {
  const context = useContext(ResourceOptimizationContext);
  if (!context) {
    throw new Error('useResourceOptimization must be used within ResourceOptimizationProvider');
  }
  return context;
};

export default ResourceOptimizationContext;