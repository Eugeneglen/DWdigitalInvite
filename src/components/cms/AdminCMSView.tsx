'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { Sparkles, LayoutDashboard, Heart, Users, FileText, BarChart3, Settings, LogOut, Loader2, Lock } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useAuthModalStore } from '@/store/useAuthModalStore';

const LoginModal = dynamic(
  () => import('@/components/cms/LoginModal').then((m) => ({ default: m.LoginModal })),
  { ssr: false },
);

const MasterCMSLayout = dynamic(
  () => import('@/components/cms/MasterCMSLayout'),
  { ssr: false },
);

const MasterCMSPageRouter = dynamic(
  () => import('@/components/cms/MasterCMSPageRouter'),
  { ssr: false },
);

// ── Unauthenticated branded login screen ────────────────────────────────────
// Shows the dark sidebar (visual only) with a LoginModal overlay.

const LOGIN_NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Wedding Accounts', icon: Heart },
  { label: 'Content Templates', icon: FileText },
  { label: 'Analytics', icon: BarChart3 },
  { label: 'Settings', icon: Settings },
  { label: 'Users', icon: Users },
];

function AdminLoginScreen({ onSignInClick }: { onSignInClick: () => void }) {
  return (
    <div className="flex min-h-screen bg-paper-cream">
      {/* Dark Sidebar (visual only) */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-paper-cream/8 bg-charcoal-ink text-paper-cream md:flex">
        <div className="flex items-center justify-center py-3 px-2 border-b border-paper-cream/8">
          <img
            alt="Dreamweavers"
            className="h-[15px] w-auto brightness-0 invert"
            src="/dreamweavers-logo.png"
          />
        </div>

        <div className="px-4 py-3">
          <span className="text-[11px] uppercase tracking-[0.15em] text-paper-cream/30">Navigation</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 opacity-30">
          <ul className="flex flex-col gap-0.5">
            {LOGIN_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label}>
                  <div className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-paper-cream/60">
                    <Icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </nav>

        <Separator className="bg-paper-cream/8" />
        <div className="p-3">
          <div className="flex items-center gap-3 px-3 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-paper-cream/10 text-xs text-paper-cream/70">
              AD
            </div>
            <div className="flex flex-col min-w-0">
              <span className="truncate text-sm font-medium text-paper-cream/60">Admin User</span>
              <span className="truncate text-xs text-paper-cream/30">admin@dreamweavers.com</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main area — sign in prompt */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-champagne-silk/30 bg-paper-cream px-4 md:px-6">
          <h1
            className="text-lg font-semibold text-charcoal-ink/40"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Dashboard
          </h1>
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
              Dreamweavers PTL
            </h2>
            <p className="text-sm text-charcoal-ink/50 max-w-sm mx-auto mb-8 leading-relaxed">
              Sign in to access the platform management console.
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

export default function AdminCMSView() {
  const { data: session, status } = useSession();
  const { open: modalOpen, closeModal, openModal } = useAuthModalStore();
  const [cmsReady, setCmsReady] = useState(false);
  const cmsReadyTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Show login modal when unauthenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      openModal('cms');
    }
    if (cmsReadyTimerRef.current) {
      clearTimeout(cmsReadyTimerRef.current);
      cmsReadyTimerRef.current = undefined;
    }
    if (status === 'authenticated') {
      cmsReadyTimerRef.current = setTimeout(() => setCmsReady(true), 100);
    }
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
    openModal('cms');
  }, [openModal]);

  // Loading state
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-cream">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 animate-spin text-cinematic-gold" />
          <p className="text-sm text-charcoal-ink/60 font-medium">Loading admin console...</p>
        </div>
      </div>
    );
  }

  // Authenticated → check role before rendering
  const userRole = session?.user?.role;
  const isAdmin = userRole === 'SUPER_ADMIN' || userRole?.startsWith('ADMIN');

  // Non-admin authenticated user → sign out + show access denied
  if (status === 'authenticated' && cmsReady && !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-cream">
        <div className="flex flex-col items-center gap-4 text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
            <Lock className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-charcoal-ink" style={{ fontFamily: "'Playfair Display', serif" }}>
            Access Denied
          </h2>
          <p className="text-sm text-charcoal-ink/50 leading-relaxed">
            You need an administrator account to access the DreamWeavers console.
            Please sign out and log in with an admin account.
          </p>
          <button
            onClick={() => signOut({ callbackUrl: '/?view=cms' })}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-sm text-[13px] font-medium uppercase tracking-[0.08em] bg-charcoal-ink text-paper-cream hover:bg-charcoal-ink/90 transition-colors"
          >
            <LogOut className="size-4" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Admin authenticated → render the real CMS
  if (status === 'authenticated' && cmsReady && isAdmin) {
    return (
      <>
        <MasterCMSLayout>
          <MasterCMSPageRouter />
        </MasterCMSLayout>
        <LoginModal
          open={modalOpen}
          onOpenChange={handleModalClose}
          variant="cms"
          targetRole="admin"
        />
      </>
    );
  }

  // Unauthenticated → show branded login screen with modal
  return (
    <>
      <AdminLoginScreen onSignInClick={handleSignInClick} />
      <LoginModal
        open={modalOpen}
        onOpenChange={handleModalClose}
        variant="cms"
        targetRole="admin"
      />
    </>
  );
}