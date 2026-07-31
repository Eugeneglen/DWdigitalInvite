import { db } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType =
  | 'RSVP_RECEIVED'
  | 'WISH_RECEIVED'
  | 'CONTACT_RECEIVED'
  | 'GUEST_OPENED'
  | 'SYSTEM';

interface CreateNotificationInput {
  userId?: string;
  weddingId?: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

// ---------------------------------------------------------------------------
// Create a single notification (fire-and-forget, non-blocking)
// ---------------------------------------------------------------------------

export async function createNotification(input: CreateNotificationInput) {
  try {
    await db.notification.create({
      data: {
        userId: input.userId || null,
        weddingId: input.weddingId || null,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link || null,
      },
    });
  } catch {
    // Notification creation should never block the main flow
  }
}

// ---------------------------------------------------------------------------
// Convenience: notify the wedding owner about a guest action
// ---------------------------------------------------------------------------

export async function notifyWeddingOwner(
  weddingId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string,
) {
  // Find the wedding's owner
  const wedding = await db.weddingAccount.findUnique({
    where: { id: weddingId },
    select: { ownerId: true },
  });

  if (!wedding?.ownerId) return;

  await createNotification({
    userId: wedding.ownerId,
    weddingId,
    type,
    title,
    message,
    link,
  });
}

// ---------------------------------------------------------------------------
// Convenience: notify all SUPER_ADMIN and ACCOUNT_MANAGER users (system)
// ---------------------------------------------------------------------------

export async function notifyAdmins(
  type: NotificationType,
  title: string,
  message: string,
  link?: string,
) {
  const admins = await db.user.findMany({
    where: {
      role: { in: ['SUPER_ADMIN_1', 'SUPER_ADMIN_2', 'CONSULTANT_1', 'CONSULTANT_2'] },
      isActive: true,
    },
    select: { id: true },
  });

  await Promise.allSettled(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        type,
        title,
        message,
        link,
      }),
    ),
  );
}