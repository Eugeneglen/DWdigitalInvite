'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Check, Copy, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface PackageTemplate {
  name: string;
  label: string;
  features: string[];
  maxGuests: number;
  maxMedia: number;
}

interface FeatureInfo {
  key: string;
  label: string;
  description: string;
}

const ALL_FEATURES: FeatureInfo[] = [
  { key: 'countdown', label: 'Countdown Timer', description: 'Live countdown to wedding day' },
  { key: 'schedule', label: 'Event Schedule', description: 'Timeline of wedding events' },
  { key: 'rsvp', label: 'RSVP Form', description: 'Attendance response form' },
  { key: 'getting-there', label: 'Getting There', description: 'Directions and venue info' },
  { key: 'story', label: 'Our Story', description: 'Love story timeline' },
  { key: 'wishes', label: 'Wishes & Blessings', description: 'Guest messages' },
  { key: 'qa', label: 'Q&A', description: 'Common guest questions' },
  { key: 'moments', label: 'Moments', description: 'Photo gallery' },
  { key: 'gallery', label: 'Photo Gallery', description: 'Additional gallery' },
  { key: 'music', label: 'Background Music', description: 'Music player' },
  { key: 'video', label: 'Wedding Video', description: 'Embedded video' },
  { key: 'animation:gold-dust', label: 'Gold Dust Animation', description: 'Ambient gold particles drifting upward' },
  { key: 'animation:flying-stars', label: 'Meteors Animation', description: 'Shooting-star streaks falling through a starfield' },
  { key: 'animation:raining', label: 'Bubbles Animation', description: 'Raindrop ripple rings expanding and fading' },
  { key: 'templates', label: 'Theme Templates', description: '6 curated design themes' },
];

const PACKAGE_DESCRIPTIONS: Record<string, string> = {
  GOLD: 'Home, Schedule, RSVP, Getting There, Countdown',
  PLATINUM: 'Gold + Story, Wishes, Q&A',
  DIAMOND: 'Platinum + Moments, Music, Video, Theme Templates',
};

interface WeddingCreationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface FormData {
  coupleName: string;
  brideName: string;
  groomName: string;
  coupleEmail: string;
  couplePhone: string;
  weddingDate: string;
  weddingTime: string;
  venue: string;
  venueAddress: string;
  googleMapsUrl: string;
  jobNumber: string;
  plan: string;
  features: string[];
  consultantId: string;
  coordinatorId: string;
  internalNotes: string;
}

const INITIAL_FORM: FormData = {
  coupleName: '',
  brideName: '',
  groomName: '',
  coupleEmail: '',
  couplePhone: '',
  weddingDate: '',
  weddingTime: '',
  venue: '',
  venueAddress: '',
  googleMapsUrl: '',
  jobNumber: '',
  plan: 'GOLD',
  features: [],
  consultantId: '',
  coordinatorId: '',
  internalNotes: '',
};

/**
 * Format a date string (YYYY-MM-DD or ISO) as DD/MM/YYYY for display.
 * Parses the string manually to avoid timezone shifts and locale quirks
 * from `new Date().toLocaleDateString()`.
 */
function formatDateDisplay(dateStr: string): string {
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
}

export default function WeddingCreationWizard({ open, onOpenChange, onCreated }: WeddingCreationWizardProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [packages, setPackages] = useState<PackageTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ credentials: Record<string, string>; wedding: Record<string, unknown> } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Fetch staff users and package templates on open
  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const [usersRes, settingsRes] = await Promise.all([
        fetch('/api/master/users?XTransformPort=3000'),
        fetch('/api/master/settings?XTransformPort=3000'),
      ]);

      if (usersRes.ok) {
        const userData = await usersRes.json();
        const allUsers: StaffUser[] = userData.users ?? [];
        setStaff(allUsers.filter((u) => u.role === 'ADMIN_1' || u.role === 'ADMIN_2'));
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        const templatesStr = settingsData.settings?.package_templates;
        if (templatesStr) {
          try {
            setPackages(JSON.parse(templatesStr));
          } catch { /* ignore */ }
        }
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchInitialData();
      setStep(0);
      setForm(INITIAL_FORM);
      setResult(null);
    }
  }, [open, fetchInitialData]);

  // When package changes, auto-apply that package's features.
  // Gold Dust animation is ON by default for all new weddings; admin can
  // toggle individual animations ON/OFF in the feature grid.
  useEffect(() => {
    const pkg = packages.find((p) => p.name === form.plan);
    if (pkg) {
      const features = [...pkg.features];
      // Default: Gold Dust ON, Meteors OFF, Bubbles OFF
      if (!features.includes('animation:gold-dust')) features.push('animation:gold-dust');
      setForm((prev) => ({ ...prev, features }));
    }
  }, [form.plan, packages]);

  const consultants = staff.filter((s) => s.role === 'ADMIN_1');
  const coordinators = staff.filter((s) => s.role === 'ADMIN_2');

  const handleCreate = async () => {
    try {
      setCreating(true);
      const res = await fetch('/api/master/weddings?XTransformPort=3000', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create wedding');
      }

      const data = await res.json();
      setResult(data);
      toast({ title: 'Success', description: 'Wedding created successfully' });
      onCreated();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to create wedding',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: 'Copied', description: `${label} copied to clipboard` });
  };

  const canProceed = () => {
    if (step === 0) {
      return form.coupleName.trim().length >= 2 && form.coupleEmail.trim() && form.weddingDate && form.venueAddress.trim();
    }
    if (step === 1) return true;
    if (step === 2) return true;
    return true;
  };

  const steps = ['Customer Info', 'Package & Features', 'Assignment', 'Review'];

  // ── Confirmation Screen ──────────────────────────────────────────────
  if (result) {
    const c = result.credentials;
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-charcoal-ink">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-50">
              <Check className="size-5 text-green-500" />
            </div>
            Wedding Created Successfully!
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-paper-cream rounded-lg p-4 space-y-3">
            <div>
              <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Couple CMS URL</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 text-sm bg-white border border-charcoal-ink/10 rounded px-2 py-1.5 truncate">
                  {baseUrl}{c.coupleCmsUrl}
                </code>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(`${baseUrl}${c.coupleCmsUrl}`, 'Couple CMS URL')}>
                  {copied === 'Couple CMS URL' ? <Check className="size-3" /> : <Copy className="size-3" />}
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Guest Invitation URL</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 text-sm bg-white border border-charcoal-ink/10 rounded px-2 py-1.5 truncate">
                  {baseUrl}{c.guestInvitationUrl}
                </code>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(`${baseUrl}${c.guestInvitationUrl}`, 'Guest URL')}>
                  {copied === 'Guest URL' ? <Check className="size-3" /> : <Copy className="size-3" />}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Login ID</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-sm bg-white border border-charcoal-ink/10 rounded px-2 py-1.5 truncate">
                    {c.loginId}
                  </code>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(c.loginId, 'Login ID')}>
                    {copied === 'Login ID' ? <Check className="size-3" /> : <Copy className="size-3" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Password</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-sm bg-white border border-charcoal-ink/10 rounded px-2 py-1.5 truncate">
                    {c.defaultPassword}
                  </code>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(c.defaultPassword, 'Password')}>
                    {copied === 'Password' ? <Check className="size-3" /> : <Copy className="size-3" />}
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Job Number</Label>
                <p className="text-sm font-medium text-charcoal-ink mt-1">{c.jobNumber}</p>
              </div>
              <div>
                <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Access Expires</Label>
                <p className="text-sm font-medium text-charcoal-ink mt-1">
                  {new Date(c.accessExpiryDate).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-cinematic-gold/5 border border-cinematic-gold/20 rounded-lg p-3 flex items-center gap-2">
            <Sparkles className="size-4 text-cinematic-gold shrink-0" />
            <p className="text-xs text-charcoal-ink/60">
              Email onboarding is queued and will be sent automatically when the email service is configured.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                const allDetails = `DreamWeavers Digital Invitation\n\nCouple: ${form.coupleName}\nJob Number: ${c.jobNumber}\n\nCouple CMS URL: ${baseUrl}${c.coupleCmsUrl}\nGuest URL: ${baseUrl}${c.guestInvitationUrl}\n\nLogin ID: ${c.loginId}\nPassword: ${c.defaultPassword}\n\nPlease log in to personalise your wedding invitation.`;
                copyToClipboard(allDetails, 'All Details');
              }}
              variant="outline"
              className="text-xs"
            >
              <Copy className="size-3 mr-1" />
              Copy All Details
            </Button>
            <Button onClick={() => onOpenChange(false)} className="bg-charcoal-ink text-paper-cream hover:bg-charcoal-ink/90 text-xs">
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
      </Dialog>
    );
  }

  // ── Wizard Steps ──────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-charcoal-ink">Create New Wedding</DialogTitle>
      </DialogHeader>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-cinematic-gold" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Step indicator */}
          <div className="flex items-center justify-between">
            {steps.map((label, i) => (
              <div key={label} className="flex items-center flex-1">
                <div className={`flex items-center gap-2 ${i <= step ? 'text-charcoal-ink' : 'text-charcoal-ink/30'}`}>
                  <div className={`flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium ${i < step ? 'bg-green-500 text-white' : i === step ? 'bg-cinematic-gold text-charcoal-ink' : 'bg-charcoal-ink/10 text-charcoal-ink/40'}`}>
                    {i < step ? <Check className="size-3" /> : i + 1}
                  </div>
                  <span className="text-xs font-medium hidden sm:inline">{label}</span>
                </div>
                {i < steps.length - 1 && <div className={`flex-1 h-px mx-2 ${i < step ? 'bg-green-500' : 'bg-charcoal-ink/10'}`} />}
              </div>
            ))}
          </div>

          {/* Step 1: Customer Information */}
          {step === 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Bride&apos;s Name *</Label>
                  <Input value={form.brideName} onChange={(e) => setForm({ ...form, brideName: e.target.value, coupleName: e.target.value && form.groomName ? `${e.target.value} & ${form.groomName}` : form.coupleName })} placeholder="Eleanor" className="border-charcoal-ink/10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Groom&apos;s Name *</Label>
                  <Input value={form.groomName} onChange={(e) => setForm({ ...form, groomName: e.target.value, coupleName: form.brideName && e.target.value ? `${form.brideName} & ${e.target.value}` : form.coupleName })} placeholder="James" className="border-charcoal-ink/10" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Couple Name (Display) *</Label>
                <Input value={form.coupleName} onChange={(e) => setForm({ ...form, coupleName: e.target.value })} placeholder="Eleanor & James" className="border-charcoal-ink/10" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Couple Email * (Login ID)</Label>
                  <Input type="email" value={form.coupleEmail} onChange={(e) => setForm({ ...form, coupleEmail: e.target.value })} placeholder="eleanor@wedding.com" className="border-charcoal-ink/10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Mobile Number</Label>
                  <Input value={form.couplePhone} onChange={(e) => setForm({ ...form, couplePhone: e.target.value })} placeholder="+65 9123 4567" className="border-charcoal-ink/10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Wedding Date *</Label>
                  <Input type="date" value={form.weddingDate ? form.weddingDate.split('T')[0] : ''} onChange={(e) => setForm({ ...form, weddingDate: e.target.value })} className="border-charcoal-ink/10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Wedding Time</Label>
                  <Input type="time" value={form.weddingTime} onChange={(e) => setForm({ ...form, weddingTime: e.target.value })} className="border-charcoal-ink/10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Wedding Venue</Label>
                  <Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="The Fullerton Hotel" className="border-charcoal-ink/10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Venue Address *</Label>
                  <Input value={form.venueAddress} onChange={(e) => setForm({ ...form, venueAddress: e.target.value })} placeholder="38 Cuscaden Road, Singapore 249731" className="border-charcoal-ink/10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Google Maps URL</Label>
                  <Input value={form.googleMapsUrl} onChange={(e) => setForm({ ...form, googleMapsUrl: e.target.value })} placeholder="https://maps.google.com/..." className="border-charcoal-ink/10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Job Number (auto if blank)</Label>
                  <Input value={form.jobNumber} onChange={(e) => setForm({ ...form, jobNumber: e.target.value })} placeholder="DW-TDS-2026-000008" className="border-charcoal-ink/10" />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Package & Features */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider mb-2 block">Select Package</Label>
                <div className="grid grid-cols-3 gap-3">
                  {['GOLD', 'PLATINUM', 'DIAMOND'].map((pkg) => (
                    <button
                      key={pkg}
                      type="button"
                      onClick={() => setForm({ ...form, plan: pkg })}
                      className={`text-left p-3 rounded-lg border-2 transition-colors ${form.plan === pkg ? 'border-cinematic-gold bg-cinematic-gold/5' : 'border-charcoal-ink/10 hover:border-champagne-silk'}`}
                    >
                      <p className="text-sm font-semibold text-charcoal-ink">{pkg.charAt(0) + pkg.slice(1).toLowerCase()}</p>
                      <p className="text-[10px] text-charcoal-ink/40 mt-1">{PACKAGE_DESCRIPTIONS[pkg]}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider mb-2 block">
                  Features (auto-applied from {form.plan}, admin can override)
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_FEATURES.map((feature) => {
                    const enabled = form.features.includes(feature.key);
                    return (
                      <div
                        key={feature.key}
                        className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${enabled ? 'border-cinematic-gold/30 bg-cinematic-gold/[0.02]' : 'border-charcoal-ink/10'}`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-charcoal-ink truncate">{feature.label}</p>
                          <p className="text-[10px] text-charcoal-ink/40 truncate">{feature.description}</p>
                        </div>
                        <Switch
                          checked={enabled}
                          onCheckedChange={(checked) => {
                            setForm((prev) => ({
                              ...prev,
                              features: checked
                                ? [...prev.features, feature.key]
                                : prev.features.filter((k) => k !== feature.key),
                            }));
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Assignment */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Assigned Consultant (ADMIN_1)</Label>
                <Select value={form.consultantId || 'none'} onValueChange={(v) => setForm({ ...form, consultantId: v === 'none' ? '' : v })}>
                  <SelectTrigger className="w-full border-charcoal-ink/10">
                    <SelectValue placeholder="Select consultant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {consultants.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name} ({c.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Assigned Coordinator (ADMIN_2)</Label>
                <Select value={form.coordinatorId || 'none'} onValueChange={(v) => setForm({ ...form, coordinatorId: v === 'none' ? '' : v })}>
                  <SelectTrigger className="w-full border-charcoal-ink/10">
                    <SelectValue placeholder="Select coordinator" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {coordinators.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name} ({c.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Internal Notes (admin only)</Label>
                <Textarea
                  value={form.internalNotes}
                  onChange={(e) => setForm({ ...form, internalNotes: e.target.value })}
                  placeholder="Notes visible to DreamWeavers staff only..."
                  rows={4}
                  className="border-charcoal-ink/10 resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="bg-paper-cream rounded-lg p-4 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-charcoal-ink/50">Couple:</span> <span className="font-medium text-charcoal-ink">{form.coupleName}</span></div>
                  <div><span className="text-charcoal-ink/50">Email:</span> <span className="font-medium text-charcoal-ink">{form.coupleEmail}</span></div>
                  <div><span className="text-charcoal-ink/50">Mobile:</span> <span className="font-medium text-charcoal-ink">{form.couplePhone || '—'}</span></div>
                  <div><span className="text-charcoal-ink/50">Date:</span> <span className="font-medium text-charcoal-ink">{form.weddingDate ? formatDateDisplay(form.weddingDate) : '—'}</span></div>
                  <div><span className="text-charcoal-ink/50">Venue:</span> <span className="font-medium text-charcoal-ink">{form.venue || '—'}</span></div>
                  <div><span className="text-charcoal-ink/50">Job #:</span> <span className="font-medium text-charcoal-ink">{form.jobNumber || '(auto)'}</span></div>
                </div>
                <div className="border-t border-charcoal-ink/10 pt-2">
                  <span className="text-charcoal-ink/50">Package:</span> <Badge className="ml-1">{form.plan}</Badge>
                </div>
                <div>
                  <span className="text-charcoal-ink/50">Features:</span>{' '}
                  <span className="text-xs text-charcoal-ink/70">
                    {form.features.map((f) => ALL_FEATURES.find((af) => af.key === f)?.label || f).join(', ')}
                  </span>
                </div>
                <div className="border-t border-charcoal-ink/10 pt-2">
                  <span className="text-charcoal-ink/50">Consultant:</span>{' '}
                  <span className="font-medium text-charcoal-ink">{consultants.find((c) => c.id === form.consultantId)?.name || '—'}</span>
                </div>
                <div>
                  <span className="text-charcoal-ink/50">Coordinator:</span>{' '}
                  <span className="font-medium text-charcoal-ink">{coordinators.find((c) => c.id === form.coordinatorId)?.name || '—'}</span>
                </div>
              </div>
              <div className="bg-cinematic-gold/5 border border-cinematic-gold/20 rounded-lg p-3">
                <p className="text-xs text-charcoal-ink/60 leading-relaxed">
                  On create, the system will:
                </p>
                <ul className="text-xs text-charcoal-ink/60 mt-1 space-y-0.5">
                  <li>✓ Create wedding account (DRAFT / Onboarding)</li>
                  <li>✓ Create couple login ({form.coupleEmail} / Couple@123)</li>
                  <li>✓ Apply {form.plan} package features</li>
                  <li>✓ Generate Couple CMS URL + Guest URL</li>
                  <li>✓ Set access expiry (30 days after wedding)</li>
                </ul>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2 border-t border-charcoal-ink/5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => step > 0 ? setStep(step - 1) : onOpenChange(false)}
              className="text-xs"
            >
              <ChevronLeft className="size-4 mr-1" />
              {step === 0 ? 'Cancel' : 'Back'}
            </Button>
            {step < 3 ? (
              <Button
                size="sm"
                disabled={!canProceed()}
                onClick={() => setStep(step + 1)}
                className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90 text-xs"
              >
                Next
                <ChevronRight className="size-4 ml-1" />
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={creating}
                onClick={handleCreate}
                className="bg-charcoal-ink text-paper-cream hover:bg-charcoal-ink/90 text-xs"
              >
                {creating ? <Loader2 className="size-4 mr-1 animate-spin" /> : null}
                {creating ? 'Creating...' : 'Create Wedding'}
              </Button>
            )}
          </div>
        </div>
      )}
    </DialogContent>
    </Dialog>
  );
}
