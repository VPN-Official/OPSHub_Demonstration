import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedTraces = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  let traces: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    traces = [
      {
        id: `${tenantId}_trace01`,
        tenantId: tenantId,
        source_system: "OpenTelemetry",
        trace_id: "trace-dcn-001",
        span_id: "span-router-cpu",
        parent_span_id: null,
        operation: "packet_forwarding",
        duration_ms: 320,
        captured_at: now,
        asset_id: `${tenantId}_asset_router01`,
        service_component_id: `${tenantId}_comp_router01`,
        business_service_id: `${tenantId}_svc_network`,
        tags: ["router", "trace"],
        health_status: "red",
      },
      {
        id: `${tenantId}_trace02`,
        tenantId: tenantId,
        source_system: "OpenTelemetry",
        trace_id: "trace-dcn-002",
        span_id: "span-switch-forward",
        parent_span_id: "span-router-cpu",
        operation: "frame_forwarding",
        duration_ms: 80,
        captured_at: now,
        asset_id: `${tenantId}_asset_switch01`,
        service_component_id: `${tenantId}_comp_switch01`,
        business_service_id: `${tenantId}_svc_network`,
        tags: ["switch", "trace"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    traces = [
      {
        id: `${tenantId}_trace01`,
        tenantId: tenantId,
        source_system: "OpenTelemetry",
        trace_id: "trace-av-001",
        span_id: "span-edge-latency",
        parent_span_id: null,
        operation: "stream_start",
        duration_ms: 28000,
        captured_at: now,
        asset_id: `${tenantId}_asset_gce_vm01`,
        service_component_id: `${tenantId}_comp_edge01`,
        business_service_id: `${tenantId}_svc_streaming`,
        tags: ["stream", "latency"],
        health_status: "red",
      },
      {
        id: `${tenantId}_trace02`,
        tenantId: tenantId,
        source_system: "OpenTelemetry",
        trace_id: "trace-av-002",
        span_id: "span-transcode-ffmpeg",
        parent_span_id: null,
        operation: "video_transcode",
        duration_ms: 1200,
        captured_at: now,
        asset_id: `${tenantId}_asset_gke_node01`,
        service_component_id: `${tenantId}_comp_gke_cluster01`,
        business_service_id: `${tenantId}_svc_transcoding`,
        tags: ["transcoding", "trace"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    traces = [
      {
        id: `${tenantId}_trace01`,
        tenantId: tenantId,
        source_system: "OpenTelemetry",
        trace_id: "trace-sd-001",
        span_id: "span-exchange-mail",
        parent_span_id: null,
        operation: "send_mail",
        duration_ms: 450,
        captured_at: now,
        asset_id: `${tenantId}_asset_mx01`,
        service_component_id: `${tenantId}_comp_exchange01`,
        business_service_id: `${tenantId}_svc_email`,
        tags: ["exchange", "mail"],
        health_status: "red",
      },
      {
        id: `${tenantId}_trace02`,
        tenantId: tenantId,
        source_system: "OpenTelemetry",
        trace_id: "trace-sd-002",
        span_id: "span-vpn-auth",
        parent_span_id: null,
        operation: "authenticate_user",
        duration_ms: 150,
        captured_at: now,
        asset_id: `${tenantId}_asset_vpn_appliance01`,
        service_component_id: `${tenantId}_comp_vpn01`,
        business_service_id: `${tenantId}_svc_vpn`,
        tags: ["vpn", "auth"],
        health_status: "orange",
      },
    ];
  }

  for (const trace of traces) {
    await db.put("traces", trace);

    // Light audit log
    await db.put("audit_logs", {
      id: `${trace.id}_audit01`,
      tenantId: tenantId,
      entity_type: "trace",
      entity_id: trace.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + trace.id,
      tags: ["seed"],
    });

    // Light activity
    await db.put("activities", {
      id: `${trace.id}_act01`,
      tenantId: tenantId,
      type: "trace",
      entity_id: trace.id,
      action: "collected",
      description: `Trace "${trace.operation}" seeded`,
      timestamp: now,
      related_entity_ids: trace.asset_id
        ? [{ type: "asset", id: trace.asset_id }]
        : [],
      tags: ["seed"],
    });
  }
};