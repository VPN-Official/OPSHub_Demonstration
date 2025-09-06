// src/db/seeds/seedAssets.ts - FULLY CORRECTED
import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";
import { addExternalSystemFieldsBatch } from "./externalSystemHelpers";

export const seedAssets = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let assets: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    assets = [
      {
        id: `${tenantId}_asset_router01`,
        tenantId,
        name: "Router R1",
        type: "router",
        manufacturer: "Cisco", // Added manufacturer
        model: "ISR-4431", // Added model
        serial_number: "FCW2247D0TN", // Added serial number
        location: "DCN Meta DC1",
        rack_position: "R1-U14", // Added rack position
        service_component_id: `${tenantId}_comp_router01`,
        status: "active",
        priority: "critical", // Added priority
        category: "network", // Added category
        subcategory: "routing", // Added subcategory
        health_status: "yellow", // Added health status - yellow due to CPU issues
        created_at: now,
        updated_at: now,
        commissioned_date: "2021-03-15T00:00:00Z", // Added commission date
        warranty_expiry: "2025-03-15T00:00:00Z", // Added warranty
        lifecycle_stage: "production", // Added lifecycle
        criticality_tier: "tier_1", // Added criticality
        maintenance_window: "sunday_02:00_06:00", // Added maintenance window
        owner_team_id: `${tenantId}_team_network`, // Added owner team
        backup_power: true, // Added backup power
        environmental_requirements: {
          temperature_max: 35,
          humidity_max: 80,
          power_consumption_watts: 350
        },
        network_config: {
          management_ip: "192.168.1.1",
          interfaces_count: 8,
          routing_protocols: ["OSPF", "BGP"],
          firmware_version: "16.09.04"
        },
        tags: ["router", "cisco", "critical", "network"],
        custom_fields: {
          cpu_utilization_threshold: 90,
          memory_gb: 8,
          storage_gb: 16,
          uptime_sla: "99.95%"
        }
      },
      {
        id: `${tenantId}_asset_switch01`,
        tenantId,
        name: "Switch S1",
        type: "switch",
        manufacturer: "Cisco",
        model: "Catalyst-3750X",
        serial_number: "FDO1728R0DN",
        location: "DCN Meta DC1",
        rack_position: "R1-U12",
        service_component_id: `${tenantId}_comp_switch01`,
        status: "active",
        priority: "high",
        category: "network",
        subcategory: "switching",
        health_status: "red", // Red due to packet loss issues
        created_at: now,
        updated_at: now,
        commissioned_date: "2020-11-20T00:00:00Z",
        warranty_expiry: "2024-11-20T00:00:00Z",
        lifecycle_stage: "end_of_support", // Needs replacement
        criticality_tier: "tier_1",
        maintenance_window: "sunday_02:00_06:00",
        owner_team_id: `${tenantId}_team_network`,
        backup_power: true,
        environmental_requirements: {
          temperature_max: 45,
          humidity_max: 85,
          power_consumption_watts: 280
        },
        network_config: {
          management_ip: "192.168.1.2",
          interfaces_count: 48,
          vlan_support: true,
          firmware_version: "15.2.4E10"
        },
        tags: ["switch", "cisco", "replacement_needed", "packet_loss"],
        custom_fields: {
          port_error_threshold: 0.1,
          spanning_tree_enabled: true,
          port_security_enabled: true,
          replacement_scheduled: true
        }
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    assets = [
      {
        id: `${tenantId}_asset_gce_vm01`,
        tenantId,
        name: "Edge VM EU1",
        type: "gce_vm",
        manufacturer: "Google",
        model: "n1-highmem-4",
        serial_number: "GCE-EU1-VM001",
        location: "Belgium Region",
        zone: "europe-west1-b", // Added zone
        service_component_id: `${tenantId}_comp_edge01`,
        status: "active",
        priority: "critical",
        category: "compute",
        subcategory: "virtual_machine",
        health_status: "green",
        created_at: now,
        updated_at: now,
        commissioned_date: "2022-08-10T00:00:00Z",
        warranty_expiry: null, // Cloud resources don't have traditional warranty
        lifecycle_stage: "production",
        criticality_tier: "tier_1",
        maintenance_window: "tuesday_03:00_05:00",
        owner_team_id: `${tenantId}_team_sre`,
        backup_power: true, // GCP provides redundancy
        environmental_requirements: {
          // Cloud provider managed
          redundancy_zones: 3,
          auto_scaling: true
        },
        compute_config: {
          vcpu_count: 4,
          memory_gb: 26,
          disk_gb: 100,
          os_type: "Ubuntu 20.04 LTS",
          network_tier: "premium"
        },
        tags: ["gce", "vm", "edge", "streaming"],
        custom_fields: {
          instance_template: "edge-streaming-v2",
          auto_scaling_enabled: true,
          preemptible: false,
          sla_target: "99.99%"
        }
      },
      {
        id: `${tenantId}_asset_gke_node01`,
        tenantId,
        name: "GKE Node n1",
        type: "gke_node",
        manufacturer: "Google",
        model: "n1-standard-8",
        serial_number: "GKE-EU1-N001",
        location: "Belgium Region",
        zone: "europe-west1-b",
        service_component_id: `${tenantId}_comp_gke_cluster01`,
        status: "active",
        priority: "high",
        category: "container",
        subcategory: "kubernetes_node",
        health_status: "green",
        created_at: now,
        updated_at: now,
        commissioned_date: "2022-09-15T00:00:00Z",
        warranty_expiry: null,
        lifecycle_stage: "production",
        criticality_tier: "tier_1",
        maintenance_window: "saturday_01:00_04:00",
        owner_team_id: `${tenantId}_team_mediaops`,
        backup_power: true,
        environmental_requirements: {
          cluster_redundancy: true,
          node_auto_repair: true,
          node_auto_upgrade: true
        },
        compute_config: {
          vcpu_count: 8,
          memory_gb: 30,
          disk_gb: 100,
          kubernetes_version: "1.24.8-gke.2000",
          container_runtime: "containerd"
        },
        tags: ["gke", "node", "kubernetes", "transcoding"],
        custom_fields: {
          node_pool: "transcoding-pool",
          pod_capacity: 110,
          taints_applied: false,
          workload_type: "media_processing"
        }
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    assets = [
      {
        id: `${tenantId}_asset_db01`,
        tenantId,
        name: "Reporting DB Primary",
        type: "postgresql_instance",
        manufacturer: "AWS",
        model: "db.r5.2xlarge",
        serial_number: "RDS-US-EAST-DB01",
        location: "AWS us-east-1",
        availability_zone: "us-east-1a", // Added AZ
        service_component_id: `${tenantId}_comp_reportingdb`,
        status: "active",
        priority: "critical",
        category: "database",
        subcategory: "postgresql",
        health_status: "yellow", // Yellow due to replication lag
        created_at: now,
        updated_at: now,
        commissioned_date: "2021-06-01T00:00:00Z",
        warranty_expiry: null, // Managed service
        lifecycle_stage: "production",
        criticality_tier: "tier_1",
        maintenance_window: "sunday_06:00_10:00",
        owner_team_id: `${tenantId}_team_dba`,
        backup_power: true, // AWS managed
        environmental_requirements: {
          multi_az: true,
          backup_retention_days: 30,
          encryption_enabled: true
        },
        database_config: {
          engine: "postgresql",
          version: "13.7",
          vcpu_count: 8,
          memory_gb: 64,
          storage_gb: 500,
          storage_type: "gp2",
          iops: 3000
        },
        tags: ["postgresql", "rds", "reporting", "primary"],
        custom_fields: {
          read_replicas: 2,
          replication_lag_threshold_minutes: 30,
          current_replication_lag_minutes: 42,
          backup_schedule: "every_4_hours"
        }
      },
      {
        id: `${tenantId}_asset_etl01`,
        tenantId,
        name: "ETL Worker Cluster",
        type: "spark_cluster",
        manufacturer: "AWS",
        model: "EMR-6.4.0",
        serial_number: "EMR-US-EAST-ETL01",
        location: "AWS us-east-1",
        availability_zone: "us-east-1c",
        service_component_id: `${tenantId}_comp_datalake01`,
        status: "active",
        priority: "high",
        category: "analytics",
        subcategory: "etl_processing",
        health_status: "orange", // Orange due to job failures
        created_at: now,
        updated_at: now,
        commissioned_date: "2021-09-12T00:00:00Z",
        warranty_expiry: null,
        lifecycle_stage: "production",
        criticality_tier: "tier_2",
        maintenance_window: "saturday_04:00_07:00",
        owner_team_id: `${tenantId}_team_dataops`,
        backup_power: true,
        environmental_requirements: {
          auto_scaling: true,
          spot_instance_support: true,
          cluster_logging: true
        },
        compute_config: {
          master_instance_type: "m5.xlarge",
          core_instance_type: "m5.2xlarge",
          task_instance_type: "m5.xlarge",
          cluster_size_min: 3,
          cluster_size_max: 20,
          spark_version: "3.3.1",
          hadoop_version: "3.2.1"
        },
        tags: ["spark", "emr", "etl", "data_processing"],
        custom_fields: {
          job_success_rate: 77, // Currently 77% due to issues
          target_success_rate: 99.5,
          avg_job_duration_minutes: 45,
          data_sources_supported: 47
        }
      },
    ];
  }

  // Add external system fields to all assets
  assets = addExternalSystemFieldsBatch(assets, 'asset', tenantId);

  // Insert assets with proper error handling
  for (const asset of assets) {
    try {
      await db.put("assets", asset);

      // Create COMPLETE audit log entry matching AuditLogEntry interface
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "asset",
        entity_id: asset.id,
        action: "create",
        description: `Asset created: ${asset.name} (${asset.type}) ${asset.manufacturer} ${asset.model} at ${asset.location}`,
        timestamp: now,
        user_id: "system", // Required field - using system for asset creation
        tags: ["seed", "asset", "created"],
        hash: await generateHash({
          entity_type: "asset",
          entity_id: asset.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          name: asset.name,
          type: asset.type,
          manufacturer: asset.manufacturer,
          model: asset.model,
          location: asset.location,
          status: asset.status,
          priority: asset.priority,
          category: asset.category,
          health_status: asset.health_status,
          service_component_id: asset.service_component_id,
          owner_team_id: asset.owner_team_id,
          criticality_tier: asset.criticality_tier,
          lifecycle_stage: asset.lifecycle_stage
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `Asset "${asset.name}" (${asset.manufacturer} ${asset.model}) deployed at ${asset.location}`,
        storeName: "assets", // Required field for dbClient compatibility
        recordId: asset.id, // Required field for dbClient compatibility  
        action: "create",
        userId: "system", // System creates assets during seeding
        metadata: {
          asset_id: asset.id,
          name: asset.name,
          type: asset.type,
          manufacturer: asset.manufacturer,
          model: asset.model,
          location: asset.location,
          deployment_info: {
            commissioned_date: asset.commissioned_date,
            lifecycle_stage: asset.lifecycle_stage,
            criticality_tier: asset.criticality_tier
          },
          health_status: asset.health_status,
          technical_specs: asset.compute_config || asset.network_config || asset.database_config,
          related_entities: [
            { type: "service_component", id: asset.service_component_id },
            { type: "team", id: asset.owner_team_id }
          ]
        }
      });

      console.log(`✅ Seeded asset: ${asset.id} - ${asset.name} (${asset.type})`);
    } catch (error) {
      console.error(`❌ Failed to seed asset ${asset.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${assets.length} assets for ${tenantId}`);
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