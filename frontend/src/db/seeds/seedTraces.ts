// src/db/seeds/seedTraces.ts - FULLY CORRECTED
import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedTraces = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date();
  let traces: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    traces = [
      {
        id: `${tenantId}_trace01`,
        tenantId,
        trace_id: `trace_${generateSecureId()}`, // Added proper trace ID
        parent_trace_id: null, // Added parent trace tracking
        name: "BGP Route Advertisement Processing",
        description: "Distributed trace of BGP route processing across network infrastructure components.",
        operation_name: "bgp.route.process", // Added operation name
        service_name: "network-routing", // Added service name
        status: "error",
        start_time: new Date(now.getTime() - 300000).toISOString(), // 5 minutes ago
        end_time: now.toISOString(),
        duration_ms: 300000, // 5 minutes
        tags: {
          "bgp.peer": "att-peer-01",
          "route.prefix": "10.0.0.0/8",
          "error.type": "timeout",
          "component": "core-router"
        },
        spans: [
          { 
            span_id: "span_peer_connect", 
            parent_span_id: null,
            operation_name: "bgp.peer.connect",
            component: "BGP Session Manager", 
            start_time: new Date(now.getTime() - 300000).toISOString(),
            duration_ms: 15000,
            status: "ok",
            tags: { "peer.ip": "192.168.1.1", "peer.asn": "7018" }
          },
          { 
            span_id: "span_route_process", 
            parent_span_id: "span_peer_connect",
            operation_name: "bgp.route.advertise",
            component: "Route Processor", 
            start_time: new Date(now.getTime() - 285000).toISOString(),
            duration_ms: 180000, 
            status: "ok",
            tags: { "routes.count": "15000", "process.time": "180s" }
          },
          { 
            span_id: "span_rib_update", 
            parent_span_id: "span_route_process",
            operation_name: "rib.update",
            component: "RIB Manager", 
            start_time: new Date(now.getTime() - 105000).toISOString(),
            duration_ms: 105000, 
            status: "error",
            tags: { "error": "timeout", "routes.pending": "5000" }
          },
        ],
        asset_ids: [`${tenantId}_asset_router01`],
        service_component_ids: [`${tenantId}_comp_bgp_gateway`, `${tenantId}_comp_router01`],
        business_service_id: `${tenantId}_svc_internet`,
        error_count: 1, // Added error tracking
        warning_count: 0, // Added warning tracking
        sampling_rate: 1.0, // Added sampling information
        trace_state: "completed", // Added trace state
        environment: "production", // Added environment
        health_status: "red", // Added health status
        tags: ["bgp", "routing", "trace", "network"],
        custom_fields: {
          peer_count: 4,
          route_count_total: 15000,
          route_count_processed: 10000,
          infrastructure_tier: "core"
        }
      },
      {
        id: `${tenantId}_trace02`,
        tenantId,
        trace_id: `trace_${generateSecureId()}`,
        parent_trace_id: null,
        name: "Email Transport Processing",
        description: "End-to-end trace of email message processing through Exchange transport pipeline.",
        operation_name: "exchange.mail.transport",
        service_name: "email-transport",
        status: "completed",
        start_time: new Date(now.getTime() - 120000).toISOString(), // 2 minutes ago
        end_time: now.toISOString(),
        duration_ms: 120000,
        tags: {
          "mail.sender": "user@meta.com",
          "mail.recipient_count": "5",
          "transport.queue": "submission",
          "message.size_kb": "2048"
        },
        spans: [
          { 
            span_id: "span_submission", 
            parent_span_id: null,
            operation_name: "mail.submit",
            component: "SMTP Submission", 
            start_time: new Date(now.getTime() - 120000).toISOString(),
            duration_ms: 5000,
            status: "ok",
            tags: { "smtp.auth": "success", "message.id": "msg123" }
          },
          { 
            span_id: "span_routing", 
            parent_span_id: "span_submission",
            operation_name: "mail.route",
            component: "Transport Rules", 
            start_time: new Date(now.getTime() - 115000).toISOString(),
            duration_ms: 15000,
            status: "ok",
            tags: { "rules.applied": "3", "routing.decision": "local" }
          },
          { 
            span_id: "span_delivery", 
            parent_span_id: "span_routing",
            operation_name: "mail.deliver",
            component: "Mailbox Delivery", 
            start_time: new Date(now.getTime() - 100000).toISOString(),
            duration_ms: 100000,
            status: "completed",
            tags: { "delivery.attempts": "1", "recipients.success": "5" }
          },
        ],
        asset_ids: [`${tenantId}_asset_exchange01`],
        service_component_ids: [`${tenantId}_comp_exchange01`],
        business_service_id: `${tenantId}_svc_email`,
        error_count: 0,
        warning_count: 1,
        sampling_rate: 0.1,
        trace_state: "completed",
        environment: "production",
        health_status: "green",
        tags: ["exchange", "email", "transport", "smtp"],
        custom_fields: {
          message_size_kb: 2048,
          recipient_count: 5,
          queue_time_ms: 100000,
          transport_type: "internal"
        }
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    traces = [
      {
        id: `${tenantId}_trace01`,
        tenantId,
        trace_id: `trace_${generateSecureId()}`,
        parent_trace_id: null,
        name: "Video Stream Processing",
        description: "Distributed trace of video stream processing from upload to CDN distribution.",
        operation_name: "video.stream.process",
        service_name: "media-pipeline",
        status: "completed",
        start_time: new Date(now.getTime() - 1800000).toISOString(), // 30 minutes ago
        end_time: now.toISOString(),
        duration_ms: 1800000,
        tags: {
          "video.resolution": "4k",
          "video.duration_seconds": "3600",
          "codec": "h264",
          "bitrate_kbps": "8000"
        },
        spans: [
          { 
            span_id: "span_upload", 
            parent_span_id: null,
            operation_name: "video.upload",
            component: "Upload Service", 
            start_time: new Date(now.getTime() - 1800000).toISOString(),
            duration_ms: 300000,
            status: "ok",
            tags: { "file.size_gb": "8.5", "upload.speed_mbps": "50" }
          },
          { 
            span_id: "span_transcode", 
            parent_span_id: "span_upload",
            operation_name: "video.transcode",
            component: "Transcoding Pipeline", 
            start_time: new Date(now.getTime() - 1500000).toISOString(),
            duration_ms: 1200000,
            status: "completed",
            tags: { "profiles.count": "5", "cpu.cores_used": "16" }
          },
          { 
            span_id: "span_cdn_upload", 
            parent_span_id: "span_transcode",
            operation_name: "cdn.distribute",
            component: "CDN Distribution", 
            start_time: new Date(now.getTime() - 300000).toISOString(),
            duration_ms: 300000,
            status: "completed",
            tags: { "cdn.regions": "5", "cache.preload": "true" }
          },
        ],
        asset_ids: [`${tenantId}_asset_gke_node01`, `${tenantId}_asset_cdn01`],
        service_component_ids: [`${tenantId}_comp_gke_cluster01`, `${tenantId}_comp_cdn01`],
        business_service_id: `${tenantId}_svc_content_delivery`,
        error_count: 0,
        warning_count: 2,
        sampling_rate: 0.01,
        trace_state: "completed",
        environment: "production",
        health_status: "green",
        tags: ["video", "transcoding", "cdn", "streaming"],
        custom_fields: {
          video_size_gb: 8.5,
          transcoding_profiles: 5,
          cdn_regions: 5,
          processing_queue_position: 3
        }
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    traces = [
      {
        id: `${tenantId}_trace01`,
        tenantId,
        trace_id: `trace_${generateSecureId()}`,
        parent_trace_id: null,
        name: "Financial ETL Pipeline Execution",
        description: "Distributed trace of nightly ETL job processing financial data from source systems to data lake.",
        operation_name: "etl.financial.process",
        service_name: "data-pipeline",
        status: "error",
        start_time: new Date(now.getTime() - 3600000).toISOString(), // 1 hour ago
        end_time: now.toISOString(),
        duration_ms: 3600000,
        tags: {
          "etl.job_name": "nightly_financial_etl",
          "data.source_systems": "3",
          "data.volume_gb": "150",
          "spark.executor_count": "8"
        },
        spans: [
          { 
            span_id: "span_ingest", 
            parent_span_id: null,
            operation_name: "data.ingest",
            component: "Raw Data Ingestion", 
            start_time: new Date(now.getTime() - 3600000).toISOString(),
            duration_ms: 600000, // 10 minutes
            status: "ok",
            tags: { "records.ingested": "5000000", "sources": "trading,positions,risk" }
          },
          { 
            span_id: "span_transform", 
            parent_span_id: "span_ingest",
            operation_name: "data.transform",
            component: "Spark Transformation", 
            start_time: new Date(now.getTime() - 3000000).toISOString(),
            duration_ms: 2700000, // 45 minutes
            status: "error",
            tags: { "error": "TaskFailure", "failed.tasks": "3", "retry.count": "2" }
          },
          { 
            span_id: "span_load", 
            parent_span_id: "span_transform",
            operation_name: "data.load",
            component: "Data Lake Writer", 
            start_time: new Date(now.getTime() - 300000).toISOString(),
            duration_ms: 300000, // 5 minutes
            status: "partial",
            tags: { "records.loaded": "3200000", "records.failed": "1800000" }
          },
        ],
        asset_ids: [`${tenantId}_asset_etl01`, `${tenantId}_asset_db01`],
        service_component_ids: [`${tenantId}_comp_datalake01`, `${tenantId}_comp_reportingdb`],
        business_service_id: `${tenantId}_svc_data_analytics`,
        error_count: 1,
        warning_count: 3,
        sampling_rate: 1.0,
        trace_state: "failed",
        environment: "production",
        health_status: "red",
        tags: ["etl", "spark", "financial", "data"],
        custom_fields: {
          data_volume_gb: 150,
          records_total: 5000000,
          records_processed: 3200000,
          cluster_size: "8_nodes",
          failure_stage: "transform"
        }
      },
    ];
  }

  // Insert traces with proper error handling
  for (const trace of traces) {
    try {
      await db.put("traces", trace);

      // Create COMPLETE audit log entry matching AuditLogEntry interface
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "trace",
        entity_id: trace.id,
        action: "collect",
        description: `Distributed trace collected: ${trace.name} (${trace.status}) - ${trace.duration_ms}ms duration`,
        timestamp: trace.end_time,
        user_id: "system", // Required field - traces are system collected
        tags: ["seed", "trace", "collect", trace.status],
        hash: await generateHash({
          entity_type: "trace",
          entity_id: trace.id,
          action: "collect",
          timestamp: trace.end_time,
          tenantId
        }),
        metadata: {
          trace_name: trace.name,
          trace_id: trace.trace_id,
          status: trace.status,
          operation_name: trace.operation_name,
          service_name: trace.service_name,
          duration_ms: trace.duration_ms,
          span_count: trace.spans.length,
          error_count: trace.error_count,
          business_service_id: trace.business_service_id,
          sampling_rate: trace.sampling_rate,
          environment: trace.environment
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: trace.end_time,
        message: `Distributed trace "${trace.name}" completed with ${trace.status} status in ${trace.duration_ms}ms (${trace.spans.length} spans)`,
        storeName: "traces", // Required field for dbClient compatibility
        recordId: trace.id, // Required field for dbClient compatibility  
        action: "create",
        userId: "system", // System collects traces
        metadata: {
          trace_id: trace.trace_id,
          trace_name: trace.name,
          status: trace.status,
          operation_name: trace.operation_name,
          service_name: trace.service_name,
          duration_ms: trace.duration_ms,
          span_details: trace.spans.map((span: any) => ({
            span_id: span.span_id,
            operation: span.operation_name,
            component: span.component,
            duration_ms: span.duration_ms,
            status: span.status
          })),
          performance_metrics: {
            total_duration_ms: trace.duration_ms,
            error_count: trace.error_count,
            warning_count: trace.warning_count,
            sampling_rate: trace.sampling_rate
          },
          related_entities: [
            { type: "business_service", id: trace.business_service_id },
            ...trace.asset_ids.map((id: string) => ({ type: "asset", id })),
            ...trace.service_component_ids.map((id: string) => ({ type: "service_component", id }))
          ]
        }
      });

      console.log(`✅ Seeded trace: ${trace.id} - ${trace.name}`);
    } catch (error) {
      console.error(`❌ Failed to seed trace ${trace.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${traces.length} traces for ${tenantId}`);
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