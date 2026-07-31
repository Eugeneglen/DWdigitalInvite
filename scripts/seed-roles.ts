/**
 * Seed default roles into the Role table.
 *
 * Creates 8 default roles matching the agreed vocabulary:
 *   SUPER_ADMIN_1, SUPER_ADMIN_2 (system, full access — backup for each other)
 *   CONSULTANT_1, CONSULTANT_2, COORDINATOR_1 (wedding staff, editable)
 *   SUPPORT_1, SUPPORT_2 (read-only, editable)
 *   COUPLE (system, account owner)
 *
 * Idempotent — uses upsert, safe to re-run.
 *
 * Usage: bun run scripts/seed-roles.ts
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// All permission strings (must match src/lib/permissions.ts PlatformAction + WeddingAction)
const PLATFORM_PERMISSIONS = [
  'platform:users:manage',
  'platform:weddings:read',
  'platform:weddings:write',
  'platform:settings:read',
  'platform:settings:write',
  'platform:analytics:read',
  'platform:audit:read',
  'platform:templates:manage',
  'platform:weddings:read-all',
] as const;

const WEDDING_PERMISSIONS = [
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
] as const;

const ALL_PERMISSIONS = [...PLATFORM_PERMISSIONS, ...WEDDING_PERMISSIONS];

// Helper: wildcard '*' means all permissions
const WILDCARD = ['*'];

interface RoleSeed {
  key: string;
  label: string;
  tier: string;
  isSystem: boolean;
  permissions: string[];
  sortOrder: number;
}

const ROLES: RoleSeed[] = [
  {
    key: 'SUPER_ADMIN_1',
    label: 'Super Admin 1',
    tier: 'platform',
    isSystem: true,
    permissions: WILDCARD, // full access
    sortOrder: 1,
  },
  {
    key: 'SUPER_ADMIN_2',
    label: 'Super Admin 2',
    tier: 'platform',
    isSystem: true,
    permissions: WILDCARD, // full access (backup for Super Admin 1)
    sortOrder: 2,
  },
  {
    key: 'CONSULTANT_1',
    label: 'Consultant 1',
    tier: 'wedding_staff',
    isSystem: false,
    permissions: [
      // Platform
      'platform:weddings:read',
      'platform:weddings:write',
      'platform:analytics:read',
      'platform:audit:read',
      'platform:templates:manage',
      // Wedding (full, via per-wedding assignment)
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
    ],
    sortOrder: 3,
  },
  {
    key: 'CONSULTANT_2',
    label: 'Consultant 2',
    tier: 'wedding_staff',
    isSystem: false,
    permissions: [
      // Platform
      'platform:weddings:read',
      // Wedding (content + media only)
      'wedding:read',
      'wedding:content:write',
      'wedding:media:write',
    ],
    sortOrder: 4,
  },
  {
    key: 'COORDINATOR_1',
    label: 'Coordinator 1',
    tier: 'wedding_staff',
    isSystem: false,
    permissions: [
      // Platform
      'platform:weddings:read',
      // Wedding (guests + rsvps + schedule only)
      'wedding:read',
      'wedding:guests:write',
      'wedding:rsvps:read',
      'wedding:rsvps:manage',
      'wedding:schedule:write',
    ],
    sortOrder: 5,
  },
  {
    key: 'SUPPORT_1',
    label: 'Support 1',
    tier: 'platform',
    isSystem: false,
    permissions: [
      // Read-only across all weddings + analytics + audit
      'platform:weddings:read-all',
      'platform:analytics:read',
      'platform:audit:read',
      'wedding:read',
      'wedding:analytics:read',
    ],
    sortOrder: 6,
  },
  {
    key: 'SUPPORT_2',
    label: 'Support 2',
    tier: 'platform',
    isSystem: false,
    permissions: [
      // Read-only across all weddings (no analytics/audit)
      'platform:weddings:read-all',
      'wedding:read',
    ],
    sortOrder: 7,
  },
  {
    key: 'COUPLE',
    label: 'Couple',
    tier: 'account',
    isSystem: true,
    permissions: WILDCARD, // full control of their own wedding (scoped by hasWeddingPermission)
    sortOrder: 8,
  },
  {
    key: 'EDITOR',
    label: 'Editor',
    tier: 'account',
    isSystem: true, // couple-invited, can't delete
    permissions: [
      'wedding:read',
      'wedding:content:write',
      'wedding:media:write',
      'wedding:analytics:read',
    ],
    sortOrder: 9,
  },
  {
    key: 'VIEWER',
    label: 'Viewer',
    tier: 'account',
    isSystem: true, // couple-invited, can't delete
    permissions: [
      'wedding:read',
      'wedding:analytics:read',
    ],
    sortOrder: 10,
  },
];

async function main() {
  console.log('━'.repeat(60));
  console.log('Seeding default roles');
  console.log('━'.repeat(60));

  for (const role of ROLES) {
    await db.role.upsert({
      where: { key: role.key },
      update: {
        label: role.label,
        tier: role.tier,
        isSystem: role.isSystem,
        permissions: JSON.stringify(role.permissions),
        sortOrder: role.sortOrder,
      },
      create: {
        key: role.key,
        label: role.label,
        tier: role.tier,
        isSystem: role.isSystem,
        permissions: JSON.stringify(role.permissions),
        sortOrder: role.sortOrder,
      },
    });
    const permCount = role.permissions.includes('*') ? 'ALL (wildcard)' : `${role.permissions.length} permissions`;
    console.log(`  ✓ ${role.key} (${role.label}) [${role.tier}] ${role.isSystem ? '🔒 system' : 'editable'} — ${permCount}`);
  }

  console.log('');
  console.log(`✅ ${ROLES.length} roles seeded.`);
  console.log('');

  // Summary
  const allRoles = await db.role.findMany({ orderBy: { sortOrder: 'asc' } });
  console.log('=== Final Role table state ===');
  for (const r of allRoles) {
    const perms = JSON.parse(r.permissions) as string[];
    console.log(`  ${r.sortOrder}. ${r.key} | ${r.label} | ${r.tier} | ${r.isSystem ? 'system' : 'editable'} | ${perms.includes('*') ? 'ALL' : perms.length + ' perms'}`);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
