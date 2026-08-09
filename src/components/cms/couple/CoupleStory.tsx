'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, Plus, Pencil, Trash2, BookOpen, Calendar, Lightbulb, Plane, Save } from 'lucide-react';
import MirrorImageGallery from './MirrorImageGallery';
import MirrorImageUpload from './MirrorImageUpload';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { invalidateWeddingCache } from '@/hooks/usePublicWedding';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';

const API_BASE = '/api/cms/stories?XTransformPort=3000';

interface StoryItem {
  id: string;
  title: string;
  content: string;
  date: string | null;
  imageUrl: string | null;
  sortOrder: number;
}

interface Tidbit {
  q: string;
  a: string;
}

interface Destination {
  name: string;
}

interface FormData {
  title: string;
  date: string;
  imageUrl: string;
  content: string;
}

const emptyForm: FormData = {
  title: '',
  date: '',
  imageUrl: '',
  content: '',
};

function safeParseJSON<T>(str: string | undefined | null, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

export default function CoupleStory() {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'story' | 'tidbit' | 'destination'>('story');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Content editor state
  const [contentFields, setContentFields] = useState<Record<string, string>>({});
  const [originalFields, setOriginalFields] = useState<Record<string, string>>({});
  const [editedFields, setEditedFields] = useState<Record<string, boolean>>({});
  const [savingContent, setSavingContent] = useState(false);

  // Tidbits state
  const [tidbits, setTidbits] = useState<Tidbit[]>([]);
  const [originalTidbits, setOriginalTidbits] = useState<Tidbit[]>([]);
  const [tidbitsEdited, setTidbitsEdited] = useState(false);

  // Honeymoon state
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [originalDestinations, setOriginalDestinations] = useState<Destination[]>([]);
  const [destinationsEdited, setDestinationsEdited] = useState(false);

  // Tidbit form (for dialog)
  const [tidbitForm, setTidbitForm] = useState<Tidbit>({ q: '', a: '' });

  // Destination form (for dialog)
  const [destForm, setDestForm] = useState<Destination>({ name: '' });

  const CONTENT_KEYS = [
    { key: 'title', label: 'Section Title', placeholder: 'e.g. Our Story', type: 'input' as const },
    { key: 'subtitle', label: 'Section Subtitle', placeholder: 'e.g. A journey of love', type: 'input' as const },
  ];

  const fetchStories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(API_BASE);
      if (!res.ok) throw new Error('Failed to load stories');
      const data = await res.json();
      setStories(data.stories ?? []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load love story', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchContent = useCallback(async () => {
    try {
      const res = await fetch('/api/cms/content?XTransformPort=3000');
      if (!res.ok) throw new Error('Failed to load content');
      const data = await res.json();
      const items = (data.content ?? []).filter((i: { section: string }) => i.section === 'story');
      const fields: Record<string, string> = {};
      items.forEach((item: { fieldKey: string; fieldValue: string }) => {
        fields[item.fieldKey] = item.fieldValue;
      });
      setContentFields(fields);
      setOriginalFields({ ...fields });
      setEditedFields({});

      // Load tidbits
      const parsedTidbits = safeParseJSON<Tidbit[]>(fields['tidbits'], []);
      setTidbits(parsedTidbits);
      setOriginalTidbits([...parsedTidbits]);
      setTidbitsEdited(false);

      // Load destinations
      const parsedDest = safeParseJSON<Destination[]>(fields['honeymoonDestinations'], []);
      setDestinations(parsedDest);
      setOriginalDestinations([...parsedDest]);
      setDestinationsEdited(false);
    } catch {
      // silently fail for content
    }
  }, []);

  useEffect(() => {
    fetchStories();
    fetchContent();
  }, [fetchStories, fetchContent]);

  // ─── Story Dialog ────────────────────────────────────────────
  const openAddDialog = () => {
    setDialogType('story');
    setEditingIdx(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (item: StoryItem) => {
    setDialogType('story');
    setEditingId(item.id);
    setEditingIdx(null);
    setForm({
      title: item.title,
      date: item.date ?? '',
      imageUrl: item.imageUrl ?? '',
      content: item.content,
    });
    setDialogOpen(true);
  };

  // ─── Tidbit Dialog ───────────────────────────────────────────
  const openAddTidbit = () => {
    setDialogType('tidbit');
    setEditingIdx(null);
    setTidbitForm({ q: '', a: '' });
    setDialogOpen(true);
  };

  const openEditTidbit = (idx: number) => {
    setDialogType('tidbit');
    setEditingIdx(idx);
    setTidbitForm({ ...tidbits[idx] });
    setDialogOpen(true);
  };

  const handleSaveTidbit = () => {
    if (!tidbitForm.q.trim() || !tidbitForm.a.trim()) {
      toast({ title: 'Error', description: 'Both question and answer are required', variant: 'destructive' });
      return;
    }
    const updated = [...tidbits];
    if (editingIdx !== null) {
      updated[editingIdx] = { q: tidbitForm.q.trim(), a: tidbitForm.a.trim() };
    } else {
      updated.push({ q: tidbitForm.q.trim(), a: tidbitForm.a.trim() });
    }
    setTidbits(updated);
    setTidbitsEdited(JSON.stringify(updated) !== JSON.stringify(originalTidbits));
    setDialogOpen(false);
    autoSaveContent('tidbits', JSON.stringify(updated), 'TIDBITS');
  };

  const handleDeleteTidbit = async (idx: number) => {
    const ok = await confirm('Remove this tidbit?', '');
    if (!ok) return;
    const updated = tidbits.filter((_, i) => i !== idx);
    setTidbits(updated);
    setTidbitsEdited(true);
    autoSaveContent('tidbits', JSON.stringify(updated), 'TIDBITS');
  };

  // ─── Destination Dialog ──────────────────────────────────────
  const openAddDestination = () => {
    setDialogType('destination');
    setEditingIdx(null);
    setDestForm({ name: '' });
    setDialogOpen(true);
  };

  const openEditDestination = (idx: number) => {
    setDialogType('destination');
    setEditingIdx(idx);
    setDestForm({ ...destinations[idx] });
    setDialogOpen(true);
  };

  const handleSaveDestination = () => {
    if (!destForm.name.trim()) {
      toast({ title: 'Error', description: 'Destination name is required', variant: 'destructive' });
      return;
    }
    const updated = [...destinations];
    if (editingIdx !== null) {
      updated[editingIdx] = { name: destForm.name.trim() };
    } else {
      updated.push({ name: destForm.name.trim() });
    }
    setDestinations(updated);
    setDestinationsEdited(JSON.stringify(updated) !== JSON.stringify(originalDestinations));
    setDialogOpen(false);
    autoSaveContent('honeymoonDestinations', JSON.stringify(updated), 'DESTINATIONS');
  };

  const handleDeleteDestination = async (idx: number) => {
    const ok = await confirm('Remove this destination?', '');
    if (!ok) return;
    const updated = destinations.filter((_, i) => i !== idx);
    setDestinations(updated);
    setDestinationsEdited(true);
    autoSaveContent('honeymoonDestinations', JSON.stringify(updated), 'DESTINATIONS');
  };

  // ─── Auto-save JSON content fields ───────────────────────────
  const autoSaveContent = async (fieldKey: string, fieldValue: string, label: string) => {
    try {
      await fetch('/api/cms/content?XTransformPort=3000', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ section: 'story', fieldKey, fieldValue, fieldType: 'JSON' }],
        }),
      });
      invalidateWeddingCache();
      // Update originals so dirty tracking stays correct
      if (label === 'TIDBITS') {
        setOriginalTidbits(safeParseJSON(fieldValue, []));
        setTidbitsEdited(false);
      } else if (label === 'DESTINATIONS') {
        setOriginalDestinations(safeParseJSON(fieldValue, []));
        setDestinationsEdited(false);
      }
    } catch {
      toast({ title: 'Error', description: `Failed to save ${label.toLowerCase()}`, variant: 'destructive' });
    }
  };

  // ─── Story CRUD ──────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: 'Error', description: 'Chapter title is required', variant: 'destructive' });
      return;
    }
    if (!form.content.trim()) {
      toast({ title: 'Error', description: 'Story content is required', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        date: form.date.trim() || undefined,
        imageUrl: form.imageUrl.trim() || undefined,
      };

      let res: Response;
      if (editingId) {
        res = await fetch(API_BASE, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...payload }),
        });
      } else {
        res = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save chapter');
      }

      invalidateWeddingCache();
      toast({ title: 'Success', description: editingId ? 'Chapter updated successfully' : 'Chapter added successfully' });
      setDialogOpen(false);
      fetchStories();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save chapter', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleContentChange = (key: string, value: string) => {
    setContentFields((prev) => ({ ...prev, [key]: value }));
    setEditedFields((prev) => ({
      ...prev,
      [key]: value !== originalFields[key],
    }));
  };

  const handleSaveContent = async () => {
    try {
      setSavingContent(true);
      const items = Object.keys(editedFields)
        .filter((k) => editedFields[k])
        .map((fieldKey) => ({
          section: 'story' as const,
          fieldKey,
          fieldValue: contentFields[fieldKey],
        }));
      if (items.length === 0) {
        toast({ title: 'Info', description: 'No changes to save' });
        return;
      }
      const res = await fetch('/api/cms/content?XTransformPort=3000', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error('Failed to save content');
      invalidateWeddingCache();
      toast({ title: 'Success', description: 'Content saved successfully' });
      setOriginalFields({ ...contentFields });
      setEditedFields({});
    } catch {
      toast({ title: 'Error', description: 'Failed to save content', variant: 'destructive' });
    } finally {
      setSavingContent(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm('Delete this chapter?', 'This action cannot be undone.');
    if (!ok) return;

    try {
      setDeleting(id);
      const res = await fetch(`${API_BASE}&id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete chapter');
      }

      invalidateWeddingCache();
      toast({ title: 'Success', description: 'Chapter deleted' });
      fetchStories();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete chapter', variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  // Inline image upload for a chapter — saves directly to StoryItem.imageUrl
  // without opening the edit dialog. Lets couples add/replace a chapter's
  // image right from the chapter card.
  const [imageSavingId, setImageSavingId] = useState<string | null>(null);
  const handleChapterImageChange = async (chapterId: string, dataUrl: string) => {
    try {
      setImageSavingId(chapterId);
      const res = await fetch(API_BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: chapterId, imageUrl: dataUrl }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update image');
      }
      invalidateWeddingCache();
      toast({ title: 'Success', description: 'Chapter image updated' });
      fetchStories();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to update image', variant: 'destructive' });
    } finally {
      setImageSavingId(null);
    }
  };

  const handleChapterImageRemove = async (chapterId: string) => {
    try {
      setImageSavingId(chapterId);
      const res = await fetch(API_BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: chapterId, imageUrl: '' }),
      });
      if (!res.ok) throw new Error('Failed to remove image');
      invalidateWeddingCache();
      toast({ title: 'Removed', description: 'Chapter image removed' });
      fetchStories();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to remove image', variant: 'destructive' });
    } finally {
      setImageSavingId(null);
    }
  };

  const hasContentChanges = Object.values(editedFields).some(Boolean) || tidbitsEdited || destinationsEdited;

  // Count pending text changes for the Save button badge
  const pendingContentCount =
    Object.values(editedFields).filter(Boolean).length +
    (tidbitsEdited ? 1 : 0) +
    (destinationsEdited ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-charcoal-ink">Our Love Story</h2>
          <p className="text-sm text-charcoal-ink/50 mt-1">
            Add chapters to tell the story of your journey together.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={openAddDialog}
            className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90 rounded px-4 py-2 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300"
          >
            <Plus className="size-4 mr-1.5" />
            Add Chapter
          </Button>
        </div>
      </div>

      <MirrorImageGallery category="story" label="Story Hero Image" maxImages={3} aspectClass="aspect-[16/9]" helperText="16:9 · The big banner image at the top of the guest story page (first image is used as the hero)" />

      {/* Content Card */}
      <Card className="border-charcoal-ink/5 shadow-none">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-charcoal-ink mb-4">Story Content</h3>
          <div className="space-y-4">
            {CONTENT_KEYS.map(({ key, label, placeholder, type }) => (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-medium text-charcoal-ink/50 uppercase tracking-wider">
                    {label}
                  </Label>
                  {editedFields[key] && (
                    <span className="bg-cinematic-gold w-1.5 h-1.5 rounded-full" />
                  )}
                </div>
                {type === 'textarea' ? (
                  <Textarea
                    value={contentFields[key] ?? ''}
                    onChange={(e) => handleContentChange(key, e.target.value)}
                    placeholder={placeholder}
                    rows={3}
                    className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20 resize-none"
                  />
                ) : (
                  <Input
                    value={contentFields[key] ?? ''}
                    onChange={(e) => handleContentChange(key, e.target.value)}
                    placeholder={placeholder}
                    className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                  />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator className="bg-champagne-silk" />

      {/* Timeline List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="size-8 animate-spin text-cinematic-gold" />
          <p className="text-sm text-charcoal-ink/50 font-medium">Loading your story…</p>
        </div>
      ) : stories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <BookOpen className="size-10 text-champagne-silk" />
          <p className="text-sm text-charcoal-ink/40 font-medium">No chapters yet</p>
          <p className="text-xs text-charcoal-ink/30">Click &quot;Add Chapter&quot; to start telling your story.</p>
        </div>
      ) : (
        <div className="relative space-y-0">
          {/* Timeline line */}
          <div className="absolute left-[15px] top-4 bottom-4 w-px bg-champagne-silk hidden sm:block" />

          {stories.map((item, index) => (
            <div key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
              {/* Timeline dot */}
              <div className="hidden sm:flex items-start pt-1.5 shrink-0">
                <div className="relative z-10 flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-cinematic-gold/30 bg-paper-cream">
                  <div className="h-2 w-2 rounded-full bg-cinematic-gold" />
                </div>
              </div>

              {/* Card */}
              <Card className="flex-1 border-charcoal-ink/5 shadow-none hover:border-champagne-silk transition-colors duration-200 overflow-hidden">
                <CardContent className="p-4">
                  {/* Chapter header: number/title + edit/delete actions */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <span className="sm:hidden inline-flex items-center justify-center h-5 w-5 rounded-full bg-cinematic-gold/10 text-cinematic-gold text-[10px] font-bold mb-2">
                        {index + 1}
                      </span>
                      <h3 className="text-sm font-semibold text-charcoal-ink">
                        {item.title}
                      </h3>
                      {item.date && (
                        <span className="flex items-center gap-1 text-xs text-cinematic-gold/80 font-medium mt-0.5">
                          <Calendar className="size-3" />
                          {item.date}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(item)}
                        className="h-9 w-9 p-0 text-charcoal-ink/40 hover:text-cinematic-gold hover:bg-cinematic-gold/5"
                        title="Edit chapter"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(item.id)}
                        disabled={deleting === item.id}
                        className="h-9 w-9 p-0 text-charcoal-ink/40 hover:text-red-500 hover:bg-red-50"
                        title="Delete chapter"
                      >
                        {deleting === item.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Image + text side-by-side (matches Ceremony Section layout).
                      Inline upload — no need to open the edit dialog just to
                      add/replace an image. 16:9 mirrors the guest-site story
                      chapter; constrained to 280px so it stays compact. */}
                  <div className="flex flex-col md:flex-row gap-4 items-start">
                    <MirrorImageUpload
                      value={item.imageUrl ?? ''}
                      onChange={(dataUrl) => handleChapterImageChange(item.id, dataUrl)}
                      onRemove={() => handleChapterImageRemove(item.id)}
                      disabled={imageSavingId === item.id}
                      label="Image"
                      helperText="16:9 · mirrors guest site"
                      aspectClass="aspect-[16/9]"
                      maxWidth="280px"
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-xs text-charcoal-ink/50 line-clamp-4 leading-relaxed">
                        {item.content}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      <Separator className="bg-champagne-silk" />

      {/* ═══════════════ Did You Know? (Tidbits) Section ═══════════════ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-cinematic-gold/10 text-cinematic-gold">
              <Lightbulb className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-charcoal-ink">Did You Know?</h3>
              <p className="text-xs text-charcoal-ink/40">Fun Q&amp;A facts about the couple</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-charcoal-ink/40">
                {contentFields['tidbitsEnabled'] !== 'false' ? 'Visible to guests' : 'Hidden from guests'}
              </span>
              <Switch
                checked={contentFields['tidbitsEnabled'] !== 'false'}
                onCheckedChange={(checked) => {
                  handleContentChange('tidbitsEnabled', String(checked));
                }}
              />
            </div>
            <Button
              onClick={openAddTidbit}
              variant="outline"
              className="border-charcoal-ink/15 text-charcoal-ink hover:border-cinematic-gold hover:text-cinematic-gold rounded px-3 py-1.5 text-xs font-medium transition-colors duration-300 h-8"
            >
              <Plus className="size-3.5 mr-1" />
              Add
            </Button>
          </div>
        </div>
      <Card className={`border-charcoal-ink/5 shadow-none transition-opacity duration-200 ${contentFields['tidbitsEnabled'] !== 'false' ? '' : 'opacity-40 pointer-events-none'}`}>
        <CardContent className="p-6 space-y-5">

          {/* Tidbit Title & Subtitle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-medium text-charcoal-ink/50 uppercase tracking-wider">Title</Label>
                {editedFields['tidbitsTitle'] && <span className="bg-cinematic-gold w-1.5 h-1.5 rounded-full" />}
              </div>
              <Input
                value={contentFields['tidbitsTitle'] ?? ''}
                onChange={(e) => handleContentChange('tidbitsTitle', e.target.value)}
                placeholder="Tidbits"
                className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-medium text-charcoal-ink/50 uppercase tracking-wider">Subtitle</Label>
                {editedFields['tidbitsSubtitle'] && <span className="bg-cinematic-gold w-1.5 h-1.5 rounded-full" />}
              </div>
              <Input
                value={contentFields['tidbitsSubtitle'] ?? ''}
                onChange={(e) => handleContentChange('tidbitsSubtitle', e.target.value)}
                placeholder="A few things you might not know."
                className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
              />
            </div>
          </div>

          {/* Tidbit List */}
          {tidbits.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-charcoal-ink/30">No tidbits yet. Click &quot;Add&quot; to create one.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tidbits.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-lg border border-charcoal-ink/5 bg-white/50 hover:border-champagne-silk/50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-charcoal-ink">{item.q}</p>
                    <p className="text-xs text-charcoal-ink/50 mt-0.5 line-clamp-2">{item.a}</p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditTidbit(idx)}
                      className="h-9 w-9 p-0 text-charcoal-ink/40 hover:text-cinematic-gold hover:bg-cinematic-gold/5"
                    >
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTidbit(idx)}
                      className="h-9 w-9 p-0 text-charcoal-ink/40 hover:text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      <Separator className="bg-champagne-silk" />

      {/* ═══════════════ Honeymoon Voting Section ═══════════════ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-cinematic-gold/10 text-cinematic-gold">
              <Plane className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-charcoal-ink">Honeymoon Voting</h3>
              <p className="text-xs text-charcoal-ink/40">Let guests vote on your honeymoon destination</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-charcoal-ink/40">
                {contentFields['honeymoonEnabled'] !== 'false' ? 'Visible to guests' : 'Hidden from guests'}
              </span>
              <Switch
                checked={contentFields['honeymoonEnabled'] !== 'false'}
                onCheckedChange={(checked) => {
                  handleContentChange('honeymoonEnabled', String(checked));
                }}
              />
            </div>
            <Button
              onClick={openAddDestination}
              variant="outline"
              className="border-charcoal-ink/15 text-charcoal-ink hover:border-cinematic-gold hover:text-cinematic-gold rounded px-3 py-1.5 text-xs font-medium transition-colors duration-300 h-8"
            >
              <Plus className="size-3.5 mr-1" />
              Add
            </Button>
          </div>
        </div>
      <Card className={`border-charcoal-ink/5 shadow-none transition-opacity duration-200 ${contentFields['honeymoonEnabled'] !== 'false' ? '' : 'opacity-40 pointer-events-none'}`}>
        <CardContent className="p-6 space-y-5">

          {/* Honeymoon Eyebrow */}
          <div className="space-y-1.5">
            <Label>Honeymoon Eyebrow</Label>
            <Input
              value={contentFields['honeymoonEyebrow'] ?? ''}
              onChange={(e) => handleContentChange('honeymoonEyebrow', e.target.value)}
              placeholder="AFTER THE 'I DO'"
              className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
            />
          </div>

          {/* Honeymoon Eyebrow, Title & Subtitle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-medium text-charcoal-ink/50 uppercase tracking-wider">Eyebrow</Label>
                {editedFields['honeymoonEyebrow'] && <span className="bg-cinematic-gold w-1.5 h-1.5 rounded-full" />}
              </div>
              <Input
                value={contentFields['honeymoonEyebrow'] ?? ''}
                onChange={(e) => handleContentChange('honeymoonEyebrow', e.target.value)}
                placeholder="AFTER THE 'I DO'"
                className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-medium text-charcoal-ink/50 uppercase tracking-wider">Title</Label>
                {editedFields['honeymoonTitle'] && <span className="bg-cinematic-gold w-1.5 h-1.5 rounded-full" />}
              </div>
              <Input
                value={contentFields['honeymoonTitle'] ?? ''}
                onChange={(e) => handleContentChange('honeymoonTitle', e.target.value)}
                placeholder="Where Next?"
                className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-medium text-charcoal-ink/50 uppercase tracking-wider">Subtitle</Label>
                {editedFields['honeymoonSubtitle'] && <span className="bg-cinematic-gold w-1.5 h-1.5 rounded-full" />}
              </div>
              <Input
                value={contentFields['honeymoonSubtitle'] ?? ''}
                onChange={(e) => handleContentChange('honeymoonSubtitle', e.target.value)}
                placeholder="Help us choose our honeymoon destination. Cast your vote!"
                className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
              />
            </div>
          </div>

          {/* Destination List */}
          {destinations.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-charcoal-ink/30">No destinations yet. Click &quot;Add&quot; to create one.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {destinations.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 p-3 rounded-lg border border-charcoal-ink/5 bg-white/50 hover:border-champagne-silk/50 transition-colors group"
                >
                  <p className="text-sm font-medium text-charcoal-ink truncate">{item.name}</p>
                  <div className="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDestination(idx)}
                      className="h-9 w-9 p-0 text-charcoal-ink/40 hover:text-cinematic-gold hover:bg-cinematic-gold/5"
                    >
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteDestination(idx)}
                      className="h-9 w-9 p-0 text-charcoal-ink/40 hover:text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* ═══════════════ Unified Dialog ═══════════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          {dialogType === 'story' && (
            <>
              <DialogHeader>
                <DialogTitle className="text-charcoal-ink">
                  {editingId ? 'Edit Chapter' : 'Add New Chapter'}
                </DialogTitle>
                <DialogDescription className="text-charcoal-ink/50">
                  {editingId ? 'Update this chapter of your love story.' : 'Add a new chapter to your love story timeline.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="story-title" className="text-sm font-medium text-charcoal-ink/70">
                    Title <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="story-title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. How We Met"
                    className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="story-date" className="text-sm font-medium text-charcoal-ink/70">
                    Display Date
                  </Label>
                  <Input
                    id="story-date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    placeholder="e.g. March 2023"
                    className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                  />
                </div>
                {/* Note: chapter image is now uploaded inline on the chapter
                    card (no need to open this dialog just to add an image). */}
                <div className="space-y-1.5">
                  <Label htmlFor="story-content" className="text-sm font-medium text-charcoal-ink/70">
                    Content / Story <span className="text-red-400">*</span>
                  </Label>
                  <Textarea
                    id="story-content"
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    placeholder="Tell this chapter of your story…"
                    rows={4}
                    className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20 resize-none min-h-[100px]"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="border-charcoal-ink/15 text-charcoal-ink hover:border-cinematic-gold hover:text-cinematic-gold rounded px-6 py-2.5 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90 rounded px-6 py-2.5 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300 disabled:opacity-50 shrink-0 min-w-fit"
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Saving…
                    </>
                  ) : editingId ? (
                    'Update Chapter'
                  ) : (
                    'Add Chapter'
                  )}
                </Button>
              </DialogFooter>
            </>
          )}

          {dialogType === 'tidbit' && (
            <>
              <DialogHeader>
                <DialogTitle className="text-charcoal-ink">
                  {editingIdx !== null ? 'Edit Tidbit' : 'Add Tidbit'}
                </DialogTitle>
                <DialogDescription className="text-charcoal-ink/50">
                  {editingIdx !== null ? 'Update this fun fact.' : 'Add a fun Q&A about the couple.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-charcoal-ink/70">
                    Question <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    value={tidbitForm.q}
                    onChange={(e) => setTidbitForm({ ...tidbitForm, q: e.target.value })}
                    placeholder="e.g. Who said 'I love you' first?"
                    className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-charcoal-ink/70">
                    Answer <span className="text-red-400">*</span>
                  </Label>
                  <Textarea
                    value={tidbitForm.a}
                    onChange={(e) => setTidbitForm({ ...tidbitForm, a: e.target.value })}
                    placeholder="The answer to the question…"
                    rows={3}
                    className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20 resize-none"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="border-charcoal-ink/15 text-charcoal-ink hover:border-cinematic-gold hover:text-cinematic-gold rounded px-6 py-2.5 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveTidbit}
                  className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90 rounded px-6 py-2.5 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300"
                >
                  {editingIdx !== null ? 'Update' : 'Add Tidbit'}
                </Button>
              </DialogFooter>
            </>
          )}

          {dialogType === 'destination' && (
            <>
              <DialogHeader>
                <DialogTitle className="text-charcoal-ink">
                  {editingIdx !== null ? 'Edit Destination' : 'Add Destination'}
                </DialogTitle>
                <DialogDescription className="text-charcoal-ink/50">
                  {editingIdx !== null ? 'Update this honeymoon destination.' : 'Add a destination option for guests to vote on.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-charcoal-ink/70">
                    Destination Name <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    value={destForm.name}
                    onChange={(e) => setDestForm({ ...destForm, name: e.target.value })}
                    placeholder="e.g. Amalfi Coast"
                    className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="border-charcoal-ink/15 text-charcoal-ink hover:border-cinematic-gold hover:text-cinematic-gold rounded px-6 py-2.5 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveDestination}
                  className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90 rounded px-6 py-2.5 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300"
                >
                  {editingIdx !== null ? 'Update' : 'Add Destination'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Sticky Save Bar — bottom right */}
      {true && (
        <div className="sticky bottom-0 flex justify-end gap-2 py-4 bg-white/95 backdrop-blur-sm border-t border-charcoal-ink/5">
          <Button
            onClick={handleSaveContent}
            disabled={savingContent}
            className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90 rounded px-6 py-2.5 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300 disabled:opacity-50 shrink-0 min-w-fit"
          >
            {savingContent ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="size-4 mr-2" />
                Save Changes ({pendingContentCount})
              </>
            )}
          </Button>
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}