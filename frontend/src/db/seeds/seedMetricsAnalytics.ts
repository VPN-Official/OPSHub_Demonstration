// src/db/seeds/seedMetricsAnalytics.ts
import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedMetricsAnalytics = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  const kpiMetrics: any[] = [];
  const dashboards: any[] = [];
  const analyticsReports: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    // KPI Metrics
    kpiMetrics.push(
      {
        id: `${tenantId}_kpi001`,
        tenantId,
        name: "Service Availability",
        category: "availability",
        value: 99.7,
        target: 99.9,
        unit: "percent",
        trend: "down",
        trendValue: -0.2,
        status: "at_risk",
        period: "monthly",
        dimensions: {
          service: "all",
          region: "global",
          tier: "critical"
        },
        breakdown: {
          internet: 99.5,
          email: 99.8,
          vpn: 99.9,
          cloud: 99.6
        },
        lastUpdated: now,
        nextUpdate: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      },
      {
        id: `${tenantId}_kpi002`,
        tenantId,
        name: "Mean Time To Resolve",
        category: "performance",
        value: 45,
        target: 30,
        unit: "minutes",
        trend: "up",
        trendValue: 15,
        status: "off_target",
        period: "weekly",
        dimensions: {
          severity: "P1",
          team: "all"
        },
        breakdown: {
          network: 50,
          infrastructure: 40,
          application: 45
        },
        lastUpdated: now,
        nextUpdate: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      },
      {
        id: `${tenantId}_kpi003`,
        tenantId,
        name: "Incident Volume",
        category: "operational",
        value: 127,
        target: 100,
        unit: "count",
        trend: "up",
        trendValue: 27,
        status: "warning",
        period: "weekly",
        dimensions: {
          type: "all",
          source: "all"
        },
        breakdown: {
          P1: 3,
          P2: 24,
          P3: 45,
          P4: 55
        },
        lastUpdated: now,
        nextUpdate: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      }
    );

    // Dashboards
    dashboards.push(
      {
        id: `${tenantId}_dash001`,
        tenantId,
        name: "Executive Operations Dashboard",
        description: "High-level operational metrics for leadership",
        type: "executive",
        layout: {
          type: "grid",
          columns: 12,
          gap: 16
        },
        widgets: [
          {
            id: "w1",
            type: "metric",
            title: "Service Health",
            dataSource: "kpi_service_availability",
            position: { x: 0, y: 0, w: 3, h: 2 },
            config: {
              displayType: "gauge",
              thresholds: [90, 95, 99],
              colors: ["red", "yellow", "green"]
            }
          },
          {
            id: "w2",
            type: "chart",
            title: "Incident Trend",
            dataSource: "incident_volume_timeseries",
            position: { x: 3, y: 0, w: 6, h: 3 },
            config: {
              chartType: "line",
              timeRange: "7d",
              groupBy: "severity"
            }
          },
          {
            id: "w3",
            type: "table",
            title: "Top Issues",
            dataSource: "current_incidents",
            position: { x: 9, y: 0, w: 3, h: 4 },
            config: {
              columns: ["title", "severity", "duration", "owner"],
              sortBy: "severity",
              limit: 10
            }
          }
        ],
        filters: [
          {
            field: "timeRange",
            operator: "last",
            value: "24h",
            label: "Last 24 Hours"
          }
        ],
        refreshInterval: 300, // 5 minutes
        isDefault: true,
        owner: `${tenantId}_user_manager01`,
        sharedWith: ["executives", "managers"],
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: now
      },
      {
        id: `${tenantId}_dash002`,
        tenantId,
        name: "Network Operations Center",
        description: "Real-time network monitoring dashboard",
        type: "operational",
        layout: {
          type: "grid",
          columns: 16,
          gap: 8
        },
        widgets: [
          {
            id: "w1",
            type: "map",
            title: "Network Topology",
            dataSource: "network_topology",
            position: { x: 0, y: 0, w: 8, h: 6 },
            config: {
              showStatus: true,
              showTraffic: true,
              autoRefresh: true
            }
          },
          {
            id: "w2",
            type: "chart",
            title: "Bandwidth Utilization",
            dataSource: "bandwidth_metrics",
            position: { x: 8, y: 0, w: 8, h: 3 },
            config: {
              chartType: "area",
              stacked: true,
              realtime: true
            }
          }
        ],
        refreshInterval: 60, // 1 minute
        isDefault: false,
        owner: `${tenantId}_user_netops01`,
        sharedWith: [`${tenantId}_team_network`],
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: now
      }
    );

    // Analytics Reports
    analyticsReports.push(
      {
        id: `${tenantId}_report001`,
        tenantId,
        name: "Monthly Operations Report",
        type: "operational",
        format: "pdf",
        status: "completed",
        schedule: {
          frequency: "monthly",
          dayOfMonth: 1,
          time: "08:00",
          timezone: "UTC"
        },
        config: {
          sections: [
            "executive_summary",
            "kpi_metrics",
            "incident_analysis",
            "change_summary",
            "capacity_trends",
            "recommendations"
          ],
          recipients: [
            `${tenantId}_user_manager01`,
            `${tenantId}_user_cto01`
          ],
          includeCharts: true,
          includeRawData: false
        },
        data: {
          period: {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            end: now
          },
          metrics: {
            availability: 99.7,
            incidents_total: 487,
            changes_successful: 42,
            changes_failed: 3,
            mttr_average: 45
          },
          highlights: [
            "Service availability below target",
            "25% increase in P1 incidents",
            "Successful DR test completed"
          ],
          recommendations: [
            "Increase BGP redundancy",
            "Implement automated remediation",
            "Upgrade monitoring infrastructure"
          ]
        },
        generatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        size: 2457600,
        url: "/reports/monthly_ops_report_202412.pdf"
      }
    );

    // Forecasts and Predictions
    const forecasts = [
      {
        id: `${tenantId}_forecast001`,
        tenantId,
        metricId: `${tenantId}_kpi001`,
        metricName: "Service Availability",
        forecastType: "timeseries",
        horizon: 30, // days
        predictions: Array(30).fill(0).map((_, i) => ({
          timestamp: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString(),
          value: 99.7 + Math.sin(i / 5) * 0.2,
          lower: 99.5 + Math.sin(i / 5) * 0.2,
          upper: 99.9 + Math.sin(i / 5) * 0.2
        })),
        confidence: 0.85,
        method: "ARIMA",
        seasonality: {
          type: "weekly",
          strength: 0.7
        },
        modelAccuracy: 0.88,
        lastTrainedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now
      }
    ];

    // Anomaly Detection
    const anomalies = [
      {
        id: `${tenantId}_anomaly001`,
        tenantId,
        metricId: `${tenantId}_metric_cpu01`,
        metricName: "CPU Utilization - Router01",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        value: 95,
        expectedValue: 45,
        deviation: 50,
        zscore: 3.2,
        severity: "warning",
        type: "spike",
        context: {
          baseline: 45,
          stddev: 15,
          recent_average: 48
        },
        possibleCauses: [
          "BGP route recalculation",
          "DDoS attack",
          "Configuration change"
        ],
        autoResolved: false,
        acknowledgedBy: null
      }
    ];

    // Store analytics data
    for (const kpi of kpiMetrics) {
      await db.put("kpiMetrics", kpi);
    }
    for (const dashboard of dashboards) {
      await db.put("dashboards", dashboard);
    }
    for (const report of analyticsReports) {
      await db.put("analyticsReports", report);
    }
    for (const forecast of forecasts) {
      await db.put("forecasts", forecast);
    }
    for (const anomaly of anomalies) {
      await db.put("anomalies", anomaly);
    }
    
  } else if (tenantId === "tenant_aws_financial") {
    kpiMetrics.push(
      {
        id: `${tenantId}_kpi001`,
        tenantId,
        name: "Trading Platform Latency",
        category: "performance",
        value: 12,
        target: 10,
        unit: "milliseconds",
        trend: "stable",
        trendValue: 0,
        status: "warning",
        period: "realtime",
        dimensions: {
          region: "us-east-1",
          orderType: "all"
        },
        percentiles: {
          p50: 8,
          p90: 12,
          p95: 15,
          p99: 25
        },
        lastUpdated: now,
        nextUpdate: new Date(Date.now() + 60 * 1000).toISOString()
      },
      {
        id: `${tenantId}_kpi002`,
        tenantId,
        name: "Order Success Rate",
        category: "business",
        value: 99.95,
        target: 99.99,
        unit: "percent",
        trend: "up",
        trendValue: 0.02,
        status: "warning",
        period: "hourly",
        dimensions: {
          orderType: "market",
          exchange: "all"
        },
        breakdown: {
          market_orders: 99.97,
          limit_orders: 99.95,
          stop_orders: 99.93
        },
        lastUpdated: now,
        nextUpdate: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      }
    );

    dashboards.push(
      {
        id: `${tenantId}_dash001`,
        tenantId,
        name: "Trading Platform Dashboard",
        description: "Real-time trading platform metrics",
        type: "operational",
        layout: {
          type: "grid",
          columns: 12,
          gap: 8
        },
        widgets: [
          {
            id: "w1",
            type: "metric",
            title: "Order Volume",
            dataSource: "order_volume_realtime",
            position: { x: 0, y: 0, w: 3, h: 2 },
            config: {
              displayType: "number",
              format: "abbreviated",
              sparkline: true
            }
          },
          {
            id: "w2",
            type: "chart",
            title: "Latency Distribution",
            dataSource: "latency_histogram",
            position: { x: 3, y: 0, w: 6, h: 3 },
            config: {
              chartType: "histogram",
              buckets: 20,
              showPercentiles: true
            }
          }
        ],
        refreshInterval: 10, // 10 seconds
        isDefault: true,
        owner: `${tenantId}_user_trader01`,
        sharedWith: [`${tenantId}_team_trading`],
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: now
      }
    );
  } else if (tenantId === "tenant_ecommerce") {
    kpiMetrics.push(
      {
        id: `${tenantId}_kpi001`,
        tenantId,
        name: "Conversion Rate",
        category: "business",
        value: 3.2,
        target: 3.5,
        unit: "percent",
        trend: "up",
        trendValue: 0.1,
        status: "improving",
        period: "daily",
        dimensions: {
          channel: "all",
          device: "all"
        },
        breakdown: {
          desktop: 4.1,
          mobile: 2.8,
          tablet: 3.5
        },
        lastUpdated: now,
        nextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: `${tenantId}_kpi002`,
        tenantId,
        name: "Page Load Time",
        category: "performance",
        value: 2.1,
        target: 2.0,
        unit: "seconds",
        trend: "stable",
        trendValue: 0,
        status: "warning",
        period: "hourly",
        dimensions: {
          page: "all",
          region: "global"
        },
        percentiles: {
          p50: 1.8,
          p90: 2.5,
          p95: 3.2,
          p99: 4.5
        },
        lastUpdated: now,
        nextUpdate: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      }
    );

    // Black Friday Planning Report
    analyticsReports.push(
      {
        id: `${tenantId}_report001`,
        tenantId,
        name: "Black Friday Readiness Report",
        type: "planning",
        format: "html",
        status: "completed",
        config: {
          sections: [
            "capacity_analysis",
            "traffic_forecast",
            "infrastructure_readiness",
            "team_readiness",
            "risk_assessment"
          ],
          includeCharts: true,
          includeSimulations: true
        },
        data: {
          forecast: {
            peak_traffic: "10x normal",
            peak_time: "10:00 - 14:00 EST",
            expected_revenue: 2500000,
            expected_orders: 50000
          },
          readiness: {
            infrastructure: 95,
            team: 100,
            inventory: 98,
            payment_systems: 100
          },
          risks: [
            {
              risk: "CDN capacity",
              probability: "low",
              impact: "high",
              mitigation: "Reserved burst capacity"
            }
          ]
        },
        generatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        size: 1024000,
        url: "/reports/black_friday_readiness.html"
      }
    );
  }

  console.log(`Seeded metrics analytics data for ${tenantId}`);
  return { kpiMetrics, dashboards, analyticsReports };
};