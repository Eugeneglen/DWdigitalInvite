/**
 * R-08 (F-08) — Login brute-force protection.
 *
 * Progressive, dual-axis throttling for ALL authentication entry points
 * (custom /api/auth/login route AND the NextAuth credentials provider).
 *
 * ── Policy (deliberately NOT a simplistic permanent lockout) ──────────────────
 *
 * ACCOUNT axis (keyed by the NORMALIZED ATTEMPTED EMAIL — existence-agnostic,
 * so throttling behaviour cannot be used to enumerate accounts):
 *   - Failures 1–4: normal 401 responses (no lock).
 *   - Failure 5: 30s cooldown, then 1m, 2m, 5m, 15m, capped at 30m (failure 10+).
 *   - Cooldowns are temporary blocks — attempts during a cooldown are rejected
 *     immediately and do NOT extend the cooldown (prevents an attacker from
 *     keeping an account permanently locked by hammering it).
 *   - Automatic recovery: if no failure occurs for ACCOUNT_DECAY_MS (15 min),
 *     the counter resets. A legitimate user never needs manual intervention.
 *   - A successful login clears the account's failure state.
 *
 * IP axis (keyed by source IP from X-Forwarded-For, which the deployment
 * proxies overwrite — see extractClientIp):
 *   - 30 failures of ANY kind (unknown accounts included) within a 10-minute
 *     window → 15-minute block of ALL login attempts from that IP.
 *   - Success does NOT clear the IP window (an attacker who controls one
 *     valid account must not be able to reset IP state at will).
 *   - This is what catches identifier rotation (random emails, casing
 *     variants, etc.) — the account axis alone cannot.
 *
 * ── Storage ───────────────────────────────────────────────────────────────────
 * In-memory, process-local (same trade-off as src/lib/rate-limit.ts).
 * Correct for local development and the current single-container Railway
 * deployment. NOT distributed-safe: multiple app instances / horizontal
 * scaling would each track their own counters — see final report
 * ("Remaining risks"). No Redis/external infrastructure introduced.
 *
 * ── Audit ─────────────────────────────────────────────────────────────────────
 * Every failed/successful/throttled attempt is written to AuditLog with a
 * reason category and source IP. NEVER logs passwords, hashes, tokens or any
 * secret material — only the attempted (truncated) email identifier.
 */

import { db } from '@/lib/db';

// ── Policy constants (single source of truth) ────────────────────────────────

/** Failures allowed before the first cooldown is imposed. */
const ACCOUNT_FREE_FAILURES = 4;
/** Cooldown (ms) imposed on the Nth consecutive failure (index = failure count). */
const ACCOUNT_COOLDOWN_STEPS_MS = [
  0, // 1
  0, // 2
  0, // 3
  0, // 4
  30_000, // 5  → 30 seconds
  60_000, // 6  → 1 minute
  120_000, // 7  → 2 minutes
  300_000, // 8  → 5 minutes
  900_000, // 9  → 15 minutes
  1_800_000, // 10+ → 30 minutes (cap)
];
const ACCOUNT_COOLDOWN_CAP_MS = 1_800_000;
/** Consecutive-failure counter resets after this much inactivity. */
const ACCOUNT_DECAY_MS = 15 * 60_000;

/** IP window: failures before the source is blocked. */
const IP_MAX_FAILURES_PER_WINDOW = 30;
const IP_WINDOW_MS = 10 * 60_000;
const IP_BLOCK_MS = 15 * 60_000;

/** Periodic cleanup of stale throttle entries. */
// (interval configured in ensureCleanup above)

interface AccountEntry {
  failCount: number;
  lastFailAt: number;
  lockedUntil: number;
}

interface IpEntry {
  windowFailCount: number;
  windowStart: number;
  blockedUntil: number;
}

interface ThrottleState {
  accounts: Map<string, AccountEntry>;
  ips: Map<string, IpEntry>;
  cleanupTimer: ReturnType<typeof setInterval> | null;
}

/**
 * The throttle state MUST be shared by every authentication entry point
 * (custom /api/auth/login route AND the NextAuth credentials provider).
 * Next.js compiles route handlers into separate bundles that may each get
 * their own copy of this module, so a plain module-level Map would give each
 * login path an INDEPENDENT failure budget (an attacker could alternate
 * endpoints to double their allowance). Anchoring the Maps on globalThis
 * guarantees one store per server process regardless of bundling.
 */
const throttleGlobal = globalThis as unknown as {
  __dwLoginThrottleState?: ThrottleState;
};

function getThrottleState(): ThrottleState {
  if (!throttleGlobal.__dwLoginThrottleState) {
    throttleGlobal.__dwLoginThrottleState = {
      accounts: new Map(),
      ips: new Map(),
      cleanupTimer: null,
    };
  }
  return throttleGlobal.__dwLoginThrottleState;
}

const CLEANUP_INTERVAL_MS = 60_000;

function ensureCleanup(): void {
  const state = getThrottleState();
  if (!state.cleanupTimer) {
    state.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of state.accounts) {
        // Entry is stale once fully decayed and any cooldown has expired.
        if (now - entry.lastFailAt > ACCOUNT_DECAY_MS && entry.lockedUntil <= now) {
          state.accounts.delete(key);
        }
      }
      for (const [key, entry] of state.ips) {
        if (now - entry.windowStart > IP_WINDOW_MS && entry.blockedUntil <= now) {
          state.ips.delete(key);
        }
      }
    }, CLEANUP_INTERVAL_MS);
    // Don't hold the event loop open just for cleanup.
    if (typeof state.cleanupTimer.unref === 'function') state.cleanupTimer.unref();
  }
}

// ── IP extraction ────────────────────────────────────────────────────────────

/**
 * Extracts the client IP from request headers.
 *
 * Trust model: the deployed architecture fronts the app with a proxy that
 * OVERWRITES X-Forwarded-For with the actual remote host (Caddy `header_up
 * X-Forwarded-For {remote_host}` in this sandbox; Railway's edge in
 * production), so the first XFF value is the real client. If the app were
 * ever exposed directly (no trusted proxy), a client could spoof XFF to
 * rotate IP-throttle keys — the ACCOUNT axis is unaffected (it does not
 * depend on IP). Documented limitation; no change made to proxies.
 *
 * Accepts both a `Headers` instance and a plain record (NextAuth passes a
 * plain object to authorize()).
 */
export function extractClientIp(headers: Headers | Record<string, unknown> | undefined | null): string {
  let raw: string | null = null;
  if (!headers) return 'unknown';
  if (typeof (headers as Headers).get === 'function') {
    raw = (headers as Headers).get('x-forwarded-for');
  } else {
    const rec = headers as Record<string, string>;
    raw = rec['x-forwarded-for'] ?? rec['X-Forwarded-For'] ?? null;
  }
  return raw?.split(',')[0]?.trim() || 'unknown';
}

/** Login identifier normalization — MUST match the login routes' email
 *  normalization so casing/whitespace tricks cannot split the throttle key. */
export function normalizeLoginIdentifier(email: string): string {
  return email.trim().toLowerCase().slice(0, 254);
}

// ── Decision + recording ─────────────────────────────────────────────────────

export interface LoginGate {
  /** false → the attempt must be rejected before credential evaluation. */
  allowed: boolean;
  /** Seconds until the blocking cooldown expires (present when !allowed). */
  retryAfterSec?: number;
}

function cooldownFor(failCount: number): number {
  // steps[] is indexed from 0 for the 1st failure, so the Nth consecutive
  // failure reads index N-1. Failures beyond the table cap at 30 minutes.
  const idx = Math.min(failCount - 1, ACCOUNT_COOLDOWN_STEPS_MS.length - 1);
  return Math.max(
    ACCOUNT_COOLDOWN_STEPS_MS[idx],
    failCount > ACCOUNT_COOLDOWN_STEPS_MS.length ? ACCOUNT_COOLDOWN_CAP_MS : 0,
  );
}

/**
 * Consult BEFORE evaluating credentials. Pure read — recording happens in
 * recordLoginFailure / recordLoginSuccess so callers control the audit trail.
 */
export function checkLoginAllowed(normalizedEmail: string, ip: string): LoginGate {
  ensureCleanup();
  const now = Date.now();
  const { accounts, ips } = getThrottleState();

  const ipEntry = ips.get(ip);
  if (ipEntry && ipEntry.blockedUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((ipEntry.blockedUntil - now) / 1000) };
  }

  const acct = accounts.get(normalizedEmail);
  if (acct && acct.lockedUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((acct.lockedUntil - now) / 1000) };
  }

  return { allowed: true };
}

export type LoginFailureReason =
  | 'ACCOUNT_NOT_FOUND'
  | 'WRONG_PASSWORD'
  | 'ACCOUNT_INACTIVE'
  | 'EXPIRED_WEDDING';

/**
 * Records a failed credential evaluation and applies the progressive policy.
 * Returns the resulting lock (if the account just entered a cooldown).
 */
export function recordLoginFailure(
  normalizedEmail: string,
  ip: string,
  reason: LoginFailureReason,
): LoginGate | null {
  ensureCleanup();
  const now = Date.now();
  const { accounts, ips } = getThrottleState();

  // ── Account axis ──
  let acct = accounts.get(normalizedEmail);
  if (!acct || now - acct.lastFailAt > ACCOUNT_DECAY_MS) {
    // New entry, or the counter fully decayed after a quiet period.
    acct = { failCount: 0, lastFailAt: now, lockedUntil: 0 };
  }
  acct.failCount += 1;
  acct.lastFailAt = now;
  if (acct.failCount > ACCOUNT_FREE_FAILURES) {
    acct.lockedUntil = now + cooldownFor(acct.failCount);
  }
  accounts.set(normalizedEmail, acct);

  // ── IP axis ──
  let ipEntry = ips.get(ip);
  if (!ipEntry || now - ipEntry.windowStart > IP_WINDOW_MS) {
    ipEntry = { windowFailCount: 0, windowStart: now, blockedUntil: 0 };
  }
  ipEntry.windowFailCount += 1;
  if (ipEntry.windowFailCount >= IP_MAX_FAILURES_PER_WINDOW && ipEntry.blockedUntil <= now) {
    ipEntry.blockedUntil = now + IP_BLOCK_MS;
    // Fresh window after the block is imposed.
    ipEntry.windowStart = now;
    ipEntry.windowFailCount = 0;
  }
  ips.set(ip, ipEntry);

  const lockedUntil = Math.max(acct.lockedUntil, ipEntry.blockedUntil);
  if (lockedUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((lockedUntil - now) / 1000) };
  }
  return null;
}

/** Clears the account failure state after successful authentication. */
export function recordLoginSuccess(normalizedEmail: string): void {
  getThrottleState().accounts.delete(normalizedEmail);
}

// ── Audit trail ──────────────────────────────────────────────────────────────

export type LoginAuditEvent =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_THROTTLED'
  | `LOGIN_FAILED_${LoginFailureReason}`;

interface LoginAuditParams {
  event: LoginAuditEvent;
  /** Resolved user id when the account exists (null for unknown accounts). */
  userId: string | null;
  /** Normalized attempted identifier (attacker-controlled input; truncated). */
  attemptedEmail: string;
  ip: string;
  userAgent?: string | null;
}

/**
 * Writes a login audit row. AuditLog.userId is nullable, so unknown-account
 * attempts are attributable by email+IP without inventing sentinel users.
 * NEVER include password material, hashes, tokens or secrets here.
 */
export async function logLoginEvent(params: LoginAuditParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId,
        action: params.event,
        entity: 'Auth',
        entityId: params.userId,
        details: JSON.stringify({
          attemptedEmail: params.attemptedEmail.slice(0, 254),
          ip: params.ip,
          ...(params.userAgent ? { userAgent: params.userAgent.slice(0, 256) } : {}),
        }),
        ipAddress: params.ip,
      },
    });
  } catch {
    // Audit logging is non-critical — never block the auth path on it.
  }
}

// ── Timing equalization ──────────────────────────────────────────────────────

/**
 * Constant bcrypt hash used ONLY to equalize response timing when the account
 * does not exist (or is inactive), so "user not found" is indistinguishable
 * from "wrong password" by wall-clock measurement. This is a decoy value —
 * it is nobody's password and is never accepted as one.
 */
const DUMMY_BCRYPT_HASH =
  '$2b$12$XIk4QQ7yWk9LhElDlOxEO.HpZPTJcXjvSb/1Wc3Yy2RrURQmzEBuG';

/** Runs a bcrypt comparison against the decoy hash (fire-and-forget result). */
export async function equalizeLoginTiming(password: string): Promise<void> {
  const { default: bcrypt } = await import('bcryptjs');
  await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
}
