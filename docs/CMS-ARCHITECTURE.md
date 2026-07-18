# DWdigitalInvite — CMS Architecture Specification

**Dreamweavers PTL | Version 1.0 | Confidential**

*Production-ready Content Management System architecture for the DWdigitalInvite digital wedding invitation platform. Designed for immediate implementation by UI/UX designers and software engineers.*

---

## 1. Executive Architecture Overview

### 1.1 Platform Model

DWdigitalInvite operates a **B2B2C multi-tenant SaaS model**. Dreamweavers (the platform owner) creates and manages wedding invitation accounts. Each wedding couple receives an isolated workspace to configure their digital invitation. Guests interact only with the published wedding website — never with any CMS.

```
┌─────────────────────────────────────────────────────────────────┐
│                     INTERNET / GUESTS                          │
│                         │                                     │
│              ┌──────────▼──────────┐                         │
│              │  Wedding Website     │  (Public, read-only)    │
│              │  /{slug}             │  Guest-facing pages:    │
│              │                      │  Home, Schedule, RSVP,    │
│              │  Per-wedding site    │  Story, Wishes, etc.   │
│              └──────────┬──────────┘                         │
│                         │                                     │
│              ┌──────────▼──────────┐                         │
│              │  Couple CMS          │  (Protected, per-wedding)│
│              │  /workspace           │  16 pages, content      │
│              │                      │  editing, guest mgmt     │
│              └──────────┬──────────┘                         │
│                         │                                     │
│              ┌──────────▼──────────┐                         │
│              │  Master CMS          │  (Protected, platform)  │
│              │  /admin              │  Account mgmt, features, │
│              │                      │  analytics, settings     │
│              └──────────┬──────────┘                         │
│                         │                                     │
│              ┌──────────▼──────────┐                         │
│              │  Platform Services   │  API layer, auth, media, │
│              │  (Next.js API Routes) │  notifications, jobs     │
│              └──────────┬──────────┘                         │
│                         │                                     │
│              ┌──────────▼──────────┐                         │
│              │  Data Layer          │  Prisma ORM → SQLite    │
│              │  (Multi-tenant)      │  (future: PostgreSQL)   │
│              └─────────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Communication Flow

| From | To | Protocol | Purpose |
|------|----|----------|---------|
| Guest Browser | Wedding Website | HTTPS | View invitation, submit RSVP, send wish |
| Couple Browser | Couple CMS | HTTPS + WebSocket | Edit content, manage guests, view analytics |
| Admin Browser | Master CMS | HTTPS + WebSocket | Manage platform, accounts, features |
| Couple CMS | Platform API | REST (JSON) | CRUD content, media, guests, settings |
| Master CMS | Platform API | REST (JSON) | CRUD accounts, users, features, analytics |
| Platform API | Database | Prisma ORM | All data persistence |
| Platform API | External Services | HTTPS | Email (Resend), SMS, CDN, analytics |
| Platform API | Scheduled Jobs | Internal | Reminders, expirations, aggregations |

### 1.3 Technology Stack (Current)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 16 (App Router) | `output: "standalone"` |
| Language | TypeScript 5 | Strict mode |
| Styling | Tailwind CSS 4 + shadcn/ui | New York style, Lucide icons |
| Database | SQLite via Prisma ORM | Multi-tenant via `weddingId` FK |
| Auth | NextAuth v4 | Credentials provider, JWT strategy |
| State | Zustand | `useCMSStore` (admin), `useCoupleCMSStore` (couple) |
| Fonts | Playfair Display, Inter | Brand typography |

### 1.4 Key Architectural Decisions

**Multi-tenancy via column, not database.** Every data row carries a `weddingId` foreign key. This keeps the system on a single SQLite file for simplicity while ensuring complete data isolation. Migration to PostgreSQL would require zero schema changes — only the connection string.

**Two separate CMS frontends, one API.** The Master CMS and Couple CMS share the same Next.js API routes but have entirely separate UI layouts, navigation, and permission contexts. A `role` field on the JWT (`SUPER_ADMIN`, `ACCOUNT_MANAGER`, `COUPLE`) gates access at the API layer.

**Content stored as EAV (Entity-Attribute-Value).** `WeddingContent` uses `section + fieldKey + fieldValue` triples. This allows any number of content sections without schema migrations. The trade-off is weaker type safety — mitigated by a `fieldType` discriminator (`TEXT`, `RICHTEXT`, `IMAGE_URL`, `JSON`, `NUMBER`, `BOOLEAN`).

**Feature flags per wedding.** `WeddingFeature` stores `isEnabled` per `featureKey` per wedding. Dreamweavers toggles features globally; couples see only enabled features in their CMS navigation.

---

## 2. Information Architecture

### 2.1 URL Structure

```
/                           → Wedding site (guest-facing, slug-based)
/?view=couple               → Couple CMS login gate (shows CMS chrome + login modal)
/?view=cms                  → Admin CMS login gate (shows CMS chrome + login modal)
/workspace                  → Couple CMS (authenticated, sidebar + content area)
/workspace/content          → Content editor (8 page types, sections, blocks)
/workspace/media            → Media library (upload, gallery, management)
/workspace/settings         → Account settings, feature flags, publishing
/admin                      → Master CMS (authenticated, sidebar + content area)
/admin/accounts             → Wedding account management
/admin/features             → Feature toggle management
/admin/settings             → Platform configuration
/admin/audit-logs           → Audit trail
/api/auth/[...nextauth]     → NextAuth endpoints
/api/auth/login             → Login endpoint
/api/auth/forgot-password  → Password recovery
/api/admin                  → Platform admin API
/api/cms/wedding            → Couple's wedding data
/api/workspace/content      → Couple content CRUD
/api/workspace/media        → Couple media CRUD
/api/workspace/settings     → Couple settings
```

### 2.2 Data Hierarchy

```
Dreamweavers (Platform Owner)
├── Users (SUPER_ADMIN, ADMIN_1/2/3, ACCOUNT_MANAGER)
├── System Settings (global config)
├── Templates & Themes (platform-level assets)
│
├── Wedding Account 1 (slug: "eleanor-james-2027")
│   ├── Owner (User with COUPLE role)
│   ├── Features (per-wedding toggles)
│   ├── Content (EAV sections: hero, schedule, story, rsvp, etc.)
│   ├── Media (images, videos, categorized)
│   ├── Schedules (ceremony, reception, tea ceremony, etc.)
│   ├── FAQs
│   ├── Story Items (timeline entries)
│   ├── Guests (with invitation codes, RSVP status, table assignments)
│   ├── RSVP Submissions + Guest Responses
│   ├── Wishes
│   ├── Contact Submissions
│   ├── Notifications
│   └── Audit Logs
│
├── Wedding Account 2 (slug: "sarah-chen-2028")
│   └── ... (same structure, completely isolated)
│
└── Wedding Account N
```

### 2.3 Existing CMS Navigation Maps

**Master CMS (6 pages):**
| Page | Key | Description |
|------|-----|-------------|
| Dashboard | `dashboard` | Platform-wide KPIs: total accounts, active sites, guests, RSVPs, wishes, contacts |
| Wedding Accounts | `weddings` | CRUD wedding accounts, status management, plan assignment |
| Content Templates | `templates` | Pre-built content templates for couples |
| Analytics | `analytics` | Platform analytics: feature usage, traffic, conversions |
| Settings | `settings` | Platform configuration: branding, defaults, integrations |
| Users | `users` | User management: create admins, assign roles, deactivate |

**Couple CMS (16 pages):**
| Page | Key | Description |
|------|-----|-------------|
| Overview | `overview` | Wedding summary, quick stats, recent activity |
| Your Details | `details` | Bride/groom names, date, venue, contact |
| Content | `content` | All content sections editor |
| Home | `home` | Hero section, welcome message, countdown |
| Schedule | `schedule` | Event timeline (ceremony, reception, etc.) |
| RSVPs | `rsvps` | RSVP submissions, attendance tracking |
| Getting There | `getting-there` | Venue, maps, transportation, accommodation |
| Our Story | `story` | Couple's love story timeline |
| Wishes | `wishes` | Guest wish messages, moderation |
| FAQs | `faqs` | Frequently asked questions |
| Moments | `moments` | Photo/video gallery |
| Guests | `guests` | Guest list management, import, export |
| Analytics | `analytics` | Invitation opens, RSVP rates, traffic |
| Activity | `audit` | Change history, action log |
| Sharing | `sharing` | Invitation link, QR code, social sharing |
| Features | `features` | Feature visibility toggles (read-only, set by admin) |

---

## 3. CMS Navigation — Full Design

### 3.1 Master CMS Navigation (Dreamweavers Admin)

The Master CMS uses a collapsible dark sidebar (`bg-charcoal-ink`, shadcn/ui `Sidebar` component). Navigation is state-driven via `useCMSStore`.

#### Primary Navigation

| Item | Icon | Sub-Pages | Description |
|------|------|-----------|-------------|
| **Dashboard** | `LayoutDashboard` | — | Platform KPIs, recent activity feed, system health |
| **Wedding Accounts** | `Heart` | Account list, Account detail, Create account | Full lifecycle management of all weddings |
| **Customers** | `Users` | Customer list, Detail | Customer profiles, communication history |
| **Templates** | `FileText` | Template library, Template editor, Template preview | Pre-built content and theme templates |
| **Invitation Themes** | `Palette` | Theme gallery, Theme builder, Theme settings | Visual themes for wedding websites |
| **Feature Manager** | `ToggleLeft` | Feature list, Feature config, Feature rollout | Enable/disable/configure platform features |
| **Media Library** | `ImageIcon` | Platform media, Shared assets | Platform-level media assets |
| **Analytics** | `BarChart3` | Overview, Per-wedding, Traffic, Conversions | Platform-wide analytics and reporting |
| **Notifications** | `Bell` | Notification center, Templates, Broadcast | System notifications and announcement templates |
| **Payments** | `CreditCard` | Transactions, Subscriptions, Invoices | Billing and payment management |
| **Subscription** | `Receipt` | Plans, Upgrade flows, Trial management | Plan configuration and subscription lifecycle |
| **Reports** | `BarChart` | Custom reports, Exports, Scheduled reports | Report generation and scheduling |
| **Support Tickets** | `MessageSquare` | Ticket list, Ticket detail, Ticket assignment | Customer support workflow |
| **Audit Logs** | `ScrollText` | Log viewer, Filters, Exports | Complete audit trail |
| **Settings** | `Settings` | General, Branding, Email, SMS, Integrations, API | Platform configuration |
| **Users & Roles** | `Users` | User list, Role management, Permissions | User administration |
| **API Keys** | `Key` | Key list, Create key, Rotate key | External API key management |
| **Brand Assets** | `Image` | Logos, Colors, Fonts, Icons | Platform brand asset management |
| **System** | `Cog` | Configuration, Maintenance, Health | System-level operations |

#### Footer Actions

| Action | Description |
|--------|-------------|
| Switch Account | Sign out and re-authenticate as different user |
| Sign Out | End current session, return to login |

### 3.2 Couple CMS Navigation (Wedding Couple)

The Couple CMS uses a light sidebar (`bg-paper-cream`, fixed left panel) with a top bar showing the couple name. Navigation is state-driven via `useCoupleCMSStore` with 16 pages. Mobile uses a bottom tab bar (5 visible) with a "More" sheet for remaining items.

#### Current Navigation (16 items)

| Item | Key | Category | Description |
|------|-----|----------|-------------|
| Overview | `overview` | Home | Dashboard summary: stats, recent activity, quick actions |
| Your Details | `details` | Setup | Bride/groom names, wedding date, venue, contact info |
| Content | `content` | Editor | Master content editor across all 8 page sections |
| Home | `home` | Pages | Hero banner, welcome message, countdown configuration |
| Schedule | `schedule` | Pages | Event timeline: ceremony, reception, tea ceremony, dinner |
| RSVPs | `rsvps` | Guest Mgmt | RSVP submissions, acceptance/decline tracking |
| Getting There | `getting-there` | Pages | Venue address, Google Maps, transport, accommodation |
| Our Story | `story` | Pages | Love story timeline with dates and photos |
| Wishes | `wishes` | Guest Mgmt | Guest wish messages, approval moderation |
| FAQs | `faqs` | Pages | Frequently asked questions management |
| Moments | `moments` | Media | Photo/video gallery management |
| Guests | `guests` | Guest Mgmt | Full guest list: import, export, categories, QR |
| Analytics | `analytics` | Insights | Invitation opens, RSVP rates, traffic sources |
| Activity | `audit` | Insights | Change history and action log |
| Sharing | `sharing` | Publish | Invitation link, QR code, social sharing, publish |
| Features | `features` | Settings | Feature visibility (read-only, controlled by admin) |

#### Top Bar

- Left: Couple name (from wedding data), mobile back-to-guest button
- Right: Notification bell, "Preview" button (toggles guest-facing view), DW logo, Sign Out

#### Mobile Bottom Navigation

Shows 5 items: Overview, Your Details, Content, Home, Schedule. Remaining 11 items accessible via "More" bottom sheet with grid layout.

### 3.3 Page Description Standards

Every CMS page follows a consistent structure:

```
┌────────────────────────────────────────────────┐
│ Page Header                                    │
│   Title (Playfair Display, 2xl, semibold)      │
│   Subtitle (Inter, sm, charcoal-ink/50)        │
├────────────────────────────────────────────────┤
│                                                │
│  Content Area                                  │
│  - Data tables with sort/filter/pagination     │
│  - Form sections with validation               │
│  - Stat cards with icons                      │
│  - Action buttons with clear CTAs             │
│  - Empty states with helpful guidance         │
│  - Loading skeletons for async data           │
│                                                │
├────────────────────────────────────────────────┤
│ Footer Actions (if applicable)                 │
│   - Save/Cancel/Publish buttons                │
│   - Breadcrumbs (desktop)                     │
└────────────────────────────────────────────────┘
```

---

## 4. User Roles & Permissions Matrix

### 4.1 Role Definitions

#### Dreamweavers Platform Roles

| Role | Code | Scope | Description |
|------|------|-------|-------------|
| Owner | `SUPER_ADMIN` | Full platform | Ultimate authority. Can manage all users, settings, accounts, and data. Cannot be deleted by other admins. |
| Admin | `ADMIN_1` | Full platform | Full platform access except user role elevation. Can manage accounts, features, settings, and content. |
| Operations Admin | `ADMIN_2` | Accounts + Support | Manages wedding accounts, handles support tickets, views analytics. Cannot modify platform settings or roles. |
| Content Admin | `ADMIN_3` | Templates + Content | Manages templates, themes, brand assets. Cannot access financial or user management. |
| Account Manager | `ACCOUNT_MANAGER` | Assigned accounts | Manages a subset of wedding accounts. Sees only accounts assigned to them. |
| Sales | `SALES` | Read accounts + Create | Can view account list and create new accounts. Cannot edit existing accounts or access CMS settings. |
| Customer Service | `SUPPORT` | Accounts (read) + Support | Read-only account access plus full support ticket management. |
| Designer | `DESIGNER` | Templates + Themes | Can create and edit templates and themes. No access to accounts or settings. |
| Finance | `FINANCE` | Payments + Subscriptions | Access to billing, invoices, subscription plans. No access to content or accounts. |
| Marketing | `MARKETING` | Analytics + Notifications | Access to analytics dashboards and notification/announcement templates. |
| Developer | `DEVELOPER` | API Keys + System | API key management, system configuration, health checks. |
| Auditor | `READ_ONLY` | Read-all | Full read access to all data and audit logs. No write permissions. |

#### Wedding Couple Roles

| Role | Description | Access Level |
|------|-------------|-------------|
| Primary (Bride/Groom) | Account owner. Full access to all enabled features. | Full |
| Wedding Planner | Assigned by couple. Full workspace access. | Full |
| Family Member | Can view and edit content. Cannot manage guests or publish. | Content only |
| Assistant | Can manage guests and RSVPs. Cannot edit content or publish. | Guest mgmt only |
| Editor | Can edit content sections only. Read-only for everything else. | Edit only |
| Read Only | View-only access to workspace. Cannot modify anything. | Read only |

#### Guest Roles

| Role | Description |
|------|-------------|
| Invited Guest | Can view wedding site, submit RSVP, send wish |
| VIP | Marked guest with special seating or accommodation |
| Family (Bride Side / Groom Side) | Categorized guest for seating and invitation |
| Vendor | Service provider with limited site access |

### 4.2 Permissions Matrix

#### Master CMS Permissions (Dreamweavers)

```
Capability                   SUPER  ADMIN1  ADMIN2  ADMIN3  ACCTMGR  SALES  SUPPORT  DESIGNER  FINANCE  MKTG  DEV  AUDITOR
─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
View Dashboard                ✅      ✅      ✅      ✅      ✅       ✅      ✅       ✅        ✅       ✅    ✅    ✅
Manage Accounts             ✅      ✅      ✅      ❌      ✅*      ❌      ❌       ❌        ❌       ❌    ❌    ✅
Delete Accounts             ✅      ✅      ❌      ❌      ❌       ❌      ❌       ❌        ❌       ❌    ❌    ❌
Manage Users/Roles           ✅      ✅      ❌      ❌      ❌       ❌      ❌       ❌        ❌       ❌    ❌    ❌
Manage Templates            ✅      ✅      ❌      ✅      ❌       ❌      ❌       ✅        ❌       ❌    ❌    ✅
Manage Themes               ✅      ✅      ❌      ✅      ❌       ❌      ❌       ✅        ❌       ❌    ❌    ✅
Feature Toggles              ✅      ✅      ✅      ❌      ❌       ❌      ❌       ❌        ❌       ❌    ✅    ✅
Platform Settings           ✅      ✅      ❌      ❌      ❌       ❌      ❌       ❌        ❌       ❌    ✅    ✅
View Analytics              ✅      ✅      ✅      ❌      ❌       ✅      ✅       ❌        ❌       ✅    ❌    ✅
Manage Payments             ✅      ✅      ❌      ❌      ❌       ❌      ❌       ❌        ✅       ❌    ❌    ✅
Support Tickets             ✅      ✅      ✅      ❌      ❌       ❌      ✅       ❌        ❌       ❌    ❌    ✅
Broadcast Notifications     ✅      ✅      ❌      ❌      ❌       ❌      ✅       ❌        ❌       ✅    ❌    ✅
API Keys                    ✅      ✅      ❌      ❌      ❌       ❌      ❌       ❌        ❌       ❌    ✅    ❌
Audit Logs (write)          ✅      ✅      ✅      ✅      ✅       ❌      ❌       ❌        ❌       ❌    ❌    ❌
Audit Logs (read)           ✅      ✅      ✅      ✅      ✅       ✅      ✅       ✅        ✅       ✅    ✅    ✅
Export Data                 ✅      ✅      ✅      ✅      ✅*      ❌      ❌       ✅        ✅       ✅    ✅    ✅
```

*ACCTMGR: Only for accounts assigned to them.

#### Couple CMS Permissions

```
Capability                   PRIMARY  PLANNER  FAMILY  ASSISTANT  EDITOR  READONLY
───────────────────────────────────────────────────────────────────────────────
View Dashboard                ✅       ✅       ✅      ✅         ✅      ✅
Edit Wedding Details         ✅       ✅       ❌      ❌         ❌      ❌
Edit Content Sections        ✅       ✅       ✅      ❌         ✅      ❌
Manage Guests                ✅       ✅       ❌      ✅         ❌      ❌
Import/Export Guests         ✅       ✅       ❌      ✅         ❌      ❌
Manage RSVPs                 ✅       ✅       ❌      ✅         ❌      ❌
Manage Wishes (moderate)     ✅       ✅       ❌      ❌         ❌      ❌
Manage Schedule              ✅       ✅       ❌      ❌         ❌      ❌
Manage Media                 ✅       ✅       ❌      ❌         ❌      ❌
View Analytics               ✅       ✅       ✅      ✅         ✅      ✅
View Activity Log            ✅       ✅       ❌      ❌         ❌      ❌
Manage Sharing/QR            ✅       ✅       ❌      ❌         ❌      ❌
Preview Guest Site           ✅       ✅       ✅      ✅         ✅      ✅
Publish/Unpublish           ✅       ✅       ❌      ❌         ❌      ❌
Access Features page         ✅       ✅       ✅      ✅         ✅      ✅
Switch to Guest View         ✅       ✅       ✅      ✅         ✅      ✅
```

### 4.3 Permission Implementation

Permissions are enforced at two levels:

**API Level (server-side):** Every API route checks the JWT `role` field and, for `ACCOUNT_MANAGER`, verifies the `weddingId` is in their assigned set. Unauthorized requests return 401/403.

**UI Level (client-side):** Navigation items and UI elements are conditionally rendered based on the session role. This is UX convenience only — the API is the authoritative gate.

```typescript
// Example: API permission check
const FEATURE_PERMISSIONS: Record<string, string[]> = {
  'weddings:delete': ['SUPER_ADMIN', 'ADMIN_1'],
  'weddings:create': ['SUPER_ADMIN', 'ADMIN_1', 'ADMIN_2', 'ACCOUNT_MANAGER', 'SALES'],
  'features:toggle': ['SUPER_ADMIN', 'ADMIN_1', 'ADMIN_2', 'DEVELOPER'],
  'settings:modify': ['SUPER_ADMIN', 'ADMIN_1', 'DEVELOPER'],
};
```

---

## 5. Database Design

### 5.1 Current Schema (Existing)

The current Prisma schema defines 15 models. Key design patterns:

- **Multi-tenancy:** Every wedding-scoped model has a `weddingId` FK to `WeddingAccount`, with `onDelete: Cascade` ensuring clean isolation.
- **EAV Content:** `WeddingContent` uses `section + fieldKey + fieldValue` triples with a `fieldType` discriminator.
- **Soft Status:** `WeddingAccount.status` uses string enum: `DRAFT | ACTIVE | SUSPENDED | ARCHIVED | COMPLETED`.
- **Slug-Based Routing:** `WeddingAccount.slug` is `@unique`, used for public URLs (`/{slug}`).
- **Audit Trail:** `AuditLog` records `action`, `entity`, `entityId`, `details` (JSON), `ipAddress`.

### 5.2 Proposed Schema Additions

The following models should be added to support the full CMS vision:

```prisma
// ============================================================
// ROLES & PERMISSIONS (enhance existing User model)
// ============================================================

model Role {
  id          String   @id @default(cuid())
  name        String   @unique  // SUPER_ADMIN, ADMIN_1, ADMIN_2, etc.
  label       String            // "Super Admin", "Admin", etc.
  description String?
  permissions String?           // JSON array of permission keys
  isSystem    Boolean  @default(false)  // System roles cannot be deleted
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  users UserRole[]
}

model UserRole {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  roleId String
  role   Role   @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([userId, roleId])
}

// ============================================================
// SUBSCRIPTION & BILLING
// ============================================================

model Plan {
  id          String   @id @default(cuid())
  name        String   @unique  // FREE, PREMIUM, ENTERPRISE
  label       String            // "Free", "Premium", "Enterprise"
  price       Float    @default(0)
  currency    String   @default("SGD")
  interval    String   @default("monthly")  // monthly | yearly
  features    String   // JSON array of included feature keys
  maxGuests   Int      @default(100)
  maxMedia    Int      @default(50)
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Subscription {
  id            String   @id @default(cuid())
  weddingId     String
  wedding       WeddingAccount @relation(fields: [weddingId], references: [id], onDelete: Cascade)
  planId        String
  plan          Plan     @relation(fields: [planId], references: [id])
  status        String   @default("ACTIVE")  // ACTIVE | PAST_DUE | CANCELLED | TRIAL
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  trialEndsAt  DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([weddingId])
}

model Invoice {
  id            String   @id @default(cuid())
  subscriptionId String
  subscription   Subscription @relation(fields: [subscriptionId], references: [id])
  amount        Float
  currency      String   @default("SGD")
  status        String   @default("PENDING")  // PENDING | PAID | FAILED | REFUNDED
  paidAt        DateTime?
  stripeInvoiceId String?  // If using Stripe
  createdAt     DateTime @default(now())
}

// ============================================================
// TEMPLATES & THEMES
// ============================================================

model Template {
  id          String   @id @default(cuid())
  name        String
  description String?
  category    String   @default("wedding")  // wedding | corporate | birthday | custom
  thumbnailUrl String?
  isPublished Boolean  @default(false)
  createdBy   String?
  creator     User?    @relation(fields: [createdBy], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  weddingAccounts WeddingAccountTemplate[]
}

model WeddingAccountTemplate {
  id             String          @id @default(cuid())
  weddingId      String
  wedding        WeddingAccount  @relation(fields: [weddingId], references: [id], onDelete: Cascade)
  templateId     String
  template       Template        @relation(fields: [templateId], references: [id])
  appliedAt      DateTime        @default(now())
}

model Theme {
  id          String   @id @default(cuid())
  name        String
  description String?
  config      String   // JSON: colors, typography, layout, animations
  thumbnailUrl String?
  isPublished Boolean  @default(false)
  isPremium  Boolean  @default(false)
  version    Int      @default(1)
  createdBy   String?
  creator     User?    @relation(fields: [createdBy], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  weddingAccounts WeddingAccountTheme[]
}

model WeddingAccountTheme {
  id        String          @id @default(cuid())
  weddingId String
  wedding   WeddingAccount  @relation(fields: [weddingId], references: [id], onDelete: Cascade)
  themeId   String
  theme     Theme          @relation(fields: [themeId], references: [id])
  customizations String?      // JSON overrides on top of theme config
  appliedAt DateTime        @default(now())
}

// ============================================================
// SEATING & TABLES
// ============================================================

model TableAssignment {
  id         String          @id @default(cuid())
  weddingId  String
  wedding    WeddingAccount  @relation(fields: [weddingId], references: [id], onDelete: Cascade)
  tableNumber Int
  tableName  String?         // "Table 1", "VIP Table", "Family Table"
  capacity   Int
  location   String?         // "Near stage", "Balcony", "Outdoor"
  createdAt  DateTime        @default(now())
  updatedAt  DateTime        @updatedAt

  guests Guest[]
}

// ============================================================
// CHECK-IN
// ============================================================

model CheckIn {
  id         String   @id @default(cuid())
  weddingId  String
  guestId    String
  guest      Guest    @relation(fields: [guestId], references: [id], onDelete: Cascade)
  checkedInBy String?  // userId of person who scanned
  method     String   @default("QR")  // QR | MANUAL | OFFLINE
  createdAt  DateTime @default(now())
}

// ============================================================
// SUPPORT TICKETS
// ============================================================

model SupportTicket {
  id          String   @id @default(cuid())
  weddingId   String?
  wedding     WeddingAccount? @relation(fields: [weddingId], references: [id])
  subject     String
  description String
  status      String   @default("OPEN")  // OPEN | IN_PROGRESS | RESOLVED | CLOSED
  priority    String   @default("MEDIUM")  // LOW | MEDIUM | HIGH | URGENT
  assignedTo  String?
  assignee    User?    @relation(fields: [assignedTo], references: [id])
  createdBy   String?
  creator     User?    @relation(fields: [createdBy], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  messages SupportMessage[]
}

model SupportMessage {
  id         String   @id @default(cuid())
  ticketId   String
  ticket     SupportTicket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  senderId   String?
  sender     User?    @relation(fields: [senderId], references: [id])
  content    String
  isInternal Boolean  @default(false)  // visible only to staff
  createdAt  DateTime @default(now())
}

// ============================================================
// INVITATION TRACKING
// ============================================================

model InvitationDelivery {
  id            String   @id @default(cuid())
  guestId       String
  guest         Guest    @relation(fields: [guestId], references: [id], onDelete: Cascade)
  channel       String   // EMAIL | SMS | WHATSAPP | MANUAL
  sentAt        DateTime?
  openedAt      DateTime?
  clickedAt     DateTime?
  delivered      Boolean  @default(false)
  createdAt     DateTime @default(now())
}

// ============================================================
// FEATURE FLAGS (platform-level)
// ============================================================

model PlatformFeature {
  id          String   @id @default(cuid())
  key         String   @unique
  label       String
  description String?
  category    String   // page | interactive | display | advanced | cultural | ai | premium
  defaultValue Boolean  @default(false)
  isPremium   Boolean  @default(false)
  isEnterprise Boolean  @default(false)
  status      String   @default("ENABLED")  // ENABLED | DISABLED | BETA | COMING_SOON
  sortOrder   Int      @default(0)
  config      String?  // JSON: additional settings for the feature
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### 5.3 Entity Relationship Diagram (Textual)

```
User ─────────┬──────── ownedWeddings ──── WeddingAccount
  │           │                              │
  │           ├──────── auditLogs ──── AuditLog
  │           ├──────── notifications ── Notification
  │           │                              │
  │           │    ┌─────────────────────────┼──────────────────────────┐
  │           │    │                         │                          │
  │           │    ├── WeddingFeature         ├── WeddingContent          ├── WeddingMedia
  │           │    ├── EventSchedule          ├── FAQ                     ├── StoryItem
  │           │    ├── Guest                   ├── RSVPSubmission          ├── Wish
  │           │    │    └── GuestResponse  ├── ContactSubmission       │
  │           │    ├── CheckIn                ├── InvitationDelivery       │
  │           │    ├── TableAssignment         ├── Subscription
  │           │    │    └── Guest (seats)     │    └── Plan
  │           │    └── SupportTicket          │         └── Invoice
  │           │         └── SupportMessage
  │           │
  │           ├──────── UserRole ──── Role
  │           │
  │           └──────── (creator) ──── Template, Theme

PlatformFeature  (standalone, referenced by WeddingFeature.featureKey)

SystemSetting     (standalone key-value store)
```

### 5.4 Normalization Notes

- **Current schema is in 3NF** for all existing models.
- **EAV pattern** in `WeddingContent` trades normalization for flexibility. This is acceptable for a CMS where content structure varies per wedding.
- **`fieldType` discriminator** prevents type confusion (storing "true" in a field meant for URLs).
- **Cascade deletes** ensure no orphaned data when a wedding account is removed.
- **`@@unique` constraints** on `WeddingContent(weddingId, section, fieldKey)` and `WeddingFeature(weddingId, featureKey)` prevent duplicates without requiring composite primary keys.

---

## 6. Feature Permission Engine

### 6.1 Design

The feature engine operates at two levels:

**Platform Level (`PlatformFeature` table):** Dreamweavers defines which features exist, their default state, and their tier (free/premium/enterprise). This is the source of truth.

**Wedding Level (`WeddingFeature` table):** Each wedding has its own copy of feature flags. Dreamweavers sets the initial flags when creating an account. Couples see which features are enabled but cannot change them (read-only in their CMS).

### 6.2 Feature Lifecycle

```
PlatformFeature (source of truth)
│
├── status: ENABLED / DISABLED / BETA / COMING_SOON
├── isPremium: true/false
├── isEnterprise: true/false
│
▼  When WeddingAccount is created:
│
WeddingFeature (per-wedding copy)
│
├── isEnabled: copied from PlatformFeature.defaultValue
├── config: copied from PlatformFeature.config
│
▼  Dreamweavers can override per-wedding:
│
WeddingFeature.isEnabled = true/false
WeddingFeature.config = { ...custom settings... }
│
▼  Couple CMS reads WeddingFeature:
│
- Navigation: only show pages for enabled features
- UI: show "Premium" badge for disabled premium features
- API: 403 if couple tries to access disabled feature
```

### 6.3 Feature Catalog (40+ features)

| Category | Feature Key | Label | Default | Premium | Enterprise |
|----------|-------------|-------|---------|---------|------------|
| **Page** | `home` | Home Page | Enabled | | |
| | `schedule` | Event Schedule | Enabled | | |
| | `rsvp` | RSVP Form | Enabled | | |
| | `getting-there` | Getting There | Enabled | | |
| | `story` | Our Story | Enabled | | |
| | `wishes` | Wishes Wall | Enabled | | |
| | `moments` | Photo/Video Moments | Enabled | | |
| | `qa` | FAQ Section | Enabled | | |
| | `countdown` | Countdown Timer | Enabled | | |
| | `footer` | Custom Footer | Enabled | | |
| **Interactive** | `guest_upload` | Guest Photo Upload | Disabled | ✅ | |
| | `guest_export` | Guest List Export | Disabled | ✅ | |
| | `livestream` | Event Livestream | Disabled | ✅ | ✅ |
| | `music` | Background Music | Disabled | ✅ | |
| | `video_background` | Video Hero Background | Disabled | ✅ | ✅ |
| | `gift_registry` | Gift Registry | Disabled | ✅ | |
| | `qr_checkin` | Guest QR Check-in | Disabled | ✅ | ✅ |
| | `offline_checkin` | Offline Check-in | Disabled | | ✅ |
| | `whatsapp_rsvp` | WhatsApp RSVP | Disabled | ✅ | |
| | `sms_reminder` | SMS Reminders | Disabled | ✅ | |
| | `table_assignment` | Table Seating | Disabled | ✅ | |
| | `photo_booth` | Photo Booth | Disabled | ✅ | |
| | `broadcast_message` | Broadcast Message | Disabled | ✅ | |
| | `attendance_report` | Attendance Report | Disabled | ✅ | |
| **Display** | `google_maps` | Google Maps Integration | Enabled | | |
| | `navigation` | Step Navigation | Enabled | | |
| | `animation` | Page Animations | Enabled | | |
| | `dark_mode` | Dark Mode Toggle | Disabled | ✅ | |
| | `custom_css` | Custom CSS | Disabled | | ✅ |
| | `custom_domain` | Custom Domain | Disabled | | ✅ |
| | `brand_removal` | Remove DW Branding | Disabled | | ✅ |
| **Cultural** | `chinese_wedding` | Chinese Wedding Elements | Disabled | | |
| | `malay_wedding` | Malay Wedding Elements | Disabled | | |
| | `indian_wedding` | Indian Wedding Elements | Disabled | | |
| | `christian_ceremony` | Christian Ceremony | Disabled | | |
| | `tea_ceremony` | Tea Ceremony | Disabled | | |
| | `multi_event` | Multiple Events | Disabled | ✅ | |
| | `multi_language` | Multi-language Support | Disabled | ✅ | |
| | `reception` | Reception Section | Disabled | | |
| | `after_party` | After Party Section | Disabled | | |
| **Advanced** | `family_tree` | Family Tree | Disabled | ✅ | |
| | `ai_invitation_text` | AI-Generated Text | Disabled | ✅ | |
| | `ai_seating` | AI Seating Planner | Disabled | | ✅ | |
| | `timeline` | Visual Timeline | Disabled | ✅ | |

### 6.4 Implementation

```typescript
// Feature check utility
async function isFeatureEnabled(weddingId: string, featureKey: string): Promise<boolean> {
  const weddingFeature = await db.weddingFeature.findUnique({
    where: { weddingId_featureKey: { weddingId, featureKey } },
  });
  if (!weddingFeature) {
    // Fall back to platform default
    const platformFeature = await db.platformFeature.findUnique({
      where: { key: featureKey },
    });
    return platformFeature?.defaultValue ?? false;
  }
  return weddingFeature.isEnabled;
}

// Guest-facing: hide entire sections based on features
// Couple CMS: show locked/badge UI for disabled features
// Master CMS: toggle features per wedding or platform-wide
```

---

## 7. Wedding Account Lifecycle

### 7.1 Stages

```
┌──────────┐    ┌───────────┐    ┌──────────────┐    ┌──────────┐    ┌─────────┐
│  LEAD   │───▶│ CUSTOMER  │───▶│ WEDDING      │───▶│  SETUP  │───▶│ TESTING │
│          │    │ CREATED   │    │ CREATED      │    │         │    │         │
└──────────┘    └───────────┘    └──────────────┘    └──────────┘    └─────────┘
                                                              │              │
                                                              ▼              ▼
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌─────────┐
│ DELETED  │    │ ARCHIVED  │    │ COMPLETED │◀───│   LIVE   │◀───│PUBLISHED│
│          │    │          │    │          │    │          │    │         │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └─────────┘
```

### 7.2 Stage Definitions

| Stage | Status Code | Description | Actions Available |
|-------|-------------|-------------|-------------------|
| **Lead** | `LEAD` | Prospect expressed interest, no account yet. Tracked in CRM. | Create account, follow up, discard |
| **Customer** | `CUSTOMER` | User registered on platform, no wedding created. | Create wedding, assign plan |
| **Wedding Created** | `DRAFT` | Wedding account created, couple can begin setup. All features available. | Edit content, upload media, configure features |
| **CMS Activated** | `ACTIVE` | Couple has logged in and started configuring. | Full CMS access, preview, test |
| **Setup** | `DRAFT` | Couple is actively setting up content. Guided onboarding active. | Edit all sections, guided setup flow |
| **Testing** | `DRAFT` | Couple clicks "Preview" to test the guest experience. | Preview mode, share preview link, feedback |
| **Published** | `ACTIVE` | Wedding site is live. Guests can visit and interact. | View analytics, manage RSVPs, edit content |
| **Live** | `ACTIVE` | Wedding day has passed or is imminent. | Monitor, manage last-minute changes |
| **Completed** | `COMPLETED` | Wedding is over. Site moves to read-only. | Export data, archive, download |
| **Archived** | `ARCHIVED` | Account is stored but not actively displayed. | Reactivate, export, permanent delete |
| **Deleted** | — | Account and all data permanently removed (soft-delete first). | Restore within 30 days (soft) |

### 7.3 Status Transitions

```
LEAD → DRAFT (create wedding account)
DRAFT → ACTIVE (publish wedding site)
ACTIVE → DRAFT (unpublish)
ACTIVE → COMPLETED (mark wedding as completed)
ACTIVE → SUSPENDED (admin action - payment issue, TOS violation)
COMPLETED → ARCHIVED (auto-archive after 90 days)
ARCHIVED → DRAFT (reactivate)
SUSPENDED → DRAFT (unsuspend)
DRAFT → DELETED (permanent delete, 30-day soft-delete window)
```

### 7.4 Data Retention

| Stage | Data Access | Retention |
|-------|-------------|-----------|
| Active | Full | Indefinite (while subscription is active) |
| Completed | Read-only | 90 days, then auto-archive |
| Archived | Read-only, export-only | 1 year, then eligible for deletion |
| Deleted (soft) | Recoverable by admin | 30 days |
| Deleted (hard) | Gone | Irrecoverable |

---

## 8. Guest Management

### 8.1 Guest Data Model

```
Guest
├── Identity: name, email, phone
├── Grouping: groupName (family/grouping), side (bride/groom/neutral)
├── Invitation: invitationCode (unique), sentVia, sentAt, openedAt
├── RSVP: rsvpStatus (PENDING/ATTENDING/DECLINED/PARTIAL), plusOne, plusOneName
├── Dietary: dietaryNotes, mealPreference
├── Seating: tableNumber (FK to TableAssignment)
├── Tags: custom tags (JSON array or separate Tag model)
├── Attendance: checkIn records
└── Metadata: createdAt, updatedAt
```

### 8.2 Import Pipeline

```
Upload CSV/Excel
      │
      ▼
┌─────────────────┐
│ Parse & Validate │  Validate columns, email format, required fields
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Deduplicate     │  Match by email/phone, merge or flag conflicts
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Assign Groups   │  Auto-detect side from name patterns, assign group
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate Codes  │  Create unique invitation codes (6-char alphanumeric)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Preview & Confirm│  Show import summary, conflicts, duplicates
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Bulk Insert     │  Write to database in batches of 100
└─────────────────┘
```

### 8.3 Guest Categories

| Category | Description | Usage |
|----------|-------------|-------|
| Bride Side | Bride's family and friends | Seating, invitation design |
| Groom Side | Groom's family and friends | Seating, invitation design |
| VIP | Important guests needing special treatment | Priority seating, early RSVP |
| Family | Immediate family members | Head table, special invitations |
| Friends | Friends of the couple | Standard invitations |
| Colleagues | Work colleagues | Standard invitations |
| Children | Guests under 12 | Meal planning, seating |
| Vendor | Service providers (photographer, caterer) | Access restrictions, no RSVP |

### 8.4 Search, Filter, Export

- **Search:** By name, email, phone, group, tag (full-text with debounce)
- **Filter:** By RSVP status, side, group, invitation status, check-in status, dietary
- **Sort:** By name, group, RSVP status, invitation sent date
- **Export:** CSV and Excel, respecting current filters, with selected columns
- **Bulk Edit:** Select multiple guests → change group, assign table, mark as sent, delete

---

## 9. RSVP Engine

### 9.1 Submission Flow

```
Guest opens invitation link
      │
      ▼
┌─────────────────────┐
│ Guest Site: RSVP    │  Form with name, party size, per-guest attendance,
│ Page                │  dietary, special requests, transportation needs
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Validate & Submit   │  Server-side: required fields, party size limits,
│                     │  deadline check, duplicate detection
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Create Submission   │  RSVPSubmission + GuestResponse records
│                     │  If linked guest: update Guest.rsvpStatus
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Notification        │  → Couple gets notification
│                     │  → Guest gets confirmation (if email provided)
└─────────────────────┘
```

### 9.2 RSVP Data Model

```
RSVPSubmission
├── firstName, lastName
├── partySize (total number of guests in the group)
├── weddingId (link to wedding)
├── guestId (optional: link to tracked Guest record)
├── createdAt, updatedAt
│
└── guests: GuestResponse[]
    ├── name
    ├── attendance: "yes" | "no" | "partial"
    ├── dietary: string?
    └── createdAt, updatedAt
```

### 9.3 RSVP States

| State | Description | Follow-up |
|-------|-------------|-----------|
| `PENDING` | Invitation sent, no response yet | Auto-reminder at configurable intervals |
| `ATTENDING` | Guest confirmed attendance | Table assignment, dietary planning |
| `DECLINED` | Guest declined | Update headcount, follow-up message |
| `PARTIAL` | Some guests in party attending, some not | Per-guest tracking in GuestResponse |

### 9.4 Reminder Workflow

```
Invitation Sent ────── 7 days ────── First Reminder (email/SMS)
                                    │
                                    ├── No response ── 3 days ── Second Reminder
                                    │                                │
                                    │                                ├── No response ── 2 days ── Final Reminder
                                    │                                │
                                    └── Response received ── Stop reminders
```

Reminder timing, channels, and content are configurable per wedding by Dreamweavers or by the couple (if the SMS/email feature is enabled for their plan).

---

## 10. Wedding Website Builder

### 10.1 Configurable Sections

Each section is a distinct content area on the guest-facing wedding site. Sections are controlled by feature flags.

| Section | Content | Configuration Options |
|---------|---------|----------------------|
| **Hero Banner** | Main image/video, couple names, date, tagline | Background image/video, overlay color, text alignment, countdown position |
| **Countdown** | Days/hours/minutes to wedding | Target date, display style, hide when past |
| **Schedule** | Event timeline | Multiple events, time format, map links |
| **Venue & Maps** | Location, directions, map embed | Google Maps embed, transportation info, accommodation |
| **Our Story** | Love story timeline | Chronological entries with dates, photos, layout style |
| **RSVP** | RSVP form | Party size limit, dietary field, plus-one toggle, deadline, custom fields |
| **Getting There** | Travel information | Flights, hotels, transport, dress code, weather |
| **Gallery** | Photo/video gallery | Layout (grid/masonry/carousel), lightbox, captions |
| **Wishes** | Guest messages | Moderation toggle, display style, allow photos |
| **FAQ** | Frequently asked questions | Categorized, expandable, custom order |
| **Footer** | Contact, hashtag, credits | Custom text, social links, DW branding (removable) |
| **Music** | Background audio | Upload audio file, autoplay toggle, volume |
| **Livestream** | Embedded video stream | URL input, start time, password protection |
| **Gift Registry** | Gift links | Multiple registry links, custom descriptions |

### 10.2 Section Visibility

Sections are hidden/shown based on two conditions:
1. **Feature enabled** — The `PlatformFeature` / `WeddingFeature` flag must be `true`
2. **Content exists** — The section must have at least one `WeddingContent` row (or the couple has configured it)

This prevents empty sections from appearing on the guest site.

---

## 11. Theme System

### 11.1 Architecture

```
Theme (platform-level template)
├── config: JSON object containing:
│   ├── colors: { primary, secondary, accent, background, text }
│   ├── typography: { heading, body, accent }
│   ├── layout: { maxWidth, sectionSpacing, borderRadius }
│   ├── animations: { pageTransition, scrollReveal, parallax }
│   └── headerStyle: { position, transparent, blur }
│
▼ Applied to WeddingAccount via WeddingAccountTheme
▼ Couple can override specific values in customizations JSON
```

### 11.2 Theme Marketplace

| Aspect | Description |
|--------|-------------|
| Browsing | Grid gallery with thumbnails, category filters, search |
| Preview | Full-screen live preview of the theme applied to sample content |
| Apply | One-click apply to wedding account. Previous theme is archived. |
| Customization | After applying, couple can override individual values |
| Versioning | Theme updates don't break existing weddings (version tracking) |
| Cloning | Admin can clone a theme to create variations |

### 11.3 Color System

Themes use a CSS custom property system. The `Theme.config.colors` object maps to CSS variables consumed by the guest site:

```css
:root {
  --dw-primary: #D4AF37;      /* Cinematic Gold */
  --dw-secondary: #1a1a2e;   /* Charcoal Ink */
  --dw-accent: #c9a96e;      /* Champagne */
  --dw-bg: #FEFAF3;          /* Paper Cream */
  --dw-text: #1a1a2e;         /* Dark text */
  --dw-text-light: rgba(26,26,46,0.5);
}
```

---

## 12. Notification Engine

### 12.1 Notification Types

| Type | Trigger | Channels |
|------|---------|----------|
| `RSVP_RECEIVED` | Guest submits RSVP | In-app |
| `WISH_RECEIVED` | Guest sends wish | In-app |
| `CONTACT_RECEIVED` | Guest submits contact form | In-app |
| `GUEST_OPENED` | Guest opens invitation | In-app |
| `SYSTEM` | Platform announcement | In-app, email |
| `REMINDER_SENT` | RSVP reminder dispatched | Internal |
| `WEDDING_PUBLISHED` | Couple publishes site | In-app |
| `ACCOUNT_CREATED` | New wedding account | In-app (admin) |
| `SUPPORT_REPLY` | Support ticket response | In-app |

### 12.2 Delivery Channels

| Channel | Implementation | Priority |
|---------|---------------|----------|
| **In-App** | Real-time via WebSocket or polling (`Notification` model, `isRead` flag) | Immediate |
| **Email** | Via Resend (or SendGrid) | Configurable delay |
| **SMS** | Via Twilio (or equivalent) | Configurable delay |
| **WhatsApp** | Via WhatsApp Business API | Configurable delay |

### 12.3 Broadcast System

Dreamweavers can send platform-wide announcements:

1. Select target audience (all couples, specific plan, specific region)
2. Compose message (title, body, optional link)
3. Schedule delivery (immediate or scheduled)
4. Track delivery status (sent, delivered, read)

---

## 13. Analytics

### 13.1 Platform Analytics (Dreamweavers)

| Metric | Source | Visualization |
|--------|--------|---------------|
| Total Accounts | `WeddingAccount.count()` | KPI card with trend |
| Active Sites | `WeddingAccount` where `status = 'ACTIVE'` | KPI card |
| Total Guests | `Guest.count()` grouped by wedding | KPI card |
| RSVP Rate | `RSVPSubmission.count()` / `Guest.count()` | Progress ring |
| Wish Count | `Wish.count()` | KPI card |
| Feature Usage | `WeddingFeature` aggregation | Bar chart |
| Template Popularity | `WeddingAccountTemplate` counts | Bar chart |
| Guest Traffic | `InvitationDelivery.openedAt` aggregation | Line chart |
| Revenue | `Invoice` aggregation | Line chart |
| Account Growth | New accounts per week/month | Area chart |

### 13.2 Couple Analytics (Wedding Couple)

| Metric | Source | Visualization |
|--------|--------|---------------|
| Invitation Opens | `InvitationDelivery` where `openedAt != null` | Number with trend |
| Unique Visitors | Aggregated from server logs or analytics service | Number |
| RSVP Rate | `RSVPSubmission` / total invited guests | Progress ring |
| Acceptance Rate | `ATTENDING` responses / total responses | Progress ring |
| Guest Attendance | Checked-in guests / total attending guests | Number |
| Wish Count | `Wish.count()` for this wedding | Number |
| Gallery Views | Page view tracking for moments section | Number |
| Traffic Sources | UTM parameters or referrer tracking | Pie chart |
| QR Check-ins | `CheckIn.count()` for this wedding | Number |
| RSVPs Over Time | `RSVPSubmission.createdAt` grouped by day | Line chart |

### 13.3 Analytics Implementation

For MVP: Aggregate queries on the existing Prisma models at request time, cached in memory with TTL.

For Enterprise: Integrate a dedicated analytics service (PostHog, Mixpanel, or Plausible) with event tracking embedded in the guest site. The CMS reads from the analytics service API.

---

## 14. Security Architecture

### 14.1 Authentication

| Aspect | Implementation |
|--------|---------------|
| Provider | NextAuth Credentials (email + password) |
| Password Hashing | bcrypt (12 rounds) |
| Session Strategy | JWT (24-hour expiry) |
| JWT Payload | `userId`, `email`, `name`, `role`, `tenantId`, `tenantRole` |
| Token Storage | HttpOnly, Secure, SameSite cookies |
| Rate Limiting | 5 failed attempts → 15-minute lockout (per email) |
| Password Reset | Time-limited token (30 min) via email link |
| MFA | Future: TOTP via authenticator app |

### 14.2 Authorization (RBAC)

Permissions are enforced at three layers:

1. **API Route Guard** — Middleware checks JWT role against required permission. Returns 401/403.
2. **Prisma Query Scoping** — All queries include `where: { weddingId }` for couple-scoped operations. Admin queries are scoped by role.
3. **UI Rendering** — Navigation items and UI elements are conditionally rendered. This is UX convenience, NOT security.

### 14.3 Data Security

| Threat | Mitigation |
|--------|------------|
| SQL Injection | Prisma ORM parameterized queries (no raw SQL) |
| XSS | React auto-escapes; `dangerouslySetInnerHTML` prohibited in CMS |
| CSRF | NextAuth CSRF tokens; SameSite cookies |
| Data Leakage | Wedding-scoped queries; no cross-tenant data access |
| Brute Force | Rate limiting on login; account lockout |
| Session Hijacking | HttpOnly cookies; JWT rotation on password change |
| Media Access | Signed URLs with expiry; direct file access blocked |
| API Abuse | Rate limiting per route; API key throttling |

### 14.4 Audit Logging

Every write operation (create, update, delete) in the CMS generates an `AuditLog` entry:

```typescript
await db.auditLog.create({
  data: {
    userId: session.user.id,
    weddingId: weddingId,
    action: 'UPDATE',
    entity: 'WeddingContent',
    entityId: contentId,
    details: JSON.stringify({ section: 'hero', field: 'title', old: 'Welcome', new: 'Join Us' }),
    ipAddress: request.headers.get('x-forwarded-for'),
  },
});
```

Audit logs are immutable. They can be viewed and exported but never edited or deleted (except by `SUPER_ADMIN` for GDPR compliance).

### 14.5 GDPR/PDPA Readiness

- **Data Export:** Couples can export all their data (guests, RSVPs, wishes, content) as JSON/CSV
- **Account Deletion:** Soft-delete for 30 days, then hard-delete. All cascading data removed.
- **Right to Access:** Couples can request a copy of all personal data held
- **Data Portability:** Export format is standardized JSON, importable by other platforms
- **Consent:** RSVP and wish submissions are opt-in (guest chooses to participate)

---

## 15. Scalability Strategy

### 15.1 Current State (SQLite)

SQLite is suitable for the current scale (hundreds of weddings, thousands of guests). Advantages: zero-config, file-based backups, fast reads.

**Scaling limits of SQLite:**
- ~100K concurrent writes (not reads)
- Single-writer at a time (WAL mode helps with reads during writes)
- File size limit: ~140TB (practically unlimited for this use case)

### 15.2 Migration Path to PostgreSQL

The Prisma schema is database-agnostic. Migration to PostgreSQL requires:

1. Change `datasource.db.provider` from `sqlite` to `postgresql`
2. Change `datasource.db.url` to a PostgreSQL connection string
3. Add `@default(now())` for timestamp fields (PostgreSQL handles this; SQLite uses the Prisma default)
4. Run `prisma migrate deploy`

Zero schema changes needed. The EAV content model and multi-tenant FK pattern work identically.

### 15.3 Horizontal Scaling

| Component | Strategy |
|-----------|----------|
| **Next.js Server** | Stateless by design; scale horizontally behind load balancer |
| **API Routes** | Stateless JWT auth; no sticky sessions needed |
| **Static Assets** | Serve via CDN (Vercel, Cloudflare, or AWS CloudFront) |
| **Media Files** | Store in S3/R2/Cloudflare R2 with CDN; database stores only URLs |
| **Real-time (future)** | WebSocket via Socket.io or Pusher; Redis for pub/sub |
| **Scheduled Jobs** | Node.js cron (node-cron) or external scheduler (Temporal) |
| **Analytics** | Offload to dedicated service (PostHog) to avoid DB load |

### 15.4 Performance Targets

| Metric | Target |
|--------|--------|
| Page load (guest site) | < 2s LCP on 4G |
| CMS page load | < 3s LCP |
| API response (CRUD) | < 200ms p95 |
| Guest list (1000 guests) | < 500ms |
| Bulk import (500 guests) | < 5s |
| Search response | < 100ms |

---

## 16. UI/UX Principles

### 16.1 Design Language

The DWdigitalInvite CMS follows the **Dreamweavers Design System**:

- **Typography:** Playfair Display (headings, serif accents) + Inter (body, UI elements)
- **Colors:** Cinematic Gold (`#D4AF37`), Charcoal Ink (`#1a1a2e`), Paper Cream (`#FEFAF3`), Champagne Silk
- **Spacing:** 4px base grid; 16px/24px/32px/48px/64px standard increments
- **Borders:** Subtle `border-champagne-silk/30` with `rounded-sm` or `rounded-lg`
- **Icons:** Lucide React icon library (18px standard size)
- **Motion:** Subtle 150-200ms transitions; no jarring animations

### 16.2 Design References

| Aspect | Reference |
|--------|-----------|
| Sidebar navigation | Shopify Admin (collapsible, icon + label) |
| Dashboard layout | Stripe Dashboard (clean stat cards, activity feed) |
| Content editing | Notion (inline editing, slash commands, clean typography) |
| Mobile navigation | Linear (bottom tab bar, sheet overflow) |
| Form design | Apple HIG (clear labels, inline validation, generous spacing) |
| Data tables | Webflow CMS (clean rows, hover actions, bulk operations) |
| Settings pages | Vercel Dashboard (grouped sections, toggle switches) |
| Loading states | Skeleton screens matching final layout shape |

### 16.3 Interaction Principles

1. **Progressive Disclosure:** Show essential info first, reveal complexity on demand. Don't overwhelm with 40 fields at once.
2. **Inline Validation:** Validate as user types, not on submit. Show errors adjacent to the relevant field.
3. **Contextual Help:** Tooltips and info icons explain features without leaving the page.
4. **Optimistic Updates:** Save immediately with a subtle confirmation. Rollback on error.
5. **Keyboard Navigation:** All interactive elements accessible via Tab/Enter/Escape.
6. **Mobile-First:** Design for mobile first, then enhance for tablet and desktop.
7. **Guided Onboarding:** New couples see a step-by-step setup wizard, not a blank CMS.
8. **Undo Support:** Destructive actions (delete, unpublish) require confirmation. Non-destructive changes are auto-saved.
9. **Toast Notifications:** Success/error feedback via toast (bottom-right), not alerts.
10. **Consistent Layout:** Every CMS page uses the same header/content/footer structure.

### 16.4 Responsive Breakpoints

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile | < 768px | Sidebar becomes bottom tab bar (5 items) + "More" sheet; content full-width |
| Tablet | 768-1024px | Sidebar collapses to icons only; content area expands |
| Desktop | 1024-1440px | Full sidebar (256px) + content area |
| Wide | > 1440px | Full sidebar + content with max-width constraint |

---

## 17. API Architecture

### 17.1 Route Convention

```
/api/admin/*              → Master CMS APIs (role: SUPER_ADMIN | ADMIN_1 | ACCOUNT_MANAGER)
/api/cms/*               → Couple CMS APIs (role: COUPLE)
/api/workspace/*          → Couple workspace APIs (role: COUPLE, wedding-scoped)
/api/auth/*              → Authentication endpoints (public)
/api/public/*             → Guest-facing public APIs (no auth)
/api/webhooks/*           → External service webhooks (signed)
```

### 17.2 Response Format

```typescript
// Success
{ data: T, message?: string }

// Error
{ error: string, code: string, details?: unknown }

// List
{ data: T[], total: number, page: number, pageSize: number }

// Paginated
{ data: T[], pagination: { page: number, pageSize: number, totalPages: number, total: number } }
```

### 17.3 Authentication Flow

```
Client                     Server
  │                          │
  │── POST /api/auth/login ──▶│
  │   { email, password }     │
  │                          │── Validate credentials (bcrypt)
  │                          │── Create JWT (24h expiry)
  │◀── { user, role, jwt } ──│
  │                          │
  │── GET /api/workspace/* ──▶│
  │   Authorization: Bearer   │── Verify JWT, extract role + weddingId
  │                          │── Scope query to user's wedding
  │◀── { data }              │
  │                          │
```

### 17.4 Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/auth/login` | 5 attempts | 15 minutes (per email) |
| `/api/auth/forgot-password` | 3 requests | 1 hour (per email) |
| `/api/workspace/*` | 100 requests | 1 minute (per session) |
| `/api/admin/*` | 200 requests | 1 minute (per session) |
| `/api/public/rsvp` | 10 submissions | 1 hour (per IP) |
| Guest site pages | No limit | — |

---

## 18. Future Module Expansion

### 18.1 Event Types (Plug-and-Play)

The platform architecture supports new event types by adding:

1. A new `eventType` string in `EventSchedule`
2. A new section in `WeddingContent`
3. A new page in `CoupleCMSStore` navigation
4. A feature flag in `PlatformFeature`
5. Optional: cultural-specific templates and content fields

| Event Type | Feature Key | Cultural Context |
|------------|-------------|-----------------|
| Birthday Invitations | `birthday` | Universal |
| Corporate Events | `corporate` | Universal |
| Baby Showers | `baby_shower` | Universal |
| Graduations | `graduation` | Universal |
| Anniversaries | `anniversary` | Universal |
| Funerals | `funeral` | Universal |
| Festive Celebrations | `festive` | Hindu, Chinese, Malay |

### 18.2 AI Modules (Future)

| Module | Feature Key | Description |
|--------|-------------|-------------|
| AI Invitation Text | `ai_invitation_text` | Generate welcome messages, RSVP copy, story text from briefs |
| AI Seating Planner | `ai_seating` | Optimize table assignments based on relationships and preferences |
| AI Copywriter | `ai_copywriter` | Rewrite content for tone, length, and style |
| AI Photo Curation | `ai_photo_curate` | Auto-select and arrange gallery photos |
| AI Guest Insights | `ai_guest_insights` | Predict RSVP likelihood and suggest follow-up actions |

### 18.3 Marketplace (Future)

| Module | Description |
|--------|-------------|
| Vendor Marketplace | Couples find and book photographers, caterers, florists |
| Wedding Marketplace | Shared vendor reviews and recommendations |
| Template Marketplace | Designers sell custom templates |
| Affiliate Portal | Referral tracking and commission management |

---

## 19. Implementation Roadmap

### Phase 1: MVP (Current Foundation)

**Status:** Partially implemented.

| Component | Status | Notes |
|-----------|--------|-------|
| Master CMS (6 pages) | ✅ Layout exists | Dashboard, weddings, templates, analytics, settings, users |
| Couple CMS (16 pages) | ✅ Layout + 5 pages | Overview, details, content editor, media, settings implemented |
| Auth (credentials) | ✅ Working | JWT, bcrypt, role-based sessions |
| Multi-tenant data | ✅ Working | Wedding-scoped Prisma models |
| Guest management | ⚠️ Partial | Guest model exists, no import/export/bulk-edit |
| RSVP system | ⚠️ Partial | Submission model exists, no reminder workflow |
| Feature flags | ⚠️ Partial | WeddingFeature exists, no PlatformFeature |
| Media library | ⚠️ Basic | Upload/display exists, no folders/tags/versions |
| Notifications | ⚠️ Basic | Model exists, no real-time delivery |
| Audit logging | ⚠️ Basic | Model exists, auto-logging not wired |
| Wedding website | ✅ Working | 8 sections, guest-facing, responsive |

### Phase 2: Complete CMS

| Feature | Priority | Dependencies |
|---------|----------|-------------|
| Platform features table | High | Schema migration |
| Enhanced guest management (import, bulk, dedup) | High | Guest model enhancement |
| RSVP reminder workflow | High | Scheduled jobs, email/SMS |
| Table seating assignment | High | New TableAssignment model |
| QR check-in system | High | New CheckIn model |
| Template marketplace | Medium | Template + Theme models |
| Theme engine | Medium | Theme model, CSS variable system |
| Notification delivery (email/SMS) | Medium | External service integration |
| Advanced analytics | Medium | Analytics service integration |
| Support ticket system | Medium | SupportTicket model |
| Subscription/billing | Medium | Plan + Subscription models |

### Phase 3: Enterprise

| Feature | Priority | Dependencies |
|---------|----------|-------------|
| MFA authentication | High | Auth system enhancement |
| Role-based permissions (full RBAC) | High | Role + UserRole models |
| Custom domain support | Medium | DNS integration, SSL provisioning |
| White-label capabilities | Medium | Brand asset management |
| API marketplace | Medium | API key management, rate limiting |
| Mobile app (React Native) | Medium | API-first architecture (already in place) |
| AI modules (text, seating, copywriter) | Low | AI service integration |
| Vendor marketplace | Low | New data models, payment splitting |
| PostgreSQL migration | Low | Schema compatibility (already designed for it) |
| Multi-language support | Low | i18n framework, content localization |

---

*This architecture document is a living specification. It should be updated as the platform evolves. All data models, API routes, and UI components should reference this document as the source of truth for the DWdigitalInvite CMS system.*