import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedSystemMetrics = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let sysMetrics: any[] = [];

  sysMetrics = [
    {
      id: `${tenantId}_sys01`,
      tenantId,
      name: "Platform API Response Time",
      value: 180,
      unit: "ms",
      measured_at: now,
      tags: ["platform", "api"],
    },
    {
      id: `${tenantId}_sys02`,
      tenantId,
      name: "Agent Availability",
      value: 99.8,
      unit: "%",
      measured_at: now,
      tags: ["agents", "availability"],
    },
    {
      id: `${tenantId}_sys03`,
      tenantId,
      name: "Data Pipeline Throughput",
      value: 4500,
      unit: "records/sec",
      measured_at: now,
      tags: ["pipeline", "throughput"],
    },
  ];

  for (const metric of sysMetrics) {
    await db.put("system_metrics", metric);

    await db.put("audit_logs", {
      id: `${metric.id}_audit01`,
      tenantId,
      entity_type: "system_metric",
      entity_id: metric.id,
      action: "record",
      timestamp: now,
      immutable_hash: "hash_" + metric.id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${metric.id}_act01`,
      tenantId,
      type: "system_metric",
      entity_id: metric.id,
      action: "recorded",
      description: `System metric "${metric.name}" recorded at ${metric.value}${metric.unit}`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};