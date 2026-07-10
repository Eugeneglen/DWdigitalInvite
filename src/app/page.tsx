'use client';

import { useState, useRef, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useNavigationStore } from '@/store/useNavigationStore';
import { useCMSStore, type CMSPage } from '@/store/useCMSStore';
import { useCoupleCMSStore, type CoupleCMSPage } from '@/store/useCoupleCMSStore';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CMSPageSkeleton } from '@/components/cms/LoadingSkeleton';
import GuestSite from '@/components/wedding/GuestSite';
import { LoginModal } from '@/components/cms/LoginModal';
import MasterCMSLayout from '@/components/cms/MasterCMSLayout';
import CoupleCMSLayout from '@/components/cms/CoupleCMSLayout';

// Master CMS pages — dynamic imports
const MasterDashboard = dynamic(() => import('@/components/cms/pages/MasterDashboard'), { ssr: false });
const MasterWeddings = dynamic(() => import('@/components/cms/pages/MasterWeddings'), { ssr: false });
const MasterUsers = dynamic(() => import('@/components/cms/pages/MasterUsers'), { ssr: false });
const MasterAnalytics = dynamic(() => import('@/components/cms/pages/MasterAnalytics'), { ssr: false });
const MasterSettings = dynamic(() => import('@/components/cms/pages/MasterSettings'), { ssr: false });
const MasterTemplates = dynamic(() => import('@/components/cms/pages/MasterTemplates'), { ssr: false });

// Couple CMS pages — dynamic imports
const CoupleOverview = dynamic(() => import('@/components/cms/couple/CoupleOverview'), { ssr: false });
const CoupleDetails = dynamic(() => import('@/components/cms/couple/CoupleDetails'), { ssr: false });
const CoupleContent = dynamic(() => import('@/components/cms/couple/CoupleContent'), { ssr: false });
const CoupleHome = dynamic(() => import('@/components/cms/couple/CoupleHome'), { ssr: false });
const CoupleSchedule = dynamic(() => import('@/components/cms/couple/CoupleSchedule'), { ssr: false });
const CoupleStory = dynamic(() => import('@/components/cms/couple/CoupleStory'), { ssr: false });
const CoupleMoments = dynamic(() => import('@/components/cms/couple/CoupleMoments'), { ssr: false });
const CoupleRSVPs = dynamic(() => import('@/components/cms/couple/CoupleRSVPs'), { ssr: false });
const CoupleGettingThere = dynamic(() => import('@/components/cms/couple/CoupleGettingThere'), { ssr: false });
const CoupleWishes = dynamic(() => import('@/components/cms/couple/CoupleWishes'), { ssr: false });
const CoupleFAQs = dynamic(() => import('@/components/cms/couple/CoupleFAQs'), { ssr: false });
const CoupleFeatures = dynamic(() => import('@/components/cms/couple/CoupleFeatures'), { ssr: false });
const CoupleGuests = dynamic(() => import('@/components/cms/couple/CoupleGuests'), { ssr: false });
const CoupleAnalytics = dynamic(() => import('@/components/cms/couple/CoupleAnalytics'), { ssr: false });
const CoupleAuditLog = dynamic(() => import('@/components/cms/couple/CoupleAuditLog'), { ssr: false });
const CoupleSharing = dynamic(() => import('@/components/cms/couple/CoupleSharing'), { ssr: false });

const MASTER_CMS_PAGES: Record<CMSPage, React.ComponentType> = {
  dashboard: MasterDashboard,
  weddings: MasterWeddings,
  users: MasterUsers,
  templates: MasterTemplates,
  analytics: MasterAnalytics,
  settings: MasterSettings,
};

const COUPLE_CMS_PAGES: Record<CoupleCMSPage, React.ComponentType> = {
  overview: CoupleOverview,
  details: CoupleDetails,
  content: CoupleContent,
  home: CoupleHome,
  schedule: CoupleSchedule,
  story: CoupleStory,
  moments: CoupleMoments,
  rsvps: CoupleRSVPs,
  'getting-there': CoupleGettingThere,
  wishes: CoupleWishes,
  faqs: CoupleFAQs,
  features: CoupleFeatures,
  guests: CoupleGuests,
  analytics: CoupleAnalytics,
  audit: CoupleAuditLog,
  sharing: CoupleSharing,
};

function MasterCMSPageRouter() {
  const { currentPage } = useCMSStore();
  const PageComponent = MASTER_CMS_PAGES[currentPage] || MasterDashboard;
  return <PageComponent />;
}

function CoupleCMSPageRouter() {
  const { currentPage } = useCoupleCMSStore();
  const PageComponent = COUPLE_CMS_PAGES[currentPage] || CoupleOverview;
  return <PageComponent />;
}

// ── Page root — Suspense boundary required because HomeContent uses useSearchParams() ──

export default function Page() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const { data: session, status } = useSession();
  const { previewMode, togglePreview } = useCoupleCMSStore();
  const { open: loginModalOpen, closeModal } = useAuthModalStore();
  const [manualView, setManualView] = useState<'guest' | 'cms' | 'couple' | null>(null);
  // Track which view param the user dismissed the modal for — re-shows when view param changes
  const [dismissedForView, setDismissedForView] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const viewParam = searchParams.get('view');

  const isAdmin = session?.user?.role === 'SUPER_ADMIN' || session?.user?.role === 'ACCOUNT_MANAGER';
  const isCouple = session?.user?.role === 'COUPLE';

  // Derive view: URL param takes priority, then manual toggle, then role-based default
  // If a specific ?view= is requested, show login modal if the role doesn't match
  const wantsCMSView = viewParam === 'cms';
  const wantsCoupleView = viewParam === 'couple';
  const urlView = wantsCMSView && isAdmin ? 'cms' as const
    : wantsCoupleView && isCouple ? 'couple' as const
    : null;
  // If an explicit ?view= param was set but doesn't match the user's role,
  // fall back to guest view (which will show the login modal) instead of
  // silently showing the role's default view.
  const explicitViewMismatch = (wantsCMSView || wantsCoupleView) && urlView === null;
  const viewMode = manualView ?? urlView ?? (explicitViewMismatch ? 'guest' as const : isAdmin ? 'cms' : isCouple ? 'couple' : 'guest');

  // Show login modal when ?view= param requires auth but user isn't authenticated
  // Also show when ?view= doesn't match the user's current role (e.g. admin visiting ?view=couple)
  const needsAuthForView = (wantsCMSView && !isAdmin) || (wantsCoupleView && !isCouple);
  const autoShowLogin = needsAuthForView && dismissedForView !== viewParam && status !== 'loading';
  const showLoginModal = loginModalOpen || autoShowLogin;

  const handleLoginModalChange = (open: boolean) => {
    if (!open) {
      closeModal();
      // Remember which view param was dismissed so we don't immediately re-show
      setDismissedForView(viewParam);
    }
  };

  return (
    <ErrorBoundary>
      <HomeView
        viewMode={viewMode}
        isAdmin={isAdmin}
        isCouple={isCouple}
        previewMode={previewMode}
        showLoginModal={showLoginModal}
        togglePreview={togglePreview}
        onLoginModalChange={handleLoginModalChange}
        wantsCMSView={wantsCMSView}
        wantsCoupleView={wantsCoupleView}
      />
    </ErrorBoundary>
  );
}

function HomeView({
  viewMode,
  isAdmin,
  isCouple,
  previewMode,
  showLoginModal,
  togglePreview,
  onLoginModalChange,
  wantsCMSView,
  wantsCoupleView,
}: {
  viewMode: string;
  isAdmin: boolean;
  isCouple: boolean;
  previewMode: boolean;
  showLoginModal: boolean;
  togglePreview: (v: boolean) => void;
  onLoginModalChange: (open: boolean) => void;
  wantsCMSView: boolean;
  wantsCoupleView: boolean;
}) {
  // Master CMS View
  if (viewMode === 'cms' && isAdmin) {
    return (
      <>
        <MasterCMSLayout>
          <Suspense fallback={<CMSPageSkeleton />}>
            <MasterCMSPageRouter />
          </Suspense>
        </MasterCMSLayout>
        <LoginModal open={showLoginModal} onOpenChange={onLoginModalChange} variant="cms" targetRole="admin" />
      </>
    );
  }

  // Preview Mode — couple user previewing their wedding as a guest
  if (previewMode && isCouple) {
    const previewSlug = useCoupleCMSStore.getState().weddingData
      ? (useCoupleCMSStore.getState().weddingData as Record<string, string>)?.slug
      : undefined;

    return (
      <div className="min-h-screen flex flex-col bg-paper-cream text-charcoal-ink overflow-x-hidden selection:bg-cinematic-gold selection:text-paper-cream">
        {/* Floating CMS Toggle Bar */}
        <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between bg-cinematic-gold text-white px-4 py-2.5 shadow-lg">
          <div className="flex items-center gap-2">
            <svg className="size-4 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            <span className="text-sm font-medium">Viewing as Guest</span>
          </div>
          <button
            onClick={() => togglePreview(false)}
            className="flex items-center gap-1.5 rounded-md bg-white/20 hover:bg-white/30 px-3.5 py-1.5 text-xs font-semibold transition-colors"
            aria-label="Open Editor"
          >
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Open Editor
          </button>
        </div>
        <GuestSite slug={previewSlug} topOffset="44px" showEditorButton />
      </div>
    );
  }

  // Couple CMS View
  if (viewMode === 'couple' && isCouple) {
    return (
      <>
        <CoupleCMSLayout>
          <Suspense fallback={<CMSPageSkeleton />}>
            <CoupleCMSPageRouter />
          </Suspense>
        </CoupleCMSLayout>
        <LoginModal open={showLoginModal} onOpenChange={onLoginModalChange} targetRole="couple" />
      </>
    );
  }

  // Guest View (default) — includes login modal when ?view= requires auth
  if (showLoginModal) {
    // Show login on clean dark background, no wedding site behind it
    return (
      <div className="min-h-screen bg-charcoal-ink">
        <LoginModal open onOpenChange={onLoginModalChange} variant={wantsCMSView ? 'cms' : 'default'} targetRole={wantsCMSView ? 'admin' : wantsCoupleView ? 'couple' : undefined} />
      </div>
    );
  }

  return (
    <>
      <GuestSite showEditorButton />
    </>
  );
}