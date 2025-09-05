// src/db/seeds/seedLogs.ts - FULLY CORRECTED
import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedLogs = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let logs: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    logs = [
      {
        id: `${tenantId}_log01`,
        tenantId,
        source_system: "Exchange Server",
        facility: "mail", // Added facility
        hostname: "exchange01.meta.com", // Added hostname
        application: "MSExchangeTransport", // Added application
        message: "ERROR: Transport queue size exceeded 200 messages. Current: 247 messages.",
        level: "error",
        raw_message: "[2025-01-15T10:30:45.123Z] MSExchangeTransport ERROR: Queue overflow detected", // Added raw message
        structured_data: { // Added structured data
          queue_size: 247,
          threshold: 200,
          queue_type: "submission",
          server_id: "EX01"
        },
        captured_at: now,
        indexed_at: now, // Added indexing timestamp
        asset_id: `${tenantId}_asset_exchange01`,
        service_component_id: `${tenantId}_comp_exchange01`,
        business_service_id: `${tenantId}_svc_email`,
        log_source_ip: "10.0.1.15", // Added source IP
        correlation_id: `corr_${generateSecureId()}`, // Added correlation ID
        data_retention_days: 90, // Added retention policy
        tags: ["exchange", "queue", "transport", "error"],
        health_status: "red",
        custom_fields: {
          server_version: "Exchange 2019",
          database_name: "Mailbox Database 01",
          organization: "meta.com"
        }
      },
      {
        id: `${tenantId}_log02`,
        tenantId,
        source_system: "Cisco ASA",
        facility: "security",
        hostname: "firewall01.meta.com",
        application: "ASA-Firewall",
        message: "WARN: VPN tunnel drops observed during peak hours. Tunnel: RemoteOffice-VPN.",
        level: "warn",
        raw_message: "[2025-01-15T10:25:30.456Z] %ASA-4-722037: Group RemoteOffice-VPN User vpnuser IP 192.168.1.100 Session disconnected",
        structured_data: {
          group_name: "RemoteOffice-VPN",
          user_ip: "192.168.1.100",
          session_duration: 3600,
          disconnect_reason: "idle_timeout"
        },
        captured_at: now,
        indexed_at: now,
        asset_id: `${tenantId}_asset_vpn_appliance01`,
        service_component_id: `${tenantId}_comp_vpn01`,
        business_service_id: `${tenantId}_svc_vpn`,
        log_source_ip: "10.0.2.1",
        correlation_id: `corr_${generateSecureId()}`,
        data_retention_days: 365, // Longer retention for security logs
        tags: ["vpn", "tunnel", "security", "disconnection"],
        health_status: "orange",
        custom_fields: {
          device_model: "Cisco ASA 5515-X",
          software_version: "9.16(4)30",
          tunnel_count_active: 47
        }
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    logs = [
      {
        id: `${tenantId}_log01`,
        tenantId,
        source_system: "GKE Cluster",
        facility: "container",
        hostname: "gke-node-01.google.internal",
        application: "kubelet",
        message: "ERROR: Pod transcoding-worker-abc123 killed due to OOM. Memory limit: 2Gi, Usage: 2.1Gi.",
        level: "error",
        raw_message: "[2025-01-15T10:32:15.789Z] kubelet[1234]: OOMKilled pod transcoding-worker-abc123 in namespace transcoding",
        structured_data: {
          pod_name: "transcoding-worker-abc123",
          namespace: "transcoding",
          memory_limit_bytes: 2147483648,
          memory_usage_bytes: 2254857830,
          restart_count: 3,
          node_name: "gke-node-01"
        },
        captured_at: now,
        indexed_at: now,
        asset_id: `${tenantId}_asset_gke_node01`,
        service_component_id: `${tenantId}_comp_gke_cluster01`,
        business_service_id: `${tenantId}_svc_transcoding`,
        log_source_ip: "10.128.0.5",
        correlation_id: `corr_${generateSecureId()}`,
        data_retention_days: 30,
        tags: ["kubernetes", "oom", "transcoding", "container"],
        health_status: "red",
        custom_fields: {
          cluster_name: "media-prod-01",
          kubernetes_version: "1.25.8-gke.500",
          zone: "us-central1-a"
        }
      },
      {
        id: `${tenantId}_log02`,
        tenantId,
        source_system: "CDN Edge",
        facility: "web",
        hostname: "edge-eu-west-1.google.com",
        application: "nginx",
        message: "WARN: High cache miss ratio detected. Current: 60%, Expected: <20%. Origin load increasing.",
        level: "warn",
        raw_message: "[2025-01-15T10:28:45.234Z] nginx[5678]: cache_miss_ratio=0.60 origin_requests=1247/min",
        structured_data: {
          cache_miss_ratio: 0.60,
          origin_requests_per_minute: 1247,
          total_requests_per_minute: 3118,
          edge_location: "eu-west-1",
          pop_id: "LHR02"
        },
        captured_at: now,
        indexed_at: now,
        asset_id: `${tenantId}_asset_cdn01`,
        service_component_id: `${tenantId}_comp_cdn01`,
        business_service_id: `${tenantId}_svc_content_delivery`,
        log_source_ip: "10.200.1.50",
        correlation_id: `corr_${generateSecureId()}`,
        data_retention_days: 60,
        tags: ["cdn", "cache", "performance", "origin"],
        health_status: "orange",
        custom_fields: {
          provider: "cloudflare",
          cache_size_gb: 500,
          bandwidth_mbps: 10000
        }
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    logs = [
      {
        id: `${tenantId}_log01`,
        tenantId,
        source_system: "PostgreSQL",
        facility: "database",
        hostname: "db-replica-01.morningstar.com",
        application: "postgres",
        message: "ERROR: Replication lag exceeded 30 minutes. Current lag: 42 minutes. WAL replay paused.",
        level: "error",
        raw_message: "[2025-01-15T10:35:20.567Z] postgres[9876]: REPLICATION WARN: replay_lag=42min wal_buffers_full=true",
        structured_data: {
          replication_lag_minutes: 42,
          wal_replay_lag_bytes: 1073741824,
          last_wal_receive_time: "2025-01-15T09:53:20.567Z",
          replica_instance: "db-replica-01",
          primary_instance: "db-primary-01"
        },
        captured_at: now,
        indexed_at: now,
        asset_id: `${tenantId}_asset_db01`,
        service_component_id: `${tenantId}_comp_reportingdb`,
        business_service_id: `${tenantId}_svc_fin_reporting`,
        log_source_ip: "10.50.1.101",
        correlation_id: `corr_${generateSecureId()}`,
        data_retention_days: 180, // Longer retention for financial compliance
        tags: ["postgresql", "replication", "lag", "financial"],
        health_status: "red",
        custom_fields: {
          database_version: "13.8",
          database_size_gb: 2048,
          replica_type: "streaming"
        }
      },
      {
        id: `${tenantId}_log02`,
        tenantId,
        source_system: "Spark Cluster",
        facility: "data",
        hostname: "spark-master-01.morningstar.com",
        application: "spark",
        message: "WARN: ETL job nightly_financial_etl failed with TaskFailedException. Retrying with increased memory.",
        level: "warn",
        raw_message: "[2025-01-15T10:30:00.123Z] spark[2468]: Application application_1642204800000_0001 FAILED: TaskFailedException stage 2.0",
        structured_data: {
          application_id: "application_1642204800000_0001",
          job_name: "nightly_financial_etl",
          stage_id: "2.0",
          failed_tasks: 3,
          total_tasks: 47,
          driver_memory: "4g",
          executor_memory: "8g"
        },
        captured_at: now,
        indexed_at: now,
        asset_id: `${tenantId}_asset_etl01`,
        service_component_id: `${tenantId}_comp_datalake01`,
        business_service_id: `${tenantId}_svc_data_analytics`,
        log_source_ip: "10.60.1.200",
        correlation_id: `corr_${generateSecureId()}`,
        data_retention_days: 120,
        tags: ["spark", "etl", "failure", "retry"],
        health_status: "orange",
        custom_fields: {
          spark_version: "3.3.1",
          cluster_size: "8_nodes",
          yarn_queue: "financial_analytics"
        }
      },
    ];
  }

  // Insert logs with proper error handling
  for (const log of logs) {
    try {
      await db.put("logs", log);

      // Create COMPLETE audit log entry matching AuditLogEntry interface
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "log",
        entity_id: log.id,
        action: "collect",
        description: `Log collected from ${log.source_system}: ${log.level.toUpperCase()} - ${log.message.substring(0, 100)}...`,
        timestamp: log.captured_at,
        user_id: "system", // Required field - logs are system collected
        tags: ["seed", "log", "collect", log.level],
        hash: await generateHash({
          entity_type: "log",
          entity_id: log.id,
          action: "collect",
          timestamp: log.captured_at,
          tenantId
        }),
        metadata: {
          source_system: log.source_system,
          level: log.level,
          facility: log.facility,
          hostname: log.hostname,
          application: log.application,
          business_service_id: log.business_service_id,
          asset_id: log.asset_id,
          correlation_id: log.correlation_id,
          data_retention_days: log.data_retention_days
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: log.captured_at,
        message: `Log entry collected from ${log.source_system} (${log.level.toUpperCase()}): ${log.message.substring(0, 80)}...`,
        storeName: "logs", // Required field for dbClient compatibility
        recordId: log.id, // Required field for dbClient compatibility  
        action: "create",
        userId: "system", // System collects logs
        metadata: {
          log_id: log.id,
          source_system: log.source_system,
          level: log.level,
          facility: log.facility,
          hostname: log.hostname,
          application: log.application,
          health_status: log.health_status,
          correlation_id: log.correlation_id,
          structured_data: log.structured_data,
          retention: {
            days: log.data_retention_days,
            indexed_at: log.indexed_at
          },
          related_entities: [
            { type: "asset", id: log.asset_id },
            { type: "service_component", id: log.service_component_id },
            { type: "business_service", id: log.business_service_id }
          ]
        }
      });

      console.log(`✅ Seeded log: ${log.id} - ${log.source_system} ${log.level}`);
    } catch (error) {
      console.error(`❌ Failed to seed log ${log.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${logs.length} logs for ${tenantId}`);
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