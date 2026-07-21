import { db } from '@/lib/db';
import type { Metadata } from 'next';
import SlugWeddingPage from './SlugWeddingPage';

interface SlugPageProps {
  params: Promise<{ slug: string }>;
}

/** Fetch wedding from DB for metadata generation */
async function getWeddingBySlug(slug: string) {
  return db.weddingAccount.findFirst({
    where: { slug, status: 'ACTIVE' },
    select: {
      coupleName: true,
      brideName: true,
      groomName: true,
      weddingDate: true,
      venue: true,
      heroImageUrl: true,
    },
  });
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
  const wedding = await getWeddingBySlug(slug);

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
  const wedding = await getWeddingBySlug(slug);

  if (!wedding) {
    return <SlugNotFound />;
  }

  return <SlugWeddingPage slug={slug} />;
}

/** Server-rendered branded 404 for unknown/deactivated wedding slugs */
function SlugNotFound() {
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
          Invitation Not Found
        </h1>

        <p className="text-sm md:text-base text-charcoal-ink/60 leading-relaxed">
          The wedding invitation you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>

        <a
          href="/"
          className="mt-2 inline-flex items-center gap-2 rounded-full bg-cinematic-gold text-white px-6 py-2.5 text-sm font-semibold shadow-md hover:bg-cinematic-gold/90 active:scale-95 transition-all"
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to Dreamweavers
        </a>
      </div>
    </main>
  );
}