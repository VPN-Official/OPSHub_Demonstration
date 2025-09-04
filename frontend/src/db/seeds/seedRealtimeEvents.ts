// src/db/seeds/seedRealtimeEvents.ts
import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedRealtimeEvents = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  const realtimeEvents: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    realtimeEvents.push(
      // Entity Updates
      {
        id: `${tenantId}_rte001`,
        tenantId,
        type: "entity_update",
        category: "incident",
        entityId: `${tenantId}_inc01`,
        entityType: "incident",
        data: {
          field: "status",
          oldValue: "open",
          newValue: "investigating",
          updatedBy: `${tenantId}_user_netops01`
        },
        timestamp: now,
        source: "websocket",
        processed: true
      },
      {
        id: `${tenantId}_rte002`,
        tenantId,
        type: "entity_update", 
        category: "asset",
        entityId: `${tenantId}_asset_router01`,
        entityType: "asset",
        data: {
          field: "health_status",
          oldValue: "green",
          newValue: "red",
          reason: "BGP peer connectivity lost"
        },
        timestamp: now,
        source: "monitoring",
        processed: true
      },
      
      // Metric Updates
      {
        id: `${tenantId}_rte003`,
        tenantId,
        type: "metric_update",
        category: "performance",
        entityId: `${tenantId}_asset_exchange01`,
        entityType: "asset",
        metricName: "disk_usage",
        value: 95,
        unit: "percent",
        threshold: 90,
        status: "critical",
        timestamp: now,
        source: "prometheus"
      },
      {
        id: `${tenantId}_rte004`,
        tenantId,
        type: "metric_update",
        category: "availability",
        entityId: `${tenantId}_svc_internet`,
        entityType: "business_service",
        metricName: "uptime",
        value: 99.95,
        unit: "percent",
        threshold: 99.9,
        status: "healthy",
        timestamp: now,
        source: "synthetic_monitoring"
      },
      
      // Status Updates
      {
        id: `${tenantId}_rte005`,
        tenantId,
        type: "status_update",
        category: "connectivity",
        entityId: `${tenantId}_asset_router01`,
        entityType: "asset",
        previousStatus: "online",
        currentStatus: "degraded",
        reason: "Primary BGP peer down, running on backup",
        severity: "warning",
        timestamp: now
      },
      
      // Alert Triggered
      {
        id: `${tenantId}_rte006`,
        tenantId,
        type: "alert_triggered",
        category: "threshold",
        entityId: `${tenantId}_asset_db01`,
        entityType: "asset",
        alertName: "High Query Response Time",
        condition: "avg_response_time > 500ms",
        currentValue: "750ms",
        severity: "warning",
        timestamp: now,
        autoResolve: true,
        ttl: 3600
      }
    );
  } else if (tenantId === "tenant_aws_financial") {
    realtimeEvents.push(
      {
        id: `${tenantId}_rte001`,
        tenantId,
        type: "entity_update",
        category: "change_request",
        entityId: `${tenantId}_chr001`,
        entityType: "change_request",
        data: {
          field: "approval_status",
          oldValue: "pending",
          newValue: "approved",
          approvedBy: `${tenantId}_user_cab01`
        },
        timestamp: now,
        source: "workflow",
        processed: true
      },
      {
        id: `${tenantId}_rte002`,
        tenantId,
        type: "metric_update",
        category: "cost",
        entityId: `${tenantId}_svc_trading`,
        entityType: "business_service",
        metricName: "hourly_cost",
        value: 1250.50,
        unit: "usd",
        threshold: 1500,
        status: "normal",
        timestamp: now,
        source: "cost_management"
      },
      {
        id: `${tenantId}_rte003`,
        tenantId,
        type: "status_update",
        category: "deployment",
        entityId: `${tenantId}_deploy001`,
        entityType: "deployment",
        previousStatus: "in_progress",
        currentStatus: "completed",
        reason: "Successfully deployed to production",
        severity: "info",
        timestamp: now
      }
    );
  } else if (tenantId === "tenant_ecommerce") {
    realtimeEvents.push(
      {
        id: `${tenantId}_rte001`,
        tenantId,
        type: "metric_update",
        category: "business",
        entityId: `${tenantId}_svc_checkout`,
        entityType: "business_service",
        metricName: "transactions_per_minute",
        value: 450,
        unit: "tpm",
        threshold: 500,
        status: "normal",
        timestamp: now,
        source: "application_metrics"
      },
      {
        id: `${tenantId}_rte002`,
        tenantId,
        type: "entity_update",
        category: "incident",
        entityId: `${tenantId}_inc003`,
        entityType: "incident",
        data: {
          field: "status",
          oldValue: "investigating",
          newValue: "resolved",
          resolution: "Increased cache size to handle traffic spike"
        },
        timestamp: now,
        source: "automation",
        processed: true
      }
    );
  }

  // Store realtime events
  for (const event of realtimeEvents) {
    await db.put("realtimeEvents", event);
  }

  console.log(`Seeded ${realtimeEvents.length} realtime events for ${tenantId}`);
  return realtimeEvents;
};