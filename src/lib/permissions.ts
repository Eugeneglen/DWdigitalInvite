/**
 * DB-Driven Permission System (Phase B)
 * =====================================
 *
 * Reads role permissions from the Role table in the database, and applies
 * per-user overrides from UserPermissionOverride. Admins can add/edit/delete
 * roles via the Team page — no code changes needed.
 *
 * Permission resolution for a (userId, action) pair:
 *   1. Look up the user's role key (User.role)
 *   2. Get the role's permissions from the Role table (cached)
 *   3. Check UserPermissionOverride for this user + action
 *      - If override exists with granted=true → GRANT (even if role doesn't have it)
 *      - If override exists with granted=false → REVOKE (even if role has it)
 *   4. Otherwise → check role permissions (wildcard '*' or direct match)
 *
 * Legacy compatibility:
 *   normalizePlatformRole() still works for UI components that need to
 *   determine if a user is a "couple" or "admin" for routing purposes.
 *   The old hardcoded PLATFORM_PERMISSION_MATRIX is kept as a fallback
 *   for any code path that can't be made async.
 */

import { db } from '@/lib/db';

// ============================================================
// ROLE PERMISSION CACHING
// ============================================================

/** Cache: roleKey → set of permission strings (including '*' if wildcard) */
let roleCache: Map<string, Set<string>> | null = null;
let roleCacheTime = 0;
const ROLE_CACHE_TTL = 60_000; // 1 minute — roles change rarely

/**
 * Load all roles from DB into the cache.
 * Called on first access and when cache expires.
 */
async function loadRoleCache(): Promise<void> {
  const roles = await db.role.findMany();
  roleCache = new Map();
  for (const r of roles) {
    try {
      const perms = JSON.parse(r.permissions) as string[];
      roleCache.set(r.key, new Set(perms));
    } catch {
      roleCache.set(r.key, new Set());
    }
  }
  roleCacheTime = Date.now();
}

/**
 * Get the set of permissions for a role key (from cache or DB).
 */
async function getRolePermissions(roleKey: string): Promise<Set<string>> {
  if (!roleCache || Date.now() - roleCacheTime > ROLE_CACHE_TTL) {
    await loadRoleCache();
  }
  return roleCache?.get(roleKey) ?? new Set();
}

/**
 * Invalidate the role cache. Call this after creating/editing/deleting a role
 * so the next permission check picks up the changes immediately.
 */
export function invalidateRoleCache(): void {
  roleCache = null;
  roleCacheTime = 0;
}

// ============================================================
// USER OVERRIDE CACHING
// ============================================================

/** Cache: userId → Map<permission, granted> (per-request, short TTL) */
const overrideCache = new Map<string, { data: Map<string, boolean>; time: number }>();
const OVERRIDE_CACHE_TTL = 10_000; // 10 seconds — overrides change rarely but more often than roles

/**
 * Get all permission overrides for a user (from cache or DB).
 */
async function getUserOverrides(userId: string): Promise<Map<string, boolean>> {
  const cached = overrideCache.get(userId);
  if (cached && Date.now() - cached.time < OVERRIDE_CACHE_TTL) {
    return cached.data;
  }

  const overrides = await db.userPermissionOverride.findMany({
    where: { userId },
    select: { permission: true, granted: true },
  });

  const map = new Map<string, boolean>();
  for (const o of overrides) {
    map.set(o.permission, o.granted);
  }

  overrideCache.set(userId, { data: map, time: Date.now() });
  return map;
}

/**
 * Invalidate the override cache for a specific user.
 * Call this after updating a user's permission overrides.
 */
export function invalidateOverrideCache(userId?: string): void {
  if (userId) {
    overrideCache.delete(userId);
  } else {
    overrideCache.clear();
  }
}

// ============================================================
// PLATFORM PERMISSION CHECKING (async, DB-driven)
// ============================================================

/**
 * Platform-level actions (same strings as stored in Role.permissions JSON).
 */
export type PlatformAction =
  | 'platform:users:manage'
  | 'platform:weddings:read'
  | 'platform:weddings:write'
  | 'platform:settings:read'
  | 'platform:settings:write'
  | 'platform:analytics:read'
  | 'platform:audit:read'
  | 'platform:templates:manage'
  | 'platform:weddings:read-all';

/**
 * Check if a user has a specific platform permission.
 *
 * Reads the user's role from the Role table (cached), then checks
 * UserPermissionOverride for grant/revoke overrides.
 *
 * @param userId   The authenticated user's ID
 * @param userRole The user's role key (e.g. "SUPER_ADMIN_1")
 * @param action   The platform action to check
 * @returns true if the permission is granted
 */
export async function hasPlatformPermission(
  userId: string,
  userRole: string,
  action: PlatformAction,
): Promise<boolean> {
  // Normalize legacy role vocabulary (e.g. 'SUPER_ADMIN' → 'SUPER_ADMIN_1')
  // so the DB-driven permission check works for users created before the
  // role vocabulary migration.
  const normalizedRole = LEGACY_PLATFORM_ROLE_MAP[userRole] ?? userRole;

  // Get role permissions from cache/DB
  const rolePerms = await getRolePermissions(normalizedRole);

  // Check overrides first (highest priority)
  const overrides = await getUserOverrides(userId);
  if (overrides.has(action)) {
    return overrides.get(action)!; // true = grant, false = revoke
  }

  // Check role permissions — wildcard '*' grants everything
  if (rolePerms.has('*')) return true;
  return rolePerms.has(action);
}

// ============================================================
// WEDDING PERMISSION CHECKING (async, DB-driven)
// ============================================================

/**
 * Per-wedding actions (same strings as stored in Role.permissions JSON).
 */
export type WeddingAction =
  | 'wedding:read'
  | 'wedding:content:write'
  | 'wedding:media:write'
  | 'wedding:guests:write'
  | 'wedding:rsvps:read'
  | 'wedding:rsvps:manage'
  | 'wedding:schedule:write'
  | 'wedding:settings:write'
  | 'wedding:analytics:read'
  | 'wedding:wishes:moderate'
  | 'wedding:members:invite'
  | 'wedding:members:remove';

/** Read-only wedding actions that SUPPORT roles can access on any wedding */
const READONLY_WEDDING_ACTIONS = new Set<WeddingAction>([
  'wedding:read',
  'wedding:analytics:read',
]);

/**
 * Check if a user has a specific permission on a specific wedding.
 *
 * Checks BOTH:
 *   1. Platform-level bypass (via hasPlatformPermission — SUPER_ADMIN, CONSULTANT, SUPPORT)
 *   2. Per-wedding UserWeddingRole rows (Tier 2 + Tier 3 — CONSULTANT, COORDINATOR, EDITOR, VIEWER)
 *
 * @param userId    The authenticated user's ID
 * @param userRole  The user's platform role key
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
  // 1. Platform bypass check — users with platform:weddings:read get full access
  const hasFullBypass = await hasPlatformPermission(userId, userRole, 'platform:weddings:read');
  if (hasFullBypass) return true;

  // 2. Read-only bypass — users with platform:weddings:read-all get read-only access
  const hasReadonlyBypass = await hasPlatformPermission(userId, userRole, 'platform:weddings:read-all');
  if (hasReadonlyBypass) {
    return READONLY_WEDDING_ACTIONS.has(action);
  }

  // 3. Per-wedding role check — look up UserWeddingRole rows
  const weddingRoles = await db.userWeddingRole.findMany({
    where: { userId, weddingId },
    select: { role: true },
  });

  if (weddingRoles.length === 0) return false;

  // Check overrides for this user + action
  const overrides = await getUserOverrides(userId);
  if (overrides.has(action)) {
    return overrides.get(action)!;
  }

  // Check if ANY of the user's wedding roles grants the action
  for (const wr of weddingRoles) {
    const rolePerms = await getRolePermissions(wr.role);
    if (rolePerms.has('*')) return true; // COUPLE wildcard
    if (rolePerms.has(action)) return true;
  }

  return false;
}

/**
 * Get all wedding IDs a user has access to (any role).
 * Returns null if the user has cross-wedding access (platform bypass).
 */
export async function getAccessibleWeddingIds(
  userId: string,
  userRole: string,
): Promise<string[] | null> {
  // Platform bypass roles — return null to signal "all weddings"
  const hasFullBypass = await hasPlatformPermission(userId, userRole, 'platform:weddings:read');
  const hasReadonlyBypass = await hasPlatformPermission(userId, userRole, 'platform:weddings:read-all');
  if (hasFullBypass || hasReadonlyBypass) {
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
// SYNC CLIENT-SIDE FALLBACK (for 'use client' components)
// ============================================================
// Client components can't use async DB calls. This sync function provides
// a rough approximation for UI display (showing/hiding nav items, edit
// buttons, etc.). The API layer enforces the real DB-driven permission
// check — this is NOT a security boundary, just a UX convenience.
export function hasPlatformPermissionSync(role: string, action: PlatformAction): boolean {
  const normalized = normalizePlatformRole(role);
  if (!normalized) return false;

  // SUPER_ADMIN → everything
  if (normalized === 'SUPER_ADMIN') return true;

  // ACCOUNT_MANAGER_1 (Senior Consultant) — weddings + analytics + audit + templates
  if (normalized === 'ACCOUNT_MANAGER_1') {
    return [
      'platform:weddings:read',
      'platform:weddings:write',
      'platform:analytics:read',
      'platform:audit:read',
      'platform:templates:manage',
    ].includes(action);
  }

  // ACCOUNT_MANAGER_2 (Junior Coordinator) — weddings + analytics
  if (normalized === 'ACCOUNT_MANAGER_2') {
    return [
      'platform:weddings:read',
      'platform:weddings:write',
      'platform:analytics:read',
    ].includes(action);
  }

  // SUPPORT — read-only all weddings + analytics + audit
  if (normalized === 'SUPPORT') {
    return [
      'platform:weddings:read-all',
      'platform:analytics:read',
      'platform:audit:read',
    ].includes(action);
  }

  return false;
}

// ============================================================
// LEGACY COMPATIBILITY — normalizePlatformRole (sync, for UI routing)
// ============================================================
// Used by UI components (AdminCMSView, CoupleCMSView, GuestSite, etc.)
// that need to determine routing WITHOUT an async DB call.
// This is a simplified mapping — the real permission check happens
// in the API layer via the async hasPlatformPermission / hasWeddingPermission.

const LEGACY_PLATFORM_ROLE_MAP: Record<string, string> = {
  // New DB-driven vocabulary → intermediate vocabulary (for UI routing)
  SUPER_ADMIN_1: 'SUPER_ADMIN',
  SUPER_ADMIN_2: 'SUPER_ADMIN',
  CONSULTANT_1: 'ACCOUNT_MANAGER_1',
  CONSULTANT_2: 'ACCOUNT_MANAGER_1',
  COORDINATOR_1: 'ACCOUNT_MANAGER_2',
  SUPPORT_1: 'SUPPORT',
  SUPPORT_2: 'SUPPORT',
  COUPLE: 'COUPLE',
  // Phase 1-4 intermediate vocabulary
  SUPER_ADMIN: 'SUPER_ADMIN',
  ACCOUNT_MANAGER_1: 'ACCOUNT_MANAGER_1',
  ACCOUNT_MANAGER_2: 'ACCOUNT_MANAGER_2',
  SUPPORT: 'SUPPORT',
  // Legacy
  ADMIN_1: 'ACCOUNT_MANAGER_1',
  ADMIN_2: 'ACCOUNT_MANAGER_2',
  ADMIN_3: 'SUPPORT',
  ACCOUNT_MANAGER: 'ACCOUNT_MANAGER_1',
};

export type NormalizedPlatformRole =
  | 'SUPER_ADMIN'
  | 'ACCOUNT_MANAGER_1'
  | 'ACCOUNT_MANAGER_2'
  | 'SUPPORT'
  | 'COUPLE';

/**
 * Normalize a role string for UI routing purposes.
 * Returns undefined if the role is not recognized.
 *
 * NOTE: This is for UI routing ONLY. For actual permission checks in API
 * routes, use the async hasPlatformPermission() / hasWeddingPermission().
 */
export function normalizePlatformRole(role: string): NormalizedPlatformRole | undefined {
  return LEGACY_PLATFORM_ROLE_MAP[role] as NormalizedPlatformRole | undefined;
}

/**
 * Check if a role string is a recognized platform role.
 */
export function isPlatformRole(role: string): boolean {
  return role in LEGACY_PLATFORM_ROLE_MAP;
}

/**
 * Check if a role string is a recognized wedding role (Tier 2 or Tier 3).
 */
export function isWeddingRole(role: string): boolean {
  return [
    'CONSULTANT_1', 'CONSULTANT_2', 'COORDINATOR_1',
    'COUPLE', 'EDITOR', 'VIEWER',
  ].includes(role);
}

// ============================================================
// ROLE LABELS (for UI display)
// ============================================================

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN_1: 'Super Admin 1',
  SUPER_ADMIN_2: 'Super Admin 2',
  CONSULTANT_1: 'Consultant 1',
  CONSULTANT_2: 'Consultant 2',
  COORDINATOR_1: 'Coordinator 1',
  SUPPORT_1: 'Support 1',
  SUPPORT_2: 'Support 2',
  COUPLE: 'Couple',
  EDITOR: 'Editor',
  VIEWER: 'Viewer',
  // Legacy labels (for display of old data)
  SUPER_ADMIN: 'Super Admin (Legacy)',
  ACCOUNT_MANAGER: 'Account Manager (Legacy)',
  ACCOUNT_MANAGER_1: 'Account Manager 1 (Legacy)',
  ACCOUNT_MANAGER_2: 'Account Manager 2 (Legacy)',
  SUPPORT: 'Support (Legacy)',
  ADMIN_1: 'Admin 1 (Legacy)',
  ADMIN_2: 'Admin 2 (Legacy)',
  ADMIN_3: 'Admin 3 (Legacy)',
};

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

// ============================================================
// ALL PERMISSIONS (for UI — role editor checkbox list)
// ============================================================

export const ALL_PLATFORM_PERMISSIONS: PlatformAction[] = [
  'platform:users:manage',
  'platform:weddings:read',
  'platform:weddings:write',
  'platform:weddings:read-all',
  'platform:settings:read',
  'platform:settings:write',
  'platform:analytics:read',
  'platform:audit:read',
  'platform:templates:manage',
];

export const ALL_WEDDING_PERMISSIONS: WeddingAction[] = [
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
];

export const ALL_PERMISSIONS = [...ALL_PLATFORM_PERMISSIONS, ...ALL_WEDDING_PERMISSIONS];

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
