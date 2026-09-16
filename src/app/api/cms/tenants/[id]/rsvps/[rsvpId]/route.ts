import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, createAuditLog, authorizeTenantAccess } from '@/lib/auth-middleware';

// ============================================
// GET — Single RSVP with guests
// ============================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; rsvpId: string }> }
) {
  try {
    const { user, error: authError } = await authenticateRequest(request);
    if (authError || !user) {
      return Response.json({ success: false, error: authError || 'Authentication required' }, { status: 401 });
    }

    const { id: weddingId, rsvpId } = await params;
    // R-03 (F-03) tenant guard: authenticate → resolve wedding → platform/owner/member → permission
    const guard = await authorizeTenantAccess(user, weddingId, { platformPerm: 'platform:weddings:read', weddingAction: 'wedding:read' });
    if (!guard.ok) {
      return Response.json({ success: false, error: guard.error }, { status: guard.status });
    }

    const rsvp = await db.rSVPSubmission.findFirst({
      where: { id: rsvpId, weddingId },
      include: { guests: true },
    });

    if (!rsvp) {
      return Response.json({ success: false, error: 'RSVP not found' }, { status: 404 });
    }

    return Response.json({
      success: true,
      data: {
        id: rsvp.id,
        weddingId: rsvp.weddingId,
        firstName: rsvp.firstName,
        lastName: rsvp.lastName,
        partySize: rsvp.partySize,
        createdAt: rsvp.createdAt.toISOString(),
        updatedAt: rsvp.updatedAt.toISOString(),
        guests: rsvp.guests.map((g) => ({
          id: g.id,
          name: g.name,
          attendance: g.attendance,
          dietary: g.dietary,
          createdAt: g.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    console.error('Get RSVP error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// DELETE — Remove RSVP and its guests
// ============================================

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; rsvpId: string }> }
) {
  try {
    const { user, error: authError } = await authenticateRequest(request);
    if (authError || !user) {
      return Response.json({ success: false, error: authError || 'Authentication required' }, { status: 401 });
    }

    const { id: weddingId, rsvpId } = await params;
    // R-03 (F-03) tenant guard: authenticate → resolve wedding → platform/owner/member → permission
    const guard = await authorizeTenantAccess(user, weddingId, { platformPerm: 'platform:weddings:read', weddingAction: 'wedding:rsvps:manage' });
    if (!guard.ok) {
      return Response.json({ success: false, error: guard.error }, { status: guard.status });
    }

    const existing = await db.rSVPSubmission.findFirst({
      where: { id: rsvpId, weddingId },
    });

    if (!existing) {
      return Response.json({ success: false, error: 'RSVP not found' }, { status: 404 });
    }

    await db.rSVPSubmission.delete({ where: { id: rsvpId } });

    await createAuditLog({
      userId: user.userId,
      action: 'rsvp.delete',
      resource: 'RSVPSubmission',
      resourceId: rsvpId,
      weddingId,
      details: { name: `${existing.firstName} ${existing.lastName}` },
      request,
    });

    return Response.json({ success: true, data: { id: rsvpId } });
  } catch (err) {
    console.error('Delete RSVP error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}