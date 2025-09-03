import { openDB } from "idb";
import { AIOpsDB } from "../seedIndexedDB";

/* Infra + org */
import { seedBusinessServices } from "./seedBusinessServices";
import { seedServiceComponents } from "./seedServiceComponents";
import { seedAssets } from "./seedAssets";
import { seedTeams } from "./seedTeams";
import { seedUsers } from "./seedUsers";
import { seedEndUsers } from "./seedEndUsers";

/* ITIL chain */
import { seedIncidents } from "./seedIncidents";
import { seedProblems } from "./seedProblems";
import { seedChangeRequests } from "./seedChangeRequests";
import { seedServiceRequests } from "./seedServiceRequests";
import { seedMaintenances } from "./seedMaintenances";

/* Telemetry */
import { seedMetrics } from "./seedMetrics";
import { seedLogs } from "./seedLogs";
import { seedAlerts } from "./seedAlerts";
import { seedEvents } from "./seedEvents";
import { seedTraces } from "./seedTraces";

/* Business + finance */
import { seedValueStreams } from "./seedValueStreams";
import { seedCustomers } from "./seedCustomers";
import { seedVendors } from "./seedVendors";
import { seedContracts } from "./seedContracts";
import { seedCostCenters } from "./seedCostCenters";

/* Governance */
import { seedRisks } from "./seedRisks";
import { seedCompliance } from "./seedCompliance";
import { seedPolicy } from "./seedPolicy";

/* Knowledge + automation + AI */
import { seedKpis } from "./seedKpis";
import { seedKnowledgeBase } from "./seedKnowledgeBase";
import { seedRunbooks } from "./seedRunbooks";
import { seedAutomationRules } from "./seedAutomationRules";
import { seedAiAgents } from "./seedAiAgents";

/* Exec + collab */
import { seedAuditLogs } from "./seedAuditLogs"; // optional if you want separate seed
import { seedActivities } from "./seedActivities"; // optional if you want separate seed
import { seedActivityTimeline } from "./seedActivityTimeline";
import { seedOnCall } from "./seedOnCall";
import { seedPolicy } from "./seedPolicy";
import { seedSkills } from "./seedSkills";
import { seedStakeholderComms } from "./seedStakeholderComms";
import { seedSystemMetrics } from "./seedSystemMetrics";
import { seedWorkItems } from "./seedWorkItems";
import { seedWorkNotes } from "./seedWorkNotes";

const tenants = [
  "tenant_dcn_meta",
  "tenant_av_google",
  "tenant_cloud_morningstar",
];

export const seedAllTenants = async () => {
  const db = await openDB<AIOpsDB>("AIOpsDB", 1);

  for (const tenantId of tenants) {
    console.log(`🌱 Seeding data for ${tenantId}...`);

    /* Foundation */
    await seedTeams(tenantId, db);
    await seedUsers(tenantId, db);
    await seedEndUsers(tenantId, db);
    await seedBusinessServices(tenantId, db);
    await seedServiceComponents(tenantId, db);
    await seedAssets(tenantId, db);

    /* ITIL */
    await seedIncidents(tenantId, db);
    await seedProblems(tenantId, db);
    await seedChangeRequests(tenantId, db);
    await seedServiceRequests(tenantId, db);
    await seedMaintenances(tenantId, db);

    /* Telemetry */
    await seedMetrics(tenantId, db);
    await seedLogs(tenantId, db);
    await seedAlerts(tenantId, db);
    await seedEvents(tenantId, db);
    await seedTraces(tenantId, db);

    /* Value + finance */
    await seedValueStreams(tenantId, db);
    await seedCustomers(tenantId, db);
    await seedVendors(tenantId, db);
    await seedContracts(tenantId, db);
    await seedCostCenters(tenantId, db);

    /* Governance */
    await seedRisks(tenantId, db);
    await seedCompliance(tenantId, db);
    await seedPolicy(tenantId, db);

    /* Knowledge + automation */
    await seedKpis(tenantId, db);
    await seedKnowledgeBase(tenantId, db);
    await seedRunbooks(tenantId, db);
    await seedAutomationRules(tenantId, db);
    await seedAiAgents(tenantId, db);

    /* Collaboration + exec */
    await seedActivityTimeline(tenantId, db);
    await seedOnCall(tenantId, db);
    await seedSkills(tenantId, db);
    await seedStakeholderComms(tenantId, db);
    await seedSystemMetrics(tenantId, db);
    await seedWorkItems(tenantId, db);
    await seedWorkNotes(tenantId, db);

    console.log(`✅ Finished seeding ${tenantId}`);
  }

  console.log("🎉 All tenants seeded successfully.");
};