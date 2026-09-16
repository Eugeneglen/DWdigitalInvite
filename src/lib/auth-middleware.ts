import { db } from '@/lib/db';
import { getServerSession } from './auth';
import { getIpAddress } from './auth';
import {
  normalizePlatformRole,
  hasPlatformPermission,
  hasWeddingPermission,
  type PlatformAction,
  type WeddingAction,
} from '@/lib/permissions';

export interface AuthContext {
  user: {
    userId: string;
    email: string;
    name: string;
    role: string;
    tenantId?: string;
    tenantRole?: string;
  } | null;
  error: string | null;
}

/**
 * Validates a request using the NextAuth session cookie.
 * Returns the authenticated user context compatible with existing route code.
 */
export async function authenticateRequest(request: Request): Promise<AuthContext> {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return { user: null, error: 'Authentication required. Please log in.' };
    }

    // For couple users, resolve their wedding account as tenantId
    let tenantId: string | undefined;
    let tenantRole: string | undefined;
    if (normalizePlatformRole(session.user.role) === 'COUPLE') {
      const wedding = await db.weddingAccount.findFirst({
        where: { ownerId: session.user.id },
        select: { id: true },
      });
      tenantId = wedding?.id;
      tenantRole = 'admin'; // Couple users are admins of their own wedding
    }

    return {
      user: {
        userId: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
        tenantId,
        tenantRole,
      },
      error: null,
    };
  } catch {
    return { user: null, error: 'Authentication failed. Please try again.' };
  }
}

/**
 * Creates an audit log entry using correct Prisma schema field names.
 */
export async function createAuditLog(params: {
  userId: string;
  action: string;
  resource?: string;
  resourceId?: string;
  weddingId?: string;
  details?: Record<string, unknown>;
  request?: Request;
}): Promise<void> {
  const { userId, action, resource, resourceId, weddingId, details, request } = params;

  try {
    await db.auditLog.create({
      data: {
        userId,
        action,
        entity: resource || null,
        entityId: resourceId || null,
        weddingId: weddingId || null,
        details: details ? JSON.stringify(details) : null,
        ipAddress: request ? getIpAddress(request) : null,
      },
    });
  } catch {
    // Audit logging is non-critical — don't block the main operation
  }
}

// ============================================================
// TENANT ACCESS GUARD (R-03 / F-03 — cross-tenant IDOR fix)
// ============================================================
// Establishes, in strict order, BEFORE any database operation:
//   authenticated user → requested wedding resolved → relationship
//   (platform staff / owner / member) → permission.
// The wedding id ALWAYS comes from the URL and is validated against the
// authenticated user — a client-supplied id alone is never trusted.

export interface TenantGuardOptions {
  /** Platform permission that grants platform-side staff access to any wedding. */
  platformPerm: PlatformAction;
  /** Wedding-domain action required on the owner/member path. */
  weddingAction?: WeddingAction;
  /** If true, ONLY platform staff may access (owner/member path disabled) —
   *  used for account-level operations (tenant directory, status/plan/slug,
   *  account deletion). */
  platformOnly?: boolean;
}

export type TenantGuardResult =
  | { ok: true; wedding: { id: string; ownerId: string | null; status: string } }
  | { ok: false; status: number; error: string };

export async function authorizeTenantAccess(
  user: NonNullable<AuthContext['user']>,
  weddingId: string,
  opts: TenantGuardOptions,
): Promise<TenantGuardResult> {
  // 1. Resolve the requested wedding — unknown ids never proceed.
  const wedding = await db.weddingAccount.findUnique({
    where: { id: weddingId },
    select: { id: true, ownerId: true, status: true },
  });
  if (!wedding) {
    return { ok: false, status: 404, error: 'Wedding account not found' };
  }

  // 2. Platform-staff path — Dreamweavers staff manage all weddings.
  //    (hasPlatformPermission fails closed for account-tier roles since R-01,
  //    so a Couple can never take this branch.)
  if (await hasPlatformPermission(user.userId, user.role, opts.platformPerm)) {
    return { ok: true, wedding };
  }

  if (opts.platformOnly) {
    return { ok: false, status: 403, error: 'Access denied. Platform privileges required.' };
  }

  // 3. Owner path — the couple who owns this wedding. Ownership is resolved
  //    server-side from WeddingAccount.ownerId (master/weddings does not
  //    create UserWeddingRole rows for couples, so this is the authoritative
  //    couple relationship).
  if (wedding.ownerId === user.userId) {
    return { ok: true, wedding };
  }

  // 4. Member path — explicit per-wedding role assignment
  //    (EDITOR / VIEWER / staff with UserWeddingRole rows).
  const membership = await db.userWeddingRole.findFirst({
    where: { userId: user.userId, weddingId },
    select: { id: true },
  });
  if (!membership) {
    return { ok: false, status: 403, error: 'Access denied. You do not have access to this wedding.' };
  }

  // 5. Wedding-scoped permission for members.
  if (
    opts.weddingAction &&
    (await hasWeddingPermission(user.userId, user.role, weddingId, opts.weddingAction))
  ) {
    return { ok: true, wedding };
  }

  return { ok: false, status: 403, error: 'Access denied. You do not have permission to perform this action.' };
}
