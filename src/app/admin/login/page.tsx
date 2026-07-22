'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Sparkles, Loader2 } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
      } else {
        router.push('/admin');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper-cream flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Login Card */}
        <div className="bg-white rounded-xl border border-champagne-silk/30 shadow-sm overflow-hidden">
          {/* Gold accent line at top */}
          <div className="h-1 bg-gradient-to-r from-cinematic-gold/40 via-cinematic-gold to-cinematic-gold/40" />

          <div className="px-8 pt-10 pb-8">
            {/* Logo / Brand */}
            <div className="flex flex-col items-center mb-10">
              <div className="w-11 h-11 rounded-full bg-cinematic-gold/12 flex items-center justify-center mb-4">
                <Sparkles className="w-5 h-5 text-cinematic-gold" />
              </div>
              <h1 className="font-[family-name:var(--font-playfair)] text-xl font-semibold text-charcoal-ink tracking-tight">
                Dreamweavers
              </h1>
              <p className="mt-0.5 text-[11px] text-charcoal-ink/40 uppercase tracking-[0.18em] font-[family-name:var(--font-inter)]">
                Platform Admin
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs uppercase tracking-[0.1em] text-charcoal-ink/45 font-[family-name:var(--font-inter)] font-medium mb-3"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="admin@dreamweavers.io"
                  className="input-line font-[family-name:var(--font-inter)] text-[15px] placeholder:text-charcoal-ink/25"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-xs uppercase tracking-[0.1em] text-charcoal-ink/45 font-[family-name:var(--font-inter)] font-medium mb-3"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="input-line font-[family-name:var(--font-inter)] text-[15px] placeholder:text-charcoal-ink/25"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm font-[family-name:var(--font-inter)]">
                  <div className="w-1 h-1 rounded-full bg-red-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-charcoal-ink text-paper-cream rounded-lg
                           uppercase text-[13px] tracking-[0.12em] font-[family-name:var(--font-inter)] font-medium
                           hover:bg-charcoal-ink/90 transition-all duration-200
                           disabled:opacity-50 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Subtle footer */}
        <p className="mt-6 text-center text-xs text-charcoal-ink/25 font-[family-name:var(--font-inter)]">
          Dreamweavers — The Digital Keepsake Platform
        </p>
      </div>
    </div>
  );
}