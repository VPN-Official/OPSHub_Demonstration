import crypto from "crypto";

/**
 * Generate an immutable cryptographic hash for an audit log entry.
 * Ensures tamper-proofing by chaining entity info, action, timestamp, and actor.
 */
export const generateImmutableHash = (log: {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  timestamp: string;
  user_id?: string | null;
  team_id?: string | null;
  ai_agent_id?: string | null;
  automation_rule_id?: string | null;
}) => {
  const payload = JSON.stringify({
    id: log.id,
    entity_type: log.entity_type,
    entity_id: log.entity_id,
    action: log.action,
    timestamp: log.timestamp,
    user_id: log.user_id || "",
    team_id: log.team_id || "",
    ai_agent_id: log.ai_agent_id || "",
    automation_rule_id: log.automation_rule_id || "",
  });

  return crypto.createHash("sha256").update(payload).digest("hex");
};

/**
 * Validate that a stored log entry's immutable_hash matches its computed hash.
 */
export const validateImmutableHash = (
  log: { immutable_hash: string } & Record<string, any>
): boolean => {
  const recomputed = generateImmutableHash(log);
  return log.immutable_hash === recomputed;
};