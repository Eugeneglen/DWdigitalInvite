'use client';

import dynamic from 'next/dynamic';
import { Lock } from 'lucide-react';
import { useCoupleCMSStore, type CoupleCMSPage } from '@/store/useCoupleCMSStore';
import { isPageEnabled, extractFeatureFlags, PAGE_TO_FEATURE } from '@/lib/feature-lock';
import { FEATURE_LABELS } from '@/lib/constants';

// ── Dedicated Couple CMS pages ──────────────────────────────────────────────
// Using dynamic imports with ssr:false for code-splitting. Components are
// kept mounted (display:none) via the ALL_PAGES array below, so navigating
// between pages does NOT unmount/remount them — preventing thumbnail
// disappearance and state loss.
const CoupleOverview = dynamic(() => import('./couple/CoupleOverview'), { ssr: false });
const CoupleDetails = dynamic(() => import('./couple/CoupleDetails'), { ssr: false });
const CoupleHome = dynamic(() => import('./couple/CoupleHome'), { ssr: false });
const CoupleDesign = dynamic(() => import('./couple/CoupleDesign'), { ssr: false });
const CoupleSchedule = dynamic(() => import('./couple/CoupleSchedule'), { ssr: false });
const CoupleRSVPs = dynamic(() => import('./couple/CoupleRSVPs'), { ssr: false });
const CoupleGettingThere = dynamic(() => import('./couple/CoupleGettingThere'), { ssr: false });
const CoupleStory = dynamic(() => import('./couple/CoupleStory'), { ssr: false });
const CoupleWishes = dynamic(() => import('./couple/CoupleWishes'), { ssr: false });
const CoupleFAQs = dynamic(() => import('./couple/CoupleFAQs'), { ssr: false });
const CoupleMoments = dynamic(() => import('./couple/CoupleMoments'), { ssr: false });
const CoupleGuests = dynamic(() => import('./couple/CoupleGuests'), { ssr: false });
const CoupleAnalytics = dynamic(() => import('./couple/CoupleAnalytics'), { ssr: false });
const CoupleAuditLog = dynamic(() => import('./couple/CoupleAuditLog'), { ssr: false });
const CoupleSharing = dynamic(() => import('./couple/CoupleSharing'), { ssr: false });
const CoupleTeam = dynamic(() => import('./couple/CoupleTeam'), { ssr: false });
const CoupleFeatures = dynamic(() => import('./couple/CoupleFeatures'), { ssr: false });

// Ordered list of all couple CMS pages and their components.
// Ordered to match the sidebar navigation order.
const ALL_PAGES: Array<{ key: CoupleCMSPage; component: React.ComponentType }> = [
  { key: 'overview', component: CoupleOverview },
  { key: 'details', component: CoupleDetails },
  { key: 'home', component: CoupleHome },
  { key: 'design', component: CoupleDesign },
  { key: 'schedule', component: CoupleSchedule },
  { key: 'rsvps', component: CoupleRSVPs },
  { key: 'getting-there', component: CoupleGettingThere },
  { key: 'story', component: CoupleStory },
  { key: 'wishes', component: CoupleWishes },
  { key: 'faqs', component: CoupleFAQs },
  { key: 'moments', component: CoupleMoments },
  { key: 'guests', component: CoupleGuests },
  { key: 'analytics', component: CoupleAnalytics },
  { key: 'audit', component: CoupleAuditLog },
  { key: 'sharing', component: CoupleSharing },
  { key: 'team', component: CoupleTeam },
  { key: 'features', component: CoupleFeatures },
];

/** Locked screen shown when a couple tries to access a disabled feature */
function LockedFeaturePage({ featureKey }: { featureKey: string }) {
  const label = FEATURE_LABELS[featureKey] || featureKey;
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="flex items-center justify-center h-16 w-16 rounded-full bg-charcoal-ink/5 mb-6">
        <Lock className="size-8 text-charcoal-ink/30" />
      </div>
      <h2 className="text-xl font-semibold text-charcoal-ink mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
        {label} is not available
      </h2>
      <p className="text-sm text-charcoal-ink/50 max-w-md leading-relaxed">
        This feature is not included in your current package.
        Contact your DreamWeavers consultant to upgrade and unlock {label}.
      </p>
    </div>
  );
}

/**
 * Keeps all ENABLED couple CMS pages mounted but only shows the active one
 * (via display:none). This avoids unmounting/remounting on every navigation,
 * which previously destroyed fetched images (thumbnails disappeared) and
 * reset form state. Same pattern as the GuestSite PageRenderer.
 *
 * Locked pages (features not in the couple's plan) are NOT mounted at all —
 * they show a LockedFeaturePage placeholder instead.
 */
export default function CoupleCMSPageRouter() {
  const { currentPage, weddingData } = useCoupleCMSStore();
  const featureFlags = extractFeatureFlags(weddingData as Record<string, unknown> | null);

  // Check if the current page's feature is disabled
  const pageEnabled = isPageEnabled(currentPage, featureFlags);
  const featureKey = PAGE_TO_FEATURE[currentPage];

  // If the current page is locked, show the locked screen (don't render any page)
  if (!pageEnabled && featureKey) {
    return <LockedFeaturePage featureKey={featureKey} />;
  }

  return (
    <>
      {ALL_PAGES.map(({ key, component: Component }) => {
        // Skip mounting locked pages entirely (saves resources)
        if (!isPageEnabled(key, featureFlags)) return null;
        return (
          <div
            key={key}
            style={{ display: key === currentPage ? 'block' : 'none' }}
          >
            <Component />
          </div>
        );
      })}
    </>
  );
}
