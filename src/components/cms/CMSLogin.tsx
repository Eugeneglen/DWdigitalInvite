'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCMSStore, type AuthUser } from '@/store/useCMSStore';

export default function CMSLogin() {
  const login = useCMSStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Invalid credentials. Please try again.');
        setIsLoading(false);
        return;
      }

      const user: AuthUser = {
        userId: data.user.userId,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
        tenantId: data.user.tenantId,
        tenantRole: data.user.tenantRole,
        token: data.token,
      };

      login(user);
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <a href="https://www.dreamweavers.com.sg/" target="_blank" rel="noopener noreferrer">
              <Image
                src="/dreamweavers-logo.png"
                alt="Dreamweavers"
                width={48}
                height={48}
                className="mb-4"
              />
            </a>
            <h1 className="text-xl font-semibold text-charcoal-ink">
              Dreamweavers CMS
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Sign in to manage your digital invitations
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-charcoal-ink">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@dreamweavers.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="h-10 border-gray-300 rounded-md focus:ring-charcoal-ink/20 focus:border-charcoal-ink"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-charcoal-ink">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-10 border-gray-300 rounded-md pr-10 focus:ring-charcoal-ink/20 focus:border-charcoal-ink"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2"
              >
                {error}
              </motion.div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 bg-charcoal-ink text-white hover:bg-charcoal-ink/90 rounded-md font-medium transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Dreamweavers Digital Invitation Platform
        </p>
      </motion.div>
    </div>
  );
}