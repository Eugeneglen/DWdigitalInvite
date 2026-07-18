import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// GET /api/master/expiry-check
// Scans all ACTIVE/COMPLETED weddings and:
// 1. Auto-sets COMPLETED for weddings past their date + 1 day
// 2. Auto-sets EXPIRED for weddings past their accessExpiryDate
// 3. Creates notifications for weddings expiring within N days
// Returns a summary of actions taken.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== 'SUPER_ADMIN' && !session.user.role?.startsWith('ADMIN'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    let completedCount = 0;
    let expiredCount = 0;
    let notificationsCreated = 0;

    // 1. Auto-COMPLETED: wedding date + 1 day has passed, still ACTIVE/ONBOARDING
    const toComplete = await db.weddingAccount.findMany({
      where: {
        weddingDate: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        accountStatus: { in: ['ACTIVE', 'ONBOARDING'] },
      },
      select: { id: true, coupleName: true },
    });
    for (const w of toComplete) {
      await db.weddingAccount.update({
        where: { id: w.id },
        data: { accountStatus: 'COMPLETED' },
      });
      completedCount++;
    }

    // 2. Auto-EXPIRED: accessExpiryDate has passed, not yet EXPIRED
    const toExpire = await db.weddingAccount.findMany({
      where: {
        accessExpiryDate: { lt: now },
        accountStatus: { not: 'EXPIRED' },
      },
      select: { id: true, coupleName: true },
    });
    for (const w of toExpire) {
      await db.weddingAccount.update({
        where: { id: w.id },
        data: { accountStatus: 'EXPIRED' },
      });
      expiredCount++;
    }

    // 3. Expiry warnings: weddings expiring within N days (default 7)
    const settings = await db.systemSetting.findFirst({
      where: { key: 'expiry_notification_days' },
    });
    const warningDays = parseInt(settings?.value || '7', 10);
    const warningThreshold = new Date(now.getTime() + warningDays * 24 * 60 * 60 * 1000);

    const expiringSoon = await db.weddingAccount.findMany({
      where: {
        accessExpiryDate: {
          gte: now,
          lte: warningThreshold,
        },
        accountStatus: { in: ['ACTIVE', 'COMPLETED'] },
      },
      select: { id: true, coupleName: true, accessExpiryDate: true },
    });

    // Create notifications for super admins (if not already created)
    const admins = await db.user.findMany({
      where: { role: 'SUPER_ADMIN', isActive: true },
      select: { id: true },
    });

    for (const w of expiringSoon) {
      // Check if notification already exists for this wedding
      const existing = await db.notification.findFirst({
        where: {
          type: 'WEDDING_EXPIRY',
          entityId: w.id,
          createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }, // within last 24h
        },
      });
      if (!existing) {
        const daysLeft = Math.ceil((w.accessExpiryDate!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        for (const admin of admins) {
          await db.notification.create({
            data: {
              userId: admin.id,
              type: 'WEDDING_EXPIRY',
              title: 'Access Expiring Soon',
              message: `${w.coupleName}'s access expires in ${daysLeft} day(s).`,
              entityId: w.id,
              isRead: false,
            },
          });
          notificationsCreated++;
        }

        // Send expiry warning email to the couple
        try {
          const { sendEmail, renderExpiryWarningEmail } = await import('@/lib/email-service');
          // Get couple's email from the wedding account
          const weddingWithEmail = await db.weddingAccount.findUnique({
            where: { id: w.id },
            select: { coupleEmail: true, consultantId: true },
          });
          if (weddingWithEmail?.coupleEmail) {
            let consultantName: string | undefined;
            if (weddingWithEmail.consultantId) {
              const consultant = await db.user.findUnique({
                where: { id: weddingWithEmail.consultantId },
                select: { name: true },
              });
              consultantName = consultant?.name;
            }
            const emailContent = renderExpiryWarningEmail({
              coupleName: w.coupleName,
              expiryDate: w.accessExpiryDate!.toISOString(),
              consultantName,
            });
            await sendEmail({
              to: weddingWithEmail.coupleEmail,
              subject: emailContent.subject,
              html: emailContent.html,
              text: emailContent.text,
            }, 'expiry_warning');
          }
        } catch (emailError) {
          console.error('Expiry warning email failed (non-blocking):', emailError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        autoCompleted: completedCount,
        autoExpired: expiredCount,
        expiringSoon: expiringSoon.length,
        notificationsCreated,
      },
    });
  } catch (error) {
    console.error('Expiry check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
