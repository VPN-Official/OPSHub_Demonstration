// src/contexts/AIInsightsContext.tsx
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
  removeWithAudit,
} from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useSync } from "../providers/SyncProvider";
import { useRealtimeStream } from "./RealtimeStreamContext";
import { useOfflineCapability } from "./OfflineCapabilityContext";

// ---------------------------------
// 1. AI Score and Model Types
// ---------------------------------

export interface AIScore {
  id: string;
  entityType: string;
  entityId: string;
  scoreType: 'risk' | 'priority' | 'impact' | 'confidence' | 'anomaly' | 'health';
  value: number; // 0-100
  trend: 'improving' | 'stable' | 'degrading';
  factors: ScoreFactor[];
  calculatedAt: string;
  modelVersion: string;
  confidence: number;
}

export interface ScoreFactor {
  name: string;
  weight: number;
  contribution: number;
  value: any;
  description?: string;
}

export interface AIExplanation {
  id: string;
  entityType: string;
  entityId: string;
  explanationType: 'decision' | 'score' | 'recommendation' | 'prediction';
  summary: string;
  details: ExplanationDetail[];
  evidence: Evidence[];
  alternativeActions?: AlternativeAction[];
  confidence: number;
  generatedAt: string;
  modelVersion: string;
}

export interface ExplanationDetail {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
  value?: any;
}

export interface Evidence {
  type: 'historical' | 'pattern' | 'correlation' | 'rule' | 'anomaly';
  description: string;
  data?: any;
  confidence: number;
  source?: string;
}

export interface AlternativeAction {
  action: string;
  probability: number;
  impact: string;
  reasoning: string;
}

// ---------------------------------
// 2. AI Recommendation Types
// ---------------------------------

export interface AIRecommendation {
  id: string;
  entityType?: string;
  entityId?: string;
  recommendationType: RecommendationType;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  impact: ImpactAssessment;
  actions: RecommendedAction[];
  reasoning: string;
  evidence: Evidence[];
  expiresAt?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: string;
  modelVersion: string;
}

export type RecommendationType = 
  | 'optimization'
  | 'prevention'
  | 'remediation'
  | 'automation'
  | 'resource'
  | 'process'
  | 'configuration'
  | 'security'
  | 'performance';

export interface ImpactAssessment {
  category: 'cost' | 'performance' | 'reliability' | 'security' | 'compliance';
  magnitude: 'major' | 'moderate' | 'minor';
  timeframe: 'immediate' | 'short-term' | 'long-term';
  confidence: number;
  metrics?: Record<string, number>;
}

export interface RecommendedAction {
  id: string;
  action: string;
  automated: boolean;
  requiresApproval: boolean;
  estimatedDuration?: number;
  prerequisites?: string[];
  risks?: string[];
}

// ---------------------------------
// 3. AI Prediction Types
// ---------------------------------

export interface AIPrediction {
  id: string;
  predictionType: string;
  entityType?: string;
  entityId?: string;
  prediction: PredictionResult;
  confidence: number;
  timeHorizon: string;
  factors: PredictionFactor[];
  scenarios?: PredictionScenario[];
  accuracy?: AccuracyMetrics;
  generatedAt: string;
  validUntil: string;
  modelVersion: string;
}

export interface PredictionResult {
  value: any;
  unit?: string;
  probability: number;
  range?: {
    min: any;
    max: any;
  };
  trend?: 'increasing' | 'stable' | 'decreasing';
}

export interface PredictionFactor {
  name: string;
  currentValue: any;
  predictedValue: any;
  influence: number; // -1 to 1
  confidence: number;
}

export interface PredictionScenario {
  name: string;
  probability: number;
  outcome: any;
  conditions: string[];
  impact?: string;
}

export interface AccuracyMetrics {
  mape?: number; // Mean Absolute Percentage Error
  rmse?: number; // Root Mean Square Error
  r2?: number; // R-squared
  historicalAccuracy?: number;
}

// ---------------------------------
// 4. AI Model Management Types
// ---------------------------------

export interface ModelVersion {
  id: string;
  modelType: string;
  version: string;
  deployedAt: string;
  performance: ModelPerformance;
  capabilities: string[];
  limitations?: string[];
  trainingDataset?: string;
  updateFrequency?: string;
}

export interface ModelPerformance {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  latency: number; // ms
  throughput: number; // requests/second
}

export interface ConfidenceMetric {
  modelType: string;
  overallConfidence: number;
  factors: Array<{
    name: string;
    confidence: number;
    weight: number;
  }>;
  dataQuality: number;
  modelAge: number; // days since training
}

// ---------------------------------
// 5. AI Context Types
// ---------------------------------

export interface AIContext {
  entityType?: string;
  entityId?: string;
  historicalData?: any[];
  currentState?: any;
  constraints?: Record<string, any>;
  preferences?: Record<string, any>;
  excludeFactors?: string[];
}

export interface PredictionContext extends AIContext {
  timeRange: {
    start: string;
    end: string;
  };
  granularity?: 'hour' | 'day' | 'week' | 'month';
  includeScenarios?: boolean;
}

// ---------------------------------
// 6. AI Feedback Types
// ---------------------------------

export interface AIFeedback {
  type: 'accuracy' | 'usefulness' | 'relevance';
  rating: number; // 1-5
  comment?: string;
  correctValue?: any;
  timestamp: string;
  userId: string;
}

export interface AICorrection {
  incorrectValue: any;
  correctValue: any;
  reason?: string;
  evidence?: string;
}

export interface AIFeedbackSummary {
  averageRating: number;
  totalFeedback: number;
  accuracyScore: number;
  usefulnessScore: number;
  relevanceScore: number;
  improvements: string[];
}

// ---------------------------------
// 7. AI Trust and Transparency Types
// ---------------------------------

export interface ExplainabilityReport {
  modelType: string;
  methodology: string;
  features: FeatureImportance[];
  decisionProcess: DecisionStep[];
  limitations: string[];
  biasAssessment?: BiasAssessment;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  description: string;
  category?: string;
}

export interface DecisionStep {
  step: number;
  description: string;
  input: any;
  output: any;
  reasoning?: string;
}

export interface BiasAssessment {
  tested: boolean;
  biasTypes: Array<{
    type: string;
    detected: boolean;
    mitigation?: string;
  }>;
  fairnessScore: number;
}

export interface AITrustMetric {
  dimension: 'accuracy' | 'reliability' | 'transparency' | 'fairness' | 'security';
  score: number;
  factors: string[];
  trend: 'improving' | 'stable' | 'declining';
}

// ---------------------------------
// 8. AI Insights Context Interface
// ---------------------------------

export interface AIInsightsContextProps {
  // AI-generated insights
  aiScores: Record<string, AIScore>;
  explanations: Record<string, AIExplanation>;
  recommendations: AIRecommendation[];
  predictions: AIPrediction[];
  
  // Model information
  modelVersions: ModelVersion[];
  confidenceMetrics: ConfidenceMetric[];
  
  // Request AI insights
  requestExplanation: (entityType: string, entityId: string, options?: ExplanationOptions) => Promise<AIExplanation>;
  requestRecommendations: (context: AIContext, options?: RecommendationOptions) => Promise<AIRecommendation[]>;
  requestPrediction: (predictionType: string, context: PredictionContext) => Promise<AIPrediction>;
  analyzeAnomaly: (entityType: string, entityId: string, data: any) => Promise<AnomalyAnalysis>;
  
  // Apply AI suggestions
  applyRecommendation: (recommendationId: string, actionId?: string) => Promise<ApplyResult>;
  dismissRecommendation: (recommendationId: string, reason: string) => Promise<void>;
  provideFeedback: (targetId: string, targetType: string, feedback: AIFeedback) => Promise<void>;
  
  // AI learning and improvement
  reportInaccuracy: (insightId: string, correction: AICorrection) => Promise<void>;
  getUserFeedbackSummary: () => AIFeedbackSummary;
  trainOnFeedback: () => Promise<TrainingResult>;
  
  // AI trust and transparency
  getExplainabilityReport: (modelType: string) => Promise<ExplainabilityReport>;
  getTrustMetrics: () => AITrustMetric[];
  validatePrediction: (predictionId: string, actualValue: any) => Promise<ValidationResult>;
  
  // Batch operations
  batchAnalyze: (entities: Array<{ type: string; id: string }>) => Promise<BatchAnalysisResult>;
  compareInsights: (entityIds: string[], insightType: string) => Promise<ComparisonResult>;
  
  // Real-time AI
  subscribeToAIUpdates: (entityType: string, entityId: string) => () => void;
  getRealtimeScore: (entityType: string, entityId: string, scoreType: string) => AIScore | null;
}

export interface ExplanationOptions {
  depth?: 'summary' | 'detailed' | 'technical';
  includeAlternatives?: boolean;
  language?: string;
}

export interface RecommendationOptions {
  maxRecommendations?: number;
  minConfidence?: number;
  types?: RecommendationType[];
  timeHorizon?: string;
}

export interface AnomalyAnalysis {
  isAnomaly: boolean;
  anomalyScore: number;
  type?: 'point' | 'contextual' | 'collective';
  factors: string[];
  similarPatterns?: Array<{
    timestamp: string;
    similarity: number;
    outcome?: string;
  }>;
  recommendation?: string;
}

export interface ApplyResult {
  success: boolean;
  actionsTaken: string[];
  outcome?: any;
  rollbackAvailable: boolean;
  rollbackId?: string;
}

export interface TrainingResult {
  modelsUpdated: string[];
  improvementMetrics: Record<string, number>;
  nextTrainingScheduled?: string;
}

export interface ValidationResult {
  accurate: boolean;
  error?: number;
  errorType?: 'overestimate' | 'underestimate';
  contributingFactors?: string[];
}

export interface BatchAnalysisResult {
  analyzed: number;
  insights: Array<{
    entityType: string;
    entityId: string;
    scores?: AIScore[];
    recommendations?: AIRecommendation[];
    anomalies?: AnomalyAnalysis;
  }>;
  processingTime: number;
}

export interface ComparisonResult {
  entities: string[];
  similarities: Array<{
    factor: string;
    values: Record<string, any>;
    variance: number;
  }>;
  differences: Array<{
    factor: string;
    values: Record<string, any>;
    significance: number;
  }>;
  clusters?: Array<{
    entities: string[];
    commonCharacteristics: string[];
  }>;
}

// ---------------------------------
// 9. AI Engine Implementation
// ---------------------------------

class AIInsightsEngine {
  private scoreCache: Map<string, AIScore> = new Map();
  private explanationCache: Map<string, AIExplanation> = new Map();
  private predictionCache: Map<string, AIPrediction> = new Map();
  private feedbackData: Map<string, AIFeedback[]> = new Map();
  private modelRegistry: Map<string, ModelVersion> = new Map();
  
  constructor() {
    this.initializeModels();
  }
  
  private initializeModels() {
    // Register available AI models
    const models: ModelVersion[] = [
      {
        id: 'risk-model-v2',
        modelType: 'risk-assessment',
        version: '2.0.1',
        deployedAt: new Date().toISOString(),
        performance: {
          accuracy: 0.92,
          precision: 0.89,
          recall: 0.94,
          f1Score: 0.91,
          latency: 50,
          throughput: 100,
        },
        capabilities: ['incident-risk', 'change-risk', 'compliance-risk'],
      },
      {
        id: 'anomaly-detection-v1',
        modelType: 'anomaly-detection',
        version: '1.3.0',
        deployedAt: new Date().toISOString(),
        performance: {
          accuracy: 0.88,
          precision: 0.85,
          recall: 0.90,
          f1Score: 0.87,
          latency: 30,
          throughput: 200,
        },
        capabilities: ['metric-anomaly', 'pattern-anomaly', 'behavioral-anomaly'],
      },
      {
        id: 'prediction-model-v3',
        modelType: 'time-series-prediction',
        version: '3.1.0',
        deployedAt: new Date().toISOString(),
        performance: {
          accuracy: 0.85,
          precision: 0.83,
          recall: 0.87,
          f1Score: 0.85,
          latency: 100,
          throughput: 50,
        },
        capabilities: ['workload-prediction', 'incident-prediction', 'capacity-prediction'],
      },
    ];
    
    models.forEach(model => {
      this.modelRegistry.set(model.modelType, model);
    });
  }
  
  public async generateExplanation(
    entityType: string,
    entityId: string,
    options: ExplanationOptions = {}
  ): Promise<AIExplanation> {
    const cacheKey = `${entityType}:${entityId}`;
    
    // Check cache
    if (this.explanationCache.has(cacheKey)) {
      const cached = this.explanationCache.get(cacheKey)!;
      const age = Date.now() - new Date(cached.generatedAt).getTime();
      if (age < 300000) { // 5 minutes
        return cached;
      }
    }
    
    // Generate explanation
    const explanation: AIExplanation = {
      id: `exp_${Date.now()}`,
      entityType,
      entityId,
      explanationType: 'decision',
      summary: this.generateSummary(entityType, entityId, options.depth || 'summary'),
      details: this.generateDetails(entityType, entityId),
      evidence: this.collectEvidence(entityType, entityId),
      alternativeActions: options.includeAlternatives ? this.generateAlternatives(entityType, entityId) : undefined,
      confidence: 0.85,
      generatedAt: new Date().toISOString(),
      modelVersion: this.modelRegistry.get('risk-assessment')?.version || '1.0.0',
    };
    
    this.explanationCache.set(cacheKey, explanation);
    return explanation;
  }
  
  private generateSummary(entityType: string, entityId: string, depth: string): string {
    const templates = {
      incident: {
        summary: `This incident has been assigned high priority based on business impact and affected users.`,
        detailed: `The incident priority calculation considers multiple factors including: business service criticality (40%), number of affected users (30%), potential for escalation (20%), and SLA compliance risk (10%).`,
        technical: `Priority score: 85/100. Calculated using weighted decision tree model with features: service_tier=1, user_count=150, escalation_probability=0.7, sla_remaining=2h.`,
      },
      change: {
        summary: `This change request has moderate risk due to the complexity and systems affected.`,
        detailed: `Risk assessment evaluates: technical complexity, number of dependencies, rollback capability, testing coverage, and historical success rate of similar changes.`,
        technical: `Risk score: 65/100. Neural network prediction based on: complexity_index=7.2, dependency_count=12, rollback_time=30min, test_coverage=78%, similar_change_success_rate=0.92.`,
      },
    };
    
    return templates[entityType]?.[depth] || 'Analysis complete based on current data and patterns.';
  }
  
  private generateDetails(entityType: string, entityId: string): ExplanationDetail[] {
    // Simulate detailed factor analysis
    return [
      {
        factor: 'Business Impact',
        impact: 'negative',
        weight: 0.4,
        description: 'High impact on critical business service',
        value: 'Critical',
      },
      {
        factor: 'User Count',
        impact: 'negative',
        weight: 0.3,
        description: '150+ users affected',
        value: 150,
      },
      {
        factor: 'Mitigation Available',
        impact: 'positive',
        weight: 0.2,
        description: 'Workaround available for affected users',
        value: true,
      },
      {
        factor: 'Time Since Report',
        impact: 'negative',
        weight: 0.1,
        description: 'Reported 2 hours ago',
        value: '2h',
      },
    ];
  }
  
  private collectEvidence(entityType: string, entityId: string): Evidence[] {
    return [
      {
        type: 'historical',
        description: 'Similar incidents took 4-6 hours to resolve',
        confidence: 0.9,
        source: 'Historical incident database',
      },
      {
        type: 'pattern',
        description: 'Spike in related alerts detected 30 minutes before incident',
        confidence: 0.75,
        source: 'Alert correlation engine',
      },
      {
        type: 'correlation',
        description: 'Recent deployment to related service',
        confidence: 0.6,
        source: 'Change management system',
      },
    ];
  }
  
  private generateAlternatives(entityType: string, entityId: string): AlternativeAction[] {
    return [
      {
        action: 'Escalate to Level 2 Support',
        probability: 0.7,
        impact: 'Reduce resolution time by 30%',
        reasoning: 'Technical complexity requires specialized knowledge',
      },
      {
        action: 'Apply temporary workaround',
        probability: 0.9,
        impact: 'Restore service for 80% of users',
        reasoning: 'Quick mitigation while root cause is investigated',
      },
      {
        action: 'Rollback recent changes',
        probability: 0.5,
        impact: 'Full service restoration',
        reasoning: 'High correlation with recent deployment',
      },
    ];
  }
  
  public async generateRecommendations(
    context: AIContext,
    options: RecommendationOptions = {}
  ): Promise<AIRecommendation[]> {
    const recommendations: AIRecommendation[] = [];
    
    // Generate recommendations based on context
    if (context.entityType === 'incident') {
      recommendations.push({
        id: `rec_${Date.now()}_1`,
        entityType: context.entityType,
        entityId: context.entityId,
        recommendationType: 'remediation',
        title: 'Apply Automated Remediation',
        description: 'Execute automated recovery procedure based on similar incident patterns',
        priority: 'high',
        confidence: 0.82,
        impact: {
          category: 'performance',
          magnitude: 'major',
          timeframe: 'immediate',
          confidence: 0.9,
          metrics: {
            mttr_reduction: 60,
            user_impact_reduction: 80,
          },
        },
        actions: [
          {
            id: 'action_1',
            action: 'Execute recovery script',
            automated: true,
            requiresApproval: true,
            estimatedDuration: 300,
            risks: ['Temporary service interruption'],
          },
        ],
        reasoning: 'Historical data shows 92% success rate for this remediation pattern',
        evidence: this.collectEvidence(context.entityType!, context.entityId!),
        status: 'pending',
        createdAt: new Date().toISOString(),
        modelVersion: this.modelRegistry.get('risk-assessment')?.version || '1.0.0',
      });
      
      recommendations.push({
        id: `rec_${Date.now()}_2`,
        entityType: context.entityType,
        entityId: context.entityId,
        recommendationType: 'prevention',
        title: 'Implement Proactive Monitoring',
        description: 'Add monitoring for early detection of similar issues',
        priority: 'medium',
        confidence: 0.75,
        impact: {
          category: 'reliability',
          magnitude: 'moderate',
          timeframe: 'long-term',
          confidence: 0.8,
          metrics: {
            incident_reduction: 40,
            detection_time: 75,
          },
        },
        actions: [
          {
            id: 'action_2',
            action: 'Deploy monitoring configuration',
            automated: true,
            requiresApproval: false,
            estimatedDuration: 60,
          },
        ],
        reasoning: 'Prevent recurrence of similar incidents',
        evidence: [],
        status: 'pending',
        createdAt: new Date().toISOString(),
        modelVersion: this.modelRegistry.get('risk-assessment')?.version || '1.0.0',
      });
    }
    
    // Filter by options
    let filtered = recommendations;
    
    if (options.minConfidence) {
      filtered = filtered.filter(r => r.confidence >= options.minConfidence!);
    }
    
    if (options.types && options.types.length > 0) {
      filtered = filtered.filter(r => options.types!.includes(r.recommendationType));
    }
    
    if (options.maxRecommendations) {
      filtered = filtered.slice(0, options.maxRecommendations);
    }
    
    return filtered;
  }
  
  public async generatePrediction(
    predictionType: string,
    context: PredictionContext
  ): Promise<AIPrediction> {
    const prediction: AIPrediction = {
      id: `pred_${Date.now()}`,
      predictionType,
      entityType: context.entityType,
      entityId: context.entityId,
      prediction: {
        value: this.calculatePredictedValue(predictionType, context),
        probability: 0.78,
        range: {
          min: 10,
          max: 50,
        },
        trend: 'increasing',
      },
      confidence: 0.75,
      timeHorizon: `${context.timeRange.start} to ${context.timeRange.end}`,
      factors: [
        {
          name: 'Historical Pattern',
          currentValue: 25,
          predictedValue: 35,
          influence: 0.6,
          confidence: 0.8,
        },
        {
          name: 'Seasonal Trend',
          currentValue: 1.0,
          predictedValue: 1.2,
          influence: 0.3,
          confidence: 0.7,
        },
        {
          name: 'External Events',
          currentValue: 0,
          predictedValue: 2,
          influence: 0.1,
          confidence: 0.5,
        },
      ],
      scenarios: context.includeScenarios ? this.generateScenarios(predictionType) : undefined,
      accuracy: {
        mape: 12.5,
        rmse: 8.3,
        r2: 0.85,
        historicalAccuracy: 0.83,
      },
      generatedAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(), // 24 hours
      modelVersion: this.modelRegistry.get('time-series-prediction')?.version || '1.0.0',
    };
    
    return prediction;
  }
  
  private calculatePredictedValue(predictionType: string, context: PredictionContext): any {
    // Simulate prediction calculation
    switch (predictionType) {
      case 'incident-volume':
        return 32; // incidents per day
      case 'resource-utilization':
        return 78; // percentage
      case 'response-time':
        return 45; // minutes
      default:
        return 0;
    }
  }
  
  private generateScenarios(predictionType: string): PredictionScenario[] {
    return [
      {
        name: 'Best Case',
        probability: 0.2,
        outcome: 20,
        conditions: ['No major incidents', 'Full team availability'],
        impact: 'Optimal performance',
      },
      {
        name: 'Expected Case',
        probability: 0.6,
        outcome: 32,
        conditions: ['Normal operations', 'Standard workload'],
        impact: 'Typical performance',
      },
      {
        name: 'Worst Case',
        probability: 0.2,
        outcome: 50,
        conditions: ['Multiple incidents', 'Resource constraints'],
        impact: 'Degraded performance',
      },
    ];
  }
  
  public calculateScore(
    entityType: string,
    entityId: string,
    scoreType: AIScore['scoreType'],
    data?: any
  ): AIScore {
    const cacheKey = `${entityType}:${entityId}:${scoreType}`;
    
    // Check cache
    if (this.scoreCache.has(cacheKey)) {
      const cached = this.scoreCache.get(cacheKey)!;
      const age = Date.now() - new Date(cached.calculatedAt).getTime();
      if (age < 60000) { // 1 minute
        return cached;
      }
    }
    
    // Calculate score
    const factors = this.calculateFactors(scoreType, data);
    const value = factors.reduce((sum, f) => sum + f.contribution, 0);
    
    const score: AIScore = {
      id: `score_${Date.now()}`,
      entityType,
      entityId,
      scoreType,
      value: Math.min(100, Math.max(0, value)),
      trend: this.determineTrend(cacheKey, value),
      factors,
      calculatedAt: new Date().toISOString(),
      modelVersion: this.modelRegistry.get('risk-assessment')?.version || '1.0.0',
      confidence: 0.85,
    };
    
    this.scoreCache.set(cacheKey, score);
    return score;
  }
  
  private calculateFactors(scoreType: string, data?: any): ScoreFactor[] {
    // Simulate factor calculation
    const factorTemplates: Record<string, ScoreFactor[]> = {
      risk: [
        { name: 'Complexity', weight: 0.3, contribution: 25, value: 'High' },
        { name: 'Dependencies', weight: 0.25, contribution: 20, value: 12 },
        { name: 'History', weight: 0.2, contribution: 10, value: 'Good' },
        { name: 'Testing', weight: 0.15, contribution: 12, value: '78%' },
        { name: 'Rollback', weight: 0.1, contribution: 8, value: 'Available' },
      ],
      priority: [
        { name: 'Business Impact', weight: 0.4, contribution: 35, value: 'Critical' },
        { name: 'User Count', weight: 0.3, contribution: 25, value: 150 },
        { name: 'SLA Risk', weight: 0.2, contribution: 15, value: 'Medium' },
        { name: 'Escalation', weight: 0.1, contribution: 10, value: 'Likely' },
      ],
      health: [
        { name: 'Availability', weight: 0.3, contribution: 28, value: '99.5%' },
        { name: 'Performance', weight: 0.3, contribution: 25, value: 'Good' },
        { name: 'Errors', weight: 0.2, contribution: 18, value: 'Low' },
        { name: 'Capacity', weight: 0.2, contribution: 15, value: '65%' },
      ],
    };
    
    return factorTemplates[scoreType] || [];
  }
  
  private determineTrend(cacheKey: string, currentValue: number): 'improving' | 'stable' | 'degrading' {
    const previous = this.scoreCache.get(cacheKey);
    if (!previous) return 'stable';
    
    const diff = currentValue - previous.value;
    if (Math.abs(diff) < 5) return 'stable';
    return diff > 0 ? 'improving' : 'degrading';
  }
  
  public recordFeedback(targetId: string, feedback: AIFeedback): void {
    if (!this.feedbackData.has(targetId)) {
      this.feedbackData.set(targetId, []);
    }
    this.feedbackData.get(targetId)!.push(feedback);
  }
  
  public getFeedbackSummary(): AIFeedbackSummary {
    let totalRating = 0;
    let totalCount = 0;
    let accuracySum = 0;
    let usefulnessSum = 0;
    let relevanceSum = 0;
    let accuracyCount = 0;
    let usefulnessCount = 0;
    let relevanceCount = 0;
    
    this.feedbackData.forEach(feedbackList => {
      feedbackList.forEach(feedback => {
        totalRating += feedback.rating;
        totalCount++;
        
        switch (feedback.type) {
          case 'accuracy':
            accuracySum += feedback.rating;
            accuracyCount++;
            break;
          case 'usefulness':
            usefulnessSum += feedback.rating;
            usefulnessCount++;
            break;
          case 'relevance':
            relevanceSum += feedback.rating;
            relevanceCount++;
            break;
        }
      });
    });
    
    return {
      averageRating: totalCount > 0 ? totalRating / totalCount : 0,
      totalFeedback: totalCount,
      accuracyScore: accuracyCount > 0 ? (accuracySum / accuracyCount) * 20 : 0,
      usefulnessScore: usefulnessCount > 0 ? (usefulnessSum / usefulnessCount) * 20 : 0,
      relevanceScore: relevanceCount > 0 ? (relevanceSum / relevanceCount) * 20 : 0,
      improvements: this.identifyImprovements(),
    };
  }
  
  private identifyImprovements(): string[] {
    const improvements: string[] = [];
    const summary = this.getFeedbackSummary();
    
    if (summary.accuracyScore < 60) {
      improvements.push('Improve prediction accuracy through model retraining');
    }
    if (summary.usefulnessScore < 60) {
      improvements.push('Enhance recommendation relevance to user context');
    }
    if (summary.relevanceScore < 60) {
      improvements.push('Better align insights with user priorities');
    }
    
    return improvements;
  }
}

// ---------------------------------
// 10. Provider Component
// ---------------------------------

const AIInsightsContext = createContext<AIInsightsContextProps | null>(null);

export const AIInsightsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { tenantId } = useTenant();
  const { triggerSync } = useSync();
  const { subscribeToEntity, onEntityUpdate } = useRealtimeStream();
  const { isOnline, enqueueAction } = useOfflineCapability();
  
  // State management
  const [aiScores, setAiScores] = useState<Record<string, AIScore>>({});
  const [explanations, setExplanations] = useState<Record<string, AIExplanation>>({});
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [predictions, setPredictions] = useState<AIPrediction[]>([]);
  const [modelVersions, setModelVersions] = useState<ModelVersion[]>([]);
  const [confidenceMetrics, setConfidenceMetrics] = useState<ConfidenceMetric[]>([]);
  
  // AI Engine
  const aiEngine = useRef(new AIInsightsEngine());
  const subscriptions = useRef<Map<string, () => void>>(new Map());
  
  // Initialize models
  useEffect(() => {
    const loadModels = async () => {
      try {
        // Load model configurations from backend or database
        const models = await getAll('ai_models', tenantId);
        setModelVersions(models);
        
        // Load cached insights
        const [scores, exps, recs, preds] = await Promise.all([
          getAll('ai_scores', tenantId),
          getAll('ai_explanations', tenantId),
          getAll('ai_recommendations', tenantId),
          getAll('ai_predictions', tenantId),
        ]);
        
        // Build score map
        const scoreMap: Record<string, AIScore> = {};
        scores.forEach((score: AIScore) => {
          scoreMap[`${score.entityType}:${score.entityId}:${score.scoreType}`] = score;
        });
        setAiScores(scoreMap);
        
        // Build explanation map
        const expMap: Record<string, AIExplanation> = {};
        exps.forEach((exp: AIExplanation) => {
          expMap[`${exp.entityType}:${exp.entityId}`] = exp;
        });
        setExplanations(expMap);
        
        setRecommendations(recs);
        setPredictions(preds);
      } catch (error) {
        console.error('[AIInsights] Failed to load models:', error);
      }
    };
    
    if (tenantId) {
      loadModels();
    }
  }, [tenantId]);
  
  // Update confidence metrics periodically
  useEffect(() => {
    const updateConfidence = () => {
      const metrics: ConfidenceMetric[] = modelVersions.map(model => ({
        modelType: model.modelType,
        overallConfidence: model.performance.accuracy * 100,
        factors: [
          { name: 'Accuracy', confidence: model.performance.accuracy * 100, weight: 0.4 },
          { name: 'Precision', confidence: model.performance.precision * 100, weight: 0.2 },
          { name: 'Recall', confidence: model.performance.recall * 100, weight: 0.2 },
          { name: 'F1 Score', confidence: model.performance.f1Score * 100, weight: 0.2 },
        ],
        dataQuality: 85, // Would be calculated based on actual data
        modelAge: Math.floor((Date.now() - new Date(model.deployedAt).getTime()) / (1000 * 60 * 60 * 24)),
      }));
      
      setConfidenceMetrics(metrics);
    };
    
    updateConfidence();
    const interval = setInterval(updateConfidence, 300000); // Every 5 minutes
    
    return () => clearInterval(interval);
  }, [modelVersions]);
  
  // Request AI insights
  const requestExplanation = useCallback(async (
    entityType: string,
    entityId: string,
    options?: ExplanationOptions
  ): Promise<AIExplanation> => {
    try {
      if (isOnline) {
        // Request from backend
        const response = await fetch(`/api/ai/explain/${entityType}/${entityId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(options || {}),
        });
        
        if (response.ok) {
          const explanation = await response.json();
          
          // Cache the explanation
          const key = `${entityType}:${entityId}`;
          setExplanations(prev => ({ ...prev, [key]: explanation }));
          await putWithAudit('ai_explanations', explanation.id, explanation, 'ai');
          
          return explanation;
        }
      }
      
      // Fall back to local generation
      const explanation = await aiEngine.current.generateExplanation(entityType, entityId, options);
      
      // Cache locally
      const key = `${entityType}:${entityId}`;
      setExplanations(prev => ({ ...prev, [key]: explanation }));
      
      return explanation;
    } catch (error) {
      console.error('[AIInsights] Failed to get explanation:', error);
      throw error;
    }
  }, [isOnline]);
  
  const requestRecommendations = useCallback(async (
    context: AIContext,
    options?: RecommendationOptions
  ): Promise<AIRecommendation[]> => {
    try {
      if (isOnline) {
        // Request from backend
        const response = await fetch('/api/ai/recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context, options }),
        });
        
        if (response.ok) {
          const recs = await response.json();
          
          // Update state
          setRecommendations(prev => [...prev, ...recs]);
          
          // Cache recommendations
          for (const rec of recs) {
            await putWithAudit('ai_recommendations', rec.id, rec, 'ai');
          }
          
          return recs;
        }
      }
      
      // Fall back to local generation
      const recs = await aiEngine.current.generateRecommendations(context, options);
      setRecommendations(prev => [...prev, ...recs]);
      
      return recs;
    } catch (error) {
      console.error('[AIInsights] Failed to get recommendations:', error);
      throw error;
    }
  }, [isOnline]);
  
  const requestPrediction = useCallback(async (
    predictionType: string,
    context: PredictionContext
  ): Promise<AIPrediction> => {
    try {
      if (isOnline) {
        // Request from backend
        const response = await fetch('/api/ai/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: predictionType, context }),
        });
        
        if (response.ok) {
          const prediction = await response.json();
          
          // Update state
          setPredictions(prev => [...prev, prediction]);
          
          // Cache prediction
          await putWithAudit('ai_predictions', prediction.id, prediction, 'ai');
          
          return prediction;
        }
      }
      
      // Fall back to local generation
      const prediction = await aiEngine.current.generatePrediction(predictionType, context);
      setPredictions(prev => [...prev, prediction]);
      
      return prediction;
    } catch (error) {
      console.error('[AIInsights] Failed to get prediction:', error);
      throw error;
    }
  }, [isOnline]);
  
  const analyzeAnomaly = useCallback(async (
    entityType: string,
    entityId: string,
    data: any
  ): Promise<AnomalyAnalysis> => {
    try {
      if (isOnline) {
        // Request from backend
        const response = await fetch(`/api/ai/anomaly/${entityType}/${entityId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data }),
        });
        
        if (response.ok) {
          return await response.json();
        }
      }
      
      // Simple local anomaly detection
      const mean = data.reduce((sum: number, val: number) => sum + val, 0) / data.length;
      const stdDev = Math.sqrt(
        data.reduce((sum: number, val: number) => sum + Math.pow(val - mean, 2), 0) / data.length
      );
      
      const latestValue = data[data.length - 1];
      const zScore = Math.abs((latestValue - mean) / stdDev);
      
      return {
        isAnomaly: zScore > 2,
        anomalyScore: Math.min(zScore / 3, 1) * 100,
        type: zScore > 3 ? 'point' : zScore > 2 ? 'contextual' : undefined,
        factors: zScore > 2 ? ['Statistical deviation', 'Outside normal range'] : [],
        recommendation: zScore > 2 ? 'Investigate unusual activity' : undefined,
      };
    } catch (error) {
      console.error('[AIInsights] Failed to analyze anomaly:', error);
      throw error;
    }
  }, [isOnline]);
  
  // Apply AI suggestions
  const applyRecommendation = useCallback(async (
    recommendationId: string,
    actionId?: string
  ): Promise<ApplyResult> => {
    const recommendation = recommendations.find(r => r.id === recommendationId);
    if (!recommendation) {
      throw new Error('Recommendation not found');
    }
    
    const action = actionId 
      ? recommendation.actions.find(a => a.id === actionId)
      : recommendation.actions[0];
    
    if (!action) {
      throw new Error('Action not found');
    }
    
    try {
      if (isOnline) {
        // Execute action via backend
        const response = await fetch('/api/ai/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recommendationId,
            actionId: action.id,
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          
          // Update recommendation status
          setRecommendations(prev => prev.map(r => 
            r.id === recommendationId 
              ? { ...r, status: 'accepted' }
              : r
          ));
          
          return result;
        }
      } else {
        // Queue for offline execution
        await enqueueAction({
          actionType: 'apply_ai_recommendation',
          entityType: recommendation.entityType,
          entityId: recommendation.entityId,
          payload: {
            recommendationId,
            actionId: action.id,
          },
          priority: recommendation.priority === 'critical' ? 'high' : 'normal',
        });
        
        return {
          success: false,
          actionsTaken: [],
          rollbackAvailable: false,
        };
      }
    } catch (error) {
      console.error('[AIInsights] Failed to apply recommendation:', error);
      throw error;
    }
    
    return {
      success: true,
      actionsTaken: [action.action],
      rollbackAvailable: true,
      rollbackId: `rollback_${Date.now()}`,
    };
  }, [recommendations, isOnline, enqueueAction]);
  
  const dismissRecommendation = useCallback(async (
    recommendationId: string,
    reason: string
  ): Promise<void> => {
    // Update recommendation status
    setRecommendations(prev => prev.map(r => 
      r.id === recommendationId 
        ? { ...r, status: 'rejected' }
        : r
    ));
    
    // Send dismissal to backend
    if (isOnline) {
      try {
        await fetch(`/api/ai/recommendations/${recommendationId}/dismiss`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        });
      } catch (error) {
        console.error('[AIInsights] Failed to dismiss recommendation:', error);
      }
    }
  }, [isOnline]);
  
  const provideFeedback = useCallback(async (
    targetId: string,
    targetType: string,
    feedback: AIFeedback
  ): Promise<void> => {
    // Record feedback locally
    aiEngine.current.recordFeedback(targetId, feedback);
    
    // Send to backend
    if (isOnline) {
      try {
        await fetch('/api/ai/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetId,
            targetType,
            feedback,
          }),
        });
      } catch (error) {
        console.error('[AIInsights] Failed to send feedback:', error);
      }
    } else {
      // Queue for later
      await enqueueAction({
        actionType: 'ai_feedback',
        payload: { targetId, targetType, feedback },
        priority: 'low',
      });
    }
  }, [isOnline, enqueueAction]);
  
  // AI learning and improvement
  const reportInaccuracy = useCallback(async (
    insightId: string,
    correction: AICorrection
  ): Promise<void> => {
    // Send correction to backend
    if (isOnline) {
      try {
        await fetch(`/api/ai/insights/${insightId}/correct`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(correction),
        });
      } catch (error) {
        console.error('[AIInsights] Failed to report inaccuracy:', error);
      }
    } else {
      await enqueueAction({
        actionType: 'ai_correction',
        payload: { insightId, correction },
        priority: 'normal',
      });
    }
  }, [isOnline, enqueueAction]);
  
  const getUserFeedbackSummary = useCallback((): AIFeedbackSummary => {
    return aiEngine.current.getFeedbackSummary();
  }, []);
  
  const trainOnFeedback = useCallback(async (): Promise<TrainingResult> => {
    if (!isOnline) {
      throw new Error('Training requires online connection');
    }
    
    try {
      const response = await fetch('/api/ai/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackSummary: getUserFeedbackSummary(),
        }),
      });
      
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('[AIInsights] Failed to trigger training:', error);
      throw error;
    }
    
    return {
      modelsUpdated: [],
      improvementMetrics: {},
    };
  }, [isOnline, getUserFeedbackSummary]);
  
  // AI trust and transparency
  const getExplainabilityReport = useCallback(async (
    modelType: string
  ): Promise<ExplainabilityReport> => {
    if (isOnline) {
      try {
        const response = await fetch(`/api/ai/models/${modelType}/explainability`);
        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        console.error('[AIInsights] Failed to get explainability report:', error);
      }
    }
    
    // Return local report
    return {
      modelType,
      methodology: 'Gradient-based feature importance with SHAP values',
      features: [
        { feature: 'Business Impact', importance: 0.35, description: 'Service criticality and user impact' },
        { feature: 'Historical Patterns', importance: 0.25, description: 'Similar past incidents' },
        { feature: 'Time Factors', importance: 0.20, description: 'Time of day, duration' },
        { feature: 'Dependencies', importance: 0.20, description: 'Related services and components' },
      ],
      decisionProcess: [
        { step: 1, description: 'Data Collection', input: 'Entity attributes', output: 'Feature vector' },
        { step: 2, description: 'Feature Engineering', input: 'Feature vector', output: 'Normalized features' },
        { step: 3, description: 'Model Inference', input: 'Normalized features', output: 'Predictions' },
        { step: 4, description: 'Post-processing', input: 'Predictions', output: 'Final recommendation' },
      ],
      limitations: [
        'Limited to historical patterns',
        'May not account for unprecedented events',
        'Requires minimum data threshold',
      ],
    };
  }, [isOnline]);
  
  const getTrustMetrics = useCallback((): AITrustMetric[] => {
    return [
      {
        dimension: 'accuracy',
        score: 85,
        factors: ['Model performance', 'Prediction validation', 'User feedback'],
        trend: 'improving',
      },
      {
        dimension: 'reliability',
        score: 90,
        factors: ['Uptime', 'Consistency', 'Error rate'],
        trend: 'stable',
      },
      {
        dimension: 'transparency',
        score: 75,
        factors: ['Explainability', 'Documentation', 'Audit trail'],
        trend: 'improving',
      },
      {
        dimension: 'fairness',
        score: 80,
        factors: ['Bias testing', 'Equal treatment', 'Diverse training data'],
        trend: 'stable',
      },
      {
        dimension: 'security',
        score: 95,
        factors: ['Data protection', 'Access control', 'Privacy'],
        trend: 'stable',
      },
    ];
  }, []);
  
  const validatePrediction = useCallback(async (
    predictionId: string,
    actualValue: any
  ): Promise<ValidationResult> => {
    const prediction = predictions.find(p => p.id === predictionId);
    if (!prediction) {
      throw new Error('Prediction not found');
    }
    
    const error = Math.abs(prediction.prediction.value - actualValue);
    const errorPercentage = (error / prediction.prediction.value) * 100;
    
    const result: ValidationResult = {
      accurate: errorPercentage < 20,
      error: errorPercentage,
      errorType: actualValue > prediction.prediction.value ? 'underestimate' : 'overestimate',
      contributingFactors: errorPercentage > 20 
        ? ['Model drift', 'Unexpected events', 'Data quality issues']
        : [],
    };
    
    // Send validation to backend
    if (isOnline) {
      try {
        await fetch(`/api/ai/predictions/${predictionId}/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actualValue, result }),
        });
      } catch (error) {
        console.error('[AIInsights] Failed to validate prediction:', error);
      }
    }
    
    return result;
  }, [predictions, isOnline]);
  
  // Batch operations
  const batchAnalyze = useCallback(async (
    entities: Array<{ type: string; id: string }>
  ): Promise<BatchAnalysisResult> => {
    const startTime = Date.now();
    const insights: BatchAnalysisResult['insights'] = [];
    
    for (const entity of entities) {
      try {
        // Calculate scores
        const riskScore = aiEngine.current.calculateScore(entity.type, entity.id, 'risk');
        const healthScore = aiEngine.current.calculateScore(entity.type, entity.id, 'health');
        
        // Get recommendations
        const recs = await requestRecommendations({
          entityType: entity.type,
          entityId: entity.id,
        }, { maxRecommendations: 3 });
        
        // Check for anomalies
        const anomaly = await analyzeAnomaly(entity.type, entity.id, [1, 2, 3, 10, 2, 3]);
        
        insights.push({
          entityType: entity.type,
          entityId: entity.id,
          scores: [riskScore, healthScore],
          recommendations: recs,
          anomalies: anomaly.isAnomaly ? anomaly : undefined,
        });
      } catch (error) {
        console.error(`[AIInsights] Failed to analyze ${entity.type}:${entity.id}:`, error);
      }
    }
    
    return {
      analyzed: insights.length,
      insights,
      processingTime: Date.now() - startTime,
    };
  }, [requestRecommendations, analyzeAnomaly]);
  
  const compareInsights = useCallback(async (
    entityIds: string[],
    insightType: string
  ): Promise<ComparisonResult> => {
    // This would typically call a backend comparison service
    // For now, return a mock comparison
    return {
      entities: entityIds,
      similarities: [
        {
          factor: 'Risk Level',
          values: entityIds.reduce((acc, id) => ({ ...acc, [id]: 65 + Math.random() * 20 }), {}),
          variance: 15,
        },
      ],
      differences: [
        {
          factor: 'Priority',
          values: entityIds.reduce((acc, id) => ({ ...acc, [id]: Math.random() > 0.5 ? 'High' : 'Medium' }), {}),
          significance: 0.7,
        },
      ],
      clusters: [
        {
          entities: entityIds.slice(0, Math.ceil(entityIds.length / 2)),
          commonCharacteristics: ['High risk', 'Business critical'],
        },
      ],
    };
  }, []);
  
  // Real-time AI
  const subscribeToAIUpdates = useCallback((
    entityType: string,
    entityId: string
  ): (() => void) => {
    const key = `${entityType}:${entityId}`;
    
    // Subscribe to entity updates
    subscribeToEntity(entityType, entityId);
    
    // Register update handler
    const unsubscribe = onEntityUpdate((update) => {
      if (update.entityType === entityType && update.entityId === entityId) {
        // Recalculate scores on update
        const scores = ['risk', 'priority', 'health'] as const;
        scores.forEach(scoreType => {
          const score = aiEngine.current.calculateScore(entityType, entityId, scoreType);
          const scoreKey = `${entityType}:${entityId}:${scoreType}`;
          setAiScores(prev => ({ ...prev, [scoreKey]: score }));
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
  }, [subscribeToEntity, onEntityUpdate]);
  
  const getRealtimeScore = useCallback((
    entityType: string,
    entityId: string,
    scoreType: string
  ): AIScore | null => {
    const key = `${entityType}:${entityId}:${scoreType}`;
    return aiScores[key] || null;
  }, [aiScores]);
  
  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      subscriptions.current.forEach(unsubscribe => unsubscribe());
      subscriptions.current.clear();
    };
  }, []);
  
  // Memoized context value
  const value = useMemo<AIInsightsContextProps>(() => ({
    // AI-generated insights
    aiScores,
    explanations,
    recommendations,
    predictions,
    
    // Model information
    modelVersions,
    confidenceMetrics,
    
    // Request AI insights
    requestExplanation,
    requestRecommendations,
    requestPrediction,
    analyzeAnomaly,
    
    // Apply AI suggestions
    applyRecommendation,
    dismissRecommendation,
    provideFeedback,
    
    // AI learning and improvement
    reportInaccuracy,
    getUserFeedbackSummary,
    trainOnFeedback,
    
    // AI trust and transparency
    getExplainabilityReport,
    getTrustMetrics,
    validatePrediction,
    
    // Batch operations
    batchAnalyze,
    compareInsights,
    
    // Real-time AI
    subscribeToAIUpdates,
    getRealtimeScore,
  }), [
    aiScores,
    explanations,
    recommendations,
    predictions,
    modelVersions,
    confidenceMetrics,
    requestExplanation,
    requestRecommendations,
    requestPrediction,
    analyzeAnomaly,
    applyRecommendation,
    dismissRecommendation,
    provideFeedback,
    reportInaccuracy,
    getUserFeedbackSummary,
    trainOnFeedback,
    getExplainabilityReport,
    getTrustMetrics,
    validatePrediction,
    batchAnalyze,
    compareInsights,
    subscribeToAIUpdates,
    getRealtimeScore,
  ]);
  
  return (
    <AIInsightsContext.Provider value={value}>
      {children}
    </AIInsightsContext.Provider>
  );
};

// ---------------------------------
// 11. Custom Hooks
// ---------------------------------

export const useAIInsights = (): AIInsightsContextProps => {
  const context = useContext(AIInsightsContext);
  if (!context) {
    throw new Error('useAIInsights must be used within AIInsightsProvider');
  }
  return context;
};

export const useAIRecommendations = (entityType?: string, entityId?: string) => {
  const { recommendations, requestRecommendations, applyRecommendation, dismissRecommendation } = useAIInsights();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  
  const filteredRecommendations = useMemo(() => {
    if (!entityType && !entityId) return recommendations;
    return recommendations.filter(r => 
      (!entityType || r.entityType === entityType) &&
      (!entityId || r.entityId === entityId)
    );
  }, [recommendations, entityType, entityId]);
  
  const loadRecommendations = useCallback(async (context?: AIContext) => {
    setLoading(true);
    try {
      await requestRecommendations(context || { entityType, entityId });
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, requestRecommendations]);
  
  const apply = useCallback(async (recommendationId: string, actionId?: string) => {
    setApplying(recommendationId);
    try {
      return await applyRecommendation(recommendationId, actionId);
    } finally {
      setApplying(null);
    }
  }, [applyRecommendation]);
  
  const dismiss = useCallback(async (recommendationId: string, reason: string) => {
    await dismissRecommendation(recommendationId, reason);
  }, [dismissRecommendation]);
  
  return {
    recommendations: filteredRecommendations,
    loading,
    applying,
    loadRecommendations,
    apply,
    dismiss,
  };
};

export const useAIScore = (entityType: string, entityId: string, scoreType: string) => {
  const { getRealtimeScore, subscribeToAIUpdates } = useAIInsights();
  const [score, setScore] = useState<AIScore | null>(null);
  
  useEffect(() => {
    // Get initial score
    const initialScore = getRealtimeScore(entityType, entityId, scoreType);
    setScore(initialScore);
    
    // Subscribe to updates
    const unsubscribe = subscribeToAIUpdates(entityType, entityId);
    
    // Poll for score updates
    const interval = setInterval(() => {
      const updatedScore = getRealtimeScore(entityType, entityId, scoreType);
      if (updatedScore && (!score || updatedScore.calculatedAt !== score.calculatedAt)) {
        setScore(updatedScore);
      }
    }, 5000);
    
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [entityType, entityId, scoreType, getRealtimeScore, subscribeToAIUpdates]);
  
  return score;
};

export const useAIPredictions = (predictionType?: string) => {
  const { predictions, requestPrediction, validatePrediction } = useAIInsights();
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState<string | null>(null);
  
  const filteredPredictions = useMemo(() => {
    if (!predictionType) return predictions;
    return predictions.filter(p => p.predictionType === predictionType);
  }, [predictions, predictionType]);
  
  const predict = useCallback(async (context: PredictionContext) => {
    setLoading(true);
    try {
      return await requestPrediction(predictionType || 'general', context);
    } finally {
      setLoading(false);
    }
  }, [predictionType, requestPrediction]);
  
  const validate = useCallback(async (predictionId: string, actualValue: any) => {
    setValidating(predictionId);
    try {
      return await validatePrediction(predictionId, actualValue);
    } finally {
      setValidating(null);
    }
  }, [validatePrediction]);
  
  return {
    predictions: filteredPredictions,
    loading,
    validating,
    predict,
    validate,
  };
};