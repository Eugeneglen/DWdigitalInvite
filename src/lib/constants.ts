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
export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Platform Admin',
  ACCOUNT_MANAGER: 'Account Manager',
  COUPLE: 'Couple',
  ADMIN_1: 'Consultant',
  ADMIN_2: 'Coordinator',
  ADMIN_3: 'Operations Staff',
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
