'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useNavigationStore } from '@/store/useNavigationStore';
import { useCoupleCMSStore } from '@/store/useCoupleCMSStore';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { usePublicWedding } from '@/hooks/usePublicWedding';
import { WeddingSlugProvider } from '@/hooks/useWeddingSlug';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { getAutoTextColor, getAutoBorderColor, generateThemeOverrideStyle } from '@/lib/contrast';
import { filterTabsByFeatures } from '@/store/useNavigationStore';
import Header from '@/components/wedding/Header';
import MobileDrawer from '@/components/wedding/MobileDrawer';
import BottomNav from '@/components/wedding/BottomNav';
import Footer from '@/components/wedding/Footer';
import MusicPlayer from '@/components/wedding/MusicPlayer';
import AnimationRenderer from '@/components/wedding/AnimationRenderer';
import { LoginModal } from '@/components/cms/LoginModal';
import type { Section } from '@/store/useNavigationStore';
import dynamic from 'next/dynamic';

// Guest pages — dynamic imports to reduce Turbopack compilation memory
const HomePage = dynamic(() => import('@/components/wedding/pages/HomePage'), { ssr: false });
const SchedulePage = dynamic(() => import('@/components/wedding/pages/SchedulePage'), { ssr: false });
const RSVPPage = dynamic(() => import('@/components/wedding/pages/RSVPPage'), { ssr: false });
const GettingTherePage = dynamic(() => import('@/components/wedding/pages/GettingTherePage'), { ssr: false });
const StoryPage = dynamic(() => import('@/components/wedding/pages/StoryPage'), { ssr: false });
const MomentsPage = dynamic(() => import('@/components/wedding/pages/MomentsPage'), { ssr: false });
const WishesPage = dynamic(() => import('@/components/wedding/pages/WishesPage'), { ssr: false });
const QAPage = dynamic(() => import('@/components/wedding/pages/QAPage'), { ssr: false });
const GUEST_PAGES: Record<Section, React.ComponentType> = {
  home: HomePage,
  schedule: SchedulePage,
  rsvp: RSVPPage,
  'getting-there': GettingTherePage,
  story: StoryPage,
  moments: MomentsPage,
  wishes: WishesPage,
  qa: QAPage,
};

/** Full-page skeleton that mimics the guest site layout while wedding data loads */
function GuestSiteSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-paper-cream text-charcoal-ink overflow-x-hidden">
      {/* Header skeleton */}
      <div className="fixed w-full z-50 bg-paper-cream/80 backdrop-blur-md border-b border-champagne-silk/30 h-14">
        <div className="flex justify-between items-center px-4 md:px-6 py-3 max-w-[1440px] mx-auto">
          <div className="h-4 w-24 animate-pulse rounded bg-champagne-silk/60" />
          <div className="hidden lg:flex gap-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-4 w-16 animate-pulse rounded bg-champagne-silk/40" />
            ))}
          </div>
          <div className="lg:hidden h-4 w-6 animate-pulse rounded bg-champagne-silk/40" />
        </div>
      </div>

      {/* Hero banner skeleton */}
      <div className="pt-14">
        <div className="relative h-[70vh] animate-pulse bg-champagne-silk/40" />
      </div>

      {/* Content cards skeleton */}
      <div className="px-4 md:px-6 py-10 max-w-3xl mx-auto w-full space-y-6">
        <div className="h-6 w-48 animate-pulse rounded bg-champagne-silk/40 mx-auto" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-champagne-silk/20 bg-white p-5 space-y-3">
            <div className="h-4 w-3/4 animate-pulse rounded bg-champagne-silk/30" />
            <div className="h-3 w-full animate-pulse rounded bg-champagne-silk/20" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-champagne-silk/20" />
          </div>
        ))}
      </div>

      {/* Footer skeleton */}
      <div className="mt-auto border-t border-champagne-silk/20 py-8 px-4">
        <div className="max-w-3xl mx-auto flex justify-center">
          <div className="h-4 w-32 animate-pulse rounded bg-champagne-silk/30" />
        </div>
      </div>
    </div>
  );
}

/** Keeps all guest pages mounted but only shows the active one.
 *  This avoids unmounting/remounting on every navigation, which previously
 *  destroyed and recreated timers, sockets, observers, and canvases. */
function PageRenderer({ section }: { section: Section }) {
  return (
    <>
      {Object.entries(GUEST_PAGES).map(([key, Component]) => (
        <div
          key={key}
          style={{ display: key === section ? 'block' : 'none' }}
        >
          <Component />
        </div>
      ))}
    </>
  );
}

interface GuestSiteProps {
  /** Wedding slug — when provided, fetches data for that specific wedding */
  slug?: string;
  /** CSS top value to push the header below an overlay bar (e.g. "44px" for preview mode) */
  topOffset?: string;
  /** Show the "Open Editor" floating button for authenticated couples */
  showEditorButton?: boolean;
}

export default function GuestSite({ slug, topOffset, showEditorButton = false }: GuestSiteProps) {
  const { data: session } = useSession();
  const { currentSection } = useNavigationStore();
  const { togglePreview } = useCoupleCMSStore();
  const { open: loginModalOpen, variant: loginVariant, closeModal } = useAuthModalStore();

  // Pre-fetch wedding data for this slug so all child pages share the cache
  const { data: weddingData, loading, getField } = usePublicWedding(slug);
  const { navTabs, headerBgColor: platformHeaderBg, loaded: settingsLoaded } = useSiteSettings();
  const { setAvailableTabs } = useNavigationStore();

  // Read the couple's custom background colour (default: DW paper-cream).
  // This ONLY affects the page body (content area). It does NOT affect the
  // header, footer, mobile drawer, or bottom nav — those are platform-wide
  // chrome controlled by the Master CMS (/?view=cms → Settings), defaulting
  // to DW paper-cream (#FCF9F2) when the Master CMS hasn't set a value.
  const backgroundColor = getField('global', 'backgroundColor', '#FCF9F2');

  // Header & footer use the platform-wide colour from the Master CMS
  // (site_header_bg_color). Falls back to DW paper-cream when not set.
  // The couple's backgroundColor is intentionally NOT used here.
  const headerBg = platformHeaderBg || '#FCF9F2';
  const footerBg = platformHeaderBg || '#FCF9F2';

  // Text & border colours for the BODY — auto-detect from page bg unless
  // manually overridden. These do NOT apply to the header/footer.
  const textColorOverride = getField('global', 'textColor', '');
  const borderColorOverride = getField('global', 'borderColor', '');
  const textColor = textColorOverride || getAutoTextColor(backgroundColor);
  const borderColor = borderColorOverride || getAutoBorderColor(backgroundColor);

  // Header text auto-contrasts with the header bg (from Master CMS), so it
  // stays readable whether the Master CMS sets a light or dark header colour.
  const headerTextColor = getAutoTextColor(headerBg);

  // Compute filtered tabs from global config + wedding feature flags
  // and push into the navigation store for Header/MobileDrawer/BottomNav
  const prevFilteredRef = useRef<string>('');
  useEffect(() => {
    if (loading || !settingsLoaded || navTabs.length === 0) return;
    const featureFlags = weddingData?.featureFlags ?? {};
    const filtered = filterTabsByFeatures(navTabs, featureFlags);
    const key = JSON.stringify(filtered);
    if (key !== prevFilteredRef.current) {
      prevFilteredRef.current = key;
      setAvailableTabs(filtered);
    }
  }, [loading, settingsLoaded, navTabs, weddingData?.featureFlags, setAvailableTabs]);

  // Show full-page skeleton while wedding data is loading
  if (loading || !settingsLoaded) {
    return <GuestSiteSkeleton />;
  }

  const isAdmin = session?.user?.role === 'SUPER_ADMIN' || session?.user?.role === 'ACCOUNT_MANAGER';
  const isCouple = session?.user?.role === 'COUPLE';

  // Generate dynamic <style> to override Tailwind's hardcoded colour values.
  // Tailwind 4 resolves @theme colours at build time, so CSS variable
   // overrides alone don't affect utility classes like text-charcoal-ink.
  const themeOverrideCSS = generateThemeOverrideStyle(textColor, borderColor, headerTextColor, headerBg);

  return (
    <div
      data-wedding-root=""
      className="min-h-screen flex flex-col text-charcoal-ink overflow-x-hidden selection:bg-cinematic-gold selection:text-paper-cream"
      style={{
        backgroundColor,
        color: textColor,
        '--wedding-bg': backgroundColor,
        '--wedding-header-bg': headerBg,
        '--wedding-footer-bg': footerBg,
        '--wedding-chrome-text': headerTextColor,
        '--color-charcoal-ink': textColor,
        '--color-champagne-silk': borderColor,
      } as React.CSSProperties}
    >
      {/* Dynamic theme overrides — must be first child for cascade order */}
      <style dangerouslySetInnerHTML={{ __html: themeOverrideCSS }} />
      <AnimationRenderer featureFlags={weddingData?.featureFlags} />
      <WeddingSlugProvider slug={slug}>
      <Header topOffset={topOffset} headerTextColor={headerTextColor} />
      <MobileDrawer />

      <div className="flex-1" style={topOffset ? { paddingTop: '44px' } : undefined}>
        <PageRenderer section={currentSection} />
      </div>

      <Footer />

      {/* Music Player — conditional on feature flag, reads config internally */}
      <MusicPlayer />

      <BottomNav />

      {/* Couple CMS toggle — visible floating button for authenticated couples */}
      {showEditorButton && isCouple && (
        <button
          onClick={() => togglePreview(false)}
          className="fixed bottom-20 right-4 z-[55] flex items-center gap-2 rounded-full bg-cinematic-gold text-white pl-3 pr-4 py-2.5 text-xs font-semibold shadow-lg hover:bg-cinematic-gold/90 active:scale-95 transition-all"
          aria-label="Open Editor"
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          Open Editor
        </button>
      )}

      {/* Admin login trigger — subtle gear icon, bottom-left */}
      {!session && (
        <button
          onClick={() => useAuthModalStore.getState().openModal()}
          className="fixed bottom-20 left-6 z-[55] text-xs text-charcoal-ink/20 hover:text-cinematic-gold transition-colors"
          aria-label="Admin login"
        >
          ⚙
        </button>
      )}

      <LoginModal
        open={loginModalOpen}
        variant={loginVariant}
        onOpenChange={(open) => { if (!open) closeModal(); }}
      />
      </WeddingSlugProvider>
    </div>
  );
}