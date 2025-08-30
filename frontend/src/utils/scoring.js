export function explainSmartScore(wi, currentUserId = null) {
  const reasons = [];
  if (wi.priority === "priority_1") reasons.push("Critical priority (P1)");
  else if (wi.priority === "priority_2") reasons.push("High priority (P2)");
  if (wi.sla_target_minutes && wi.created_at) reasons.push("SLA consideration pending");
  if (wi.business_service?.revenue_impact_per_hour) reasons.push("Business impact noted");
  if (wi.automation?.eligible) reasons.push("Automation available");
  return reasons;
}
