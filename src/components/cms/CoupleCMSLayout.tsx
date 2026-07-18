'use client';

import React, { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import {
  Home,
  Heart,
  Calendar,
  BookOpen,
  HelpCircle,
  ToggleLeft,
  Users,
  Mail,
  MessageSquareHeart,
  LogOut,
  ArrowLeft,
  ArrowRightLeft,
  Loader2,
  ScrollText,
  QrCode,
  BarChart3,
  MapPin,
  Camera,
  LayoutDashboard,
  Palette,
  MoreHorizontal,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '@/components/cms/NotificationBell';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useCoupleCMSStore, type CoupleCMSPage } from '@/store/useCoupleCMSStore';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { isPageEnabled, extractFeatureFlags } from '@/lib/feature-lock';

const NAV_ITEMS: { key: CoupleCMSPage; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Overview', icon: Home },
  { key: 'details', label: 'Your Details', icon: Heart },
  { key: 'home', label: 'Home', icon: LayoutDashboard },
  { key: 'design', label: 'Design', icon: Palette },
  { key: 'schedule', label: 'Schedule', icon: Calendar },
  { key: 'rsvps', label: 'RSVPs', icon: Mail },
  { key: 'getting-there', label: 'Getting There', icon: MapPin },
  { key: 'story', label: 'Our Story', icon: BookOpen },
  { key: 'wishes', label: 'Wishes', icon: MessageSquareHeart },
  { key: 'faqs', label: 'FAQs', icon: HelpCircle },
  { key: 'moments', label: 'Moments', icon: Camera },
  { key: 'guests', label: 'Guests', icon: Users },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'audit', label: 'Activity', icon: ScrollText },
  { key: 'sharing', label: 'Sharing', icon: QrCode },
  { key: 'features', label: 'Features', icon: ToggleLeft },
];

const VISIBLE_NAV_COUNT = 5;

export default function CoupleCMSLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { currentPage, setPage, weddingId, setWeddingId, weddingData, setWeddingData, previewMode, togglePreview } = useCoupleCMSStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  // Extract feature flags from wedding data
  const featureFlags = extractFeatureFlags(weddingData as Record<string, unknown> | null);

  useEffect(() => {
    async function fetchWedding() {
      try {
        const res = await fetch('/api/cms/wedding');
        if (!res.ok) {
          if (res.status === 401) {
            // Session is invalid or corrupted — sign out and let user re-login
            await signOut({ redirect: false });
            setError('auth');
            return;
          }
          if (res.status === 404) {
            setError('No wedding account assigned. Please contact Dreamweavers.');
            return;
          }
          throw new Error('Failed to load wedding data');
        }
        const data = await res.json();
        setWeddingData(data.wedding ?? data);
        if (data?.wedding?.id) {
          setWeddingId(String(data.wedding.id));
        }
      } catch (err) {
        setError('Something went wrong. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchWedding();
  }, [setWeddingData, setWeddingId]);

  const coupleName = (() => {
    if (!weddingData) return 'Your Wedding';
    const groom = (weddingData as Record<string, string>).groomName;
    const bride = (weddingData as Record<string, string>).brideName;
    if (groom && bride) return `${bride} & ${groom}`;
    if (groom) return groom;
    if (bride) return bride;
    return 'Your Wedding';
  })();

  const user = session?.user;
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'CO';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-cream">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 animate-spin text-cinematic-gold" />
          <p className="text-sm text-charcoal-ink/60 font-medium">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  if (error) {
    // Session was invalid — redirect cleanly so login modal can re-appear
    if (error === 'auth') {
      return null;
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-cream p-6">
        <div className="flex flex-col items-center gap-6 max-w-md text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cinematic-gold/10">
            <Heart className="size-8 text-cinematic-gold" />
          </div>
          <h2 className="text-xl font-semibold text-charcoal-ink">
            {error}
          </h2>
          <Button
            variant="outline"
            onClick={() => signOut({ callbackUrl: '/' })}
            className="border-charcoal-ink/15 text-charcoal-ink hover:border-cinematic-gold hover:text-cinematic-gold rounded px-6 py-2.5 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300"
          >
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  const visibleNavItems = NAV_ITEMS.slice(0, VISIBLE_NAV_COUNT);
  const moreNavItems = NAV_ITEMS.slice(VISIBLE_NAV_COUNT);

  return (
    <div className="flex h-screen overflow-hidden bg-paper-cream">
      {/* Left Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-champagne-silk bg-paper-cream md:flex">
        {/* Logo area */}
        <div className="flex items-center px-4 py-5">
          <img
            alt="Dreamweavers"
            className="h-3.5 w-auto object-contain"
            src="/dreamweavers-logo.png"
          />
        </div>

        <Separator className="bg-champagne-silk" />

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <ul className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.key;
              const isEnabled = isPageEnabled(item.key, featureFlags);

              return (
                <li key={item.key}>
                  <button
                    onClick={() => isEnabled && setPage(item.key)}
                    disabled={!isEnabled}
                    title={!isEnabled ? 'Not available in your package' : undefined}
                    className={`
                      relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium
                      transition-colors duration-150
                      ${
                        !isEnabled
                          ? 'border-l-2 border-transparent text-charcoal-ink/20 cursor-not-allowed'
                          : isActive
                            ? 'border-l-2 border-cinematic-gold bg-cinematic-gold/5 text-cinematic-gold'
                            : 'text-charcoal-ink/60 hover:bg-champagne-silk/40 hover:text-charcoal-ink border-l-2 border-transparent'
                      }
                    `}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className={isEnabled ? '' : 'line-through'}>{item.label}</span>
                    {!isEnabled && <Lock className="size-3 shrink-0 ml-auto text-charcoal-ink/20" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <Separator className="bg-champagne-silk" />

        {/* View as guest / sign out */}
        <div className="p-3 space-y-1">
          <Button
            variant="ghost"
            onClick={() => {
              useAuthModalStore.getState().openModal();
              signOut({ redirect: false });
            }}
            className="w-full justify-start gap-2 text-charcoal-ink/50 hover:text-cinematic-gold hover:bg-champagne-silk/40 px-3 text-xs font-medium"
          >
            <ArrowRightLeft className="size-3.5" />
            Switch Account
          </Button>
          <Button
            variant="ghost"
            onClick={() => togglePreview(true)}
            className="w-full justify-start gap-2 text-charcoal-ink/50 hover:text-cinematic-gold hover:bg-champagne-silk/40 px-3 text-sm font-medium"
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            View as Guest
          </Button>
          <Button
            variant="ghost"
            onClick={() => signOut({ callbackUrl: '/?view=couple' })}
            className="w-full justify-start gap-2 text-charcoal-ink/30 hover:text-charcoal-ink hover:bg-champagne-silk/40 px-3 text-xs font-medium"
          >
            <LogOut className="size-3.5" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-champagne-silk bg-paper-cream px-4 md:px-6">
          {/* Left: Couple name + mobile menu */}
          <div className="flex items-center gap-3">
            {/* Mobile: back to guest view */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => togglePreview(true)}
              className="md:hidden -ml-2 text-charcoal-ink/60 hover:text-cinematic-gold p-2 h-auto"
              aria-label="View as guest"
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            </Button>
            <h1 className="text-base font-semibold text-charcoal-ink truncate">
              {coupleName}
            </h1>
          </div>

          {/* Right: Notifications + Preview + DW logo + Sign Out */}
          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationBell variant="couple" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => togglePreview(true)}
              className="h-8 text-xs font-medium text-cinematic-gold border-cinematic-gold/30 hover:bg-cinematic-gold/10 hover:border-cinematic-gold rounded-md px-3 gap-1.5"
            >
              <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              Preview
            </Button>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cinematic-gold text-white font-bold text-[11px]">
              DW
            </div>
            <Separator orientation="vertical" className="h-5 !bg-champagne-silk hidden sm:block" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: '/?view=couple' })}
              className="hidden sm:flex items-center gap-2 text-charcoal-ink/60 hover:text-charcoal-ink px-2 h-auto py-1.5 text-sm font-medium"
            >
              <LogOut className="size-3.5" />
              Sign Out
            </Button>
            <Avatar className="h-7 w-7 sm:hidden border border-champagne-silk">
              <AvatarImage src={user?.image ?? undefined} alt={user?.name ?? 'User'} />
              <AvatarFallback className="bg-champagne-silk/50 text-[10px] font-medium text-charcoal-ink">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 md:pb-8">
          <div className="mx-auto max-w-4xl rounded-lg bg-white p-6 shadow-sm ring-1 ring-charcoal-ink/5">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden items-center justify-around border-t border-champagne-silk bg-paper-cream/95 backdrop-blur-sm px-1 py-1.5 pb-[env(safe-area-inset-bottom)]">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.key;
            const isEnabled = isPageEnabled(item.key, featureFlags);

            return (
              <button
                key={item.key}
                onClick={() => isEnabled && setPage(item.key)}
                disabled={!isEnabled}
                className={`
                  flex flex-col items-center gap-0.5 rounded-md px-2 py-1.5 transition-colors duration-150
                  ${!isEnabled ? 'text-charcoal-ink/15' : isActive ? 'text-cinematic-gold' : 'text-charcoal-ink/40'}
                `}
              >
                <div className="relative">
                  <Icon className="size-5" />
                  {!isEnabled && <Lock className="size-2.5 absolute -top-0.5 -right-0.5 text-charcoal-ink/20" />}
                </div>
                <span className="text-[10px] font-medium leading-tight">{item.label}</span>
              </button>
            );
          })}
          {/* More button for remaining items */}
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                className={`
                  flex flex-col items-center gap-0.5 rounded-md px-2 py-1.5 transition-colors duration-150
                  ${currentPage !== 'overview' && currentPage !== 'details' && currentPage !== 'home' && currentPage !== 'schedule'
                    ? 'text-cinematic-gold'
                    : 'text-charcoal-ink/40'}
                `}
              >
                <MoreHorizontal className="size-5" />
                <span className="text-[10px] font-medium leading-tight">More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[60vh]">
              <div className="py-4">
                <h3 className="text-sm font-semibold text-charcoal-ink mb-3 px-2">More Pages</h3>
                <div className="grid grid-cols-4 gap-1 px-1">
                  {moreNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPage === item.key;
                    const isEnabled = isPageEnabled(item.key, featureFlags);
                    return (
                      <button
                        key={item.key}
                        onClick={() => {
                          if (isEnabled) {
                            setPage(item.key);
                            setMoreOpen(false);
                          }
                        }}
                        disabled={!isEnabled}
                        className={`
                          flex flex-col items-center gap-1.5 rounded-lg px-2 py-3 transition-colors duration-150
                          ${!isEnabled ? 'text-charcoal-ink/15 cursor-not-allowed' : isActive ? 'bg-cinematic-gold/10 text-cinematic-gold' : 'text-charcoal-ink/60 hover:bg-champagne-silk/40'}
                        `}
                      >
                        <div className="relative">
                          <Icon className="size-5" />
                          {!isEnabled && <Lock className="size-3 absolute -top-0.5 -right-0.5 text-charcoal-ink/20" />}
                        </div>
                        <span className="text-[11px] font-medium leading-tight text-center">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </nav>
      </div>
    </div>
  );
}