'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ArrowLeft, Save, Loader2, Home as HomeIcon, Palette, Calendar,
  BookOpen, HelpCircle, MapPin, Camera, MessageSquareHeart,
  Eye, EyeOff, X, Plus, Trash2, Pencil, Clock,
  ImagePlus, Check, Sparkles, Type, Heart, CalendarDays,
} from 'lucide-react';
import MirrorImageUpload from '@/components/cms/couple/MirrorImageUpload';
import { isDarkBackground, getAutoTextColor } from '@/lib/contrast';
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

type Section = 'details' | 'home' | 'design' | 'schedule' | 'story' | 'faqs' | 'getting-there' | 'moments' | 'wishes' | 'preview';

// ── Field configs (same pattern as couple CMS) ─────────────────────────────

const HOME_FIELDS: { key: string; label: string; type: 'text' | 'textarea' | 'image' | 'date'; placeholder?: string; helperText?: string }[] = [
  { key: 'title', label: 'Hero Title', type: 'text', placeholder: 'Couple Name' },
  { key: 'subtitle', label: 'Hero Subtitle', type: 'text', placeholder: 'Together with their families...' },
  { key: 'description', label: 'Hero Description', type: 'text', placeholder: 'We invite you to share...' },
  { key: 'dateDisplay', label: 'Date Display', type: 'text', placeholder: 'Saturday, 25th December 2027' },
  { key: 'countdownDate', label: 'Countdown Date', type: 'date', helperText: 'ISO date used by the countdown timer. More reliable than Date Display.' },
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

const GETTING_THERE_FIELDS: { key: string; label: string; type: 'text' | 'textarea'; placeholder?: string }[] = [
  { key: 'title', label: 'Section Title', type: 'text', placeholder: 'Getting There' },
  { key: 'subtitle', label: 'Section Subtitle', type: 'text', placeholder: 'Find your way to our celebration' },
  { key: 'transitTitle', label: 'Transit Title', type: 'text', placeholder: 'Public Transit' },
  { key: 'transitContent', label: 'Transit Directions', type: 'textarea', placeholder: 'MRT\nOrchard Boulevard MRT Station...' },
  { key: 'carTitle', label: 'Car Title', type: 'text', placeholder: 'By Car' },
  { key: 'carContent', label: 'Car Directions', type: 'textarea', placeholder: 'FROM THE AIRPORT\nVia CTE / Orchard Road...' },
  { key: 'parkingNote', label: 'Parking Note', type: 'textarea', placeholder: 'PARKING\nValet parking...' },
];

const MOMENTS_FIELDS: { key: string; label: string; type: 'text' | 'textarea'; placeholder?: string }[] = [
  { key: 'title', label: 'Section Title', type: 'text', placeholder: 'Moments' },
  { key: 'subtitle', label: 'Section Subtitle', type: 'text', placeholder: 'The Journey Before the I Do...' },
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
  { value: 'TEA_CEREMONY', label: 'Ceremony Section', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'CEREMONY', label: 'Ceremony', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'RECEPTION', label: 'Reception', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'DINNER', label: 'Dinner', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { value: 'CUSTOM', label: 'Custom', color: 'bg-slate-50 text-slate-700 border-slate-200' },
];

const THEME_PRESETS: { id: string; name: string; description: string; isDefault?: boolean; colors: Theme['colors']; fonts: Theme['fonts'] }[] = [
  {
    id: 'classic-elegance',
    name: 'Classic Elegance',
    description: 'Warm ivory backdrop with cinematic gold accents and timeless Playfair Display headings.',
    isDefault: true,
    colors: { bg: '#FDF8F0', text: '#2C2C2C', accent: '#D4AF37', secondary: '#8B7355', muted: '#A09888' },
    fonts: { heading: 'Playfair Display', body: 'Lato' },
  },
  {
    id: 'midnight-gold',
    name: 'Midnight Gold',
    description: 'Deep charcoal canvas illuminated by champagne-gold type. Modern, dramatic, opulent.',
    colors: { bg: '#0F172A', text: '#F5E6C8', accent: '#D4AF37', secondary: '#C9A961', muted: '#8B8472' },
    fonts: { heading: 'Cinzel', body: 'Montserrat' },
  },
  {
    id: 'blush-romance',
    name: 'Blush Romance',
    description: 'Soft blush cream with rose-gold accents and flowing Cormorant Garamond script.',
    colors: { bg: '#FFF8F0', text: '#4A2C2A', accent: '#C77B8C', secondary: '#B0886D', muted: '#A89888' },
    fonts: { heading: 'Cormorant Garamond', body: 'Lora' },
  },
  {
    id: 'garden-sage',
    name: 'Garden Sage',
    description: 'Natural parchment with sage and terracotta tones. Earthy, botanical, calm.',
    colors: { bg: '#F5F0E8', text: '#2D3A2E', accent: '#7A8B6F', secondary: '#B0886D', muted: '#9AA095' },
    fonts: { heading: 'EB Garamond', body: 'Source Sans 3' },
  },
  {
    id: 'royal-burgundy',
    name: 'Royal Burgundy',
    description: 'Ivory with deep burgundy and antique brass. Regal, traditional, ceremonial.',
    colors: { bg: '#FCF9F2', text: '#3C1F1F', accent: '#7A1F2B', secondary: '#8B6F3A', muted: '#A89888' },
    fonts: { heading: 'Bodoni Moda', body: 'EB Garamond' },
  },
  {
    id: 'modern-noir',
    name: 'Modern Noir',
    description: 'Crisp white with stark black type and a single gold accent. Minimal, editorial.',
    colors: { bg: '#FFFFFF', text: '#1A1A1A', accent: '#D4AF37', secondary: '#6B6B6B', muted: '#A0A0A0' },
    fonts: { heading: 'DM Serif Display', body: 'Inter' },
  },
];

const COLOR_PRESETS: { value: string; label: string }[] = [
  { value: '#FCF9F2', label: 'Paper Cream' },
  { value: '#FDF6EC', label: 'Warm Ivory' },
  { value: '#F5F0E8', label: 'Linen' },
  { value: '#FAF3E0', label: 'Champagne' },
  { value: '#F0EDE8', label: 'Stone' },
  { value: '#EDE8E0', label: 'Sand' },
  { value: '#F7F1E8', label: 'Parchment' },
  { value: '#FFF8F0', label: 'Blush Cream' },
  { value: '#F5EFE6', label: 'Oat' },
  { value: '#EDEDEB', label: 'Silver Mist' },
  { value: '#2C2C2C', label: 'Dark Charcoal' },
  { value: '#1A1A1A', label: 'Deep Black' },
];

const FONT_OPTIONS: { value: string; category: string }[] = [
  // ── Elegant Serif ────────────────────────────────────────
  { value: 'Playfair Display', category: 'Elegant Serif' },
  { value: 'Cormorant Garamond', category: 'Elegant Serif' },
  { value: 'EB Garamond', category: 'Elegant Serif' },
  { value: 'Lora', category: 'Elegant Serif' },
  { value: 'Spectral', category: 'Elegant Serif' },
  { value: 'Libre Baskerville', category: 'Elegant Serif' },
  { value: 'Merriweather', category: 'Elegant Serif' },
  { value: 'DM Serif Display', category: 'Elegant Serif' },
  { value: 'Bodoni Moda', category: 'Elegant Serif' },
  { value: 'Philosopher', category: 'Elegant Serif' },
  // ── Display Serif ────────────────────────────────────────
  { value: 'Cinzel', category: 'Display Serif' },
  { value: 'Cinzel Decorative', category: 'Display Serif' },
  { value: 'Prata', category: 'Display Serif' },
  { value: 'Italiana', category: 'Display Serif' },
  { value: 'Arizonia', category: 'Display Serif' },
  // ── Modern Sans ─────────────────────────────────────────
  { value: 'Montserrat', category: 'Modern Sans' },
  { value: 'Raleway', category: 'Modern Sans' },
  { value: 'Poppins', category: 'Modern Sans' },
  { value: 'Lato', category: 'Modern Sans' },
  { value: 'Quicksand', category: 'Modern Sans' },
  { value: 'Nunito', category: 'Modern Sans' },
  { value: 'Work Sans', category: 'Modern Sans' },
  { value: 'Josefin Sans', category: 'Modern Sans' },
  // ── Script & Calligraphy ─────────────────────────────────
  { value: 'Great Vibes', category: 'Script & Calligraphy' },
  { value: 'Alex Brush', category: 'Script & Calligraphy' },
  { value: 'Allura', category: 'Script & Calligraphy' },
  { value: 'Parisienne', category: 'Script & Calligraphy' },
  { value: 'Tangerine', category: 'Script & Calligraphy' },
  { value: 'Sacramento', category: 'Script & Calligraphy' },
  { value: 'Petit Formal Script', category: 'Script & Calligraphy' },
  { value: 'Cookie', category: 'Script & Calligraphy' },
  // ── Handwritten ─────────────────────────────────────────
  { value: 'Dancing Script', category: 'Handwritten' },
  { value: 'Kaushan Script', category: 'Handwritten' },
  { value: 'Caveat', category: 'Handwritten' },
  { value: 'Amatic SC', category: 'Handwritten' },
  { value: 'Satisfy', category: 'Handwritten' },
  { value: 'Pacifico', category: 'Handwritten' },
  { value: 'Lobster', category: 'Handwritten' },
  { value: 'Yellowtail', category: 'Handwritten' },
];
const FONT_CATEGORIES = [...new Set(FONT_OPTIONS.map((f) => f.category))];

// ── SimpleImageGallery component ───────────────────────────────────────────
// A gallery that stores images as data URLs in the template's media JSON array.
// Visual parity with the couple CMS MirrorImageGallery (click-to-preview Dialog,
// drag-drop anywhere on the grid, file name display, count badge in header,
// max-image enforcement, hover-to-delete with confirm) but writes its value
// into in-memory template state via onAdd/onRemove rather than calling any API.

interface SimpleImageGalleryProps {
  media: MediaItem[];
  onAdd: (url: string) => void;
  onRemove: (index: number) => void;
  maxImages: number;
  aspectClass: string;
  label: string;
  helperText?: string;
}

function SimpleImageGallery({ media, onAdd, onRemove, maxImages, aspectClass, label, helperText }: SimpleImageGalleryProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const canAddMore = media.length < maxImages;

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = maxImages - media.length;
    if (remaining <= 0) return;
    const toRead = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, remaining);
    if (toRead.length === 0) return;
    setUploading(true);
    let done = 0;
    const finish = () => { done++; if (done === toRead.length) setUploading(false); };
    toRead.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => { onAdd(reader.result as string); finish(); };
      reader.onerror = finish;
      reader.readAsDataURL(file);
    });
  }

  function handleRemove(idx: number) {
    if (!confirm('Delete this image? This action cannot be undone.')) return;
    setDeleting(idx);
    onRemove(idx);
    setTimeout(() => setDeleting(null), 300);
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />

      {/* Header — label + count badge + Add Image button (mirrors MirrorImageGallery) */}
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-charcoal-ink/70 uppercase tracking-wider">
            {label} <span className="text-charcoal-ink/40 font-normal">({media.length}/{maxImages})</span>
          </p>
          {helperText && <p className="text-[11px] text-charcoal-ink/40 mt-0.5">{helperText}</p>}
        </div>
        {canAddMore && (
          <Button
            type="button"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="h-8 text-xs gap-1.5 bg-charcoal-ink text-paper-cream hover:bg-charcoal-ink/90 shrink-0"
          >
            {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
            Add Image
          </Button>
        )}
      </div>

      {/* Grid — drag-drop anywhere */}
      <div
        className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 rounded-lg p-1 transition-colors ${dragOver ? 'bg-cinematic-gold/5' : ''}`}
        onDragOver={(e) => { e.preventDefault(); if (canAddMore) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (canAddMore) handleFiles(e.dataTransfer.files); }}
      >
        {media.map((item, idx) => (
          <Card key={idx} className="border-charcoal-ink/5 shadow-none overflow-hidden group hover:border-champagne-silk transition-colors duration-200">
            <div
              className={`relative ${aspectClass} bg-charcoal-ink/5 cursor-pointer`}
              onClick={() => setPreviewUrl(item.url)}
            >
              <img src={item.url} alt={item.fileName} className="w-full h-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors duration-200 flex items-center justify-center gap-2">
                <Eye className="size-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRemove(idx); }}
                disabled={deleting === idx}
                className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/50 text-white hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100"
                title="Delete image"
              >
                {deleting === idx ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
              </button>
            </div>
            <div className="p-2 space-y-1.5">
              <p className="text-[11px] font-medium text-charcoal-ink/60 truncate" title={item.fileName}>
                {item.fileName}
              </p>
            </div>
          </Card>
        ))}

        {/* Empty state OR add-more tile */}
        {canAddMore && media.length === 0 && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className={`col-span-full ${aspectClass} min-h-[200px] rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 p-6 text-center transition-colors ${
              dragOver
                ? 'border-cinematic-gold bg-cinematic-gold/5'
                : 'border-charcoal-ink/15 hover:border-cinematic-gold/60 hover:bg-cinematic-gold/5'
            }`}
          >
            {uploading ? (
              <Loader2 className="size-7 animate-spin text-cinematic-gold" />
            ) : (
              <>
                <div className="flex items-center justify-center h-11 w-11 rounded-full bg-cinematic-gold/10">
                  <ImagePlus className="size-5 text-cinematic-gold" />
                </div>
                <p className="text-sm font-medium text-charcoal-ink/70">Drag &amp; drop images, or</p>
                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium bg-charcoal-ink text-paper-cream">
                  <ImagePlus className="size-3.5" /> Add Images
                </span>
                <p className="text-[11px] text-charcoal-ink/40 mt-1">Up to {maxImages} · Mirrors guest-site framing</p>
              </>
            )}
          </button>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="sm:max-w-2xl p-2">
          <DialogHeader>
            <DialogTitle className="sr-only">Image Preview</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <img src={previewUrl} alt="Preview" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── TemplateColorPicker ────────────────────────────────────────────────────
// Controlled version of the couple CMS BackgroundColorPicker. Mirrors its UX
// (12 named presets, auto-text-contrast preview bar, reset-to-default, custom
// colour input) but writes its value into in-memory template state via onChange
// rather than calling any API. Used for all 5 theme colour slots.

interface TemplateColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  defaultColor?: string;
}

function TemplateColorPicker({ value, onChange, label, defaultColor }: TemplateColorPickerProps) {
  const isDark = isDarkBackground(value);
  const autoText = getAutoTextColor(value);
  const isActive = (preset: string) => value.toUpperCase() === preset.toUpperCase();

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Palette className="size-4 text-cinematic-gold" />
        <Label className="text-xs font-medium text-charcoal-ink/50 uppercase tracking-wider">{label}</Label>
      </div>
      {/* Current colour preview bar */}
      <div
        className="relative h-11 rounded-md border border-charcoal-ink/10 overflow-hidden transition-colors duration-300"
        style={{ backgroundColor: value }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center text-xs font-medium opacity-70 transition-colors duration-300"
          style={{ color: autoText }}
        >
          {value.toUpperCase()}
          <span className="ml-2 opacity-70">— {isDark ? 'Dark' : 'Light'}</span>
        </div>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          title="Pick a custom colour"
        />
      </div>
      {/* Preset swatches grid */}
      <div className="grid grid-cols-6 gap-1.5">
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => onChange(preset.value)}
            className={`group relative h-8 rounded-md border transition-all duration-150 ${
              isActive(preset.value)
                ? 'border-cinematic-gold ring-2 ring-cinematic-gold/30 scale-105'
                : 'border-charcoal-ink/10 hover:border-cinematic-gold/50 hover:scale-105'
            }`}
            style={{ backgroundColor: preset.value }}
            title={preset.label}
            aria-label={preset.label}
          >
            {isActive(preset.value) && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ color: isDarkBackground(preset.value) ? '#E8E0D0' : '#1A1A1A' }}
              >
                <Check className="size-3" strokeWidth={3} />
              </div>
            )}
            <span
              className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-charcoal-ink text-paper-cream opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10"
            >
              {preset.label}
            </span>
          </button>
        ))}
      </div>
      {defaultColor && value.toUpperCase() !== defaultColor.toUpperCase() && (
        <button
          type="button"
          onClick={() => onChange(defaultColor)}
          className="text-[11px] text-charcoal-ink/40 hover:text-cinematic-gold transition-colors"
        >
          Reset to default ({defaultColor})
        </button>
      )}
    </div>
  );
}

// ── TemplateFontPicker ─────────────────────────────────────────────────────
// Controlled version of the couple CMS FontPicker. Mirrors its UX (38
// categorised fonts, scrollable list with sticky category headers, live
// preview, selected highlight + checkmark) but writes its value into
// in-memory template state via onChange rather than calling any API.

interface TemplateFontPickerProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  previewText: string;
}

function TemplateFontPicker({ value, onChange, label, previewText }: TemplateFontPickerProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.querySelector(`[data-font="${value}"]`);
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [value]);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Type className="size-4 text-cinematic-gold" />
        <Label className="text-xs font-medium text-charcoal-ink/50 uppercase tracking-wider">{label}</Label>
      </div>
      {/* Preview */}
      <div className="min-w-0">
        <p
          className="text-lg text-charcoal-ink leading-snug truncate"
          style={{ fontFamily: `'${value}', serif` }}
        >
          {previewText}
        </p>
        <p
          className="text-[11px] text-charcoal-ink/40 mt-0.5 italic truncate"
          style={{ fontFamily: `'${value}', serif` }}
        >
          Together with their families
        </p>
      </div>
      {/* Scrollable font list */}
      <div>
        <Label className="text-xs font-medium text-charcoal-ink/50 uppercase tracking-wider mb-2 block">
          Choose Font
        </Label>
        <div
          ref={listRef}
          className="max-h-[220px] overflow-y-auto rounded-lg border border-charcoal-ink/10 bg-white/50"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#D4AF37 transparent' }}
        >
          {FONT_CATEGORIES.map((category) => (
            <div key={category}>
              <div className="sticky top-0 z-10 bg-paper-cream/95 backdrop-blur-sm px-3 py-1.5">
                <span className="text-[10px] text-cinematic-gold/70 font-semibold uppercase tracking-widest">
                  {category}
                </span>
              </div>
              {FONT_OPTIONS.filter((f) => f.category === category).map((font) => {
                const isSelected = font.value === value;
                return (
                  <button
                    key={font.value}
                    type="button"
                    data-font={font.value}
                    onClick={() => onChange(font.value)}
                    className={`w-full text-left transition-colors duration-150 ${
                      isSelected
                        ? 'bg-cinematic-gold/10 border-l-2 border-cinematic-gold'
                        : 'border-l-2 border-transparent hover:bg-charcoal-ink/[0.03]'
                    }`}
                  >
                    <div className="px-3 py-1.5">
                      <p
                        className="text-base text-charcoal-ink leading-snug truncate"
                        style={{ fontFamily: `'${font.value}', serif` }}
                      >
                        Eleanor & James
                      </p>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className={`text-[10px] ${isSelected ? 'text-cinematic-gold font-semibold' : 'text-charcoal-ink/35'}`}>
                          {font.value}
                        </span>
                        {isSelected && <Check className="size-3 text-cinematic-gold" strokeWidth={3} />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function TemplateEditor() {
  const { editingTemplateId, setPage } = useCMSStore();
  const [data, setData] = useState<TemplateData | null>(null);
  const [baselineData, setBaselineData] = useState<TemplateData | null>(null);
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
      const loaded: TemplateData = {
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
      };
      setData(loaded);
      setBaselineData(JSON.parse(JSON.stringify(loaded)));
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

  function applyThemePreset(preset: typeof THEME_PRESETS[number]) {
    if (!data) return;
    setData({
      ...data,
      theme: { colors: { ...preset.colors }, fonts: { ...preset.fonts } },
    });
    setDirty(true);
  }

  // Determine which preset is currently applied (by matching all 5 colors + 2 fonts)
  const appliedPresetId = (() => {
    if (!data) return null;
    return THEME_PRESETS.find((t) =>
      t.colors.bg.toUpperCase() === data.theme.colors.bg.toUpperCase() &&
      t.colors.text.toUpperCase() === data.theme.colors.text.toUpperCase() &&
      t.colors.accent.toUpperCase() === data.theme.colors.accent.toUpperCase() &&
      t.colors.secondary.toUpperCase() === data.theme.colors.secondary.toUpperCase() &&
      t.colors.muted.toUpperCase() === data.theme.colors.muted.toUpperCase() &&
      t.fonts.heading === data.theme.fonts.heading &&
      t.fonts.body === data.theme.fonts.body,
    )?.id ?? null;
  })();

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
      setBaselineData(JSON.parse(JSON.stringify(data)));
      setDirty(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to save template', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    if (!baselineData) return;
    if (!confirm('Discard all unsaved changes? This cannot be undone.')) return;
    setData(JSON.parse(JSON.stringify(baselineData)));
    setDirty(false);
  }

  // ── Dirty tracking helpers (P2-14) ─────────────────────────────────────

  function isContentFieldDirty(section: string, fieldKey: string): boolean {
    if (!data || !baselineData) return false;
    const current = data.content.find((c) => c.section === section && c.fieldKey === fieldKey);
    const baseline = baselineData.content.find((c) => c.section === section && c.fieldKey === fieldKey);
    if (!current && !baseline) return false;
    if (!current || !baseline) return true;
    return current.fieldValue !== baseline.fieldValue;
  }

  function isThemeDirty(): boolean {
    if (!data || !baselineData) return false;
    return JSON.stringify(data.theme) !== JSON.stringify(baselineData.theme);
  }

  function getDirtyCount(): number {
    if (!data || !baselineData) return 0;
    let count = 0;
    // Content fields — changed or new
    const baselineKeys = new Set(baselineData.content.map((c) => `${c.section}:${c.fieldKey}`));
    for (const item of data.content) {
      if (isContentFieldDirty(item.section, item.fieldKey)) count++;
    }
    // Deleted content fields
    const currentKeys = new Set(data.content.map((c) => `${c.section}:${c.fieldKey}`));
    for (const key of baselineKeys) {
      if (!currentKeys.has(key)) count++;
    }
    // Schedule changes
    if (JSON.stringify(data.schedule) !== JSON.stringify(baselineData.schedule)) count++;
    // Story changes
    if (JSON.stringify(data.stories) !== JSON.stringify(baselineData.stories)) count++;
    // FAQ changes
    if (JSON.stringify(data.faqs) !== JSON.stringify(baselineData.faqs)) count++;
    // Media changes
    if (JSON.stringify(data.media) !== JSON.stringify(baselineData.media)) count++;
    // Theme changes
    if (isThemeDirty()) count++;
    return count;
  }

  const dirtyCount = getDirtyCount();

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
    { key: 'details', label: 'Details', icon: Heart },
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
          <Button onClick={handleSave} disabled={!dirty || saving} className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90">
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

      {/* ── DETAILS SECTION ─────────────────────────────────────────────── */}
      {activeSection === 'details' && (
        <div className="space-y-6 max-w-5xl">
          {/* Page header */}
          <div className="flex items-center gap-2">
            <Heart className="size-5 text-cinematic-gold" />
            <div>
              <h3 className="text-lg font-semibold text-charcoal-ink">Couple Details</h3>
              <p className="text-xs text-charcoal-ink/50">Placeholder couple identity, date, and venue — cloned into new weddings created from this template.</p>
            </div>
          </div>

          <Separator className="bg-champagne-silk" />

          {/* Couple Names */}
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-5">
              <h4 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider flex items-center gap-2">
                <Heart className="size-4 text-cinematic-gold" />
                Couple Names
              </h4>
              <div className="space-y-1.5">
                <Label className="text-xs tracking-wider uppercase font-semibold text-charcoal-ink/50">
                  Couple Display Name
                  {isContentFieldDirty('details', 'coupleName') && (
                    <span className="inline-block size-1.5 rounded-full bg-cinematic-gold ml-1.5 align-middle" title="Modified" />
                  )}
                </Label>
                <Input
                  value={getContentField('details', 'coupleName')}
                  onChange={(e) => setContentField('details', 'coupleName', e.target.value)}
                  placeholder="e.g. Eleanor & James"
                  className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                />
                <p className="text-[11px] text-charcoal-ink/40">Shown across the guest site as the main couple identity.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs tracking-wider uppercase font-semibold text-charcoal-ink/50">
                    Bride&rsquo;s First Name
                  </Label>
                  <Input
                    value={getContentField('details', 'brideName')}
                    onChange={(e) => setContentField('details', 'brideName', e.target.value)}
                    placeholder="Eleanor"
                    className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs tracking-wider uppercase font-semibold text-charcoal-ink/50">
                    Groom&rsquo;s First Name
                  </Label>
                  <Input
                    value={getContentField('details', 'groomName')}
                    onChange={(e) => setContentField('details', 'groomName', e.target.value)}
                    placeholder="James"
                    className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Date & Time */}
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-5">
              <h4 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider flex items-center gap-2">
                <CalendarDays className="size-4 text-cinematic-gold" />
                Date &amp; Time
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs tracking-wider uppercase font-semibold text-charcoal-ink/50">
                    Wedding Date
                  </Label>
                  <Input
                    type="date"
                    value={getContentField('details', 'weddingDate')}
                    onChange={(e) => setContentField('details', 'weddingDate', e.target.value)}
                    className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                  />
                  <p className="text-[11px] text-charcoal-ink/40">Used for the countdown timer and schedule.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs tracking-wider uppercase font-semibold text-charcoal-ink/50">
                    Wedding Time
                  </Label>
                  <Input
                    type="time"
                    value={getContentField('details', 'weddingTime')}
                    onChange={(e) => setContentField('details', 'weddingTime', e.target.value)}
                    className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                  />
                  <p className="text-[11px] text-charcoal-ink/40">Ceremony start time.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Venue */}
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-5">
              <h4 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider flex items-center gap-2">
                <MapPin className="size-4 text-cinematic-gold" />
                Venue Information
              </h4>
              <div className="space-y-1.5">
                <Label className="text-xs tracking-wider uppercase font-semibold text-charcoal-ink/50">
                  Venue Name
                </Label>
                <Input
                  value={getContentField('details', 'venue')}
                  onChange={(e) => setContentField('details', 'venue', e.target.value)}
                  placeholder="e.g. The Fullerton Hotel"
                  className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs tracking-wider uppercase font-semibold text-charcoal-ink/50">
                  Venue Address
                </Label>
                <Textarea
                  value={getContentField('details', 'venueAddress')}
                  onChange={(e) => setContentField('details', 'venueAddress', e.target.value)}
                  placeholder="Full venue address"
                  rows={3}
                  className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20 resize-none"
                />
                <p className="text-[11px] text-charcoal-ink/40">Shown on the Getting There section.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs tracking-wider uppercase font-semibold text-charcoal-ink/50">
                  Google Maps URL
                </Label>
                <Input
                  value={getContentField('details', 'googleMapsUrl')}
                  onChange={(e) => setContentField('details', 'googleMapsUrl', e.target.value)}
                  placeholder="https://maps.google.com/..."
                  className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── HOME SECTION ────────────────────────────────────────────────── */}
      {activeSection === 'home' && (
        <div className="space-y-6 max-w-5xl">
          {/* Page header */}
          <div className="flex items-center gap-2">
            <HomeIcon className="size-5 text-cinematic-gold" />
            <div>
              <h3 className="text-lg font-semibold text-charcoal-ink">Home Section</h3>
              <p className="text-xs text-charcoal-ink/50">Hero visual, banner, ambient animations, and narrative content shown at the top of the guest site.</p>
            </div>
          </div>

          <Separator className="bg-champagne-silk" />

          {/* Hero Visual + Banner */}
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Hero Visual</h3>
              <p className="text-xs text-charcoal-ink/40">Full-bleed hero image shown at the top of the guest site.</p>
              {HERO_VISUAL_FIELDS.map((field) => (
                <MirrorImageUpload
                  key={field.key}
                  value={getContentField('hero', field.key) || ''}
                  onChange={(v) => setContentField('hero', field.key, v, 'IMAGE_URL')}
                  onRemove={() => setContentField('hero', field.key, '', 'IMAGE_URL')}
                  label={field.label}
                  helperText="Mirrors guest-site framing"
                  aspectClass={field.aspect}
                  maxWidth={field.maxWidth}
                />
              ))}
              {/* Hero Video URL */}
              <div className="space-y-1.5">
                <Label className="text-xs tracking-wider uppercase font-semibold text-charcoal-ink/50">
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

          <Separator className="bg-champagne-silk" />

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

          <Separator className="bg-champagne-silk" />

          {/* Hero Content */}
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Hero Content</h3>
              {/* Non-tea-ceremony hero fields */}
              {HOME_FIELDS.filter((f) => !f.key.startsWith('teaCeremony')).map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-xs tracking-wider uppercase font-semibold text-charcoal-ink/50">
                    {field.label}
                    {isContentFieldDirty('hero', field.key) && (
                      <span className="inline-block size-1.5 rounded-full bg-cinematic-gold ml-1.5 align-middle" title="Modified" />
                    )}
                  </Label>
                  {field.type === 'textarea' ? (
                    <Textarea
                      value={getContentField('hero', field.key)}
                      onChange={(e) => setContentField('hero', field.key, e.target.value, 'RICHTEXT')}
                      placeholder={field.placeholder}
                      className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                      rows={3}
                    />
                  ) : (
                    <Input
                      type={field.type === 'date' ? 'date' : 'text'}
                      value={getContentField('hero', field.key)}
                      onChange={(e) => setContentField('hero', field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                    />
                  )}
                  {field.helperText && (
                    <p className="text-[11px] text-charcoal-ink/40">{field.helperText}</p>
                  )}
                </div>
              ))}

              {/* Tea Ceremony section — switch + dimmable fields */}
              <Separator className="bg-champagne-silk" />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-charcoal-ink">Tea Ceremony Section
                    {isContentFieldDirty('hero', 'teaCeremonyEnabled') && (
                      <span className="inline-block size-1.5 rounded-full bg-cinematic-gold ml-1.5 align-middle" title="Modified" />
                    )}
                  </p>
                  <p className="text-xs text-charcoal-ink/40">Show the tea ceremony block on the guest site.</p>
                </div>
                <Switch
                  checked={getContentField('hero', 'teaCeremonyEnabled') !== 'false'}
                  onCheckedChange={(checked) => setContentField('hero', 'teaCeremonyEnabled', String(checked), 'TEXT')}
                />
              </div>
              <div className={`space-y-5 transition-opacity duration-200 ${getContentField('hero', 'teaCeremonyEnabled') === 'false' ? 'opacity-40 pointer-events-none' : ''}`}>
                {HOME_FIELDS.filter((f) => f.key.startsWith('teaCeremony')).map((field) => (
                  field.type === 'image' ? (
                    <MirrorImageUpload
                      key={field.key}
                      value={getContentField('hero', field.key) || ''}
                      onChange={(v) => setContentField('hero', field.key, v, 'IMAGE_URL')}
                      onRemove={() => setContentField('hero', field.key, '', 'IMAGE_URL')}
                      label="Tea Ceremony Image"
                      helperText="2:3 portrait · mirrors guest-site framing"
                      aspectClass="aspect-[2/3]"
                      maxWidth="240px"
                    />
                  ) : (
                    <div key={field.key} className="space-y-1.5">
                      <Label className="text-xs tracking-wider uppercase font-semibold text-charcoal-ink/50">
                        {field.label}
                      </Label>
                      {field.type === 'textarea' ? (
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
                  )
                ))}
              </div>
            </CardContent>
          </Card>

        </div>
      )}

      {/* ── DESIGN SECTION ──────────────────────────────────────────────── */}
      {activeSection === 'design' && (
        <div className="space-y-6 max-w-5xl">
          {/* Page header */}
          <div className="flex items-center gap-2">
            <Palette className="size-5 text-cinematic-gold" />
            <div>
              <h3 className="text-lg font-semibold text-charcoal-ink">Design</h3>
              <p className="text-xs text-charcoal-ink/50">Browse curated themes, then fine-tune colours and fonts.</p>
            </div>
          </div>

          <Separator className="bg-champagne-silk" />

          {/* Preset theme cards grid (mirrors CoupleDesign) */}
          <div>
            <Label className="text-xs font-medium text-charcoal-ink/50 uppercase tracking-wider mb-3 block">
              Choose a Theme ({THEME_PRESETS.length} available)
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {THEME_PRESETS.map((t) => {
                const isApplied = appliedPresetId === t.id;
                return (
                  <div
                    key={t.id}
                    className={`relative rounded-lg border-2 p-4 transition-all ${
                      isApplied
                        ? 'border-cinematic-gold bg-cinematic-gold/5'
                        : 'border-charcoal-ink/10 hover:border-champagne-silk'
                    }`}
                  >
                    {/* Applied badge */}
                    {isApplied && (
                      <div className="absolute -top-2 -right-2 flex items-center gap-1 rounded-full bg-cinematic-gold px-2 py-0.5 text-[10px] font-semibold text-charcoal-ink">
                        <Check className="size-2.5" />
                        Applied
                      </div>
                    )}
                    {/* Color palette preview */}
                    <div className="flex gap-1.5 mb-3">
                      {[t.colors.bg, t.colors.text, t.colors.accent, t.colors.secondary, t.colors.muted].map((c, i) => (
                        <div
                          key={i}
                          className="h-8 flex-1 rounded border border-charcoal-ink/10"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    {/* Template info */}
                    <h4 className="text-sm font-semibold text-charcoal-ink">{t.name}</h4>
                    {t.isDefault && (
                      <span className="inline-block text-[10px] text-cinematic-gold uppercase tracking-wider mt-0.5">Default</span>
                    )}
                    <p className="text-[11px] text-charcoal-ink/50 mt-1 leading-relaxed line-clamp-2">{t.description}</p>
                    <p className="text-[10px] text-charcoal-ink/40 mt-2">
                      <span className="font-medium">Fonts:</span> {t.fonts.heading} / {t.fonts.body}
                    </p>
                    {/* Apply button */}
                    <Button
                      type="button"
                      onClick={() => applyThemePreset(t)}
                      disabled={isApplied}
                      variant={isApplied ? 'outline' : 'default'}
                      className="w-full mt-3 h-8 text-xs font-medium rounded-md bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90 disabled:opacity-60"
                    >
                      {isApplied ? (
                        <>
                          <Check className="size-3 mr-1" />
                          Applied
                        </>
                      ) : (
                        'Apply Theme'
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator className="bg-champagne-silk" />

          {/* Colours — one TemplateColorPicker per slot (bg / text / accent / secondary / muted) */}
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">
                Theme Colours
                {isThemeDirty() && (
                  <span className="inline-block size-1.5 rounded-full bg-cinematic-gold ml-1.5 align-middle" title="Modified" />
                )}
              </h3>
              <p className="text-xs text-charcoal-ink/40">Each colour slot shows a live preview with auto-contrast detection, 12 named presets, and a custom colour picker.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <TemplateColorPicker
                  label="Background"
                  value={data.theme.colors.bg}
                  onChange={(v) => updateThemeColor('bg', v)}
                  defaultColor="#FDF8F0"
                />
                <TemplateColorPicker
                  label="Text"
                  value={data.theme.colors.text}
                  onChange={(v) => updateThemeColor('text', v)}
                  defaultColor="#2C2C2C"
                />
                <TemplateColorPicker
                  label="Accent"
                  value={data.theme.colors.accent}
                  onChange={(v) => updateThemeColor('accent', v)}
                  defaultColor="#D4AF37"
                />
                <TemplateColorPicker
                  label="Secondary"
                  value={data.theme.colors.secondary}
                  onChange={(v) => updateThemeColor('secondary', v)}
                  defaultColor="#8B7355"
                />
                <TemplateColorPicker
                  label="Muted"
                  value={data.theme.colors.muted}
                  onChange={(v) => updateThemeColor('muted', v)}
                  defaultColor="#A09888"
                />
              </div>
            </CardContent>
          </Card>

          {/* Typography — TemplateFontPicker for heading + body (mirrors FontPicker) */}
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">
                Typography
                {isThemeDirty() && (
                  <span className="inline-block size-1.5 rounded-full bg-cinematic-gold ml-1.5 align-middle" title="Modified" />
                )}
              </h3>
              <p className="text-xs text-charcoal-ink/40">39 categorised fonts with live preview. Click a font to apply it instantly to the template.</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TemplateFontPicker
                  label="Heading Font"
                  value={data.theme.fonts.heading}
                  onChange={(v) => updateThemeFont('heading', v)}
                  previewText="Eleanor & James"
                />
                <TemplateFontPicker
                  label="Body Font"
                  value={data.theme.fonts.body}
                  onChange={(v) => updateThemeFont('body', v)}
                  previewText="Together with their families"
                />
              </div>
            </CardContent>
          </Card>

          {/* Current theme summary (mirrors CoupleDesign summary card) */}
          <div className="bg-paper-cream rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-cinematic-gold" />
              <p className="text-xs font-medium text-charcoal-ink/70 uppercase tracking-wider">Current Theme</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-charcoal-ink/50">Background:</span>{' '}
                <span className="font-mono text-charcoal-ink">{data.theme.colors.bg}</span>
              </div>
              <div>
                <span className="text-charcoal-ink/50">Text:</span>{' '}
                <span className="font-mono text-charcoal-ink">{data.theme.colors.text}</span>
              </div>
              <div>
                <span className="text-charcoal-ink/50">Accent:</span>{' '}
                <span className="font-mono text-charcoal-ink">{data.theme.colors.accent}</span>
              </div>
              <div>
                <span className="text-charcoal-ink/50">Heading Font:</span>{' '}
                <span className="text-charcoal-ink">{data.theme.fonts.heading}</span>
              </div>
            </div>
            <p className="text-[11px] text-charcoal-ink/40 mt-2">
              Changes are saved when you click &quot;Save Template&quot;. Use the Preview tab to see the full guest-site rendering.
            </p>
          </div>
        </div>
      )}

      {/* ── SCHEDULE SECTION ────────────────────────────────────────────── */}
      {activeSection === 'schedule' && (
        <div className="space-y-6 max-w-5xl">
          {/* Page header */}
          <div className="flex items-center gap-2">
            <Calendar className="size-5 text-cinematic-gold" />
            <div>
              <h3 className="text-lg font-semibold text-charcoal-ink">Event Schedule</h3>
              <p className="text-xs text-charcoal-ink/50">Section text, timeline of events, schedule images, and venue information.</p>
            </div>
          </div>

          <Separator className="bg-champagne-silk" />

          {/* Schedule Section Text (moved from Home tab per P2-17) */}
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Schedule Section Text</h3>
              {SCHEDULE_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-xs tracking-wider uppercase font-semibold text-charcoal-ink/50">
                    {field.label}
                    {isContentFieldDirty('schedule', field.key) && (
                      <span className="inline-block size-1.5 rounded-full bg-cinematic-gold ml-1.5 align-middle" title="Modified" />
                    )}
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

          <Separator className="bg-champagne-silk" />

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Event Schedule</h3>
            <Button size="sm" onClick={openAddSchedule} className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90">
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
                          <Badge variant="outline" className={`text-xs border ${eventType.color}`}>{eventType.label}</Badge>
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
          <Separator className="bg-champagne-silk" />
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6">
              <SimpleImageGallery
                media={data.media.filter((m) => m.category === 'schedule')}
                onAdd={(url) => addMediaItem('schedule', url)}
                onRemove={(idx) => removeMediaItem('schedule', idx)}
                maxImages={3}
                aspectClass="aspect-[4/3]"
                label="Schedule Images"
                helperText="4:3 crop mirrors the guest-site schedule images. Up to 3 images."
              />
            </CardContent>
          </Card>

          {/* Venue Information (moved from Getting There per P2-18) */}
          <Separator className="bg-champagne-silk" />
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Venue Information
                  {isContentFieldDirty('getting-there', 'venueEnabled') && (
                    <span className="inline-block size-1.5 rounded-full bg-cinematic-gold ml-1.5 align-middle" title="Modified" />
                  )}
                </h3>
                <Switch
                  checked={getContentField('getting-there', 'venueEnabled') !== 'false'}
                  onCheckedChange={(checked) => setContentField('getting-there', 'venueEnabled', String(checked), 'TEXT')}
                />
              </div>
              <div className={`space-y-5 transition-opacity duration-200 ${getContentField('getting-there', 'venueEnabled') === 'false' ? 'opacity-40 pointer-events-none' : ''}`}>
                <div className="space-y-1.5">
                  <Label className="text-xs tracking-wider uppercase font-semibold text-charcoal-ink/50">Venue Description</Label>
                  <Textarea
                    value={getContentField('getting-there', 'venueDescription')}
                    onChange={(e) => setContentField('getting-there', 'venueDescription', e.target.value, 'RICHTEXT')}
                    placeholder="The Fullerton Hotel is a historic landmark..."
                    className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                    rows={3}
                  />
                </div>
                <MirrorImageUpload
                  value={getContentField('getting-there', 'venueImage') || ''}
                  onChange={(v) => setContentField('getting-there', 'venueImage', v, 'IMAGE_URL')}
                  onRemove={() => setContentField('getting-there', 'venueImage', '', 'IMAGE_URL')}
                  label="Venue Image"
                  helperText="4:3 · mirrors guest-site framing"
                  aspectClass="aspect-[4/3]"
                  maxWidth="320px"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── STORY SECTION ──────────────────────────────────────────────── */}
      {activeSection === 'story' && (
        <div className="space-y-6 max-w-5xl">
          {/* Page header */}
          <div className="flex items-center gap-2">
            <BookOpen className="size-5 text-cinematic-gold" />
            <div>
              <h3 className="text-lg font-semibold text-charcoal-ink">Our Love Story</h3>
              <p className="text-xs text-charcoal-ink/50">Section text, chapter timeline, hero images, tidbits, and honeymoon voting.</p>
            </div>
          </div>

          <Separator className="bg-champagne-silk" />

          {/* Section text */}
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Story Section Text</h3>
              <div className="space-y-1.5">
                <Label className="text-xs tracking-wider uppercase font-semibold text-charcoal-ink/50">Section Title</Label>
                <Input
                  value={getContentField('story', 'title')}
                  onChange={(e) => setContentField('story', 'title', e.target.value)}
                  placeholder="Our Love Story"
                  className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs tracking-wider uppercase font-semibold text-charcoal-ink/50">Section Subtitle</Label>
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
            <Button size="sm" onClick={openAddStory} className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90">
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
                        <MirrorImageUpload
                          value={item.imageUrl || ''}
                          onChange={(v) => setStoryImage(idx, v)}
                          onRemove={() => setStoryImage(idx, null)}
                          label="Chapter Image"
                          helperText="16:9 · mirrors guest-site framing"
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
            <CardContent className="p-6">
              <SimpleImageGallery
                media={data.media.filter((m) => m.category === 'story')}
                onAdd={(url) => addMediaItem('story', url)}
                onRemove={(idx) => removeMediaItem('story', idx)}
                maxImages={3}
                aspectClass="aspect-[16/9]"
                label="Story Hero Images"
                helperText="16:9 banner images at the top of the guest story page. Up to 3 images."
              />
            </CardContent>
          </Card>

          {/* Did You Know? (Tidbits) */}
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Did You Know? (Tidbits)
                  {isContentFieldDirty('story', 'tidbitsEnabled') && (
                    <span className="inline-block size-1.5 rounded-full bg-cinematic-gold ml-1.5 align-middle" title="Modified" />
                  )}
                </h3>
                <Switch
                  checked={getContentField('story', 'tidbitsEnabled') !== 'false'}
                  onCheckedChange={(checked) => setContentField('story', 'tidbitsEnabled', String(checked), 'TEXT')}
                />
              </div>
              <div className={`space-y-4 transition-opacity duration-200 ${getContentField('story', 'tidbitsEnabled') === 'false' ? 'opacity-40 pointer-events-none' : ''}`}>
              <p className="text-xs text-charcoal-ink/40">Fun facts about the couple displayed on the story page.</p>
              <div className="space-y-1.5">
                <Label className="text-xs tracking-wider uppercase font-semibold text-charcoal-ink/50">Tidbits Title</Label>
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
              </div>
            </CardContent>
          </Card>

          {/* Honeymoon Voting */}
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Honeymoon Destinations
                  {isContentFieldDirty('story', 'honeymoonEnabled') && (
                    <span className="inline-block size-1.5 rounded-full bg-cinematic-gold ml-1.5 align-middle" title="Modified" />
                  )}
                </h3>
                <Switch
                  checked={getContentField('story', 'honeymoonEnabled') !== 'false'}
                  onCheckedChange={(checked) => setContentField('story', 'honeymoonEnabled', String(checked), 'TEXT')}
                />
              </div>
              <div className={`space-y-4 transition-opacity duration-200 ${getContentField('story', 'honeymoonEnabled') === 'false' ? 'opacity-40 pointer-events-none' : ''}`}>
              <p className="text-xs text-charcoal-ink/40">Destinations guests can vote on for the couple's honeymoon.</p>
              <div className="space-y-1.5">
                <Label className="text-xs tracking-wider uppercase font-semibold text-charcoal-ink/50">Honeymoon Section Eyebrow</Label>
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
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── FAQs SECTION ───────────────────────────────────────────────── */}
      {activeSection === 'faqs' && (
        <div className="space-y-6 max-w-5xl">
          {/* Page header */}
          <div className="flex items-center gap-2">
            <HelpCircle className="size-5 text-cinematic-gold" />
            <div>
              <h3 className="text-lg font-semibold text-charcoal-ink">Questions &amp; Answers</h3>
              <p className="text-xs text-charcoal-ink/50">Section text and the list of frequently asked questions shown to guests.</p>
            </div>
          </div>

          <Separator className="bg-champagne-silk" />

          {/* Section text */}
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Q&amp;A Section Text</h3>
              {QA_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-xs tracking-wider uppercase font-semibold text-charcoal-ink/50">
                    {field.label}
                    {isContentFieldDirty('qa', field.key) && (
                      <span className="inline-block size-1.5 rounded-full bg-cinematic-gold ml-1.5 align-middle" title="Modified" />
                    )}
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
            <Button size="sm" onClick={openAddFaq} className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90">
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
        <div className="space-y-6 max-w-5xl">
          {/* Page header */}
          <div className="flex items-center gap-2">
            <MapPin className="size-5 text-cinematic-gold" />
            <div>
              <h3 className="text-lg font-semibold text-charcoal-ink">Getting There</h3>
              <p className="text-xs text-charcoal-ink/50">Transit, driving, and parking directions. Venue image &amp; description are on the Schedule tab.</p>
            </div>
          </div>

          <Separator className="bg-champagne-silk" />

          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-5">
              <h4 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Directions Content</h4>
              {GETTING_THERE_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-xs tracking-wider uppercase font-semibold text-charcoal-ink/50">
                    {field.label}
                    {isContentFieldDirty('getting-there', field.key) && (
                      <span className="inline-block size-1.5 rounded-full bg-cinematic-gold ml-1.5 align-middle" title="Modified" />
                    )}
                  </Label>
                  {field.type === 'textarea' ? (
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
        <div className="space-y-6 max-w-5xl">
          {/* Page header */}
          <div className="flex items-center gap-2">
            <Camera className="size-5 text-cinematic-gold" />
            <div>
              <h3 className="text-lg font-semibold text-charcoal-ink">Moments</h3>
              <p className="text-xs text-charcoal-ink/50">Section text and the gallery of 3:4 portrait photos displayed on the guest site.</p>
            </div>
          </div>

          <Separator className="bg-champagne-silk" />

          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Moments Section Text</h3>
              {MOMENTS_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-xs tracking-wider uppercase font-semibold text-charcoal-ink/50">
                    {field.label}
                    {isContentFieldDirty('moments', field.key) && (
                      <span className="inline-block size-1.5 rounded-full bg-cinematic-gold ml-1.5 align-middle" title="Modified" />
                    )}
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
          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6">
              <SimpleImageGallery
                media={momentsImages()}
                onAdd={(url) => addMomentsImage(url, `moments-${Date.now()}.png`)}
                onRemove={(idx) => removeMomentsImage(idx)}
                maxImages={20}
                aspectClass="aspect-[3/4]"
                label="Gallery Images"
                helperText="3:4 portrait · mirrors guest-site framing"
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── WISHES SECTION ────────────────────────────────────────────── */}
      {activeSection === 'wishes' && (
        <div className="space-y-6 max-w-5xl">
          {/* Page header */}
          <div className="flex items-center gap-2">
            <MessageSquareHeart className="size-5 text-cinematic-gold" />
            <div>
              <h3 className="text-lg font-semibold text-charcoal-ink">Wishes &amp; Blessings</h3>
              <p className="text-xs text-charcoal-ink/50">Customise the text guests see on the wishes/blessings section of the guest site.</p>
            </div>
          </div>

          <Separator className="bg-champagne-silk" />

          <Card className="border-charcoal-ink/5 shadow-none">
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-charcoal-ink uppercase tracking-wider">Wishes Section Text</h3>
              <p className="text-xs text-charcoal-ink/40">Customise the text guests see on the wishes/blessings section.</p>
              {WISHES_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-xs tracking-wider uppercase font-semibold text-charcoal-ink/50">
                    {field.label}
                    {isContentFieldDirty('wishes', field.key) && (
                      <span className="inline-block size-1.5 rounded-full bg-cinematic-gold ml-1.5 align-middle" title="Modified" />
                    )}
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
        <div className="space-y-4 max-w-5xl">
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
              <Label className="text-xs uppercase tracking-wider text-charcoal-ink/50">Title <span className="text-red-500">*</span></Label>
              <Input value={scheduleForm.title} onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })} placeholder="Wedding Ceremony" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-charcoal-ink/50">Description</Label>
              <Textarea value={scheduleForm.description || ''} onChange={(e) => setScheduleForm({ ...scheduleForm, description: e.target.value })} placeholder="Exchange of vows and rings" rows={2} />
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
              <Label className="text-xs uppercase tracking-wider text-charcoal-ink/50">Chapter Title <span className="text-red-500">*</span></Label>
              <Input value={storyForm.title} onChange={(e) => setStoryForm({ ...storyForm, title: e.target.value })} placeholder="How We Met" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-charcoal-ink/50">Date</Label>
              <Input type="date" value={storyForm.date} onChange={(e) => setStoryForm({ ...storyForm, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-charcoal-ink/50">Content <span className="text-red-500">*</span></Label>
              <Textarea value={storyForm.content} onChange={(e) => setStoryForm({ ...storyForm, content: e.target.value })} placeholder="The story of how it all began..." rows={4} />
            </div>
            <p className="text-[11px] text-charcoal-ink/40">Add the chapter image via the inline upload on the chapter card after saving.</p>
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
              <Label className="text-xs uppercase tracking-wider text-charcoal-ink/50">Question <span className="text-red-500">*</span></Label>
              <Input value={faqForm.question} onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })} placeholder="What time should I arrive?" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-charcoal-ink/50">Answer <span className="text-red-500">*</span></Label>
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

      {/* ── Sticky bottom save bar (P2-15) ────────────────────────────────── */}
      {dirty && (
        <div className="sticky bottom-0 flex items-center justify-between gap-4 py-3 px-6 -mx-4 bg-white/95 backdrop-blur-md border-t border-charcoal-ink/10 z-20">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-cinematic-gold animate-pulse" />
            <p className="text-sm text-charcoal-ink/70">
              <span className="font-semibold text-charcoal-ink">{dirtyCount}</span> unsaved {dirtyCount === 1 ? 'change' : 'changes'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleDiscard}
              disabled={saving}
              className="border-charcoal-ink/15 text-charcoal-ink/60 hover:text-charcoal-ink hover:bg-red-50 hover:border-red-200"
            >
              Discard
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90"
            >
              {saving ? (
                <><Loader2 className="size-4 mr-2 animate-spin" />Saving...</>
              ) : (
                <><Save className="size-4 mr-2" />Save Changes ({dirtyCount})</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
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
  const countdownDate = getField('hero', 'countdownDate', '');
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
  // Tidbits + honeymoon data (read from template content JSON fields)
  const tidbitsEnabled = getField('story', 'tidbitsEnabled') !== 'false';
  const tidbitsTitle = getField('story', 'tidbitsTitle', 'Did You Know?');
  const tidbits: { q: string; a: string }[] = (() => {
    try { return JSON.parse(getField('story', 'tidbits') || '[]'); } catch { return []; }
  })();
  const honeymoonEnabled = getField('story', 'honeymoonEnabled') !== 'false';
  const honeymoonEyebrow = getField('story', 'honeymoonEyebrow', 'Where should we go?');
  const honeymoonDestinations: { name: string }[] = (() => {
    try { return JSON.parse(getField('story', 'honeymoonDestinations') || '[]'); } catch { return []; }
  })();
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
  // Gold standard's globals.css overrides .font-body-md to use Playfair Display
  // (the heading font) regardless of theme.fonts.body. Match that behavior here
  // so the preview accurately reflects what the guest site renders.
  const bodyFont = `'${theme.fonts.heading}', serif`;
  // Gold standard uses text-charcoal-ink/80 (dark gray at 80% opacity) for body text.
  // The theme's `text` color (#2C2C2C for Classic Elegance) is the closest match.
  const bodyTextColor = text;

  // ── Filtered media (moments gallery) ───────────────────────────────────
  const momentsMedia = media.filter((m) => m.category === 'moments');
  const storyImages = media.filter((m) => m.category === 'story');
  const scheduleImages = media.filter((m) => m.category === 'schedule');
  // Venue data (for schedule venue section)
  const venueImage = getField('getting-there', 'venueImage', '');
  const venueDescription = getField('getting-there', 'venueDescription', '');
  const venueName = getField('details', 'venue', '');

  // Format raw 24-hour time string ("10:00", "16:00") to 12-hour ("10:00 AM", "4:00 PM")
  const formatTime = (raw: string): string => {
    if (!raw) return '';
    const [h, m] = raw.split(':');
    const hour = parseInt(h, 10);
    if (isNaN(hour)) return raw;
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${m || '00'} ${period}`;
  };

  // ── Countdown (prefers countdownDate ISO field, falls back to dateDisplay) ─
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  useEffect(() => {
    const parseTarget = (isoDate: string, displayStr: string): number => {
      // Prefer the ISO countdownDate field (YYYY-MM-DD) — reliable parse
      if (isoDate) {
        const d = new Date(isoDate + 'T00:00:00');
        if (!isNaN(d.getTime())) return d.getTime();
      }
      // Fall back to dateDisplay (human-readable) — strip ordinal suffixes
      if (displayStr) {
        const cleaned = displayStr.replace(/(\d+)(st|nd|rd|th)/gi, '$1');
        const d = new Date(cleaned);
        if (!isNaN(d.getTime())) return d.getTime();
      }
      return Date.now() + 365 * 24 * 3600 * 1000;
    };
    const target = parseTarget(countdownDate, dateDisplay);
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
  }, [countdownDate, dateDisplay]);

  // ── FAQ accordion state ────────────────────────────────────────────────
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  // ── Section banner (shared across schedule / story / moments / qa) ──────
  // Mirrors src/components/wedding/SectionBanner.tsx: full-bleed banner
  // image with h1 title overlaid (NO subtitle on banner — subtitle is
  // rendered as an intro paragraph inside each section instead).
  // Uses light cream gradient + dark text (matching gold standard's
  // auto-contrast behavior for bright banner images).
  const renderSectionBanner = (title: string) => (
    <div
      className="relative w-full bg-cover bg-center flex items-center justify-center"
      style={{ backgroundImage: `url('${bannerUrl}')`, height: '420px' }}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(252,249,242,0.3), rgba(252,249,242,0.1) 50%, rgba(252,249,242,0.6))' }}
      />
      <div className="relative z-10 text-center px-6">
        <h1
          className="text-[44px] md:text-[72px] leading-[1.05] tracking-tight font-bold drop-shadow-sm"
          style={{ fontFamily: headingFont, color: '#1A1A1A' }}
        >
          {title}
        </h1>
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
              className="text-4xl md:text-6xl leading-[1.05] tracking-tight font-bold drop-shadow-sm"
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
        <div className="relative w-full overflow-hidden" style={{ height: '520px' }}>
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

        {/* ===== TEA CEREMONY (image on top + label + title + body, vertical) ===== */}
        <section className="py-14 px-6 md:px-10 max-w-5xl mx-auto">
          <div className="flex flex-col items-center gap-8">
            <div className="w-full max-w-2xl">
              <div className="aspect-[4/5] w-full overflow-hidden rounded-lg shadow-xl group">
                <img
                  src={teaCeremonyImage}
                  alt={teaCeremonyTitle}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
            </div>
            <div className="w-full max-w-2xl text-center">
              <span
                className="block mb-2 text-[10px] md:text-xs uppercase tracking-[0.2em] font-semibold"
                style={{ color: accent, fontFamily: headingFont }}
              >
                {teaCeremonyLabel}
              </span>
              <h3
                className="text-[48px] font-semibold mb-4 leading-[1.1]"
                style={{ fontFamily: headingFont, color: text }}
              >
                {teaCeremonyTitle}
              </h3>
              {teaCeremonyBody && (
                <p
                  className="text-sm md:text-base leading-relaxed max-w-xl mx-auto"
                  style={{ color: bodyTextColor, fontFamily: bodyFont }}
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
        >
          <span
            className="block mb-3 text-[10px] md:text-xs uppercase tracking-[0.2em] font-semibold"
            style={{ color: accent, fontFamily: headingFont }}
          >
            {narrativeLabel}
          </span>
          <h3
            className="text-[48px] font-semibold mb-4 leading-[1.1]"
            style={{ fontFamily: headingFont, color: text }}
          >
            {narrativeTitle}
          </h3>
          <p
            className="text-sm md:text-base leading-relaxed max-w-2xl mx-auto"
            style={{ color: bodyTextColor, fontFamily: bodyFont }}
          >
            {narrativeBody}
          </p>
        </section>

        {/* ===== SCHEDULE (section banner + timeline of events) ===== */}
        {renderSectionBanner(scheduleTitle)}
        <section className="py-14 px-6 md:px-10 max-w-3xl mx-auto">
          {/* Schedule intro portraits (2 images side-by-side) */}
          {scheduleImages.length > 0 && (
            <div className="grid grid-cols-2 gap-4 mb-12">
              {scheduleImages.slice(0, 2).map((img, idx) => (
                <div key={idx} className="aspect-[4/5] overflow-hidden rounded-lg shadow-md">
                  <img src={img.url} alt={`Schedule ${idx + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
          {/* Date line */}
          {dateDisplay && (
            <p className="text-center italic mb-12 text-sm md:text-base" style={{ color: bodyTextColor, fontFamily: bodyFont }}>
              {dateDisplay}
            </p>
          )}
          {scheduleSubtitle && (
            <p
              className="text-center italic max-w-2xl mx-auto mb-10 text-sm md:text-base"
              style={{ color: bodyTextColor, fontFamily: bodyFont }}
            >
              {scheduleSubtitle}
            </p>
          )}
          {schedule.length === 0 ? (
            <p
              className="text-center text-sm italic py-10"
              style={{ color: bodyTextColor, fontFamily: bodyFont }}
            >
              No events scheduled.
            </p>
          ) : (
            <div className="relative border-l pl-8 ml-2" style={{ borderColor: `${accent}55` }}>
              <div className="flex flex-col gap-10">
                {schedule.map((item, idx) => {
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
                            {formatTime(item.startTime)}
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
                          style={{ color: bodyTextColor, fontFamily: bodyFont }}
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
          
          {/* Wedding Venue section */}
          {(venueImage || venueDescription) && (
            <div className="mt-16 pt-12 border-t" style={{ borderColor: `${muted}33` }}>
              <span className="block mb-2 text-[10px] md:text-xs uppercase tracking-[0.2em] font-semibold text-center" style={{ color: accent, fontFamily: headingFont }}>
                Wedding Venue
              </span>
              {venueName && (
                <h3 className="text-[48px] font-semibold mb-6 text-center leading-[1.1]" style={{ fontFamily: headingFont, color: text }}>
                  {venueName}
                </h3>
              )}
              {venueImage && (
                <div className="aspect-[4/3] w-full overflow-hidden rounded-lg shadow-xl mb-6">
                  <img src={venueImage} alt={venueName || 'Venue'} className="w-full h-full object-cover" />
                </div>
              )}
              {venueDescription && (
                <p className="text-sm md:text-base leading-relaxed max-w-2xl mx-auto text-center" style={{ color: bodyTextColor, fontFamily: bodyFont }}>
                  {venueDescription}
                </p>
              )}
            </div>
          )}
        </section>

        {/* ===== STORY (section banner + zigzag timeline of chapters) ===== */}
        {renderSectionBanner(storyTitle)}
        <section className="py-14 px-6 md:px-10 max-w-4xl mx-auto">
          {/* Story hero image (16:9) */}
          {storyImages.length > 0 && (
            <div className="w-full aspect-[16/9] overflow-hidden rounded-lg shadow-xl mb-10">
              <img
                src={storyImages[0].url}
                alt={storyTitle}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          {storySubtitle && (
            <p
              className="text-center italic max-w-2xl mx-auto mb-10 text-sm md:text-base"
              style={{ color: bodyTextColor, fontFamily: bodyFont }}
            >
              {storySubtitle}
            </p>
          )}
          {stories.length === 0 ? (
            <p
              className="text-center text-sm italic py-10"
              style={{ color: bodyTextColor, fontFamily: bodyFont }}
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
                          style={{ color: bodyTextColor, fontFamily: bodyFont }}
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
                              isReversed ? 'aspect-[3/4]' : 'aspect-square'
                            }`}
                            style={isReversed ? { maxWidth: '260px' } : { maxWidth: '300px' }}
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
          
          {/* Tidbits section (Did You Know?) */}
          {tidbitsEnabled && tidbits.length > 0 && (
            <div className="mt-16 pt-12 border-t" style={{ borderColor: `${muted}33` }}>
              <h3 className="text-[48px] font-semibold mb-4 text-center leading-[1.1]" style={{ fontFamily: headingFont, color: text }}>
                {tidbitsTitle}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                {tidbits.map((t, idx) => (
                  <div
                    key={idx}
                    className="p-6 rounded-lg backdrop-blur-sm"
                    style={{ backgroundColor: `${bg}80`, border: `1px solid ${muted}22` }}
                  >
                    <p className="text-sm md:text-base font-medium mb-2" style={{ fontFamily: headingFont, color: text }}>
                      {t.q}
                    </p>
                    <p className="text-sm leading-relaxed" style={{ color: bodyTextColor, fontFamily: bodyFont }}>
                      {t.a}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Honeymoon voting section */}
          {honeymoonEnabled && honeymoonDestinations.length > 0 && (
            <div className="mt-16 pt-12 border-t" style={{ borderColor: `${muted}33` }}>
              <span className="block mb-2 text-[10px] md:text-xs uppercase tracking-[0.2em] font-semibold text-center" style={{ color: accent, fontFamily: headingFont }}>
                {honeymoonEyebrow}
              </span>
              <h3 className="text-[48px] font-semibold mb-8 text-center leading-[1.1]" style={{ fontFamily: headingFont, color: text }}>
                Where Next?
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {honeymoonDestinations.map((d, idx) => (
                  <div
                    key={idx}
                    className="p-6 rounded-lg text-center"
                    style={{ backgroundColor: `${bg}80`, border: `1px solid ${muted}22` }}
                  >
                    <p className="text-lg md:text-xl font-medium" style={{ fontFamily: headingFont, color: text }}>
                      {d.name}
                    </p>
                    <div
                      className="mt-4 inline-block px-6 py-2 rounded-full text-xs font-semibold uppercase tracking-wider cursor-pointer"
                      style={{ backgroundColor: accent, color: bg }}
                    >
                      Vote
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ===== MOMENTS (section banner + masonry gallery) ===== */}
        {renderSectionBanner(momentsTitle)}
        <section className="py-14 px-6 md:px-10 max-w-5xl mx-auto">
          {momentsSubtitle && (
            <p
              className="text-center italic max-w-2xl mx-auto mb-10 text-sm md:text-base"
              style={{ color: bodyTextColor, fontFamily: bodyFont }}
            >
              {momentsSubtitle}
            </p>
          )}
          {momentsMedia.length === 0 ? (
            <p
              className="text-center text-sm italic py-10"
              style={{ color: bodyTextColor, fontFamily: bodyFont }}
            >
              Photos coming soon.
            </p>
          ) : (
            <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-6">
              {momentsMedia.map((item, idx) => (
                <div
                  key={idx}
                  className="break-inside-avoid mb-6 overflow-hidden rounded-lg shadow-sm p-4 group"
                  style={{ backgroundColor: bg === '#FFFFFF' || bg === '#ffffff' ? '#FCF9F2' : `${bg}` }}
                >
                  <img
                    src={item.url}
                    alt={item.fileName || `Moment ${idx + 1}`}
                    className="w-full h-auto object-cover rounded transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ===== FAQ (section banner + accordion list of Q&A) ===== */}
        {renderSectionBanner(qaTitle)}
        <section className="py-14 px-6 md:px-10 max-w-3xl mx-auto">
          {qaSubtitle && (
            <p
              className="text-center italic max-w-2xl mx-auto mb-10 text-sm md:text-base"
              style={{ color: bodyTextColor, fontFamily: bodyFont }}
            >
              {qaSubtitle}
            </p>
          )}
          {faqs.length === 0 ? (
            <p
              className="text-center text-sm italic py-10"
              style={{ color: bodyTextColor, fontFamily: bodyFont }}
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
                        style={{ color: bodyTextColor, fontFamily: bodyFont }}
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

        {/* ===== QA CTA (Still have questions? Message the couple) ===== */}
        <section className="py-14 px-6 md:px-10 max-w-3xl mx-auto text-center">
          <span className="block mb-3 text-[10px] md:text-xs uppercase tracking-[0.2em] font-semibold" style={{ color: accent, fontFamily: headingFont }}>
            Need More Help?
          </span>
          <h3 className="text-[48px] font-semibold mb-4 leading-[1.1]" style={{ fontFamily: headingFont, color: text }}>
            Still have questions?
          </h3>
          <p className="text-sm md:text-base leading-relaxed max-w-xl mx-auto mb-8" style={{ color: bodyTextColor, fontFamily: bodyFont }}>
            Reach out to the couple or their concierge for any additional information.
          </p>
          <a
            href="mailto:concierge@dreamweavers.events"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-sm font-semibold uppercase tracking-wider transition-colors"
            style={{ backgroundColor: accent, color: bg }}
          >
            Message the Couple
          </a>
        </section>

        {/* ===== FOOTER (links + copyright) ===== */}
        <footer
          className="py-12 px-6"
          style={{ borderTop: `1px solid ${muted}33`, backgroundColor: bg }}
        >
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-wrap items-center justify-center gap-4">
              {['Contact Concierge', 'Privacy Policy', 'Data Protection', 'Terms of Service'].map((link) => (
                <span
                  key={link}
                  className="text-[10px] uppercase tracking-[0.2em] font-semibold cursor-pointer hover:opacity-70 transition-opacity"
                  style={{ color: bodyTextColor, fontFamily: bodyFont }}
                >
                  {link}
                </span>
              ))}
            </div>
            <p
              className="text-[10px] uppercase tracking-[0.2em] font-semibold"
              style={{ color: bodyTextColor, fontFamily: bodyFont }}
            >
              © {new Date().getFullYear()} Dreamweavers Digital Heirlooms
            </p>
          </div>
          <p
            className="text-center text-[9px] uppercase tracking-[0.2em] mt-6 opacity-50"
            style={{ color: bodyTextColor, fontFamily: bodyFont }}
          >
            Template Preview · {data.name}
          </p>
        </footer>
      </div>
    </div>
  );
}
