'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useCoupleCMSStore } from '@/store/useCoupleCMSStore';
import { HeroVisualSection, BannerSection } from './CoupleHeroBanner';
import MirrorImageUpload from './MirrorImageUpload';
import FontPicker from './FontPicker';
import BackgroundColorPicker from './BackgroundColorPicker';
import { invalidateWeddingCache } from '@/hooks/usePublicWedding';

const CONTENT_API = '/api/cms/content?XTransformPort=3000';

interface ContentItem {
  id: string;
  section: string;
  fieldKey: string;
  fieldValue: string;
  fieldType: string;
}

const HERO_FIELDS = [
  { key: 'title', label: 'Hero Title', type: 'text' as const, placeholder: 'e.g. Together with their families' },
  { key: 'subtitle', label: 'Hero Subtitle', type: 'text' as const, placeholder: 'e.g. Eleanor & James request the pleasure of your company' },
  { key: 'description', label: 'Hero Description', type: 'textarea' as const, placeholder: 'Additional text below the title…' },
  { key: 'dateDisplay', label: 'Date Display', type: 'text' as const, placeholder: 'e.g. Saturday, 25th December 2027' },
  { key: 'countdownDate', label: 'Countdown Target Date', type: 'text' as const, placeholder: 'e.g. 2027-12-25T16:00:00+08:00' },
];

const TEA_CEREMONY_FIELDS = [
  { key: 'teaCeremonyLabel', label: 'Label', type: 'text' as const, placeholder: 'e.g. The Tradition' },
  { key: 'teaCeremonyTitle', label: 'Title', type: 'text' as const, placeholder: 'e.g. The Tea Ceremony' },
  { key: 'teaCeremonyBody', label: 'Body Text', type: 'textarea' as const, placeholder: 'A short description of the tea ceremony…' },
];

const NARRATIVE_FIELDS = [
  { key: 'narrativeLabel', label: 'Label', type: 'text' as const, placeholder: 'e.g. The Prelude' },
  { key: 'narrativeTitle', label: 'Title', type: 'text' as const, placeholder: 'e.g. Our Story Begins Here' },
  { key: 'narrativeBody', label: 'Body Text', type: 'textarea' as const, placeholder: 'A short narrative paragraph…' },
];

export default function CoupleHome() {
  const { weddingData } = useCoupleCMSStore();
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedFields, setEditedFields] = useState<Record<string, string>>({});

  const fetchContent = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(CONTENT_API);
      if (!res.ok) throw new Error('Failed to load content');
      const data = await res.json();
      setContent(data.content ?? []);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load hero content',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const getFieldValue = (fieldKey: string): string => {
    const edited = editedFields[`hero/${fieldKey}`];
    if (edited !== undefined) return edited;

    const item = content.find((c) => c.section === 'hero' && c.fieldKey === fieldKey);
    return item?.fieldValue ?? '';
  };

  const setFieldValue = (fieldKey: string, value: string) => {
    setEditedFields((prev) => ({
      ...prev,
      [`hero/${fieldKey}`]: value,
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const items = Object.entries(editedFields).map(([key, fieldValue]) => {
        const [section, fieldKey] = key.split('/');
        return { section, fieldKey, fieldValue };
      });

      if (items.length === 0) {
        toast({
          title: 'No changes',
          description: 'Nothing to save.',
        });
        return;
      }

      const res = await fetch(CONTENT_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Failed to save content');
      }

      const data = await res.json();
      const savedContent = data.content ?? [];
      setContent((prev) => {
        const updated = [...prev];
        for (const item of savedContent) {
          const idx = updated.findIndex(
            (c) => c.section === item.section && c.fieldKey === item.fieldKey
          );
          if (idx >= 0) {
            updated[idx] = item;
          } else {
            updated.push(item);
          }
        }
        return updated;
      });

      setEditedFields({});
      invalidateWeddingCache();
      toast({
        title: 'Saved',
        description: 'Hero content updated successfully',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save content',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = Object.keys(editedFields).length > 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-semibold text-charcoal-ink">Home Section</h2>
        <p className="text-sm text-charcoal-ink/50 mt-1">
          Edit the visual and text content guests see first on your invitation.
        </p>
      </div>

      <Separator className="bg-champagne-silk" />

      {/* 1. Hero Visual */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-charcoal-ink/50 uppercase tracking-wider">
          Hero Visual
        </Label>
        <HeroVisualSection weddingData={weddingData} />
      </div>

      <Separator className="bg-champagne-silk" />

      {/* 2. Banner Design */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-charcoal-ink/50 uppercase tracking-wider">
          Banner Design
        </Label>
        <BannerSection weddingData={weddingData} />
      </div>

      <Separator className="bg-champagne-silk" />

      {/* 3. Colour & Font — 2-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BackgroundColorPicker />
        <FontPicker section="hero" />
      </div>

      <Separator className="bg-champagne-silk" />

      {/* Hero Content Fields */}
      <div className="space-y-3">
        <Label className="text-xs font-medium text-charcoal-ink/50 uppercase tracking-wider">
          Hero Content
        </Label>

        <Card className="border-charcoal-ink/5 shadow-none">
          <CardContent className="p-4 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-cinematic-gold" />
              </div>
            ) : (
              HERO_FIELDS.map((field) => {
                const value = getFieldValue(field.key);
                const isChanged = editedFields[`hero/${field.key}`] !== undefined;

                return (
                  <div key={field.key} className="space-y-1.5">
                    <Label
                      htmlFor={`hero-content-${field.key}`}
                      className="text-xs font-medium text-charcoal-ink/50 uppercase tracking-wider flex items-center gap-1.5"
                    >
                      {field.label}
                      {isChanged && (
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-cinematic-gold" />
                      )}
                    </Label>
                    {field.type === 'textarea' ? (
                      <Textarea
                        id={`hero-content-${field.key}`}
                        value={value}
                        onChange={(e) => setFieldValue(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        rows={3}
                        className={`border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20 resize-none ${
                          isChanged ? 'border-cinematic-gold/50' : ''
                        }`}
                      />
                    ) : (
                      <Input
                        id={`hero-content-${field.key}`}
                        type="text"
                        value={value}
                        onChange={(e) => setFieldValue(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className={`border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20 ${
                          isChanged ? 'border-cinematic-gold/50' : ''
                        }`}
                      />
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Separator className="bg-champagne-silk" />

      {/* 7. Tea Ceremony Section — image beside text fields (compact) */}
      <div className="space-y-3">
        <Label className="text-xs font-medium text-charcoal-ink/50 uppercase tracking-wider">
          Tea Ceremony Section
        </Label>
        <Card className="border-charcoal-ink/5 shadow-none">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 items-start">
              {/* Tea Ceremony Image — constrained to 280px, 2:3 portrait */}
              <MirrorImageUpload
                value={getFieldValue('teaCeremonyImage')}
                onChange={(dataUrl) => setFieldValue('teaCeremonyImage', dataUrl)}
                onRemove={() => setFieldValue('teaCeremonyImage', '')}
                label="Image"
                helperText="2:3 portrait · mirrors guest site"
                aspectClass="aspect-[2/3]"
                maxWidth="280px"
              />
              {/* Text fields beside the image */}
              <div className="space-y-4 flex-1 min-w-0">
                {TEA_CEREMONY_FIELDS.map((field) => {
                  const value = getFieldValue(field.key);
                  const isChanged = editedFields[`hero/${field.key}`] !== undefined;
                  return (
                    <div key={field.key} className="space-y-1.5">
                      <Label
                        htmlFor={`hero-content-${field.key}`}
                        className="text-xs font-medium text-charcoal-ink/50 uppercase tracking-wider flex items-center gap-1.5"
                      >
                        {field.label}
                        {isChanged && <span className="inline-flex h-1.5 w-1.5 rounded-full bg-cinematic-gold" />}
                      </Label>
                      {field.type === 'textarea' ? (
                        <Textarea
                          id={`hero-content-${field.key}`}
                          value={value}
                          onChange={(e) => setFieldValue(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          rows={3}
                          className={`border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20 resize-none ${isChanged ? 'border-cinematic-gold/50' : ''}`}
                        />
                      ) : (
                        <Input
                          id={`hero-content-${field.key}`}
                          type="text"
                          value={value}
                          onChange={(e) => setFieldValue(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className={`border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20 ${isChanged ? 'border-cinematic-gold/50' : ''}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator className="bg-champagne-silk" />

      {/* 8. Narrative Section */}
      <div className="space-y-3">
        <Label className="text-xs font-medium text-charcoal-ink/50 uppercase tracking-wider">
          Narrative Section
        </Label>
        <Card className="border-charcoal-ink/5 shadow-none">
          <CardContent className="p-4 space-y-4">
            {NARRATIVE_FIELDS.map((field) => {
              const value = getFieldValue(field.key);
              const isChanged = editedFields[`hero/${field.key}`] !== undefined;
              return (
                <div key={field.key} className="space-y-1.5">
                  <Label
                    htmlFor={`hero-content-${field.key}`}
                    className="text-xs font-medium text-charcoal-ink/50 uppercase tracking-wider flex items-center gap-1.5"
                  >
                    {field.label}
                    {isChanged && <span className="inline-flex h-1.5 w-1.5 rounded-full bg-cinematic-gold" />}
                  </Label>
                  {field.type === 'textarea' ? (
                    <Textarea
                      id={`hero-content-${field.key}`}
                      value={value}
                      onChange={(e) => setFieldValue(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      rows={3}
                      className={`border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20 resize-none ${isChanged ? 'border-cinematic-gold/50' : ''}`}
                    />
                  ) : (
                    <Input
                      id={`hero-content-${field.key}`}
                      type="text"
                      value={value}
                      onChange={(e) => setFieldValue(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className={`border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20 ${isChanged ? 'border-cinematic-gold/50' : ''}`}
                    />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Save Bar — bottom right */}
      {true && (
        <div className="sticky bottom-0 flex justify-end gap-2 py-4 bg-white/95 backdrop-blur-sm border-t border-charcoal-ink/5">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90 rounded px-6 py-2.5 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300 disabled:opacity-50 shrink-0 min-w-fit"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="size-4 mr-2" />
                Save Changes ({Object.keys(editedFields).length})
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}