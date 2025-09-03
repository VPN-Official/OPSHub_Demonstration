import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

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
        status: "open",
        owner_team_id: `${tenantId}_team_network`,
        related_asset_id: `${tenantId}_asset_router01`,
        created_at: now,
        tags: ["router", "redundancy"],
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
        status: "open",
        owner_team_id: `${tenantId}_team_sre`,
        related_service_id: `${tenantId}_svc_streaming`,
        created_at: now,
        tags: ["latency", "sla", "streaming"],
      },
      {
        id: `${tenantId}_risk02`,
        tenantId,
        title: "Transcoding Cost Escalation",
        description: "OOMKilled pods cause reprocessing and rising cloud costs.",
        severity: "medium",
        status: "open",
        owner_team_id: `${tenantId}_team_mediaops`,
        related_service_id: `${tenantId}_svc_transcoding`,
        created_at: now,
        tags: ["gke", "cost"],
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
        status: "open",
        owner_team_id: `${tenantId}_team_dba`,
        related_service_id: `${tenantId}_svc_fin_reporting`,
        created_at: now,
        tags: ["compliance", "reporting"],
      },
      {
        id: `${tenantId}_risk02`,
        tenantId,
        title: "Data Lake Governance Risk",
        description: "ETL job failures may lead to incomplete datasets used in analytics.",
        severity: "high",
        status: "open",
        owner_team_id: `${tenantId}_team_dataops`,
        related_service_id: `${tenantId}_svc_data_analytics`,
        created_at: now,
        tags: ["etl", "data", "governance"],
      },
    ];
  }

  for (const risk of risks) {
    await db.put("risks", risk);

    await db.put("audit_logs", {
      id: `${risk.id}_audit01`,
      tenantId,
      entity_type: "risk",
      entity_id: risk.id,
      action: "create",
      timestamp: now,
      hash: "hash_" + risk.id,
      tags: ["seed"],
    });

    await db.put("activity_timeline", {
      id: `${risk.id}_act01`,
      tenantId,
      type: "risk",
      entity_id: risk.id,
      action: "logged",
      description: `Risk "${risk.title}" identified with severity ${risk.severity}`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};