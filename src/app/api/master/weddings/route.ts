import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, hashPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPlatformPermission } from '@/lib/permissions';
import { ANIMATION_STYLES } from '@/lib/animation-registry';
import { z } from 'zod/v4';

// Prevent Next.js from caching this route — always return fresh data
export const dynamic = 'force-dynamic';

const createWeddingSchema = z.object({
  coupleName: z.string().min(2, 'Couple name is required'),
  brideName: z.string().nullable().optional(),
  groomName: z.string().nullable().optional(),
  coupleEmail: z.string().email('Valid couple email is required'),
  couplePhone: z.string().optional(),
  weddingDate: z.string(),
  weddingTime: z.string().optional(),
  venue: z.string().optional(),
  venueAddress: z.string().min(1, 'Venue address is required'),
  googleMapsUrl: z.string().optional(),
  jobNumber: z.string().optional(),
  plan: z.enum(['GOLD', 'PLATINUM', 'DIAMOND']).default('GOLD'),
  features: z.array(z.string()).optional(), // feature keys to enable (overrides package defaults)
  consultantId: z.string().nullable().optional(),
  coordinatorId: z.string().nullable().optional(),
  internalNotes: z.string().optional(),
});

// GET /api/master/weddings — list all weddings with pagination
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(await hasPlatformPermission(session.user.id, session.user.role, 'platform:weddings:read'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const plan = searchParams.get('plan') || '';

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { coupleName: { contains: search } },
        { brideName: { contains: search } },
        { groomName: { contains: search } },
        { slug: { contains: search } },
        { jobNumber: { contains: search } },
        { venue: { contains: search } },
      ];
    }
    if (status) where.status = status;
    if (plan) where.plan = plan;

    const [weddings, total] = await Promise.all([
      db.weddingAccount.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          consultant: { select: { id: true, name: true } },
          features: { select: { featureKey: true, isEnabled: true } },
        },
      }),
      db.weddingAccount.count({ where }),
    ]);

    const response = NextResponse.json({ weddings, total, page, limit });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return response;
  } catch (error) {
    console.error('Weddings list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/master/weddings — create a new wedding account + couple login
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    // SUPER_ADMIN and ACCOUNT_MANAGER_1 (formerly ADMIN_1) can create weddings
    if (!session?.user || !(await hasPlatformPermission(session.user.id, session.user.role, 'platform:weddings:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createWeddingSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const data = parsed.data;

    // Check if couple email is already registered
    const existingUser = await db.user.findUnique({ where: { email: data.coupleEmail.toLowerCase() } });
    if (existingUser) {
      // If the existing user is a COUPLE, reuse their account instead of
      // failing. This lets an admin create a second wedding for an existing
      // couple (e.g. vow renewal) without a "email already exists" error.
      if (existingUser.role !== 'COUPLE') {
        return NextResponse.json(
          { error: 'A user with this email already exists (non-couple account)' },
          { status: 409 },
        );
      }
      // Fall through — coupleUser will be resolved to existingUser below
    }

    // Generate slug
    const slug = data.coupleName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + data.weddingDate.split('T')[0];

    // Check slug uniqueness
    const existingWedding = await db.weddingAccount.findUnique({ where: { slug } });
    if (existingWedding) {
      return NextResponse.json({ error: 'A wedding with a similar name and date already exists' }, { status: 409 });
    }

    // Auto-generate job number if not provided (DW-TDS-YYYY-NNNNNN)
    let jobNumber = data.jobNumber;
    if (!jobNumber) {
      const year = new Date(data.weddingDate).getFullYear();
      const count = await db.weddingAccount.count();
      jobNumber = `DW-TDS-${year}-${String(count + 1).padStart(6, '0')}`;
    }

    // Read platform settings
    const settings = await db.systemSetting.findMany({
      where: { key: { in: ['default_couple_password', 'couple_access_expiry_days', 'package_templates'] } },
    });
    const settingsMap: Record<string, string> = {};
    for (const s of settings) settingsMap[s.key] = s.value;

    const defaultPassword = settingsMap['default_couple_password'] || 'Couple@123';
    const expiryDays = parseInt(settingsMap['couple_access_expiry_days'] || '30', 10);

    // Parse package templates to get default features for the selected plan
    let packageFeatures: string[] = [];
    if (settingsMap['package_templates']) {
      try {
        const packages = JSON.parse(settingsMap['package_templates']);
        const pkg = packages.find((p: { name: string }) => p.name === data.plan);
        if (pkg) packageFeatures = pkg.features || [];
      } catch { /* ignore parse errors */ }
    }
    // Fallback: if no package templates, use all features
    if (packageFeatures.length === 0) {
      packageFeatures = ['countdown', 'schedule', 'rsvp', 'getting-there', 'story', 'wishes', 'qa', 'moments', 'gallery', 'music', 'video'];
    }

    // If admin provided explicit feature overrides, use those; otherwise use package defaults
    const enabledFeatures = data.features ?? packageFeatures;

    // All known feature keys
    const allFeatureKeys = ['countdown', 'schedule', 'rsvp', 'getting-there', 'story', 'wishes', 'qa', 'moments', 'guests', 'gallery', 'music', 'video'];

    // Calculate access expiry date
    const weddingDate = new Date(data.weddingDate);
    const accessExpiryDate = new Date(weddingDate);
    accessExpiryDate.setDate(accessExpiryDate.getDate() + expiryDays);

    // Create couple user account (or reuse existing COUPLE user)
    let coupleUser;
    if (existingUser) {
      // Reuse the existing COUPLE account — update the name in case it changed
      coupleUser = await db.user.update({
        where: { id: existingUser.id },
        data: { name: data.coupleName },
      });
    } else {
      const passwordHash = await hashPassword(defaultPassword);
      coupleUser = await db.user.create({
        data: {
          email: data.coupleEmail.toLowerCase(),
          passwordHash,
          name: data.coupleName,
          role: 'COUPLE',
          isActive: true,
          mustChangePassword: true,  // Force password change on first login
        },
      });
    }

    // Create wedding account
    const wedding = await db.weddingAccount.create({
      data: {
        slug,
        coupleName: data.coupleName,
        brideName: data.brideName,
        groomName: data.groomName,
        weddingDate,
        weddingTime: data.weddingTime || null,
        venue: data.venue || null,
        venueAddress: data.venueAddress,
        googleMapsUrl: data.googleMapsUrl || null,
        plan: data.plan,
        status: 'DRAFT',
        accountStatus: 'ONBOARDING',
        jobNumber,
        coupleEmail: data.coupleEmail.toLowerCase(),
        couplePhone: data.couplePhone || null,
        consultantId: data.consultantId || null,
        coordinatorId: data.coordinatorId || null,
        internalNotes: data.internalNotes || null,
        accessExpiryDate,
        ownerId: coupleUser.id,
      },
    });

    // Create feature rows — all features created, isEnabled based on package/override
    await db.weddingFeature.createMany({
      data: allFeatureKeys.map((key) => ({
        weddingId: wedding.id,
        featureKey: key,
        isEnabled: enabledFeatures.includes(key),
      })),
    });

    // Seed the 3 individual animation feature rows.
    // Each animation style is its own WeddingFeature row with featureKey
    // 'animation:gold-dust', 'animation:flying-stars', 'animation:raining'.
    // Read the admin's toggle settings from the default ContentTemplate's
    // hero content (set via Template Editor > Home > Ambient Animations).
    const ANIMATION_STYLE_KEYS = ANIMATION_STYLES.map((s) => `animation:${s.key}`);
    let templateAnimFlags: Record<string, boolean> = {};
    try {
      // Same fallback logic as wedding-defaults.ts: try isDefault first, then first active
      let defaultTemplate = await db.contentTemplate.findFirst({ where: { isDefault: true, isActive: true } });
      if (!defaultTemplate) {
        defaultTemplate = await db.contentTemplate.findFirst({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
      }
      if (defaultTemplate) {
        const templateContent = JSON.parse(defaultTemplate.content) as { section: string; fieldKey: string; fieldValue: string }[];
        for (const c of templateContent) {
          if (c.section === 'hero' && ANIMATION_STYLE_KEYS.includes(c.fieldKey)) {
            templateAnimFlags[c.fieldKey] = c.fieldValue === 'true';
          }
        }
      }
    } catch { /* non-blocking */ }
    await db.weddingFeature.createMany({
      data: ANIMATION_STYLE_KEYS.map((key) => ({
        weddingId: wedding.id,
        featureKey: key,
        isEnabled: templateAnimFlags[key] ?? (key === 'animation:gold-dust'),
      })),
    }).catch(() => {
      // Defensive — ignore errors if rows already exist
    });

    // Seed default content, schedule, FAQs, and stories so the couple has
    // a starting template to customize (rather than an empty shell).
    let templateSeedResult: {
      templateId: string;
      templateName: string;
      content: number;
      schedule: number;
      faqs: number;
      stories: number;
      media: number;
    } | null = null;
    let templateSeedError: string | null = null;
    try {
      const { seedDefaultWeddingContent } = await import('@/lib/wedding-defaults');
      templateSeedResult = await seedDefaultWeddingContent({
        weddingId: wedding.id,
        coupleName: data.coupleName,
        brideName: data.brideName,
        groomName: data.groomName,
        weddingDate,
        weddingTime: data.weddingTime || null,
        venue: data.venue || null,
        venueAddress: data.venueAddress,
      });
      if (!templateSeedResult) {
        templateSeedError = 'No active content template found — wedding created without default content. Please create/set a template in Admin CMS > Content Templates.';
        console.error(`[master/weddings POST] ${templateSeedError}`);
      }
    } catch (err) {
      templateSeedError = err instanceof Error ? err.message : String(err);
      console.error('[master/weddings POST] Default content seed failed (non-blocking):', err);
    }

    // Audit log (non-blocking — wedding is already created, don't fail the
    // entire request if the audit log fails for any reason)
    try {
      await db.auditLog.create({
        data: {
          userId: session.user.id,
          weddingId: wedding.id,
          action: 'CREATE',
          entity: 'WeddingAccount',
          entityId: wedding.id,
          details: JSON.stringify({
            coupleName: data.coupleName,
            plan: data.plan,
            jobNumber,
            coupleEmail: data.coupleEmail,
            slug,
            features: enabledFeatures,
          }),
        },
      });
    } catch (auditErr) {
      console.error('[master/weddings POST] Audit log creation failed (non-blocking):', auditErr);
    }

    // Send onboarding email (queued if no email provider configured)
    try {
      const { sendEmail, renderOnboardingEmail } = await import('@/lib/email-service');
      const consultant = data.consultantId
        ? await db.user.findUnique({ where: { id: data.consultantId }, select: { name: true } })
        : null;
      const emailContent = renderOnboardingEmail({
        coupleName: data.coupleName,
        coupleCmsUrl: `/?view=couple`,
        guestInvitationUrl: `/${slug}`,
        loginId: data.coupleEmail.toLowerCase(),
        password: defaultPassword,
        consultantName: consultant?.name,
      });
      await sendEmail({
        to: data.coupleEmail.toLowerCase(),
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      }, 'onboarding');
    } catch (emailError) {
      console.error('Onboarding email failed (non-blocking):', emailError);
    }

    // Return wedding + generated credentials + template seed info
    return NextResponse.json({
      wedding,
      credentials: {
        coupleCmsUrl: `/?view=couple`,
        guestInvitationUrl: `/${slug}`,
        loginId: data.coupleEmail.toLowerCase(),
        defaultPassword,
        jobNumber,
        accessExpiryDate: accessExpiryDate.toISOString(),
      },
      templateSeed: templateSeedResult
        ? { applied: true, ...templateSeedResult }
        : { applied: false, error: templateSeedError || 'Unknown error' },
    }, { status: 201 });
  } catch (error) {
    console.error('Wedding create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/master/weddings — update a wedding account
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(await hasPlatformPermission(session.user.id, session.user.role, 'platform:weddings:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, ...updates } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Wedding ID required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (updates.coupleName) updateData.coupleName = updates.coupleName;
    if (updates.brideName !== undefined) updateData.brideName = updates.brideName;
    if (updates.groomName !== undefined) updateData.groomName = updates.groomName;
    if (updates.weddingDate) updateData.weddingDate = new Date(updates.weddingDate);
    if (updates.weddingTime !== undefined) updateData.weddingTime = updates.weddingTime;
    if (updates.venue !== undefined) updateData.venue = updates.venue;
    if (updates.venueAddress !== undefined) updateData.venueAddress = updates.venueAddress;
    if (updates.googleMapsUrl !== undefined) updateData.googleMapsUrl = updates.googleMapsUrl;
    if (updates.status) updateData.status = updates.status;
    if (updates.plan) updateData.plan = updates.plan;
    if (updates.heroImageUrl !== undefined) updateData.heroImageUrl = updates.heroImageUrl;
    if (updates.bannerUrl !== undefined) updateData.bannerUrl = updates.bannerUrl;
    // Consultant & coordinator assignment (null clears the field)
    if (updates.consultantId !== undefined) updateData.consultantId = updates.consultantId || null;
    if (updates.coordinatorId !== undefined) updateData.coordinatorId = updates.coordinatorId || null;
    // Registration details
    if (updates.coupleEmail !== undefined) updateData.coupleEmail = updates.coupleEmail || null;
    if (updates.couplePhone !== undefined) updateData.couplePhone = updates.couplePhone || null;
    if (updates.jobNumber !== undefined) updateData.jobNumber = updates.jobNumber || null;
    if (updates.accountStatus !== undefined) updateData.accountStatus = updates.accountStatus;
    if (updates.internalNotes !== undefined) updateData.internalNotes = updates.internalNotes || null;

    // Handle section toggles
    if (Array.isArray(updates.sections)) {
      const optionalFeatureKeys = ['story', 'wishes', 'qa', 'moments', 'templates'];
      for (const key of optionalFeatureKeys) {
        await db.weddingFeature.upsert({
          where: { weddingId_featureKey: { weddingId: id, featureKey: key } },
          update: { isEnabled: updates.sections.includes(key) },
          create: { weddingId: id, featureKey: key, isEnabled: updates.sections.includes(key) },
        });
      }
    }

    const wedding = await db.weddingAccount.update({
      where: { id },
      data: updateData,
    });

    // ── Ensure animation feature rows exist on plan change ──────────────
    //
    // With the per-animation-feature-row model, each animation style is its
    // own WeddingFeature row (animation:gold-dust, animation:flying-stars,
    // animation:raining). On plan change, we ensure all 3 rows exist so the
    // couple can toggle them via their CMS. Existing rows are preserved.
    if (updates.plan) {
      try {
        const ANIMATION_KEYS = ANIMATION_STYLES.map((s) => `animation:${s.key}`);
        for (const key of ANIMATION_KEYS) {
          const existing = await db.weddingFeature.findFirst({
            where: { weddingId: id, featureKey: key },
          });
          if (!existing) {
            await db.weddingFeature.create({
              data: {
                weddingId: id,
                featureKey: key,
                isEnabled: key === 'animation:gold-dust', // Gold Dust ON by default
              },
            });
          }
        }
      } catch (err) {
        // Don't fail the wedding update just because the animation ensure failed.
        console.error('[master/weddings PATCH] Animation ensure failed:', err);
      }
    }

    // Audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entity: 'WeddingAccount',
        entityId: id,
        details: JSON.stringify(updates),
      },
    });

    return NextResponse.json({ wedding });
  } catch (error) {
    console.error('Wedding update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/master/weddings — archive (soft) or permanently delete (hard) a wedding account
//   ?hard=true  → permanent deletion (irreversible)
//   default     → soft delete (sets status to ARCHIVED)
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(await hasPlatformPermission(session.user.id, session.user.role, 'platform:weddings:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, confirmName } = body;
    const { searchParams } = new URL(req.url);
    const hard = searchParams.get('hard') === 'true';

    if (!id) {
      return NextResponse.json({ error: 'Wedding ID required' }, { status: 400 });
    }

    // Look up the wedding for confirmation + audit
    const wedding = await db.weddingAccount.findUnique({
      where: { id },
      select: { id: true, coupleName: true, ownerId: true, slug: true },
    });
    if (!wedding) {
      return NextResponse.json({ error: 'Wedding not found' }, { status: 404 });
    }

    // ── Soft delete (archive) ─────────────────────────────────────────────
    if (!hard) {
      await db.weddingAccount.update({
        where: { id },
        data: { status: 'ARCHIVED' },
      });

      await db.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'DELETE',
          entity: 'WeddingAccount',
          entityId: id,
          details: JSON.stringify({ status: 'ARCHIVED' }),
        },
      });

      return NextResponse.json({ success: true, mode: 'archive' });
    }

    // ── Hard delete (permanent) ───────────────────────────────────────────
    // Requires the dedicated platform:weddings:delete permission.
    // Default seed: only SUPER_ADMIN_1/2 get it (via wildcard).
    if (!(await hasPlatformPermission(session.user.id, session.user.role, 'platform:weddings:delete'))) {
      return NextResponse.json({ error: 'Only users with "Delete Weddings" permission can permanently delete wedding accounts' }, { status: 403 });
    }

    // Require the admin to type the exact couple name for confirmation
    if (!confirmName || confirmName.trim() !== wedding.coupleName) {
      return NextResponse.json(
        { error: 'Confirmation mismatch. Type the exact couple name to confirm deletion.' },
        { status: 400 },
      );
    }

    // Delete non-cascading related records (FK without onDelete: Cascade)
    // Order matters: children before parents
    const weddingId = id;
    await db.rSVPSubmission.deleteMany({ where: { weddingId } });   // GuestResponse cascades
    await db.wish.deleteMany({ where: { weddingId } });
    await db.contactSubmission.deleteMany({ where: { weddingId } });
    await db.auditLog.deleteMany({ where: { weddingId } });
    await db.notification.deleteMany({ where: { weddingId } });

    // Delete the wedding account itself
    // Cascading relations auto-deleted: UserWeddingRole, WeddingFeature,
    // WeddingContent, WeddingMedia, EventSchedule, FAQ, StoryItem, Guest,
    // SeatingTable, SeatingHistory, HoneymoonVote, HoneymoonSuggestion
    await db.weddingAccount.delete({ where: { id: weddingId } });

    // Clean up uploaded files on disk
    try {
      const fs = await import('fs');
      const path = await import('path');
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'weddings', weddingId);
      if (fs.existsSync(uploadDir)) {
        fs.rmSync(uploadDir, { recursive: true, force: true });
      }
    } catch (err) {
      // Non-blocking — wedding is already deleted from DB
      console.warn(`[hard-delete] File cleanup failed for ${weddingId}:`, err);
    }

    // Create a final audit log (references no wedding — it's gone)
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'HARD_DELETE',
        entity: 'WeddingAccount',
        entityId: weddingId,
        details: JSON.stringify({
          coupleName: wedding.coupleName,
          slug: wedding.slug,
          ownerId: wedding.ownerId,
        }),
      },
    });

    return NextResponse.json({ success: true, mode: 'permanent' });
  } catch (error) {
    console.error('Wedding delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}