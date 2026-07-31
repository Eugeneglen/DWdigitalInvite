'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ArrowLeft, Save, Loader2, Home as HomeIcon, Palette, Calendar,
  BookOpen, HelpCircle, MapPin, Camera, MessageSquareHeart,
  Eye, EyeOff, Upload, X, Plus, Trash2, Pencil, Clock,
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

interface StoryItem {
  title: string;
  content: string;
  date: string | null;
  imageUrl: string | null;
  sortOrder: number;
}

interface FaqItem {
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
}

interface MediaItem {
  url: string;
  thumbnailUrl: string | null;
  fileName: string;
  fileType: string;
  category: string;
  sortOrder: number;
}

interface TemplateData {
  id: string;
  name: string;
  description: string | null;
  content: ContentItem[];
  schedule: ScheduleItem[];
  stories: StoryItem[];
  faqs: FaqItem[];
  media: MediaItem[];
  theme: Theme;
}

type Section = 'home' | 'design' | 'schedule' | 'story' | 'faqs' | 'getting-there' | 'moments' | 'preview';

// ── Field configs (same pattern as couple CMS) ─────────────────────────────

const HOME_FIELDS: { key: string; label: string; type: 'text' | 'textarea' | 'image'; placeholder?: string }[] = [
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
  { key: 'teaCeremonyImage', label: 'Tea Ceremony Image', type: 'image', placeholder: '/wedding-images/tea-ceremony.png' },
];

const GETTING_THERE_FIELDS: { key: string; label: string; type: 'text' | 'textarea' | 'image'; placeholder?: string }[] = [
  { key: 'title', label: 'Section Title', type: 'text', placeholder: 'Getting There' },
  { key: 'subtitle', label: 'Section Subtitle', type: 'text', placeholder: 'Find your way to our celebration' },
  { key: 'venueDescription', label: 'Venue Description', type: 'textarea', placeholder: 'The Fullerton Hotel is a historic landmark...' },
  { key: 'venueImage', label: 'Venue Image', type: 'image', placeholder: '/wedding-images/ceremony-venue.png' },
  { key: 'transitTitle', label: 'Transit Title', type: 'text', placeholder: 'Public Transit' },
  { key: 'transitContent', label: 'Transit Directions', type: 'textarea', placeholder: 'MRT\nOrchard Boulevard MRT Station...' },
  { key: 'carTitle', label: 'Car Title', type: 'text', placeholder: 'By Car' },
  { key: 'carContent', label: 'Car Directions', type: 'textarea', placeholder: 'FROM THE AIRPORT\nVia CTE / Orchard Road...' },
  { key: 'parkingNote', label: 'Parking Note', type: 'textarea', placeholder: 'PARKING\nValet parking...' },
];

const MOMENTS_FIELDS: { key: string; label: string; type: 'text' | 'textarea'; placeholder?: string }[] = [
  { key: 'title', label: 'Section Title', type: 'text', placeholder: 'Moments' },
  { key: 'subtitle', label: 'Section Subtitle', type: 'textarea', placeholder: 'The Journey Before the I Do...' },
];

const WISHES_FIELDS: { key: string; label: string; type: 'text' | 'textarea'; placeholder?: string }[] = [
  { key: 'title', label: 'Section Title', type: 'text', placeholder: 'Wishes' },
  { key: 'subtitle', label: 'Section Subtitle', type: 'text', placeholder: 'Weave Your Blessing Into Our Archive' },
];

const QA_FIELDS: { key: string; label: string; type: 'text'; placeholder?: string }[] = [
  { key: 'title', label: 'Section Title', type: 'text', placeholder: 'Questions & Answers' },
];

const SCHEDULE_FIELDS: { key: string; label: string; type: 'text' | 'textarea'; placeholder?: string }[] = [
  { key: 'title', label: 'Section Title', type: 'text', placeholder: 'The Day' },
  { key: 'subtitle', label: 'Section Subtitle', type: 'text', placeholder: 'The Celebration' },
];

const EVENT_TYPES = [
  { value: 'TEA_CEREMONY', label: 'Tea Ceremony', color: 'bg-amber-100 text-amber-700' },
  { value: 'CEREMONY', label: 'Ceremony', color: 'bg-rose-100 text-rose-700' },
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

// ── ImageUpload component (inline) ─────────────────────────────────────────
// Single-image upload control that stores a base64 data URL in template JSON.
// Mirrors the visual pattern of the couple CMS MirrorImageUpload but writes
// its value into in-memory state rather than calling any API.

interface ImageUploadProps {
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  aspectClass?: string;
  maxWidth?: string;
}

function ImageUpload({ value, onChange, label, aspectClass = 'aspect-[4/3]', maxWidth }: ImageUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      onChange(dataUrl);
    } catch {
      // silently fail — user can try again
    } finally {
      setUploading(false);
    }
  };

  const openPicker = () => {
    if (!uploading) fileRef.current?.click();
  };

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-semibold text-charcoal-ink/70 uppercase tracking-wider">{label}</p>
          {value && !uploading && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
              className="h-7 text-[11px] gap-1.5 text-charcoal-ink/50 hover:text-red-500 hover:bg-red-50"
            >
              <X className="size-3" />
              Remove
            </Button>
          )}
        </div>
      )}
      <div
        className={`relative ${aspectClass} ${maxWidth ? '' : 'w-full'} rounded-lg overflow-hidden border-2 transition-colors duration-200 ${
          value
            ? 'border-charcoal-ink/10'
            : dragOver
              ? 'border-cinematic-gold bg-cinematic-gold/5'
              : 'border-dashed border-charcoal-ink/15 hover:border-cinematic-gold/60 hover:bg-cinematic-gold/5'
        } cursor-pointer`}
        style={maxWidth ? { maxWidth, marginInline: 'auto' } : undefined}
        onClick={openPicker}
        onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (uploading) return;
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
      >
        {value ? (
          <>
            <img src={value} alt={label || 'Preview'} className="w-full h-full object-cover" />
            {uploading && (
              <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                <Loader2 className="size-6 animate-spin text-cinematic-gold" />
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center">
            {uploading ? (
              <Loader2 className="size-7 animate-spin text-cinematic-gold" />
            ) : (
              <>
                <div className="flex items-center justify-center h-11 w-11 rounded-full bg-cinematic-gold/10">
                  <Camera className="size-5 text-cinematic-gold" />
                </div>
                <p className="text-xs font-medium text-charcoal-ink/60">Drag &amp; drop, or</p>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-charcoal-ink text-paper-cream hover:bg-charcoal-ink/90"
                >
                  <Upload className="size-3.5" />
                  Upload Image
                </Button>
                <p className="text-[10px] text-charcoal-ink/30 mt-1">Sample image · stored in template JSON</p>
              </>
            )}
          </div>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

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

  // Story dialog state
  const [storyDialogOpen, setStoryDialogOpen] = useState(false);
  const [editingStoryIdx, setEditingStoryIdx] = useState<number | null>(null);
  const [storyForm, setStoryForm] = useState<{
    title: string;
    content: string;
    date: string;
    imageUrl: string;
  }>({ title: '', content: '', date: '', imageUrl: '' });

  // FAQ dialog state
  const [faqDialogOpen, setFaqDialogOpen] = useState(false);
  const [editingFaqIdx, setEditingFaqIdx] = useState<number | null>(null);
  const [faqForm, setFaqForm] = useState<{ question: string; answer: string; isActive: boolean }>({
    question: '', answer: '', isActive: true,
  });

  // ── Fetch ──────────────────────────────────────────────────────────────

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
        content: Array.isArray(json.content) ? json.content : [],
        schedule: Array.isArray(json.schedule) ? json.schedule : [],
        stories: Array.isArray(json.stories) ? json.stories : [],
        faqs: Array.isArray(json.faqs) ? json.faqs : [],
        media: Array.isArray(json.media) ? json.media : [],
        theme: json.theme || {
          colors: { bg: '#FDF8F0', text: '#2C2C2C', accent: '#D4AF37', secondary: '#8B7355', muted: '#A09888' },
          fonts: { heading: 'Playfair Display', body: 'Lato' },
        },
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
          c.section === section && c.fieldKey === fieldKey ? { ...c, fieldValue: value, fieldType } : c,
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
    if (!confirm('Remove this event from the template?')) return;
    setData({ ...data, schedule: data.schedule.filter((_, i) => i !== idx) });
    setDirty(true);
  }

  // ── Story helpers ──────────────────────────────────────────────────────

  function openAddStory() {
    setEditingStoryIdx(null);
    setStoryForm({ title: '', content: '', date: '', imageUrl: '' });
    setStoryDialogOpen(true);
  }

  function openEditStory(idx: number) {
    const item = data?.stories[idx];
    if (!item) return;
    setEditingStoryIdx(idx);
    setStoryForm({
      title: item.title,
      content: item.content,
      date: item.date || '',
      imageUrl: item.imageUrl || '',
    });
    setStoryDialogOpen(true);
  }

  function saveStory() {
    if (!data) return;
    const payload: StoryItem = {
      title: storyForm.title.trim(),
      content: storyForm.content.trim(),
      date: storyForm.date || null,
      imageUrl: storyForm.imageUrl || null,
      sortOrder: editingStoryIdx !== null ? data.stories[editingStoryIdx].sortOrder : data.stories.length,
    };
    if (editingStoryIdx !== null) {
      setData({
        ...data,
        stories: data.stories.map((s, i) => (i === editingStoryIdx ? payload : s)),
      });
    } else {
      setData({ ...data, stories: [...data.stories, payload] });
    }
    setStoryDialogOpen(false);
    setDirty(true);
  }

  function deleteStory(idx: number) {
    if (!data) return;
    if (!confirm('Delete this chapter? This action cannot be undone.')) return;
    setData({ ...data, stories: data.stories.filter((_, i) => i !== idx) });
    setDirty(true);
  }

  function setStoryImage(idx: number, dataUrl: string | null) {
    if (!data) return;
    setData({
      ...data,
      stories: data.stories.map((s, i) => (i === idx ? { ...s, imageUrl: dataUrl } : s)),
    });
    setDirty(true);
  }

  // ── FAQ helpers ────────────────────────────────────────────────────────

  function openAddFaq() {
    setEditingFaqIdx(null);
    setFaqForm({ question: '', answer: '', isActive: true });
    setFaqDialogOpen(true);
  }

  function openEditFaq(idx: number) {
    const item = data?.faqs[idx];
    if (!item) return;
    setEditingFaqIdx(idx);
    setFaqForm({ question: item.question, answer: item.answer, isActive: item.isActive });
    setFaqDialogOpen(true);
  }

  function saveFaq() {
    if (!data) return;
    const payload: FaqItem = {
      question: faqForm.question.trim(),
      answer: faqForm.answer.trim(),
      isActive: faqForm.isActive,
      sortOrder: editingFaqIdx !== null ? data.faqs[editingFaqIdx].sortOrder : data.faqs.length,
    };
    if (editingFaqIdx !== null) {
      setData({
        ...data,
        faqs: data.faqs.map((f, i) => (i === editingFaqIdx ? payload : f)),
      });
    } else {
      setData({ ...data, faqs: [...data.faqs, payload] });
    }
    setFaqDialogOpen(false);
    setDirty(true);
  }

  function deleteFaq(idx: number) {
    if (!data) return;
    if (!confirm('Delete this FAQ? This action cannot be undone.')) return;
    setData({ ...data, faqs: data.faqs.filter((_, i) => i !== idx) });
    setDirty(true);
  }

  function toggleFaqActive(idx: number) {
    if (!data) return;
    setData({
      ...data,
      faqs: data.faqs.map((f, i) => (i === idx ? { ...f, isActive: !f.isActive } : f)),
    });
    setDirty(true);
  }

  // ── Moments media helpers ──────────────────────────────────────────────

  function addMomentsImage(dataUrl: string, fileName: string) {
    if (!data) return;
    const momentsImages = data.media.filter((m) => m.category === 'moments');
    const newItem: MediaItem = {
      url: dataUrl,
      thumbnailUrl: null,
      fileName,
      fileType: 'IMAGE',
      category: 'moments',
      sortOrder: momentsImages.length,
    };
    setData({ ...data, media: [...data.media, newItem] });
    setDirty(true);
  }

  function removeMomentsImage(idx: number) {
    if (!data) return;
    // idx is the index among moments-category items; find the absolute index in data.media
    const momentsImages = data.media.filter((m) => m.category === 'moments');
    const target = momentsImages[idx];
    if (!target) return;
    setData({ ...data, media: data.media.filter((m) => m !== target) });
    setDirty(true);
  }

  function momentsImages(): MediaItem[] {
    return (data?.media || []).filter((m) => m.category === 'moments');
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
          faqs: JSON.stringify(data.faqs),
          stories: JSON.stringify(data.stories),
          media: JSON.stringify(data.media),
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
    { key: 'story', label: 'Story', icon: BookOpen },
    { key: 'faqs', label: 'FAQs', icon: HelpCircle },
    { key: 'getting-there', label: 'Getting There', icon: MapPin },
    { key: 'moments', label: 'Moments', icon: Camera },
    { key: 'preview', label: 'Preview', icon: Eye },
  ];

  return (
    <div className="space-y-6 pb-20">
      {/* Header with Back + Preview + Save */}
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveSection('preview')}
            disabled={activeSection === 'preview'}
            className="border-charcoal-ink/15 text-charcoal-ink hover:border-cinematic-gold hover:text-cinematic-gold"
          >
            <Eye className="size-4 mr-1.5" />
            Preview
          </Button>
          <Button onClick={handleSave} disabled={!dirty || saving} className="bg-slate-900 text-white hover:bg-slate-800">
            {saving ? <><Loader2 className="size-4 mr-2 animate-spin" />Saving...</> : <><Save className="size-4 mr-2" />Save Template</>}
          </Button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
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
                  {field.type === 'image' ? (
                    <ImageUpload
                      value={getContentField('hero', field.key) || null}
                      onChange={(v) => setContentField('hero', field.key, v || '', 'IMAGE_URL')}
                      label="Tea Ceremony Image"
                      aspectClass="aspect-[2/3]"
                      maxWidth="240px"
                    />
                  ) : field.type === 'textarea' ? (
                    <Textarea
                      value={getContentField('hero', field.key)}
                      onChange={(e) => setContentField('hero', field.key, e.target.value, 'RICHTEXT')}
                      placeholder={field.placeholder}
                      className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                      rows={3}
                    />
                  ) : (
                    <Input
                      value={getContentField('hero', field.key)}
                      onChange={(e) => setContentField('hero', field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
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
                    className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
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
              <Plus className="size-3.5 mr-1.5" />
              Add Event
            </Button>
          </div>
          {data.schedule.length === 0 ? (
            <Card className="border-charcoal-ink/5 shadow-none">
              <CardContent className="py-12 text-center">
                <Calendar className="size-8 text-charcoal-ink/20 mx-auto mb-2" />
                <p className="text-sm text-charcoal-ink/40">No events yet. Click &quot;Add Event&quot; to create one.</p>
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
                          <Clock className="size-3" />
                          <span>{item.startTime}{item.endTime ? ` – ${item.endTime}` : ''}</span>
                          {item.location && (
                            <>
                              <MapPin className="size-3" />
                              <span>{item.location}</span>
                            </>
                          )}
                        </div>
                        {item.description && <p className="text-xs text-charcoal-ink/40 mt-1">{item.description}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-charcoal-ink/40 hover:text-cinematic-gold hover:bg-cinematic-gold/5" onClick={() => openEditSchedule(idx)} title="Edit event">
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-charcoal-ink/40 hover:text-red-500 hover:bg-red-50" onClick={() => deleteSchedule(idx)} title="Delete event">
                          <Trash2 className="size-3.5" />
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

      {/* ── STORY SECTION ──────────────────────────────────────────────── */}
      {activeSection === 'story' && (
        <div className="space-y-6 max-w-3xl">
          {/* Section text */}
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Story Section Text</h3>
              <div className="space-y-1.5">
                <Label className="text-[11px] tracking-[0.18em] uppercase font-semibold text-charcoal-ink/50">Section Title</Label>
                <Input
                  value={getContentField('story', 'title')}
                  onChange={(e) => setContentField('story', 'title', e.target.value)}
                  placeholder="Our Love Story"
                  className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] tracking-[0.18em] uppercase font-semibold text-charcoal-ink/50">Section Subtitle</Label>
                <Input
                  value={getContentField('story', 'subtitle')}
                  onChange={(e) => setContentField('story', 'subtitle', e.target.value)}
                  placeholder="The chapters of our journey"
                  className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                />
              </div>
            </CardContent>
          </Card>

          <Separator className="bg-champagne-silk" />

          {/* Chapters timeline */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Chapters</h3>
            <Button size="sm" onClick={openAddStory} className="bg-slate-900 text-white hover:bg-slate-800">
              <Plus className="size-3.5 mr-1.5" />
              Add Chapter
            </Button>
          </div>

          {data.stories.length === 0 ? (
            <Card className="border-charcoal-ink/5 shadow-none">
              <CardContent className="py-12 text-center">
                <BookOpen className="size-8 text-charcoal-ink/20 mx-auto mb-2" />
                <p className="text-sm text-charcoal-ink/40">No chapters yet. Click &quot;Add Chapter&quot; to begin the story.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="relative space-y-0">
              {/* Timeline line */}
              <div className="absolute left-[15px] top-4 bottom-4 w-px bg-champagne-silk hidden sm:block" />
              {data.stories.map((item, idx) => (
                <div key={idx} className="relative flex gap-4 pb-6 last:pb-0">
                  <div className="hidden sm:flex items-start pt-1.5 shrink-0">
                    <div className="relative z-10 flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-cinematic-gold/30 bg-paper-cream">
                      <div className="h-2 w-2 rounded-full bg-cinematic-gold" />
                    </div>
                  </div>
                  <Card className="flex-1 border-charcoal-ink/5 shadow-none hover:border-champagne-silk transition-colors duration-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <span className="sm:hidden inline-flex items-center justify-center h-5 w-5 rounded-full bg-cinematic-gold/10 text-cinematic-gold text-[10px] font-bold mb-2">
                            {idx + 1}
                          </span>
                          <h4 className="text-sm font-semibold text-charcoal-ink">{item.title}</h4>
                          {item.date && (
                            <span className="flex items-center gap-1 text-xs text-cinematic-gold/80 font-medium mt-0.5">
                              <Calendar className="size-3" />
                              {item.date}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-charcoal-ink/40 hover:text-cinematic-gold hover:bg-cinematic-gold/5" onClick={() => openEditStory(idx)} title="Edit chapter">
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-charcoal-ink/40 hover:text-red-500 hover:bg-red-50" onClick={() => deleteStory(idx)} title="Delete chapter">
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-col md:flex-row gap-4 items-start">
                        <ImageUpload
                          value={item.imageUrl}
                          onChange={(v) => setStoryImage(idx, v)}
                          label="Image"
                          aspectClass="aspect-[16/9]"
                          maxWidth="280px"
                        />
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-xs text-charcoal-ink/50 line-clamp-4 leading-relaxed">{item.content}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── FAQs SECTION ───────────────────────────────────────────────── */}
      {activeSection === 'faqs' && (
        <div className="space-y-6 max-w-3xl">
          {/* Section text */}
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Q&amp;A Section Text</h3>
              {QA_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-[11px] tracking-[0.18em] uppercase font-semibold text-charcoal-ink/50">
                    {field.label}
                  </Label>
                  <Input
                    value={getContentField('qa', field.key)}
                    onChange={(e) => setContentField('qa', field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Separator className="bg-champagne-silk" />

          {/* FAQ list */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Frequently Asked Questions</h3>
            <Button size="sm" onClick={openAddFaq} className="bg-slate-900 text-white hover:bg-slate-800">
              <Plus className="size-3.5 mr-1.5" />
              Add Question
            </Button>
          </div>

          {data.faqs.length === 0 ? (
            <Card className="border-charcoal-ink/5 shadow-none">
              <CardContent className="py-12 text-center">
                <HelpCircle className="size-8 text-charcoal-ink/20 mx-auto mb-2" />
                <p className="text-sm text-charcoal-ink/40">No FAQs yet. Click &quot;Add Question&quot; to create one.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {data.faqs.map((item, idx) => (
                <Card
                  key={idx}
                  className={`border-charcoal-ink/5 shadow-none hover:border-champagne-silk transition-colors duration-200 ${
                    !item.isActive ? 'opacity-60' : ''
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <h4 className="text-sm font-semibold text-charcoal-ink">{item.question}</h4>
                          {!item.isActive && (
                            <Badge variant="outline" className="text-[10px] font-medium border-charcoal-ink/10 text-charcoal-ink/40">
                              Hidden
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-charcoal-ink/50 leading-relaxed">{item.answer}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleFaqActive(idx)}
                          className={`h-8 w-8 p-0 ${
                            item.isActive
                              ? 'text-cinematic-gold hover:bg-cinematic-gold/5'
                              : 'text-charcoal-ink/30 hover:text-cinematic-gold hover:bg-cinematic-gold/5'
                          }`}
                          title={item.isActive ? 'Deactivate FAQ' : 'Activate FAQ'}
                        >
                          {item.isActive ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-charcoal-ink/40 hover:text-cinematic-gold hover:bg-cinematic-gold/5" onClick={() => openEditFaq(idx)} title="Edit FAQ">
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-charcoal-ink/40 hover:text-red-500 hover:bg-red-50" onClick={() => deleteFaq(idx)} title="Delete FAQ">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── GETTING THERE SECTION ──────────────────────────────────────── */}
      {activeSection === 'getting-there' && (
        <div className="space-y-6 max-w-3xl">
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Getting There Content</h3>
              {GETTING_THERE_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-[11px] tracking-[0.18em] uppercase font-semibold text-charcoal-ink/50">
                    {field.label}
                  </Label>
                  {field.type === 'image' ? (
                    <ImageUpload
                      value={getContentField('getting-there', field.key) || null}
                      onChange={(v) => setContentField('getting-there', field.key, v || '', 'IMAGE_URL')}
                      label="Venue Image"
                      aspectClass="aspect-[4/3]"
                      maxWidth="360px"
                    />
                  ) : field.type === 'textarea' ? (
                    <Textarea
                      value={getContentField('getting-there', field.key)}
                      onChange={(e) => setContentField('getting-there', field.key, e.target.value, 'RICHTEXT')}
                      placeholder={field.placeholder}
                      className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                      rows={4}
                    />
                  ) : (
                    <Input
                      value={getContentField('getting-there', field.key)}
                      onChange={(e) => setContentField('getting-there', field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── MOMENTS SECTION ────────────────────────────────────────────── */}
      {activeSection === 'moments' && (
        <div className="space-y-6 max-w-3xl">
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Moments Section Text</h3>
              {MOMENTS_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-[11px] tracking-[0.18em] uppercase font-semibold text-charcoal-ink/50">
                    {field.label}
                  </Label>
                  {field.type === 'textarea' ? (
                    <Textarea
                      value={getContentField('moments', field.key)}
                      onChange={(e) => setContentField('moments', field.key, e.target.value, 'RICHTEXT')}
                      placeholder={field.placeholder}
                      className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                      rows={3}
                    />
                  ) : (
                    <Input
                      value={getContentField('moments', field.key)}
                      onChange={(e) => setContentField('moments', field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Separator className="bg-champagne-silk" />

          {/* Image gallery */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Gallery Images</h3>
                <p className="text-xs text-charcoal-ink/40 mt-0.5">{momentsImages().length} image(s) · 3:4 portrait · mirrors guest-site framing</p>
              </div>
              <MomentsAddButton onAdd={addMomentsImage} />
            </div>

            {momentsImages().length === 0 ? (
              <Card className="border-charcoal-ink/5 shadow-none">
                <CardContent className="py-12 text-center">
                  <Camera className="size-8 text-charcoal-ink/20 mx-auto mb-2" />
                  <p className="text-sm text-charcoal-ink/40">No gallery images yet. Click &quot;Add Image&quot; to upload samples.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {momentsImages().map((item, idx) => (
                  <div key={idx} className="group relative aspect-[3/4] rounded-lg overflow-hidden border border-charcoal-ink/10 bg-paper-cream">
                    <img src={item.url} alt={item.fileName} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeMomentsImage(idx)}
                      className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-charcoal-ink/60 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove image"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                    <p className="absolute bottom-0 left-0 right-0 px-2 py-1 text-[10px] text-white bg-charcoal-ink/60 truncate">{item.fileName}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PREVIEW SECTION ────────────────────────────────────────────── */}
      {activeSection === 'preview' && (
        <div className="space-y-4 max-w-3xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Live Preview</h3>
              <p className="text-xs text-charcoal-ink/40 mt-0.5">Read-only preview of the template as guests will see it.</p>
            </div>
          </div>
          <PreviewPanel data={data} />
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

      {/* ── Story Add/Edit Dialog ───────────────────────────────────────── */}
      <Dialog open={storyDialogOpen} onOpenChange={setStoryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingStoryIdx !== null ? 'Edit Chapter' : 'Add New Chapter'}</DialogTitle>
            <DialogDescription>{editingStoryIdx !== null ? 'Update this story chapter.' : 'Add a new chapter to the love story.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-charcoal-ink/50">Chapter Title</Label>
              <Input value={storyForm.title} onChange={(e) => setStoryForm({ ...storyForm, title: e.target.value })} placeholder="How We Met" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-charcoal-ink/50">Date</Label>
              <Input type="date" value={storyForm.date} onChange={(e) => setStoryForm({ ...storyForm, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-charcoal-ink/50">Content</Label>
              <Textarea value={storyForm.content} onChange={(e) => setStoryForm({ ...storyForm, content: e.target.value })} placeholder="The story of how it all began..." rows={4} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-charcoal-ink/50">Image URL</Label>
              <Input value={storyForm.imageUrl} onChange={(e) => setStoryForm({ ...storyForm, imageUrl: e.target.value })} placeholder="/wedding-images/story-1.png" />
              <p className="text-[11px] text-charcoal-ink/40">Paste a path or upload via the chapter card after saving.</p>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setStoryDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveStory} disabled={!storyForm.title.trim() || !storyForm.content.trim()}>
              {editingStoryIdx !== null ? 'Update Chapter' : 'Add Chapter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── FAQ Add/Edit Dialog ─────────────────────────────────────────── */}
      <Dialog open={faqDialogOpen} onOpenChange={setFaqDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFaqIdx !== null ? 'Edit FAQ' : 'Add New Question'}</DialogTitle>
            <DialogDescription>{editingFaqIdx !== null ? 'Update the question and answer.' : 'Add a new frequently asked question.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-charcoal-ink/50">Question</Label>
              <Input value={faqForm.question} onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })} placeholder="What time should I arrive?" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-charcoal-ink/50">Answer</Label>
              <Textarea value={faqForm.answer} onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })} placeholder="Please arrive 15 minutes before the ceremony..." rows={4} />
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-charcoal-ink/10 p-3">
              <Switch
                checked={faqForm.isActive}
                onCheckedChange={(checked) => setFaqForm({ ...faqForm, isActive: checked })}
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-charcoal-ink">Visible to guests</p>
                <p className="text-xs text-charcoal-ink/40">When off, this FAQ is hidden from the public site.</p>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setFaqDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveFaq} disabled={!faqForm.question.trim() || !faqForm.answer.trim()}>
              {editingFaqIdx !== null ? 'Update FAQ' : 'Add FAQ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── MomentsAddButton (file-input trigger for the moments gallery) ──────────

function MomentsAddButton({ onAdd }: { onAdd: (dataUrl: string, fileName: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        onAdd(dataUrl, file.name || 'image');
      }
    } catch {
      // silently fail
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="bg-slate-900 text-white hover:bg-slate-800"
      >
        {uploading ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Plus className="size-3.5 mr-1.5" />}
        Add Image
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </>
  );
}

// ── PreviewPanel — read-only live preview of the template ──────────────────

function PreviewPanel({ data }: { data: TemplateData }) {
  const { theme, content, schedule, stories } = data;
  const heroTitle = content.find((c) => c.section === 'hero' && c.fieldKey === 'title')?.fieldValue || 'Couple Name';
  const heroSubtitle = content.find((c) => c.section === 'hero' && c.fieldKey === 'subtitle')?.fieldValue || '';
  const heroDescription = content.find((c) => c.section === 'hero' && c.fieldKey === 'description')?.fieldValue || '';
  const dateDisplay = content.find((c) => c.section === 'hero' && c.fieldKey === 'dateDisplay')?.fieldValue || '';
  const teaCeremonyImage = content.find((c) => c.section === 'hero' && c.fieldKey === 'teaCeremonyImage')?.fieldValue || '';
  const scheduleTitle = content.find((c) => c.section === 'schedule' && c.fieldKey === 'title')?.fieldValue || 'The Day';
  const storyTitle = content.find((c) => c.section === 'story' && c.fieldKey === 'title')?.fieldValue || 'Our Love Story';

  const bg = theme.colors.bg;
  const text = theme.colors.text;
  const accent = theme.colors.accent;
  const muted = theme.colors.muted;
  const headingFont = `'${theme.fonts.heading}', serif`;
  const bodyFont = `'${theme.fonts.body}', sans-serif`;

  return (
    <div
      className="rounded-xl border border-charcoal-ink/10 overflow-hidden shadow-sm"
      style={{ backgroundColor: bg, color: text, fontFamily: bodyFont }}
    >
      {/* Hero */}
      <div className="px-6 py-12 sm:px-10 sm:py-16 text-center">
        {heroSubtitle && (
          <p className="text-xs sm:text-sm uppercase tracking-[0.2em] mb-3" style={{ color: accent, fontFamily: bodyFont }}>
            {heroSubtitle}
          </p>
        )}
        <h1 className="text-3xl sm:text-5xl font-light leading-tight" style={{ fontFamily: headingFont, color: text }}>
          {heroTitle}
        </h1>
        {dateDisplay && (
          <p className="mt-4 text-xs sm:text-sm uppercase tracking-[0.15em]" style={{ color: muted, fontFamily: bodyFont }}>
            {dateDisplay}
          </p>
        )}
        {heroDescription && (
          <p className="mt-5 text-sm sm:text-base max-w-md mx-auto" style={{ color: muted, fontFamily: bodyFont }}>
            {heroDescription}
          </p>
        )}
        <div className="mt-6 flex justify-center">
          <div className="h-px w-16" style={{ backgroundColor: accent }} />
        </div>
      </div>

      {/* Tea ceremony image */}
      {teaCeremonyImage && (
        <div className="px-6 pb-10 sm:px-10">
          <div className="aspect-[2/3] max-w-[220px] mx-auto rounded-lg overflow-hidden">
            <img src={teaCeremonyImage} alt="Tea ceremony" className="w-full h-full object-cover" />
          </div>
        </div>
      )}

      {/* Schedule */}
      {schedule.length > 0 && (
        <div className="px-6 py-10 sm:px-10" style={{ borderTop: `1px solid ${muted}33` }}>
          <h2 className="text-center text-2xl sm:text-3xl font-light mb-1" style={{ fontFamily: headingFont, color: text }}>
            {scheduleTitle}
          </h2>
          <div className="flex justify-center mb-8">
            <div className="h-px w-12" style={{ backgroundColor: accent }} />
          </div>
          <div className="space-y-4 max-w-md mx-auto">
            {schedule.map((item, idx) => {
              const eventType = EVENT_TYPES.find((t) => t.value === item.eventType);
              return (
                <div key={idx} className="flex items-start gap-4 py-3" style={{ borderBottom: `1px solid ${muted}22` }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.15em] mb-1" style={{ color: accent, fontFamily: bodyFont }}>
                      {eventType?.label || 'Event'}
                    </p>
                    <p className="text-sm font-medium" style={{ fontFamily: headingFont, color: text }}>
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="text-xs mt-1" style={{ color: muted, fontFamily: bodyFont }}>
                        {item.description}
                      </p>
                    )}
                    {item.location && (
                      <p className="text-xs mt-1 flex items-center gap-1" style={{ color: muted, fontFamily: bodyFont }}>
                        <MapPin className="size-3" />
                        {item.location}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium" style={{ color: text, fontFamily: bodyFont }}>
                      {item.startTime}
                    </p>
                    {item.endTime && (
                      <p className="text-[11px]" style={{ color: muted, fontFamily: bodyFont }}>
                        {item.endTime}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Story chapters */}
      {stories.length > 0 && (
        <div className="px-6 py-10 sm:px-10" style={{ borderTop: `1px solid ${muted}33` }}>
          <h2 className="text-center text-2xl sm:text-3xl font-light mb-1" style={{ fontFamily: headingFont, color: text }}>
            {storyTitle}
          </h2>
          <div className="flex justify-center mb-8">
            <div className="h-px w-12" style={{ backgroundColor: accent }} />
          </div>
          <div className="space-y-8 max-w-2xl mx-auto">
            {stories.map((item, idx) => (
              <div key={idx} className="flex flex-col md:flex-row gap-5 items-center">
                {item.imageUrl && (
                  <div className="aspect-[16/9] w-full md:w-1/2 max-w-xs rounded-lg overflow-hidden shrink-0">
                    <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 text-center md:text-left">
                  <p className="text-[10px] uppercase tracking-[0.15em] mb-1" style={{ color: accent, fontFamily: bodyFont }}>
                    {item.date || `Chapter ${idx + 1}`}
                  </p>
                  <h3 className="text-lg font-medium mb-2" style={{ fontFamily: headingFont, color: text }}>
                    {item.title}
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: muted, fontFamily: bodyFont }}>
                    {item.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-6 text-center" style={{ borderTop: `1px solid ${muted}33` }}>
        <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: muted, fontFamily: bodyFont }}>
          Template Preview · {data.name}
        </p>
      </div>
    </div>
  );
}
