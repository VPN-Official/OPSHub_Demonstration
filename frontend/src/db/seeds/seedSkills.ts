import { IDBPDatabase } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

export const seedSkills = async (tenantId: string, db: IDBPDatabase<AIOpsDB>) => {
  const now = new Date().toISOString();
  let skills: any[] = [];

  if (tenantId === "tenant_dcn_meta") {
    skills = [
      {
        id: `${tenantId}_skills01`,
        tenantId: tenantId,
        name: "Skills Example 1",
        description: "Seeded Skills entity for DCN Meta.",
        created_at: now,
        updated_at: now,
        tags: ["meta", "skills"],
        health_status: "green",
      },
    ];
  }

  if (tenantId === "tenant_av_google") {
    skills = [
      {
        id: `${tenantId}_skills01`,
        tenantId: tenantId,
        name: "Skills Example 1",
        description: "Seeded Skills entity for AV Google.",
        created_at: now,
        updated_at: now,
        tags: ["google", "skills"],
        health_status: "yellow",
      },
    ];
  }

  if (tenantId === "tenant_sd_gates") {
    skills = [
      {
        id: `${tenantId}_skills01`,
        tenantId: tenantId,
        name: "Skills Example 1",
        description: "Seeded Skills entity for Gates Foundation.",
        created_at: now,
        updated_at: now,
        tags: ["gates", "skills"],
        health_status: "orange",
      },
    ];
  }

  for (const entity of skills) {
    await db.put("skills", entity);

    await db.put("audit_logs", {
      id: `${entity.id}_audit01`,
      tenantId: tenantId,
      entity_type: "skills",
      entity_id: entity.id,
      action: "create",
      timestamp: now,
      hash: "hash_" + id,
      tags: ["seed"],
    });

    await db.put("activities", {
      id: `${entity.id}_act01`,
      tenantId: tenantId,
      type: "skills",
      entity_id: entity.id,
      action: "created",
      description: `Skills "${entity.name}" seeded`,
      timestamp: now,
      related_entity_ids: [],
      tags: ["seed"],
    });
  }
};
