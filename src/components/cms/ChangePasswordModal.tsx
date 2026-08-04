'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2, KeyRound, Check, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PASSWORD_RULES, PASSWORD_POLICY_TEXT } from '@/lib/password-policy';
import { toast } from '@/hooks/use-toast';

interface ChangePasswordModalProps {
  open: boolean;
  onSuccess: () => void;
}

export function ChangePasswordModal({ open, onSuccess }: ChangePasswordModalProps) {
  const { data: session } = useSession();
  const isForcedChange = session?.user?.mustChangePassword === true;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  // Live rule validation
  const ruleChecks = PASSWORD_RULES.map((rule) => ({
    ...rule,
    passed: rule.test(newPassword),
  }));

  const allRulesPassed = ruleChecks.every((r) => r.passed);
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;
  const canSubmit = allRulesPassed && passwordsMatch && !loading
    && (isForcedChange || currentPassword.length > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      setLoading(true);
      const res = await fetch('/api/auth/change-password?XTransformPort=3000', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPassword || undefined, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to change password');
      }

      toast({
        title: 'Password Changed',
        description: 'Your password has been updated successfully.',
      });

      // Reset form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onSuccess();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => { /* prevent close — must change password */ }}>
      <DialogContent
        showCloseButton={false}
        className="!max-w-[460px] !p-0 !gap-0 !rounded-none"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="bg-paper-cream border border-cinematic-gold/30 shadow-[0_0_40px_rgba(212,175,55,0.08)]">
          {/* Gold accent top bar */}
          <div className="h-[2px] bg-cinematic-gold" />

          <div className="px-8 pt-8 pb-6">
            <DialogHeader className="text-center">
              <div className="flex items-center justify-center mb-4">
                <div className="w-10 h-10 rounded-full bg-cinematic-gold/10 border border-cinematic-gold/30 flex items-center justify-center">
                  <KeyRound className="size-5 text-cinematic-gold" />
                </div>
              </div>
              <DialogTitle
                className="text-[22px] text-charcoal-ink"
                style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic' }}
              >
                Change Your Password
              </DialogTitle>
              <DialogDescription className="text-[13px] text-charcoal-ink/50 mt-2">
                {isForcedChange
                  ? 'Your account was created with a system-assigned password. Please set your own password to continue.'
                  : 'For security, please verify your current password and set a new one.'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-5 mt-6">
              {/* Current Password — hidden for forced changes (system-assigned password) */}
              {!isForcedChange && (
              <div>
                <Label className="block text-[11px] tracking-[0.18em] uppercase font-semibold mb-2 text-charcoal-ink/50">
                  Current Password
                </Label>
                <div className="relative">
                  <Input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    required
                    disabled={loading}
                    autoFocus
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-charcoal-ink/30 hover:text-charcoal-ink/60"
                    tabIndex={-1}
                  >
                    {showCurrent ? <X className="size-4" /> : <KeyRound className="size-4" />}
                  </button>
                </div>
              </div>
              )}

              {/* New Password */}
              <div>
                <Label className="block text-[11px] tracking-[0.18em] uppercase font-semibold mb-2 text-charcoal-ink/50">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-charcoal-ink/30 hover:text-charcoal-ink/60"
                    tabIndex={-1}
                  >
                    {showNew ? <X className="size-4" /> : <KeyRound className="size-4" />}
                  </button>
                </div>

                {/* Live rule checklist */}
                {newPassword.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {ruleChecks.map((rule) => (
                      <div key={rule.key} className="flex items-center gap-2 text-[11px]">
                        {rule.passed ? (
                          <Check className="size-3 text-green-500" />
                        ) : (
                          <X className="size-3 text-red-400" />
                        )}
                        <span className={rule.passed ? 'text-green-600' : 'text-red-400'}>
                          {rule.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <Label className="block text-[11px] tracking-[0.18em] uppercase font-semibold mb-2 text-charcoal-ink/50">
                  Confirm New Password
                </Label>
                <Input
                  type={showNew ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  disabled={loading}
                />
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-[11px] text-red-400 mt-1">Passwords do not match</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={!canSubmit}
                className="w-full py-3 rounded-sm text-[13px] font-medium uppercase tracking-[0.08em] bg-charcoal-ink text-paper-cream hover:bg-charcoal-ink/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin inline mr-1.5" />
                    Changing...
                  </>
                ) : (
                  'Change Password'
                )}
              </Button>

              <p className="text-[10px] text-charcoal-ink/30 text-center">
                {PASSWORD_POLICY_TEXT}
              </p>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
