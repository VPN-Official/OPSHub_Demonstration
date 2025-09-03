// src/utils/errorUtils.ts - Error handling utilities
export class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} with ID ${id} not found`);
    this.name = 'NotFoundError';
  }
}

export class SyncConflictError extends Error {
  constructor(message: string, public conflictDetails: any) {
    super(message);
    this.name = 'SyncConflictError';
  }
}

/**
 * Extract meaningful error message from various error types
 */
export const extractErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
};

/**
 * Log error with context for debugging
 */
export const logError = (error: unknown, context: string, metadata?: any): void => {
  console.error(`[${context}] Error:`, {
    error: extractErrorMessage(error),
    stack: error instanceof Error ? error.stack : undefined,
    metadata,
    timestamp: new Date().toISOString(),
  });
};