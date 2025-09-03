// Fix 1: src/db/seeds/seedIncidents.ts - FIXED field names
import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedIncidents = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();

  let incidents: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    incidents = [
      {
        id: `${tenantId}_inc01`,
        tenantId: tenantId, // FIXED: was tenant_id
        title: "Core Router Down in SJC-1",
        description: "Major backbone outage affecting traffic in US-West region.",
        status: "new",
        priority: "P1",
        impact: "critical",
        urgency: "high",
        created_at: now,
        updated_at: now,
        business_service_id: `${tenantId}_svc_network`,
        service_component_ids: [`${tenantId}_comp_router01`],
        asset_ids: [`${tenantId}_asset_router01`],
        related_alert_ids: [`${tenantId}_alert_router_cpu`],
        tags: ["network", "backbone", "critical"],
        health_status: "red",
        // Add missing fields to match context interfaces
        assignee_user_id: null,
        assignee_team_id: `${tenantId}_team_network`,
        reporter_user_id: `${tenantId}_user_system`,
        escalation_level: 0,
        sla_due_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour SLA
        first_response_at: null,
        resolved_at: null,
        closed_at: null,
        resolution_notes: null,
        customer_impact: "Multiple customers affected",
        external_reference: null,
        change_request_id: null,
        problem_id: null,
        parent_incident_id: null,
        child_incident_ids: [],
        related_change_ids: [],
        related_problem_ids: [],
        cost_impact: null,
        business_service_impact: "critical",
        communication_plan: null,
        escalation_history: [],
        timeline: [],
        attachments: [],
        custom_fields: {},
        sync_status: "clean",
        synced_at: now
      },
      {
        id: `${tenantId}_inc02`,
        tenantId: tenantId,
        title: "High Latency in DCN Fabric",
        description: "Packet drops detected in EU region, impacting inter-DC replication.",
        status: "in_progress",
        priority: "P2",
        impact: "high",
        urgency: "medium",
        created_at: now,
        updated_at: now,
        business_service_id: `${tenantId}_svc_network`,
        service_component_ids: [`${tenantId}_comp_switch01`],
        asset_ids: [`${tenantId}_asset_switch01`],
        related_alert_ids: [],
        tags: ["latency", "fabric"],
        health_status: "orange",
        // Add missing fields
        assignee_user_id: `${tenantId}_user_engineer1`,
        assignee_team_id: `${tenantId}_team_network`,
        reporter_user_id: `${tenantId}_user_monitor`,
        escalation_level: 0,
        sla_due_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hour SLA
        first_response_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
        resolved_at: null,
        closed_at: null,
        resolution_notes: null,
        customer_impact: "Some performance degradation",
        external_reference: null,
        change_request_id: null,
        problem_id: null,
        parent_incident_id: null,
        child_incident_ids: [],
        related_change_ids: [],
        related_problem_ids: [],
        cost_impact: null,
        business_service_impact: "medium",
        communication_plan: null,
        escalation_history: [],
        timeline: [],
        attachments: [],
        custom_fields: {},
        sync_status: "clean",
        synced_at: now
      }
    ];
  }

  // Similar fixes for other tenants...
  if (tenantId === "tenant_av_google") {
    incidents = [
      {
        id: `${tenantId}_inc01`,
        tenantId: tenantId,
        title: "YouTube Live Streaming Outage",
        description: "Streaming buffers >30s on EU region edge nodes.",
        status: "new",
        priority: "P1",
        impact: "critical",
        urgency: "high",
        created_at: now,
        updated_at: now,
        business_service_id: `${tenantId}_svc_streaming`,
        service_component_ids: [`${tenantId}_comp_edge01`],
        asset_ids: [`${tenantId}_asset_gce_vm01`],
        related_alert_ids: [`${tenantId}_alert_stream_latency`],
        tags: ["streaming", "latency", "p1"],
        health_status: "red",
        // Complete fields...
        assignee_user_id: null,
        assignee_team_id: `${tenantId}_team_sre`,
        reporter_user_id: `${tenantId}_user_monitoring`,
        escalation_level: 1,
        sla_due_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        first_response_at: null,
        resolved_at: null,
        closed_at: null,
        resolution_notes: null,
        customer_impact: "YouTube Live streams affected globally",
        external_reference: null,
        change_request_id: null,
        problem_id: null,
        parent_incident_id: null,
        child_incident_ids: [],
        related_change_ids: [],
        related_problem_ids: [],
        cost_impact: 250000, // $250k/hour revenue impact
        business_service_impact: "critical",
        communication_plan: "Public status page updated",
        escalation_history: [],
        timeline: [],
        attachments: [],
        custom_fields: { region: "EU", service: "YouTube Live" },
        sync_status: "clean",
        synced_at: now
      }
    ];
  }

  // Insert all incidents
  for (const inc of incidents) {
    await db.put("incidents", inc);

    // Audit log with correct field names
    await db.put("audit_logs", {
      id: `${inc.id}_audit01`,
      tenantId: tenantId, // FIXED: was tenant_id
      entity_type: "incident",
      entity_id: inc.id,
      action: "create",
      description: `Incident "${inc.title}" seeded`,
      timestamp: now,
      user_id: null,
      hash: "hash_" + inc.id, // FIXED: was immutable_hash
      tags: ["seed"],
      metadata: { seeded: true }
    });

    // Activity timeline with correct field names  
    await db.put("activities", {
      id: `${inc.id}_act01`,
      tenantId: tenantId, // FIXED: was tenant_id
      storeName: "incidents", // FIXED: was type
      recordId: inc.id, // FIXED: was entity_id
      action: "created",
      message: `Incident "${inc.title}" seeded`, // FIXED: was description
      timestamp: now,
      user_id: null,
      tags: ["seed"],
      metadata: { seeded: true }
    });
  }

  console.log(`✅ Seeded ${incidents.length} incidents for ${tenantId}`);
};

// Fix 2: Incident Context Interface alignment
// src/contexts/IncidentsContext.tsx - Interface should match seed data
export interface Incident {
  id: string;
  tenantId: string; // FIXED: consistent naming
  title: string;
  description: string;
  status: string;
  priority: string;
  impact: string;
  urgency: string;
  created_at: string;
  updated_at: string;

  // Assignment & ownership
  assignee_user_id?: string | null;
  assignee_team_id?: string | null;
  reporter_user_id?: string | null;
  
  // SLA & timing
  sla_due_at?: string | null;
  first_response_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  
  // Business relationships
  business_service_id?: string | null;
  service_component_ids: string[];
  asset_ids: string[];
  customer_id?: string | null;
  
  // Related entities
  related_alert_ids: string[];
  related_change_ids: string[];
  related_problem_ids: string[];
  child_incident_ids: string[];
  parent_incident_id?: string | null;
  
  // Resolution & impact
  resolution_notes?: string | null;
  customer_impact?: string | null;
  cost_impact?: number | null;
  business_service_impact?: string;
  
  // Escalation
  escalation_level: number;
  escalation_history: any[];
  
  // Communication
  communication_plan?: string | null;
  external_reference?: string | null;
  
  // Audit trail
  timeline: any[];
  attachments: any[];
  
  // Metadata
  tags: string[];
  custom_fields: Record<string, any>;
  health_status: "green" | "yellow" | "orange" | "red" | "gray";
  sync_status?: "clean" | "dirty" | "conflict";
  synced_at?: string;
}

// Fix 3: Database client interfaces should match
// src/db/dbClient.ts - Fix audit log interface
export interface AuditLogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  description: string;
  timestamp: string;
  user_id: string | null;
  tags: string[];
  hash: string; // FIXED: consistent naming
  tenantId: string; // FIXED: consistent naming
  metadata?: Record<string, any>;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  tenantId: string; // FIXED: consistent naming
  message: string; // FIXED: consistent naming
  storeName: string; // FIXED: consistent naming  
  recordId: string; // FIXED: consistent naming
  action: "create" | "update" | "delete";
  user_id?: string;
  metadata?: Record<string, any>;
  tags: string[];
}