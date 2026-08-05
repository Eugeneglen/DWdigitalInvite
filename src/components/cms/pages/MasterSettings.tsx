'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Save, GripVertical, Plus, Trash2, ChevronUp, ChevronDown, FileText, Palette, Mail, Send, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { invalidateSiteSettingsCache } from '@/hooks/useSiteSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// ── Types ──────────────────────────────────────────────────────────────────

interface SettingsKV {
  [key: string]: string;
}

interface TabItem {
  id: string;
  label: string;
  section: string;
  enabled: boolean;
}

// ── Section type (matches useNavigationStore) ──────────────────────────────

const ALL_SECTIONS: { value: string; label: string }[] = [
  { value: 'home', label: 'Home' },
  { value: 'schedule', label: 'Schedule' },
  { value: 'rsvp', label: 'RSVP' },
  { value: 'getting-there', label: 'Getting There' },
  { value: 'story', label: 'Story' },
  { value: 'wishes', label: 'Wishes' },
  { value: 'qa', label: 'Q&A' },
  { value: 'moments', label: 'Moments' },
];

const DEFAULT_TABS: TabItem[] = [
  { id: 'home', label: 'Home', section: 'home', enabled: true },
  { id: 'schedule', label: 'Schedule', section: 'schedule', enabled: true },
  { id: 'rsvp', label: 'RSVP', section: 'rsvp', enabled: true },
  { id: 'getting-there', label: 'Getting There', section: 'getting-there', enabled: true },
  { id: 'story', label: 'Story', section: 'story', enabled: true },
  { id: 'wishes', label: 'Wishes', section: 'wishes', enabled: true },
  { id: 'qa', label: 'Q&A', section: 'qa', enabled: true },
  { id: 'moments', label: 'Moments', section: 'moments', enabled: true },
];

// ── Setting Definitions ────────────────────────────────────────────────────

interface SettingField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'select' | 'switch';
  defaultValue: string;
  options?: string[];
  placeholder?: string;
}

const SETTINGS_SECTIONS: { title: string; description: string; fields: SettingField[] }[] = [
  {
    title: 'Platform Information',
    description: 'General platform identity and contact details',
    fields: [
      { key: 'platform_name', label: 'Platform Name', type: 'text', defaultValue: 'Dreamweavers', placeholder: 'Dreamweavers' },
      { key: 'platform_tagline', label: 'Platform Tagline', type: 'text', defaultValue: '', placeholder: 'Crafting dream weddings' },
      { key: 'admin_email', label: 'Admin Email', type: 'email', defaultValue: '', placeholder: 'admin@dreamweavers.sg' },
      { key: 'support_email', label: 'Support Email', type: 'email', defaultValue: '', placeholder: 'support@dreamweavers.sg' },
    ],
  },
  {
    title: 'Wedding Defaults',
    description: 'Default values for new wedding accounts',
    fields: [
      { key: 'default_wedding_status', label: 'Default Wedding Status', type: 'select', defaultValue: 'DRAFT', options: ['DRAFT', 'ACTIVE'] },
      { key: 'default_plan', label: 'Default Plan', type: 'select', defaultValue: 'GOLD', options: ['GOLD', 'PLATINUM', 'DIAMOND'] },
      { key: 'default_couple_password', label: 'Default Couple Password', type: 'text', defaultValue: 'Couple@123', placeholder: 'Couple@123' },
      { key: 'couple_access_expiry_days', label: 'Couple Access Expiry (days after wedding)', type: 'number', defaultValue: '30', placeholder: '30' },
      { key: 'max_guests_per_wedding', label: 'Max Guests Per Wedding', type: 'number', defaultValue: '500', placeholder: '500' },
      { key: 'max_media_per_wedding', label: 'Max Media Per Wedding', type: 'number', defaultValue: '100', placeholder: '100' },
    ],
  },
  {
    title: 'RSVP Settings',
    description: 'RSVP submission defaults and limits',
    fields: [
      { key: 'rsvp_allow_guest_submissions', label: 'Allow Guest Submissions', type: 'switch', defaultValue: 'true' },
      { key: 'rsvp_default_deadline_days', label: 'Default Deadline (days before wedding)', type: 'number', defaultValue: '7', placeholder: '7' },
    ],
  },
  {
    title: 'Notification Settings',
    description: 'Email notification preferences',
    fields: [
      { key: 'notify_on_rsvp', label: 'Notify on RSVP Submission', type: 'switch', defaultValue: 'true' },
      { key: 'notify_on_wish', label: 'Notify on New Wish', type: 'switch', defaultValue: 'true' },
      { key: 'notify_on_contact', label: 'Notify on Contact Message', type: 'switch', defaultValue: 'true' },
    ],
  },
];

// ── Footer field definitions ───────────────────────────────────────────────

const FOOTER_FIELDS: { key: string; label: string; placeholder: string }[] = [
  {
    key: 'footer_copyright',
    label: 'Footer Copyright',
    placeholder: '© 2026 DREAMWEAVERS DIGITAL HEIRLOOMS. All rights reserved.',
  },
  {
    key: 'footer_privacy_policy',
    label: 'Privacy Policy',
    placeholder: 'Enter your Privacy Policy content here...',
  },
  {
    key: 'footer_data_protection',
    label: 'Data Protection',
    placeholder: 'Enter your Data Protection content here...',
  },
  {
    key: 'footer_terms_of_service',
    label: 'Terms of Service',
    placeholder: 'Enter your Terms of Service content here...',
  },
];

// ── Main Component ─────────────────────────────────────────────────────────

export default function MasterSettings() {
  const [settings, setSettings] = useState<SettingsKV>({});
  const [initialSettings, setInitialSettings] = useState<SettingsKV>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Nav Tabs state ────────────────────────────────────────────────────

  const [tabs, setTabs] = useState<TabItem[]>(DEFAULT_TABS);
  const [initialTabs, setInitialTabs] = useState<TabItem[]>(DEFAULT_TABS);

  // ── Footer collapsible state ──────────────────────────────────────────

  const [footerOpen, setFooterOpen] = useState<Record<string, boolean>>({});

  // ── Email provider config state ──────────────────────────────────────

  interface EmailProviderConfig {
    provider: 'none' | 'resend' | 'sendgrid' | 'ses' | 'postmark' | 'smtp';
    apiKey: string;
    fromEmail: string;
    fromName: string;
    replyTo: string;
  }

  const DEFAULT_EMAIL_CONFIG: EmailProviderConfig = {
    provider: 'none',
    apiKey: '',
    fromEmail: '',
    fromName: 'DreamWeavers',
    replyTo: '',
  };

  const [emailConfig, setEmailConfig] = useState<EmailProviderConfig>(DEFAULT_EMAIL_CONFIG);
  const [initialEmailConfig, setInitialEmailConfig] = useState<EmailProviderConfig>(DEFAULT_EMAIL_CONFIG);
  const [emailConfigLoaded, setEmailConfigLoaded] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  // ── Fetch settings on mount ───────────────────────────────────────────

  useEffect(() => {
    async function fetchSettings() {
      try {
        setLoading(true);
        const res = await fetch('/api/master/settings?XTransformPort=3000');
        if (!res.ok) throw new Error(`Failed to load settings (${res.status})`);
        const json = await res.json();
        const fetched: SettingsKV = json.settings || {};

        // Apply defaults for any missing keys
        const withDefaults: SettingsKV = { ...fetched };
        for (const section of SETTINGS_SECTIONS) {
          for (const field of section.fields) {
            if (!(field.key in withDefaults)) {
              withDefaults[field.key] = field.defaultValue;
            }
          }
        }

        setSettings(withDefaults);
        setInitialSettings({ ...withDefaults });

        // Parse nav tabs
        if (fetched['site_nav_tabs']) {
          try {
            const parsed = JSON.parse(fetched['site_nav_tabs']);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setTabs(parsed);
              setInitialTabs(parsed);
            }
          } catch { /* keep defaults */ }
        }

        // Open footer sections that have content
        const openState: Record<string, boolean> = {};
        for (const f of FOOTER_FIELDS) {
          openState[f.key] = !!fetched[f.key];
        }
        setFooterOpen(openState);

        // Load email provider config
        if (fetched['email_provider_config']) {
          try {
            const parsed = JSON.parse(fetched['email_provider_config']);
            const config: EmailProviderConfig = {
              provider: parsed.provider || 'none',
              apiKey: parsed.apiKey || '',
              fromEmail: parsed.fromEmail || '',
              fromName: parsed.fromName || 'DreamWeavers',
              replyTo: parsed.replyTo || '',
            };
            setEmailConfig(config);
            setInitialEmailConfig(config);
          } catch { /* keep defaults */ }
        }
        setEmailConfigLoaded(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  // ── Dirty check ──────────────────────────────────────────────────────

  const isDirty = useCallback(() => {
    const allKeys = new Set([...Object.keys(initialSettings), ...Object.keys(settings)]);
    for (const k of allKeys) {
      if (String(settings[k] ?? '') !== String(initialSettings[k] ?? '')) return true;
    }
    if (JSON.stringify(tabs) !== JSON.stringify(initialTabs)) return true;
    if (JSON.stringify(emailConfig) !== JSON.stringify(initialEmailConfig)) return true;
    return false;
  }, [settings, initialSettings, tabs, initialTabs, emailConfig, initialEmailConfig]);

  const dirty = !loading && isDirty();
  const changedCount = dirty
    ? Object.keys(initialSettings).filter((k) => String(settings[k] ?? '') !== String(initialSettings[k] ?? '')).length
      + (JSON.stringify(tabs) !== JSON.stringify(initialTabs) ? 1 : 0)
      + (JSON.stringify(emailConfig) !== JSON.stringify(initialEmailConfig) ? 1 : 0)
    : 0;

  // ── Update helpers ───────────────────────────────────────────────────

  const updateField = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  // Tab operations
  const updateTabLabel = (index: number, label: string) => {
    setTabs((prev) => prev.map((t, i) => (i === index ? { ...t, label } : t)));
  };

  const updateTabEnabled = (index: number, enabled: boolean) => {
    setTabs((prev) => prev.map((t, i) => (i === index ? { ...t, enabled } : t)));
  };

  const removeTab = (index: number) => {
    setTabs((prev) => prev.filter((_, i) => i !== index));
  };

  const moveTab = (index: number, direction: 'up' | 'down') => {
    setTabs((prev) => {
      const next = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addTab = (section: string) => {
    const existing = tabs.find((t) => t.section === section);
    if (existing) return; // Already in list

    const sectionLabel = ALL_SECTIONS.find((s) => s.value === section)?.label || section;
    const id = `tab-${Date.now()}`;
    setTabs((prev) => [...prev, { id, label: sectionLabel, section, enabled: true }]);
  };

  // ── Save all ─────────────────────────────────────────────────────────

  const handleSave = async () => {
    try {
      setSaving(true);

      // Combine standard settings with tabs, footer content, and email config
      const allSettings: Record<string, string> = { ...settings };
      allSettings['site_nav_tabs'] = JSON.stringify(tabs);
      allSettings['email_provider_config'] = JSON.stringify(emailConfig);

      const res = await fetch('/api/master/settings?XTransformPort=3000', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: allSettings }),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      const json = await res.json();

      setInitialSettings({ ...allSettings });
      setInitialTabs([...tabs]);
      setInitialEmailConfig({ ...emailConfig });
      invalidateSiteSettingsCache();
      toast({ title: 'Settings Saved', description: `${json.updated} ${json.updated === 1 ? 'value' : 'values'} updated` });
    } catch (err) {
      toast({ title: 'Save Failed', description: err instanceof Error ? err.message : 'Failed to save settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ── Available sections for "Add Tab" ─────────────────────────────────

  const usedSections = new Set(tabs.map((t) => t.section));
  const availableSections = ALL_SECTIONS.filter((s) => !usedSections.has(s.value));

  // ── Error state ──────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <p className="text-sm font-medium text-red-500">Error loading settings</p>
        <p className="text-xs mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Settings</h2>
          <p className="text-slate-500 mt-1">Configure platform settings and preferences</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="bg-charcoal-ink text-paper-cream hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save All Settings'}
          {dirty && !saving && (
            <span className="ml-2 text-xs opacity-70">({changedCount} change{changedCount !== 1 ? 's' : ''})</span>
          )}
        </Button>
      </div>

      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="border-slate-200 rounded-xl bg-white shadow-sm">
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-64 mt-1" />
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-9 w-48" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* ── Standard Settings Sections ─────────────────────────────── */}
          {SETTINGS_SECTIONS.map((section) => (
            <Card key={section.title} className="border-slate-200 rounded-xl bg-white shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-slate-900">{section.title}</CardTitle>
                <p className="text-sm text-slate-400">{section.description}</p>
              </CardHeader>
              <CardContent className="space-y-5">
                {section.fields.map((field) => (
                  <div key={field.key} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <Label htmlFor={field.key} className="text-sm text-slate-700 whitespace-nowrap shrink-0">
                      {field.label}
                    </Label>
                    <div className="w-full max-w-full sm:max-w-sm">
                      {field.type === 'switch' ? (
                        <div className="flex items-center justify-end">
                          <Switch
                            id={field.key}
                            checked={settings[field.key] === 'true'}
                            onCheckedChange={(checked) => updateField(field.key, checked ? 'true' : 'false')}
                          />
                        </div>
                      ) : field.type === 'select' ? (
                        <Select
                          value={settings[field.key] || field.defaultValue}
                          onValueChange={(val) => updateField(field.key, val)}
                        >
                          <SelectTrigger className="w-full" id={field.key}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options?.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id={field.key}
                          type={field.type}
                          value={settings[field.key] ?? ''}
                          onChange={(e) => updateField(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="max-w-full sm:max-w-sm"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          <Separator />

          {/* ── Email Service Configuration ────────────────────────────── */}
          <Card className="border-slate-200 rounded-xl bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Mail className="h-5 w-5 text-slate-400" />
                Email Service
              </CardTitle>
              <p className="text-sm text-slate-400">
                Configure the email provider for onboarding emails, password resets, and notifications. When set to &quot;None&quot;, emails are queued but not sent.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Provider selector */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <Label className="text-sm text-slate-700 whitespace-nowrap shrink-0">
                  Email Provider
                </Label>
                <div className="w-full max-w-full sm:max-w-sm">
                  <Select
                    value={emailConfig.provider}
                    onValueChange={(val) => setEmailConfig(prev => ({ ...prev, provider: val as EmailProviderConfig['provider'] }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Queue Only)</SelectItem>
                      <SelectItem value="resend">Resend</SelectItem>
                      <SelectItem value="sendgrid">SendGrid</SelectItem>
                      <SelectItem value="ses">AWS SES</SelectItem>
                      <SelectItem value="postmark">Postmark</SelectItem>
                      <SelectItem value="smtp">SMTP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* API Key (hidden when provider is 'none') */}
              {emailConfig.provider !== 'none' && (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <Label className="text-sm text-slate-700 whitespace-nowrap shrink-0">
                      API Key
                    </Label>
                    <div className="w-full max-w-full sm:max-w-sm">
                      <Input
                        type="password"
                        autoComplete="off"
                        data-1p-ignore
                        data-lpignore="true"
                        value={emailConfig.apiKey}
                        onChange={(e) => setEmailConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                        placeholder={emailConfig.provider === 'smtp' ? 'SMTP connection string' : 'Enter API key...'}
                        className="max-w-full sm:max-w-sm"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <Label className="text-sm text-slate-700 whitespace-nowrap shrink-0">
                      From Email
                    </Label>
                    <div className="w-full max-w-full sm:max-w-sm">
                      <Input
                        type="email"
                        value={emailConfig.fromEmail}
                        onChange={(e) => setEmailConfig(prev => ({ ...prev, fromEmail: e.target.value }))}
                        placeholder="noreply@dreamweavers.sg"
                        className="max-w-full sm:max-w-sm"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <Label className="text-sm text-slate-700 whitespace-nowrap shrink-0">
                      From Name
                    </Label>
                    <div className="w-full max-w-full sm:max-w-sm">
                      <Input
                        value={emailConfig.fromName}
                        onChange={(e) => setEmailConfig(prev => ({ ...prev, fromName: e.target.value }))}
                        placeholder="DreamWeavers"
                        className="max-w-full sm:max-w-sm"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <Label className="text-sm text-slate-700 whitespace-nowrap shrink-0">
                      Reply-To Email
                    </Label>
                    <div className="w-full max-w-full sm:max-w-sm">
                      <Input
                        type="email"
                        value={emailConfig.replyTo}
                        onChange={(e) => setEmailConfig(prev => ({ ...prev, replyTo: e.target.value }))}
                        placeholder="support@dreamweavers.sg (optional)"
                        className="max-w-full sm:max-w-sm"
                      />
                    </div>
                  </div>

                  {/* Test email button */}
                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          setTestingEmail(true);
                          const res = await fetch('/api/master/settings/test-email?XTransformPort=3000', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ config: emailConfig }),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            toast({ title: 'Test Email Sent', description: 'Check the console log or your inbox.' });
                          } else {
                            toast({ title: 'Test Failed', description: data.error || 'Failed to send test email', variant: 'destructive' });
                          }
                        } catch {
                          toast({ title: 'Test Failed', description: 'Network error', variant: 'destructive' });
                        } finally {
                          setTestingEmail(false);
                        }
                      }}
                      disabled={testingEmail || !emailConfig.apiKey || !emailConfig.fromEmail}
                      className="gap-2"
                    >
                      {testingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Send Test Email
                    </Button>
                    <p className="text-xs text-slate-400">
                      Save settings first, then click to test.
                    </p>
                  </div>
                </>
              )}

              {/* Status indicator */}
              <div className="flex items-center gap-2 pt-1">
                <span className={`size-2 rounded-full ${emailConfig.provider === 'none' ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                <p className="text-xs text-slate-500">
                  {emailConfig.provider === 'none'
                    ? 'Emails are being queued. Configure a provider to start sending.'
                    : `Active: ${emailConfig.provider} — emails will be sent immediately.`}
                </p>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* ── Appearance Defaults (Admin-only) ────────────────────────── */}
          <Card className="border-slate-200 rounded-xl bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Palette className="h-5 w-5 text-slate-400" />
                Appearance
              </CardTitle>
              <p className="text-sm text-slate-400">Platform-wide appearance defaults. These override couple settings.</p>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Header Background Colour */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Header &amp; Footer Background Colour</Label>
                <p className="text-xs text-slate-400">Sets the header AND footer bar background for ALL wedding sites. Leave empty to use the default DW paper-cream (#FCF9F2). This is independent of each couple's page background colour.</p>
                <div className="flex items-center gap-3 mt-1">
                  <div
                    className="relative h-10 w-20 rounded-lg border border-slate-200 overflow-hidden cursor-pointer transition-colors"
                    style={{ backgroundColor: settings['site_header_bg_color'] || '#FCF9F2' }}
                  >
                    <input
                      type="color"
                      value={settings['site_header_bg_color'] || '#FCF9F2'}
                      onChange={(e) => updateField('site_header_bg_color', e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      title="Pick header background colour"
                    />
                  </div>
                  <Input
                    value={settings['site_header_bg_color'] || ''}
                    onChange={(e) => updateField('site_header_bg_color', e.target.value)}
                    placeholder="e.g. #1A1A1A — leave empty to use page bg"
                    className="max-w-xs font-mono text-sm"
                    maxLength={7}
                  />
                  {settings['site_header_bg_color'] && (
                    <button
                      type="button"
                      onClick={() => updateField('site_header_bg_color', '')}
                      className="text-xs text-slate-400 hover:text-red-500 transition-colors whitespace-nowrap"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* ── Header Navigation Tabs ──────────────────────────────────── */}
          <Card className="border-slate-200 rounded-xl bg-white shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-slate-900">Header Navigation</CardTitle>
                  <p className="text-sm text-slate-400 mt-1">Manage the tabs shown on the guest-facing wedding page</p>
                </div>
                {availableSections.length > 0 && (
                  <Select onValueChange={addTab}>
                    <SelectTrigger className="w-[180px] h-8 text-xs">
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      <SelectValue placeholder="Add tab..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSections.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {tabs.map((tab, index) => (
                  <div
                    key={tab.id}
                    className="flex items-center flex-wrap gap-2 p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 bg-slate-50/50 transition-colors group"
                  >
                    {/* Grip handle */}
                    <GripVertical className="h-4 w-4 text-slate-300 shrink-0" />

                    {/* Move up/down */}
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveTab(index, 'up')}
                        className="p-1.5 text-slate-400 hover:text-slate-600 disabled:opacity-20 disabled:hover:text-slate-400 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                        aria-label="Move up"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === tabs.length - 1}
                        onClick={() => moveTab(index, 'down')}
                        className="p-1.5 text-slate-400 hover:text-slate-600 disabled:opacity-20 disabled:hover:text-slate-400 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                        aria-label="Move down"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Section badge */}
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0 uppercase">
                      {tab.section}
                    </span>

                    {/* Label input */}
                    <Input
                      value={tab.label}
                      onChange={(e) => updateTabLabel(index, e.target.value)}
                      className="h-8 text-sm flex-1 min-w-0"
                      placeholder="Tab label"
                    />

                    {/* Enable toggle */}
                    <Switch
                      checked={tab.enabled}
                      onCheckedChange={(checked) => updateTabEnabled(index, checked)}
                      className="shrink-0"
                    />

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => removeTab(index)}
                      className="p-1.5 text-slate-300 hover:text-red-500 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 shrink-0"
                      aria-label="Remove tab"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                {tabs.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-6">
                    No navigation tabs configured. Use &quot;Add tab&quot; to add one.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* ── Footer Content ─────────────────────────────────────────── */}
          <Card className="border-slate-200 rounded-xl bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-slate-400" />
                Footer Content
              </CardTitle>
              <p className="text-sm text-slate-400">Edit the legal documents displayed in the guest site footer</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {FOOTER_FIELDS.map((field) =>
                field.key === 'footer_copyright' ? (
                  /* Copyright — simple input, not collapsible */
                  <div key={field.key} className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">{field.label}</Label>
                    <Input
                      value={settings[field.key] || ''}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      placeholder={field.placeholder}
                    />
                  </div>
                ) : (
                  /* Legal docs — collapsible textareas */
                  <Collapsible
                    key={field.key}
                    open={footerOpen[field.key]}
                    onOpenChange={(open) => setFooterOpen((prev) => ({ ...prev, [field.key]: open }))}
                  >
                    <CollapsibleTrigger className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                      <span className="text-sm font-medium text-slate-700">{field.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">
                          {(settings[field.key]?.length || 0).toLocaleString()} chars
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 text-slate-400 transition-transform ${footerOpen[field.key] ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                      <Textarea
                        value={settings[field.key] || ''}
                        onChange={(e) => updateField(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="min-h-[200px] max-h-[500px] resize-y text-sm leading-relaxed font-mono"
                      />
                    </CollapsibleContent>
                  </Collapsible>
                )
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}