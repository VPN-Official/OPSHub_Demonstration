// src/utils/validationUtils.ts - Validation utilities
/**
 * Validate required fields on an object
 */
export const validateRequired = (obj: any, fields: string[]): string[] => {
  const missing: string[] = [];
  
  for (const field of fields) {
    if (!obj[field] || (typeof obj[field] === 'string' && obj[field].trim() === '')) {
      missing.push(field);
    }
  }
  
  return missing;
};

/**
 * Validate enum value against allowed options
 */
export const validateEnum = (value: string, allowedValues: string[]): boolean => {
  return allowedValues.includes(value);
};

/**
 * Validate email format
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Sanitize user input for XSS prevention
 */
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/&/g, '&amp;');
};