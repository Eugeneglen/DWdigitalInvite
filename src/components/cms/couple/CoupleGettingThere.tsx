'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { invalidateWeddingCache } from '@/hooks/usePublicWedding';

const API_BASE = '/api/cms/content?XTransformPort=3000';

const SECTION = 'getting-there';

interface ContentItem {
  id: string;
  section: string;
  fieldKey: string;
  fieldValue: string;
  fieldType: string;
}

const FIELDS = [
  { key: 'title', label: 'Section Title', type: 'text' as const, placeholder: 'e.g. Getting There' },
  { key: 'subtitle', label: 'Section Subtitle', type: 'text' as const, placeholder: 'e.g. Find your way to our celebration' },
  { key: 'carTitle', label: 'By Car Title', type: 'text' as const, placeholder: 'e.g. By Car' },
  { key: 'carContent', label: 'By Car Directions', type: 'textarea' as const, placeholder: 'Driving directions and parking info...' },
  { key: 'transitTitle', label: 'Public Transit Title', type: 'text' as const, placeholder: 'e.g. Public Transit' },
  { key: 'transitContent', label: 'Public Transit Directions', type: 'textarea' as const, placeholder: 'MRT/bus directions...' },
  { key: 'parkingNote', label: 'Parking Note', type: 'textarea' as const, placeholder: 'Parking availability and rates...' },
];

export default function CoupleGettingThere() {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedFields, setEditedFields] = useState<Record<string, string>>({});

  const fetchContent = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}&section=${encodeURIComponent(SECTION)}`);
      if (!res.ok) throw new Error('Failed to load content');
      const data = await res.json();
      setContent(data.content ?? []);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load content',
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
    const edited = editedFields[`${SECTION}/${fieldKey}`];
    if (edited !== undefined) return edited;
    const item = content.find((c) => c.section === SECTION && c.fieldKey === fieldKey);
    return item?.fieldValue ?? '';
  };

  const setFieldValue = (fieldKey: string, value: string) => {
    setEditedFields((prev) => ({
      ...prev,
      [`${SECTION}/${fieldKey}`]: value,
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const items = Object.entries(editedFields).map(([key, fieldValue]) => {
        const [, fieldKey] = key.split('/');
        return { section: SECTION, fieldKey, fieldValue };
      });

      if (items.length === 0) {
        toast({ title: 'No changes', description: 'No changes to save' });
        return;
      }

      const res = await fetch(API_BASE, {
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
        title: 'Success',
        description: 'Content saved successfully',
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

  // ── Venue image helpers ────────────────────────────────────────
  // Venue image is managed in the Schedule CMS page (where it's displayed).

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="size-8 animate-spin text-cinematic-gold" />
        <p className="text-sm text-charcoal-ink/50 font-medium">Loading content…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-semibold text-charcoal-ink">Getting There</h2>
        <p className="text-sm text-charcoal-ink/50 mt-1">
          Edit directions and transport information.
        </p>
      </div>

      {/* Note: Venue image is managed in the Schedule CMS page, where it's
          actually displayed on the guest site. */}

      {/* Content Fields */}
      <Card className="border-charcoal-ink/5 shadow-none">
        <CardContent className="p-4 space-y-4">
          {FIELDS.map((field) => {
            const value = getFieldValue(field.key);
            const isChanged = editedFields[`${SECTION}/${field.key}`] !== undefined;

            return (
              <div key={field.key} className="space-y-1.5">
                <Label
                  htmlFor={`getting-there-${field.key}`}
                  className="text-xs font-medium text-charcoal-ink/50 uppercase tracking-wider flex items-center gap-1.5"
                >
                  {field.label}
                  {isChanged && (
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-cinematic-gold" />
                  )}
                </Label>
                {field.type === 'textarea' ? (
                  <Textarea
                    id={`getting-there-${field.key}`}
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
                    id={`getting-there-${field.key}`}
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
          })}
        </CardContent>
      </Card>

      {/* Sticky Save Bar — bottom right */}
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