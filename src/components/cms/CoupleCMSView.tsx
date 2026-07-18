'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { Sparkles, Heart, Calendar, BookOpen, HelpCircle, ToggleLeft, Users, Mail, MessageSquareHeart, ScrollText, QrCode, BarChart3, MapPin, Camera, FileText, LayoutDashboard, LogOut, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { useCoupleCMSStore } from '@/store/useCoupleCMSStore';

const LoginModal = dynamic(
  () => import('@/components/cms/LoginModal').then((m) => ({ default: m.LoginModal })),
  { ssr: false },
);

const CoupleCMSLayout = dynamic(
  () => import('@/components/cms/CoupleCMSLayout'),
  { ssr: false },
);

const CoupleCMSPageRouter = dynamic(
  () => import('@/components/cms/CoupleCMSPageRouter'),
  { ssr: false },
);

// GuestSite is rendered when the couple toggles "Preview" — lets them see
// their actual wedding invitation (hero image, schedule, story, etc.) exactly
// as a guest would, so they can confirm content before generating the RSVP
// link/QR. The floating "Open Editor" button inside GuestSite calls
// togglePreview(false) to return to the CMS.
const GuestSite = dynamic(
  () => import('@/components/wedding/GuestSite'),
  { ssr: false, loading: () => <div className="loading-state">Loading preview…</div> },
);

// ── Unauthenticated branded login screen ────────────────────────────────────
// Shows the CMS sidebar (disabled) with a LoginModal overlay, so the user
// sees the full CMS chrome even before signing in.

const LOGIN_NAV_ITEMS = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Your Details', icon: Heart },
  { label: 'Content', icon: FileText },
  { label: 'Home', icon: LayoutDashboard },
  { label: 'Schedule', icon: Calendar },
  { label: 'RSVPs', icon: Mail },
  { label: 'Getting There', icon: MapPin },
  { label: 'Our Story', icon: BookOpen },
  { label: 'Wishes', icon: MessageSquareHeart },
  { label: 'FAQs', icon: HelpCircle },
  { label: 'Moments', icon: Camera },
  { label: 'Guests', icon: Users },
  { label: 'Analytics', icon: BarChart3 },
  { label: 'Activity', icon: ScrollText },
  { label: 'Sharing', icon: QrCode },
  { label: 'Features', icon: ToggleLeft },
];

function CoupleLoginScreen({ onSignInClick }: { onSignInClick: () => void }) {
  return (
    <div className="flex min-h-screen bg-paper-cream">
      {/* Left Sidebar (visual only) */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-champagne-silk bg-paper-cream md:flex">
        <div className="flex items-center px-4 py-5">
          <img
            alt="Dreamweavers"
            className="h-3.5 w-auto object-contain"
            src="/dreamweavers-logo.png"
          />
        </div>
        <Separator className="bg-champagne-silk" />
        <nav className="flex-1 overflow-y-auto px-2 py-3 opacity-40">
          <ul className="flex flex-col gap-0.5">
            {LOGIN_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label}>
                  <div className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-charcoal-ink/60">
                    <Icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </nav>
        <Separator className="bg-champagne-silk" />
        <div className="p-3">
          <div className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-charcoal-ink/30">
            <LogOut className="size-3.5" />
            <span>Sign Out</span>
          </div>
        </div>
      </aside>

      {/* Main area — sign in prompt */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-champagne-silk bg-paper-cream/80 backdrop-blur-md px-4 md:px-6">
          <h1 className="text-base font-semibold text-charcoal-ink/40">Your Wedding</h1>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cinematic-gold/30 text-white font-bold text-[11px]">
            DW
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-cinematic-gold/10 flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-7 h-7 text-cinematic-gold" />
            </div>
            <h2
              className="text-2xl font-semibold text-charcoal-ink tracking-tight mb-2"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Couple Workspace
            </h2>
            <p className="text-sm text-charcoal-ink/50 max-w-sm mx-auto mb-8 leading-relaxed">
              Sign in to manage your wedding website content, guest list, and settings.
            </p>
            <button
              onClick={onSignInClick}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-sm text-[13px] font-medium uppercase tracking-[0.08em] bg-charcoal-ink text-paper-cream hover:bg-charcoal-ink/90 transition-colors duration-300"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main View Component ─────────────────────────────────────────────────────

export default function CoupleCMSView() {
  const { status } = useSession();
  const { open: modalOpen, closeModal, openModal } = useAuthModalStore();
  const { previewMode, weddingData } = useCoupleCMSStore();
  const [cmsReady, setCmsReady] = useState(false);
  const cmsReadyTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Show login modal when unauthenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      openModal('default');
    }
    if (cmsReadyTimerRef.current) {
      clearTimeout(cmsReadyTimerRef.current);
      cmsReadyTimerRef.current = undefined;
    }
    if (status === 'authenticated') {
      cmsReadyTimerRef.current = setTimeout(() => setCmsReady(true), 100);
    }
    // When unauthenticated, reset cmsReady via the render logic below
  }, [status, openModal]);

  const handleModalClose = useCallback(
    (open: boolean) => {
      if (!open) {
        closeModal();
      }
    },
    [closeModal],
  );

  const handleSignInClick = useCallback(() => {
    openModal('default');
  }, [openModal]);

  // Loading state
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-cream">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 animate-spin text-cinematic-gold" />
          <p className="text-sm text-charcoal-ink/60 font-medium">Loading workspace...</p>
        </div>
      </div>
    );
  }

  // Authenticated → render the real CMS (or the guest-site preview when toggled)
  if (status === 'authenticated' && cmsReady) {
    // Preview mode → show the couple's wedding invitation as guests see it.
    // showEditorButton reveals the floating "Open Editor" button that exits preview.
    if (previewMode) {
      const slug = (weddingData as Record<string, unknown> | null)?.slug as string | undefined;
      return (
        <>
          <GuestSite slug={slug} showEditorButton />
          <LoginModal
            open={modalOpen}
            onOpenChange={handleModalClose}
            variant="default"
            targetRole="couple"
          />
        </>
      );
    }

    return (
      <>
        <CoupleCMSLayout>
          <CoupleCMSPageRouter />
        </CoupleCMSLayout>
        {/* Keep LoginModal mounted for "Switch Account" functionality */}
        <LoginModal
          open={modalOpen}
          onOpenChange={handleModalClose}
          variant="default"
          targetRole="couple"
        />
      </>
    );
  }

  // Unauthenticated → show branded login screen with modal
  return (
    <>
      <CoupleLoginScreen onSignInClick={handleSignInClick} />
      <LoginModal
        open={modalOpen}
        onOpenChange={handleModalClose}
        variant="default"
        targetRole="couple"
      />
    </>
  );
}