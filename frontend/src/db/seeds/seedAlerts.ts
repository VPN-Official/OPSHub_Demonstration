import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedAlerts = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let alerts: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    alerts = [
      {
        id: `${tenantId}_alert01`,
        tenantId,
        source: "Syslog",
        title: "Router CPU utilization exceeded 90%",
        description: "Core router R1 CPU usage above threshold for 5 minutes.",
        severity: "critical",
        status: "active",
        triggered_at: now,
        asset_id: `${tenantId}_asset_router01`,
        service_component_id: `${tenantId}_comp_router01`,
        business_service_id: `${tenantId}_svc_network`,
        tags: ["router", "cpu"],
      },
      {
        id: `${tenantId}_alert02`,
        tenantId,
        source: "SNMP",
        title: "Switch port errors increasing",
        description: "CRC errors detected on TOR switch S1.",
        severity: "warning",
        status: "active",
        triggered_at: now,
        asset_id: `${tenantId}_asset_switch01`,
        service_component_id: `${tenantId}_comp_switch01`,
        business_service_id: `${tenantId}_svc_network`,
        tags: ["switch", "crc"],
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    alerts = [
      {
        id: `${tenantId}_alert01`,
        tenantId,
        source: "Stackdriver",
        title: "Stream latency threshold breached",
        description: "EU edge node latency > 250ms observed for 120 seconds.",
        severity: "critical",
        status: "active",
        triggered_at: now,
        asset_id: `${tenantId}_asset_gce_vm01`,
        service_component_id: `${tenantId}_comp_edge01`,
        business_service_id: `${tenantId}_svc_streaming`,
        tags: ["latency", "edge", "streaming"],
      },
      {
        id: `${tenantId}_alert02`,
        tenantId,
        source: "GKE Metrics",
        title: "Pod OOM kills detected",
        description: "Transcoding workload pods killed due to memory limits.",
        severity: "warning",
        status: "active",
        triggered_at: now,
        asset_id: `${tenantId}_asset_gke_node01`,
        service_component_id: `${tenantId}_comp_gke_cluster01`,
        business_service_id: `${tenantId}_svc_transcoding`,
        tags: ["gke", "oom", "transcoding"],
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    alerts = [
      {
        id: `${tenantId}_alert01`,
        tenantId,
        source: "CloudWatch",
        title: "DB replication lag",
        description: "Replication lag > 30 min on reporting DB cluster.",
        severity: "critical",
        status: "active",
        triggered_at: now,
        asset_id: `${tenantId}_asset_db01`,
        service_component_id: `${tenantId}_comp_reportingdb`,
        business_service_id: `${tenantId}_svc_fin_reporting`,
        tags: ["database", "replication"],
      },
      {
        id: `${tenantId}_alert02`,
        tenantId,
        source: "Spark Metrics",
        title: "ETL job failures detected",
        description: "Failure rate > 20% observed in nightly ETL ingestion jobs.",
        severity: "warning",
        status: "active",
        triggered_at: now,
        asset_id: `${tenantId}_asset_etl01`,
        service_component_id: `${tenantId}_comp_datalake01`,
        business_service_id: `${tenantId}_svc_data_analytics`,
        tags: ["etl", "spark", "pipeline"],
      },
    ];
  }

  for (const alert of alerts) {
    await db.put("alerts", alert);

    // Audit log
    await db.put("audit_logs", {
      id: `${alert.id}_audit01`,
      tenantId,
      entity_type: "alert",
      entity_id: alert.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + alert.id,
      tags: ["seed"],
    });

    // Activity
    await db.put("activities", {
      id: `${alert.id}_act01`,
      tenantId,
      type: "alert",
      entity_id: alert.id,
      action: "triggered",
      description: `Alert "${alert.title}" triggered from ${alert.source}`,
      timestamp: now,
      related_entity_ids: [
        { type: "asset", id: alert.asset_id },
        { type: "service_component", id: alert.service_component_id },
        { type: "business_service", id: alert.business_service_id },
      ],
      tags: ["seed"],
    });
  }
};