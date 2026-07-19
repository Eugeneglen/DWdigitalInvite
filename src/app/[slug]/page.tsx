import { db } from '@/lib/db';
import type { Metadata } from 'next';
import SlugWeddingPage from './SlugWeddingPage';
import { getServerSession } from '@/lib/auth';

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
 *  Guests only see ACTIVE weddings. Returns the reason if not viewable. */
async function getWeddingBySlug(slug: string): Promise<WeddingLookupResult> {
  const session = await getServerSession();
  const role = session?.user?.role;
  const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN_1' || role === 'ADMIN_2';

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

  // Wedding is not ACTIVE — only admins can preview it
  if (isAdmin) {
    return { wedding, reason: 'ok' };
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
  const { wedding, reason } = await getWeddingBySlug(slug);

  if (reason !== 'ok' || !wedding) {
    return <SlugNotFound reason={reason} coupleName={wedding?.coupleName ?? null} status={wedding?.status ?? null} />;
  }

  return <SlugWeddingPage slug={slug} />;
}

/** Server-rendered branded page for weddings that can't be viewed.
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
  // Context-specific messaging
  const isDraft = status === 'DRAFT';
  const isSuspended = status === 'SUSPENDED';
  const isArchived = status === 'ARCHIVED' || status === 'COMPLETED';

  const heading = reason === 'not_found'
    ? 'Invitation Not Found'
    : isDraft
      ? 'This Invitation Is Not Yet Published'
      : isSuspended
        ? 'This Invitation Has Been Suspended'
        : isArchived
          ? 'This Invitation Is No Longer Available'
          : 'Invitation Not Available';

  const explanation = reason === 'not_found'
    ? 'The wedding invitation you\'re looking for doesn\'t exist or the URL may be incorrect. Please check the link and try again.'
    : isDraft
      ? `The wedding invitation for ${coupleName ?? 'this couple'} is currently in draft mode and hasn't been published yet. The couple needs to complete their setup before guests can view the invitation.`
      : isSuspended
        ? `The wedding invitation for ${coupleName ?? 'this couple'} has been temporarily suspended. Please contact the Dreamweavers team if you believe this is an error.`
        : `The wedding invitation for ${coupleName ?? 'this couple'} is no longer available. The celebration may have already taken place or the invitation has been archived.`;

  const actionLabel = reason === 'not_found'
    ? 'Back to Dreamweavers'
    : 'Contact Dreamweavers';

  const actionHref = reason === 'not_found'
    ? '/'
    : 'mailto:concierge@dreamweavers.events?subject=Wedding%20Invitation%20Inquiry';

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

        {/* Next steps for draft weddings */}
        {isDraft && (
          <div className="bg-cinematic-gold/5 border border-cinematic-gold/20 rounded-lg p-4 text-left w-full">
            <p className="text-xs font-semibold text-charcoal-ink/70 uppercase tracking-wider mb-2">What needs to happen next:</p>
            <ol className="text-xs text-charcoal-ink/60 space-y-1.5 list-decimal list-inside">
              <li>The couple logs into their Couple CMS to personalise their invitation</li>
              <li>They add their story, schedule, photos, and other content</li>
              <li>An admin activates the wedding (changes status from Draft to Active)</li>
              <li>This link will then display the full invitation for guests</li>
            </ol>
          </div>
        )}

        {/* Suspended/archived note */}
        {(isSuspended || isArchived) && (
          <p className="text-xs text-charcoal-ink/40 italic">
            Status: {status} {coupleName ? `· ${coupleName}` : ''}
          </p>
        )}

        <a
          href={actionHref}
          className="mt-2 inline-flex items-center gap-2 rounded-full bg-cinematic-gold text-white px-6 py-2.5 text-sm font-semibold shadow-md hover:bg-cinematic-gold/90 active:scale-95 transition-all"
        >
          {reason === 'not_found' && (
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          )}
          {actionLabel}
        </a>
      </div>
    </main>
  );
}