// src/contexts/index.ts
// Export all context providers and hooks for centralized access

// Phase 1: Core Infrastructure Contexts (Completed)
export { 
  RealtimeStreamProvider,
  useRealtimeStream,
  useEntityStream,
  useMetricStream,
  useConnectionStatus,
  type ConnectionStatus,
  type EventStream,
  type LiveMetric,
  type StatusUpdate,
  type EntityUpdate,
  type MetricUpdate,
  type StreamStatistics,
  type ConnectionHealth,
} from './RealtimeStreamContext';

export {
  NavigationTraceProvider,
  useNavigationTrace,
  useEntityNavigation,
  useEntityRelationships,
  useContextualActions,
  type EntityReference,
  type EntityRelationship,
  type RelationshipType,
  type NavigationBreadcrumb,
  type NavigationContext,
  type TracePath,
  type ContextualAction,
  type DeepLinkConfig,
  type EntityGraph,
} from './NavigationTraceContext';

export {
  OfflineCapabilityProvider,
  useOfflineCapability,
  useOfflineStatus,
  useOfflineAction,
  useConflictResolution,
  type ConnectivityQuality,
  type SyncStatus,
  type QueuedAction,
  type OfflineAction,
  type SyncConflict,
  type ConflictResolution,
  type CriticalDataCache,
  type OfflineCapability,
  type DegradedCapability,
  type ServiceWorkerState,
  type BackgroundSyncTask,
} from './OfflineCapabilityContext';

// Phase 2: Intelligence & Collaboration Contexts (Completed)
export {
  AIInsightsProvider,
  useAIInsights,
  useAIRecommendations,
  useAIScore,
  useAIPredictions,
  type AIScore,
  type AIExplanation,
  type AIRecommendation,
  type AIPrediction,
  type ModelVersion,
  type ConfidenceMetric,
  type AIContext,
  type PredictionContext,
  type AIFeedback,
  type ExplainabilityReport,
  type AITrustMetric,
} from './AIInsightsContext';

export {
  BusinessImpactProvider,
  useBusinessImpact,
  useServiceHealth,
  useSLAMonitoring,
  useBusinessMetrics,
  type BusinessImpactMetric,
  type DependencyMap,
  type CascadeEffect,
  type CostImpact,
  type BusinessServiceHealth,
  type ServiceAvailabilityMetric,
  type SLAStatus,
  type BusinessPriority,
  type RiskAssessment,
  type ComplianceImplication,
  type CustomerImpactMetric,
  type RevenueImpact,
  type CostSavingsOpportunity,
  type ImpactVisualization,
  type DependencyGraph,
  type CascadeAnalysis,
} from './BusinessImpactContext';

export * from './CollaborationContext';
export * from './MetricsAnalyticsContext';
export * from './ResourceOptimizationContext';

// Phase 3: Advanced Analytics Contexts (Completed)

/**
 * CollaborationContext - Real-time team collaboration
 * Features:
 * - Active user presence tracking
 * - Real-time chat and messaging
 * - Work handoff and assignment management
 * - Team coordination and announcements
 * - Approval workflows
 */
export interface CollaborationContextProps {
  // Real-time collaboration state
  activeUsers: ActiveUser[];
  teamPresence: TeamPresenceStatus[];
  userActivity: UserActivity[];
  
  // Chat and communication
  chatSessions: ChatSession[];
  notifications: CollaborationNotification[];
  mentions: Mention[];
  
  // Handoff and assignment management  
  handoffQueue: HandoffRequest[];
  assignmentHistory: AssignmentHistory[];
  escalationStatus: EscalationStatus[];
  
  // Collaboration actions
  startChatSession: (entityId: string, entityType: string) => Promise<ChatSession>;
  sendMessage: (sessionId: string, message: string) => Promise<void>;
  requestHandoff: (workItemId: string, targetUser: string, notes: string) => Promise<void>;
  acceptHandoff: (handoffId: string) => Promise<void>;
  
  // Team coordination
  announcePresence: (status: PresenceStatus) => void;
  requestAssistance: (workItemId: string, expertise: string[]) => Promise<void>;
  offerAssistance: (requestId: string) => Promise<void>;
  
  // Approval workflows
  approvalChains: ApprovalChain[];
  pendingApprovals: PendingApproval[];
  submitForApproval: (entityId: string, approvers: string[]) => Promise<void>;
  processApproval: (approvalId: string, decision: ApprovalDecision) => Promise<void>;
}

export interface ActiveUser {
  userId: string;
  username: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  currentEntity?: { type: string; id: string };
  lastActivity: string;
  avatar?: string;
  role?: string;
}

export interface TeamPresenceStatus {
  teamId: string;
  teamName: string;
  onlineCount: number;
  totalMembers: number;
  availability: number; // percentage
}

export interface UserActivity {
  userId: string;
  activityType: string;
  entityType?: string;
  entityId?: string;
  timestamp: string;
  description: string;
}

export interface ChatSession {
  id: string;
  entityType?: string;
  entityId?: string;
  participants: string[];
  messages: ChatMessage[];
  createdAt: string;
  lastMessageAt?: string;
  status: 'active' | 'archived';
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  userId: string;
  message: string;
  timestamp: string;
  attachments?: MessageAttachment[];
  reactions?: MessageReaction[];
}

export interface MessageAttachment {
  id: string;
  type: 'file' | 'image' | 'link';
  name: string;
  url: string;
  size?: number;
}

export interface MessageReaction {
  emoji: string;
  userId: string;
}

export interface CollaborationNotification {
  id: string;
  type: 'mention' | 'handoff' | 'approval' | 'assistance';
  from: string;
  message: string;
  entityRef?: { type: string; id: string };
  timestamp: string;
  read: boolean;
}

export interface Mention {
  id: string;
  userId: string;
  mentionedBy: string;
  context: string;
  entityType?: string;
  entityId?: string;
  timestamp: string;
}

export interface HandoffRequest {
  id: string;
  workItemId: string;
  workItemType: string;
  fromUser: string;
  toUser?: string;
  toTeam?: string;
  notes: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  status: 'pending' | 'accepted' | 'rejected';
  requestedAt: string;
  acceptedAt?: string;
}

export interface AssignmentHistory {
  id: string;
  entityType: string;
  entityId: string;
  assignedTo: string;
  assignedBy: string;
  assignedAt: string;
  unassignedAt?: string;
  reason?: string;
}

export interface EscalationStatus {
  id: string;
  entityType: string;
  entityId: string;
  currentLevel: number;
  maxLevel: number;
  escalatedTo: string;
  escalatedBy: string;
  escalatedAt: string;
  reason: string;
}

export interface ApprovalChain {
  id: string;
  entityType: string;
  entityId: string;
  approvers: ApprovalNode[];
  currentStep: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: string;
  completedAt?: string;
}

export interface ApprovalNode {
  userId: string;
  role?: string;
  order: number;
  decision?: 'approved' | 'rejected';
  comments?: string;
  decidedAt?: string;
}

export interface PendingApproval {
  id: string;
  chainId: string;
  entityType: string;
  entityId: string;
  requestedBy: string;
  requestedAt: string;
  dueBy?: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
}

export interface ApprovalDecision {
  decision: 'approved' | 'rejected';
  comments?: string;
  conditions?: string[];
}

export interface PresenceStatus {
  status: 'online' | 'away' | 'busy' | 'offline';
  message?: string;
  autoReply?: boolean;
}

/**
 * MetricsAnalyticsContext - Analytics and reporting
 * Features:
 * - KPI metrics and performance tracking
 * - Dashboard configuration management
 * - Report generation and scheduling
 * - Historical data analysis
 * - Predictive analytics
 * - Real-time metric streaming
 */
export interface MetricsAnalyticsContextProps {
  // Backend analytics and metrics
  kpiMetrics: KPIMetric[];
  performanceMetrics: PerformanceMetric[];
  trendAnalysis: TrendAnalysis[];
  
  // Dashboard data
  dashboardConfigs: DashboardConfig[];
  widgetData: WidgetData[];
  
  // Reporting capabilities
  generateReport: (config: ReportConfig) => Promise<AnalyticsReport>;
  scheduleReport: (config: ReportConfig, schedule: ReportSchedule) => Promise<void>;
  exportData: (exportConfig: ExportConfig) => Promise<ExportResult>;
  
  // Historical data and trends
  getMetricHistory: (metricId: string, timeRange: TimeRange) => Promise<MetricHistory>;
  getTrendAnalysis: (metricIds: string[], timeframe: string) => Promise<TrendAnalysis>;
  
  // Predictive analytics
  forecastData: ForecastData[];
  anomalyDetection: AnomalyAlert[];
  getPredictiveModel: (modelType: string) => PredictiveModel;
  
  // Performance benchmarking
  benchmarkData: BenchmarkData[];
  industryComparisons: IndustryComparison[];
  
  // Real-time analytics
  liveMetrics: LiveAnalyticMetric[];
  metricAlerts: MetricAlert[];
  subscribeToMetric: (metricId: string) => void;
}

export interface KPIMetric {
  id: string;
  name: string;
  category: string;
  value: number;
  target: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  percentageChange: number;
  status: 'on_target' | 'at_risk' | 'off_target';
  lastUpdated: string;
}

export interface PerformanceMetric {
  id: string;
  metricType: string;
  dimensions: Record<string, string>;
  value: number;
  percentile?: number;
  baseline?: number;
  timestamp: string;
}

export interface TrendAnalysis {
  metricId: string;
  period: string;
  dataPoints: DataPoint[];
  trendLine: TrendLine;
  seasonality?: SeasonalityPattern;
  outliers: Outlier[];
  forecast?: ForecastData;
}

export interface DataPoint {
  timestamp: string;
  value: number;
  metadata?: Record<string, any>;
}

export interface TrendLine {
  slope: number;
  intercept: number;
  r2: number;
  confidence: number;
}

export interface SeasonalityPattern {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  amplitude: number;
  phase: number;
}

export interface Outlier {
  timestamp: string;
  value: number;
  zscore: number;
  reason?: string;
}

export interface ForecastData {
  metricId: string;
  predictions: DataPoint[];
  confidenceInterval: {
    lower: DataPoint[];
    upper: DataPoint[];
  };
  accuracy: number;
  method: string;
}

export interface DashboardConfig {
  id: string;
  name: string;
  layout: LayoutConfig;
  widgets: WidgetConfig[];
  filters: FilterConfig[];
  refreshInterval?: number;
  isDefault?: boolean;
}

export interface LayoutConfig {
  type: 'grid' | 'flex' | 'masonry';
  columns?: number;
  gap?: number;
}

export interface WidgetConfig {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'map' | 'custom';
  dataSource: string;
  visualization: VisualizationConfig;
  position?: { x: number; y: number; w: number; h: number };
}

export interface VisualizationConfig {
  chartType?: string;
  colors?: string[];
  axes?: any;
  legend?: any;
}

export interface FilterConfig {
  field: string;
  operator: string;
  value: any;
  label?: string;
}

export interface WidgetData {
  widgetId: string;
  data: any;
  lastUpdated: string;
  nextUpdate?: string;
}

export interface ReportConfig {
  name: string;
  type: 'operational' | 'executive' | 'technical' | 'compliance';
  metrics: string[];
  timeRange: TimeRange;
  format: 'pdf' | 'excel' | 'html' | 'json';
  recipients?: string[];
  includeCharts?: boolean;
  includeRawData?: boolean;
}

export interface TimeRange {
  start: string;
  end: string;
  granularity?: 'minute' | 'hour' | 'day' | 'week' | 'month';
}

export interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  time?: string;
  timezone?: string;
}

export interface AnalyticsReport {
  id: string;
  name: string;
  generatedAt: string;
  data: any;
  format: string;
  size: number;
  url?: string;
}

export interface ExportConfig {
  dataType: string;
  filters?: FilterConfig[];
  format: 'csv' | 'json' | 'xml';
  compression?: boolean;
}

export interface ExportResult {
  id: string;
  filename: string;
  size: number;
  url: string;
  expiresAt: string;
}

export interface MetricHistory {
  metricId: string;
  dataPoints: DataPoint[];
  aggregations: {
    min: number;
    max: number;
    avg: number;
    sum: number;
    count: number;
  };
}

export interface PredictiveModel {
  id: string;
  type: string;
  accuracy: number;
  features: string[];
  lastTrained: string;
}

export interface AnomalyAlert {
  id: string;
  metricId: string;
  timestamp: string;
  value: number;
  expectedValue: number;
  deviation: number;
  severity: 'critical' | 'warning' | 'info';
}

export interface BenchmarkData {
  metric: string;
  ourValue: number;
  industryAverage: number;
  topPerformer: number;
  percentile: number;
}

export interface IndustryComparison {
  category: string;
  metrics: BenchmarkData[];
  overallScore: number;
  rank?: number;
  totalCompanies?: number;
}

export interface LiveAnalyticMetric {
  id: string;
  name: string;
  value: number;
  timestamp: string;
  sparkline?: number[];
}

export interface MetricAlert {
  id: string;
  metricId: string;
  condition: string;
  threshold: number;
  currentValue: number;
  triggeredAt: string;
  severity: 'critical' | 'warning' | 'info';
}

/**
 * ResourceOptimizationContext - Resource management
 * Features:
 * - Capacity forecasting and planning
 * - Conflict detection and resolution
 * - Intelligent scheduling
 * - Automated resource management
 * - Workload distribution
 * - Budget optimization
 */
export interface ResourceOptimizationContextProps {
  // Backend optimization algorithms
  capacityForecasts: CapacityForecast[];
  resourceUtilization: ResourceUtilization[];
  optimizationSuggestions: OptimizationSuggestion[];
  
  // Conflict detection and resolution
  resourceConflicts: ResourceConflict[];
  schedulingConflicts: SchedulingConflict[];
  resolutionStrategies: ConflictResolutionStrategy[];
  
  // Intelligent scheduling
  scheduleOptimization: ScheduleOptimization[];
  workloadDistribution: WorkloadDistribution[];
  skillMatching: SkillMatchResult[];
  
  // Automated resource management
  automatedAssignments: AutomatedAssignment[];
  escalationRules: EscalationRule[];
  capacityThresholds: CapacityThreshold[];
  
  // Resource planning
  demandForecasting: DemandForecast[];
  resourcePlanning: ResourcePlan[];
  budgetOptimization: BudgetOptimization[];
  
  // Apply optimizations
  applyOptimization: (optimizationId: string) => Promise<void>;
  scheduleCapacityReview: (teamId: string, date: string) => Promise<void>;
  requestResourceAugmentation: (requirements: ResourceRequirement[]) => Promise<void>;
}

export interface CapacityForecast {
  id: string;
  resourceType: string;
  timeframe: TimeRange;
  currentCapacity: number;
  forecastedDemand: number;
  utilizationForecast: number;
  shortage?: number;
  surplus?: number;
  confidence: number;
}

export interface ResourceUtilization {
  resourceId: string;
  resourceType: string;
  currentUtilization: number;
  optimalUtilization: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  allocations: ResourceAllocation[];
}

export interface ResourceAllocation {
  taskId: string;
  taskType: string;
  allocation: number;
  startTime: string;
  endTime: string;
  priority: number;
}

export interface OptimizationSuggestion {
  id: string;
  type: 'reallocation' | 'automation' | 'consolidation' | 'expansion';
  description: string;
  impact: {
    efficiency: number;
    cost: number;
    quality: number;
  };
  effort: 'low' | 'medium' | 'high';
  confidence: number;
  actions: string[];
}

export interface ResourceConflict {
  id: string;
  resources: string[];
  conflictType: 'overallocation' | 'skill_mismatch' | 'availability' | 'dependency';
  severity: 'critical' | 'high' | 'medium' | 'low';
  timeframe: TimeRange;
  resolution?: string;
}

export interface SchedulingConflict {
  id: string;
  tasks: string[];
  conflictType: 'overlap' | 'dependency' | 'resource' | 'constraint';
  description: string;
  suggestedResolution?: string;
}

export interface ConflictResolutionStrategy {
  conflictId: string;
  strategy: 'reschedule' | 'reassign' | 'split' | 'defer' | 'escalate';
  details: string;
  impact: string;
  approvalRequired: boolean;
}

export interface ScheduleOptimization {
  id: string;
  originalSchedule: Schedule;
  optimizedSchedule: Schedule;
  improvements: {
    efficiency: number;
    cost: number;
    balance: number;
  };
  constraints: string[];
}

export interface Schedule {
  tasks: ScheduledTask[];
  resources: ScheduledResource[];
  totalDuration: number;
  totalCost: number;
}

export interface ScheduledTask {
  id: string;
  name: string;
  resourceId: string;
  startTime: string;
  endTime: string;
  dependencies?: string[];
}

export interface ScheduledResource {
  id: string;
  name: string;
  type: string;
  availability: TimeRange[];
  skills?: string[];
  cost?: number;
}

export interface WorkloadDistribution {
  teamId: string;
  members: TeamMemberWorkload[];
  balance: number; // 0-100, higher is better
  recommendations: string[];
}

export interface TeamMemberWorkload {
  userId: string;
  currentLoad: number;
  optimalLoad: number;
  tasks: string[];
  skills: string[];
}

export interface SkillMatchResult {
  taskId: string;
  requiredSkills: string[];
  matches: SkillMatch[];
  bestMatch?: string;
  confidence: number;
}

export interface SkillMatch {
  resourceId: string;
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  availability: number;
}

export interface AutomatedAssignment {
  id: string;
  taskId: string;
  resourceId: string;
  assignedAt: string;
  reason: string;
  confidence: number;
  overridable: boolean;
}

export interface EscalationRule {
  id: string;
  condition: string;
  threshold: number;
  escalationPath: string[];
  autoEscalate: boolean;
  notifyList: string[];
}

export interface CapacityThreshold {
  resourceType: string;
  warningLevel: number;
  criticalLevel: number;
  actions: ThresholdAction[];
}

export interface ThresholdAction {
  level: 'warning' | 'critical';
  action: string;
  automated: boolean;
}

export interface DemandForecast {
  resourceType: string;
  timeframe: TimeRange;
  predictedDemand: DataPoint[];
  confidence: number;
  drivers: string[];
}

export interface ResourcePlan {
  id: string;
  timeframe: TimeRange;
  resources: PlannedResource[];
  totalCost: number;
  constraints: string[];
  risks: string[];
}

export interface PlannedResource {
  type: string;
  quantity: number;
  timing: string;
  cost: number;
  justification: string;
}

export interface BudgetOptimization {
  currentBudget: number;
  optimizedBudget: number;
  savings: number;
  reallocations: BudgetReallocation[];
  tradeoffs: string[];
}

export interface BudgetReallocation {
  from: string;
  to: string;
  amount: number;
  reason: string;
  impact: string;
}

export interface ResourceRequirement {
  type: string;
  quantity: number;
  skills?: string[];
  duration: string;
  urgency: 'immediate' | 'urgent' | 'normal' | 'low';
}

// ---------------------------------
// Composed Context Hooks
// ---------------------------------

/**
 * Master hook that combines all contexts for comprehensive operations
 */
export const useOpsHubOperations = () => {
  // This would combine all contexts when implemented
  return {
    // Placeholder for now
    ready: false,
  };
};

/**
 * Hook for intelligent operations combining AI, business impact, and resources
 */
export const useIntelligentOperations = () => {
  // This would combine AI, Business, and Resource contexts
  return {
    // Placeholder for now
    ready: false,
  };
};

/**
 * Hook for real-time collaborative analytics
 */
export const useRealtimeAnalytics = () => {
  // This would combine Realtime, Metrics, and Collaboration contexts
  return {
    // Placeholder for now
    ready: false,
  };
};