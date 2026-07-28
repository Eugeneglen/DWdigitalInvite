'use client';

import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCMSStore } from '@/store/useCMSStore';

// --- Types ---

interface TenantBasic {
  id: string;
  name: string;
  coupleName1: string | null;
  coupleName2: string | null;
  eventDate: string | null;
}

interface SettingsData {
  coupleName1: string;
  coupleName2: string;
  eventDate: string;
  venue: string;
  tagline: string;
  dateDisplay: string;
  teaCeremonyTitle: string;
  teaCeremonySubtitle: string;
  narrativeTitle: string;
  narrativeSubtitle: string;
  narrativeContent: string;
  venueName: string;
  venueShortName: string;
  venueAddress: string;
  venueFullAddress: string;
  venueDescription: string;
  venueMapEmbedUrl: string;
  contactEmail: string;
  countdownEnabled: boolean;
  countdownTargetDate: string;
}

// --- Schema ---

const settingsSchema = z.object({
  coupleName1: z.string(),
  coupleName2: z.string(),
  eventDate: z.string(),
  venue: z.string(),
  tagline: z.string(),
  dateDisplay: z.string(),
  teaCeremonyTitle: z.string(),
  teaCeremonySubtitle: z.string(),
  narrativeTitle: z.string(),
  narrativeSubtitle: z.string(),
  narrativeContent: z.string(),
  venueName: z.string(),
  venueShortName: z.string(),
  venueAddress: z.string(),
  venueFullAddress: z.string(),
  venueDescription: z.string(),
  venueMapEmbedUrl: z.string(),
  contactEmail: z.string().email('Invalid email').or(z.literal('')),
  countdownEnabled: z.boolean(),
  countdownTargetDate: z.string(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const defaultValues: SettingsFormValues = {
  coupleName1: '',
  coupleName2: '',
  eventDate: '',
  venue: '',
  tagline: '',
  dateDisplay: '',
  teaCeremonyTitle: '',
  teaCeremonySubtitle: '',
  narrativeTitle: '',
  narrativeSubtitle: '',
  narrativeContent: '',
  venueName: '',
  venueShortName: '',
  venueAddress: '',
  venueFullAddress: '',
  venueDescription: '',
  venueMapEmbedUrl: '',
  contactEmail: '',
  countdownEnabled: false,
  countdownTargetDate: '',
};

// --- Section Component ---

function SectionCard({
  title,
  description,
  children,
  defaultOpen = true,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50/50 transition-colors rounded-t-lg"
      >
        <div>
          <h3 className="text-sm font-semibold text-charcoal-ink">{title}</h3>
          {description && (
            <p className="text-xs text-gray-400 mt-0.5">{description}</p>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>
      {open && <div className="px-6 pb-6 pt-2">{children}</div>}
    </div>
  );
}

function FormField({
  label,
  htmlFor,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className || ''}`}>
      <Label htmlFor={htmlFor} className="text-sm font-medium text-charcoal-ink">
        {label}
      </Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function CMSSettings() {
  const authUser = useCMSStore((s) => s.authUser);
  const selectedTenantId = useCMSStore((s) => s.selectedTenantId);
  const setSelectedTenantId = useCMSStore((s) => s.setSelectedTenantId);

  const [tenants, setTenants] = useState<TenantBasic[]>([]);
  const [tenantName, setTenantName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenantsLoading, setTenantsLoading] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues,
  });

  const countdownEnabled = watch('countdownEnabled');

  const authHeaders = {
    'Content-Type': 'application/json',
  };

  // Fetch tenants list if no selected tenant
  useEffect(() => {
    if (selectedTenantId) return;
    const fetchTenants = async () => {
      setTenantsLoading(true);
      try {
        const res = await fetch('/api/cms/tenants?limit=100');
        const data = await res.json();
        if (data.success) {
          setTenants(data.data.tenants || []);
        }
      } catch {
        // silently handle
      } finally {
        setTenantsLoading(false);
      }
    };
    fetchTenants();
  }, [selectedTenantId]);

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    if (!selectedTenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/cms/tenants/${selectedTenantId}/settings`);
      const data = await res.json();
      if (data.success && data.data) {
        const s = data.data;
        reset({
          coupleName1: s.coupleName1 || '',
          coupleName2: s.coupleName2 || '',
          eventDate: s.eventDate ? s.eventDate.slice(0, 10) : '',
          venue: s.venue || '',
          tagline: s.tagline || '',
          dateDisplay: s.dateDisplay || '',
          teaCeremonyTitle: s.teaCeremonyTitle || '',
          teaCeremonySubtitle: s.teaCeremonySubtitle || '',
          narrativeTitle: s.narrativeTitle || '',
          narrativeSubtitle: s.narrativeSubtitle || '',
          narrativeContent: s.narrativeContent || '',
          venueName: s.venueName || '',
          venueShortName: s.venueShortName || '',
          venueAddress: s.venueAddress || '',
          venueFullAddress: s.venueFullAddress || '',
          venueDescription: s.venueDescription || '',
          venueMapEmbedUrl: s.venueMapEmbedUrl || '',
          contactEmail: s.contactEmail || '',
          countdownEnabled: s.countdownEnabled || false,
          countdownTargetDate: s.countdownTargetDate ? s.countdownTargetDate.slice(0, 10) : '',
        });
        if (s.tenantName) setTenantName(s.tenantName);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [selectedTenantId, reset]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const onSubmit = async (values: SettingsFormValues) => {
    if (!selectedTenantId) {
      toast.error('Please select a tenant first');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/cms/tenants/${selectedTenantId}/settings`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Settings saved successfully');
      } else {
        toast.error(data.error || 'Failed to save settings');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  // No tenant selected — show tenant picker
  if (!selectedTenantId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-charcoal-ink">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Select a tenant to manage its settings.
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <Label className="text-sm font-medium text-charcoal-ink">Select Tenant</Label>
          {tenantsLoading ? (
            <Skeleton className="h-9 w-full mt-2" />
          ) : (
            <Select onValueChange={(val) => setSelectedTenantId(val)}>
              <SelectTrigger className="mt-2 h-9 border-gray-300">
                <SelectValue placeholder="Choose a tenant..." />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-charcoal-ink">Settings</h1>
        {tenantName && (
          <p className="text-sm text-gray-500 mt-1">{tenantName}</p>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
              <Skeleton className="h-5 w-32" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Event Details */}
          <SectionCard title="Event Details" description="Basic event information">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Partner 1" htmlFor="coupleName1" error={errors.coupleName1?.message}>
                <Input id="coupleName1" {...register('coupleName1')} className="h-9 border-gray-300" placeholder="Eleanor" />
              </FormField>
              <FormField label="Partner 2" htmlFor="coupleName2" error={errors.coupleName2?.message}>
                <Input id="coupleName2" {...register('coupleName2')} className="h-9 border-gray-300" placeholder="James" />
              </FormField>
              <FormField label="Event Date" htmlFor="eventDate">
                <Input id="eventDate" type="date" {...register('eventDate')} className="h-9 border-gray-300" />
              </FormField>
              <FormField label="Venue" htmlFor="venue">
                <Input id="venue" {...register('venue')} className="h-9 border-gray-300" placeholder="Grand Ballroom" />
              </FormField>
            </div>
          </SectionCard>

          {/* Hero Section */}
          <SectionCard title="Hero Section" description="Main banner text and narrative">
            <div className="space-y-4">
              <FormField label="Tagline" htmlFor="tagline">
                <Textarea id="tagline" {...register('tagline')} className="border-gray-300 min-h-[60px]" placeholder="A love story written in the stars..." />
              </FormField>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Date Display" htmlFor="dateDisplay">
                  <Input id="dateDisplay" {...register('dateDisplay')} className="h-9 border-gray-300" placeholder="March 15, 2025" />
                </FormField>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Ceremony Section Title" htmlFor="teaCeremonyTitle">
                  <Input id="teaCeremonyTitle" {...register('teaCeremonyTitle')} className="h-9 border-gray-300" />
                </FormField>
                <FormField label="Ceremony Section Subtitle" htmlFor="teaCeremonySubtitle">
                  <Input id="teaCeremonySubtitle" {...register('teaCeremonySubtitle')} className="h-9 border-gray-300" />
                </FormField>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Narrative Title" htmlFor="narrativeTitle">
                  <Input id="narrativeTitle" {...register('narrativeTitle')} className="h-9 border-gray-300" />
                </FormField>
                <FormField label="Narrative Subtitle" htmlFor="narrativeSubtitle">
                  <Input id="narrativeSubtitle" {...register('narrativeSubtitle')} className="h-9 border-gray-300" />
                </FormField>
              </div>
              <FormField label="Narrative Content" htmlFor="narrativeContent">
                <Textarea id="narrativeContent" {...register('narrativeContent')} className="border-gray-300 min-h-[100px]" placeholder="Their story began..." />
              </FormField>
            </div>
          </SectionCard>

          {/* Venue */}
          <SectionCard title="Venue" description="Venue details and map">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Venue Name" htmlFor="venueName">
                  <Input id="venueName" {...register('venueName')} className="h-9 border-gray-300" />
                </FormField>
                <FormField label="Short Name" htmlFor="venueShortName">
                  <Input id="venueShortName" {...register('venueShortName')} className="h-9 border-gray-300" />
                </FormField>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Address" htmlFor="venueAddress">
                  <Input id="venueAddress" {...register('venueAddress')} className="h-9 border-gray-300" />
                </FormField>
                <FormField label="Full Address" htmlFor="venueFullAddress">
                  <Input id="venueFullAddress" {...register('venueFullAddress')} className="h-9 border-gray-300" />
                </FormField>
              </div>
              <FormField label="Description" htmlFor="venueDescription">
                <Textarea id="venueDescription" {...register('venueDescription')} className="border-gray-300 min-h-[60px]" />
              </FormField>
              <FormField label="Map Embed URL" htmlFor="venueMapEmbedUrl">
                <Input id="venueMapEmbedUrl" {...register('venueMapEmbedUrl')} className="h-9 border-gray-300" placeholder="https://maps.google.com/..." />
              </FormField>
            </div>
          </SectionCard>

          {/* Contact */}
          <SectionCard title="Contact" description="Contact information for guests">
            <FormField label="Email" htmlFor="contactEmail" error={errors.contactEmail?.message}>
              <Input id="contactEmail" type="email" {...register('contactEmail')} className="h-9 border-gray-300 max-w-md" placeholder="rsvp@example.com" />
            </FormField>
          </SectionCard>

          {/* Countdown */}
          <SectionCard title="Countdown" description="Countdown timer configuration">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch
                  checked={countdownEnabled}
                  onCheckedChange={(checked) => setValue('countdownEnabled', checked)}
                />
                <Label className="text-sm font-medium text-charcoal-ink">Enable Countdown</Label>
              </div>
              {countdownEnabled && (
                <FormField label="Target Date" htmlFor="countdownTargetDate">
                  <Input id="countdownTargetDate" type="date" {...register('countdownTargetDate')} className="h-9 border-gray-300 max-w-xs" />
                </FormField>
              )}
            </div>
          </SectionCard>

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={saving}
              className="bg-charcoal-ink text-white hover:bg-charcoal-ink/90 h-9"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              Save Settings
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}