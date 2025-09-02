import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedBusinessServices = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  let services: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    services = [
      {
        id: `${tenantId}_svc_network`,
        tenant_id: tenantId,
        name: "Global DCN Service",
        description: "Backbone networking service for Meta DCs.",
        tier: "gold",
        created_at: now,
        updated_at: now,
        value_stream_id: `${tenantId}_vs01`,
        service_component_ids: [],
        customer_ids: [],
        contract_ids: [],
        cost_center_ids: [],
        enterprise_kpi_ids: [],
        custom_kpis: [],
        sla_target_uptime: 99.99,
        tags: ["network", "meta"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    services = [
      {
        id: `${tenantId}_svc_streaming`,
        tenant_id: tenantId,
        name: "YouTube Streaming",
        description: "End-to-end live video streaming.",
        tier: "gold",
        created_at: now,
        updated_at: now,
        value_stream_id: `${tenantId}_vs01`,
        service_component_ids: [],
        customer_ids: [],
        contract_ids: [],
        cost_center_ids: [],
        enterprise_kpi_ids: [],
        custom_kpis: [],
        sla_target_uptime: 99.95,
        tags: ["youtube", "streaming"],
        health_status: "red",
      },
      {
        id: `${tenantId}_svc_transcoding`,
        tenant_id: tenantId,
        name: "Video Transcoding",
        description: "Cloud-based video transcoding workloads.",
        tier: "silver",
        created_at: now,
        updated_at: now,
        value_stream_id: `${tenantId}_vs01`,
        service_component_ids: [],
        customer_ids: [],
        contract_ids: [],
        cost_center_ids: [],
        enterprise_kpi_ids: [],
        custom_kpis: [],
        sla_target_uptime: 99.9,
        tags: ["transcoding", "video"],
        health_status: "orange",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    services = [
      {
        id: `${tenantId}_svc_email`,
        tenant_id: tenantId,
        name: "Email Service",
        description: "Microsoft Exchange based email service.",
        tier: "gold",
        created_at: now,
        updated_at: now,
        value_stream_id: `${tenantId}_vs01`,
        service_component_ids: [],
        customer_ids: [],
        contract_ids: [],
        cost_center_ids: [],
        enterprise_kpi_ids: [],
        custom_kpis: [],
        sla_target_uptime: 99.9,
        tags: ["email", "exchange"],
        health_status: "red",
      },
      {
        id: `${tenantId}_svc_vpn`,
        tenant_id: tenantId,
        name: "VPN Service",
        description: "Secure VPN connectivity for remote staff.",
        tier: "silver",
        created_at: now,
        updated_at: now,
        value_stream_id: `${tenantId}_vs01`,
        service_component_ids: [],
        customer_ids: [],
        contract_ids: [],
        cost_center_ids: [],
        enterprise_kpi_ids: [],
        custom_kpis: [],
        sla_target_uptime: 99.5,
        tags: ["vpn"],
        health_status: "orange",
      },
      {
        id: `${tenantId}_svc_hr_portal`,
        tenant_id: tenantId,
        name: "HR Portal",
        description: "Employee HR and payroll portal.",
        tier: "bronze",
        created_at: now,
        updated_at: now,
        value_stream_id: `${tenantId}_vs01`,
        service_component_ids: [],
        customer_ids: [],
        contract_ids: [],
        cost_center_ids: [],
        enterprise_kpi_ids: [],
        custom_kpis: [],
        sla_target_uptime: 99,
        tags: ["hr", "portal"],
        health_status: "yellow",
      },
      {
        id: `${tenantId}_svc_sharepoint`,
        tenant_id: tenantId,
        name: "Collaboration Service",
        description: "SharePoint collaboration platform.",
        tier: "silver",
        created_at: now,
        updated_at: now,
        value_stream_id: `${tenantId}_vs01`,
        service_component_ids: [],
        customer_ids: [],
        contract_ids: [],
        cost_center_ids: [],
        enterprise_kpi_ids: [],
        custom_kpis: [],
        sla_target_uptime: 99.5,
        tags: ["sharepoint", "collab"],
        health_status: "green",
      },
    ];
  }

  for (const svc of services) {
    await db.put("business_services", svc);

    await db.put("audit_logs", {
      id: `${svc.id}_audit01`,
      tenant_id: tenantId,
      entity_type: "business_service",
      entity_id: svc.id,
      action: "create",
      timestamp: now,
      immutable_hash: "hash_" + svc.id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${svc.id}_act01`,
      tenant_id: tenantId,
      type: "business_service",
      entity_id: svc.id,
      action: "created",
      description: `Business Service "${svc.name}" seeded`,
      timestamp: now,
      related_entity_ids: [{ type: "value_stream", id: svc.value_stream_id }],
      tags: ["seed"],
    });
  }
};