'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Palette, Star, Eye, Pencil, Save, RotateCcw, Loader2, RefreshCw,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Check } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

// WeddingTemplate type + DEFAULT_TEMPLATES are imported from the shared
// single-source-of-truth file so the Admin CMS and the Couple CMS API
// always show identical palettes.
import { type WeddingTemplate, DEFAULT_TEMPLATES } from '@/lib/wedding-templates';

const COLOR_LABELS: Record<keyof WeddingTemplate['colors'], string> = {
  bg: 'Background',
  text: 'Text',
  accent: 'Accent',
  secondary: 'Secondary',
  muted: 'Muted',
};

const TEMPLATE_FONT_OPTIONS = [
  { value: 'Playfair Display', category: 'Elegant Serif' },
  { value: 'Cormorant Garamond', category: 'Elegant Serif' },
  { value: 'EB Garamond', category: 'Elegant Serif' },
  { value: 'Lora', category: 'Elegant Serif' },
  { value: 'Spectral', category: 'Elegant Serif' },
  { value: 'Libre Baskerville', category: 'Elegant Serif' },
  { value: 'Merriweather', category: 'Elegant Serif' },
  { value: 'DM Serif Display', category: 'Elegant Serif' },
  { value: 'Bodoni Moda', category: 'Elegant Serif' },
  { value: 'Cinzel', category: 'Display Serif' },
  { value: 'Cinzel Decorative', category: 'Display Serif' },
  { value: 'Prata', category: 'Display Serif' },
  { value: 'Italiana', category: 'Display Serif' },
  { value: 'Montserrat', category: 'Modern Sans' },
  { value: 'Raleway', category: 'Modern Sans' },
  { value: 'Poppins', category: 'Modern Sans' },
  { value: 'Lato', category: 'Modern Sans' },
  { value: 'Quicksand', category: 'Modern Sans' },
  { value: 'Nunito', category: 'Modern Sans' },
  { value: 'Work Sans', category: 'Modern Sans' },
  { value: 'Great Vibes', category: 'Script & Calligraphy' },
  { value: 'Alex Brush', category: 'Script & Calligraphy' },
  { value: 'Allura', category: 'Script & Calligraphy' },
  { value: 'Parisienne', category: 'Script & Calligraphy' },
  { value: 'Sacramento', category: 'Script & Calligraphy' },
  { value: 'Dancing Script', category: 'Handwritten' },
  { value: 'Kaushan Script', category: 'Handwritten' },
  { value: 'Caveat', category: 'Handwritten' },
  { value: 'Amatic SC', category: 'Handwritten' },
  { value: 'Satisfy', category: 'Handwritten' },
  { value: 'Pacifico', category: 'Handwritten' },
  { value: 'Lobster', category: 'Handwritten' },
  { value: 'Inter', category: 'Modern Sans' },
  { value: 'Josefin Sans', category: 'Modern Sans' },
];

const FONT_CATEGORIES = [...new Set(TEMPLATE_FONT_OPTIONS.map((f) => f.category))];

// ── API helpers ────────────────────────────────────────────────────────────

async function loadSettings(): Promise<Record<string, string>> {
  const res = await fetch('/api/master/settings?XTransformPort=3000');
  if (!res.ok) throw new Error(`Failed to load settings (${res.status})`);
  const json = await res.json();
  return json.settings || {};
}

async function saveSettings(settings: Record<string, string>): Promise<void> {
  const res = await fetch('/api/master/settings?XTransformPort=3000', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings }),
  });
  if (!res.ok) throw new Error(`Save failed (${res.status})`);
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ColorSwatch({ color, label }: { color: string; label?: string }) {
  const isLight = isLightColor(color);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="w-10 h-10 rounded-lg border border-slate-200 shadow-sm transition-transform hover:scale-110 cursor-default"
        style={{ backgroundColor: color }}
        title={label ? `${label}: ${color}` : color}
      />
      {label && (
        <span
          className="text-[10px] leading-tight font-medium max-w-[56px] text-center"
          style={{ color: isLight ? '#64748B' : '#94A3B8' }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

function TemplateCardSkeleton() {
  return (
    <Card className="border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="w-10 h-10 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <Skeleton className="h-5 w-20" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Edit Dialog ────────────────────────────────────────────────────────────

function EditTemplateDialog({
  template,
  open,
  onOpenChange,
  onSave,
}: {
  template: WeddingTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updated: WeddingTemplate) => void;
}) {
  const [editing, setEditing] = useState<WeddingTemplate>(template);

  const updateColor = (key: keyof WeddingTemplate['colors'], value: string) => {
    setEditing((prev) => ({
      ...prev,
      colors: { ...prev.colors, [key]: value },
    }));
  };

  const updateFont = (key: keyof WeddingTemplate['fonts'], value: string) => {
    setEditing((prev) => ({
      ...prev,
      fonts: { ...prev.fonts, [key]: value },
    }));
  };

  const handleSave = () => {
    onSave(editing);
    onOpenChange(false);
  };

  const colorEntries = Object.entries(editing.colors) as [keyof WeddingTemplate['colors'], string][];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Edit Template</DialogTitle>
          <DialogDescription className="text-slate-500">
            Customize colors and fonts for {template.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
          {/* Colors */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700">Colors</h4>
            {colorEntries.map(([key, value]) => (
              <div key={key} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-md border border-slate-200 shrink-0"
                  style={{ backgroundColor: value }}
                />
                <Label className="text-sm text-slate-600 w-20 shrink-0">{COLOR_LABELS[key]}</Label>
                <Input
                  value={value}
                  onChange={(e) => updateColor(key, e.target.value)}
                  className="flex-1 font-mono text-sm h-8"
                  maxLength={7}
                />
                <input
                  type="color"
                  value={value}
                  onChange={(e) => updateColor(key, e.target.value)}
                  className="w-8 h-8 cursor-pointer rounded border border-slate-200 shrink-0"
                />
              </div>
            ))}
          </div>

          {/* Fonts */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700">Fonts</h4>
            <div className="space-y-3">
              {(['heading', 'body'] as const).map((key) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-sm text-slate-600">{key === 'heading' ? 'Heading' : 'Body'}</Label>
                  <div
                    className="max-h-[140px] overflow-y-auto rounded-lg border border-slate-200 bg-white"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: '#D4AF37 transparent' }}
                  >
                    {FONT_CATEGORIES.map((category) => (
                      <div key={category}>
                        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm px-2.5 py-1">
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">{category}</span>
                        </div>
                        {TEMPLATE_FONT_OPTIONS
                          .filter((f) => f.category === category)
                          .map((font) => {
                            const isSelected = editing.fonts[key] === font.value;
                            return (
                              <button
                                key={font.value}
                                type="button"
                                onClick={() => updateFont(key, font.value)}
                                className={`w-full text-left transition-colors duration-150 ${
                                  isSelected
                                    ? 'bg-slate-100 border-l-2 border-slate-800'
                                    : 'border-l-2 border-transparent hover:bg-slate-50'
                                }`}
                              >
                                <div className="px-2.5 py-1.5">
                                  <p
                                    className="text-sm text-slate-800 leading-snug truncate"
                                    style={{ fontFamily: `'${font.value}', serif` }}
                                  >
                                    Wedding Title
                                  </p>
                                  <div className="flex items-center justify-between mt-0.5">
                                    <span className={`text-[10px] ${isSelected ? 'text-slate-700 font-semibold' : 'text-slate-400'}`}>
                                      {font.value}
                                    </span>
                                    {isSelected && <Check className="size-3 text-slate-700" strokeWidth={3} />}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Mini Preview */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-700">Preview</h4>
            <div
              className="rounded-lg border border-slate-200 p-4 space-y-2"
              style={{ backgroundColor: editing.colors.bg }}
            >
              <p style={{ color: editing.colors.text, fontFamily: editing.fonts.heading, fontSize: '18px', fontWeight: 600 }}>
                Wedding Title
              </p>
              <p style={{ color: editing.colors.muted, fontFamily: editing.fonts.body, fontSize: '13px' }}>
                A beautiful celebration of love and togetherness
              </p>
              <div className="flex gap-2 pt-1">
                <span
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{ backgroundColor: editing.colors.accent, color: editing.colors.bg }}
                >
                  RSVP
                </span>
                <span
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{ backgroundColor: editing.colors.secondary, color: editing.colors.bg }}
                >
                  Details
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-200">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-charcoal-ink text-paper-cream hover:opacity-90 transition-opacity"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Preview Dialog (mockup) ────────────────────────────────────────────────

function PreviewTemplateDialog({
  template,
  open,
  onOpenChange,
}: {
  template: WeddingTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const c = template.colors;
  const isLight = isLightColor(c.bg);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden" showCloseButton={false}>
        {/* Mock phone frame */}
        <div className="flex flex-col h-[560px]">
          {/* Browser bar */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 bg-slate-50 shrink-0">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 mx-4">
              <div className="bg-white rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-400 text-center">
                dreamweavers.sg/wedding-preview
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onOpenChange(false)}>
              <span className="sr-only">Close</span>
              ✕
            </Button>
          </div>

          {/* Mock site content */}
          <div
            className="flex-1 overflow-y-auto"
            style={{ backgroundColor: c.bg }}
          >
            <div className="px-6 py-10 space-y-8 max-w-md mx-auto">
              {/* Header */}
              <div className="text-center space-y-3">
                <div
                  className="inline-block w-12 h-px mb-2"
                  style={{ backgroundColor: c.accent }}
                />
                <p
                  className="text-xs tracking-[0.3em] uppercase font-medium"
                  style={{ color: c.muted }}
                >
                  We're getting married
                </p>
                <h2
                  className="text-3xl font-semibold leading-tight"
                  style={{ color: c.text, fontFamily: template.fonts.heading }}
                >
                  Sarah & James
                </h2>
                <div
                  className="inline-block w-12 h-px mt-2"
                  style={{ backgroundColor: c.accent }}
                />
              </div>

              {/* Date card */}
              <div
                className="rounded-xl p-5 text-center"
                style={{ backgroundColor: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.08)' }}
              >
                <p className="text-4xl font-bold" style={{ color: c.accent, fontFamily: template.fonts.heading }}>
                  14
                </p>
                <p className="text-sm font-medium mt-1" style={{ color: c.text }}>
                  February 2027
                </p>
                <p className="text-xs mt-0.5" style={{ color: c.muted, fontFamily: template.fonts.body }}>
                  Singapore
                </p>
              </div>

              {/* Navigation pills */}
              <div className="flex justify-center gap-2">
                {['Home', 'Schedule', 'RSVP', 'Story'].map((item) => (
                  <span
                    key={item}
                    className="px-3 py-1.5 rounded-full text-xs font-medium cursor-default"
                    style={{
                      backgroundColor: item === 'Home' ? c.accent : 'transparent',
                      color: item === 'Home' ? (isLightColor(c.accent) ? c.text : '#FFFFFF') : c.muted,
                      border: `1px solid ${item === 'Home' ? c.accent : c.muted}`,
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>

              {/* Content blocks */}
              <div className="space-y-4">
                <div
                  className="rounded-lg p-4"
                  style={{ backgroundColor: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.08)' }}
                >
                  <h3
                    className="text-sm font-semibold mb-2"
                    style={{ color: c.text, fontFamily: template.fonts.heading }}
                  >
                    Our Love Story
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: c.muted, fontFamily: template.fonts.body }}>
                    From a chance encounter at a cozy bookshop to this beautiful day,
                    our journey has been nothing short of magical...
                  </p>
                </div>

                <div
                  className="rounded-lg p-4"
                  style={{ backgroundColor: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.08)' }}
                >
                  <h3
                    className="text-sm font-semibold mb-2"
                    style={{ color: c.text, fontFamily: template.fonts.heading }}
                  >
                    Event Details
                  </h3>
                  <div className="space-y-2">
                    {['Ceremony · 10:00 AM', 'Reception · 6:00 PM'].map((line) => (
                      <p key={line} className="text-xs" style={{ color: c.muted, fontFamily: template.fonts.body }}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              {/* CTA Button */}
              <div className="text-center pt-2">
                <button
                  className="px-8 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{ backgroundColor: c.accent, color: isLightColor(c.accent) ? c.text : '#FFFFFF' }}
                >
                  RSVP Now
                </button>
              </div>

              {/* Footer */}
              <div className="text-center pt-4 border-t" style={{ borderColor: c.muted + '40' }}>
                <p className="text-xs" style={{ color: c.muted }}>
                  Made with love · Dreamweavers
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Expanded Preview (color labels) ────────────────────────────────────────

function ExpandedPreview({
  template,
  open,
  onOpenChange,
}: {
  template: WeddingTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const colorEntries = Object.entries(template.colors) as [keyof WeddingTemplate['colors'], string][];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-900">{template.name}</DialogTitle>
          <DialogDescription className="text-slate-500">{template.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Large color swatches with labels */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-700">Color Palette</h4>
            <div className="grid grid-cols-5 gap-3">
              {colorEntries.map(([key, value]) => {
                const light = isLightColor(value);
                return (
                  <div key={key} className="flex flex-col items-center gap-1.5">
                    <div
                      className="w-full aspect-square rounded-lg border border-slate-200 shadow-sm flex items-center justify-center"
                      style={{ backgroundColor: value }}
                    >
                      <span
                        className="text-[9px] font-mono font-medium opacity-80"
                        style={{ color: light ? '#374151' : '#F9FAFB' }}
                      >
                        {value}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-600 font-medium text-center">
                      {COLOR_LABELS[key]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Font pairing */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-700">Font Pairing</h4>
            <div className="flex gap-4 p-3 bg-slate-50 rounded-lg">
              <div className="flex-1">
                <p className="text-xs text-slate-400 mb-1">Heading</p>
                <p className="text-sm font-semibold text-slate-800" style={{ fontFamily: template.fonts.heading }}>
                  {template.fonts.heading}
                </p>
              </div>
              <div className="w-px bg-slate-200" />
              <div className="flex-1">
                <p className="text-xs text-slate-400 mb-1">Body</p>
                <p className="text-sm text-slate-600" style={{ fontFamily: template.fonts.body }}>
                  {template.fonts.body}
                </p>
              </div>
            </div>
          </div>

          {/* Mini preview strip */}
          <div
            className="rounded-lg border border-slate-200 p-4 space-y-2"
            style={{ backgroundColor: template.colors.bg }}
          >
            <p style={{ color: template.colors.text, fontFamily: template.fonts.heading, fontSize: '16px', fontWeight: 600 }}>
              Sarah & James
            </p>
            <p style={{ color: template.colors.muted, fontFamily: template.fonts.body, fontSize: '12px' }}>
              A beautiful celebration of love
            </p>
            <div className="flex gap-2 pt-1">
              <span
                className="px-2.5 py-0.5 rounded-full text-[10px] font-medium"
                style={{ backgroundColor: template.colors.accent, color: isLightColor(template.colors.accent) ? template.colors.text : '#fff' }}
              >
                Primary
              </span>
              <span
                className="px-2.5 py-0.5 rounded-full text-[10px] font-medium"
                style={{ backgroundColor: template.colors.secondary, color: isLightColor(template.colors.secondary) ? template.colors.text : '#fff' }}
              >
                Secondary
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-200">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function MasterTemplates() {
  const [templates, setTemplates] = useState<WeddingTemplate[]>(DEFAULT_TEMPLATES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Dialog states
  const [editTemplate, setEditTemplate] = useState<WeddingTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<WeddingTemplate | null>(null);
  const [expandedTemplate, setExpandedTemplate] = useState<WeddingTemplate | null>(null);

  // "Apply Default to All Couples" bulk action state
  const [confirmApplyDefault, setConfirmApplyDefault] = useState(false);
  const [applyingDefault, setApplyingDefault] = useState(false);

  // Load persisted templates from SystemSetting
  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const settings = await loadSettings();
      const defaultId = settings['default_template'] || 'classic-elegance';

      // Rebuild templates from defaults + any persisted overrides
      const rebuilt: WeddingTemplate[] = DEFAULT_TEMPLATES.map((def) => {
        const stored = settings[`template_${def.id}`];
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            return {
              ...def,
              ...parsed,
              isDefault: def.id === defaultId,
            };
          } catch {
            return { ...def, isDefault: def.id === defaultId };
          }
        }
        return { ...def, isDefault: def.id === defaultId };
      });

      setTemplates(rebuilt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Persist a single template to SystemSetting
  const persistTemplate = async (t: WeddingTemplate) => {
    const { isDefault, ...data } = t;
    await saveSettings({ [`template_${t.id}`]: JSON.stringify(data) });
  };

  // Toggle active state
  const handleToggleActive = async (id: string) => {
    const updated = templates.map((t) =>
      t.id === id ? { ...t, isActive: !t.isActive } : t
    );
    setTemplates(updated);
    try {
      const target = updated.find((t) => t.id === id);
      if (target) await persistTemplate(target);
      toast({ title: 'Success', description: `${target?.name} ${target?.isActive ? 'enabled' : 'disabled'}` });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update template', variant: 'destructive' });
      setTemplates(templates);
    }
  };

  // Set as default
  const handleSetDefault = async (id: string) => {
    const updated = templates.map((t) => ({ ...t, isDefault: t.id === id }));
    setTemplates(updated);
    try {
      await saveSettings({ default_template: id });
      const name = templates.find((t) => t.id === id)?.name;
      toast({ title: 'Success', description: `${name} set as default template` });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to set default template', variant: 'destructive' });
      setTemplates(templates);
    }
  };

  // Save edited template
  const handleSaveEdit = async (updated: WeddingTemplate) => {
    const newTemplates = templates.map((t) => (t.id === updated.id ? updated : t));
    setTemplates(newTemplates);
    try {
      setSaving(true);
      await persistTemplate(updated);
      toast({ title: 'Success', description: `${updated.name} updated successfully` });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save template changes', variant: 'destructive' });
      setTemplates(templates);
    } finally {
      setSaving(false);
    }
  };

  // Reset template to defaults
  const handleReset = async (id: string) => {
    const def = DEFAULT_TEMPLATES.find((t) => t.id === id);
    if (!def) return;
    const newTemplates = templates.map((t) => (t.id === id ? { ...def, isDefault: t.isDefault } : t));
    setTemplates(newTemplates);
    try {
      await persistTemplate({ ...def, isDefault: newTemplates.find((t) => t.id === id)?.isDefault ?? false });
      toast({ title: 'Success', description: `${def.name} reset to defaults` });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to reset template', variant: 'destructive' });
      setTemplates(templates);
    }
  };

  // Bulk-apply the global default template to every wedding whose
  // `themeCustomized` flag is still false. Couples who have customized their
  // theme are protected server-side.
  const handleApplyDefault = async () => {
    setApplyingDefault(true);
    try {
      const res = await fetch('/api/master/templates/apply-default?XTransformPort=3000', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      toast({
        title: 'Default Theme Applied',
        description: `Updated ${data.updatedCount} ${
          data.updatedCount === 1 ? 'couple' : 'couples'
        } to ${data.templateName}.`,
      });
      setConfirmApplyDefault(false);
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to apply default theme',
        variant: 'destructive',
      });
    } finally {
      setApplyingDefault(false);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <p className="text-sm font-medium text-red-500">Error loading templates</p>
        <p className="text-xs mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Content Templates</h2>
          <p className="text-slate-500 mt-1">
            Manage wedding site themes and color palettes
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Palette className="h-4 w-4" />
          <span>{templates.filter((t) => t.isActive).length} of {templates.length} active</span>
        </div>
      </div>

      {/* Bulk action: Apply default template to all non-customized couples */}
      <div className="flex items-center justify-between flex-wrap gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <RefreshCw className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Apply Default to All Couples</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Overwrite the theme colors and fonts for every couple who hasn&apos;t customized their own.
              Couples with a customized theme are protected.
            </p>
          </div>
        </div>
        <Button
          onClick={() => setConfirmApplyDefault(true)}
          disabled={applyingDefault || loading}
          className="bg-charcoal-ink text-paper-cream hover:opacity-90 transition-opacity"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Apply Default to All Couples
        </Button>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <TemplateCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Card
              key={template.id}
              className={`border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden transition-all hover:shadow-md cursor-pointer group ${
                !template.isActive ? 'opacity-60' : ''
              }`}
              onClick={() => setExpandedTemplate(template)}
            >
              <CardContent className="p-5 space-y-4">
                {/* Top row: Name + Badge */}
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-slate-900 truncate group-hover:text-slate-700 transition-colors">
                    {template.name}
                  </h3>
                  {template.isDefault && (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 shrink-0">
                      <Star className="h-3 w-3 mr-1" />
                      Default
                    </Badge>
                  )}
                </div>

                {/* Color swatches */}
                <div className="flex gap-2">
                  {Object.values(template.colors).map((color, i) => (
                    <ColorSwatch key={i} color={color} />
                  ))}
                </div>

                {/* Description */}
                <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">
                  {template.description}
                </p>

                {/* Font info */}
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="font-medium">{template.fonts.heading}</span>
                  <span className="text-slate-300">/</span>
                  <span>{template.fonts.body}</span>
                </div>

                {/* Actions row */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={template.isActive}
                      onCheckedChange={() => handleToggleActive(template.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-xs text-slate-500">
                      {template.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {!template.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-slate-500 hover:text-amber-700 hover:bg-amber-50"
                        onClick={() => handleSetDefault(template.id)}
                        title="Set as default"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-slate-500 hover:text-slate-700"
                      onClick={() => setPreviewTemplate(template)}
                      title="Preview guest site"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-slate-500 hover:text-slate-700"
                      onClick={() => setEditTemplate(template)}
                      title="Edit template"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-slate-500 hover:text-slate-700"
                      onClick={() => handleReset(template.id)}
                      title="Reset to defaults"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info note */}
      {!loading && (
        <p className="text-xs text-slate-400 text-center">
          Click any template card to view its full color palette and font details.
          Templates are persisted via System Settings.
        </p>
      )}

      {/* Edit Dialog */}
      {editTemplate && (
        <EditTemplateDialog
          template={editTemplate}
          open={!!editTemplate}
          onOpenChange={(open) => { if (!open) setEditTemplate(null); }}
          onSave={handleSaveEdit}
        />
      )}

      {/* Preview Dialog */}
      {previewTemplate && (
        <PreviewTemplateDialog
          template={previewTemplate}
          open={!!previewTemplate}
          onOpenChange={(open) => { if (!open) setPreviewTemplate(null); }}
        />
      )}

      {/* Expanded Preview Dialog */}
      {expandedTemplate && (
        <ExpandedPreview
          template={expandedTemplate}
          open={!!expandedTemplate}
          onOpenChange={(open) => { if (!open) setExpandedTemplate(null); }}
        />
      )}

      {/* Apply Default to All Couples — confirmation dialog */}
      <Dialog open={confirmApplyDefault} onOpenChange={(open) => { if (!applyingDefault) setConfirmApplyDefault(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Apply Default to All Couples?</DialogTitle>
            <DialogDescription className="text-slate-500">
              This will update the theme colors and fonts for all couples who haven&apos;t
              customized their own theme. Continue?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800">
            Couples who have applied their own template or edited colors via the
            Design page will be skipped (their <span className="font-mono">themeCustomized</span> flag is true).
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmApplyDefault(false)}
              disabled={applyingDefault}
              className="border-slate-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApplyDefault}
              disabled={applyingDefault}
              className="bg-charcoal-ink text-paper-cream hover:opacity-90 transition-opacity"
            >
              {applyingDefault ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Applying…
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Apply to All
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}