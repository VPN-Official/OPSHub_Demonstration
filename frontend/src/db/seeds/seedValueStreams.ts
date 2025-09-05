import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";
import { generateSecureId } from "../../utils/auditUtils";

export const seedValueStreams = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let streams: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    streams = [
      {
        id: `${tenantId}_vs01`,
        tenantId,
        name: "Enterprise Connectivity",
        description: "Provides secure, reliable network connectivity for enterprise workloads.",
        business_service_ids: [`${tenantId}_svc_network`],
        category: "infrastructure",
        subcategory: "network",
        priority: "critical",
        severity: "high",
        health_status: "green",
        status: "active",
        maturity_level: "optimizing",
        business_value: "high",
        complexity: "medium",
        owner_team_id: `${tenantId}_team_network`,
        stakeholders: ["Network Team", "Security Team", "Enterprise Users"],
        kpi_targets: {
          uptime: "99.9%",
          latency: "<50ms",
          throughput: ">1Gbps"
        },
        created_at: now,
        updated_at: now,
        tags: ["enterprise", "connectivity", "network", "infrastructure", "critical"],
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    streams = [
      {
        id: `${tenantId}_vs01`,
        tenantId,
        name: "Content Delivery",
        description: "Ensures low-latency live streaming and transcoding at scale.",
        business_service_ids: [`${tenantId}_svc_streaming`, `${tenantId}_svc_transcoding`],
        category: "media",
        subcategory: "streaming",
        priority: "high",
        severity: "medium",
        health_status: "yellow",
        status: "active",
        maturity_level: "defined",
        business_value: "very_high",
        complexity: "high",
        owner_team_id: `${tenantId}_team_sre`,
        stakeholders: ["SRE Team", "Media Operations", "Content Creators", "End Users"],
        kpi_targets: {
          latency: "<250ms",
          availability: "99.95%",
          transcoding_speed: "2x real-time"
        },
        created_at: now,
        updated_at: now,
        tags: ["content", "delivery", "streaming", "transcoding", "media"],
      },
    ];
  }

  if (tenantId === "tenant_cloud_morningstar") {
    streams = [
      {
        id: `${tenantId}_vs01`,
        tenantId,
        name: "Financial Insights",
        description: "Supports compliance, reporting, and advanced analytics for investors.",
        business_service_ids: [`${tenantId}_svc_fin_reporting`, `${tenantId}_svc_data_analytics`],
        category: "financial",
        subcategory: "analytics",
        priority: "critical",
        severity: "high",
        health_status: "red",
        status: "active",
        maturity_level: "managed",
        business_value: "critical",
        complexity: "very_high",
        owner_team_id: `${tenantId}_team_dataops`,
        stakeholders: ["Data Operations", "Financial Analysts", "Compliance Team", "Investors"],
        kpi_targets: {
          data_freshness: "<15min",
          report_accuracy: "99.99%",
          compliance_score: "100%"
        },
        created_at: now,
        updated_at: now,
        tags: ["financial", "insights", "analytics", "compliance", "reporting"],
      },
    ];
  }

  // Insert value streams with proper error handling
  for (const stream of streams) {
    try {
      await db.put("value_streams", stream);

      // Create COMPLETE audit log entry
      await db.put("audit_logs", {
        id: generateSecureId(),
        tenantId,
        entity_type: "value_stream",
        entity_id: stream.id,
        action: "create",
        description: `Value stream established: "${stream.name}" (${stream.category}/${stream.subcategory}) - Business Value: ${stream.business_value}`,
        timestamp: now,
        user_id: "system",
        tags: ["seed", "value_stream", "create", stream.category],
        hash: await generateHash({
          entity_type: "value_stream",
          entity_id: stream.id,
          action: "create",
          timestamp: now,
          tenantId
        }),
        metadata: {
          category: stream.category,
          subcategory: stream.subcategory,
          priority: stream.priority,
          severity: stream.severity,
          status: stream.status,
          maturity_level: stream.maturity_level,
          business_value: stream.business_value,
          complexity: stream.complexity,
          owner_team_id: stream.owner_team_id,
          service_count: stream.business_service_ids.length,
          stakeholder_count: stream.stakeholders.length,
          health_status: stream.health_status,
          kpi_targets: stream.kpi_targets
        }
      });

      // Create COMPLETE activity timeline entry
      await db.put("activity_timeline", {
        id: generateSecureId(),
        tenantId,
        timestamp: now,
        message: `Value stream "${stream.name}" established with ${stream.business_service_ids.length} services - Maturity: ${stream.maturity_level}`,
        storeName: "value_streams",
        recordId: stream.id,
        action: "create",
        userId: "system",
        metadata: {
          stream_id: stream.id,
          category: stream.category,
          subcategory: stream.subcategory,
          maturity_level: stream.maturity_level,
          business_value: stream.business_value,
          complexity: stream.complexity,
          owner_team_id: stream.owner_team_id,
          value_stream_details: {
            linked_services: stream.business_service_ids,
            stakeholders: stream.stakeholders,
            kpi_targets: stream.kpi_targets,
            maturity_progression: stream.maturity_level
          },
          related_entities: stream.business_service_ids.map((id: string) => ({
            type: "business_service",
            id
          }))
        }
      });

      console.log(`✅ Seeded value stream: ${stream.id} - ${stream.name}`);
    } catch (error) {
      console.error(`❌ Failed to seed value stream ${stream.id}:`, error);
      throw error;
    }
  }

  console.log(`✅ Completed seeding ${streams.length} value streams for ${tenantId}`);
};

// Helper function to generate audit hash
async function generateHash(data: any): Promise<string> {
  try {
    const { generateImmutableHash } = await import("../../utils/auditUtils");
    return await generateImmutableHash(data);
  } catch {
    // Fallback for seeding if utils not available
    return `seed_hash_${data.entity_id}_${Date.now()}`;
  }
}