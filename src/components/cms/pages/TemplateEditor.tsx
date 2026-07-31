'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft, Save, Loader2, Home as HomeIcon, Palette, Calendar,
  BookOpen, HelpCircle, MapPin, Camera, MessageSquareHeart,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useCMSStore } from '@/store/useCMSStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

// ── Types ──────────────────────────────────────────────────────────────────

interface ContentItem {
  section: string;
  fieldKey: string;
  fieldValue: string;
  fieldType: string;
}

interface ScheduleItem {
  eventType: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  location: string | null;
  sortOrder: number;
}

interface Theme {
  colors: { bg: string; text: string; accent: string; secondary: string; muted: string };
  fonts: { heading: string; body: string };
}

interface TemplateData {
  id: string;
  name: string;
  description: string | null;
  content: ContentItem[];
  schedule: ScheduleItem[];
  theme: Theme;
}

type Section = 'home' | 'design' | 'schedule';

// ── Field configs (same pattern as couple CMS) ─────────────────────────────

const HOME_FIELDS: { key: string; label: string; type: 'text' | 'textarea'; placeholder?: string }[] = [
  { key: 'title', label: 'Hero Title', type: 'text', placeholder: 'Couple Name' },
  { key: 'subtitle', label: 'Hero Subtitle', type: 'text', placeholder: 'Together with their families...' },
  { key: 'description', label: 'Hero Description', type: 'text', placeholder: 'We invite you to share...' },
  { key: 'dateDisplay', label: 'Date Display', type: 'text', placeholder: 'Saturday, 25th December 2027' },
  { key: 'narrativeLabel', label: 'Narrative Label', type: 'text', placeholder: 'The Prelude' },
  { key: 'narrativeTitle', label: 'Narrative Title', type: 'text', placeholder: 'Our Story Begins Here' },
  { key: 'narrativeBody', label: 'Narrative Body', type: 'textarea', placeholder: 'Every great romance...' },
  { key: 'teaCeremonyLabel', label: 'Tea Ceremony Label', type: 'text', placeholder: 'The Tradition' },
  { key: 'teaCeremonyTitle', label: 'Tea Ceremony Title', type: 'text', placeholder: 'The Tea Ceremony' },
  { key: 'teaCeremonyBody', label: 'Tea Ceremony Body', type: 'textarea', placeholder: 'A sacred tradition...' },
  { key: 'teaCeremonyImage', label: 'Tea Ceremony Image URL', type: 'text', placeholder: '/wedding-images/tea-ceremony.png' },
];

const SCHEDULE_FIELDS: { key: string; label: string; type: 'text' | 'textarea'; placeholder?: string }[] = [
  { key: 'title', label: 'Section Title', type: 'text', placeholder: 'The Day' },
  { key: 'subtitle', label: 'Section Subtitle', type: 'text', placeholder: 'The Celebration' },
];

const EVENT_TYPES = [
  { value: 'TEA_CEREMONY', label: 'Tea Ceremony', color: 'bg-amber-100 text-amber-700' },
  { value: 'CEREMONY', label: 'Ceremony', color: 'bg-blue-100 text-blue-700' },
  { value: 'RECEPTION', label: 'Reception', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'DINNER', label: 'Dinner', color: 'bg-violet-100 text-violet-700' },
  { value: 'CUSTOM', label: 'Custom', color: 'bg-slate-100 text-slate-700' },
];

const PRESET_COLORS = [
  '#FDF8F0', '#FFFFFF', '#FFF0F0', '#0F172A', '#FAF5EF',
  '#F5F5DC', '#F0F8FF', '#FFF8DC', '#F8F4E3', '#FDF2F8',
  '#F0FDF4', '#FFFBEB',
];

const FONTS = [
  'Playfair Display', 'Cormorant Garamond', 'Lora', 'DM Serif Display',
  'Cinzel', 'Prata', 'Spectral', 'Bodoni Moda', 'Italiana',
  'EB Garamond', 'Libre Baskerville', 'Merriweather',
  'Inter', 'Lato', 'Montserrat', 'Raleway', 'Poppins',
  'Nunito', 'Source Sans 3', 'Work Sans', 'Josefin Sans',
  'Quicksand', 'Great Vibes', 'Dancing Script',
];

// ── Main Component ─────────────────────────────────────────────────────────

export default function TemplateEditor() {
  const { editingTemplateId, setPage } = useCMSStore();
  const [data, setData] = useState<TemplateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>('home');
  const [dirty, setDirty] = useState(false);

  // Schedule dialog state
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editingScheduleIdx, setEditingScheduleIdx] = useState<number | null>(null);
  const [scheduleForm, setScheduleForm] = useState<ScheduleItem>({
    eventType: 'CEREMONY', title: '', description: '', startTime: '', endTime: '', location: '', sortOrder: 0,
  });

  const fetchTemplate = useCallback(async () => {
    if (!editingTemplateId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/master/content-templates/${editingTemplateId}?XTransformPort=3000`);
      if (!res.ok) throw new Error('Failed to load template');
      const json = await res.json();
      setData({
        id: json.id,
        name: json.name,
        description: json.description,
        content: json.content,
        schedule: json.schedule,
        theme: json.theme,
      });
    } catch {
      toast({ title: 'Error', description: 'Failed to load template', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [editingTemplateId]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  // ── Content field helpers ──────────────────────────────────────────────

  function getContentField(section: string, fieldKey: string): string {
    const item = data?.content.find((c) => c.section === section && c.fieldKey === fieldKey);
    return item?.fieldValue || '';
  }

  function setContentField(section: string, fieldKey: string, value: string, fieldType: string = 'TEXT') {
    if (!data) return;
    const existing = data.content.find((c) => c.section === section && c.fieldKey === fieldKey);
    if (existing) {
      setData({
        ...data,
        content: data.content.map((c) =>
          c.section === section && c.fieldKey === fieldKey ? { ...c, fieldValue: value } : c,
        ),
      });
    } else {
      setData({
        ...data,
        content: [...data.content, { section, fieldKey, fieldValue: value, fieldType }],
      });
    }
    setDirty(true);
  }

  // ── Schedule helpers ───────────────────────────────────────────────────

  function openAddSchedule() {
    setEditingScheduleIdx(null);
    setScheduleForm({
      eventType: 'CEREMONY', title: '', description: '', startTime: '', endTime: '', location: '', sortOrder: data?.schedule.length || 0,
    });
    setScheduleDialogOpen(true);
  }

  function openEditSchedule(idx: number) {
    const item = data?.schedule[idx];
    if (!item) return;
    setEditingScheduleIdx(idx);
    setScheduleForm({ ...item });
    setScheduleDialogOpen(true);
  }

  function saveSchedule() {
    if (!data) return;
    if (editingScheduleIdx !== null) {
      setData({
        ...data,
        schedule: data.schedule.map((s, i) => (i === editingScheduleIdx ? scheduleForm : s)),
      });
    } else {
      setData({ ...data, schedule: [...data.schedule, scheduleForm] });
    }
    setScheduleDialogOpen(false);
    setDirty(true);
  }

  function deleteSchedule(idx: number) {
    if (!data) return;
    setData({ ...data, schedule: data.schedule.filter((_, i) => i !== idx) });
    setDirty(true);
  }

  // ── Theme helpers ──────────────────────────────────────────────────────

  function updateThemeColor(key: keyof Theme['colors'], value: string) {
    if (!data) return;
    setData({ ...data, theme: { ...data.theme, colors: { ...data.theme.colors, [key]: value } } });
    setDirty(true);
  }

  function updateThemeFont(key: keyof Theme['fonts'], value: string) {
    if (!data) return;
    setData({ ...data, theme: { ...data.theme, fonts: { ...data.theme.fonts, [key]: value } } });
    setDirty(true);
  }

  // ── Save ───────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!data) return;
    try {
      setSaving(true);
      const res = await fetch('/api/master/content-templates?XTransformPort=3000', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: data.id,
          name: data.name,
          description: data.description,
          content: JSON.stringify(data.content),
          schedule: JSON.stringify(data.schedule),
          theme: JSON.stringify(data.theme),
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast({ title: 'Template Saved', description: `${data.name} has been updated.` });
      setDirty(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to save template', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    if (dirty && !confirm('You have unsaved changes. Leave anyway?')) return;
    setPage('templates');
  }

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-cinematic-gold" />
      </div>
    );
  }

  if (!data) {
    return <div className="py-20 text-center text-slate-400">Template not found.</div>;
  }

  const sections: { key: Section; label: string; icon: React.ElementType }[] = [
    { key: 'home', label: 'Home', icon: HomeIcon },
    { key: 'design', label: 'Design', icon: Palette },
    { key: 'schedule', label: 'Schedule', icon: Calendar },
  ];

  return (
    <div className="space-y-6 pb-20">
      {/* Header with Back + Save */}
      <div className="flex items-center justify-between sticky top-0 z-10 bg-white/80 backdrop-blur-md py-3 -mx-4 px-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="size-4 mr-1" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{data.name}</h2>
            <p className="text-xs text-slate-400">Content Template Editor</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={!dirty || saving} className="bg-slate-900 text-white hover:bg-slate-800">
          {saving ? <><Loader2 className="size-4 mr-2 animate-spin" />Saving...</> : <><Save className="size-4 mr-2" />Save Template</>}
        </Button>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                activeSection === s.key
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className="size-4" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* ── HOME SECTION ────────────────────────────────────────────────── */}
      {activeSection === 'home' && (
        <div className="space-y-6 max-w-3xl">
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Hero Content</h3>
              {HOME_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-[11px] tracking-[0.18em] uppercase font-semibold text-charcoal-ink/50">
                    {field.label}
                  </Label>
                  {field.type === 'textarea' ? (
                    <Textarea
                      value={getContentField('hero', field.key)}
                      onChange={(e) => setContentField('hero', field.key, e.target.value, 'RICHTEXT')}
                      placeholder={field.placeholder}
                      className="border-charcoal-ink/10"
                      rows={3}
                    />
                  ) : (
                    <Input
                      value={getContentField('hero', field.key)}
                      onChange={(e) => setContentField('hero', field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="border-charcoal-ink/10"
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Schedule Section Text</h3>
              {SCHEDULE_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-[11px] tracking-[0.18em] uppercase font-semibold text-charcoal-ink/50">
                    {field.label}
                  </Label>
                  <Input
                    value={getContentField('schedule', field.key)}
                    onChange={(e) => setContentField('schedule', field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="border-charcoal-ink/10"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── DESIGN SECTION ──────────────────────────────────────────────── */}
      {activeSection === 'design' && (
        <div className="space-y-6 max-w-3xl">
          {/* Colors */}
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Theme Colors</h3>
              <div className="grid grid-cols-5 gap-4">
                {(['bg', 'text', 'accent', 'secondary', 'muted'] as const).map((key) => (
                  <div key={key} className="space-y-2">
                    <Label className="text-[11px] tracking-[0.18em] uppercase font-semibold text-charcoal-ink/50 capitalize">
                      {key === 'bg' ? 'Background' : key === 'text' ? 'Text' : key}
                    </Label>
                    <input
                      type="color"
                      value={data.theme.colors[key]}
                      onChange={(e) => updateThemeColor(key, e.target.value)}
                      className="w-full h-12 rounded-lg border border-charcoal-ink/10 cursor-pointer"
                    />
                  </div>
                ))}
              </div>
              {/* Preset swatches */}
              <div>
                <Label className="text-[11px] tracking-[0.18em] uppercase font-semibold text-charcoal-ink/50 mb-2 block">
                  Preset Backgrounds
                </Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => updateThemeColor('bg', color)}
                      className="w-8 h-8 rounded-full border-2 border-charcoal-ink/10 hover:border-cinematic-gold transition-colors"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fonts */}
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Typography</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[11px] tracking-[0.18em] uppercase font-semibold text-charcoal-ink/50">
                    Heading Font
                  </Label>
                  <Select value={data.theme.fonts.heading} onValueChange={(v) => updateThemeFont('heading', v)}>
                    <SelectTrigger className="border-charcoal-ink/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {FONTS.map((f) => (
                        <SelectItem key={f} value={f} style={{ fontFamily: `'${f}', serif` }}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-charcoal-ink/60" style={{ fontFamily: `'${data.theme.fonts.heading}', serif`, fontSize: '20px' }}>
                    Eleanor &amp; James
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] tracking-[0.18em] uppercase font-semibold text-charcoal-ink/50">
                    Body Font
                  </Label>
                  <Select value={data.theme.fonts.body} onValueChange={(v) => updateThemeFont('body', v)}>
                    <SelectTrigger className="border-charcoal-ink/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {FONTS.map((f) => (
                        <SelectItem key={f} value={f} style={{ fontFamily: `'${f}', sans-serif` }}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-charcoal-ink/60" style={{ fontFamily: `'${data.theme.fonts.body}', sans-serif` }}>
                    Together with their families
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── SCHEDULE SECTION ────────────────────────────────────────────── */}
      {activeSection === 'schedule' && (
        <div className="space-y-4 max-w-3xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Event Schedule</h3>
            <Button size="sm" onClick={openAddSchedule} className="bg-slate-900 text-white hover:bg-slate-800">
              <Calendar className="size-3.5 mr-1.5" />
              Add Event
            </Button>
          </div>
          {data.schedule.length === 0 ? (
            <Card className="border-charcoal-ink/5 shadow-none">
              <CardContent className="py-12 text-center">
                <Calendar className="size-8 text-charcoal-ink/20 mx-auto mb-2" />
                <p className="text-sm text-charcoal-ink/40">No events yet. Click "Add Event" to create one.</p>
              </CardContent>
            </Card>
          ) : (
            data.schedule.map((item, idx) => {
              const eventType = EVENT_TYPES.find((t) => t.value === item.eventType) || EVENT_TYPES[4];
              return (
                <Card key={idx} className="border-charcoal-ink/5 shadow-none hover:border-champagne-silk transition-colors duration-200">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={`text-xs ${eventType.color}`}>{eventType.label}</Badge>
                          <span className="text-sm font-medium text-charcoal-ink">{item.title}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-charcoal-ink/50">
                          <span>{item.startTime}{item.endTime ? ` – ${item.endTime}` : ''}</span>
                          {item.location && <span>· {item.location}</span>}
                        </div>
                        {item.description && <p className="text-xs text-charcoal-ink/40 mt-1">{item.description}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-charcoal-ink/40 hover:text-cinematic-gold hover:bg-cinematic-gold/5" onClick={() => openEditSchedule(idx)}>
                          <ArrowLeft className="size-3.5 rotate-180" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-charcoal-ink/40 hover:text-red-500 hover:bg-red-50" onClick={() => deleteSchedule(idx)}>
                          <ArrowLeft className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ── Schedule Add/Edit Dialog ────────────────────────────────────── */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingScheduleIdx !== null ? 'Edit Event' : 'Add New Event'}</DialogTitle>
            <DialogDescription>{editingScheduleIdx !== null ? 'Update this schedule event.' : 'Add a new event to the schedule.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-charcoal-ink/50">Event Type</Label>
              <Select value={scheduleForm.eventType} onValueChange={(v) => setScheduleForm({ ...scheduleForm, eventType: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-charcoal-ink/50">Title</Label>
              <Input value={scheduleForm.title} onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })} placeholder="Wedding Ceremony" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-charcoal-ink/50">Start Time</Label>
                <Input type="time" value={scheduleForm.startTime} onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-charcoal-ink/50">End Time</Label>
                <Input type="time" value={scheduleForm.endTime || ''} onChange={(e) => setScheduleForm({ ...scheduleForm, endTime: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-charcoal-ink/50">Location</Label>
              <Input value={scheduleForm.location || ''} onChange={(e) => setScheduleForm({ ...scheduleForm, location: e.target.value })} placeholder="The Fullerton Hotel — Grand Ballroom" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-charcoal-ink/50">Description</Label>
              <Textarea value={scheduleForm.description || ''} onChange={(e) => setScheduleForm({ ...scheduleForm, description: e.target.value })} placeholder="Exchange of vows and rings" rows={2} />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveSchedule} disabled={!scheduleForm.title.trim()}>
              {editingScheduleIdx !== null ? 'Update Event' : 'Add Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
