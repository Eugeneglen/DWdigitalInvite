'use client';

import { useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, LogOut, Eye, EyeOff, Info, KeyRound, Mail, ArrowLeft } from 'lucide-react';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { normalizePlatformRole } from '@/lib/permissions';

type AuthView = 'login' | 'forgot-password';

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Visual variant — 'cms' uses a dark charcoal theme, 'default' uses the light cream theme */
  variant?: 'default' | 'cms';
  /** When set, a user authenticated with a DIFFERENT role sees the standard login form (not "Switch Account") */
  targetRole?: 'admin' | 'couple';
}

export function LoginModal({ open, onOpenChange, variant = 'default', targetRole }: LoginModalProps) {
  const isCMS = variant === 'cms';
  const { data: session, status } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // View routing
  const [view, setView] = useState<AuthView>('login');

  // Forgot Password state (email-only — reset link sent to inbox)
  const [fpEmail, setFpEmail] = useState('');
  const [fpError, setFpError] = useState('');
  const [fpLoading, setFpLoading] = useState(false);
  const [fpSuccess, setFpSuccess] = useState(false);

  // Reset sub-state when switching views
  const switchView = (v: AuthView) => {
    setView(v);
    setFpEmail('');
    setFpError('');
    setFpLoading(false);
    setFpSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password. Please try again.');
      } else {
        // Just close the modal. The parent component (CoupleCMSView / AdminCMSView)
        // will detect the session change via useSession() and render the CMS.
        // We do NOT navigate away — this preserves the ?view= parameter.
        useAuthModalStore.getState().closeModal();
        setEmail('');
        setPassword('');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchAccount = async () => {
    setIsLoading(true);
    await signOut({ redirect: false });
    setIsLoading(false);
  };

  // ── FORGOT PASSWORD (email only — reset link sent to inbox) ─────
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError('');
    setFpLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fpEmail.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFpError(data.error || 'Something went wrong.');
        return;
      }

      setFpSuccess(true);
    } catch {
      setFpError('Network error. Please check your connection and try again.');
    } finally {
      setFpLoading(false);
    }
  };

  const currentRole = session?.user?.role;
  const normalizedRole = normalizePlatformRole(currentRole || '');
  const currentIsAdmin = normalizedRole === 'SUPER_ADMIN' || normalizedRole === 'ACCOUNT_MANAGER_1' || normalizedRole === 'ACCOUNT_MANAGER_2' || normalizedRole === 'SUPPORT';
  const currentIsCouple = normalizedRole === 'COUPLE';

  // If a targetRole is specified and the current session's role doesn't match,
  // treat it as "not authenticated" so the standard login form is shown.
  // This lets the user sign in directly without needing to sign out first.
  const roleMismatch = targetRole
    ? (targetRole === 'admin' && !currentIsAdmin) || (targetRole === 'couple' && !currentIsCouple)
    : false;

  const isAlreadyAuthenticated = status === 'authenticated' && session && !roleMismatch;

  const roleLabel = currentIsAdmin ? 'Admin' : 'Couple';

  // Shared style helpers
  const labelClass = 'text-charcoal-ink/50';
  const inputClass = 'input-line !text-[15px] !font-sans placeholder:text-charcoal-ink/30';
  const btnPrimary =
    'w-full py-3 rounded-sm text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300 disabled:opacity-40 bg-charcoal-ink text-paper-cream hover:bg-charcoal-ink/90';
  const btnGhost =
    'flex items-center gap-1.5 text-[12px] text-charcoal-ink/50 hover:text-cinematic-gold transition-colors duration-200';

  const isRecoveryView = view !== 'login';

  // ── Render: Forgot Password ──────────────────────────────────────
  const renderForgotPassword = () => (
    <div className="space-y-5">
      {/* Back link */}
      <button type="button" onClick={() => switchView('login')} className={btnGhost}>
        <ArrowLeft className="size-3.5" />
        Back to Sign In
      </button>

      {/* Success state */}
      {fpSuccess ? (
        <div className="text-center py-2">
          <div className="flex items-center justify-center mb-4">
            <div className="h-10 w-10 rounded-full bg-cinematic-gold/10 border border-cinematic-gold/30 flex items-center justify-center">
              <Mail className="size-4 text-cinematic-gold" />
            </div>
          </div>
          <DialogHeader className="text-center">
            <DialogTitle
              className="text-[22px] leading-tight text-charcoal-ink"
              style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic' }}
            >
              Check Your Inbox
            </DialogTitle>
            <DialogDescription className="text-[13px] text-charcoal-ink/50 mt-2 leading-relaxed">
              If an account with that email exists, we&apos;ve sent a password reset link
              to your inbox. The link expires in 30 minutes.
            </DialogDescription>
          </DialogHeader>
        </div>
      ) : (
        <>
          <div className="text-center mb-2">
            <div className="flex items-center justify-center mb-4">
              <div className="h-10 w-10 rounded-full border border-cinematic-gold/40 flex items-center justify-center">
                <KeyRound className="size-4 text-cinematic-gold" />
              </div>
            </div>
            <DialogHeader className="text-center">
              <DialogTitle
                className="text-[22px] leading-tight text-charcoal-ink"
                style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic' }}
              >
                Forgot Password
              </DialogTitle>
              <DialogDescription className="text-[13px] text-charcoal-ink/50 mt-2">
                Enter your account email and we&apos;ll send a reset link.
              </DialogDescription>
            </DialogHeader>
          </div>

          {fpError && (
            <div className="bg-cinematic-gold/5 border border-cinematic-gold/20 px-4 py-3 rounded-sm text-[13px] text-charcoal-ink/80">
              {fpError}
            </div>
          )}

          <form onSubmit={handleForgotPasswordSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="fp-email"
                className={`block text-[11px] tracking-[0.18em] uppercase font-semibold mb-2 ${labelClass}`}
              >
                Account Email
              </label>
              <input
                id="fp-email"
                type="email"
                placeholder="you@example.com"
                value={fpEmail}
                onChange={(e) => setFpEmail(e.target.value)}
                required
                disabled={fpLoading}
                autoComplete="email"
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={fpLoading || !fpEmail}
              className={btnPrimary}
            >
              {fpLoading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin inline mr-1.5" />
                  Sending…
                </>
              ) : (
                'Send Reset Link'
              )}
            </button>
          </form>
        </>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName={isCMS ? '!bg-charcoal-ink/90' : '!bg-paper-cream'}
        showCloseButton={false}
        className="!bg-transparent !border-0 !shadow-none !max-w-[420px] !p-0 !gap-0 !rounded-none"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          if (isRecoveryView) {
            switchView('login');
          }
        }}
      >
        <div className='bg-paper-cream border border-cinematic-gold/30 rounded-sm shadow-[0_0_40px_rgba(212,175,55,0.08)]'>
          {/* Gold accent top bar */}
          <div className='h-[2px] bg-cinematic-gold' />

          <div className="px-6 sm:px-10 pt-10 pb-8">
            {/* ── Recovery view ──────────────────────────────────── */}
            {view === 'forgot-password' && renderForgotPassword()}

            {/* ── Login views ─────────────────────────────────────── */}
            {view === 'login' && (
              <>
                {/* Branding */}
                <div className="text-center mb-8">
                  {/* Diamond ornament */}
                  <div className="flex items-center justify-center mb-5">
                    <div className="w-8 h-px bg-cinematic-gold/60" />
                    <svg
                      className="mx-3 text-cinematic-gold"
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="currentColor"
                    >
                      <path d="M6 0L12 6L6 12L0 6Z" />
                    </svg>
                    <div className="w-8 h-px bg-cinematic-gold/60" />
                  </div>

                  <DialogHeader className="text-center">
                    <DialogTitle
                      className="text-[28px] leading-tight text-charcoal-ink"
                      style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic' }}
                    >
                      {isAlreadyAuthenticated ? 'Switch Account' : isCMS ? 'Admin Portal' : 'Welcome Back'}
                    </DialogTitle>
                    <DialogDescription className="text-[13px] mt-2 tracking-wide text-charcoal-ink/50">
                      {isAlreadyAuthenticated
                        ? 'Sign out first, then sign in with a different account'
                        : isCMS
                          ? 'Sign in to the CMS Dashboard'
                          : 'Sign in to Dreamweavers Digital Heirlooms'}
                    </DialogDescription>
                  </DialogHeader>
                </div>

                {/* Switch Account — only when authenticated with MATCHING role (no targetRole mismatch) */}
                {isAlreadyAuthenticated && (
                  <div className="space-y-5">
                    {/* Current session card */}
                    <div className="flex items-center gap-4 border border-champagne-silk/30 bg-paper-cream/50 p-4 rounded-sm">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center border border-cinematic-gold/40 text-cinematic-gold text-sm font-bold rounded-sm"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        {(session.user?.name ?? 'U')
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[15px] font-medium truncate text-charcoal-ink"
                          style={{ fontFamily: "'Playfair Display', serif" }}
                        >
                          {session.user?.name}
                        </p>
                        <p className="text-[12px] truncate mt-0.5 text-charcoal-ink/50">
                          {session.user?.email}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-[10px] font-semibold px-3 py-1.5 rounded-sm uppercase tracking-[0.12em] ${
                          currentIsAdmin
                            ? 'bg-charcoal-ink text-paper-cream'
                            : 'bg-cinematic-gold/10 text-cinematic-gold border border-cinematic-gold/30'
                        }`}
                      >
                        {roleLabel}
                      </span>
                    </div>

                    {/* Sign Out button */}
                    <button
                      type="button"
                      onClick={handleSwitchAccount}
                      disabled={isLoading}
                      className='w-full flex items-center justify-center gap-2.5 py-3 rounded-sm text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300 bg-charcoal-ink text-paper-cream hover:bg-charcoal-ink/90'
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Signing out…
                        </>
                      ) : (
                        <>
                          <LogOut className="size-3.5" />
                          Sign Out
                        </>
                      )}
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-4">
                      <div className="flex-1 border-t border-champagne-silk/30" />
                      <span className="text-[11px] uppercase tracking-[0.15em] text-charcoal-ink/30">
                        or sign in directly
                      </span>
                      <div className="flex-1 border-t border-champagne-silk/30" />
                    </div>

                    {/* Inline login for quick switch */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                      {error && (
                        <div className="border border-cinematic-gold/20 px-4 py-3 rounded-sm text-[13px] bg-cinematic-gold/5 text-charcoal-ink/80">
                          {error}
                        </div>
                      )}
                      <div>
                        <label
                          htmlFor="switch-email"
                          className={`block text-[11px] tracking-[0.18em] uppercase font-semibold mb-2 ${labelClass}`}
                        >
                          Different email
                        </label>
                        <input
                          id="switch-email"
                          type="email"
                          placeholder="other@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={isLoading}
                          autoComplete="email"
                          className="input-line !text-[15px] !font-sans"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="switch-password"
                          className={`block text-[11px] tracking-[0.18em] uppercase font-semibold mb-2 ${labelClass}`}
                        >
                          Password
                        </label>
                        <div className="relative">
                          <input
                            id="switch-password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                            autoComplete="current-password"
                            className="input-line !text-[15px] !font-sans pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-0 top-1/2 -translate-y-1/2 p-2.5 transition-colors duration-200 text-charcoal-ink/30 hover:text-charcoal-ink/60"
                            tabIndex={-1}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword
                              ? <EyeOff className="size-4" />
                              : <Eye className="size-4" />}
                          </button>
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={isLoading || !email || !password}
                        className={btnPrimary}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin inline mr-1.5" />
                            Signing in…
                          </>
                        ) : (
                          'Sign In'
                        )}
                      </button>
                    </form>
                  </div>
                )}

                {/* Standard login form — shown when not authenticated OR when role mismatch */}
                {!isAlreadyAuthenticated && (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Role mismatch info banner */}
                    {roleMismatch && session?.user?.name && (
                      <div className="flex items-start gap-3 border border-champagne-silk/30 bg-paper-cream/80 px-4 py-3.5 rounded-sm text-[13px] text-charcoal-ink/60">
                        <Info className="size-4 shrink-0 mt-0.5 text-cinematic-gold/70" />
                        <p>
                          Currently signed in as <strong className="text-charcoal-ink/80">{session.user.name}</strong> ({roleLabel}).
                          Sign in below with a different account to continue.
                        </p>
                      </div>
                    )}

                    {error && (
                      <div className="border border-cinematic-gold/20 px-4 py-3 rounded-sm text-[13px] bg-cinematic-gold/5 text-charcoal-ink/80">
                        {error}
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="login-email"
                        className={`block text-[11px] tracking-[0.18em] uppercase font-semibold mb-2 ${labelClass}`}
                      >
                        Email
                      </label>
                      <input
                        id="login-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isLoading}
                        autoComplete="email"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="login-password"
                        className={`block text-[11px] tracking-[0.18em] uppercase font-semibold mb-2 ${labelClass}`}
                      >
                        Password
                      </label>
                      <div className="relative">
                        <input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          disabled={isLoading}
                          autoComplete="current-password"
                          className={`${inputClass} pr-10`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-0 top-1/2 -translate-y-1/2 p-2.5 transition-colors duration-200 text-charcoal-ink/30 hover:text-charcoal-ink/60"
                          tabIndex={-1}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword
                            ? <EyeOff className="size-4" />
                            : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || !email || !password}
                      className={btnPrimary}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin inline mr-1.5" />
                          Signing in…
                        </>
                      ) : (
                        'Sign In'
                      )}
                    </button>

                    {/* Forgot Password link */}
                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => switchView('forgot-password')}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1.5 text-[12px] text-charcoal-ink/40 hover:text-cinematic-gold transition-colors duration-200 disabled:opacity-40"
                      >
                        <KeyRound className="size-3" />
                        Forgot Password?
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-champagne-silk/20 px-6 sm:px-10 py-5 text-center">
            <a href="https://www.dreamweavers.com.sg/" target="_blank" rel="noopener noreferrer">
              <img
                src="/dreamweavers-logo.png"
                alt="Dreamweavers"
                className="h-5 w-auto mx-auto mb-3 opacity-40"
              />
            </a>
            <p
              className="text-[11px] uppercase tracking-[0.12em] font-semibold text-charcoal-ink/30"
            >
              © 2026 DREAMWEAVERS DIGITAL HEIRLOOMS. All rights reserved.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}