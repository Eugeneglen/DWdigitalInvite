/**
 * Shared Password Policy — Market Gold Standard
 * ==============================================
 *
 * Enforced across all password-setting endpoints:
 *   - Minimum 8 characters
 *   - At least one uppercase letter (A-Z)
 *   - At least one lowercase letter (a-z)
 *   - At least one number (0-9)
 *   - At least one special character (!@#$%^&*... etc.)
 *
 * Used by:
 *   - POST /api/master/users (create staff user)
 *   - PUT /api/master/users (update staff user)
 *   - POST /api/master/users/[id]/reset-password
 *   - POST /api/auth/change-password
 *   - POST /api/cms/users (couple CMS user creation)
 *   - POST /api/master/weddings (couple account creation — default password)
 *   - POST /api/cms/tenants/[id]/members (editor/viewer invite — default password)
 */

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a password against the market gold standard policy.
 *
 * @param password The password to validate
 * @returns { valid: boolean, errors: string[] }
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Human-readable summary of the password policy, for display in UI.
 */
export const PASSWORD_POLICY_TEXT = 'Minimum 8 characters, with at least one uppercase letter, one lowercase letter, one number, and one special character.';

/**
 * List of rules for UI display (checklist style).
 */
export const PASSWORD_RULES = [
  { key: 'length', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { key: 'uppercase', label: 'At least one uppercase letter (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lowercase', label: 'At least one lowercase letter (a-z)', test: (p: string) => /[a-z]/.test(p) },
  { key: 'number', label: 'At least one number (0-9)', test: (p: string) => /[0-9]/.test(p) },
  { key: 'special', label: 'At least one special character (!@#$...)', test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(p) },
];
