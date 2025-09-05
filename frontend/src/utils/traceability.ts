import { getById, getAll } from "../db/dbClient";
import type { AIOpsDB } from "../db/seedIndexedDB";

// ---------------------------------
// Generic Traceability Resolver
// ---------------------------------

export const resolveTraceability = async (
  entityType: keyof AIOpsDB,
  id: string
): Promise<Record<string, any[]>> => {
  const entity = await getById<any>(entityType, id);
  if (!entity) return {};

  const results: Record<string, any[]> = {};

  switch (entityType) {
    // ------------------------------
    // Work Family
    // ------------------------------
    case "incidents":
      results.problems = await resolveList("problems", entity.related_problem_ids);
      results.changes = await resolveList("changes", entity.related_change_ids);
      results.knowledge = await resolveList("knowledge", entity.knowledge_article_ids);
      results.runbooks = await resolveList("runbooks", entity.runbook_ids);
      results.automations = await resolveList("automation_rules", entity.automation_rule_ids);
      results.assets = await resolveList("assets", entity.related_asset_ids);
      results.business_services = entity.business_service_id
        ? [await getById("business_services", entity.business_service_id)]
        : [];
      break;

    case "problems":
      results.incidents = await resolveList("incidents", entity.related_incident_ids);
      results.changes = await resolveList("changes", entity.related_change_ids);
      results.knowledge = await resolveList("knowledge", entity.knowledge_article_ids);
      break;

    case "changes":
      results.incidents = await resolveList("incidents", entity.related_incident_ids);
      results.problems = await resolveList("problems", entity.related_problem_ids);
      results.risks = await resolveList("risks", entity.risk_ids);
      break;

    case "maintenance":
      results.assets = await resolveList("assets", entity.asset_ids);
      results.business_services = entity.business_service_id
        ? [await getById("business_services", entity.business_service_id)]
        : [];
      break;

    case "service_requests":
      results.business_services = entity.business_service_id
        ? [await getById("business_services", entity.business_service_id)]
        : [];
      break;

    case "alerts":
      results.incidents = await resolveList("incidents", entity.related_incident_ids);
      results.metrics = await resolveList("metrics", entity.metric_ids);
      results.logs = await resolveList("logs", entity.log_ids);
      results.events = await resolveList("events", entity.event_ids);
      results.traces = await resolveList("traces", entity.trace_ids);
      break;

    // ------------------------------
    // MELT
    // ------------------------------
    case "metrics":
    case "logs":
    case "events":
    case "traces":
      results.assets = entity.asset_id ? [await getById("assets", entity.asset_id)] : [];
      break;

    // ------------------------------
    // Business
    // ------------------------------
    case "business_services":
      results.incidents = await filterByField("incidents", "business_service_id", id);
      results.problems = await filterByField("problems", "business_service_id", id);
      results.changes = await filterByField("changes", "business_service_id", id);
      results.maintenance = await filterByField("maintenance", "business_service_id", id);
      results.service_requests = await filterByField("service_requests", "business_service_id", id);
      results.components = await resolveList("service_components", entity.service_component_ids);
      results.customers = await resolveList("customers", entity.customer_ids);
      results.contracts = await resolveList("contracts", entity.contract_ids);
      results.cost_centers = await resolveList("cost_centers", entity.cost_center_ids);
      break;

    case "service_components":
      results.assets = await resolveList("assets", entity.asset_ids);
      results.business_service = entity.business_service_id
        ? [await getById("business_services", entity.business_service_id)]
        : [];
      break;

    case "assets":
      results.vendor = entity.vendor_id ? [await getById("vendors", entity.vendor_id)] : [];
      results.contract = entity.contract_id ? [await getById("contracts", entity.contract_id)] : [];
      results.incidents = await filterByField("incidents", "related_asset_ids", id);
      results.metrics = await filterByField("metrics", "asset_id", id);
      results.logs = await filterByField("logs", "asset_id", id);
      results.events = await filterByField("events", "asset_id", id);
      results.traces = await filterByField("traces", "asset_id", id);
      break;

    case "customers":
      results.business_services = await filterByArray("business_services", "customer_ids", id);
      results.contracts = await filterByField("contracts", "customer_id", id);
      break;

    case "vendors":
      results.assets = await filterByField("assets", "vendor_id", id);
      results.contracts = await filterByField("contracts", "vendor_id", id);
      break;

    case "contracts":
      results.vendor = entity.vendor_id ? [await getById("vendors", entity.vendor_id)] : [];
      results.customer = entity.customer_id ? [await getById("customers", entity.customer_id)] : [];
      break;

    // ------------------------------
    // Governance
    // ------------------------------
    case "risks":
      results.business_services = await resolveList("business_services", entity.business_service_ids);
      results.assets = await resolveList("assets", entity.asset_ids);
      results.vendors = await resolveList("vendors", entity.vendor_ids);
      results.compliance = await resolveList("compliance", entity.compliance_requirement_ids);
      break;

    case "compliance":
      results.business_services = await resolveList("business_services", entity.business_service_ids);
      results.assets = await resolveList("assets", entity.asset_ids);
      results.vendors = await resolveList("vendors", entity.vendor_ids);
      results.contracts = await resolveList("contracts", entity.contract_ids);
      results.risks = await resolveList("risks", entity.risk_ids);
      break;

    case "knowledge":
      results.incidents = await resolveList("incidents", entity.related_incident_ids);
      results.problems = await resolveList("problems", entity.related_problem_ids);
      results.changes = await resolveList("changes", entity.related_change_ids);
      break;

    case "runbooks":
      results.incidents = await resolveList("incidents", entity.related_incident_ids);
      results.problems = await resolveList("problems", entity.related_problem_ids);
      results.changes = await resolveList("changes", entity.related_change_ids);
      results.maintenance = await resolveList("maintenance", entity.related_maintenance_ids);
      break;

    case "automation_rules":
      results.runbooks = await resolveList("runbooks", entity.related_runbook_ids);
      results.incidents = await resolveList("incidents", entity.related_incident_ids);
      results.problems = await resolveList("problems", entity.related_problem_ids);
      results.changes = await resolveList("changes", entity.related_change_ids);
      results.maintenance = await resolveList("maintenance", entity.related_maintenance_ids);
      break;

    case "ai_agents":
      results.incidents = await resolveList("incidents", entity.related_incident_ids);
      results.problems = await resolveList("problems", entity.related_problem_ids);
      results.changes = await resolveList("changes", entity.related_change_ids);
      results.maintenance = await resolveList("maintenance", entity.related_maintenance_ids);
      results.alerts = await resolveList("alerts", entity.related_alert_ids);
      break;

    default:
      break;
  }

  return results;
};

// ---------------------------------
// Helpers
// ---------------------------------

const resolveList = async (store: keyof AIOpsDB, ids?: string[]) => {
  if (!ids || ids.length === 0) return [];
  return (await Promise.all(ids.map((id) => getById(store, id)))).filter(Boolean);
};

const filterByField = async (
  storeName: keyof AIOpsDB,
  field: string,
  value: string
) => {
  const all = await getAll<any>(storeName);
  return all.filter((x: any) =>
    Array.isArray(x[field]) ? x[field].includes(value) : x[field] === value
  );
};

const filterByArray = async (
  storeName: keyof AIOpsDB,
  field: string,
  value: string
) => {
  const all = await getAll<any>(storeName);
  return all.filter((x: any) => Array.isArray(x[field]) && x[field].includes(value));
};