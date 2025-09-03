import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedTraces = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date();
  let traces: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    traces = [
      {
        id: `${tenantId}_trace01`,
        tenantId,
        name: "Datacenter Packet Flow",
        root_span: "PacketTraversal",
        duration_ms: 35,
        status: "success",
        collected_at: now.toISOString(),
        spans: [
          { span_id: "span_router01", component: "Core Router", duration_ms: 20 },
          { span_id: "span_switch01", component: "Top-of-Rack Switch", duration_ms: 15 },
        ],
        asset_ids: [`${tenantId}_asset_router01`, `${tenantId}_asset_switch01`],
        service_component_ids: [`${tenantId}_comp_router01`, `${tenantId}_comp_switch01`],
        business_service_id: `${tenantId}_svc_network`,
        tags: ["network", "trace"],
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    traces = [
      {
        id: `${tenantId}_trace01`,
        tenantId,
        name: "User Playback Request EU",
        root_span: "PlaybackPipeline",
        duration_ms: 1250,
        status: "degraded",
        collected_at: now.toISOString(),
        spans: [
          { span_id: "span_edge01", component: "EU Edge Node", duration_ms: 700 },
          { span_id: "span_transcode01", component: "GKE Transcoding Service", duration_ms: 550 },
        ],
        asset_ids: [`${tenantId}_asset_gce_vm01`, `${tenantId}_asset_gke_node01`],
        service_component_ids: [`${tenantId}_comp_edge01`, `${tenantId}_comp_gke_cluster01`],
        business_service_id: `${tenantId}_svc_streaming`,
        tags: ["streaming", "latency", "trace"],
      },
      {
        id: `${tenantId}_trace02`,
        tenantId,
        name: "Transcoding Job Trace",
        root_span: "MediaPipeline",
        duration_ms: 3200,
        status: "failed",
        collected_at: now.toISOString(),
        spans: [
          { span_id: "span_download", component: "Content Ingestion", duration_ms: 200 },
          { span_id: "span_transcode", component: "Transcoding Pod", duration_ms: 3000, error: "OOMKilled" },
        ],
        asset_ids: [`${tenantId}_asset_gke_node01`],
        service_component_ids: [`${tenantId}_comp_gke_cluster01`],
        business_service_id: `${tenantId}_svc_transcoding`,
        tags: ["gke", "oom", "trace"],
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    traces = [
      {
        id: `${tenantId}_trace01`,
        tenantId,
        name: "ETL Pipeline Execution",
        root_span: "ETLJob",
        duration_ms: 540000, // 9 minutes
        status: "failed",
        collected_at: now.toISOString(),
        spans: [
          { span_id: "span_ingest", component: "Raw Data Ingestion", duration_ms: 60000 },
          { span_id: "span_transform", component: "Spark Transformation", duration_ms: 300000, error: "TaskFailure" },
          { span_id: "span_load", component: "Load to Reporting DB", duration_ms: 180000 },
        ],
        asset_ids: [`${tenantId}_asset_etl01`, `${tenantId}_asset_db01`],
        service_component_ids: [`${tenantId}_comp_datalake01`, `${tenantId}_comp_reportingdb`],
        business_service_id: `${tenantId}_svc_data_analytics`,
        tags: ["etl", "spark", "trace"],
      },
    ];
  }

  for (const trace of traces) {
    await db.put("traces", trace);

    // Audit log
    await db.put("audit_logs", {
      id: `${trace.id}_audit01`,
      tenantId,
      entity_type: "trace",
      entity_id: trace.id,
      action: "collect",
      timestamp: now.toISOString(),
      hash: "hash_" + trace.id,
      tags: ["seed"],
    });

    // Activity
    await db.put("activity_timeline", {
      id: `${trace.id}_act01`,
      tenantId,
      type: "trace",
      entity_id: trace.id,
      action: "collected",
      description: `Trace "${trace.name}" collected with status ${trace.status}`,
      timestamp: now.toISOString(),
      related_entity_ids: [
        { type: "business_service", id: trace.business_service_id },
      ],
      tags: ["seed"],
    });
  }
};