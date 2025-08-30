/**
 * Generate human-readable reasons why a work item is prioritized
 * @param {Object} wi - Work item
 * @param {String} currentUserId - (Optional) current user for personalization
 * @returns {string[]} - List of reasons
 */
export function explainSmartScore(wi, currentUserId = null) {
  const reasons = [];

  // --- Priority level ---
  if (wi.priority === "priority_1") {
    reasons.push("This is a P1 (Critical) incident – must be resolved immediately.");
  } else if (wi.priority === "priority_2") {
    reasons.push("This is a P2 (High) priority issue – should be resolved soon.");
  } else {
    reasons.push("This is a lower-priority issue.");
  }

  // --- SLA status ---
  if (typeof wi.sla_remaining !== "undefined") {
    if (wi.sla_remaining < 0) {
      reasons.push("SLA already breached – immediate attention required.");
    } else if (wi.sla_remaining < 15) {
      reasons.push("SLA target is about to breach – resolve within 15 minutes.");
    } else {
      reasons.push(`SLA target still has ${wi.sla_remaining} minutes remaining.`);
    }
  }

  // --- Business impact ---
  if (wi.impact && wi.impact > 0) {
    if (wi.impact >= 100000) {
      reasons.push(`High business impact: $${wi.impact.toLocaleString()}/hr loss.`);
    } else {
      reasons.push(`Business impact estimated at $${wi.impact.toLocaleString()}/hr.`);
    }
  }

  // --- Automation eligibility ---
  if (wi.automationEligible) {
    reasons.push("Automation playbook available – could be resolved without manual effort.");
  }

  // --- Ownership ---
  if (wi.owner) {
    if (currentUserId && wi.owner.toLowerCase().includes("alice")) {
      reasons.push("This is assigned to you.");
    } else {
      reasons.push(`Currently assigned to ${wi.owner}.`);
    }
  }

  return reasons;
}
