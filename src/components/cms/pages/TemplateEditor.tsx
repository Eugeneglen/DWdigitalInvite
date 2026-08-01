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

type Section = 'home' | 'design' | 'schedule' | 'story' | 'faqs' | 'getting-there' | 'moments' | 'wishes' | 'preview';

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

// Hero/Banner images stored on WeddingAccount (not WeddingContent)
const HERO_VISUAL_FIELDS: { key: string; label: string; aspect: string; maxWidth: string; placeholder: string }[] = [
  { key: 'heroImageUrl', label: 'Hero Visual (Full-bleed image)', aspect: 'aspect-[16/9]', maxWidth: '480px', placeholder: '/wedding-images/hero-portrait.png' },
  { key: 'bannerUrl', label: 'Banner Image', aspect: 'aspect-[21/9]', maxWidth: '480px', placeholder: '/wedding-images/banner-bg.png' },
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
  { key: 'title', label: 'Section Title', type: 'text', placeholder: 'e.g. Wishes & Blessings' },
  { key: 'subtitle', label: 'Section Subtitle', type: 'text', placeholder: 'e.g. Leave your heartfelt message for the couple' },
  { key: 'nameLabel', label: 'Name Field Label', type: 'text', placeholder: 'e.g. Your Name' },
  { key: 'messageLabel', label: 'Message Field Label', type: 'text', placeholder: 'e.g. Your Message' },
  { key: 'relationshipLabel', label: 'Relationship Field Label', type: 'text', placeholder: 'e.g. Your Relationship to the Couple' },
  { key: 'submitLabel', label: 'Submit Button Label', type: 'text', placeholder: 'e.g. Weave into Archive' },
  { key: 'heirloomLabel', label: 'Section Label (Eyebrow)', type: 'text', placeholder: 'e.g. The Living Heirloom' },
  { key: 'formEyebrow', label: 'Form Section Eyebrow', type: 'text', placeholder: 'e.g. YOUR TURN' },
  { key: 'formHeading', label: 'Form Section Heading', type: 'text', placeholder: 'e.g. Contribute to the Heirloom' },
];

const QA_FIELDS: { key: string; label: string; type: 'text'; placeholder?: string }[] = [
  { key: 'title', label: 'Section Title', type: 'text', placeholder: 'Questions & Answers' },
  { key: 'subtitle', label: 'Section Subtitle', type: 'text', placeholder: 'e.g. Everything you need to know' },
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

// ── SimpleImageGallery component ───────────────────────────────────────────
// A lightweight gallery that stores images as data URLs in the template's
// media JSON array. Supports add (file upload) and remove.
interface SimpleImageGalleryProps {
  media: MediaItem[];
  onAdd: (url: string) => void;
  onRemove: (index: number) => void;
  maxImages: number;
  aspectClass: string;
}

function SimpleImageGallery({ media, onAdd, onRemove, maxImages, aspectClass }: SimpleImageGalleryProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        onAdd(reader.result as string);
      };
      reader.readAsDataURL(file);
    });
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {media.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {media.map((item, idx) => (
            <div key={idx} className={`relative group ${aspectClass} rounded-lg overflow-hidden border border-charcoal-ink/10`}>
              <img src={item.url} alt={item.fileName} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {media.length < maxImages && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={`w-full ${aspectClass} max-h-32 border-2 border-dashed border-charcoal-ink/15 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-cinematic-gold/50 hover:bg-cinematic-gold/5 transition-colors`}
        >
          <div className="w-8 h-8 rounded-full bg-charcoal-ink/5 flex items-center justify-center">
            <Upload className="size-4 text-charcoal-ink/30" />
          </div>
          <span className="text-xs text-charcoal-ink/40">Click to upload ({media.length}/{maxImages})</span>
        </button>
      )}
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

  // ── Media helpers ──────────────────────────────────────────────────────

  function addMediaItem(category: string, url: string) {
    if (!data) return;
    const newItem: MediaItem = {
      url,
      thumbnailUrl: url,
      fileName: `template-${category}-${Date.now()}.png`,
      fileType: 'IMAGE',
      category,
      sortOrder: data.media.filter((m) => m.category === category).length,
    };
    setData({ ...data, media: [...data.media, newItem] });
    setDirty(true);
  }

  function removeMediaItem(category: string, idx: number) {
    if (!data) return;
    const categoryMedia = data.media.filter((m) => m.category === category);
    const itemToRemove = categoryMedia[idx];
    if (!itemToRemove) return;
    setData({ ...data, media: data.media.filter((m) => m !== itemToRemove) });
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
    { key: 'wishes', label: 'Wishes', icon: MessageSquareHeart },
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
          {/* Hero Visual + Banner */}
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Hero Visual</h3>
              <p className="text-xs text-charcoal-ink/40">Full-bleed hero image shown at the top of the guest site.</p>
              {HERO_VISUAL_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-[11px] tracking-[0.18em] uppercase font-semibold text-charcoal-ink/50">
                    {field.label}
                  </Label>
                  <ImageUpload
                    value={getContentField('hero', field.key) || null}
                    onChange={(v) => setContentField('hero', field.key, v || '', 'IMAGE_URL')}
                    label={field.label}
                    aspectClass={field.aspect}
                    maxWidth={field.maxWidth}
                  />
                </div>
              ))}
              {/* Hero Video URL */}
              <div className="space-y-1.5">
                <Label className="text-[11px] tracking-[0.18em] uppercase font-semibold text-charcoal-ink/50">
                  Hero Video URL (optional — overrides image)
                </Label>
                <Input
                  value={getContentField('hero', 'heroVideoUrl')}
                  onChange={(e) => setContentField('hero', 'heroVideoUrl', e.target.value, 'IMAGE_URL')}
                  placeholder="/uploads/weddings/hero-video.mp4"
                  className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                />
                <p className="text-xs text-charcoal-ink/40">If set, the video plays instead of the hero image on the guest site.</p>
              </div>
            </CardContent>
          </Card>

          {/* Ambient Animations */}
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Ambient Animations</h3>
              <p className="text-xs text-charcoal-ink/40">Toggle which ambient effects appear on the guest invitation. Multiple can be enabled simultaneously.</p>
              {[
                { key: 'animation:gold-dust', label: 'Gold Dust', desc: 'Floating gold particles drifting across the screen' },
                { key: 'animation:flying-stars', label: 'Flying Stars', desc: 'Star-shaped sparkles trailing cursor movement' },
                { key: 'animation:raining', label: 'Raining Petals', desc: 'Falling flower petals animation' },
              ].map((anim) => (
                <div key={anim.key} className="flex items-start justify-between gap-4 py-2 border-b border-charcoal-ink/5 last:border-0">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-charcoal-ink">{anim.label}</p>
                    <p className="text-xs text-charcoal-ink/40">{anim.desc}</p>
                  </div>
                  <Switch
                    checked={getContentField('hero', anim.key) === 'true'}
                    onCheckedChange={(checked) => setContentField('hero', anim.key, String(checked), 'TEXT')}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Hero Content */}
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

          {/* Schedule Images Gallery */}
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Schedule Images</h3>
                <p className="text-xs text-charcoal-ink/40 mt-1">4:3 crop mirrors the guest-site schedule images. Up to 3 images.</p>
              </div>
              <SimpleImageGallery
                media={data.media.filter((m) => m.category === 'schedule')}
                onAdd={(url) => addMediaItem('schedule', url)}
                onRemove={(idx) => removeMediaItem('schedule', idx)}
                maxImages={3}
                aspectClass="aspect-[4/3]"
              />
            </CardContent>
          </Card>

          {/* Venue Image */}
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-3">
              <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Venue Image</h3>
              <ImageUpload
                value={getContentField('getting-there', 'venueImage') || null}
                onChange={(v) => setContentField('getting-there', 'venueImage', v || '', 'IMAGE_URL')}
                label="Venue Image"
                aspectClass="aspect-[4/3]"
                maxWidth="320px"
              />
            </CardContent>
          </Card>
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

          {/* Story Hero Images Gallery */}
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Story Hero Images</h3>
                <p className="text-xs text-charcoal-ink/40 mt-1">16:9 banner images at the top of the guest story page. Up to 3 images.</p>
              </div>
              <SimpleImageGallery
                media={data.media.filter((m) => m.category === 'story')}
                onAdd={(url) => addMediaItem('story', url)}
                onRemove={(idx) => removeMediaItem('story', idx)}
                maxImages={3}
                aspectClass="aspect-[16/9]"
              />
            </CardContent>
          </Card>

          {/* Did You Know? (Tidbits) */}
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Did You Know? (Tidbits)</h3>
                <Switch
                  checked={getContentField('story', 'tidbitsEnabled') !== 'false'}
                  onCheckedChange={(checked) => setContentField('story', 'tidbitsEnabled', String(checked), 'TEXT')}
                />
              </div>
              <p className="text-xs text-charcoal-ink/40">Fun facts about the couple displayed on the story page.</p>
              <div className="space-y-1.5">
                <Label className="text-[11px] tracking-[0.18em] uppercase font-semibold text-charcoal-ink/50">Tidbits Title</Label>
                <Input
                  value={getContentField('story', 'tidbitsTitle')}
                  onChange={(e) => setContentField('story', 'tidbitsTitle', e.target.value)}
                  placeholder="e.g. Did You Know?"
                  className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                />
              </div>
              <div className="space-y-2">
                {(() => {
                  try {
                    const tidbits = JSON.parse(getContentField('story', 'tidbits') || '[]');
                    return tidbits.map((t: { q: string; a: string }, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 p-2 rounded border border-charcoal-ink/10">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-charcoal-ink">{t.q}</p>
                          <p className="text-xs text-charcoal-ink/50">{t.a}</p>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-charcoal-ink/40 hover:text-red-500" onClick={() => {
                          const updated = tidbits.filter((_: unknown, i: number) => i !== idx);
                          setContentField('story', 'tidbits', JSON.stringify(updated), 'JSON');
                        }}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ));
                  } catch { return null; }
                })()}
                <Button variant="outline" size="sm" onClick={() => {
                  const current = (() => { try { return JSON.parse(getContentField('story', 'tidbits') || '[]'); } catch { return []; } })();
                  const q = prompt('Enter tidbit question:');
                  if (!q) return;
                  const a = prompt('Enter tidbit answer:') || '';
                  setContentField('story', 'tidbits', JSON.stringify([...current, { q, a }]), 'JSON');
                }}>
                  <Plus className="size-3.5 mr-1" /> Add Tidbit
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Honeymoon Voting */}
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Honeymoon Destinations</h3>
                <Switch
                  checked={getContentField('story', 'honeymoonEnabled') !== 'false'}
                  onCheckedChange={(checked) => setContentField('story', 'honeymoonEnabled', String(checked), 'TEXT')}
                />
              </div>
              <p className="text-xs text-charcoal-ink/40">Destinations guests can vote on for the couple's honeymoon.</p>
              <div className="space-y-1.5">
                <Label className="text-[11px] tracking-[0.18em] uppercase font-semibold text-charcoal-ink/50">Honeymoon Section Eyebrow</Label>
                <Input
                  value={getContentField('story', 'honeymoonEyebrow')}
                  onChange={(e) => setContentField('story', 'honeymoonEyebrow', e.target.value)}
                  placeholder="e.g. Where should we go?"
                  className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                />
              </div>
              <div className="space-y-2">
                {(() => {
                  try {
                    const dests = JSON.parse(getContentField('story', 'honeymoonDestinations') || '[]');
                    return dests.map((d: { name: string }, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded border border-charcoal-ink/10">
                        <span className="flex-1 text-sm text-charcoal-ink">{d.name}</span>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-charcoal-ink/40 hover:text-red-500" onClick={() => {
                          const updated = dests.filter((_: unknown, i: number) => i !== idx);
                          setContentField('story', 'honeymoonDestinations', JSON.stringify(updated), 'JSON');
                        }}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ));
                  } catch { return null; }
                })()}
                <Button variant="outline" size="sm" onClick={() => {
                  const current = (() => { try { return JSON.parse(getContentField('story', 'honeymoonDestinations') || '[]'); } catch { return []; } })();
                  const name = prompt('Enter destination name:');
                  if (!name) return;
                  setContentField('story', 'honeymoonDestinations', JSON.stringify([...current, { name }]), 'JSON');
                }}>
                  <Plus className="size-3.5 mr-1" /> Add Destination
                </Button>
              </div>
            </CardContent>
          </Card>
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
            </div>

            <SimpleImageGallery
              media={momentsImages()}
              onAdd={(url) => addMomentsImage(url, `moments-${Date.now()}.png`)}
              onRemove={(idx) => removeMomentsImage(idx)}
              maxImages={20}
              aspectClass="aspect-[3/4]"
            />
          </div>
        </div>
      )}

      {/* ── WISHES SECTION ────────────────────────────────────────────── */}
      {activeSection === 'wishes' && (
        <div className="space-y-6 max-w-3xl">
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Wishes Section Text</h3>
              <p className="text-xs text-charcoal-ink/40">Customise the text guests see on the wishes/blessings section.</p>
              {WISHES_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-[11px] tracking-[0.18em] uppercase font-semibold text-charcoal-ink/50">
                    {field.label}
                  </Label>
                  <Input
                    value={getContentField('wishes', field.key)}
                    onChange={(e) => setContentField('wishes', field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
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
  const { theme, content, schedule, stories, faqs, media } = data;

  // ── Field lookup helper ────────────────────────────────────────────────
  const getField = (section: string, key: string, fallback = ''): string =>
    content.find((c) => c.section === section && c.fieldKey === key)?.fieldValue || fallback;

  // ── Hero content ───────────────────────────────────────────────────────
  const heroTitle = getField('hero', 'title', 'Couple Name');
  const heroSubtitle = getField('hero', 'subtitle', 'Together with their families');
  const heroDescription = getField('hero', 'description', 'Together with their families, request the pleasure of your company');
  const dateDisplay = getField('hero', 'dateDisplay', 'Saturday, 25th December 2027');
  const heroImageUrl = getField('hero', 'heroImageUrl', '/wedding-images/hero-portrait.png');
  const bannerUrl = getField('hero', 'bannerUrl', '/wedding-images/banner-bg.png');

  // ── Tea ceremony content ───────────────────────────────────────────────
  const teaCeremonyImage = getField('hero', 'teaCeremonyImage', '/wedding-images/tea-ceremony.png');
  const teaCeremonyLabel = getField('hero', 'teaCeremonyLabel', 'The Tradition');
  const teaCeremonyTitle = getField('hero', 'teaCeremonyTitle', 'The Tea Ceremony');
  const teaCeremonyBody = getField('hero', 'teaCeremonyBody', 'A sacred tradition where we honour our elders and receive their blessings with cups of tea served on bended knee.');

  // ── Narrative content ──────────────────────────────────────────────────
  const narrativeLabel = getField('hero', 'narrativeLabel', 'The Prelude');
  const narrativeTitle = getField('hero', 'narrativeTitle', 'Our Story Begins Here');
  const narrativeBody = getField('hero', 'narrativeBody', 'Every great romance is a narrative woven over time. Ours began with a serendipitous meeting and has evolved into a tapestry of shared adventures, quiet moments, and a profound commitment to one another.');

  // ── Section titles & subtitles ─────────────────────────────────────────
  const scheduleTitle = getField('schedule', 'title', 'The Day');
  const scheduleSubtitle = getField('schedule', 'subtitle', 'The Celebration');
  const storyTitle = getField('story', 'title', 'Our Story');
  const storySubtitle = getField('story', 'subtitle', 'A narrative woven through time, capturing the moments that led us here.');
  const momentsTitle = getField('moments', 'title', 'Moments');
  const momentsSubtitle = getField('moments', 'subtitle', 'The Journey Before the I Do—from childhood dreams to our first steps together.');
  const qaTitle = getField('qa', 'title', 'Questions & Answers');
  const qaSubtitle = getField('qa', 'subtitle', 'Everything you need to know for our celebration.');

  // ── Theme tokens ───────────────────────────────────────────────────────
  const bg = theme.colors.bg;
  const text = theme.colors.text;
  const accent = theme.colors.accent;
  const secondary = theme.colors.secondary;
  const muted = theme.colors.muted;
  const headingFont = `'${theme.fonts.heading}', serif`;
  const bodyFont = `'${theme.fonts.body}', sans-serif`;

  // ── Filtered media (moments gallery) ───────────────────────────────────
  const momentsMedia = media.filter((m) => m.category === 'moments');

  // ── Countdown (uses dateDisplay, falls back to a future date) ───────────
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  useEffect(() => {
    const parseTarget = (dateStr: string): number => {
      if (!dateStr) return Date.now() + 365 * 24 * 3600 * 1000;
      // Strip ordinal suffixes (1st, 2nd, 3rd, 4th) so Date can parse it
      const cleaned = dateStr.replace(/(\d+)(st|nd|rd|th)/gi, '$1');
      const d = new Date(cleaned);
      if (isNaN(d.getTime())) return Date.now() + 365 * 24 * 3600 * 1000;
      return d.getTime();
    };
    const target = parseTarget(dateDisplay);
    const calc = () => {
      const now = Date.now();
      const diff = Math.max(0, target - now);
      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        mins: Math.floor((diff / (1000 * 60)) % 60),
        secs: Math.floor((diff / 1000) % 60),
      });
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [dateDisplay]);

  // ── FAQ accordion state ────────────────────────────────────────────────
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  // ── Section banner (shared across schedule / story / moments / qa) ──────
  // Mirrors src/components/wedding/SectionBanner.tsx: full-bleed banner
  // image with the section title (and optional subtitle) overlaid.
  const renderSectionBanner = (title: string, subtitle?: string) => (
    <div
      className="relative w-full h-[200px] bg-cover bg-center flex items-center justify-center"
      style={{ backgroundImage: `url('${bannerUrl}')` }}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.45))' }}
      />
      <div className="relative z-10 text-center px-6">
        <h2
          className="text-[30px] md:text-[40px] leading-[1.05] tracking-tight font-bold drop-shadow-sm"
          style={{ fontFamily: headingFont, color: '#FFF8E7' }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className="mt-2 text-[10px] md:text-xs uppercase tracking-[0.25em] font-semibold drop-shadow"
            style={{ color: accent }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border border-charcoal-ink/10 overflow-hidden shadow-sm">
      <div
        className="max-h-[600px] overflow-y-auto"
        style={{ backgroundColor: bg, color: text, fontFamily: bodyFont }}
      >
        {/* ===== TOP BANNER (full-bleed background image with couple name) ===== */}
        <div
          className="relative w-full h-[260px] bg-cover bg-center flex items-center justify-center"
          style={{ backgroundImage: `url('${bannerUrl}')` }}
        >
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.5))' }}
          />
          <div className="relative z-10 text-center px-6">
            <h1
              className="text-[38px] md:text-[56px] leading-[1.05] tracking-tight font-bold drop-shadow-sm"
              style={{ fontFamily: headingFont, color: '#FFF8E7' }}
            >
              {heroTitle}
            </h1>
            {heroSubtitle && (
              <p
                className="mt-2 text-xs md:text-sm italic tracking-wide"
                style={{ color: '#FFF8E7' }}
              >
                {heroSubtitle}
              </p>
            )}
          </div>
        </div>

        {/* ===== HERO PORTRAIT (full-bleed image + date + description + countdown) ===== */}
        <div className="relative w-full h-[520px] overflow-hidden">
          <img
            src={heroImageUrl}
            alt="Hero Wedding Portrait"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.6) 100%)' }}
          />
          <div className="relative z-10 h-full w-full px-8 pb-12 flex flex-col items-center justify-end text-center">
            {/* Date badge */}
            {dateDisplay && (
              <div className="mb-6 inline-flex items-center justify-center border border-champagne-silk/60 px-5 py-1.5 rounded-full bg-white/10 backdrop-blur-sm">
                <span
                  className="text-[10px] md:text-xs tracking-[0.2em] uppercase font-semibold"
                  style={{ color: '#FFF8E7' }}
                >
                  {dateDisplay}
                </span>
              </div>
            )}
            {/* Description */}
            {heroDescription && (
              <p
                className="max-w-md mx-auto mb-8 italic text-sm md:text-base"
                style={{ color: 'rgba(255,248,231,0.85)' }}
              >
                {heroDescription}
              </p>
            )}
            {/* Countdown */}
            <div className="grid grid-cols-4 gap-2 md:gap-3 w-full max-w-md mx-auto">
              {[
                { value: countdown.days, label: 'DAYS' },
                { value: countdown.hours, label: 'HOURS' },
                { value: countdown.mins, label: 'MINS' },
                { value: countdown.secs, label: 'SECS' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col items-center justify-center rounded-lg border border-champagne-silk/50 bg-white/10 backdrop-blur-sm py-3 md:py-4"
                >
                  <span
                    className="text-2xl md:text-3xl font-bold leading-none"
                    style={{ fontFamily: headingFont, color: '#FFF8E7' }}
                  >
                    {String(item.value).padStart(2, '0')}
                  </span>
                  <span
                    className="text-[9px] md:text-[10px] tracking-widest uppercase mt-2 font-semibold"
                    style={{ color: 'rgba(255,248,231,0.8)' }}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===== TEA CEREMONY (image + label + title + body, side by side) ===== */}
        <section className="py-14 px-6 md:px-10 max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-center">
            <div className="w-full md:w-1/2 shrink-0">
              <div className="aspect-[4/5] md:aspect-[3/4] w-full overflow-hidden rounded-lg shadow-xl">
                <img
                  src={teaCeremonyImage}
                  alt={teaCeremonyTitle}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div className="w-full md:w-1/2 text-center md:text-left">
              <span
                className="block mb-2 text-[10px] md:text-xs uppercase tracking-[0.2em] font-semibold"
                style={{ color: accent, fontFamily: bodyFont }}
              >
                {teaCeremonyLabel}
              </span>
              <h3
                className="text-2xl md:text-3xl font-semibold mb-4"
                style={{ fontFamily: headingFont, color: text }}
              >
                {teaCeremonyTitle}
              </h3>
              {teaCeremonyBody && (
                <p
                  className="text-sm md:text-base leading-relaxed max-w-xl"
                  style={{ color: muted, fontFamily: bodyFont }}
                >
                  {teaCeremonyBody}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ===== NARRATIVE (label + title + body, centered) ===== */}
        <section
          className="py-14 px-6 md:px-10 max-w-3xl mx-auto text-center"
          style={{ borderTop: `1px solid ${muted}33` }}
        >
          <span
            className="block mb-3 text-[10px] md:text-xs uppercase tracking-[0.2em] font-semibold"
            style={{ color: accent, fontFamily: bodyFont }}
          >
            {narrativeLabel}
          </span>
          <h3
            className="text-2xl md:text-3xl font-semibold mb-4"
            style={{ fontFamily: headingFont, color: text }}
          >
            {narrativeTitle}
          </h3>
          <p
            className="text-sm md:text-base leading-relaxed max-w-2xl mx-auto"
            style={{ color: muted, fontFamily: bodyFont }}
          >
            {narrativeBody}
          </p>
        </section>

        {/* ===== SCHEDULE (section banner + timeline of events) ===== */}
        {renderSectionBanner(scheduleTitle, scheduleSubtitle)}
        <section className="py-14 px-6 md:px-10 max-w-3xl mx-auto">
          {schedule.length === 0 ? (
            <p
              className="text-center text-sm italic py-10"
              style={{ color: muted, fontFamily: bodyFont }}
            >
              No events scheduled.
            </p>
          ) : (
            <div className="relative border-l pl-8 ml-2" style={{ borderColor: `${accent}55` }}>
              <div className="flex flex-col gap-10">
                {schedule.map((item, idx) => {
                  const eventType = EVENT_TYPES.find((t) => t.value === item.eventType);
                  return (
                    <div key={idx} className="relative">
                      <div
                        className="absolute -left-[calc(2px+5px)] top-2 w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: accent }}
                      />
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {item.startTime && (
                          <span
                            className="inline-block px-2.5 py-1 rounded text-[10px] font-medium uppercase tracking-widest"
                            style={{
                              backgroundColor: `${secondary}33`,
                              color: text,
                              fontFamily: bodyFont,
                            }}
                          >
                            {item.startTime}
                          </span>
                        )}
                        {eventType && (
                          <span
                            className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                            style={{
                              backgroundColor: `${accent}22`,
                              color: accent,
                              fontFamily: bodyFont,
                            }}
                          >
                            {eventType.label}
                          </span>
                        )}
                      </div>
                      <h4
                        className="text-lg md:text-xl font-semibold"
                        style={{ fontFamily: headingFont, color: text }}
                      >
                        {item.title}
                      </h4>
                      {item.description && (
                        <p
                          className="text-sm mt-1 leading-relaxed"
                          style={{ color: muted, fontFamily: bodyFont }}
                        >
                          {item.description}
                        </p>
                      )}
                      {item.location && (
                        <span
                          className="mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold"
                          style={{
                            backgroundColor: `${secondary}22`,
                            color: text,
                            fontFamily: bodyFont,
                          }}
                        >
                          <MapPin className="size-3" />
                          {item.location}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* ===== STORY (section banner + zigzag timeline of chapters) ===== */}
        {renderSectionBanner(storyTitle, storySubtitle)}
        <section className="py-14 px-6 md:px-10 max-w-4xl mx-auto">
          {storySubtitle && (
            <p
              className="text-center italic max-w-2xl mx-auto mb-10 text-sm md:text-base"
              style={{ color: muted, fontFamily: bodyFont }}
            >
              {storySubtitle}
            </p>
          )}
          {stories.length === 0 ? (
            <p
              className="text-center text-sm italic py-10"
              style={{ color: muted, fontFamily: bodyFont }}
            >
              Our story coming soon.
            </p>
          ) : (
            <div className="relative">
              {/* Center vertical line */}
              <div
                className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px -translate-x-1/2"
                style={{ backgroundColor: `${accent}44` }}
              />
              <div className="flex flex-col gap-12">
                {stories.map((story, idx) => {
                  const isReversed = idx % 2 === 1;
                  const hasImage = !!story.imageUrl;
                  return (
                    <div
                      key={idx}
                      className={`relative flex flex-col ${isReversed ? 'md:flex-row-reverse' : 'md:flex-row'} items-center justify-between w-full`}
                    >
                      <div
                        className="absolute left-4 md:left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full z-10"
                        style={{ backgroundColor: accent, boxShadow: `0 0 8px ${accent}88` }}
                      />
                      <div
                        className={[
                          'w-full pl-12 md:pl-0 text-left',
                          hasImage ? 'md:w-5/12' : 'md:w-8/12 md:px-12',
                          isReversed
                            ? (hasImage ? 'md:pl-12 md:text-left' : 'md:pl-12 md:text-left')
                            : (hasImage ? 'md:pr-12 md:text-right' : 'md:text-center'),
                        ].join(' ')}
                      >
                        {story.date && (
                          <span
                            className="block mb-2 uppercase tracking-[0.2em] text-[10px] md:text-xs font-semibold"
                            style={{ color: accent, fontFamily: bodyFont }}
                          >
                            {story.date}
                          </span>
                        )}
                        <h4
                          className="text-xl md:text-2xl italic mb-3"
                          style={{ fontFamily: headingFont, color: text, fontWeight: 500 }}
                        >
                          {story.title}
                        </h4>
                        <p
                          className="text-sm italic leading-relaxed"
                          style={{ color: muted, fontFamily: bodyFont }}
                        >
                          {story.content}
                        </p>
                      </div>
                      {hasImage && (
                        <div
                          className={`w-full pl-12 md:pl-0 md:w-5/12 flex ${isReversed ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`w-full overflow-hidden rounded-lg shadow-md ${
                              isReversed ? 'max-w-[260px] aspect-[3/4]' : 'max-w-[300px] aspect-square'
                            }`}
                          >
                            <img
                              src={story.imageUrl || ''}
                              alt={story.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* ===== MOMENTS (section banner + masonry gallery) ===== */}
        {renderSectionBanner(momentsTitle, momentsSubtitle)}
        <section className="py-14 px-6 md:px-10 max-w-5xl mx-auto">
          {momentsSubtitle && (
            <p
              className="text-center italic max-w-2xl mx-auto mb-10 text-sm md:text-base"
              style={{ color: muted, fontFamily: bodyFont }}
            >
              {momentsSubtitle}
            </p>
          )}
          {momentsMedia.length === 0 ? (
            <p
              className="text-center text-sm italic py-10"
              style={{ color: muted, fontFamily: bodyFont }}
            >
              Photos coming soon.
            </p>
          ) : (
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
              {momentsMedia.map((item, idx) => (
                <div
                  key={idx}
                  className="break-inside-avoid mb-4 overflow-hidden rounded-lg shadow-sm p-3"
                  style={{ backgroundColor: bg === '#FFFFFF' || bg === '#ffffff' ? '#FCF9F2' : `${bg}` }}
                >
                  <img
                    src={item.url}
                    alt={item.fileName || `Moment ${idx + 1}`}
                    className="w-full h-auto object-cover rounded"
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ===== FAQ (section banner + accordion list of Q&A) ===== */}
        {renderSectionBanner(qaTitle, qaSubtitle)}
        <section className="py-14 px-6 md:px-10 max-w-3xl mx-auto">
          {qaSubtitle && (
            <p
              className="text-center italic max-w-2xl mx-auto mb-10 text-sm md:text-base"
              style={{ color: muted, fontFamily: bodyFont }}
            >
              {qaSubtitle}
            </p>
          )}
          {faqs.length === 0 ? (
            <p
              className="text-center text-sm italic py-10"
              style={{ color: muted, fontFamily: bodyFont }}
            >
              No questions have been added yet.
            </p>
          ) : (
            <div className="border-t" style={{ borderColor: `${accent}33` }}>
              {faqs.map((faq, idx) => {
                const isOpen = openFaqIdx === idx;
                return (
                  <div
                    key={idx}
                    className="border-b"
                    style={{ borderColor: `${accent}33` }}
                  >
                    <button
                      type="button"
                      className="w-full py-5 flex justify-between items-center text-left"
                      onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                    >
                      <h4
                        className="text-base md:text-lg pr-6"
                        style={{ fontFamily: headingFont, color: text, fontWeight: 500 }}
                      >
                        {faq.question}
                      </h4>
                      <span
                        className="text-lg transition-transform duration-300"
                        style={{
                          color: accent,
                          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          display: 'inline-block',
                        }}
                      >
                        ▾
                      </span>
                    </button>
                    <div
                      className="overflow-hidden transition-all duration-500"
                      style={{
                        maxHeight: isOpen ? '500px' : '0px',
                        opacity: isOpen ? 1 : 0,
                      }}
                    >
                      <p
                        className="pb-5 text-sm md:text-base leading-relaxed"
                        style={{ color: muted, fontFamily: bodyFont }}
                      >
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ===== FOOTER (copyright text) ===== */}
        <footer
          className="py-8 px-6 text-center"
          style={{ borderTop: `1px solid ${muted}33` }}
        >
          <p
            className="text-[10px] uppercase tracking-[0.2em] font-semibold"
            style={{ color: muted, fontFamily: bodyFont }}
          >
            © {new Date().getFullYear()} {heroTitle} · Template Preview · {data.name}
          </p>
        </footer>
      </div>
    </div>
  );
}
