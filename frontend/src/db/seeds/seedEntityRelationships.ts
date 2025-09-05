// src/db/seeds/seedEntityRelationships.ts
import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedEntityRelationships = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  const relationships: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    relationships.push(
      // Service to Component relationships
      {
        id: `${tenantId}_rel001`,
        tenantId,
        sourceType: "business_service",
        sourceId: `${tenantId}_svc_internet`,
        targetType: "service_component",
        targetId: `${tenantId}_comp_bgp_gateway`,
        relationshipType: "depends_on",
        strength: 1.0,
        bidirectional: false,
        metadata: {
          criticality: "high",
          sla_impact: true,
          failover_available: true
        },
        created_at: now,
        updated_at: now
      },
      {
        id: `${tenantId}_rel002`,
        tenantId,
        sourceType: "business_service",
        sourceId: `${tenantId}_svc_email`,
        targetType: "service_component",
        targetId: `${tenantId}_comp_exchange01`,
        relationshipType: "depends_on",
        strength: 1.0,
        bidirectional: false,
        metadata: {
          criticality: "high",
          sla_impact: true,
          users_impacted: 5000
        },
        created_at: now,
        updated_at: now
      },
      
      // Component to Asset relationships
      {
        id: `${tenantId}_rel003`,
        tenantId,
        sourceType: "service_component",
        sourceId: `${tenantId}_comp_bgp_gateway`,
        targetType: "asset",
        targetId: `${tenantId}_asset_router01`,
        relationshipType: "runs_on",
        strength: 0.8,
        bidirectional: false,
        metadata: {
          allocation: "primary",
          redundancy: "active-passive"
        },
        created_at: now,
        updated_at: now
      },
      {
        id: `${tenantId}_rel004`,
        tenantId,
        sourceType: "service_component",
        sourceId: `${tenantId}_comp_exchange01`,
        targetType: "asset",
        targetId: `${tenantId}_asset_exchange01`,
        relationshipType: "runs_on",
        strength: 1.0,
        bidirectional: false,
        metadata: {
          allocation: "dedicated",
          resource_usage: "high"
        },
        created_at: now,
        updated_at: now
      },
      
      // Incident to Asset relationships
      {
        id: `${tenantId}_rel005`,
        tenantId,
        sourceType: "incident",
        sourceId: `${tenantId}_inc01`,
        targetType: "asset",
        targetId: `${tenantId}_asset_router01`,
        relationshipType: "affects",
        strength: 1.0,
        bidirectional: false,
        metadata: {
          impact_type: "connectivity",
          resolution_required: true
        },
        created_at: now,
        updated_at: now
      },
      
      // Team to Service relationships
      {
        id: `${tenantId}_rel006`,
        tenantId,
        sourceType: "team",
        sourceId: `${tenantId}_team_network`,
        targetType: "business_service",
        targetId: `${tenantId}_svc_internet`,
        relationshipType: "manages",
        strength: 0.9,
        bidirectional: false,
        metadata: {
          responsibility: "primary",
          escalation_level: 1
        },
        created_at: now,
        updated_at: now
      },
      
      // Asset to Asset relationships (redundancy)
      {
        id: `${tenantId}_rel007`,
        tenantId,
        sourceType: "asset",
        sourceId: `${tenantId}_asset_router01`,
        targetType: "asset",
        targetId: `${tenantId}_asset_router02`,
        relationshipType: "failover_to",
        strength: 0.7,
        bidirectional: true,
        metadata: {
          failover_type: "automatic",
          failover_time_seconds: 30,
          priority: "primary-backup"
        },
        created_at: now,
        updated_at: now
      }
    );
  } else if (tenantId === "tenant_aws_financial") {
    relationships.push(
      {
        id: `${tenantId}_rel001`,
        tenantId,
        sourceType: "business_service",
        sourceId: `${tenantId}_svc_trading`,
        targetType: "service_component",
        targetId: `${tenantId}_comp_trading_engine`,
        relationshipType: "depends_on",
        strength: 1.0,
        bidirectional: false,
        metadata: {
          criticality: "critical",
          latency_sensitive: true,
          rto_minutes: 5
        },
        created_at: now,
        updated_at: now
      },
      {
        id: `${tenantId}_rel002`,
        tenantId,
        sourceType: "service_component",
        sourceId: `${tenantId}_comp_trading_engine`,
        targetType: "asset",
        targetId: `${tenantId}_asset_ec2_trading01`,
        relationshipType: "runs_on",
        strength: 0.5,
        bidirectional: false,
        metadata: {
          instance_type: "m5.24xlarge",
          auto_scaling: true,
          region: "us-east-1"
        },
        created_at: now,
        updated_at: now
      },
      {
        id: `${tenantId}_rel003`,
        tenantId,
        sourceType: "business_service",
        sourceId: `${tenantId}_svc_trading`,
        targetType: "business_service",
        targetId: `${tenantId}_svc_market_data`,
        relationshipType: "depends_on",
        strength: 0.9,
        bidirectional: false,
        metadata: {
          data_flow: "real-time",
          protocol: "FIX",
          bandwidth_mbps: 1000
        },
        created_at: now,
        updated_at: now
      }
    );
  } else if (tenantId === "tenant_ecommerce") {
    relationships.push(
      {
        id: `${tenantId}_rel001`,
        tenantId,
        sourceType: "business_service",
        sourceId: `${tenantId}_svc_checkout`,
        targetType: "service_component",
        targetId: `${tenantId}_comp_payment_gateway`,
        relationshipType: "depends_on",
        strength: 1.0,
        bidirectional: false,
        metadata: {
          transaction_flow: true,
          pci_compliant: true,
          timeout_seconds: 30
        },
        created_at: now,
        updated_at: now
      },
      {
        id: `${tenantId}_rel002`,
        tenantId,
        sourceType: "business_service",
        sourceId: `${tenantId}_svc_checkout`,
        targetType: "service_component",
        targetId: `${tenantId}_comp_inventory`,
        relationshipType: "depends_on",
        strength: 0.8,
        bidirectional: false,
        metadata: {
          check_type: "real-time",
          cache_enabled: true,
          fallback_behavior: "queue"
        },
        created_at: now,
        updated_at: now
      },
      {
        id: `${tenantId}_rel003`,
        tenantId,
        sourceType: "service_component",
        sourceId: `${tenantId}_comp_cdn`,
        targetType: "business_service",
        targetId: `${tenantId}_svc_website`,
        relationshipType: "accelerates",
        strength: 0.6,
        bidirectional: false,
        metadata: {
          cdn_provider: "cloudflare",
          cache_hit_ratio: 0.85,
          edge_locations: 200
        },
        created_at: now,
        updated_at: now
      }
    );
  }

  // Navigation contexts and breadcrumbs
  const navigationContexts = [
    {
      id: `${tenantId}_nav001`,
      tenantId,
      entityType: "incident",
      entityId: `${tenantId}_inc01`,
      breadcrumbs: [
        { type: "business_service", id: `${tenantId}_svc_internet`, label: "Internet Connectivity" },
        { type: "service_component", id: `${tenantId}_comp_bgp_gateway`, label: "BGP Gateway" },
        { type: "asset", id: `${tenantId}_asset_router01`, label: "Core Router 01" },
        { type: "incident", id: `${tenantId}_inc01`, label: "BGP Peering Down" }
      ],
      currentPath: "/services/internet/components/bgp/assets/router01/incidents/inc01",
      visitedAt: now,
      userId: `${tenantId}_user_netops01`
    }
  ];

  // Store relationships
  for (const rel of relationships) {
    await db.put("entityRelationships", rel);
  }

  // Store navigation contexts
  for (const nav of navigationContexts) {
    await db.put("navigationContexts", nav);
  }

  console.log(`Seeded ${relationships.length} entity relationships and ${navigationContexts.length} navigation contexts for ${tenantId}`);
  return { relationships, navigationContexts };
};