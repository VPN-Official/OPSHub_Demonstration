// src/db/seeds/seedServiceComponents.ts - FULLY CORRECTED
import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedServiceComponents = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let components: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    components = [
      {
        id: `${tenantId}_comp_router01`,
        tenantId,
        name: "Core Router",
        description: "Primary core network router handling BGP peering and inter-VLAN routing",
        type: "network_device",
        category: "infrastructure",
        subcategory: "routing",
        business_service_id: `${tenantId}_svc_network`,
        parent_component_id: null,
        dependencies: [],
        status: "operational",
        health_status: "yellow",
        priority: "critical",
        criticality_tier: "tier_1",
        availability_target: 99.99,
        current_availability: 99.85,
        mtbf_hours: 8760, // Mean time between failures
        mttr_minutes: 60, // Mean time to repair
        performance_metrics: {
          cpu_utilization: 85,
          memory_utilization: 62,
          throughput_gbps: 8.5,
          packet_loss_percent: 0.01
        },
        capacity_metrics: {
          max_throughput_gbps: 10,
          max_connections: 10000,
          current_connections: 7500
        },
        configuration: {
          version: "15.6.3",
          last_updated: now,
          compliance_status: "compliant",
          backup_configured: true
        },
        monitoring: {
          polling_interval_seconds: 60,
          alerting_enabled: true,
          metrics_retention_days: 90
        },
        maintenance: {
          last_maintenance: "2024-12-01T00:00:00Z",
          next_maintenance: "2025-03-01T00:00:00Z",
          maintenance_window: "sunday_02:00_06:00"
        },
        owner_team_id: `${tenantId}_team_network`,
        asset_ids: [`${tenantId}_asset_router01`],
        created_at: now,
        updated_at: now,
        tags: ["router", "core", "network", "bgp", "critical"],
        custom_fields: {
          vendor: "cisco",
          model: "isr-4431",
          location: "datacenter-01",
          rack: "R1-U14"
        }
      },
      {
        id: `${tenantId}_comp_switch01`,
        tenantId,
        name: "Top-of-Rack Switch",
        description: "TOR switch providing connectivity to rack servers and uplink to core",
        type: "network_device",
        category: "infrastructure",
        subcategory: "switching",
        business_service_id: `${tenantId}_svc_network`,
        parent_component_id: `${tenantId}_comp_router01`,
        dependencies: [`${tenantId}_comp_router01`],
        status: "degraded",
        health_status: "orange",
        priority: "high",
        criticality_tier: "tier_2",
        availability_target: 99.9,
        current_availability: 98.5,
        mtbf_hours: 4380,
        mttr_minutes: 120,
        performance_metrics: {
          port_utilization: 75,
          error_rate_percent: 0.5,
          throughput_gbps: 20,
          latency_ms: 0.5
        },
        capacity_metrics: {
          total_ports: 48,
          active_ports: 36,
          max_throughput_gbps: 40
        },
        configuration: {
          version: "12.2(55)SE12",
          last_updated: now,
          compliance_status: "compliant",
          backup_configured: true
        },
        monitoring: {
          polling_interval_seconds: 30,
          alerting_enabled: true,
          metrics_retention_days: 60
        },
        maintenance: {
          last_maintenance: "2024-11-15T00:00:00Z",
          next_maintenance: "2025-02-15T00:00:00Z",
          maintenance_window: "sunday_02:00_06:00"
        },
        owner_team_id: `${tenantId}_team_network`,
        asset_ids: [`${tenantId}_asset_switch01`],
        created_at: now,
        updated_at: now,
        tags: ["switch", "tor", "network", "datacenter"],
        custom_fields: {
          vendor: "cisco",
          model: "3750x",
          location: "datacenter-01",
          rack: "R1-U20"
        }
      },
      {
        id: `${tenantId}_comp_exchange01`,
        tenantId,
        name: "Exchange Mail Server",
        description: "Microsoft Exchange server handling corporate email services",
        type: "application_server",
        category: "application",
        subcategory: "messaging",
        business_service_id: `${tenantId}_svc_email`,
        parent_component_id: null,
        dependencies: [`${tenantId}_comp_switch01`],
        status: "operational",
        health_status: "orange",
        priority: "high",
        criticality_tier: "tier_2",
        availability_target: 99.5,
        current_availability: 99.2,
        mtbf_hours: 2190,
        mttr_minutes: 30,
        performance_metrics: {
          queue_length: 247,
          processing_rate_per_minute: 500,
          disk_usage_percent: 85,
          memory_usage_gb: 28
        },
        capacity_metrics: {
          max_queue_size: 1000,
          max_mailboxes: 5000,
          current_mailboxes: 3500
        },
        configuration: {
          version: "Exchange 2019 CU12",
          last_updated: now,
          compliance_status: "compliant",
          backup_configured: true
        },
        monitoring: {
          polling_interval_seconds: 300,
          alerting_enabled: true,
          metrics_retention_days: 365
        },
        maintenance: {
          last_maintenance: "2024-12-15T00:00:00Z",
          next_maintenance: "2025-01-15T00:00:00Z",
          maintenance_window: "saturday_22:00_02:00"
        },
        owner_team_id: `${tenantId}_team_windows`,
        asset_ids: [`${tenantId}_asset_exchange01`],
        created_at: now,
        updated_at: now,
        tags: ["exchange", "email", "messaging", "windows"],
        custom_fields: {
          vendor: "microsoft",
          database_size_gb: 850,
          location: "datacenter-01",
          server_role: "mailbox"
        }
      },
      {
        id: `${tenantId}_comp_bgp_gateway`,
        tenantId,
        name: "BGP Gateway Service",
        description: "BGP routing service managing external peering relationships",
        type: "network_service",
        category: "infrastructure",
        subcategory: "routing",
        business_service_id: `${tenantId}_svc_internet`,
        parent_component_id: `${tenantId}_comp_router01`,
        dependencies: [`${tenantId}_comp_router01`],
        status: "degraded",
        health_status: "red",
        priority: "critical",
        criticality_tier: "tier_1",
        availability_target: 99.99,
        current_availability: 98.0,
        mtbf_hours: 720,
        mttr_minutes: 15,
        performance_metrics: {
          active_peers: 2,
          total_peers: 4,
          routes_received: 750000,
          routes_advertised: 100
        },
        capacity_metrics: {
          max_peers: 10,
          max_routes: 1000000,
          convergence_time_seconds: 30
        },
        configuration: {
          version: "bgpd-1.2.0",
          last_updated: now,
          compliance_status: "compliant",
          backup_configured: true
        },
        monitoring: {
          polling_interval_seconds: 10,
          alerting_enabled: true,
          metrics_retention_days: 180
        },
        maintenance: {
          last_maintenance: "2024-12-20T00:00:00Z",
          next_maintenance: "2025-01-20T00:00:00Z",
          maintenance_window: "sunday_02:00_06:00"
        },
        owner_team_id: `${tenantId}_team_network`,
        asset_ids: [`${tenantId}_asset_router01`],
        created_at: now,
        updated_at: now,
        tags: ["bgp", "routing", "gateway", "critical"],
        custom_fields: {
          asn: "65001",
          peer_asns: ["7018", "3356"],
          location: "datacenter-01",
          redundancy: "active-passive"
        }
      }
    ];
  }

  if (tenantId === "tenant_av_google") {
    components = [
      {
        id: `${tenantId}_comp_edge01`,
        tenantId,
        name: "EU Edge Node",
        description: "Edge compute node serving streaming content to European users",
        type: "compute_node",
        category: "infrastructure",
        subcategory: "compute",
        business_service_id: `${tenantId}_svc_streaming`,
        parent_component_id: null,
        dependencies: [],
        status: "operational",
        health_status: "red",
        priority: "critical",
        criticality_tier: "tier_1",
        availability_target: 99.95,
        current_availability: 98.5,
        mtbf_hours: 2160,
        mttr_minutes: 45,
        performance_metrics: {
          cpu_utilization: 95,
          memory_utilization: 78,
          latency_p95_ms: 285,
          concurrent_streams: 125000
        },
        capacity_metrics: {
          max_concurrent_streams: 150000,
          compute_units: 100,
          bandwidth_gbps: 100
        },
        configuration: {
          version: "edge-2.5.0",
          last_updated: now,
          compliance_status: "compliant",
          auto_scaling_enabled: true
        },
        monitoring: {
          polling_interval_seconds: 15,
          alerting_enabled: true,
          metrics_retention_days: 90
        },
        maintenance: {
          last_maintenance: "2024-12-10T00:00:00Z",
          next_maintenance: "2025-01-10T00:00:00Z",
          maintenance_window: "tuesday_02:00_04:00"
        },
        owner_team_id: `${tenantId}_team_sre`,
        asset_ids: [`${tenantId}_asset_gce_vm01`],
        created_at: now,
        updated_at: now,
        tags: ["edge", "streaming", "compute", "europe"],
        custom_fields: {
          region: "eu-west-1",
          provider: "gcp",
          instance_type: "n1-highmem-32",
          auto_scaling_group: "edge-eu-west"
        }
      },
      {
        id: `${tenantId}_comp_gke_cluster01`,
        tenantId,
        name: "GKE Transcoding Cluster",
        description: "Kubernetes cluster running video transcoding workloads",
        type: "kubernetes_cluster",
        category: "infrastructure",
        subcategory: "containerization",
        business_service_id: `${tenantId}_svc_transcoding`,
        parent_component_id: null,
        dependencies: [],
        status: "degraded",
        health_status: "orange",
        priority: "high",
        criticality_tier: "tier_2",
        availability_target: 99.9,
        current_availability: 98.8,
        mtbf_hours: 1440,
        mttr_minutes: 30,
        performance_metrics: {
          pod_count: 47,
          node_count: 12,
          cpu_utilization: 82,
          memory_utilization: 88
        },
        capacity_metrics: {
          max_pods: 110,
          max_nodes: 20,
          total_cpu_cores: 192,
          total_memory_gb: 768
        },
        configuration: {
          version: "1.25.8-gke.500",
          last_updated: now,
          compliance_status: "compliant",
          auto_scaling_enabled: true
        },
        monitoring: {
          polling_interval_seconds: 30,
          alerting_enabled: true,
          metrics_retention_days: 60
        },
        maintenance: {
          last_maintenance: "2024-12-05T00:00:00Z",
          next_maintenance: "2025-01-05T00:00:00Z",
          maintenance_window: "wednesday_03:00_05:00"
        },
        owner_team_id: `${tenantId}_team_mediaops`,
        asset_ids: [`${tenantId}_asset_gke_node01`],
        created_at: now,
        updated_at: now,
        tags: ["kubernetes", "gke", "transcoding", "media"],
        custom_fields: {
          cluster_name: "media-prod-01",
          namespace: "transcoding",
          ingress_type: "nginx",
          storage_class: "ssd"
        }
      },
      {
        id: `${tenantId}_comp_cdn01`,
        tenantId,
        name: "CDN Distribution Network",
        description: "Content delivery network for global media distribution",
        type: "cdn_service",
        category: "infrastructure",
        subcategory: "networking",
        business_service_id: `${tenantId}_svc_content_delivery`,
        parent_component_id: null,
        dependencies: [`${tenantId}_comp_edge01`],
        status: "operational",
        health_status: "orange",
        priority: "critical",
        criticality_tier: "tier_1",
        availability_target: 99.99,
        current_availability: 99.85,
        mtbf_hours: 8760,
        mttr_minutes: 5,
        performance_metrics: {
          cache_hit_ratio: 0.4,
          bandwidth_usage_gbps: 450,
          requests_per_second: 250000,
          origin_load_percent: 60
        },
        capacity_metrics: {
          max_bandwidth_gbps: 1000,
          cache_size_tb: 500,
          edge_locations: 150,
          max_requests_per_second: 1000000
        },
        configuration: {
          version: "cdn-3.2.0",
          last_updated: now,
          compliance_status: "compliant",
          ssl_enabled: true
        },
        monitoring: {
          polling_interval_seconds: 60,
          alerting_enabled: true,
          metrics_retention_days: 90
        },
        maintenance: {
          last_maintenance: "2024-12-01T00:00:00Z",
          next_maintenance: "2025-02-01T00:00:00Z",
          maintenance_window: "monday_04:00_06:00"
        },
        owner_team_id: `${tenantId}_team_sre`,
        asset_ids: [`${tenantId}_asset_cdn01`],
        created_at: now,
        updated_at: now,
        tags: ["cdn", "content", "delivery", "cache"],
        custom_fields: {
          provider: "cloudflare",
          tier: "enterprise",
          waf_enabled: true,
          ddos_protection: true
        }
      }
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    components = [
      {
        id: `${tenantId}_comp_reportingdb`,
        tenantId,
        name: "Reporting Database",
        description: "PostgreSQL cluster for financial reporting and analytics",
        type: "database",
        category: "data",
        subcategory: "relational",
        business_service_id: `${tenantId}_svc_fin_reporting`,
        parent_component_id: null,
        dependencies: [],
        status: "degraded",
        health_status: "red",
        priority: "critical",
        criticality_tier: "tier_1",
        availability_target: 99.95,
        current_availability: 97.5,
        mtbf_hours: 720,
        mttr_minutes: 120,
        performance_metrics: {
          replication_lag_minutes: 42,
          queries_per_second: 1250,
          connection_count: 450,
          disk_usage_percent: 72
        },
        capacity_metrics: {
          max_connections: 1000,
          database_size_gb: 2048,
          max_iops: 30000,
          cpu_cores: 32
        },
        configuration: {
          version: "PostgreSQL 13.8",
          last_updated: now,
          compliance_status: "compliant",
          replication_type: "streaming"
        },
        monitoring: {
          polling_interval_seconds: 60,
          alerting_enabled: true,
          metrics_retention_days: 365
        },
        maintenance: {
          last_maintenance: "2024-11-30T00:00:00Z",
          next_maintenance: "2025-01-30T00:00:00Z",
          maintenance_window: "sunday_01:00_07:00"
        },
        owner_team_id: `${tenantId}_team_dba`,
        asset_ids: [`${tenantId}_asset_db01`],
        created_at: now,
        updated_at: now,
        tags: ["postgresql", "database", "reporting", "financial"],
        custom_fields: {
          instance_type: "db.r5.8xlarge",
          replicas_count: 3,
          backup_retention_days: 30,
          encryption: "aes-256"
        }
      },
      {
        id: `${tenantId}_comp_datalake01`,
        tenantId,
        name: "Data Lake Ingestion Service",
        description: "ETL pipeline service for data lake ingestion and processing",
        type: "etl_pipeline",
        category: "data",
        subcategory: "processing",
        business_service_id: `${tenantId}_svc_data_analytics`,
        parent_component_id: null,
        dependencies: [`${tenantId}_comp_reportingdb`],
        status: "degraded",
        health_status: "orange",
        priority: "high",
        criticality_tier: "tier_2",
        availability_target: 99.5,
        current_availability: 96.5,
        mtbf_hours: 360,
        mttr_minutes: 60,
        performance_metrics: {
          job_success_rate: 0.77,
          processing_rate_gb_hour: 150,
          queue_depth: 47,
          average_latency_minutes: 45
        },
        capacity_metrics: {
          max_parallel_jobs: 20,
          cluster_nodes: 8,
          total_memory_gb: 512,
          storage_capacity_tb: 100
        },
        configuration: {
          version: "spark-3.3.1",
          last_updated: now,
          compliance_status: "compliant",
          checkpointing_enabled: false
        },
        monitoring: {
          polling_interval_seconds: 300,
          alerting_enabled: true,
          metrics_retention_days: 120
        },
        maintenance: {
          last_maintenance: "2024-12-08T00:00:00Z",
          next_maintenance: "2025-01-08T00:00:00Z",
          maintenance_window: "saturday_23:00_03:00"
        },
        owner_team_id: `${tenantId}_team_dataops`,
        asset_ids: [`${tenantId}_asset_etl01`],
        created_at: now,
        updated_at: now,
        tags: ["etl", "spark", "datalake", "analytics"],
        custom_fields: {
          framework: "apache-spark",
          scheduler: "airflow",
          data_sources: ["trading", "risk", "compliance"],
          output_formats: ["parquet", "avro"]
        }
      }
    ];
  }

  // Insert service components with proper error handling
  for (const comp of components) {
    try {
      await db.put("service_components", comp);

      // Create COMPLETE audit log entry matching AuditLogEntry interface
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "service_component",
        entity_id: comp.id,
        action: "create",
        description: `Service component created: ${comp.name} (${comp.type}) for ${comp.business_service_id} - ${comp.health_status} health`,
        timestamp: now,
        user_id: "system", // Required field
        tags: ["seed", "service_component", "create", comp.type],
        hash: await generateHash({
          entity_type: "service_component",
          entity_id: comp.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          component_name: comp.name,
          component_type: comp.type,
          category: comp.category,
          subcategory: comp.subcategory,
          status: comp.status,
          health_status: comp.health_status,
          priority: comp.priority,
          criticality_tier: comp.criticality_tier,
          business_service_id: comp.business_service_id,
          owner_team_id: comp.owner_team_id,
          availability_target: comp.availability_target,
          current_availability: comp.current_availability,
          performance_metrics: comp.performance_metrics,
          dependencies_count: comp.dependencies.length
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `Service component "${comp.name}" created (${comp.type}) with ${comp.health_status} health status`,
        storeName: "service_components", // Required field for dbClient compatibility
        recordId: comp.id, // Required field for dbClient compatibility  
        action: "create",
        userId: "system",
        metadata: {
          component_id: comp.id,
          component_name: comp.name,
          component_type: comp.type,
          category: comp.category,
          subcategory: comp.subcategory,
          status: comp.status,
          health_status: comp.health_status,
          criticality_tier: comp.criticality_tier,
          availability_metrics: {
            target: comp.availability_target,
            current: comp.current_availability,
            mtbf_hours: comp.mtbf_hours,
            mttr_minutes: comp.mttr_minutes
          },
          performance_snapshot: comp.performance_metrics,
          configuration_status: comp.configuration,
          maintenance_schedule: comp.maintenance,
          related_entities: [
            { type: "business_service", id: comp.business_service_id },
            { type: "team", id: comp.owner_team_id },
            ...(comp.parent_component_id ? [{ type: "service_component", id: comp.parent_component_id }] : []),
            ...comp.asset_ids.map((id: string) => ({ type: "asset", id })),
            ...comp.dependencies.map((id: string) => ({ type: "service_component", id }))
          ]
        }
      });

      console.log(`✅ Seeded service component: ${comp.id} - ${comp.name}`);
    } catch (error) {
      console.error(`❌ Failed to seed service component ${comp.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${components.length} service components for ${tenantId}`);
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