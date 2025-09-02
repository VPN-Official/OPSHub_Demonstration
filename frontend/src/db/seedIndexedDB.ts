import { openDB, DBSchema, IDBPDatabase } from "idb";

// ---------------------------------
// 1. DB Schema
// ---------------------------------
export interface AIOpsDB extends DBSchema {
  // Work family
  incidents: any;
  problems: any;
  change_requests: any;
  service_requests: any;
  maintenances: any;
  alerts: any;

  // MELT family
  metrics: any;
  logs: any;
  events: any;
  traces: any;

  // Business family
  value_streams: any;
  business_services: any;
  service_components: any;
  assets: any;
  customers: any;
  vendors: any;
  contracts: any;
  cost_centers: any;

  // Governance family
  risks: any;
  compliance: any;
  kpis: any;
  knowledge_base: any;
  runbooks: any;
  automation_rules: any;
  ai_agents: any;

  // Cross-cutting
  audit_logs: any;
  activities: any;
}

// ---------------------------------
// 2. Init DB
// ---------------------------------
export const initDB = async (): Promise<IDBPDatabase<AIOpsDB>> => {
  return openDB<AIOpsDB>("aiops-db", 1, {
    upgrade(db) {
      const stores: (keyof AIOpsDB)[] = [
        "incidents",
        "problems",
        "change_requests",
        "service_requests",
        "maintenances",
        "alerts",
        "metrics",
        "logs",
        "events",
        "traces",
        "value_streams",
        "business_services",
        "service_components",
        "assets",
        "customers",
        "vendors",
        "contracts",
        "cost_centers",
        "risks",
        "compliance",
        "kpis",
        "knowledge_base",
        "runbooks",
        "automation_rules",
        "ai_agents",
        "audit_logs",
        "activities",
      ];
      for (const store of stores) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: "id" });
        }
      }
    },
  });
};

// ---------------------------------
// 3. Seeder Imports
// ---------------------------------
import { seedIncidents } from "./seeds/seedIncidents";
import { seedProblems } from "./seeds/seedProblems";
import { seedChangeRequests } from "./seeds/seedChangeRequests";
import { seedServiceRequests } from "./seeds/seedServiceRequests";
import { seedMaintenances } from "./seeds/seedMaintenances";
import { seedAlerts } from "./seeds/seedAlerts";

import { seedMetrics } from "./seeds/seedMetrics";
import { seedLogs } from "./seeds/seedLogs";
import { seedEvents } from "./seeds/seedEvents";
import { seedTraces } from "./seeds/seedTraces";

import { seedValueStreams } from "./seeds/seedValueStreams";
import { seedBusinessServices } from "./seeds/seedBusinessServices";
import { seedServiceComponents } from "./seeds/seedServiceComponents";
import { seedAssets } from "./seeds/seedAssets";
import { seedCustomers } from "./seeds/seedCustomers";
import { seedVendors } from "./seeds/seedVendors";
import { seedContracts } from "./seeds/seedContracts";
import { seedCostCenters } from "./seeds/seedCostCenters";

import { seedRisks } from "./seeds/seedRisks";
import { seedCompliance } from "./seeds/seedCompliance";
import { seedKpis } from "./seeds/seedKpis";
import { seedKnowledgeBase } from "./seeds/seedKnowledgeBase";
import { seedRunbooks } from "./seeds/seedRunbooks";
import { seedAutomationRules } from "./seeds/seedAutomationRules";
import { seedAiAgents } from "./seeds/seedAiAgents";

// NEW cross-cutting
import { seedAuditLogs } from "./seeds/seedAuditLogs";
import { seedActivities } from "./seeds/seedActivities";

// ---------------------------------
// 4. Orchestrator
// ---------------------------------
const TENANTS = ["tenant_dcn_meta", "tenant_av_google", "tenant_sd_gates"];

export const seedIndexedDB = async () => {
  const db = await initDB();

  for (const tenantId of TENANTS) {
    console.log(`🌱 Seeding tenant: ${tenantId}`);

    // Business first (foundation)
    await seedValueStreams(tenantId, db);
    await seedBusinessServices(tenantId, db);
    await seedServiceComponents(tenantId, db);
    await seedAssets(tenantId, db);
    await seedCustomers(tenantId, db);
    await seedVendors(tenantId, db);
    await seedContracts(tenantId, db);
    await seedCostCenters(tenantId, db);

    // Governance
    await seedRisks(tenantId, db);
    await seedCompliance(tenantId, db);
    await seedKpis(tenantId, db);
    await seedKnowledgeBase(tenantId, db);
    await seedRunbooks(tenantId, db);
    await seedAutomationRules(tenantId, db);
    await seedAiAgents(tenantId, db);

    // Work family
    await seedIncidents(tenantId, db);
    await seedProblems(tenantId, db);
    await seedChangeRequests(tenantId, db);
    await seedServiceRequests(tenantId, db);
    await seedMaintenances(tenantId, db);
    await seedAlerts(tenantId, db);

    // MELT
    await seedMetrics(tenantId, db);
    await seedLogs(tenantId, db);
    await seedEvents(tenantId, db);
    await seedTraces(tenantId, db);

    // Cross-cutting
    await seedAuditLogs(tenantId, db);
    await seedActivities(tenantId, db);
  }

  console.log("✅ All tenants seeded successfully");
};

// ---------------------------------
// 5. Reset + Reseed Helpers
// ---------------------------------
export const resetDB = async () => {
  const db = await initDB();
  for (const store of db.objectStoreNames) {
    await db.clear(store);
  }
  console.warn("⚠️ IndexedDB reset complete.");
};

export const reseedDB = async () => {
  console.log("🔄 Resetting & reseeding IndexedDB...");
  await resetDB();
  await seedIndexedDB();
  console.log("✅ Reseed complete.");
};