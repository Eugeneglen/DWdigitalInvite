// ── Feature keys & labels (client-safe — no Node.js / NextAuth deps) ────
// Canonical feature key for Q&A is 'qa' (NOT 'faq'). All code uses 'qa'.
export const FEATURE_KEYS = {
  RSVP: 'rsvp',
  WISHES: 'wishes',
  STORY: 'story',
  GALLERY: 'gallery',
  SCHEDULE: 'schedule',
  MOMENTS: 'moments',
  GETTING_THERE: 'getting-there',
  COUNTDOWN: 'countdown',
  MUSIC: 'music',
  VIDEO: 'video',
  QA: 'qa',
} as const;

export const FEATURE_LABELS: Record<string, string> = {
  rsvp: 'RSVP',
  wishes: 'Wishes',
  story: 'Our Story',
  gallery: 'Photo Gallery',
  schedule: 'Event Schedule',
  moments: 'Moments',
  'getting-there': 'Getting There',
  countdown: 'Countdown',
  music: 'Background Music',
  video: 'Wedding Video',
  templates: 'Theme Templates',
  qa: 'Q&A',
};

export const GLOBAL_FEATURE_LABELS: Record<string, string> = {
  ...FEATURE_LABELS,
};

// ── Role labels ─────────────────────────────────────────────────────
// New 3-tier vocabulary + legacy values (for backward compatibility)
export const ROLE_LABELS: Record<string, string> = {
  // Tier 1 — Platform roles
  SUPER_ADMIN: 'Super Admin',
  ACCOUNT_MANAGER_1: 'Account Manager (Senior)',
  ACCOUNT_MANAGER_2: 'Account Manager (Junior)',
  SUPPORT: 'Support (Read-only)',
  COUPLE: 'Couple',
  // Legacy values (normalized at runtime — kept for display of existing DB rows)
  ACCOUNT_MANAGER: 'Account Manager (Legacy)',
  ADMIN_1: 'Consultant (Legacy → Account Manager Senior)',
  ADMIN_2: 'Coordinator (Legacy → Account Manager Junior)',
  ADMIN_3: 'Operations Staff (Legacy → Support)',
};

export const TENANT_ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
};

// ── Package labels ──────────────────────────────────────────────────
export const PACKAGE_LABELS: Record<string, string> = {
  GOLD: 'Gold',
  PLATINUM: 'Platinum',
  DIAMOND: 'Diamond',
};

// ── Account status labels (lifecycle) ───────────────────────────────
export const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  ONBOARDING: 'Onboarding',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  EXPIRED: 'Expired',
  SUSPENDED: 'Suspended',
};
