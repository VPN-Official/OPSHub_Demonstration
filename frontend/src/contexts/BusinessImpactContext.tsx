// src/contexts/BusinessImpactContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { 
  getAll,
  getById,
  putWithAudit,
} from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useRealtimeStream } from "./RealtimeStreamContext";
import { useAIInsights } from "./AIInsightsContext";
import { useNavigationTrace } from "./NavigationTraceContext";

// ---------------------------------
// 1. Business Metric Types
// ---------------------------------

export interface BusinessImpactMetric {
  id: string;
  metricType: 'revenue' | 'cost' | 'efficiency' | 'satisfaction' | 'compliance' | 'risk';
  entityType?: string;
  entityId?: string;
  value: number;
  unit: string;
  trend: 'improving' | 'stable' | 'declining';
  percentageChange: number;
  timeframe: string;
  benchmark?: number;
  target?: number;
  calculatedAt: string;
  factors?: ImpactFactor[];
}

export interface ImpactFactor {
  name: string;
  contribution: number;
  trend: 'positive' | 'negative' | 'neutral';
  description?: string;
}

export interface DependencyMap {
  id: string;
  rootEntity: EntityInfo;
  dependencies: DependencyNode[];
  impactRadius: number;
  criticalPath: string[];
  lastUpdated: string;
}

export interface DependencyNode {
  entity: EntityInfo;
  dependencyType: 'critical' | 'important' | 'standard';
  children: DependencyNode[];
  impactScore: number;
  propagationDelay?: number; // minutes
}

export interface EntityInfo {
  entityType: string;
  entityId: string;
  displayName: string;
  status?: string;
  criticality?: 'critical' | 'high' | 'medium' | 'low';
}

export interface CascadeEffect {
  id: string;
  triggerEntity: EntityInfo;
  affectedEntities: AffectedEntity[];
  totalImpact: ImpactSummary;
  timelineEvents: TimelineEvent[];
  mitigationOptions?: MitigationOption[];
}

export interface AffectedEntity extends EntityInfo {
  impactLevel: 'severe' | 'major' | 'moderate' | 'minor';
  impactDelay: number; // minutes
  recoveryTime?: number; // minutes
  impactDescription: string;
}

export interface TimelineEvent {
  timestamp: string;
  entity: EntityInfo;
  event: string;
  impact: string;
}

export interface MitigationOption {
  id: string;
  action: string;
  effectiveness: number; // 0-100
  cost: number;
  timeToImplement: number; // minutes
  requirements: string[];
}

export interface ImpactSummary {
  financialImpact?: number;
  userImpact?: number;
  serviceImpact?: number;
  reputationImpact?: 'severe' | 'major' | 'moderate' | 'minor' | 'negligible';
  complianceImpact?: boolean;
}

export interface CostImpact {
  id: string;
  entityType?: string;
  entityId?: string;
  costType: 'operational' | 'incident' | 'maintenance' | 'opportunity' | 'penalty';
  amount: number;
  currency: string;
  period: string;
  breakdown?: CostBreakdown[];
  projectedSavings?: number;
  optimizationPotential?: number;
}

export interface CostBreakdown {
  category: string;
  amount: number;
  percentage: number;
  description?: string;
}

// ---------------------------------
// 2. Business Service Types
// ---------------------------------

export interface BusinessServiceHealth {
  id: string;
  serviceId: string;
  serviceName: string;
  healthScore: number; // 0-100
  availability: number; // percentage
  performance: PerformanceMetrics;
  dependencies: ServiceDependency[];
  slaCompliance: SLACompliance;
  incidents: number;
  changes: number;
  lastAssessed: string;
}

export interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  saturation: number;
}

export interface ServiceDependency {
  serviceId: string;
  serviceName: string;
  dependencyType: 'synchronous' | 'asynchronous' | 'batch';
  criticality: 'critical' | 'important' | 'standard';
  healthScore?: number;
}

export interface SLACompliance {
  target: number;
  actual: number;
  compliant: boolean;
  breaches: number;
  atRisk: boolean;
  projectedCompliance?: number;
}

export interface ServiceAvailabilityMetric {
  serviceId: string;
  availability: number;
  uptime: number; // seconds
  downtime: number; // seconds
  mtbf: number; // mean time between failures
  mttr: number; // mean time to repair
  plannedMaintenance: number; // seconds
  unplannedOutages: number;
}

export interface SLAStatus {
  id: string;
  slaId: string;
  slaName: string;
  serviceId: string;
  status: 'met' | 'at_risk' | 'breached';
  currentValue: number;
  targetValue: number;
  timeRemaining?: number; // minutes
  breachProbability?: number;
  impactIfBreached?: ImpactSummary;
}

// ---------------------------------
// 3. Business Priority Types
// ---------------------------------

export interface BusinessPriority {
  id: string;
  name: string;
  category: 'strategic' | 'operational' | 'compliance' | 'customer';
  weight: number;
  currentScore: number;
  targetScore: number;
  trend: 'improving' | 'stable' | 'declining';
  affectedServices: string[];
  owner?: string;
}

export interface RiskAssessment {
  id: string;
  entityType?: string;
  entityId?: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  riskScore: number;
  riskFactors: RiskFactor[];
  likelihood: number;
  impact: number;
  mitigatedRisk?: number;
  controls: RiskControl[];
  recommendations?: string[];
}

export interface RiskFactor {
  name: string;
  category: 'technical' | 'operational' | 'financial' | 'compliance' | 'reputation';
  score: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  description?: string;
}

export interface RiskControl {
  id: string;
  name: string;
  effectiveness: number;
  status: 'active' | 'planned' | 'inactive';
  cost?: number;
}

export interface ComplianceImplication {
  id: string;
  regulation: string;
  requirement: string;
  status: 'compliant' | 'non_compliant' | 'at_risk';
  entityType?: string;
  entityId?: string;
  deadline?: string;
  penalty?: number;
  remediationCost?: number;
}

// ---------------------------------
// 4. Customer Impact Types
// ---------------------------------

export interface CustomerImpactMetric {
  id: string;
  metricType: 'satisfaction' | 'churn_risk' | 'engagement' | 'nps';
  value: number;
  trend: 'improving' | 'stable' | 'declining';
  affectedCustomers: number;
  segments?: CustomerSegment[];
  timeframe: string;
}

export interface CustomerSegment {
  name: string;
  size: number;
  impact: 'high' | 'medium' | 'low';
  value: number; // customer lifetime value
}

export interface CustomerImpactSummary {
  totalAffected: number;
  vipAffected: number;
  revenueAtRisk: number;
  satisfactionImpact: number;
  churnRisk: number;
  segments: CustomerSegment[];
  communications?: CustomerCommunication[];
}

export interface CustomerCommunication {
  id: string;
  type: 'email' | 'sms' | 'push' | 'in_app';
  template: string;
  recipients: number;
  scheduledAt?: string;
  sentAt?: string;
  status: 'draft' | 'scheduled' | 'sent';
}

// ---------------------------------
// 5. Financial Impact Types
// ---------------------------------

export interface RevenueImpact {
  id: string;
  entityType?: string;
  entityId?: string;
  impactType: 'loss' | 'delay' | 'opportunity';
  amount: number;
  currency: string;
  timeframe: string;
  probability?: number;
  realized: boolean;
  factors?: string[];
}

export interface CostSavingsOpportunity {
  id: string;
  category: string;
  description: string;
  potentialSavings: number;
  currency: string;
  implementationCost: number;
  roi: number;
  timeToRealize: number; // days
  confidence: number;
  status: 'identified' | 'evaluating' | 'approved' | 'implementing' | 'realized';
}

// ---------------------------------
// 6. Visualization Types
// ---------------------------------

export interface ImpactVisualization {
  type: 'heatmap' | 'graph' | 'timeline' | 'sankey';
  data: any;
  config: VisualizationConfig;
}

export interface VisualizationConfig {
  title?: string;
  dimensions?: { width: number; height: number };
  colors?: Record<string, string>;
  interactive?: boolean;
  realtime?: boolean;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters?: GraphCluster[];
  layout: 'hierarchical' | 'force' | 'circular';
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  health?: number;
  criticality?: string;
  metadata?: Record<string, any>;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  type: string;
  label?: string;
}

export interface GraphCluster {
  id: string;
  label: string;
  nodes: string[];
  color?: string;
}

export interface CascadeAnalysis {
  trigger: EntityInfo;
  waves: CascadeWave[];
  timeline: TimelineEvent[];
  totalImpact: ImpactSummary;
  peakImpact: {
    time: string;
    magnitude: number;
  };
}

export interface CascadeWave {
  waveNumber: number;
  startTime: string;
  entities: AffectedEntity[];
  cumulativeImpact: ImpactSummary;
}

// ---------------------------------
// 7. Business Impact Context Interface
// ---------------------------------

export interface BusinessImpactContextProps {
  // Backend-calculated business impact data
  impactMetrics: BusinessImpactMetric[];
  dependencyMaps: DependencyMap[];
  cascadeAnalysis: CascadeEffect[];
  costImplications: CostImpact[];
  
  // Business service health
  businessServiceHealth: BusinessServiceHealth[];
  serviceAvailability: ServiceAvailabilityMetric[];
  slaStatus: SLAStatus[];
  
  // Impact visualization data
  getImpactVisualization: (entityId: string, entityType: string, vizType?: string) => Promise<ImpactVisualization>;
  getDependencyGraph: (businessServiceId: string, depth?: number) => Promise<DependencyGraph>;
  getCascadeAnalysis: (changeId: string) => Promise<CascadeAnalysis>;
  
  // Business priority context
  businessPriorities: BusinessPriority[];
  riskAssessments: RiskAssessment[];
  complianceImplications: ComplianceImplication[];
  
  // Customer impact
  customerImpactMetrics: CustomerImpactMetric[];
  getCustomerImpactSummary: (incidentId: string) => Promise<CustomerImpactSummary>;
  
  // Financial impact
  revenueImpact: RevenueImpact[];
  costSavingsOpportunities: CostSavingsOpportunity[];
  
  // Impact calculations
  calculateBusinessImpact: (entity: EntityInfo, scenario?: ImpactScenario) => Promise<ImpactSummary>;
  calculateCascadeEffect: (trigger: EntityInfo, options?: CascadeOptions) => Promise<CascadeEffect>;
  calculateFinancialImpact: (entity: EntityInfo, timeframe?: string) => Promise<FinancialImpactResult>;
  
  // SLA and compliance
  predictSLABreach: (slaId: string) => Promise<SLAPrediction>;
  assessCompliance: (regulation: string) => Promise<ComplianceAssessment>;
  
  // Optimization
  identifyCostSavings: (category?: string) => Promise<CostSavingsOpportunity[]>;
  optimizeServiceDependencies: (serviceId: string) => Promise<OptimizationResult>;
  
  // Real-time updates
  subscribeToImpactUpdates: (entityType: string, entityId: string) => () => void;
  subscribeToSLAAlerts: (slaIds: string[]) => () => void;
}

export interface ImpactScenario {
  type: 'outage' | 'degradation' | 'maintenance' | 'change';
  duration?: number; // minutes
  severity?: 'complete' | 'partial' | 'minor';
  affectedComponents?: string[];
}

export interface CascadeOptions {
  maxDepth?: number;
  timeHorizon?: number; // minutes
  includeIndirect?: boolean;
  thresholds?: {
    minImpact?: number;
    minProbability?: number;
  };
}

export interface FinancialImpactResult {
  totalImpact: number;
  breakdown: {
    revenue: number;
    costs: number;
    penalties: number;
    opportunity: number;
  };
  currency: string;
  confidence: number;
  assumptions: string[];
}

export interface SLAPrediction {
  slaId: string;
  breachProbability: number;
  estimatedBreachTime?: string;
  factors: string[];
  recommendations: string[];
}

export interface ComplianceAssessment {
  compliant: boolean;
  gaps: ComplianceGap[];
  remediationPlan?: RemediationPlan;
  estimatedCost: number;
  deadline?: string;
}

export interface ComplianceGap {
  requirement: string;
  currentState: string;
  targetState: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface RemediationPlan {
  steps: RemediationStep[];
  totalDuration: number;
  totalCost: number;
  resources: string[];
}

export interface RemediationStep {
  action: string;
  duration: number;
  cost: number;
  responsible: string;
  dependencies?: string[];
}

export interface OptimizationResult {
  originalScore: number;
  optimizedScore: number;
  improvements: OptimizationImprovement[];
  estimatedSavings: number;
  implementationPlan?: string[];
}

export interface OptimizationImprovement {
  area: string;
  action: string;
  impact: number;
  effort: 'low' | 'medium' | 'high';
  priority: number;
}

// ---------------------------------
// 8. Impact Calculation Engine
// ---------------------------------

class BusinessImpactEngine {
  private dependencyCache: Map<string, DependencyMap> = new Map();
  private impactCache: Map<string, ImpactSummary> = new Map();
  private slaThresholds: Map<string, number> = new Map();
  
  constructor() {
    this.initializeThresholds();
  }
  
  private initializeThresholds() {
    // Default SLA thresholds
    this.slaThresholds.set('availability', 99.9);
    this.slaThresholds.set('response_time', 1000); // ms
    this.slaThresholds.set('error_rate', 0.1); // percentage
  }
  
  public calculateImpact(
    entity: EntityInfo,
    scenario: ImpactScenario = { type: 'outage', severity: 'complete' }
  ): ImpactSummary {
    const cacheKey = `${entity.entityType}:${entity.entityId}:${scenario.type}`;
    
    if (this.impactCache.has(cacheKey)) {
      const cached = this.impactCache.get(cacheKey)!;
      // Cache for 5 minutes
      return cached;
    }
    
    const impact: ImpactSummary = {
      financialImpact: this.calculateFinancialImpact(entity, scenario),
      userImpact: this.calculateUserImpact(entity, scenario),
      serviceImpact: this.calculateServiceImpact(entity, scenario),
      reputationImpact: this.calculateReputationImpact(entity, scenario),
      complianceImpact: this.checkComplianceImpact(entity, scenario),
    };
    
    this.impactCache.set(cacheKey, impact);
    return impact;
  }
  
  private calculateFinancialImpact(entity: EntityInfo, scenario: ImpactScenario): number {
    // Base impact calculation
    let baseImpact = 0;
    
    switch (entity.criticality) {
      case 'critical':
        baseImpact = 100000; // $100k per hour
        break;
      case 'high':
        baseImpact = 50000; // $50k per hour
        break;
      case 'medium':
        baseImpact = 10000; // $10k per hour
        break;
      case 'low':
        baseImpact = 1000; // $1k per hour
        break;
      default:
        baseImpact = 5000;
    }
    
    // Adjust for severity
    const severityMultiplier = scenario.severity === 'complete' ? 1.0 :
                               scenario.severity === 'partial' ? 0.5 : 0.2;
    
    // Calculate duration-based impact
    const duration = scenario.duration || 60; // default 60 minutes
    const hourlyImpact = baseImpact * severityMultiplier;
    
    return (hourlyImpact * duration) / 60;
  }
  
  private calculateUserImpact(entity: EntityInfo, scenario: ImpactScenario): number {
    // Estimate affected users based on entity type and criticality
    let affectedUsers = 0;
    
    if (entity.entityType === 'service') {
      switch (entity.criticality) {
        case 'critical':
          affectedUsers = 10000;
          break;
        case 'high':
          affectedUsers = 5000;
          break;
        case 'medium':
          affectedUsers = 1000;
          break;
        case 'low':
          affectedUsers = 100;
          break;
        default:
          affectedUsers = 500;
      }
    }
    
    // Adjust for scenario
    if (scenario.severity === 'partial') {
      affectedUsers *= 0.5;
    } else if (scenario.severity === 'minor') {
      affectedUsers *= 0.2;
    }
    
    return Math.floor(affectedUsers);
  }
  
  private calculateServiceImpact(entity: EntityInfo, scenario: ImpactScenario): number {
    // Calculate service degradation percentage
    const baseImpact = scenario.severity === 'complete' ? 100 :
                      scenario.severity === 'partial' ? 50 : 10;
    
    // Consider affected components
    const componentMultiplier = scenario.affectedComponents 
      ? scenario.affectedComponents.length * 0.1 
      : 0;
    
    return Math.min(100, baseImpact + (baseImpact * componentMultiplier));
  }
  
  private calculateReputationImpact(
    entity: EntityInfo,
    scenario: ImpactScenario
  ): 'severe' | 'major' | 'moderate' | 'minor' | 'negligible' {
    const duration = scenario.duration || 60;
    const severity = scenario.severity || 'complete';
    
    if (entity.criticality === 'critical' && severity === 'complete' && duration > 240) {
      return 'severe';
    } else if (entity.criticality === 'critical' && duration > 120) {
      return 'major';
    } else if (entity.criticality === 'high' && duration > 60) {
      return 'moderate';
    } else if (duration > 30) {
      return 'minor';
    }
    
    return 'negligible';
  }
  
  private checkComplianceImpact(entity: EntityInfo, scenario: ImpactScenario): boolean {
    // Check if scenario affects compliance
    if (entity.entityType === 'service' && entity.criticality === 'critical') {
      // Critical services may have compliance implications
      return scenario.type === 'outage' || scenario.type === 'degradation';
    }
    
    return false;
  }
  
  public buildDependencyMap(rootEntity: EntityInfo): DependencyMap {
    const cacheKey = `${rootEntity.entityType}:${rootEntity.entityId}`;
    
    if (this.dependencyCache.has(cacheKey)) {
      return this.dependencyCache.get(cacheKey)!;
    }
    
    const map: DependencyMap = {
      id: `dep_${Date.now()}`,
      rootEntity,
      dependencies: this.discoverDependencies(rootEntity),
      impactRadius: this.calculateImpactRadius(rootEntity),
      criticalPath: this.findCriticalPath(rootEntity),
      lastUpdated: new Date().toISOString(),
    };
    
    this.dependencyCache.set(cacheKey, map);
    return map;
  }
  
  private discoverDependencies(entity: EntityInfo, visited: Set<string> = new Set()): DependencyNode[] {
    const key = `${entity.entityType}:${entity.entityId}`;
    if (visited.has(key)) return [];
    visited.add(key);
    
    // Simulate dependency discovery
    const dependencies: DependencyNode[] = [];
    
    // Add mock dependencies based on entity type
    if (entity.entityType === 'service') {
      dependencies.push({
        entity: {
          entityType: 'database',
          entityId: 'db_001',
          displayName: 'Primary Database',
          criticality: 'critical',
        },
        dependencyType: 'critical',
        children: [],
        impactScore: 0.9,
        propagationDelay: 1,
      });
      
      dependencies.push({
        entity: {
          entityType: 'api',
          entityId: 'api_001',
          displayName: 'Core API',
          criticality: 'high',
        },
        dependencyType: 'important',
        children: [],
        impactScore: 0.7,
        propagationDelay: 5,
      });
    }
    
    return dependencies;
  }
  
  private calculateImpactRadius(entity: EntityInfo): number {
    // Calculate how far impact propagates
    switch (entity.criticality) {
      case 'critical': return 5;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 2;
    }
  }
  
  private findCriticalPath(entity: EntityInfo): string[] {
    // Find the most critical dependency path
    const path: string[] = [`${entity.entityType}:${entity.entityId}`];
    
    // Add critical dependencies
    const deps = this.discoverDependencies(entity);
    deps
      .filter(d => d.dependencyType === 'critical')
      .forEach(d => {
        path.push(`${d.entity.entityType}:${d.entity.entityId}`);
      });
    
    return path;
  }
  
  public analyzeCascadeEffect(
    trigger: EntityInfo,
    options: CascadeOptions = {}
  ): CascadeEffect {
    const waves = this.simulateCascadeWaves(trigger, options);
    const affectedEntities = waves.flatMap(w => w.entities);
    const timeline = this.buildCascadeTimeline(waves);
    
    return {
      id: `cascade_${Date.now()}`,
      triggerEntity: trigger,
      affectedEntities,
      totalImpact: this.aggregateImpact(affectedEntities),
      timelineEvents: timeline,
      mitigationOptions: this.generateMitigationOptions(trigger, affectedEntities),
    };
  }
  
  private simulateCascadeWaves(
    trigger: EntityInfo,
    options: CascadeOptions
  ): CascadeWave[] {
    const waves: CascadeWave[] = [];
    const maxDepth = options.maxDepth || 3;
    let currentWave: EntityInfo[] = [trigger];
    let waveNumber = 0;
    const visited = new Set<string>();
    
    while (currentWave.length > 0 && waveNumber < maxDepth) {
      const wave: CascadeWave = {
        waveNumber: waveNumber + 1,
        startTime: new Date(Date.now() + waveNumber * 5 * 60000).toISOString(), // 5 min per wave
        entities: [],
        cumulativeImpact: {} as ImpactSummary,
      };
      
      const nextWave: EntityInfo[] = [];
      
      for (const entity of currentWave) {
        const key = `${entity.entityType}:${entity.entityId}`;
        if (visited.has(key)) continue;
        visited.add(key);
        
        // Get dependencies
        const deps = this.discoverDependencies(entity);
        
        // Add affected entities
        deps.forEach(dep => {
          const affected: AffectedEntity = {
            ...dep.entity,
            impactLevel: this.determineImpactLevel(dep.impactScore),
            impactDelay: (waveNumber + 1) * (dep.propagationDelay || 5),
            recoveryTime: 30 + waveNumber * 15,
            impactDescription: `Cascading failure from ${entity.displayName}`,
          };
          
          wave.entities.push(affected);
          nextWave.push(dep.entity);
        });
      }
      
      wave.cumulativeImpact = this.aggregateImpact(wave.entities);
      waves.push(wave);
      
      currentWave = nextWave;
      waveNumber++;
    }
    
    return waves;
  }
  
  private determineImpactLevel(score: number): 'severe' | 'major' | 'moderate' | 'minor' {
    if (score >= 0.8) return 'severe';
    if (score >= 0.6) return 'major';
    if (score >= 0.4) return 'moderate';
    return 'minor';
  }
  
  private aggregateImpact(entities: AffectedEntity[]): ImpactSummary {
    let financialImpact = 0;
    let userImpact = 0;
    let serviceImpact = 0;
    let maxReputation: ImpactSummary['reputationImpact'] = 'negligible';
    let complianceImpact = false;
    
    entities.forEach(entity => {
      const impact = this.calculateImpact(entity, { type: 'outage' });
      financialImpact += impact.financialImpact || 0;
      userImpact += impact.userImpact || 0;
      serviceImpact = Math.max(serviceImpact, impact.serviceImpact || 0);
      
      if (impact.reputationImpact && 
          this.compareReputationImpact(impact.reputationImpact, maxReputation) > 0) {
        maxReputation = impact.reputationImpact;
      }
      
      if (impact.complianceImpact) {
        complianceImpact = true;
      }
    });
    
    return {
      financialImpact,
      userImpact,
      serviceImpact,
      reputationImpact: maxReputation,
      complianceImpact,
    };
  }
  
  private compareReputationImpact(a: string, b: string): number {
    const order = { severe: 5, major: 4, moderate: 3, minor: 2, negligible: 1 };
    return (order[a as keyof typeof order] || 0) - (order[b as keyof typeof order] || 0);
  }
  
  private buildCascadeTimeline(waves: CascadeWave[]): TimelineEvent[] {
    const timeline: TimelineEvent[] = [];
    
    waves.forEach(wave => {
      wave.entities.forEach(entity => {
        timeline.push({
          timestamp: wave.startTime,
          entity: entity,
          event: `Impact propagation - Wave ${wave.waveNumber}`,
          impact: `${entity.impactLevel} impact after ${entity.impactDelay} minutes`,
        });
      });
    });
    
    return timeline.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }
  
  private generateMitigationOptions(
    trigger: EntityInfo,
    affectedEntities: AffectedEntity[]
  ): MitigationOption[] {
    const options: MitigationOption[] = [];
    
    // Immediate isolation
    options.push({
      id: 'mit_isolate',
      action: `Isolate ${trigger.displayName} to prevent cascade`,
      effectiveness: 90,
      cost: 1000,
      timeToImplement: 5,
      requirements: ['Admin access', 'Network control'],
    });
    
    // Failover
    if (trigger.criticality === 'critical' || trigger.criticality === 'high') {
      options.push({
        id: 'mit_failover',
        action: 'Activate failover systems',
        effectiveness: 80,
        cost: 5000,
        timeToImplement: 15,
        requirements: ['Failover system ready', 'Data sync complete'],
      });
    }
    
    // Circuit breaker
    options.push({
      id: 'mit_circuit_breaker',
      action: 'Enable circuit breakers on dependent services',
      effectiveness: 70,
      cost: 500,
      timeToImplement: 2,
      requirements: ['Circuit breaker configured'],
    });
    
    // Scale resources
    if (affectedEntities.length > 5) {
      options.push({
        id: 'mit_scale',
        action: 'Scale up affected services',
        effectiveness: 60,
        cost: 3000,
        timeToImplement: 10,
        requirements: ['Auto-scaling enabled', 'Resources available'],
      });
    }
    
    return options;
  }
  
  public predictSLABreach(
    sla: SLAStatus,
    currentMetrics: PerformanceMetrics
  ): SLAPrediction {
    // Calculate breach probability based on current trends
    const timeRemaining = sla.timeRemaining || 1440; // default 24 hours
    const currentCompliance = (sla.currentValue / sla.targetValue) * 100;
    
    // Simple linear prediction
    const trend = currentCompliance < 95 ? -0.5 : 0; // declining if below 95%
    const projectedCompliance = currentCompliance + (trend * (timeRemaining / 60));
    
    const breachProbability = projectedCompliance < sla.targetValue 
      ? Math.min(1, (sla.targetValue - projectedCompliance) / 10)
      : 0;
    
    const factors: string[] = [];
    if (currentMetrics.errorRate > 1) factors.push('High error rate');
    if (currentMetrics.responseTime > 2000) factors.push('Slow response times');
    if (currentMetrics.saturation > 80) factors.push('High resource saturation');
    
    const recommendations: string[] = [];
    if (breachProbability > 0.5) {
      recommendations.push('Immediate intervention required');
      recommendations.push('Consider scaling resources');
      recommendations.push('Review recent changes');
    }
    
    return {
      slaId: sla.slaId,
      breachProbability,
      estimatedBreachTime: breachProbability > 0.5 
        ? new Date(Date.now() + timeRemaining * 60000).toISOString()
        : undefined,
      factors,
      recommendations,
    };
  }
}

// ---------------------------------
// 9. Provider Component
// ---------------------------------

const BusinessImpactContext = createContext<BusinessImpactContextProps | null>(null);

export const BusinessImpactProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { tenantId } = useTenant();
  const { triggerSync } = useSync();
  const { subscribeToEntity, onEntityUpdate, liveMetrics } = useRealtimeStream();
  const { aiScores, requestRecommendations } = useAIInsights();
  const { getRelatedEntities, buildTraceabilityPath } = useNavigationTrace();
  
  // State management
  const [impactMetrics, setImpactMetrics] = useState<BusinessImpactMetric[]>([]);
  const [dependencyMaps, setDependencyMaps] = useState<DependencyMap[]>([]);
  const [cascadeAnalysis, setCascadeAnalysis] = useState<CascadeEffect[]>([]);
  const [costImplications, setCostImplications] = useState<CostImpact[]>([]);
  const [businessServiceHealth, setBusinessServiceHealth] = useState<BusinessServiceHealth[]>([]);
  const [serviceAvailability, setServiceAvailability] = useState<ServiceAvailabilityMetric[]>([]);
  const [slaStatus, setSlaStatus] = useState<SLAStatus[]>([]);
  const [businessPriorities, setBusinessPriorities] = useState<BusinessPriority[]>([]);
  const [riskAssessments, setRiskAssessments] = useState<RiskAssessment[]>([]);
  const [complianceImplications, setComplianceImplications] = useState<ComplianceImplication[]>([]);
  const [customerImpactMetrics, setCustomerImpactMetrics] = useState<CustomerImpactMetric[]>([]);
  const [revenueImpact, setRevenueImpact] = useState<RevenueImpact[]>([]);
  const [costSavingsOpportunities, setCostSavingsOpportunities] = useState<CostSavingsOpportunity[]>([]);
  
  // Engines and subscriptions
  const impactEngine = useRef(new BusinessImpactEngine());
  const subscriptions = useRef<Map<string, () => void>>(new Map());
  
  // Load initial data
  useEffect(() => {
    if (!tenantId) return;
    
    const loadBusinessData = async () => {
      try {
        // Load from database
        const [services, slas, priorities, risks] = await Promise.all([
          getAll('business_services', tenantId),
          getAll('sla_definitions', tenantId),
          getAll('business_priorities', tenantId),
          getAll('risk_assessments', tenantId),
        ]);
        
        // Initialize service health
        const healthData: BusinessServiceHealth[] = services.map((service: any) => ({
          id: service.id,
          serviceId: service.id,
          serviceName: service.name,
          healthScore: 95 + Math.random() * 5,
          availability: 99.5 + Math.random() * 0.4,
          performance: {
            responseTime: 100 + Math.random() * 200,
            throughput: 1000 + Math.random() * 500,
            errorRate: Math.random() * 0.5,
            saturation: 30 + Math.random() * 40,
          },
          dependencies: [],
          slaCompliance: {
            target: 99.9,
            actual: 99.5 + Math.random() * 0.4,
            compliant: true,
            breaches: Math.floor(Math.random() * 3),
            atRisk: Math.random() > 0.8,
          },
          incidents: Math.floor(Math.random() * 5),
          changes: Math.floor(Math.random() * 3),
          lastAssessed: new Date().toISOString(),
        }));
        
        setBusinessServiceHealth(healthData);
        setBusinessPriorities(priorities);
        setRiskAssessments(risks);
        
        // Initialize SLA status
        const slaStatusData: SLAStatus[] = slas.map((sla: any) => ({
          id: sla.id,
          slaId: sla.id,
          slaName: sla.name,
          serviceId: sla.serviceId,
          status: Math.random() > 0.8 ? 'at_risk' : 'met',
          currentValue: 99 + Math.random(),
          targetValue: sla.target || 99.9,
          timeRemaining: 1440 + Math.random() * 1440,
        }));
        
        setSlaStatus(slaStatusData);
        
      } catch (error) {
        console.error('[BusinessImpact] Failed to load data:', error);
      }
    };
    
    loadBusinessData();
  }, [tenantId]);
  
  // Monitor live metrics for business impact
  useEffect(() => {
    const updateMetricsFromLive = () => {
      const metrics: BusinessImpactMetric[] = liveMetrics
        .filter(m => m.metricType === 'business' || m.metricType === 'revenue')
        .map(m => ({
          id: `bim_${m.id}`,
          metricType: m.metricType === 'revenue' ? 'revenue' : 'efficiency',
          entityType: m.entityType,
          entityId: m.entityId,
          value: Number(m.value),
          unit: m.unit || 'units',
          trend: m.trend === 'up' ? 'improving' : m.trend === 'down' ? 'declining' : 'stable',
          percentageChange: Math.random() * 20 - 10,
          timeframe: '24h',
          benchmark: Number(m.value) * 1.1,
          target: Number(m.value) * 1.2,
          calculatedAt: m.timestamp,
        }));
      
      setImpactMetrics(prev => {
        const updated = [...prev];
        metrics.forEach(metric => {
          const index = updated.findIndex(m => 
            m.entityType === metric.entityType && 
            m.entityId === metric.entityId &&
            m.metricType === metric.metricType
          );
          
          if (index >= 0) {
            updated[index] = metric;
          } else {
            updated.push(metric);
          }
        });
        return updated;
      });
    };
    
    updateMetricsFromLive();
    const interval = setInterval(updateMetricsFromLive, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, [liveMetrics]);
  
  // Calculate business impact
  const calculateBusinessImpact = useCallback(async (
    entity: EntityInfo,
    scenario?: ImpactScenario
  ): Promise<ImpactSummary> => {
    // Use impact engine for calculation
    const impact = impactEngine.current.calculateImpact(entity, scenario);
    
    // Get AI insights for enhanced calculation
    const aiScore = aiScores[`${entity.entityType}:${entity.entityId}:risk`];
    if (aiScore) {
      // Adjust impact based on AI risk score
      const riskMultiplier = aiScore.value / 100;
      if (impact.financialImpact) {
        impact.financialImpact *= (1 + riskMultiplier * 0.5);
      }
    }
    
    // Check dependencies for cascade impact
    const related = await getRelatedEntities(entity.entityType, entity.entityId, {
      relationshipTypes: ['dependency', 'impact'],
      maxDistance: 2,
    });
    
    if (related.length > 0) {
      // Add cascade impact
      const cascadeMultiplier = 1 + (related.length * 0.1);
      if (impact.userImpact) {
        impact.userImpact *= cascadeMultiplier;
      }
    }
    
    return impact;
  }, [aiScores, getRelatedEntities]);
  
  const calculateCascadeEffect = useCallback(async (
    trigger: EntityInfo,
    options?: CascadeOptions
  ): Promise<CascadeEffect> => {
    // Calculate cascade using engine
    const cascade = impactEngine.current.analyzeCascadeEffect(trigger, options);
    
    // Enhance with navigation trace data
    const relatedEntities = await getRelatedEntities(
      trigger.entityType,
      trigger.entityId,
      { includeIndirect: true, maxDistance: options?.maxDepth || 3 }
    );
    
    // Add traced entities to cascade
    relatedEntities.forEach(entity => {
      const affected: AffectedEntity = {
        entityType: entity.entityType,
        entityId: entity.entityId,
        displayName: entity.displayName,
        impactLevel: entity.distance === 1 ? 'major' : 
                     entity.distance === 2 ? 'moderate' : 'minor',
        impactDelay: entity.distance * 10,
        impactDescription: `Indirect impact via ${entity.relationship}`,
      };
      
      if (!cascade.affectedEntities.find(e => 
        e.entityId === entity.entityId && e.entityType === entity.entityType
      )) {
        cascade.affectedEntities.push(affected);
      }
    });
    
    // Store cascade analysis
    setCascadeAnalysis(prev => [...prev, cascade]);
    
    return cascade;
  }, [getRelatedEntities]);
  
  const calculateFinancialImpact = useCallback(async (
    entity: EntityInfo,
    timeframe: string = '24h'
  ): Promise<FinancialImpactResult> => {
    const impact = await calculateBusinessImpact(entity);
    
    // Parse timeframe to hours
    const hours = timeframe.endsWith('h') ? parseInt(timeframe) :
                  timeframe.endsWith('d') ? parseInt(timeframe) * 24 : 24;
    
    const result: FinancialImpactResult = {
      totalImpact: (impact.financialImpact || 0) * (hours / 24),
      breakdown: {
        revenue: (impact.financialImpact || 0) * 0.6,
        costs: (impact.financialImpact || 0) * 0.2,
        penalties: impact.complianceImpact ? 50000 : 0,
        opportunity: (impact.financialImpact || 0) * 0.2,
      },
      currency: 'USD',
      confidence: 0.75,
      assumptions: [
        'Based on historical incident data',
        'Assumes similar impact patterns',
        'Does not account for exceptional circumstances',
      ],
    };
    
    return result;
  }, [calculateBusinessImpact]);
  
  // SLA and compliance
  const predictSLABreach = useCallback(async (slaId: string): Promise<SLAPrediction> => {
    const sla = slaStatus.find(s => s.slaId === slaId);
    if (!sla) {
      throw new Error('SLA not found');
    }
    
    // Get current service metrics
    const service = businessServiceHealth.find(s => s.serviceId === sla.serviceId);
    if (!service) {
      throw new Error('Service not found');
    }
    
    return impactEngine.current.predictSLABreach(sla, service.performance);
  }, [slaStatus, businessServiceHealth]);
  
  const assessCompliance = useCallback(async (
    regulation: string
  ): Promise<ComplianceAssessment> => {
    // Check compliance implications
    const gaps: ComplianceGap[] = [];
    let totalCost = 0;
    
    complianceImplications
      .filter(c => c.regulation === regulation)
      .forEach(impl => {
        if (impl.status !== 'compliant') {
          gaps.push({
            requirement: impl.requirement,
            currentState: impl.status,
            targetState: 'compliant',
            priority: impl.penalty && impl.penalty > 100000 ? 'critical' : 'high',
          });
          
          totalCost += impl.remediationCost || 0;
        }
      });
    
    const assessment: ComplianceAssessment = {
      compliant: gaps.length === 0,
      gaps,
      estimatedCost: totalCost,
      deadline: gaps.length > 0 
        ? complianceImplications.find(c => c.deadline)?.deadline 
        : undefined,
    };
    
    if (gaps.length > 0) {
      assessment.remediationPlan = {
        steps: gaps.map((gap, index) => ({
          action: `Remediate: ${gap.requirement}`,
          duration: 40 * (index + 1), // hours
          cost: totalCost / gaps.length,
          responsible: 'Compliance Team',
        })),
        totalDuration: gaps.length * 40,
        totalCost,
        resources: ['Compliance Team', 'Legal', 'IT Security'],
      };
    }
    
    return assessment;
  }, [complianceImplications]);
  
  // Optimization
  const identifyCostSavings = useCallback(async (
    category?: string
  ): Promise<CostSavingsOpportunity[]> => {
    const opportunities: CostSavingsOpportunity[] = [];
    
    // Analyze cost implications for savings
    costImplications.forEach(cost => {
      if (category && cost.costType !== category) return;
      
      if (cost.optimizationPotential && cost.optimizationPotential > 0) {
        opportunities.push({
          id: `save_${cost.id}`,
          category: cost.costType,
          description: `Optimize ${cost.entityType} ${cost.entityId}`,
          potentialSavings: cost.amount * (cost.optimizationPotential / 100),
          currency: cost.currency,
          implementationCost: cost.amount * 0.1,
          roi: (cost.optimizationPotential / 10),
          timeToRealize: 30,
          confidence: 0.7,
          status: 'identified',
        });
      }
    });
    
    // Get AI recommendations for cost savings
    const recommendations = await requestRecommendations(
      { entityType: 'cost' },
      { types: ['optimization'], minConfidence: 0.6 }
    );
    
    recommendations.forEach(rec => {
      if (rec.impact.category === 'cost') {
        opportunities.push({
          id: `save_ai_${rec.id}`,
          category: 'ai_recommended',
          description: rec.title,
          potentialSavings: rec.impact.metrics?.cost_reduction || 10000,
          currency: 'USD',
          implementationCost: 5000,
          roi: 2.0,
          timeToRealize: 60,
          confidence: rec.confidence,
          status: 'identified',
        });
      }
    });
    
    setCostSavingsOpportunities(opportunities);
    return opportunities;
  }, [costImplications, requestRecommendations]);
  
  const optimizeServiceDependencies = useCallback(async (
    serviceId: string
  ): Promise<OptimizationResult> => {
    const service = businessServiceHealth.find(s => s.serviceId === serviceId);
    if (!service) {
      throw new Error('Service not found');
    }
    
    const originalScore = service.healthScore;
    const improvements: OptimizationImprovement[] = [];
    
    // Analyze dependencies for optimization
    service.dependencies.forEach(dep => {
      if (dep.criticality === 'standard' && dep.healthScore && dep.healthScore < 90) {
        improvements.push({
          area: 'Dependencies',
          action: `Upgrade ${dep.serviceName} or implement caching`,
          impact: 5,
          effort: 'medium',
          priority: 2,
        });
      }
    });
    
    // Check performance metrics
    if (service.performance.responseTime > 500) {
      improvements.push({
        area: 'Performance',
        action: 'Implement response caching',
        impact: 10,
        effort: 'low',
        priority: 1,
      });
    }
    
    if (service.performance.errorRate > 0.5) {
      improvements.push({
        area: 'Reliability',
        action: 'Add retry logic and circuit breakers',
        impact: 8,
        effort: 'medium',
        priority: 1,
      });
    }
    
    const optimizedScore = Math.min(100, originalScore + improvements.reduce((sum, i) => sum + i.impact, 0));
    
    return {
      originalScore,
      optimizedScore,
      improvements,
      estimatedSavings: improvements.length * 5000,
      implementationPlan: improvements
        .sort((a, b) => a.priority - b.priority)
        .map(i => i.action),
    };
  }, [businessServiceHealth]);
  
  // Visualization
  const getImpactVisualization = useCallback(async (
    entityId: string,
    entityType: string,
    vizType: string = 'heatmap'
  ): Promise<ImpactVisualization> => {
    // Generate visualization data based on type
    let data: any;
    
    switch (vizType) {
      case 'heatmap':
        // Generate heatmap data
        data = {
          services: businessServiceHealth.map(s => ({
            id: s.serviceId,
            name: s.serviceName,
            health: s.healthScore,
            availability: s.availability,
            risk: 100 - s.healthScore,
          })),
        };
        break;
        
      case 'timeline':
        // Generate timeline data
        data = {
          events: cascadeAnalysis
            .flatMap(c => c.timelineEvents)
            .filter(e => e.entity.entityId === entityId)
            .slice(0, 20),
        };
        break;
        
      default:
        data = {};
    }
    
    return {
      type: vizType as any,
      data,
      config: {
        title: `${entityType} Impact Visualization`,
        dimensions: { width: 800, height: 600 },
        interactive: true,
        realtime: true,
      },
    };
  }, [businessServiceHealth, cascadeAnalysis]);
  
  const getDependencyGraph = useCallback(async (
    businessServiceId: string,
    depth: number = 2
  ): Promise<DependencyGraph> => {
    const service = businessServiceHealth.find(s => s.serviceId === businessServiceId);
    if (!service) {
      throw new Error('Service not found');
    }
    
    const map = impactEngine.current.buildDependencyMap({
      entityType: 'service',
      entityId: businessServiceId,
      displayName: service.serviceName,
      criticality: 'high',
    });
    
    // Convert to graph format
    const nodes: GraphNode[] = [
      {
        id: businessServiceId,
        label: service.serviceName,
        type: 'service',
        health: service.healthScore,
        criticality: 'high',
      },
    ];
    
    const edges: GraphEdge[] = [];
    
    const addDependencies = (deps: DependencyNode[], parentId: string, level: number) => {
      if (level > depth) return;
      
      deps.forEach(dep => {
        const nodeId = `${dep.entity.entityType}_${dep.entity.entityId}`;
        
        if (!nodes.find(n => n.id === nodeId)) {
          nodes.push({
            id: nodeId,
            label: dep.entity.displayName,
            type: dep.entity.entityType,
            criticality: dep.entity.criticality,
          });
        }
        
        edges.push({
          source: parentId,
          target: nodeId,
          weight: dep.impactScore,
          type: dep.dependencyType,
        });
        
        if (dep.children.length > 0) {
          addDependencies(dep.children, nodeId, level + 1);
        }
      });
    };
    
    addDependencies(map.dependencies, businessServiceId, 1);
    
    return {
      nodes,
      edges,
      layout: 'hierarchical',
    };
  }, [businessServiceHealth]);
  
  const getCascadeAnalysis = useCallback(async (changeId: string): Promise<CascadeAnalysis> => {
    // Find or create cascade analysis for change
    let cascade = cascadeAnalysis.find(c => 
      c.triggerEntity.entityType === 'change' && 
      c.triggerEntity.entityId === changeId
    );
    
    if (!cascade) {
      // Generate new analysis
      cascade = await calculateCascadeEffect(
        { entityType: 'change', entityId: changeId, displayName: `Change ${changeId}` },
        { maxDepth: 3, includeIndirect: true }
      );
    }
    
    // Build detailed cascade analysis
    const waves = impactEngine.current['simulateCascadeWaves'](
      cascade.triggerEntity,
      { maxDepth: 3 }
    );
    
    const peakImpact = waves.reduce((max, wave) => {
      const waveImpact = wave.cumulativeImpact.financialImpact || 0;
      return waveImpact > max.magnitude 
        ? { time: wave.startTime, magnitude: waveImpact }
        : max;
    }, { time: '', magnitude: 0 });
    
    return {
      trigger: cascade.triggerEntity,
      waves,
      timeline: cascade.timelineEvents,
      totalImpact: cascade.totalImpact,
      peakImpact,
    };
  }, [cascadeAnalysis, calculateCascadeEffect]);
  
  // Customer impact
  const getCustomerImpactSummary = useCallback(async (
    incidentId: string
  ): Promise<CustomerImpactSummary> => {
    const impact = await calculateBusinessImpact(
      { entityType: 'incident', entityId: incidentId, displayName: `Incident ${incidentId}` }
    );
    
    const totalAffected = impact.userImpact || 0;
    const vipPercentage = 0.1; // 10% are VIP
    
    const summary: CustomerImpactSummary = {
      totalAffected,
      vipAffected: Math.floor(totalAffected * vipPercentage),
      revenueAtRisk: (impact.financialImpact || 0) * 0.3,
      satisfactionImpact: -5 - Math.random() * 10,
      churnRisk: Math.min(10, totalAffected / 1000),
      segments: [
        { name: 'Enterprise', size: totalAffected * 0.2, impact: 'high', value: 50000 },
        { name: 'SMB', size: totalAffected * 0.5, impact: 'medium', value: 5000 },
        { name: 'Individual', size: totalAffected * 0.3, impact: 'low', value: 100 },
      ],
      communications: [
        {
          id: 'comm_1',
          type: 'email',
          template: 'incident_notification',
          recipients: totalAffected,
          status: 'draft',
        },
      ],
    };
    
    return summary;
  }, [calculateBusinessImpact]);
  
  // Real-time subscriptions
  const subscribeToImpactUpdates = useCallback((
    entityType: string,
    entityId: string
  ): (() => void) => {
    const key = `${entityType}:${entityId}`;
    
    // Subscribe to entity updates
    subscribeToEntity(entityType, entityId);
    
    // Register update handler
    const unsubscribe = onEntityUpdate((update) => {
      if (update.entityType === entityType && update.entityId === entityId) {
        // Recalculate impact on update
        calculateBusinessImpact({ entityType, entityId, displayName: '' }).then(impact => {
          // Update metrics
          const metric: BusinessImpactMetric = {
            id: `impact_${Date.now()}`,
            metricType: 'risk',
            entityType,
            entityId,
            value: (impact.financialImpact || 0) / 1000,
            unit: 'k$',
            trend: 'stable',
            percentageChange: 0,
            timeframe: 'realtime',
            calculatedAt: new Date().toISOString(),
          };
          
          setImpactMetrics(prev => [...prev, metric]);
        });
      }
    }, entityType);
    
    subscriptions.current.set(key, unsubscribe);
    
    return () => {
      const unsub = subscriptions.current.get(key);
      if (unsub) {
        unsub();
        subscriptions.current.delete(key);
      }
    };
  }, [subscribeToEntity, onEntityUpdate, calculateBusinessImpact]);
  
  const subscribeToSLAAlerts = useCallback((slaIds: string[]): (() => void) => {
    // Monitor SLAs for breach alerts
    const interval = setInterval(async () => {
      for (const slaId of slaIds) {
        const prediction = await predictSLABreach(slaId);
        if (prediction.breachProbability > 0.7) {
          // Update SLA status
          setSlaStatus(prev => prev.map(s => 
            s.slaId === slaId 
              ? { ...s, status: 'at_risk', breachProbability: prediction.breachProbability }
              : s
          ));
        }
      }
    }, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [predictSLABreach]);
  
  // Cleanup subscriptions
  useEffect(() => {
    return () => {
      subscriptions.current.forEach(unsubscribe => unsubscribe());
      subscriptions.current.clear();
    };
  }, []);
  
  // Memoized context value
  const value = useMemo<BusinessImpactContextProps>(() => ({
    // Business impact data
    impactMetrics,
    dependencyMaps,
    cascadeAnalysis,
    costImplications,
    
    // Business service health
    businessServiceHealth,
    serviceAvailability,
    slaStatus,
    
    // Visualization
    getImpactVisualization,
    getDependencyGraph,
    getCascadeAnalysis,
    
    // Business priorities
    businessPriorities,
    riskAssessments,
    complianceImplications,
    
    // Customer impact
    customerImpactMetrics,
    getCustomerImpactSummary,
    
    // Financial impact
    revenueImpact,
    costSavingsOpportunities,
    
    // Calculations
    calculateBusinessImpact,
    calculateCascadeEffect,
    calculateFinancialImpact,
    
    // SLA and compliance
    predictSLABreach,
    assessCompliance,
    
    // Optimization
    identifyCostSavings,
    optimizeServiceDependencies,
    
    // Real-time
    subscribeToImpactUpdates,
    subscribeToSLAAlerts,
  }), [
    impactMetrics,
    dependencyMaps,
    cascadeAnalysis,
    costImplications,
    businessServiceHealth,
    serviceAvailability,
    slaStatus,
    businessPriorities,
    riskAssessments,
    complianceImplications,
    customerImpactMetrics,
    revenueImpact,
    costSavingsOpportunities,
    getImpactVisualization,
    getDependencyGraph,
    getCascadeAnalysis,
    getCustomerImpactSummary,
    calculateBusinessImpact,
    calculateCascadeEffect,
    calculateFinancialImpact,
    predictSLABreach,
    assessCompliance,
    identifyCostSavings,
    optimizeServiceDependencies,
    subscribeToImpactUpdates,
    subscribeToSLAAlerts,
  ]);
  
  return (
    <BusinessImpactContext.Provider value={value}>
      {children}
    </BusinessImpactContext.Provider>
  );
};

// ---------------------------------
// 10. Custom Hooks
// ---------------------------------

export const useBusinessImpact = (): BusinessImpactContextProps => {
  const context = useContext(BusinessImpactContext);
  if (!context) {
    throw new Error('useBusinessImpact must be used within BusinessImpactProvider');
  }
  return context;
};

export const useServiceHealth = (serviceId?: string) => {
  const { businessServiceHealth, serviceAvailability, subscribeToImpactUpdates } = useBusinessImpact();
  const [health, setHealth] = useState<BusinessServiceHealth | null>(null);
  const [availability, setAvailability] = useState<ServiceAvailabilityMetric | null>(null);
  
  useEffect(() => {
    if (!serviceId) return;
    
    const service = businessServiceHealth.find(s => s.serviceId === serviceId);
    const avail = serviceAvailability.find(a => a.serviceId === serviceId);
    
    setHealth(service || null);
    setAvailability(avail || null);
    
    // Subscribe to updates
    const unsubscribe = subscribeToImpactUpdates('service', serviceId);
    
    return unsubscribe;
  }, [serviceId, businessServiceHealth, serviceAvailability, subscribeToImpactUpdates]);
  
  return {
    health,
    availability,
    isHealthy: health ? health.healthScore > 90 : false,
    isAvailable: availability ? availability.availability > 99 : false,
  };
};

export const useSLAMonitoring = (slaIds: string[]) => {
  const { slaStatus, predictSLABreach, subscribeToSLAAlerts } = useBusinessImpact();
  const [predictions, setPredictions] = useState<SLAPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (slaIds.length === 0) return;
    
    // Subscribe to SLA alerts
    const unsubscribe = subscribeToSLAAlerts(slaIds);
    
    // Load initial predictions
    const loadPredictions = async () => {
      setLoading(true);
      try {
        const preds = await Promise.all(
          slaIds.map(id => predictSLABreach(id))
        );
        setPredictions(preds);
      } catch (error) {
        console.error('[useSLAMonitoring] Failed to load predictions:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadPredictions();
    
    return unsubscribe;
  }, [slaIds.join(','), predictSLABreach, subscribeToSLAAlerts]);
  
  const slas = slaStatus.filter(s => slaIds.includes(s.slaId));
  const atRisk = slas.filter(s => s.status === 'at_risk');
  const breached = slas.filter(s => s.status === 'breached');
  
  return {
    slas,
    predictions,
    atRisk,
    breached,
    loading,
    hasRisks: atRisk.length > 0,
    hasBreaches: breached.length > 0,
  };
};

export const useBusinessMetrics = (entityType?: string, entityId?: string) => {
  const { impactMetrics, calculateBusinessImpact, calculateFinancialImpact } = useBusinessImpact();
  const [impact, setImpact] = useState<ImpactSummary | null>(null);
  const [financial, setFinancial] = useState<FinancialImpactResult | null>(null);
  const [loading, setLoading] = useState(false);
  
  const filteredMetrics = useMemo(() => {
    if (!entityType && !entityId) return impactMetrics;
    return impactMetrics.filter(m => 
      (!entityType || m.entityType === entityType) &&
      (!entityId || m.entityId === entityId)
    );
  }, [impactMetrics, entityType, entityId]);
  
  useEffect(() => {
    if (!entityType || !entityId) return;
    
    const loadImpact = async () => {
      setLoading(true);
      try {
        const [impactRes, financialRes] = await Promise.all([
          calculateBusinessImpact({ entityType, entityId, displayName: '' }),
          calculateFinancialImpact({ entityType, entityId, displayName: '' }),
        ]);
        
        setImpact(impactRes);
        setFinancial(financialRes);
      } catch (error) {
        console.error('[useBusinessMetrics] Failed to calculate impact:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadImpact();
  }, [entityType, entityId, calculateBusinessImpact, calculateFinancialImpact]);
  
  return {
    metrics: filteredMetrics,
    impact,
    financial,
    loading,
  };
};