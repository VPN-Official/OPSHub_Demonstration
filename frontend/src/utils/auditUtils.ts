// src/utils/auditUtils.ts
/**
 * Generate an immutable cryptographic hash for an audit log entry.
 * Ensures tamper-proofing by chaining entity info, action, timestamp, and actor.
 * 
 * Uses Web Crypto API for browser compatibility.
 */
export const generateImmutableHash = async (log: {
  id?: string;
  entity_type: string;
  entity_id: string;
  action: string;
  timestamp: string;
  tenantId: string;
  user_id?: string | null;
  team_id?: string | null;
  ai_agent_id?: string | null;
  automation_rule_id?: string | null;
  description?: string;
  metadata?: Record<string, any>;
}): Promise<string> => {
  // Create deterministic payload for hashing
  const payload = JSON.stringify({
    entity_type: log.entity_type,
    entity_id: log.entity_id,
    action: log.action,
    timestamp: log.timestamp,
    tenantId: log.tenantId,
    user_id: log.user_id || "",
    team_id: log.team_id || "",
    ai_agent_id: log.ai_agent_id || "",
    automation_rule_id: log.automation_rule_id || "",
    description: log.description || "",
    // Include metadata in hash for additional tamper protection
    metadata: log.metadata || {},
  });

  // Use Web Crypto API for browser compatibility
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
  } catch (error) {
    console.error('Failed to generate immutable hash:', error);
    // Fallback to a simple hash if Web Crypto fails
    return generateFallbackHash(payload);
  }
};

/**
 * Fallback hash function for environments where Web Crypto API might not be available
 */
const generateFallbackHash = (input: string): string => {
  let hash = 0;
  if (input.length === 0) return hash.toString(16);
  
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to hex and pad
  return Math.abs(hash).toString(16).padStart(8, '0');
};

/**
 * Validate that a stored log entry's immutable_hash matches its computed hash.
 */
export const validateImmutableHash = async (
  log: { 
    hash: string; // FIXED: Changed from immutable_hash to hash
    entity_type: string;
    entity_id: string;
    action: string;
    timestamp: string;
    tenantId: string;
    user_id?: string | null;
    team_id?: string | null;
    ai_agent_id?: string | null;
    automation_rule_id?: string | null;
    description?: string;
    metadata?: Record<string, any>;
  }
): Promise<boolean> => {
  try {
    const recomputed = await generateImmutableHash(log);
    return log.hash === recomputed; // FIXED: Use hash instead of immutable_hash
  } catch (error) {
    console.error('Failed to validate immutable hash:', error);
    return false;
  }
};

/**
 * Create a chain hash that includes the previous hash for additional security
 */
export const generateChainHash = async (
  currentLog: Parameters<typeof generateImmutableHash>[0],
  previousHash?: string
): Promise<string> => {
  const currentHash = await generateImmutableHash(currentLog);
  
  if (!previousHash) {
    return currentHash;
  }
  
  // Chain the hashes together
  const chainedPayload = `${previousHash}:${currentHash}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(chainedPayload);
  
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Failed to generate chain hash:', error);
    return generateFallbackHash(chainedPayload);
  }
};

/**
 * Generate a deterministic ID based on entity and timestamp
 * Useful for ensuring consistent audit log IDs
 */
export const generateAuditId = async (
  entityType: string,
  entityId: string,
  timestamp: string,
  action: string
): Promise<string> => {
  const payload = `${entityType}:${entityId}:${timestamp}:${action}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Return first 16 characters for a shorter ID
    return hash.substring(0, 16);
  } catch (error) {
    console.error('Failed to generate audit ID:', error);
    // Fallback to timestamp-based ID
    return `${entityType}_${Date.now().toString(36)}`;
  }
};

/**
 * Verify the integrity of an audit trail by checking hash chain
 */
export const verifyAuditTrail = async (
  auditLogs: Array<{
    hash: string; // FIXED: Changed from immutable_hash to hash
    entity_type: string;
    entity_id: string;
    action: string;
    timestamp: string;
    tenantId: string;
    user_id?: string | null;
    team_id?: string | null;
    ai_agent_id?: string | null;
    automation_rule_id?: string | null;
    description?: string;
    metadata?: Record<string, any>;
  }>
): Promise<{
  isValid: boolean;
  invalidEntries: number[];
  totalChecked: number;
}> => {
  const invalidEntries: number[] = [];
  
  for (let i = 0; i < auditLogs.length; i++) {
    const isValid = await validateImmutableHash(auditLogs[i]);
    if (!isValid) {
      invalidEntries.push(i);
    }
  }
  
  return {
    isValid: invalidEntries.length === 0,
    invalidEntries,
    totalChecked: auditLogs.length,
  };
};

/**
 * Utility function to check if Web Crypto API is available
 */
export const isCryptoSupported = (): boolean => {
  return typeof crypto !== 'undefined' && 
         typeof crypto.subtle !== 'undefined' && 
         typeof crypto.subtle.digest === 'function';
};

/**
 * Generate a secure random ID using crypto.randomUUID() with fallback
 */
export const generateSecureId = (): string => {
  try {
    // Use crypto.randomUUID() if available (modern browsers)
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    
    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  } catch (error) {
    console.error('Failed to generate secure ID:', error);
    // Ultimate fallback
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
};