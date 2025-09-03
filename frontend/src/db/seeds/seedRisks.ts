import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedRisks = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let risks: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    risks = [
      {
        id: `${tenantId}_risk01`,
        tenantId,
        title: "Router Single Point of Failure",
        description: "Core router lacks redundancy, creating risk of major outage.",
        severity: "high",
        priority: "critical",
        status: "open",
        category: "infrastructure",
        subcategory: "redundancy",
        health_status: "red",
        owner_team_id: `${tenantId}_team_network`,
        related_asset_id: `${tenantId}_asset_router01`,
        related_service_id: `${tenantId}_svc_network`,
        business_impact: "Major network outage affecting all services",
        likelihood: "medium",
        impact_score: 9,
        likelihood_score: 6,
        risk_score: 54,
        mitigation_strategy: "Implement redundant router configuration",
        target_resolution_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: now,
        last_assessed_at: now,
        next_review_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        tags: ["router", "redundancy", "critical", "infrastructure"],
        custom_fields: {
          router_model: "cisco-isr-4431",
          current_backup: "none",
          estimated_downtime_hours: 4,
          affected_users: 500
        }
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    risks = [
      {
        id: `${tenantId}_risk01`,
        tenantId,
        title: "Latency SLA Breach Risk",
        description: "Sustained latency at EU edge node could breach customer SLAs.",
        severity: "critical",
        priority: "high",
        status: "open",
        category: "performance",
        subcategory: "latency",
        health_status: "red",
        owner_team_id: `${tenantId}_team_sre`,
        related_service_id: `${tenantId}_svc_streaming`,
        related_asset_id: `${tenantId}_asset_gce_vm01`,
        business_impact: "SLA breach penalties and customer churn",
        likelihood: "high",
        impact_score: 8,
        likelihood_score: 8,
        risk_score: 64,
        mitigation_strategy: "Scale edge infrastructure and implement CDN",
        target_resolution_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: now,
        last_assessed_at: now,
        next_review_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        tags: ["latency", "sla", "streaming", "performance"],
        custom_fields: {
          sla_threshold_ms: 250,
          current_latency_ms: 285,
          affected_regions: ["eu-west-1"],
          customer_tier: "premium"
        }
      },
      {
        id: `${tenantId}_risk02`,
        tenantId,
        title: "Transcoding Cost Escalation",
        description: "OOMKilled pods cause reprocessing and rising cloud costs.",
        severity: "medium",
        priority: "medium",
        status: "open",
        category: "financial",
        subcategory: "cost_overrun",
        health_status: "orange",
        owner_team_id: `${tenantId}_team_mediaops`,
        related_service_id: `${tenantId}_svc_transcoding`,
        related_asset_id: `${tenantId}_asset_gke_node01`,
        business_impact: "Budget overrun and reduced profit margins",
        likelihood: "medium",
        impact_score: 6,
        likelihood_score: 7,
        risk_score: 42,
        mitigation_strategy: "Increase memory limits and implement auto-scaling",
        target_resolution_date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: now,
        last_assessed_at: now,
        next_review_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        tags: ["gke", "cost", "memory", "scaling"],
        custom_fields: {
          cluster_name: "media-prod-01",
          monthly_budget_usd: 50000,
          current_overage_percent: 15,
          oom_kill_rate: 5
        }
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    risks = [
      {
        id: `${tenantId}_risk01`,
        tenantId,
        title: "Financial Reporting Delay",
        description: "Replication lag in DB could delay regulatory filings.",
        severity: "critical",
        priority: "critical",
        status: "open",
        category: "compliance",
        subcategory: "regulatory",
        health_status: "red",
        owner_team_id: `${tenantId}_team_dba`,
        related_service_id: `${tenantId}_svc_fin_reporting`,
        related_asset_id: `${tenantId}_asset_db01`,
        business_impact: "Regulatory penalties and compliance violations",
        likelihood: "high",
        impact_score: 9,
        likelihood_score: 7,
        risk_score: 63,
        mitigation_strategy: "Implement real-time replication monitoring and alerts",
        target_resolution_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: now,
        last_assessed_at: now,
        next_review_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
        tags: ["compliance", "reporting", "regulatory", "database"],
        custom_fields: {
          regulatory_deadline: "SEC 10-K filing",
          max_acceptable_lag_minutes: 30,
          current_lag_minutes: 42,
          penalty_risk_usd: 500000
        }
      },
      {
        id: `${tenantId}_risk02`,
        tenantId,
        title: "Data Lake Governance Risk",
        description: "ETL job failures may lead to incomplete datasets used in analytics.",
        severity: "high",
        priority: "high",
        status: "open",
        category: "data_quality",
        subcategory: "completeness",
        health_status: "orange",
        owner_team_id: `${tenantId}_team_dataops`,
        related_service_id: `${tenantId}_svc_data_analytics`,
        related_asset_id: `${tenantId}_asset_etl01`,
        business_impact: "Inaccurate analytics leading to poor business decisions",
        likelihood: "medium",
        impact_score: 7,
        likelihood_score: 6,
        risk_score: 42,
        mitigation_strategy: "Implement data quality checks and retry mechanisms",
        target_resolution_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: now,
        last_assessed_at: now,
        next_review_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        tags: ["etl", "data", "governance", "quality"],
        custom_fields: {
          etl_success_rate_target: 95,
          current_success_rate: 77,
          daily_job_count: 47,
          data_sources: 12
        }
      },
    ];
  }

  // Insert risks with proper error handling
  for (const risk of risks) {
    try {
      await db.put("risks", risk);

      // Create COMPLETE audit log entry
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "risk",
        entity_id: risk.id,
        action: "create",
        description: `Risk registered: ${risk.title} (${risk.severity}) - ${risk.business_impact}`,
        timestamp: now,
        user_id: "system", // Required field
        tags: ["seed", "risk", "create", risk.category],
        hash: await generateHash({
          entity_type: "risk",
          entity_id: risk.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          severity: risk.severity,
          priority: risk.priority,
          category: risk.category,
          subcategory: risk.subcategory,
          risk_score: risk.risk_score,
          impact_score: risk.impact_score,
          likelihood_score: risk.likelihood_score,
          owner_team_id: risk.owner_team_id,
          business_impact: risk.business_impact,
          mitigation_strategy: risk.mitigation_strategy,
          target_resolution_date: risk.target_resolution_date
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `Risk "${risk.title}" registered with ${risk.severity} severity and risk score ${risk.risk_score}`,
        storeName: "risks", // Required field for dbClient compatibility
        recordId: risk.id, // Required field for dbClient compatibility
        action: "create",
        userId: "system",
        metadata: {
          risk_id: risk.id,
          severity: risk.severity,
          priority: risk.priority,
          category: risk.category,
          risk_score: risk.risk_score,
          business_impact: risk.business_impact,
          mitigation_strategy: risk.mitigation_strategy,
          related_entities: [
            { type: "team", id: risk.owner_team_id },
            { type: "service", id: risk.related_service_id },
            { type: "asset", id: risk.related_asset_id }
          ].filter(entity => entity.id) // Remove null/undefined entries
        }
      });

      console.log(`✅ Seeded risk: ${risk.id} - ${risk.title}`);
    } catch (error) {
      console.error(`❌ Failed to seed risk ${risk.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${risks.length} risks for ${tenantId}`);
};

// Helper function to generate audit hash (simplified for seeding)
async function generateHash(data: any): Promise<string> {
  try {
    const { generateImmutableHash } = await import("../../utils/auditUtils");
    return await generateImmutableHash(data);
  } catch {
    // Fallback for seeding if utils not available
    return `seed_hash_${data.entity_id}_${Date.now()}`;
  }
}