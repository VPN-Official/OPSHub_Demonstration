// src/utils/dateUtils.ts - Date handling utilities
/**
 * Convert ISO string to user-friendly format
 */
export const formatDate = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleString();
};

/**
 * Calculate time difference in human-readable format
 */
export const timeAgo = (isoString: string): string => {
  const now = new Date();
  const date = new Date(isoString);
  const diffMs = now.getTime() - date.getTime();
  
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

/**
 * Calculate SLA deadline from creation time and SLA minutes
 */
export const calculateSLADeadline = (createdAt: string, slaMinutes: number): string => {
  const created = new Date(createdAt);
  return new Date(created.getTime() + slaMinutes * 60 * 1000).toISOString();
};

/**
 * Check if SLA is breached
 */
export const isSLABreached = (createdAt: string, slaMinutes: number): boolean => {
  const deadline = new Date(calculateSLADeadline(createdAt, slaMinutes));
  return new Date() > deadline;
};