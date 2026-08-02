import { db } from '@/lib/db';
import type { Metadata } from 'next';
import SlugWeddingPage from './SlugWeddingPage';
import { getServerSession } from '@/lib/auth';
import { normalizePlatformRole } from '@/lib/permissions';

interface SlugPageProps {
  params: Promise<{ slug: string }>;
}

/** Result of a wedding lookup — includes the reason if not viewable */
interface WeddingLookupResult {
  wedding: Awaited<ReturnType<typeof db.weddingAccount.findFirst<{ select: {
    coupleName: true; brideName: true; groomName: true; weddingDate: true;
    venue: true; heroImageUrl: true; status: true;
  } }>>> | null;
  reason: 'not_found' | 'not_active' | 'ok';
}

/** Fetch wedding from DB.
 *  Admins (SUPER_ADMIN, ADMIN_1, ADMIN_2) can preview non-ACTIVE weddings.
 *  Couples (COUPLE) who own the wedding can preview their own DRAFT.
 *  Guests only see ACTIVE weddings. Returns the reason if not viewable. */
async function getWeddingBySlug(slug: string, sessionUserId?: string): Promise<WeddingLookupResult> {
  const session = await getServerSession();
  const role = session?.user?.role;
  const normalizedRole = normalizePlatformRole(role || '');
  const isAdmin = normalizedRole === 'SUPER_ADMIN' || normalizedRole === 'ACCOUNT_MANAGER_1' || normalizedRole === 'ACCOUNT_MANAGER_2' || normalizedRole === 'SUPPORT';

  // First, check if the wedding exists at all (regardless of status)
  const wedding = await db.weddingAccount.findFirst({
    where: { slug },
    select: {
      coupleName: true,
      brideName: true,
      groomName: true,
      weddingDate: true,
      venue: true,
      heroImageUrl: true,
      status: true,
    },
  });

  if (!wedding) {
    return { wedding: null, reason: 'not_found' };
  }

  // Wedding exists — if it's ACTIVE, anyone can see it
  if (wedding.status === 'ACTIVE') {
    return { wedding, reason: 'ok' };
  }

  // Wedding is not ACTIVE — admins can preview it
  if (isAdmin) {
    return { wedding, reason: 'ok' };
  }

  // Wedding is not ACTIVE — the couple who owns it can preview their DRAFT
  if (sessionUserId) {
    const ownerCheck = await db.weddingAccount.findFirst({
      where: { slug, ownerId: sessionUserId },
      select: { id: true },
    });
    if (ownerCheck) {
      return { wedding, reason: 'ok' };
    }
  }

  // Guest trying to view a non-ACTIVE wedding
  return { wedding, reason: 'not_active' };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export async function generateMetadata({ params }: SlugPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { wedding } = await getWeddingBySlug(slug);

  if (!wedding) {
    return {
      title: 'Invitation Not Found — Dreamweavers',
    };
  }

  const title = `${wedding.coupleName} — Wedding Invitation`;
  const description = wedding.brideName && wedding.groomName
    ? `${wedding.brideName} & ${wedding.groomName} invite you to celebrate their wedding on ${formatDate(wedding.weddingDate)}${wedding.venue ? ` at ${wedding.venue}` : ''}.`
    : `${wedding.coupleName} invite you to celebrate their wedding on ${formatDate(wedding.weddingDate)}${wedding.venue ? ` at ${wedding.venue}` : ''}.`;

  const images = wedding.heroImageUrl ? [{ url: wedding.heroImageUrl }] : [];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: wedding.heroImageUrl ? [wedding.heroImageUrl] : undefined,
    },
  };
}

export default async function SlugPage({ params }: SlugPageProps) {
  const { slug } = await params;
  const session = await getServerSession();
  const { wedding, reason } = await getWeddingBySlug(slug, session?.user?.id);

  if (reason !== 'ok' || !wedding) {
    return <SlugNotFound reason={reason} coupleName={wedding?.coupleName ?? null} status={wedding?.status ?? null} />;
  }

  return <SlugWeddingPage slug={slug} />;
}

/** Server-rendered branded page for unknown/deactivated wedding slugs.
 *  Shows a helpful explanation and next steps based on the reason. */
function SlugNotFound({
  reason,
  coupleName,
  status,
}: {
  reason: 'not_found' | 'not_active';
  coupleName: string | null;
  status: string | null;
}) {
  const isDraft = status === 'DRAFT';
  const isSuspended = status === 'SUSPENDED';
  const isArchived = status === 'ARCHIVED' || status === 'COMPLETED';

  const heading = reason === 'not_found'
    ? 'Invitation Not Found'
    : isDraft
      ? 'Invitation Coming Soon'
      : isSuspended
        ? 'Invitation Temporarily Unavailable'
        : 'Invitation No Longer Available';

  const explanation = reason === 'not_found'
    ? 'The wedding invitation you\'re looking for doesn\'t exist or has been removed.'
    : isDraft
      ? `This invitation is being prepared by ${coupleName ? coupleName : 'the couple'} and will be available soon.`
      : isSuspended
        ? 'This invitation has been temporarily suspended. Please contact the couple or Dreamweavers for assistance.'
        : 'This wedding celebration has concluded. Thank you for being part of their special day!';

  const actionLabel = reason === 'not_found'
    ? 'Back to Dreamweavers'
    : isDraft
      ? 'Back to Dreamweavers'
      : 'Back to Dreamweavers';

  const actionHref = reason === 'not_found'
    ? '/'
    : '/';

  return (
    <main className="min-h-screen flex items-center justify-center bg-paper-cream">
      <div className="flex flex-col items-center gap-6 px-6 text-center max-w-md">
        {/* DW Logo */}
        <div className="flex items-center justify-center size-20 rounded-full bg-cinematic-gold shadow-lg">
          <span className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-white tracking-tight">
            DW
          </span>
        </div>

        <h1 className="font-[family-name:var(--font-playfair)] text-2xl md:text-3xl font-semibold text-charcoal-ink">
          {heading}
        </h1>

        <p className="text-sm md:text-base text-charcoal-ink/60 leading-relaxed">
          {explanation}
        </p>

        {reason === 'not_found' ? (
          <a
            href="/"
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-cinematic-gold text-white px-6 py-2.5 text-sm font-semibold shadow-md hover:bg-cinematic-gold/90 active:scale-95 transition-all"
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to Dreamweavers
          </a>
        ) : (
          <ul className="mt-2 text-left text-xs text-charcoal-ink/40 space-y-1">
            {isDraft && (
              <li>· The couple is still setting up their invitation</li>
            )}
            {isDraft && (
              <li>· An admin activates the wedding (changes status from Draft to Active)</li>
            )}
            {isSuspended && (
              <li>· Contact the couple or Dreamweavers support for help</li>
            )}
            {isArchived && (
              <li>· This celebration has ended</li>
            )}
          </ul>
        )}

        {status && coupleName && (
          <p className="text-[11px] text-charcoal-ink/25 mt-2">
            Status: {status} {coupleName ? `· ${coupleName}` : ''}
          </p>
        )}

        <a
          href={actionHref}
          className="inline-flex items-center gap-2 rounded-full bg-cinematic-gold text-white px-6 py-2.5 text-sm font-semibold shadow-md hover:bg-cinematic-gold/90 active:scale-95 transition-all"
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          {actionLabel}
        </a>
      </div>
    </main>
  );
}
