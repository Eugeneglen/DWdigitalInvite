import { db } from '@/lib/db';

// ── Email Types ────────────────────────────────────────────────────────────

export interface EmailMessage {
  to: string;
  from?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailTemplate {
  key: string;
  name: string;
  description: string;
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  { key: 'onboarding', name: 'Couple Onboarding', description: 'Sent when a wedding is created — contains login credentials and URLs' },
  { key: 'expiry_warning', name: 'Access Expiry Warning', description: 'Sent to couple 7 days before their access expires' },
  { key: 'rsvp_reminder', name: 'RSVP Reminder', description: 'Sent to couple when RSVP deadline is approaching' },
  { key: 'thank_you', name: 'Post-Wedding Thank You', description: 'Sent to couple after the wedding day' },
];

// ── Email Log Model (stored in SystemSetting as JSON queue) ────────────────
// Emails are queued in SystemSetting key 'email_queue' until a provider is
// configured. When a provider is active, emails are sent immediately and
// logged to AuditLog.

interface QueuedEmail {
  id: string;
  to: string;
  subject: string;
  templateKey: string;
  createdAt: string;
  status: 'queued' | 'sent' | 'failed';
  error?: string;
}

// ── Provider Configuration ─────────────────────────────────────────────────

interface EmailProviderConfig {
  provider: 'none' | 'sendgrid' | 'ses' | 'postmark' | 'smtp';
  apiKey?: string;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
}

async function getProviderConfig(): Promise<EmailProviderConfig> {
  const setting = await db.systemSetting.findUnique({
    where: { key: 'email_provider_config' },
  });
  if (!setting) {
    return { provider: 'none' };
  }
  try {
    return JSON.parse(setting.value) as EmailProviderConfig;
  } catch {
    return { provider: 'none' };
  }
}

// ── Main Send Function ─────────────────────────────────────────────────────
//
// This is the single entry point for all email sending. When a provider is
// configured, it sends immediately. When no provider is configured, it
// queues the email in SystemSetting and logs to console.
//
// To activate email: implement the `sendWithProvider` function with your
// chosen provider's SDK, then set the `email_provider_config` system setting.

export async function sendEmail(message: EmailMessage, templateKey: string): Promise<{ success: boolean; queued: boolean; error?: string }> {
  const config = await getProviderConfig();

  if (config.provider === 'none') {
    // No provider configured — queue the email and log
    console.log(`📧 [EMAIL QUEUED] Template: ${templateKey} | To: ${message.to} | Subject: ${message.subject}`);

    // Queue in SystemSetting
    const queueSetting = await db.systemSetting.findUnique({
      where: { key: 'email_queue' },
    });
    const queue: QueuedEmail[] = queueSetting ? safeParse(queueSetting.value, []) : [];

    // Keep only last 100 queued emails
    const trimmed = queue.slice(-99);

    trimmed.push({
      id: `email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      to: message.to,
      subject: message.subject,
      templateKey,
      createdAt: new Date().toISOString(),
      status: 'queued',
    });

    await db.systemSetting.upsert({
      where: { key: 'email_queue' },
      update: { value: JSON.stringify(trimmed) },
      create: { key: 'email_queue', value: JSON.stringify(trimmed) },
    });

    return { success: true, queued: true };
  }

  // Provider configured — send immediately
  try {
    const result = await sendWithProvider(message, config);
    if (result.success) {
      console.log(`✅ [EMAIL SENT] Template: ${templateKey} | To: ${message.to}`);
    }
    return result;
  } catch (error) {
    console.error(`❌ [EMAIL FAILED] Template: ${templateKey} | To: ${message.to} | Error:`, error);
    return { success: false, queued: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ── Provider Implementation (placeholder) ──────────────────────────────────
//
// Replace this function with your provider's SDK call when ready.
// Example for SendGrid:
//   import sgMail from '@sendgrid/mail';
//   sgMail.setApiKey(config.apiKey);
//   await sgMail.send({ to: message.to, from: config.fromEmail, subject: message.subject, html: message.html });

async function sendWithProvider(message: EmailMessage, config: EmailProviderConfig): Promise<{ success: boolean; error?: string }> {
  // TODO: Implement with your chosen email provider
  // For now, this is a placeholder that always succeeds (for testing)
  console.log(`📧 [EMAIL SENT VIA ${config.provider}] To: ${message.to} | Subject: ${message.subject}`);
  return { success: true };
}

// ── Email Templates ────────────────────────────────────────────────────────

export interface OnboardingEmailData {
  coupleName: string;
  coupleCmsUrl: string;
  guestInvitationUrl: string;
  loginId: string;
  password: string;
  consultantName?: string;
}

export function renderOnboardingEmail(data: OnboardingEmailData): { subject: string; html: string; text: string } {
  const subject = `Welcome to DreamWeavers — Your Digital Invitation is Ready!`;
  const text = `
Dear ${data.coupleName},

Welcome to DreamWeavers Digital Wedding Invitations! Your digital invitation is now ready for you to personalise.

Here are your login details:

Couple CMS URL: ${data.coupleCmsUrl}
Guest Invitation URL: ${data.guestInvitationUrl}

Login ID: ${data.loginId}
Password: ${data.password}

Getting Started:
1. Visit the Couple CMS URL above
2. Log in with your email and password
3. Personalise your invitation — add photos, edit your story, manage your guest list
4. Preview your invitation before sharing with guests

${data.consultantName ? `Your assigned consultant is ${data.consultantName}, who can assist you with any questions.` : ''}

Please change your password after your first login for security.

We're excited to help you create a beautiful digital invitation for your special day!

Warm regards,
The DreamWeavers Team
  `.trim();

  const html = `
<div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; background: #FCF9F2; padding: 40px; border-radius: 8px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #1A1A1A; font-size: 24px; margin: 0;">DreamWeavers</h1>
    <p style="color: #D4AF37; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 5px 0 0 0;">Digital Wedding Invitations</p>
  </div>
  <h2 style="color: #1A1A1A; font-size: 20px;">Welcome, ${data.coupleName}! 🎉</h2>
  <p style="color: #555; line-height: 1.6;">Your digital invitation is now ready for you to personalise. Here are your login details:</p>
  <div style="background: #fff; border: 1px solid #E8D5B5; border-radius: 6px; padding: 20px; margin: 20px 0;">
    <p style="margin: 8px 0; color: #555;"><strong style="color: #1A1A1A;">Couple CMS URL:</strong><br><a href="${data.coupleCmsUrl}" style="color: #D4AF37;">${data.coupleCmsUrl}</a></p>
    <p style="margin: 8px 0; color: #555;"><strong style="color: #1A1A1A;">Guest Invitation URL:</strong><br><a href="${data.guestInvitationUrl}" style="color: #D4AF37;">${data.guestInvitationUrl}</a></p>
    <p style="margin: 8px 0; color: #555;"><strong style="color: #1A1A1A;">Login ID:</strong> ${data.loginId}</p>
    <p style="margin: 8px 0; color: #555;"><strong style="color: #1A1A1A;">Password:</strong> ${data.password}</p>
  </div>
  <h3 style="color: #1A1A1A; font-size: 16px;">Getting Started</h3>
  <ol style="color: #555; line-height: 1.8;">
    <li>Visit the Couple CMS URL above</li>
    <li>Log in with your email and password</li>
    <li>Personalise your invitation — add photos, edit your story, manage your guest list</li>
    <li>Preview your invitation before sharing with guests</li>
  </ol>
  ${data.consultantName ? `<p style="color: #555; line-height: 1.6;">Your assigned consultant is <strong>${data.consultantName}</strong>, who can assist you with any questions.</p>` : ''}
  <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #E8D5B5; padding-top: 20px;">Please change your password after your first login for security.</p>
  <p style="color: #555; line-height: 1.6;">Warm regards,<br>The DreamWeavers Team</p>
</div>
  `.trim();

  return { subject, html, text };
}

export interface ExpiryWarningEmailData {
  coupleName: string;
  expiryDate: string;
  consultantName?: string;
}

export function renderExpiryWarningEmail(data: ExpiryWarningEmailData): { subject: string; html: string; text: string } {
  const formattedDate = new Date(data.expiryDate).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' });
  const subject = `Action Needed: Your DreamWeavers Access Expires Soon`;
  const text = `
Dear ${data.coupleName},

This is a friendly reminder that your access to the DreamWeavers Digital Invitation platform will expire on ${formattedDate}.

After this date, you will no longer be able to:
- Log in to your Couple CMS
- Edit your wedding invitation
- Access your guest list and RSVP data

If you need an extension, please contact your DreamWeavers consultant${data.consultantName ? ` (${data.consultantName})` : ''} as soon as possible.

Warm regards,
The DreamWeavers Team
  `.trim();

  const html = `
<div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; background: #FCF9F2; padding: 40px; border-radius: 8px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #1A1A1A; font-size: 24px; margin: 0;">DreamWeavers</h1>
  </div>
  <h2 style="color: #1A1A1A; font-size: 20px;">Access Expiring Soon ⏰</h2>
  <p style="color: #555; line-height: 1.6;">Dear ${data.coupleName},</p>
  <p style="color: #555; line-height: 1.6;">This is a friendly reminder that your access to the DreamWeavers Digital Invitation platform will expire on <strong>${formattedDate}</strong>.</p>
  <p style="color: #555; line-height: 1.6;">After this date, you will no longer be able to:</p>
  <ul style="color: #555; line-height: 1.8;">
    <li>Log in to your Couple CMS</li>
    <li>Edit your wedding invitation</li>
    <li>Access your guest list and RSVP data</li>
  </ul>
  <p style="color: #555; line-height: 1.6;">If you need an extension, please contact your DreamWeavers consultant${data.consultantName ? ` (${data.consultantName})` : ''} as soon as possible.</p>
  <p style="color: #555; line-height: 1.6;">Warm regards,<br>The DreamWeavers Team</p>
</div>
  `.trim();

  return { subject, html, text };
}

export interface ThankYouEmailData {
  coupleName: string;
  weddingDate: string;
}

export function renderThankYouEmail(data: ThankYouEmailData): { subject: string; html: string; text: string } {
  const subject = `Thank You — Your DreamWeavers Journey`;
  const text = `
Dear ${data.coupleName},

Congratulations on your wedding! We hope your special day on ${data.weddingDate} was everything you dreamed of.

Thank you for choosing DreamWeavers for your digital wedding invitation. It has been our privilege to be part of your journey.

Your access to the Couple CMS will remain available for 30 days after your wedding, allowing you to:
- Download your guest list and RSVP data
- Export wishes and messages from your guests
- Save any photos or content from your invitation

After 30 days, your access will expire and your guest invitation site will go offline.

We wish you a lifetime of love and happiness!

Warm regards,
The DreamWeavers Team
  `.trim();

  const html = `
<div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; background: #FCF9F2; padding: 40px; border-radius: 8px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #1A1A1A; font-size: 24px; margin: 0;">DreamWeavers</h1>
  </div>
  <h2 style="color: #1A1A1A; font-size: 20px;">Congratulations! 💒</h2>
  <p style="color: #555; line-height: 1.6;">Dear ${data.coupleName},</p>
  <p style="color: #555; line-height: 1.6;">Congratulations on your wedding! We hope your special day on <strong>${data.weddingDate}</strong> was everything you dreamed of.</p>
  <p style="color: #555; line-height: 1.6;">Thank you for choosing DreamWeavers for your digital wedding invitation. It has been our privilege to be part of your journey.</p>
  <p style="color: #555; line-height: 1.6;">Your access to the Couple CMS will remain available for <strong>30 days</strong> after your wedding, allowing you to:</p>
  <ul style="color: #555; line-height: 1.8;">
    <li>Download your guest list and RSVP data</li>
    <li>Export wishes and messages from your guests</li>
    <li>Save any photos or content from your invitation</li>
  </ul>
  <p style="color: #555; line-height: 1.6;">After 30 days, your access will expire and your guest invitation site will go offline.</p>
  <p style="color: #555; line-height: 1.6; font-style: italic;">We wish you a lifetime of love and happiness!</p>
  <p style="color: #555; line-height: 1.6;">Warm regards,<br>The DreamWeavers Team</p>
</div>
  `.trim();

  return { subject, html, text };
}

// ── Helper ─────────────────────────────────────────────────────────────────

function safeParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

// ── Queue Management ───────────────────────────────────────────────────────

export async function getEmailQueue(): Promise<QueuedEmail[]> {
  const setting = await db.systemSetting.findUnique({
    where: { key: 'email_queue' },
  });
  if (!setting) return [];
  return safeParse(setting.value, []);
}

export async function clearEmailQueue(): Promise<void> {
  await db.systemSetting.upsert({
    where: { key: 'email_queue' },
    update: { value: '[]' },
    create: { key: 'email_queue', value: '[]' },
  });
}
