import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPlatformPermission } from '@/lib/permissions';
import { sendEmail } from '@/lib/email-service';

// POST /api/master/settings/test-email
// Sends a test email using the provided config (doesn't need to be saved first)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(await hasPlatformPermission(session.user.id, session.user.role, 'platform:settings:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { config } = body as {
      config: {
        provider: string;
        apiKey: string;
        fromEmail: string;
        fromName: string;
        replyTo: string;
      };
    };

    if (!config || !config.apiKey || !config.fromEmail) {
      return NextResponse.json({ error: 'API key and from email are required' }, { status: 400 });
    }

    // Temporarily save the config so sendEmail() can use it
    const { db } = await import('@/lib/db');
    await db.systemSetting.upsert({
      where: { key: 'email_provider_config' },
      update: { value: JSON.stringify(config) },
      create: { key: 'email_provider_config', value: JSON.stringify(config) },
    });

    // Send test email
    const result = await sendEmail({
      to: session.user.email,
      subject: 'DreamWeavers — Test Email',
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; background: #FCF9F2; padding: 40px; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1A1A1A; font-size: 24px; margin: 0;">DreamWeavers</h1>
            <p style="color: #D4AF37; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 5px 0 0 0;">Digital Wedding Invitations</p>
          </div>
          <h2 style="color: #1A1A1A; font-size: 20px;">✅ Test Email Successful</h2>
          <p style="color: #555; line-height: 1.6;">This is a test email from the DreamWeavers platform. If you're reading this, your email provider configuration is working correctly.</p>
          <p style="color: #555; line-height: 1.6;"><strong>Provider:</strong> ${config.provider}<br><strong>From:</strong> ${config.fromName} &lt;${config.fromEmail}&gt;</p>
          <p style="color: #555; line-height: 1.6;">Warm regards,<br>The DreamWeavers Team</p>
        </div>
      `,
      text: `Test Email Successful\n\nThis is a test email from the DreamWeavers platform. If you're reading this, your email provider configuration is working correctly.\n\nProvider: ${config.provider}\nFrom: ${config.fromName} <${config.fromEmail}>\n\nWarm regards,\nThe DreamWeavers Team`,
    }, 'test_email');

    if (result.success && !result.queued) {
      return NextResponse.json({ success: true, message: 'Test email sent successfully' });
    } else if (result.queued) {
      return NextResponse.json({ success: true, message: 'Test email queued (provider not configured)' });
    } else {
      return NextResponse.json({ error: result.error || 'Failed to send test email' }, { status: 500 });
    }
  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
