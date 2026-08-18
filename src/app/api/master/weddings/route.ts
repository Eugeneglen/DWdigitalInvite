import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, hashPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod/v4';

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
    if (!session?.user || (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'SUPER_ADMIN_1')) {
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
          features: { select: { featureKey: true, isEnabled: true } },
          _count: { select: { rsvps: true, wishes: true, guests: true, contacts: true } },
        },
      }),
      db.weddingAccount.count({ where }),
    ]);

    return NextResponse.json({ weddings, total, page, limit });
  } catch (error) {
    console.error('Weddings list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/master/weddings — create a new wedding account + couple login
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    // SUPER_ADMIN and ADMIN_1 (Consultant) can create weddings
    if (!session?.user || (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'SUPER_ADMIN_1' && session.user.role !== 'ADMIN_1')) {
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
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
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
    const allFeatureKeys = ['countdown', 'schedule', 'rsvp', 'getting-there', 'story', 'wishes', 'qa', 'moments', 'gallery', 'music', 'video'];

    // Calculate access expiry date
    const weddingDate = new Date(data.weddingDate);
    const accessExpiryDate = new Date(weddingDate);
    accessExpiryDate.setDate(accessExpiryDate.getDate() + expiryDays);

    // Create couple user account
    const passwordHash = await hashPassword(defaultPassword);
    const coupleUser = await db.user.create({
      data: {
        email: data.coupleEmail.toLowerCase(),
        passwordHash,
        name: data.coupleName,
        role: 'COUPLE',
        isActive: true,
      },
    });

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

    // Audit log
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

    // Return wedding + generated credentials
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
    if (!session?.user || (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'SUPER_ADMIN_1')) {
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

    // Handle section toggles
    if (Array.isArray(updates.sections)) {
      const optionalFeatureKeys = ['story', 'wishes', 'qa', 'moments'];
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

// DELETE /api/master/weddings — archive a wedding account
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'SUPER_ADMIN_1')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: 'Wedding ID required' }, { status: 400 });
    }

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Wedding delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}