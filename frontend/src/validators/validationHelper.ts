import defaults from "../config/default.json";

// Utility type for result
export type ValidationResult = { valid: true } | { valid: false; errors: string[] };

// ----------------------------
// Generic helper
// ----------------------------
const validateEnum = (
  value: string | undefined | null,
  allowed: string[],
  field: string
): string | null => {
  if (!value) return null; // optional fields are allowed
  return allowed.includes(value) ? null : `Invalid ${field}: "${value}". Allowed: ${allowed.join(", ")}`;
};

// ----------------------------
// Incident validation
// ----------------------------
export const validateIncident = (incident: any): ValidationResult => {
  const errors: string[] = [];

  errors.push(
    validateEnum(incident.status, defaults.work.incident.statuses, "status")!,
    validateEnum(incident.priority, defaults.work.incident.priorities, "priority")!,
    validateEnum(incident.impact, defaults.work.incident.impact_levels, "impact")!,
    validateEnum(incident.urgency, defaults.work.incident.urgency_levels, "urgency")!
  );

  return errors.filter(Boolean).length > 0 ? { valid: false, errors: errors.filter(Boolean) } : { valid: true };
};

// ----------------------------
// Service Request validation
// ----------------------------
export const validateServiceRequest = (sr: any): ValidationResult => {
  const errors: string[] = [];

  errors.push(
    validateEnum(sr.status, defaults.work.service_request.statuses, "status")!,
    validateEnum(sr.priority, defaults.work.service_request.priorities, "priority")!
  );

  return errors.filter(Boolean).length > 0 ? { valid: false, errors: errors.filter(Boolean) } : { valid: true };
};

// ----------------------------
// Change Request validation
// ----------------------------
export const validateChangeRequest = (cr: any): ValidationResult => {
  const errors: string[] = [];

  errors.push(
    validateEnum(cr.status, defaults.work.change_request.statuses, "status")!,
    validateEnum(cr.priority, defaults.work.change_request.priorities, "priority")!,
    validateEnum(cr.risk, defaults.work.change_request.risk_levels, "risk")!,
    validateEnum(cr.change_type, defaults.work.change_request.types, "change_type")!
  );

  return errors.filter(Boolean).length > 0 ? { valid: false, errors: errors.filter(Boolean) } : { valid: true };
};

// ----------------------------
// Business validation (tiers etc.)
// ----------------------------
export const validateBusiness = (entity: any, type: "customer" | "vendor" | "service"): ValidationResult => {
  const errors: string[] = [];

  if (type === "customer") {
    errors.push(validateEnum(entity.tier, defaults.business.customer_tiers, "customer tier")!);
  } else if (type === "vendor") {
    errors.push(validateEnum(entity.tier, defaults.business.vendor_tiers, "vendor tier")!);
  } else if (type === "service") {
    errors.push(validateEnum(entity.tier, defaults.business.tiers, "service tier")!);
  }

  return errors.filter(Boolean).length > 0 ? { valid: false, errors: errors.filter(Boolean) } : { valid: true };
};

// ----------------------------
// Risk validation
// ----------------------------
export const validateRisk = (risk: any): ValidationResult => {
  const errors: string[] = [];

  errors.push(
    validateEnum(risk.category, defaults.governance.risk_categories, "risk category")!,
    validateEnum(risk.status, defaults.governance.risk_statuses, "risk status")!
  );

  return errors.filter(Boolean).length > 0 ? { valid: false, errors: errors.filter(Boolean) } : { valid: true };
};

// ----------------------------
// Knowledge validation
// ----------------------------
export const validateKnowledgeArticle = (article: any): ValidationResult => {
  const errors: string[] = [];

  errors.push(
    validateEnum(article.type, defaults.governance.knowledge_types, "knowledge type")!,
    validateEnum(article.status, defaults.governance.knowledge_statuses, "knowledge status")!
  );

  return errors.filter(Boolean).length > 0 ? { valid: false, errors: errors.filter(Boolean) } : { valid: true };
};