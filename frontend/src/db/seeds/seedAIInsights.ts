// src/db/seeds/seedAIInsights.ts
import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedAIInsights = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  const aiInsights: any[] = [];
  const aiRecommendations: any[] = [];
  const aiPredictions: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    // AI Insights
    aiInsights.push(
      {
        id: `${tenantId}_ai_insight001`,
        tenantId,
        entityType: "incident",
        entityId: `${tenantId}_inc01`,
        insightType: "root_cause",
        title: "BGP Flapping Pattern Detected",
        description: "Analysis indicates BGP session flapping due to MTU mismatch. Similar pattern observed 3 times in past month.",
        confidence: 0.85,
        evidence: [
          "Packet fragmentation detected on interface",
          "BGP keepalive timeouts correlate with large packet transmissions",
          "MTU size inconsistency between peers (1500 vs 9000)"
        ],
        relatedInsights: [`${tenantId}_ai_insight002`],
        modelVersion: "rca_v2.3.1",
        generatedAt: now,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        feedback: null
      },
      {
        id: `${tenantId}_ai_insight002`,
        tenantId,
        entityType: "asset",
        entityId: `${tenantId}_asset_exchange01`,
        insightType: "anomaly",
        title: "Unusual Disk I/O Pattern",
        description: "Disk I/O shows abnormal spike pattern every 6 hours, likely due to unoptimized maintenance job.",
        confidence: 0.72,
        evidence: [
          "I/O spikes coincide with 00:00, 06:00, 12:00, 18:00 UTC",
          "Pattern started after recent Exchange update",
          "Database maintenance job configuration changed"
        ],
        relatedInsights: [],
        modelVersion: "anomaly_detection_v1.8",
        generatedAt: now,
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        feedback: { helpful: true, userId: `${tenantId}_user_exchange_admin` }
      }
    );

    // AI Recommendations
    aiRecommendations.push(
      {
        id: `${tenantId}_ai_rec001`,
        tenantId,
        entityType: "incident",
        entityId: `${tenantId}_inc01`,
        recommendationType: "resolution",
        title: "Adjust MTU Settings",
        description: "Set MTU to 1500 on both BGP peers to prevent fragmentation",
        priority: "high",
        confidence: 0.88,
        expectedOutcome: {
          resolution_time: "15 minutes",
          success_probability: 0.85,
          risk_level: "low"
        },
        steps: [
          "Verify current MTU settings on both peers",
          "Schedule maintenance window (5 minutes expected)",
          "Apply MTU 1500 to interface GigabitEthernet0/0/0",
          "Clear BGP session and monitor stability",
          "Verify no packet fragmentation after change"
        ],
        automationAvailable: true,
        automationScriptId: `${tenantId}_script_bgp_mtu`,
        alternativeActions: [
          "Enable Path MTU Discovery",
          "Implement TCP MSS clamping"
        ],
        createdAt: now,
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: `${tenantId}_ai_rec002`,
        tenantId,
        entityType: "asset",
        entityId: `${tenantId}_asset_exchange01`,
        recommendationType: "optimization",
        title: "Reschedule Database Maintenance",
        description: "Stagger maintenance jobs to reduce I/O contention",
        priority: "medium",
        confidence: 0.75,
        expectedOutcome: {
          performance_improvement: "40% reduction in peak I/O",
          user_impact: "minimal",
          implementation_time: "30 minutes"
        },
        steps: [
          "Identify current maintenance job schedule",
          "Distribute jobs across different time windows",
          "Adjust job priorities based on business hours",
          "Monitor I/O patterns for 24 hours post-change"
        ],
        automationAvailable: false,
        alternativeActions: [
          "Increase disk IOPS allocation",
          "Implement database partitioning"
        ],
        createdAt: now,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    );

    // AI Predictions
    aiPredictions.push(
      {
        id: `${tenantId}_ai_pred001`,
        tenantId,
        entityType: "business_service",
        entityId: `${tenantId}_svc_internet`,
        predictionType: "failure",
        title: "BGP Session Instability Likely",
        description: "70% probability of BGP session failure in next 4 hours if MTU mismatch not resolved",
        timeframe: {
          start: now,
          end: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
        },
        probability: 0.70,
        confidence: 0.82,
        factors: [
          { name: "MTU Mismatch", weight: 0.4, value: "detected" },
          { name: "Recent Flapping", weight: 0.3, value: "3 times in 24h" },
          { name: "Traffic Load", weight: 0.2, value: "increasing" },
          { name: "Peer Health", weight: 0.1, value: "degraded" }
        ],
        impactAssessment: {
          users_affected: 5000,
          revenue_impact: "$50,000/hour",
          sla_breach_risk: "high"
        },
        preventiveActions: [`${tenantId}_ai_rec001`],
        modelAccuracy: 0.87,
        lastModelUpdate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now
      },
      {
        id: `${tenantId}_ai_pred002`,
        tenantId,
        entityType: "asset",
        entityId: `${tenantId}_asset_exchange01`,
        predictionType: "capacity",
        title: "Disk Space Exhaustion",
        description: "Disk space will be exhausted in 5 days at current growth rate",
        timeframe: {
          start: now,
          end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
        },
        probability: 0.92,
        confidence: 0.89,
        factors: [
          { name: "Current Usage", weight: 0.3, value: "95%" },
          { name: "Growth Rate", weight: 0.4, value: "1% per day" },
          { name: "Archive Job Status", weight: 0.2, value: "disabled" },
          { name: "User Activity", weight: 0.1, value: "normal" }
        ],
        impactAssessment: {
          service_availability: "complete outage",
          users_affected: 5000,
          recovery_time: "4-6 hours"
        },
        preventiveActions: [
          "Enable email archiving",
          "Increase disk allocation",
          "Implement retention policy"
        ],
        modelAccuracy: 0.91,
        lastModelUpdate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now
      }
    );
  } else if (tenantId === "tenant_aws_financial") {
    aiInsights.push(
      {
        id: `${tenantId}_ai_insight001`,
        tenantId,
        entityType: "business_service",
        entityId: `${tenantId}_svc_trading`,
        insightType: "performance",
        title: "Trading Latency Optimization Opportunity",
        description: "Cross-region data replication causing 15ms additional latency during peak trading hours",
        confidence: 0.91,
        evidence: [
          "Network trace shows 15ms RTT to us-west-2",
          "60% of trades originate from us-east-1",
          "Data replication happens synchronously"
        ],
        relatedInsights: [],
        modelVersion: "latency_analyzer_v3.1",
        generatedAt: now,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        feedback: null
      }
    );

    aiRecommendations.push(
      {
        id: `${tenantId}_ai_rec001`,
        tenantId,
        entityType: "business_service",
        entityId: `${tenantId}_svc_trading`,
        recommendationType: "optimization",
        title: "Implement Async Replication",
        description: "Switch to asynchronous replication for non-critical data to reduce latency",
        priority: "high",
        confidence: 0.87,
        expectedOutcome: {
          latency_reduction: "12-15ms",
          risk_level: "low",
          cost_impact: "neutral"
        },
        steps: [
          "Identify non-critical data sets",
          "Configure async replication for audit logs",
          "Maintain sync replication for order data",
          "Test failover scenarios",
          "Monitor replication lag"
        ],
        automationAvailable: true,
        automationScriptId: `${tenantId}_script_async_repl`,
        alternativeActions: [
          "Deploy edge caching layer",
          "Implement regional data partitioning"
        ],
        createdAt: now,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    );

    aiPredictions.push(
      {
        id: `${tenantId}_ai_pred001`,
        tenantId,
        entityType: "business_service",
        entityId: `${tenantId}_svc_trading`,
        predictionType: "demand",
        title: "Trading Volume Surge Expected",
        description: "85% probability of 3x trading volume spike during Fed announcement tomorrow 2PM EST",
        timeframe: {
          start: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
          end: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString()
        },
        probability: 0.85,
        confidence: 0.88,
        factors: [
          { name: "Historical Pattern", weight: 0.4, value: "strong correlation" },
          { name: "Market Volatility", weight: 0.3, value: "elevated" },
          { name: "Options Volume", weight: 0.2, value: "increasing" },
          { name: "News Sentiment", weight: 0.1, value: "mixed" }
        ],
        impactAssessment: {
          infrastructure_load: "3x normal",
          auto_scaling_needed: true,
          cost_increase: "$15,000"
        },
        preventiveActions: [
          "Pre-scale infrastructure",
          "Warm up caches",
          "Alert operations team"
        ],
        modelAccuracy: 0.82,
        lastModelUpdate: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        createdAt: now
      }
    );
  } else if (tenantId === "tenant_ecommerce") {
    aiInsights.push(
      {
        id: `${tenantId}_ai_insight001`,
        tenantId,
        entityType: "business_service",
        entityId: `${tenantId}_svc_checkout`,
        insightType: "pattern",
        title: "Cart Abandonment Correlation with Latency",
        description: "Cart abandonment increases by 20% when checkout latency exceeds 3 seconds",
        confidence: 0.79,
        evidence: [
          "Statistical correlation r=0.72",
          "Pattern consistent across last 30 days",
          "Most abandonment during payment processing step"
        ],
        relatedInsights: [],
        modelVersion: "behavior_analytics_v2.0",
        generatedAt: now,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        feedback: null
      }
    );

    aiRecommendations.push(
      {
        id: `${tenantId}_ai_rec001`,
        tenantId,
        entityType: "business_service",
        entityId: `${tenantId}_svc_checkout`,
        recommendationType: "performance",
        title: "Implement Payment Token Caching",
        description: "Cache payment tokens to reduce API calls during checkout",
        priority: "high",
        confidence: 0.83,
        expectedOutcome: {
          latency_reduction: "1.5 seconds",
          conversion_improvement: "8-12%",
          implementation_complexity: "medium"
        },
        steps: [
          "Implement Redis cache for payment tokens",
          "Set TTL based on provider requirements",
          "Add cache warming for frequent customers",
          "Monitor cache hit ratio",
          "Implement cache invalidation logic"
        ],
        automationAvailable: false,
        alternativeActions: [
          "Optimize database queries",
          "Implement checkout session preloading"
        ],
        createdAt: now,
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      }
    );

    aiPredictions.push(
      {
        id: `${tenantId}_ai_pred001`,
        tenantId,
        entityType: "business_service",
        entityId: `${tenantId}_svc_website`,
        predictionType: "traffic",
        title: "Black Friday Traffic Surge",
        description: "Expecting 10x normal traffic on Black Friday, peak at 10AM-2PM EST",
        timeframe: {
          start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString()
        },
        probability: 0.95,
        confidence: 0.92,
        factors: [
          { name: "Historical Data", weight: 0.5, value: "8-12x past 3 years" },
          { name: "Marketing Spend", weight: 0.2, value: "increased 50%" },
          { name: "Competitor Analysis", weight: 0.2, value: "similar patterns" },
          { name: "Economic Indicators", weight: 0.1, value: "favorable" }
        ],
        impactAssessment: {
          infrastructure_needs: "10x capacity",
          cdn_bandwidth: "50TB",
          support_tickets: "5x normal"
        },
        preventiveActions: [
          "Scale infrastructure to 12x capacity",
          "Enable CDN burst capacity",
          "Schedule additional support staff",
          "Prepare incident response team"
        ],
        modelAccuracy: 0.89,
        lastModelUpdate: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        createdAt: now
      }
    );
  }

  // AI Scores for entities
  const aiScores = [
    {
      id: `${tenantId}_score001`,
      tenantId,
      entityType: "incident",
      entityId: `${tenantId}_inc01`,
      scoreType: "priority",
      value: 92,
      maxValue: 100,
      factors: {
        business_impact: 30,
        user_impact: 25,
        technical_severity: 20,
        sla_risk: 17
      },
      explanation: "High priority due to critical business service impact and SLA breach risk",
      confidence: 0.87,
      calculatedAt: now
    },
    {
      id: `${tenantId}_score002`,
      tenantId,
      entityType: "asset",
      entityId: `${tenantId}_asset_router01`,
      scoreType: "health",
      value: 45,
      maxValue: 100,
      factors: {
        availability: 15,
        performance: 10,
        reliability: 8,
        configuration_drift: 12
      },
      explanation: "Health degraded due to BGP peering issues and configuration drift detected",
      confidence: 0.91,
      calculatedAt: now
    }
  ];

  // Store AI data
  for (const insight of aiInsights) {
    await db.put("aiInsights", insight);
  }
  for (const rec of aiRecommendations) {
    await db.put("aiRecommendations", rec);
  }
  for (const pred of aiPredictions) {
    await db.put("aiPredictions", pred);
  }
  for (const score of aiScores) {
    await db.put("aiScores", score);
  }

  console.log(`Seeded AI data for ${tenantId}: ${aiInsights.length} insights, ${aiRecommendations.length} recommendations, ${aiPredictions.length} predictions, ${aiScores.length} scores`);
  return { aiInsights, aiRecommendations, aiPredictions, aiScores };
};