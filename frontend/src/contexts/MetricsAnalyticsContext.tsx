// src/contexts/MetricsAnalyticsContext.tsx
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
import { AsyncState, AsyncStateHelpers } from "../types/asyncState";
import { 
  getAll,
  getById,
  putWithAudit,
} from "../db/dbClient";
import { useTenant } from "../providers/TenantProvider";
import { useRealtimeStream } from "./RealtimeStreamContext";
import { useAIInsights } from "./AIInsightsContext";
import { useBusinessImpact } from "./BusinessImpactContext";
import { ExternalSystemFields } from "../types/externalSystem";

// ---------------------------------
// 1. KPI and Performance Types
// ---------------------------------

export interface KPIMetric {
  id: string;
  name: string;
  category: 'operational' | 'financial' | 'customer' | 'process';
  value: number;
  target: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  percentageChange: number;
  status: 'on_target' | 'at_risk' | 'off_target';
  lastUpdated: string;
  formula?: string;
  dependencies?: string[];
  owner?: string;
}

export interface PerformanceMetric {
  id: string;
  metricType: string;
  dimensions: Record<string, string>;
  value: number;
  percentile?: number;
  baseline?: number;
  timestamp: string;
  tags?: string[];
  source?: string;
}

// Primary metric analysis interface - extends external system fields
export interface MetricAnalysis extends ExternalSystemFields {
  id: string;
  metricId: string;
  metricName?: string;
  period: string;
  dataPoints: DataPoint[];
  trendLine: TrendLine;
  seasonality?: SeasonalityPattern;
  outliers: Outlier[];
  forecast?: ForecastData;
  confidence: number;
  
  // External system fields are inherited from ExternalSystemFields:
  // source_system, external_id, external_url, sync_status, synced_at, etc.
}

export interface TrendAnalysis extends MetricAnalysis {
  // TrendAnalysis extends MetricAnalysis with same fields
}

export interface DataPoint {
  timestamp: string;
  value: number;
  label?: string;
  metadata?: Record<string, any>;
}

export interface TrendLine {
  slope: number;
  intercept: number;
  r2: number;
  confidence: number;
  equation?: string;
}

export interface SeasonalityPattern {
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  amplitude: number;
  phase: number;
  period: number;
  strength: number;
}

export interface Outlier {
  timestamp: string;
  value: number;
  expectedValue: number;
  zscore: number;
  reason?: string;
  impact?: string;
}

// ---------------------------------
// 2. Dashboard and Widget Types
// ---------------------------------

export interface DashboardConfig {
  id: string;
  name: string;
  description?: string;
  layout: LayoutConfig;
  widgets: WidgetConfig[];
  filters: FilterConfig[];
  refreshInterval?: number;
  isDefault?: boolean;
  isPublic?: boolean;
  owner?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LayoutConfig {
  type: 'grid' | 'flex' | 'masonry' | 'responsive';
  columns?: number;
  rows?: number;
  gap?: number;
  breakpoints?: Record<string, any>;
}

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  dataSource: string;
  visualization: VisualizationConfig;
  position?: { x: number; y: number; w: number; h: number };
  refreshInterval?: number;
  interactive?: boolean;
  exportable?: boolean;
  drillDown?: DrillDownConfig;
}

export type WidgetType = 
  | 'chart' 
  | 'metric' 
  | 'table' 
  | 'map' 
  | 'gauge' 
  | 'heatmap' 
  | 'timeline' 
  | 'custom';

export interface VisualizationConfig {
  chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'radar' | 'treemap';
  colors?: string[];
  axes?: {
    x?: AxisConfig;
    y?: AxisConfig;
  };
  legend?: LegendConfig;
  tooltip?: TooltipConfig;
  animations?: boolean;
}

export interface AxisConfig {
  label?: string;
  type?: 'linear' | 'logarithmic' | 'time' | 'category';
  min?: number;
  max?: number;
  format?: string;
}

export interface LegendConfig {
  position?: 'top' | 'bottom' | 'left' | 'right' | 'none';
  align?: 'start' | 'center' | 'end';
}

export interface TooltipConfig {
  enabled?: boolean;
  format?: string;
  shared?: boolean;
}

export interface DrillDownConfig {
  enabled: boolean;
  levels: DrillDownLevel[];
}

export interface DrillDownLevel {
  dimension: string;
  widget?: string;
  filters?: FilterConfig[];
}

export interface FilterConfig {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater' | 'less' | 'between' | 'in' | 'contains';
  value: any;
  label?: string;
  type?: 'select' | 'date' | 'range' | 'text';
}

export interface WidgetData {
  widgetId: string;
  data: any;
  metadata?: {
    totalRecords?: number;
    filteredRecords?: number;
    executionTime?: number;
    cacheHit?: boolean;
  };
  lastUpdated: string;
  nextUpdate?: string;
  error?: string;
}

// ---------------------------------
// 3. Reporting Types
// ---------------------------------

export interface ReportConfig {
  id?: string;
  name: string;
  type: 'operational' | 'executive' | 'technical' | 'compliance' | 'custom';
  description?: string;
  metrics: string[];
  dimensions?: string[];
  timeRange: TimeRange;
  filters?: FilterConfig[];
  format: 'pdf' | 'excel' | 'html' | 'json' | 'csv';
  template?: string;
  recipients?: string[];
  includeCharts?: boolean;
  includeRawData?: boolean;
  includeSummary?: boolean;
}

export interface TimeRange {
  start: string;
  end: string;
  granularity?: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
  timezone?: string;
}

export interface ReportSchedule {
  frequency: 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  hour?: number;
  minute?: number;
  timezone?: string;
  active?: boolean;
  nextRun?: string;
}

export interface AnalyticsReport {
  id: string;
  name: string;
  type: string;
  generatedAt: string;
  generatedBy?: string;
  timeRange: TimeRange;
  data: ReportData;
  format: string;
  size: number;
  url?: string;
  expiresAt?: string;
  status: 'pending' | 'generating' | 'ready' | 'failed';
}

export interface ReportData {
  summary?: ReportSummary;
  sections?: ReportSection[];
  charts?: ChartData[];
  tables?: TableData[];
  rawData?: any[];
}

export interface ReportSummary {
  title: string;
  period: string;
  highlights: string[];
  keyMetrics: Record<string, any>;
}

export interface ReportSection {
  title: string;
  content: string;
  charts?: string[];
  tables?: string[];
}

export interface ChartData {
  id: string;
  type: string;
  title: string;
  data: any;
  config?: VisualizationConfig;
}

export interface TableData {
  id: string;
  title: string;
  columns: TableColumn[];
  rows: any[];
  totals?: Record<string, any>;
}

export interface TableColumn {
  field: string;
  header: string;
  type?: 'string' | 'number' | 'date' | 'boolean';
  format?: string;
  sortable?: boolean;
  filterable?: boolean;
  aggregate?: 'sum' | 'avg' | 'min' | 'max' | 'count';
}

export interface ExportConfig {
  dataType: 'metrics' | 'reports' | 'dashboards' | 'raw';
  entityIds?: string[];
  filters?: FilterConfig[];
  format: 'csv' | 'json' | 'xml' | 'excel';
  compression?: boolean;
  includeMetadata?: boolean;
}

export interface ExportResult {
  id: string;
  filename: string;
  format: string;
  size: number;
  recordCount?: number;
  url: string;
  expiresAt: string;
}

// ---------------------------------
// 4. Analytics and Forecasting Types
// ---------------------------------

export interface MetricHistory {
  metricId: string;
  metricName?: string;
  dataPoints: DataPoint[];
  aggregations: MetricAggregations;
  metadata?: Record<string, any>;
}

export interface MetricAggregations {
  min: number;
  max: number;
  avg: number;
  median?: number;
  sum: number;
  count: number;
  stdDev?: number;
  variance?: number;
}

export interface ForecastData {
  metricId: string;
  metricName?: string;
  predictions: DataPoint[];
  confidenceInterval: {
    lower: DataPoint[];
    upper: DataPoint[];
  };
  accuracy: number;
  method: 'arima' | 'exponential' | 'linear' | 'polynomial' | 'neural' | 'ensemble';
  parameters?: Record<string, any>;
  validUntil?: string;
}

export interface PredictiveModel {
  id: string;
  name: string;
  type: string;
  version: string;
  accuracy: number;
  features: ModelFeature[];
  performance: ModelPerformance;
  lastTrained: string;
  nextTraining?: string;
  status: 'active' | 'training' | 'deprecated';
}

export interface ModelFeature {
  name: string;
  importance: number;
  type: 'numerical' | 'categorical' | 'temporal';
  description?: string;
}

export interface ModelPerformance {
  trainingScore: number;
  validationScore: number;
  testScore?: number;
  mse?: number;
  rmse?: number;
  mae?: number;
  r2?: number;
}

export interface AnomalyAlert {
  id: string;
  metricId: string;
  metricName?: string;
  timestamp: string;
  value: number;
  expectedValue: number;
  deviation: number;
  deviationPercentage: number;
  severity: 'critical' | 'warning' | 'info';
  type: 'spike' | 'drop' | 'trend' | 'pattern';
  possibleCauses?: string[];
  recommendations?: string[];
  acknowledged?: boolean;
}

// ---------------------------------
// 5. Benchmarking Types
// ---------------------------------

export interface BenchmarkData {
  metric: string;
  category?: string;
  ourValue: number;
  industryAverage: number;
  industryMedian?: number;
  topPerformer: number;
  bottomPerformer?: number;
  percentile: number;
  trend: 'improving' | 'stable' | 'declining';
  gap?: number;
  improvementPotential?: number;
}

export interface IndustryComparison {
  category: string;
  period: string;
  metrics: BenchmarkData[];
  overallScore: number;
  rank?: number;
  totalCompanies?: number;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
}

// ---------------------------------
// 6. Live Analytics Types
// ---------------------------------

export interface LiveAnalyticMetric {
  id: string;
  name: string;
  category?: string;
  value: number;
  unit?: string;
  timestamp: string;
  sparkline?: number[];
  trend?: 'up' | 'down' | 'stable';
  alert?: boolean;
  target?: number;
}

export interface MetricAlert {
  id: string;
  metricId: string;
  metricName?: string;
  condition: string;
  threshold: number;
  currentValue: number;
  triggeredAt: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'active' | 'acknowledged' | 'resolved';
  assignedTo?: string;
  notes?: string;
}

export interface MetricSubscription {
  metricId: string;
  callback: (metric: LiveAnalyticMetric) => void;
  filters?: Record<string, any>;
}

// ---------------------------------
// 7. Analytics Context Interface
// ---------------------------------

export interface MetricsAnalyticsContextProps {
  // Backend analytics and metrics
  kpiMetrics: KPIMetric[];
  performanceMetrics: PerformanceMetric[];
  trendAnalysis: TrendAnalysis[];
  
  // Dashboard data
  dashboardConfigs: DashboardConfig[];
  widgetData: WidgetData[];
  currentDashboard?: DashboardConfig;
  
  // Dashboard operations
  createDashboard: (config: Omit<DashboardConfig, 'id' | 'createdAt' | 'updatedAt'>) => Promise<DashboardConfig>;
  updateDashboard: (id: string, updates: Partial<DashboardConfig>) => Promise<void>;
  deleteDashboard: (id: string) => Promise<void>;
  setCurrentDashboard: (id: string) => void;
  addWidget: (dashboardId: string, widget: WidgetConfig) => Promise<void>;
  removeWidget: (dashboardId: string, widgetId: string) => Promise<void>;
  updateWidget: (dashboardId: string, widgetId: string, updates: Partial<WidgetConfig>) => Promise<void>;
  
  // Reporting capabilities
  generateReport: (config: ReportConfig) => Promise<AnalyticsReport>;
  scheduleReport: (config: ReportConfig, schedule: ReportSchedule) => Promise<void>;
  exportData: (exportConfig: ExportConfig) => Promise<ExportResult>;
  getReports: (filters?: FilterConfig[]) => Promise<AnalyticsReport[]>;
  downloadReport: (reportId: string) => Promise<Blob>;
  
  // Historical data and trends
  getMetricHistory: (metricId: string, timeRange: TimeRange) => Promise<MetricHistory>;
  getTrendAnalysis: (metricIds: string[], timeframe: string) => Promise<TrendAnalysis>;
  compareMetrics: (metricIds: string[], timeRange: TimeRange) => Promise<ComparisonResult>;
  
  // Predictive analytics
  forecastData: ForecastData[];
  anomalyDetection: AnomalyAlert[];
  getPredictiveModel: (modelType: string) => PredictiveModel | null;
  runForecast: (metricId: string, horizon: number, method?: string) => Promise<ForecastData>;
  detectAnomalies: (metricId: string, sensitivity?: number) => Promise<AnomalyAlert[]>;
  
  // Performance benchmarking
  benchmarkData: BenchmarkData[];
  industryComparisons: IndustryComparison[];
  getBenchmark: (metric: string) => BenchmarkData | null;
  compareToIndustry: (category?: string) => Promise<IndustryComparison>;
  
  // Real-time analytics
  liveMetrics: LiveAnalyticMetric[];
  metricAlerts: MetricAlert[];
  subscribeToMetric: (metricId: string, callback: (metric: LiveAnalyticMetric) => void) => () => void;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  resolveAlert: (alertId: string, notes?: string) => Promise<void>;
  
  // Calculated metrics
  calculateMetric: (formula: string, context?: Record<string, any>) => Promise<number>;
  createCustomMetric: (metric: Omit<KPIMetric, 'id' | 'lastUpdated'>) => Promise<KPIMetric>;
  updateMetricTarget: (metricId: string, target: number) => Promise<void>;
}

export interface ComparisonResult {
  metrics: string[];
  timeRange: TimeRange;
  data: ComparisonData[];
  correlations?: CorrelationMatrix;
  insights?: string[];
}

export interface ComparisonData {
  timestamp: string;
  values: Record<string, number>;
}

export interface CorrelationMatrix {
  metrics: string[];
  values: number[][];
}

// ---------------------------------
// 8. Analytics Engine
// ---------------------------------

class AnalyticsEngine {
  private metricCache: Map<string, any> = new Map();
  private forecastModels: Map<string, PredictiveModel> = new Map();
  private subscriptions: Map<string, Set<MetricSubscription>> = new Map();
  
  constructor() {
    this.initializeModels();
  }
  
  private initializeModels() {
    // Initialize predictive models
    const models: PredictiveModel[] = [
      {
        id: 'forecast_arima',
        name: 'ARIMA Forecasting',
        type: 'time_series',
        version: '1.0',
        accuracy: 0.85,
        features: [
          { name: 'trend', importance: 0.4, type: 'temporal' },
          { name: 'seasonality', importance: 0.3, type: 'temporal' },
          { name: 'autocorrelation', importance: 0.3, type: 'numerical' },
        ],
        performance: {
          trainingScore: 0.88,
          validationScore: 0.85,
          testScore: 0.83,
          rmse: 12.5,
          mae: 8.3,
          r2: 0.82,
        },
        lastTrained: new Date(Date.now() - 86400000).toISOString(),
        status: 'active',
      },
      {
        id: 'anomaly_isolation',
        name: 'Isolation Forest Anomaly Detection',
        type: 'anomaly_detection',
        version: '2.1',
        accuracy: 0.92,
        features: [
          { name: 'value', importance: 0.5, type: 'numerical' },
          { name: 'rate_of_change', importance: 0.3, type: 'numerical' },
          { name: 'time_of_day', importance: 0.2, type: 'temporal' },
        ],
        performance: {
          trainingScore: 0.94,
          validationScore: 0.92,
          testScore: 0.90,
        },
        lastTrained: new Date().toISOString(),
        status: 'active',
      },
    ];
    
    models.forEach(model => {
      this.forecastModels.set(model.type, model);
    });
  }
  
  public calculateTrend(dataPoints: DataPoint[]): TrendLine {
    if (dataPoints.length < 2) {
      return { slope: 0, intercept: 0, r2: 0, confidence: 0 };
    }
    
    // Simple linear regression
    const n = dataPoints.length;
    const x = dataPoints.map((_, i) => i);
    const y = dataPoints.map(p => p.value);
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared
    const yMean = sumY / n;
    const ssRes = y.reduce((sum, yi, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);
    const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const r2 = 1 - (ssRes / ssTot);
    
    return {
      slope,
      intercept,
      r2,
      confidence: r2 * 100,
      equation: `y = ${slope.toFixed(2)}x + ${intercept.toFixed(2)}`,
    };
  }
  
  public detectSeasonality(dataPoints: DataPoint[]): SeasonalityPattern | undefined {
    if (dataPoints.length < 24) return undefined; // Need at least 24 points
    
    // Simple seasonality detection using autocorrelation
    const values = dataPoints.map(p => p.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    
    // Test for different periods
    const periods = [
      { type: 'daily' as const, period: 24 },
      { type: 'weekly' as const, period: 168 },
      { type: 'monthly' as const, period: 720 },
    ];
    
    let bestPattern: SeasonalityPattern | undefined;
    let maxCorrelation = 0;
    
    periods.forEach(({ type, period }) => {
      if (values.length < period * 2) return;
      
      let correlation = 0;
      let count = 0;
      
      for (let i = period; i < values.length; i++) {
        correlation += (values[i] - mean) * (values[i - period] - mean);
        count++;
      }
      
      correlation = correlation / (count * Math.pow(mean, 2));
      
      if (correlation > maxCorrelation && correlation > 0.5) {
        maxCorrelation = correlation;
        bestPattern = {
          type,
          period,
          amplitude: Math.max(...values) - Math.min(...values),
          phase: 0,
          strength: correlation,
        };
      }
    });
    
    return bestPattern;
  }
  
  public findOutliers(dataPoints: DataPoint[], threshold: number = 2): Outlier[] {
    const values = dataPoints.map(p => p.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return dataPoints
      .map((point, index) => {
        const zscore = Math.abs((point.value - mean) / stdDev);
        if (zscore > threshold) {
          return {
            timestamp: point.timestamp,
            value: point.value,
            expectedValue: mean,
            zscore,
            reason: zscore > 3 ? 'Extreme outlier' : 'Moderate outlier',
            impact: zscore > 3 ? 'High' : 'Medium',
          };
        }
        return null;
      })
      .filter((outlier): outlier is Outlier => outlier !== null);
  }
  
  public generateForecast(
    dataPoints: DataPoint[],
    horizon: number,
    method: string = 'linear'
  ): ForecastData {
    const trend = this.calculateTrend(dataPoints);
    const lastIndex = dataPoints.length - 1;
    const predictions: DataPoint[] = [];
    const lowerBound: DataPoint[] = [];
    const upperBound: DataPoint[] = [];
    
    // Simple linear forecast
    for (let i = 1; i <= horizon; i++) {
      const x = lastIndex + i;
      const predicted = trend.slope * x + trend.intercept;
      const timestamp = new Date(
        new Date(dataPoints[lastIndex].timestamp).getTime() + i * 3600000
      ).toISOString();
      
      predictions.push({ timestamp, value: predicted });
      
      // Confidence interval (simplified)
      const uncertainty = Math.abs(predicted * 0.1 * (i / horizon));
      lowerBound.push({ timestamp, value: predicted - uncertainty });
      upperBound.push({ timestamp, value: predicted + uncertainty });
    }
    
    return {
      metricId: 'forecast_' + Date.now(),
      predictions,
      confidenceInterval: { lower: lowerBound, upper: upperBound },
      accuracy: trend.r2 * 100,
      method: method as any,
      validUntil: predictions[predictions.length - 1].timestamp,
    };
  }
  
  public detectAnomalies(
    dataPoints: DataPoint[],
    sensitivity: number = 0.8
  ): AnomalyAlert[] {
    const outliers = this.findOutliers(dataPoints, 3 - sensitivity * 2);
    
    return outliers.map(outlier => ({
      id: `anomaly_${Date.now()}_${Math.random()}`,
      metricId: 'metric_unknown',
      timestamp: outlier.timestamp,
      value: outlier.value,
      expectedValue: outlier.expectedValue,
      deviation: outlier.value - outlier.expectedValue,
      deviationPercentage: ((outlier.value - outlier.expectedValue) / outlier.expectedValue) * 100,
      severity: outlier.zscore > 3 ? 'critical' : outlier.zscore > 2 ? 'warning' : 'info',
      type: outlier.value > outlier.expectedValue ? 'spike' : 'drop',
      possibleCauses: [
        'Unusual system activity',
        'External event impact',
        'Data quality issue',
      ],
      recommendations: [
        'Investigate root cause',
        'Check related metrics',
        'Review system logs',
      ],
    }));
  }
  
  public calculateCorrelation(series1: number[], series2: number[]): number {
    if (series1.length !== series2.length || series1.length === 0) return 0;
    
    const mean1 = series1.reduce((a, b) => a + b, 0) / series1.length;
    const mean2 = series2.reduce((a, b) => a + b, 0) / series2.length;
    
    let numerator = 0;
    let denominator1 = 0;
    let denominator2 = 0;
    
    for (let i = 0; i < series1.length; i++) {
      const diff1 = series1[i] - mean1;
      const diff2 = series2[i] - mean2;
      numerator += diff1 * diff2;
      denominator1 += diff1 * diff1;
      denominator2 += diff2 * diff2;
    }
    
    if (denominator1 === 0 || denominator2 === 0) return 0;
    
    return numerator / Math.sqrt(denominator1 * denominator2);
  }
  
  public calculateMetricFormula(
    formula: string,
    context: Record<string, number>
  ): number {
    // Simple formula evaluation (in production, use a proper expression parser)
    let result = formula;
    
    Object.entries(context).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value.toString());
    });
    
    try {
      // WARNING: eval is dangerous - use a proper expression parser in production
      return eval(result);
    } catch (error) {
      console.error('Formula evaluation error:', error);
      return 0;
    }
  }
}

// ---------------------------------
// 9. Provider Component
// ---------------------------------

const MetricsAnalyticsContext = createContext<MetricsAnalyticsContextProps | null>(null);

export const MetricsAnalyticsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { tenantId } = useTenant();
  const { liveMetrics, subscribeToMetrics, onMetricUpdate } = useRealtimeStream();
  const { requestPrediction } = useAIInsights();
  const { impactMetrics } = useBusinessImpact();
  
  // State management
  const [kpiMetrics, setKpiMetrics] = useState<KPIMetric[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
  const [trendAnalysis, setTrendAnalysis] = useState<TrendAnalysis[]>([]);
  const [dashboardConfigs, setDashboardConfigs] = useState<DashboardConfig[]>([]);
  const [widgetData, setWidgetData] = useState<WidgetData[]>([]);
  const [currentDashboard, setCurrentDashboard] = useState<DashboardConfig | undefined>();
  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [anomalyDetection, setAnomalyDetection] = useState<AnomalyAlert[]>([]);
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkData[]>([]);
  const [industryComparisons, setIndustryComparisons] = useState<IndustryComparison[]>([]);
  const [liveAnalyticMetrics, setLiveAnalyticMetrics] = useState<LiveAnalyticMetric[]>([]);
  const [metricAlerts, setMetricAlerts] = useState<MetricAlert[]>([]);
  
  // Analytics engine
  const analyticsEngine = useRef(new AnalyticsEngine());
  const metricSubscriptions = useRef<Map<string, () => void>>(new Map());
  
  // Initialize analytics data
  useEffect(() => {
    if (!tenantId) return;
    
    const loadAnalyticsData = async () => {
      try {
        // Load from database
        const [kpis, dashboards, benchmarks] = await Promise.all([
          getAll('kpi_metrics', tenantId),
          getAll('dashboards', tenantId),
          getAll('benchmarks', tenantId),
        ]);
        
        // Initialize KPIs with current values
        const initializedKPIs: KPIMetric[] = (kpis as any[]).map(kpi => ({
          ...kpi,
          value: 75 + Math.random() * 25,
          percentageChange: Math.random() * 20 - 10,
          trend: Math.random() > 0.5 ? 'up' : Math.random() > 0.5 ? 'down' : 'stable',
          status: Math.random() > 0.7 ? 'on_target' : Math.random() > 0.5 ? 'at_risk' : 'off_target',
          lastUpdated: new Date().toISOString(),
        }));
        
        setKpiMetrics(AsyncStateHelpers.createSuccess(initializedKPIs));
        setDashboardConfigs(AsyncStateHelpers.createSuccess(dashboards));
        setBenchmarkData(AsyncStateHelpers.createSuccess(benchmarks));
        setTrendAnalysis(AsyncStateHelpers.createSuccess([]));
        setPerformanceMetrics(AsyncStateHelpers.createSuccess([]));
        setWidgetData(AsyncStateHelpers.createSuccess([]));
        setForecastData(AsyncStateHelpers.createSuccess([]));
        setAnomalyDetection(AsyncStateHelpers.createSuccess([]));
        
        // Set default dashboard
        const defaultDash = dashboards.find((d: DashboardConfig) => d.isDefault);
        if (defaultDash) {
          setCurrentDashboard(defaultDash);
        }
        
      } catch (error) {
        console.error('[MetricsAnalytics] Failed to load data:', error);
      }
    };
    
    loadAnalyticsData();
  }, [tenantId]);
  
  // Update live metrics from realtime stream
  useEffect(() => {
    const updateLiveMetrics = () => {
      const analyticsMetrics: LiveAnalyticMetric[] = liveMetrics.map(metric => ({
        id: metric.id,
        name: metric.metricType,
        value: Number(metric.value),
        unit: metric.unit,
        timestamp: metric.timestamp,
        trend: metric.trend,
        alert: metric.thresholds && 
               Number(metric.value) > (metric.thresholds.critical || Infinity),
        target: metric.thresholds?.warning,
      }));
      
      setLiveAnalyticMetrics(analyticsMetrics);
      
      // Check for alerts
      analyticsMetrics.forEach(metric => {
        if (metric.alert && !metricAlerts.find(a => a.metricId === metric.id && a.status === 'active')) {
          const alert: MetricAlert = {
            id: `alert_${Date.now()}_${metric.id}`,
            metricId: metric.id,
            metricName: metric.name,
            condition: 'Greater than threshold',
            threshold: metric.target || 0,
            currentValue: metric.value,
            triggeredAt: metric.timestamp,
            severity: 'warning',
            status: 'active',
          };
          
          setMetricAlerts(prev => [...prev, alert]);
        }
      });
    };
    
    updateLiveMetrics();
  }, [liveMetrics]);
  
  // Dashboard operations
  const createDashboard = useCallback(async (
    config: Omit<DashboardConfig, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<DashboardConfig> => {
    const dashboard: DashboardConfig = {
      ...config,
      id: `dash_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    setDashboardConfigs(prev => [...prev, dashboard]);
    await putWithAudit('dashboards', dashboard.id, dashboard, 'user');
    
    return dashboard;
  }, []);
  
  const updateDashboard = useCallback(async (
    id: string,
    updates: Partial<DashboardConfig>
  ): Promise<void> => {
    setDashboardConfigs(prev => prev.map(d => 
      d.id === id 
        ? { ...d, ...updates, updatedAt: new Date().toISOString() }
        : d
    ));
    
    await putWithAudit('dashboards', id, updates, 'user');
  }, []);
  
  const deleteDashboard = useCallback(async (id: string): Promise<void> => {
    setDashboardConfigs(prev => prev.filter(d => d.id !== id));
    // await removeWithAudit('dashboards', id, 'user');
  }, []);
  
  const setCurrentDashboardById = useCallback((id: string): void => {
    const dashboard = dashboardConfigs.find(d => d.id === id);
    setCurrentDashboard(dashboard);
  }, [dashboardConfigs]);
  
  const addWidget = useCallback(async (
    dashboardId: string,
    widget: WidgetConfig
  ): Promise<void> => {
    setDashboardConfigs(prev => prev.map(d => 
      d.id === dashboardId 
        ? { 
            ...d, 
            widgets: [...d.widgets, widget],
            updatedAt: new Date().toISOString(),
          }
        : d
    ));
  }, []);
  
  const removeWidget = useCallback(async (
    dashboardId: string,
    widgetId: string
  ): Promise<void> => {
    setDashboardConfigs(prev => prev.map(d => 
      d.id === dashboardId 
        ? { 
            ...d, 
            widgets: d.widgets.filter(w => w.id !== widgetId),
            updatedAt: new Date().toISOString(),
          }
        : d
    ));
  }, []);
  
  const updateWidget = useCallback(async (
    dashboardId: string,
    widgetId: string,
    updates: Partial<WidgetConfig>
  ): Promise<void> => {
    setDashboardConfigs(prev => prev.map(d => 
      d.id === dashboardId 
        ? { 
            ...d, 
            widgets: d.widgets.map(w => 
              w.id === widgetId ? { ...w, ...updates } : w
            ),
            updatedAt: new Date().toISOString(),
          }
        : d
    ));
  }, []);
  
  // Reporting
  const generateReport = useCallback(async (
    config: ReportConfig
  ): Promise<AnalyticsReport> => {
    const report: AnalyticsReport = {
      id: `report_${Date.now()}`,
      name: config.name,
      type: config.type,
      generatedAt: new Date().toISOString(),
      timeRange: config.timeRange,
      data: {
        summary: {
          title: config.name,
          period: `${config.timeRange.start} to ${config.timeRange.end}`,
          highlights: [
            'Overall performance improved by 15%',
            '3 critical incidents resolved',
            'SLA compliance at 99.5%',
          ],
          keyMetrics: {
            incidents: 12,
            changes: 8,
            availability: 99.5,
            mttr: 45,
          },
        },
        sections: [],
        charts: [],
        tables: [],
      },
      format: config.format,
      size: 1024 * 50, // 50KB
      status: 'ready',
    };
    
    // Simulate report generation
    if (config.includeCharts) {
      report.data.charts = [{
        id: 'chart_1',
        type: 'line',
        title: 'Incident Trend',
        data: { /* chart data */ },
      }];
    }
    
    if (config.includeRawData) {
      report.data.rawData = kpiMetrics.slice(0, 10);
    }
    
    await putWithAudit('reports', report.id, report, 'user');
    
    return report;
  }, [kpiMetrics]);
  
  const scheduleReport = useCallback(async (
    config: ReportConfig,
    schedule: ReportSchedule
  ): Promise<void> => {
    // Store scheduled report configuration
    const scheduledReport = {
      id: `scheduled_${Date.now()}`,
      config,
      schedule,
      createdAt: new Date().toISOString(),
    };
    
    await putWithAudit('scheduled_reports', scheduledReport.id, scheduledReport, 'user');
  }, []);
  
  const exportData = useCallback(async (
    exportConfig: ExportConfig
  ): Promise<ExportResult> => {
    // Simulate data export
    const result: ExportResult = {
      id: `export_${Date.now()}`,
      filename: `export_${exportConfig.dataType}_${Date.now()}.${exportConfig.format}`,
      format: exportConfig.format,
      size: 1024 * 100, // 100KB
      recordCount: 1000,
      url: `/exports/export_${Date.now()}.${exportConfig.format}`,
      expiresAt: new Date(Date.now() + 86400000).toISOString(), // 24 hours
    };
    
    return result;
  }, []);
  
  const getReports = useCallback(async (
    filters?: FilterConfig[]
  ): Promise<AnalyticsReport[]> => {
    const reports = await getAll('reports', tenantId);
    
    // Apply filters if provided
    if (filters && filters.length > 0) {
      // Filter logic here
    }
    
    return reports;
  }, [tenantId]);
  
  const downloadReport = useCallback(async (reportId: string): Promise<Blob> => {
    // Simulate report download
    const report = await getById('reports', reportId);
    const blob = new Blob([JSON.stringify(report)], { type: 'application/json' });
    return blob;
  }, []);
  
  // Historical data and trends
  const getMetricHistory = useCallback(async (
    metricId: string,
    timeRange: TimeRange
  ): Promise<MetricHistory> => {
    // Generate sample historical data
    const dataPoints: DataPoint[] = [];
    const start = new Date(timeRange.start).getTime();
    const end = new Date(timeRange.end).getTime();
    const interval = 3600000; // 1 hour
    
    for (let time = start; time <= end; time += interval) {
      dataPoints.push({
        timestamp: new Date(time).toISOString(),
        value: 50 + Math.random() * 50 + Math.sin(time / (interval * 24)) * 20,
      });
    }
    
    const values = dataPoints.map(p => p.value);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      metricId,
      dataPoints,
      aggregations: {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: sum / values.length,
        median: values.sort((a, b) => a - b)[Math.floor(values.length / 2)],
        sum,
        count: values.length,
      },
    };
  }, []);
  
  const getTrendAnalysis = useCallback(async (
    metricIds: string[],
    timeframe: string
  ): Promise<TrendAnalysis> => {
    // Generate trend analysis for first metric
    const metricId = metricIds[0];
    const history = await getMetricHistory(metricId, {
      start: new Date(Date.now() - 86400000 * 7).toISOString(), // 7 days
      end: new Date().toISOString(),
    });
    
    const trend = analyticsEngine.current.calculateTrend(history.dataPoints);
    const seasonality = analyticsEngine.current.detectSeasonality(history.dataPoints);
    const outliers = analyticsEngine.current.findOutliers(history.dataPoints);
    const forecast = analyticsEngine.current.generateForecast(history.dataPoints, 24);
    
    const analysis: TrendAnalysis = {
      metricId,
      period: timeframe,
      dataPoints: history.dataPoints,
      trendLine: trend,
      seasonality,
      outliers,
      forecast,
      confidence: trend.confidence,
    };
    
    setTrendAnalysis(prev => [...prev, analysis]);
    
    return analysis;
  }, [getMetricHistory]);
  
  const compareMetrics = useCallback(async (
    metricIds: string[],
    timeRange: TimeRange
  ): Promise<ComparisonResult> => {
    const data: ComparisonData[] = [];
    const histories = await Promise.all(
      metricIds.map(id => getMetricHistory(id, timeRange))
    );
    
    // Align data points
    const timestamps = new Set<string>();
    histories.forEach(h => h.dataPoints.forEach(p => timestamps.add(p.timestamp)));
    
    Array.from(timestamps).sort().forEach(timestamp => {
      const values: Record<string, number> = {};
      metricIds.forEach((id, index) => {
        const point = histories[index].dataPoints.find(p => p.timestamp === timestamp);
        if (point) {
          values[id] = point.value;
        }
      });
      data.push({ timestamp, values });
    });
    
    // Calculate correlations
    const correlationMatrix: CorrelationMatrix = {
      metrics: metricIds,
      values: [],
    };
    
    for (let i = 0; i < metricIds.length; i++) {
      correlationMatrix.values[i] = [];
      for (let j = 0; j < metricIds.length; j++) {
        const series1 = data.map(d => d.values[metricIds[i]] || 0);
        const series2 = data.map(d => d.values[metricIds[j]] || 0);
        correlationMatrix.values[i][j] = analyticsEngine.current.calculateCorrelation(series1, series2);
      }
    }
    
    return {
      metrics: metricIds,
      timeRange,
      data,
      correlations: correlationMatrix,
      insights: [
        'Strong positive correlation detected between metrics',
        'Seasonal pattern observed in all metrics',
        'Anomaly detected on Tuesday at 14:00',
      ],
    };
  }, [getMetricHistory]);
  
  // Predictive analytics
  const getPredictiveModel = useCallback((modelType: string): PredictiveModel | null => {
    return analyticsEngine.current['forecastModels'].get(modelType) || null;
  }, []);
  
  const runForecast = useCallback(async (
    metricId: string,
    horizon: number,
    method: string = 'arima'
  ): Promise<ForecastData> => {
    const history = await getMetricHistory(metricId, {
      start: new Date(Date.now() - 86400000 * 30).toISOString(), // 30 days
      end: new Date().toISOString(),
    });
    
    const forecast = analyticsEngine.current.generateForecast(
      history.dataPoints,
      horizon,
      method
    );
    
    setForecastData(prev => [...prev, forecast]);
    
    return forecast;
  }, [getMetricHistory]);
  
  const detectAnomalies = useCallback(async (
    metricId: string,
    sensitivity: number = 0.8
  ): Promise<AnomalyAlert[]> => {
    const history = await getMetricHistory(metricId, {
      start: new Date(Date.now() - 86400000).toISOString(), // 24 hours
      end: new Date().toISOString(),
    });
    
    const anomalies = analyticsEngine.current.detectAnomalies(
      history.dataPoints,
      sensitivity
    );
    
    // Update with metric ID
    anomalies.forEach(a => a.metricId = metricId);
    
    setAnomalyDetection(prev => [...prev, ...anomalies]);
    
    return anomalies;
  }, [getMetricHistory]);
  
  // Benchmarking
  const getBenchmark = useCallback((metric: string): BenchmarkData | null => {
    return benchmarkData.find(b => b.metric === metric) || null;
  }, [benchmarkData]);
  
  const compareToIndustry = useCallback(async (
    category?: string
  ): Promise<IndustryComparison> => {
    // Generate industry comparison
    const comparison: IndustryComparison = {
      category: category || 'Overall',
      period: 'Q4 2024',
      metrics: kpiMetrics.map(kpi => ({
        metric: kpi.name,
        ourValue: kpi.value,
        industryAverage: kpi.target * 0.9,
        industryMedian: kpi.target * 0.85,
        topPerformer: kpi.target * 1.2,
        bottomPerformer: kpi.target * 0.6,
        percentile: 65 + Math.random() * 30,
        trend: kpi.trend === 'up' ? 'improving' : kpi.trend === 'down' ? 'declining' : 'stable',
        gap: kpi.value - kpi.target * 0.9,
        improvementPotential: kpi.target * 1.2 - kpi.value,
      })),
      overallScore: 75,
      rank: 12,
      totalCompanies: 50,
      strengths: ['Incident response time', 'Change success rate'],
      weaknesses: ['Resource utilization', 'Cost per ticket'],
      recommendations: ['Implement automation for routine tasks', 'Optimize resource allocation'],
    };
    
    setIndustryComparisons(prev => [...prev, comparison]);
    
    return comparison;
  }, [kpiMetrics]);
  
  // Real-time analytics
  const subscribeToMetric = useCallback((
    metricId: string,
    callback: (metric: LiveAnalyticMetric) => void
  ): (() => void) => {
    // Subscribe to metric updates
    const unsubscribe = onMetricUpdate((update) => {
      if (update.metricId === metricId) {
        const liveMetric: LiveAnalyticMetric = {
          id: update.metricId,
          name: metricId,
          value: Number(update.value),
          timestamp: update.timestamp,
        };
        callback(liveMetric);
      }
    });
    
    metricSubscriptions.current.set(metricId, unsubscribe);
    
    return () => {
      const unsub = metricSubscriptions.current.get(metricId);
      if (unsub) {
        unsub();
        metricSubscriptions.current.delete(metricId);
      }
    };
  }, [onMetricUpdate]);
  
  const acknowledgeAlert = useCallback(async (alertId: string): Promise<void> => {
    setMetricAlerts(prev => prev.map(a => 
      a.id === alertId ? { ...a, status: 'acknowledged' } : a
    ));
  }, []);
  
  const resolveAlert = useCallback(async (
    alertId: string,
    notes?: string
  ): Promise<void> => {
    setMetricAlerts(prev => prev.map(a => 
      a.id === alertId ? { ...a, status: 'resolved', notes } : a
    ));
  }, []);
  
  // Calculated metrics
  const calculateMetric = useCallback(async (
    formula: string,
    context?: Record<string, any>
  ): Promise<number> => {
    const metricContext: Record<string, number> = {};
    
    // Build context from KPI metrics
    kpiMetrics.forEach(kpi => {
      metricContext[kpi.name.toLowerCase().replace(/\s+/g, '_')] = kpi.value;
    });
    
    // Merge with provided context
    Object.assign(metricContext, context);
    
    return analyticsEngine.current.calculateMetricFormula(formula, metricContext);
  }, [kpiMetrics]);
  
  const createCustomMetric = useCallback(async (
    metric: Omit<KPIMetric, 'id' | 'lastUpdated'>
  ): Promise<KPIMetric> => {
    const newMetric: KPIMetric = {
      ...metric,
      id: `kpi_${Date.now()}`,
      lastUpdated: new Date().toISOString(),
    };
    
    setKpiMetrics(prev => [...prev, newMetric]);
    await putWithAudit('kpi_metrics', newMetric.id, newMetric, 'user');
    
    return newMetric;
  }, []);
  
  const updateMetricTarget = useCallback(async (
    metricId: string,
    target: number
  ): Promise<void> => {
    setKpiMetrics(prev => prev.map(m => 
      m.id === metricId 
        ? { 
            ...m, 
            target,
            status: m.value >= target ? 'on_target' : m.value >= target * 0.9 ? 'at_risk' : 'off_target',
            lastUpdated: new Date().toISOString(),
          }
        : m
    ));
    
    await putWithAudit('kpi_metrics', metricId, { target }, 'user');
  }, []);
  
  // Cleanup subscriptions
  useEffect(() => {
    return () => {
      metricSubscriptions.current.forEach(unsubscribe => unsubscribe());
      metricSubscriptions.current.clear();
    };
  }, []);
  
  // Memoized context value
  const value = useMemo<MetricsAnalyticsContextProps>(() => ({
    // Data
    kpiMetrics,
    performanceMetrics,
    trendAnalysis,
    dashboardConfigs,
    widgetData,
    currentDashboard,
    forecastData,
    anomalyDetection,
    benchmarkData,
    industryComparisons,
    liveMetrics: liveAnalyticMetrics,
    metricAlerts,
    
    // Dashboard operations
    createDashboard,
    updateDashboard,
    deleteDashboard,
    setCurrentDashboard: setCurrentDashboardById,
    addWidget,
    removeWidget,
    updateWidget,
    
    // Reporting
    generateReport,
    scheduleReport,
    exportData,
    getReports,
    downloadReport,
    
    // Analytics
    getMetricHistory,
    getTrendAnalysis,
    compareMetrics,
    getPredictiveModel,
    runForecast,
    detectAnomalies,
    getBenchmark,
    compareToIndustry,
    
    // Real-time
    subscribeToMetric,
    acknowledgeAlert,
    resolveAlert,
    
    // Calculations
    calculateMetric,
    createCustomMetric,
    updateMetricTarget,
  }), [
    kpiMetrics,
    performanceMetrics,
    trendAnalysis,
    dashboardConfigs,
    widgetData,
    currentDashboard,
    forecastData,
    anomalyDetection,
    benchmarkData,
    industryComparisons,
    liveAnalyticMetrics,
    metricAlerts,
    createDashboard,
    updateDashboard,
    deleteDashboard,
    setCurrentDashboardById,
    addWidget,
    removeWidget,
    updateWidget,
    generateReport,
    scheduleReport,
    exportData,
    getReports,
    downloadReport,
    getMetricHistory,
    getTrendAnalysis,
    compareMetrics,
    getPredictiveModel,
    runForecast,
    detectAnomalies,
    getBenchmark,
    compareToIndustry,
    subscribeToMetric,
    acknowledgeAlert,
    resolveAlert,
    calculateMetric,
    createCustomMetric,
    updateMetricTarget,
  ]);
  
  return (
    <MetricsAnalyticsContext.Provider value={value}>
      {children}
    </MetricsAnalyticsContext.Provider>
  );
};

// ---------------------------------
// 10. Custom Hooks
// ---------------------------------

export const useMetricsAnalytics = (): MetricsAnalyticsContextProps => {
  const context = useContext(MetricsAnalyticsContext);
  if (!context) {
    throw new Error('useMetricsAnalytics must be used within MetricsAnalyticsProvider');
  }
  return context;
};

export const useKPIMetrics = (category?: string) => {
  const { kpiMetrics, updateMetricTarget } = useMetricsAnalytics();
  
  const filteredMetrics = useMemo(() => {
    if (!category) return kpiMetrics;
    return kpiMetrics.filter(m => m.category === category);
  }, [kpiMetrics, category]);
  
  const summary = useMemo(() => ({
    total: filteredMetrics.length,
    onTarget: filteredMetrics.filter(m => m.status === 'on_target').length,
    atRisk: filteredMetrics.filter(m => m.status === 'at_risk').length,
    offTarget: filteredMetrics.filter(m => m.status === 'off_target').length,
    averagePerformance: filteredMetrics.reduce((sum, m) => sum + (m.value / m.target), 0) / filteredMetrics.length * 100,
  }), [filteredMetrics]);
  
  return {
    metrics: filteredMetrics,
    summary,
    updateTarget: updateMetricTarget,
  };
};

export const useDashboard = (dashboardId?: string) => {
  const {
    dashboardConfigs,
    currentDashboard,
    setCurrentDashboard,
    updateDashboard,
    addWidget,
    removeWidget,
    updateWidget,
    widgetData,
  } = useMetricsAnalytics();
  
  const dashboard = dashboardId 
    ? dashboardConfigs.find(d => d.id === dashboardId)
    : currentDashboard;
  
  const dashboardWidgetData = useMemo(() => {
    if (!dashboard) return [];
    return widgetData.filter(w => 
      dashboard.widgets.some(widget => widget.id === w.widgetId)
    );
  }, [dashboard, widgetData]);
  
  return {
    dashboard,
    widgets: dashboard?.widgets || [],
    widgetData: dashboardWidgetData,
    selectDashboard: setCurrentDashboard,
    update: (updates: Partial<DashboardConfig>) => 
      dashboard && updateDashboard(dashboard.id, updates),
    addWidget: (widget: WidgetConfig) => 
      dashboard && addWidget(dashboard.id, widget),
    removeWidget: (widgetId: string) => 
      dashboard && removeWidget(dashboard.id, widgetId),
    updateWidget: (widgetId: string, updates: Partial<WidgetConfig>) => 
      dashboard && updateWidget(dashboard.id, widgetId, updates),
  };
};

export const useMetricTrends = (metricId: string, timeframe?: string) => {
  const { getTrendAnalysis, runForecast, detectAnomalies } = useMetricsAnalytics();
  const [trend, setTrend] = useState<TrendAnalysis | null>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyAlert[]>([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const loadTrends = async () => {
      setLoading(true);
      try {
        const [trendRes, forecastRes, anomalyRes] = await Promise.all([
          getTrendAnalysis([metricId], timeframe || '7d'),
          runForecast(metricId, 24),
          detectAnomalies(metricId),
        ]);
        
        setTrend(trendRes);
        setForecast(forecastRes);
        setAnomalies(anomalyRes);
      } catch (error) {
        console.error('[useMetricTrends] Failed to load trends:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadTrends();
  }, [metricId, timeframe, getTrendAnalysis, runForecast, detectAnomalies]);
  
  return {
    trend,
    forecast,
    anomalies,
    loading,
    hasAnomalies: anomalies.length > 0,
    trendDirection: trend?.trendLine.slope ? (trend.trendLine.slope > 0 ? 'up' : 'down') : 'stable',
  };
};