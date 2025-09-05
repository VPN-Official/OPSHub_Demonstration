// ---------------------------------
// Validation for all entity types
// ---------------------------------

type HealthStatus = "green" | "yellow" | "orange" | "red" | "gray";

interface BaseEntity {
  id: string;
  health_status: HealthStatus;
}

// Required fields per store
const schema: Record<string, (obj: any) => boolean> = {
  // Work
  incidents: (obj) =>
    "id" in obj && "title" in obj && "status" in obj && "priority" in obj && "health_status" in obj,
  problems: (obj) => "id" in obj && "title" in obj && "status" in obj && "health_status" in obj,
  changes: (obj) => "id" in obj && "title" in obj && "status" in obj && "health_status" in obj,
  service_requests: (obj) => "id" in obj && "title" in obj && "status" in obj && "health_status" in obj,
  maintenance: (obj) => "id" in obj && "title" in obj && "status" in obj && "health_status" in obj,
  alerts: (obj) => "id" in obj && "message" in obj && "severity" in obj && "health_status" in obj,

  // MELT
  metrics: (obj) => "id" in obj && "name" in obj && "value" in obj && "health_status" in obj,
  logs: (obj) => "id" in obj && "message" in obj && "level" in obj && "health_status" in obj,
  events: (obj) => "id" in obj && "message" in obj && "severity" in obj && "health_status" in obj,
  traces: (obj) => "id" in obj && "trace_id" in obj && "operation" in obj && "health_status" in obj,

  // Business
  value_streams: (obj) => "id" in obj && "name" in obj && "health_status" in obj,
  business_services: (obj) => "id" in obj && "name" in obj && "tier" in obj && "health_status" in obj,
  service_components: (obj) => "id" in obj && "name" in obj && "type" in obj && "health_status" in obj,
  assets: (obj) => "id" in obj && "name" in obj && "type" in obj && "health_status" in obj,
  customers: (obj) => "id" in obj && "name" in obj && "tier" in obj && "health_status" in obj,
  vendors: (obj) => "id" in obj && "name" in obj && "tier" in obj && "health_status" in obj,
  contracts: (obj) => "id" in obj && "name" in obj && "status" in obj && "health_status" in obj,
  cost_centers: (obj) => "id" in obj && "name" in obj && "budget" in obj && "health_status" in obj,

  // Governance
  risks: (obj) => "id" in obj && "title" in obj && "severity" in obj && "health_status" in obj,
  compliance: (obj) => "id" in obj && "name" in obj && "status" in obj && "health_status" in obj,
  policies: (obj) => "id" in obj && "name" in obj && "status" in obj && "health_status" in obj,
  knowledge: (obj) => "id" in obj && "title" in obj && "status" in obj && "health_status" in obj,
  runbooks: (obj) => "id" in obj && "title" in obj && "status" in obj && "health_status" in obj,
  automation_rules: (obj) => "id" in obj && "name" in obj && "status" in obj && "health_status" in obj,
  ai_agents: (obj) => "id" in obj && "name" in obj && "status" in obj && "health_status" in obj,
};

// ---------------------------------
// Validation function
// ---------------------------------

export const validateSeed = (storeName: string, obj: any): boolean => {
  const validator = schema[storeName];
  if (!validator) {
    console.warn(`⚠️ No schema validation for store ${storeName}`);
    return true; // allow passthrough for non-core stores
  }
  const ok = validator(obj);
  if (!ok) {
    console.error(`❌ Invalid seed for ${storeName}:`, obj);
  }
  return ok;
};

// Validate a batch of objects
export const validateBatch = (storeName: string, objs: any[]): any[] => {
  return objs.filter((obj) => validateSeed(storeName, obj));
};