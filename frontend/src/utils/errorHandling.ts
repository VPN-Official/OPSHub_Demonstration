// Enhanced Error Handling Utility for OpsHub
// Provides specific, user-friendly error messages based on error types

export interface ErrorDetails {
  userMessage: string;
  technicalDetails: {
    message?: string;
    status?: number;
    stack?: string;
    code?: string;
    operation?: string;
    context?: Record<string, any>;
  };
  severity: 'info' | 'warning' | 'error' | 'critical';
  retryable: boolean;
  suggestedAction?: string;
}

export class OpsHubError extends Error {
  public status?: number;
  public code?: string;
  public context?: Record<string, any>;
  public retryable: boolean;

  constructor(message: string, status?: number, code?: string, retryable = false) {
    super(message);
    this.name = 'OpsHubError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

/**
 * Enhanced error handler that provides specific, user-friendly error messages
 * @param error - The error to handle
 * @param operation - Description of the operation that failed
 * @param context - Additional context about the error
 * @returns ErrorDetails object with user message and technical details
 */
export function handleError(
  error: any,
  operation: string,
  context?: Record<string, any>
): ErrorDetails {
  let userMessage = 'Operation failed';
  let severity: ErrorDetails['severity'] = 'error';
  let retryable = false;
  let suggestedAction: string | undefined;

  // Network errors
  if (error.name === 'NetworkError' || !navigator.onLine) {
    userMessage = 'Network connection failed. Check your internet and try again.';
    severity = 'warning';
    retryable = true;
    suggestedAction = 'Wait for network connection and retry';
  }
  // HTTP status-based errors
  else if (error.status === 400) {
    userMessage = 'Invalid request. Please check your input and try again.';
    severity = 'warning';
    suggestedAction = 'Review and correct your input';
  }
  else if (error.status === 401) {
    userMessage = 'Authentication required. Please sign in to continue.';
    severity = 'error';
    suggestedAction = 'Sign in again';
  }
  else if (error.status === 403) {
    userMessage = 'Access denied. You may not have permission for this operation.';
    severity = 'error';
    suggestedAction = 'Contact your administrator for access';
  }
  else if (error.status === 404) {
    userMessage = 'The requested resource was not found.';
    severity = 'warning';
    suggestedAction = 'Verify the resource exists';
  }
  else if (error.status === 409) {
    userMessage = 'Data conflict detected. Please refresh and try again.';
    severity = 'warning';
    retryable = true;
    suggestedAction = 'Refresh the page and retry';
  }
  else if (error.status === 422) {
    userMessage = 'Invalid data provided. Please check your input.';
    severity = 'warning';
    suggestedAction = 'Review validation errors';
  }
  else if (error.status === 429) {
    userMessage = 'Too many requests. Please wait a moment and try again.';
    severity = 'warning';
    retryable = true;
    suggestedAction = 'Wait a few seconds before retrying';
  }
  else if (error.status === 503) {
    userMessage = 'Service temporarily unavailable. Please try again later.';
    severity = 'warning';
    retryable = true;
    suggestedAction = 'Wait a few minutes and retry';
  }
  else if (error.status >= 500) {
    userMessage = 'Server error occurred. Please try again in a few minutes.';
    severity = 'critical';
    retryable = true;
    suggestedAction = 'Contact support if the problem persists';
  }
  // Timeout errors
  else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    userMessage = 'Request timed out. The operation is taking longer than expected.';
    severity = 'warning';
    retryable = true;
    suggestedAction = 'Check your connection and try again';
  }
  // Validation errors
  else if (error.code === 'VALIDATION_ERROR') {
    userMessage = error.message || 'Validation failed. Please check your input.';
    severity = 'warning';
    suggestedAction = 'Review and correct validation errors';
  }
  // Permission errors
  else if (error.code === 'INSUFFICIENT_PERMISSIONS') {
    userMessage = 'You don\'t have permission to perform this action.';
    severity = 'error';
    suggestedAction = 'Request necessary permissions from your administrator';
  }
  // Quota errors
  else if (error.code === 'QUOTA_EXCEEDED') {
    userMessage = 'Storage quota exceeded. Please free up some space.';
    severity = 'warning';
    suggestedAction = 'Clear cache or delete old data';
  }
  // Sync conflicts
  else if (error.code === 'SYNC_CONFLICT') {
    userMessage = 'Data sync conflict detected. Your changes may conflict with recent updates.';
    severity = 'warning';
    retryable = true;
    suggestedAction = 'Review conflicts and choose which version to keep';
  }
  // Generic error with message
  else if (error.message) {
    userMessage = error.message;
    // Try to make technical messages more user-friendly
    if (userMessage.includes('fetch')) {
      userMessage = 'Failed to load data. Please try again.';
      retryable = true;
    } else if (userMessage.includes('parse')) {
      userMessage = 'Invalid data format received. Please contact support.';
      severity = 'critical';
    } else if (userMessage.includes('undefined') || userMessage.includes('null')) {
      userMessage = 'An unexpected error occurred. Please try again.';
      retryable = true;
    }
  }
  // Completely unknown error
  else {
    userMessage = `Failed to ${operation}. Please try again or contact support.`;
    severity = 'error';
    retryable = true;
  }

  // Log detailed error for debugging
  console.error(`[OpsHub Error] ${operation} failed:`, {
    message: error.message,
    status: error.status,
    code: error.code,
    stack: error.stack,
    operation,
    context,
    timestamp: new Date().toISOString()
  });

  return {
    userMessage,
    technicalDetails: {
      message: error.message,
      status: error.status,
      code: error.code,
      stack: error.stack,
      operation,
      context
    },
    severity,
    retryable,
    suggestedAction
  };
}

/**
 * Format error for display in UI
 * @param errorDetails - The error details object
 * @returns Formatted error message for UI display
 */
export function formatErrorForUI(errorDetails: ErrorDetails): string {
  let message = errorDetails.userMessage;
  
  if (errorDetails.suggestedAction) {
    message += ` ${errorDetails.suggestedAction}.`;
  }
  
  if (errorDetails.retryable) {
    message += ' (Click to retry)';
  }
  
  return message;
}

/**
 * Check if an error is retryable
 * @param error - The error to check
 * @returns Whether the error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (error instanceof OpsHubError) {
    return error.retryable;
  }
  
  const retryableStatuses = [408, 429, 503, 504];
  const retryableCodes = ['ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND'];
  
  return (
    retryableStatuses.includes(error.status) ||
    retryableCodes.includes(error.code) ||
    error.name === 'NetworkError' ||
    !navigator.onLine
  );
}

/**
 * Create a retry handler with exponential backoff
 * @param operation - The operation to retry
 * @param maxRetries - Maximum number of retries
 * @param initialDelay - Initial delay in milliseconds
 * @returns Promise that resolves with the operation result
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (!isRetryableError(error) || attempt === maxRetries - 1) {
        throw error;
      }
      
      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Error boundary error handler for React components
 * @param error - The error that occurred
 * @param errorInfo - React error info
 */
export function handleComponentError(error: Error, errorInfo: any): void {
  console.error('[Component Error]', {
    error: error.message,
    stack: error.stack,
    componentStack: errorInfo.componentStack,
    timestamp: new Date().toISOString()
  });
  
  // Could send to error tracking service here
}