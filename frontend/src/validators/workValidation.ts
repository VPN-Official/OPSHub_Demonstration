import defaults from "../config/default.json";

export type ValidationResult = { valid: true } | { valid: false; errors: string[] };

const validateEnum = (
  value: string | undefined | null,
  allowed: string[],
  field: string
): string | null => {
  if (!value) return null; // allow optional
  return allowed.includes(value)
    ? null
    : `Invalid ${field}: "${value}". Allowed: ${allowed.join(", ")}`;
};

// ----------------------------
// Incident
// ----------------------------
export const validateIncident = (incident: any): ValidationResult => {
  const errors: string[] = [];

  errors.push(
    validateEnum(incident.status, defaults.work.incident.statuses, "status")!,
    validateEnum(incident.priority, defaults.work.incident.priorities, "priority")!,
    validateEnum(incident.impact, defaults.work.incident.impact_levels, "impact")!,
    validateEnum(incident.urgency, defaults.work.incident.urgency_levels, "urgency")!
  );

  return errors.filter(Boolean).length > 0
    ? { valid: false, errors: errors.filter(Boolean) }
    : { valid: true };
};

// ----------------------------
// Service Request
// ----------------------------
export const validateServiceRequest = (sr: any): ValidationResult => {
  const errors: string[] = [];

  errors.push(
    validateEnum(sr.status, defaults.work.service_request.statuses, "status")!,
    validateEnum(sr.priority, defaults.work.service_request.priorities, "priority")!
  );

  return errors.filter(Boolean).length > 0
    ? { valid: false, errors: errors.filter(Boolean) }
    : { valid: true };
};

// ----------------------------
// Change Request
// ----------------------------
export const validateChangeRequest = (cr: any): ValidationResult => {
  const errors: string[] = [];

  errors.push(
    validateEnum(cr.status, defaults.work.change_request.statuses, "status")!,
    validateEnum(cr.priority, defaults.work.change_request.priorities, "priority")!,
    validateEnum(cr.risk, defaults.work.change_request.risk_levels, "risk")!,
    validateEnum(cr.change_type, defaults.work.change_request.types, "change_type")!
  );

  return errors.filter(Boolean).length > 0
    ? { valid: false, errors: errors.filter(Boolean) }
    : { valid: true };
};

// ----------------------------
// Problem
// ----------------------------
export const validateProblem = (problem: any): ValidationResult => {
  const errors: string[] = [];

  errors.push(
    validateEnum(problem.status, defaults.work.problem.statuses, "status")!,
    validateEnum(problem.priority, defaults.work.problem.priorities, "priority")!,
    validateEnum(problem.impact, defaults.work.problem.impact_levels, "impact")!,
    validateEnum(problem.urgency, defaults.work.problem.urgency_levels, "urgency")!
  );

  return errors.filter(Boolean).length > 0
    ? { valid: false, errors: errors.filter(Boolean) }
    : { valid: true };
};

// ----------------------------
// Maintenance
// ----------------------------
export const validateMaintenance = (mw: any): ValidationResult => {
  const errors: string[] = [];

  errors.push(
    validateEnum(mw.status, defaults.work.maintenance.statuses, "status")!,
    validateEnum(mw.priority, defaults.work.maintenance.priorities, "priority")!,
    validateEnum(mw.maintenance_type, defaults.work.maintenance.types, "maintenance_type")!
  );

  return errors.filter(Boolean).length > 0
    ? { valid: false, errors: errors.filter(Boolean) }
    : { valid: true };
};