/**
 * 3-Tier Permission System
 * ========================
 *
 * Implements the agreed role hierarchy:
 *
 * TIER 1 — PLATFORM ROLES (global, on User.role)
 *   SUPER_ADMIN          — full platform: user CRUD, billing, system config
 *   ACCOUNT_MANAGER_1    — senior: all weddings RW, no platform user mgmt
 *   ACCOUNT_MANAGER_2    — junior: wedding operations, no system settings
 *   SUPPORT              — read-only across all weddings (helpdesk)
 *   COUPLE               — platform identity for couples (routes to CoupleCMS)
 *
 * TIER 2 — WEDDING STAFF (per-wedding, on UserWeddingRole.role)
 *   CONSULTANT_1         — senior: full content, guests, settings on assigned weddings
 *   CONSULTANT_2         — junior: content & media editing (no settings)
 *   COORDINATOR          — guest mgmt, RSVPs, schedules, day-of ops
 *
 * TIER 3 — ACCOUNT ROLES (per-wedding, couple-controlled, on UserWeddingRole.role)
 *   COUPLE               — owns the wedding, full control
 *   EDITOR               — content + media editing
 *   VIEWER               — read-only dashboard + analytics
 *
 * LEGACY ROLE NORMALIZATION
 *   During the Phase 3 migration, the DB still contains legacy User.role
 *   values (ADMIN_1, ADMIN_2, ADMIN_3, ACCOUNT_MANAGER). These are
 *   normalized to the new vocabulary at check-time so existing users keep
 *   working without a data migration:
 *     ADMIN_1          → ACCOUNT_MANAGER_1
 *     ADMIN_2          → ACCOUNT_MANAGER_2
 *     ADMIN_3          → SUPPORT
 *     ACCOUNT_MANAGER  → ACCOUNT_MANAGER_1
 *
 * PHASE 3a STATUS: This module is built but NOT yet wired into any route.
 * Existing inline `role === 'X'` checks remain in charge until Phase 3b.
 */

import { db } from '@/lib/db';

// ============================================================
// ROLE VOCABULARY
// ============================================================

/** Tier 1 — platform roles stored on User.role */
export type PlatformRole =
  | 'SUPER_ADMIN'
  | 'ACCOUNT_MANAGER_1'
  | 'ACCOUNT_MANAGER_2'
  | 'SUPPORT'
  | 'COUPLE';

/** Tier 2 — wedding staff roles stored on UserWeddingRole.role */
export type WeddingStaffRole =
  | 'CONSULTANT_1'
  | 'CONSULTANT_2'
  | 'COORDINATOR';

/** Tier 3 — account roles stored on UserWeddingRole.role */
export type WeddingAccountRole =
  | 'COUPLE'
  | 'EDITOR'
  | 'VIEWER';

/** All valid per-wedding roles (Tier 2 + Tier 3) */
export type WeddingRole = WeddingStaffRole | WeddingAccountRole;

/** All valid role strings (for validation) */
export const PLATFORM_ROLES: readonly PlatformRole[] = [
  'SUPER_ADMIN', 'ACCOUNT_MANAGER_1', 'ACCOUNT_MANAGER_2', 'SUPPORT', 'COUPLE',
] as const;

export const WEDDING_STAFF_ROLES: readonly WeddingStaffRole[] = [
  'CONSULTANT_1', 'CONSULTANT_2', 'COORDINATOR',
] as const;

export const WEDDING_ACCOUNT_ROLES: readonly WeddingAccountRole[] = [
  'COUPLE', 'EDITOR', 'VIEWER',
] as const;

/**
 * Legacy → new platform role mapping.
 * Used by normalizePlatformRole() so existing DB rows keep working.
 */
const LEGACY_PLATFORM_ROLE_MAP: Record<string, PlatformRole> = {
  // Unchanged
  SUPER_ADMIN: 'SUPER_ADMIN',
  COUPLE: 'COUPLE',
  // Legacy → intermediate vocabulary
  ADMIN_1: 'ACCOUNT_MANAGER_1',
  ADMIN_2: 'ACCOUNT_MANAGER_2',
  ADMIN_3: 'SUPPORT',
  ACCOUNT_MANAGER: 'ACCOUNT_MANAGER_1',
  // New DB-driven vocabulary → intermediate vocabulary (bridge until Phase B)
  SUPER_ADMIN_1: 'SUPER_ADMIN',
  SUPER_ADMIN_2: 'SUPER_ADMIN',
  CONSULTANT_1: 'ACCOUNT_MANAGER_1',
  CONSULTANT_2: 'ACCOUNT_MANAGER_1', // junior consultant ≈ account manager 1 (Phase B will differentiate)
  COORDINATOR_1: 'ACCOUNT_MANAGER_2',
  SUPPORT_1: 'SUPPORT',
  SUPPORT_2: 'SUPPORT',
  // Phase 1-4 intermediate vocabulary (still valid)
  ACCOUNT_MANAGER_1: 'ACCOUNT_MANAGER_1',
  ACCOUNT_MANAGER_2: 'ACCOUNT_MANAGER_2',
  SUPPORT: 'SUPPORT',
};

/**
 * Normalize a (possibly legacy) platform role string to the new vocabulary.
 * Returns undefined if the role is not recognized.
 */
export function normalizePlatformRole(role: string): PlatformRole | undefined {
  return LEGACY_PLATFORM_ROLE_MAP[role];
}

/**
 * Check if a role string is a recognized platform role (legacy or new).
 */
export function isPlatformRole(role: string): boolean {
  return role in LEGACY_PLATFORM_ROLE_MAP;
}

/**
 * Check if a role string is a recognized wedding role (Tier 2 or Tier 3).
 */
export function isWeddingRole(role: string): boolean {
  return (
    WEDDING_STAFF_ROLES.includes(role as WeddingStaffRole) ||
    WEDDING_ACCOUNT_ROLES.includes(role as WeddingAccountRole)
  );
}

// ============================================================
// PLATFORM PERMISSION MATRIX (Tier 1)
// ============================================================

/**
 * Platform-level actions that can be performed by Tier 1 roles.
 * These are global — not scoped to a specific wedding.
 */
export type PlatformAction =
  | 'platform:users:manage'        // create/update/delete platform users
  | 'platform:weddings:read'       // read all weddings
  | 'platform:weddings:write'      // create/update/delete weddings
  | 'platform:settings:read'       // read system settings
  | 'platform:settings:write'      // update system settings
  | 'platform:analytics:read'      // read platform-wide analytics
  | 'platform:audit:read'          // read audit logs
  | 'platform:templates:manage'    // manage content templates
  | 'platform:weddings:read-all';  // read-only across all weddings (support)

/**
 * Maps each normalized platform role to the set of platform actions it can perform.
 * SUPER_ADMIN has wildcard '*' (all permissions).
 */
export const PLATFORM_PERMISSION_MATRIX: Record<PlatformRole, ReadonlySet<PlatformAction | '*'>> = {
  SUPER_ADMIN: new Set<PlatformAction | '*'>(['*']),

  ACCOUNT_MANAGER_1: new Set<PlatformAction>([
    'platform:weddings:read',
    'platform:weddings:write',
    'platform:analytics:read',
    'platform:audit:read',
    'platform:templates:manage',
  ]),

  ACCOUNT_MANAGER_2: new Set<PlatformAction>([
    'platform:weddings:read',
    'platform:weddings:write',
    'platform:analytics:read',
  ]),

  SUPPORT: new Set<PlatformAction>([
    'platform:weddings:read-all',
    'platform:analytics:read',
    'platform:audit:read',
  ]),

  // COUPLE has no platform-level permissions — their access is per-wedding
  COUPLE: new Set<PlatformAction>(),
};

/**
 * Check if a platform role holds a specific platform permission.
 * Accepts legacy role strings (normalized internally).
 *
 * @param role  The User.role string (legacy or new)
 * @param action The platform action to check
 * @returns true if the role grants the permission
 */
export function hasPlatformPermission(role: string, action: PlatformAction): boolean {
  const normalized = normalizePlatformRole(role);
  if (!normalized) return false;

  const permissions = PLATFORM_PERMISSION_MATRIX[normalized];
  if (!permissions) return false;

  // Super-admin wildcard
  if (permissions.has('*')) return true;

  // Direct match
  return permissions.has(action);
}

// ============================================================
// WEDDING PERMISSION MATRIX (Tier 2 + Tier 3)
// ============================================================

/**
 * Per-wedding actions that can be performed by Tier 2/3 roles.
 * These are scoped to a specific wedding via UserWeddingRole.
 */
export type WeddingAction =
  | 'wedding:read'           // view wedding dashboard/details
  | 'wedding:content:write'  // edit content sections
  | 'wedding:media:write'    // upload/edit media
  | 'wedding:guests:write'   // manage guest list
  | 'wedding:rsvps:read'     // view RSVP submissions
  | 'wedding:rsvps:manage'   // manage/delete RSVPs
  | 'wedding:schedule:write' // edit event schedule
  | 'wedding:settings:write' // edit wedding settings (theme, features, etc.)
  | 'wedding:analytics:read' // view wedding analytics
  | 'wedding:wishes:moderate' // moderate/delete wishes
  | 'wedding:members:invite' // invite editors/viewers to the wedding
  | 'wedding:members:remove'; // remove members from the wedding

/**
 * Maps each per-wedding role to the set of wedding actions it can perform.
 * COUPLE has wildcard '*' (all permissions on their own wedding).
 */
export const WEDDING_PERMISSION_MATRIX: Record<WeddingRole, ReadonlySet<WeddingAction | '*'>> = {
  // Tier 3 — Account roles
  COUPLE: new Set<WeddingAction | '*'>(['*']),

  EDITOR: new Set<WeddingAction>([
    'wedding:read',
    'wedding:content:write',
    'wedding:media:write',
    'wedding:analytics:read',
  ]),

  VIEWER: new Set<WeddingAction>([
    'wedding:read',
    'wedding:analytics:read',
  ]),

  // Tier 2 — Wedding staff
  CONSULTANT_1: new Set<WeddingAction>([
    'wedding:read',
    'wedding:content:write',
    'wedding:media:write',
    'wedding:guests:write',
    'wedding:rsvps:read',
    'wedding:rsvps:manage',
    'wedding:schedule:write',
    'wedding:settings:write',
    'wedding:analytics:read',
    'wedding:wishes:moderate',
    'wedding:members:invite',
    'wedding:members:remove',
  ]),

  CONSULTANT_2: new Set<WeddingAction>([
    'wedding:read',
    'wedding:content:write',
    'wedding:media:write',
  ]),

  COORDINATOR: new Set<WeddingAction>([
    'wedding:read',
    'wedding:guests:write',
    'wedding:rsvps:read',
    'wedding:rsvps:manage',
    'wedding:schedule:write',
  ]),
};

// ============================================================
// PLATFORM ROLE BYPASS RULES
// ============================================================

/**
 * Platform roles that bypass per-wedding permission checks.
 * These roles have cross-wedding access (read or read-write).
 *
 * - SUPER_ADMIN, ACCOUNT_MANAGER_1, ACCOUNT_MANAGER_2: full read-write
 * - SUPPORT: read-only (only passes 'wedding:read' and 'wedding:analytics:read')
 * - COUPLE: NO bypass — must have a UserWeddingRole row for the specific wedding
 */
const PLATFORM_BYPASS_ROLES = new Set<PlatformRole>([
  'SUPER_ADMIN',
  'ACCOUNT_MANAGER_1',
  'ACCOUNT_MANAGER_2',
]);

const PLATFORM_READONLY_BYPASS_ROLES = new Set<PlatformRole>([
  'SUPPORT',
]);

/** Read-only wedding actions that SUPPORT role can access on any wedding */
const READONLY_WEDDING_ACTIONS = new Set<WeddingAction>([
  'wedding:read',
  'wedding:analytics:read',
]);

// ============================================================
// WEDDING PERMISSION CHECKING
// ============================================================

/**
 * Check if a user has a specific permission on a specific wedding.
 *
 * This function checks BOTH:
 *   1. Platform-level bypass (SUPER_ADMIN, ACCOUNT_MANAGER_*, SUPPORT)
 *   2. Per-wedding UserWeddingRole rows (Tier 2 + Tier 3)
 *
 * @param userId    The authenticated user's ID
 * @param userRole  The user's platform role (User.role — legacy or new)
 * @param weddingId The wedding ID being accessed
 * @param action    The wedding action to check
 * @returns true if the user has the permission
 */
export async function hasWeddingPermission(
  userId: string,
  userRole: string,
  weddingId: string,
  action: WeddingAction,
): Promise<boolean> {
  const normalizedRole = normalizePlatformRole(userRole);

  // 1. Platform bypass — SUPER_ADMIN, ACCOUNT_MANAGER_1, ACCOUNT_MANAGER_2
  if (normalizedRole && PLATFORM_BYPASS_ROLES.has(normalizedRole)) {
    return true;
  }

  // 2. Read-only bypass — SUPPORT can only read
  if (normalizedRole && PLATFORM_READONLY_BYPASS_ROLES.has(normalizedRole)) {
    return READONLY_WEDDING_ACTIONS.has(action);
  }

  // 3. Per-wedding role check — look up UserWeddingRole rows
  const roles = await db.userWeddingRole.findMany({
    where: { userId, weddingId },
    select: { role: true },
  });

  if (roles.length === 0) return false;

  // Check if ANY of the user's wedding roles grants the action
  for (const r of roles) {
    const weddingRole = r.role as WeddingRole;
    const permissions = WEDDING_PERMISSION_MATRIX[weddingRole];
    if (!permissions) continue;

    // COUPLE wildcard
    if (permissions.has('*')) return true;

    // Direct match
    if (permissions.has(action)) return true;
  }

  return false;
}

/**
 * Get all wedding IDs a user has access to (any role).
 * Useful for filtering lists / dashboard queries.
 *
 * @param userId   The user ID
 * @param userRole The platform role (for bypass optimization)
 * @returns Array of wedding IDs, or null if the user has cross-wedding access
 *          (in which case the caller should not filter by wedding)
 */
export async function getAccessibleWeddingIds(
  userId: string,
  userRole: string,
): Promise<string[] | null> {
  const normalizedRole = normalizePlatformRole(userRole);

  // Platform bypass roles — return null to signal "all weddings"
  if (normalizedRole && (PLATFORM_BYPASS_ROLES.has(normalizedRole) || PLATFORM_READONLY_BYPASS_ROLES.has(normalizedRole))) {
    return null;
  }

  // Per-wedding — return the list of wedding IDs from UserWeddingRole
  const roles = await db.userWeddingRole.findMany({
    where: { userId },
    select: { weddingId: true },
    distinct: ['weddingId'],
  });

  return roles.map((r: { weddingId: string }) => r.weddingId);
}

// ============================================================
// CONVENIENCE: ROLE LABELS (for UI)
// ============================================================

/** Human-readable labels for each role (new vocabulary) */
export const ROLE_LABELS: Record<string, string> = {
  // Tier 1
  SUPER_ADMIN: 'Super Admin',
  ACCOUNT_MANAGER_1: 'Account Manager (Senior)',
  ACCOUNT_MANAGER_2: 'Account Manager (Junior)',
  SUPPORT: 'Support (Read-only)',
  COUPLE: 'Couple',
  // Tier 2
  CONSULTANT_1: 'Consultant (Senior)',
  CONSULTANT_2: 'Consultant (Junior)',
  COORDINATOR: 'Coordinator',
  // Tier 3
  EDITOR: 'Editor',
  VIEWER: 'Viewer',
};

/** Get a human-readable label for any role string (legacy or new) */
export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

// ============================================================
// ERROR CLASS
// ============================================================

export class PermissionError extends Error {
  public readonly role: string;
  public readonly action: string;
  public readonly statusCode = 403;

  constructor(role: string, action: string, message?: string) {
    super(
      message ??
        `Permission denied: role "${role}" does not have permission "${action}".`,
    );
    this.name = 'PermissionError';
    this.role = role;
    this.action = action;
  }
}
