'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { invalidateWeddingCache } from '@/hooks/usePublicWedding';

const API_BASE = '/api/cms/content?XTransformPort=3000';

export interface ContentField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'url';
  placeholder: string;
}

interface SectionContentFieldsProps {
  /** DB section key, e.g. 'rsvp', 'wishes', 'qa' */
  section: string;
  /** Fields to render for this section */
  fields: ContentField[];
  /** Optional title for the section card (defaults to "Section Text") */
  title?: string;
  /** Optional description shown under the title */
  description?: string;
}

/**
 * Reusable content field editor for a single CMS section.
 * Fetches existing values, renders inputs, and saves changes via the
 * /api/cms/content PUT endpoint. Designed to be embedded inside other
 * Couple CMS pages (e.g. inside the RSVPs, Wishes, or FAQs tabs).
 */
export default function SectionContentFields({
  section,
  fields,
  title = 'Section Text',
  description,
}: SectionContentFieldsProps) {
  const [content, setContent] = useState<Record<string, string>>({});
  const [originals, setOriginals] = useState<Record<string, string>>({});
  const [editedFields, setEditedFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchContent = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(API_BASE);
      if (!res.ok) throw new Error('Failed to load content');
      const data = await res.json();
      const items: { section: string; fieldKey: string; fieldValue: string }[] = data.content ?? [];
      const map: Record<string, string> = {};
      for (const item of items) {
        if (item.section === section) {
          map[item.fieldKey] = item.fieldValue;
        }
      }
      setContent(map);
      setOriginals({ ...map });
    } catch {
      toast({ title: 'Error', description: 'Failed to load content', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const getFieldValue = (fieldKey: string): string => {
    const edited = editedFields[fieldKey];
    if (edited !== undefined) return edited;
    return content[fieldKey] ?? '';
  };

  const setFieldValue = (fieldKey: string, value: string) => {
    setEditedFields((prev) => ({ ...prev, [fieldKey]: value }));
  };

  const hasChanges = Object.keys(editedFields).length > 0;

  const handleSave = async () => {
    try {
      setSaving(true);
      const items = Object.entries(editedFields).map(([fieldKey, fieldValue]) => ({
        section,
        fieldKey,
        fieldValue,
      }));
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
        throw new Error(err.error || 'Failed to save content');
      }
      // Merge saved values into content state
      setContent((prev) => ({ ...prev, ...editedFields }));
      setOriginals((prev) => ({ ...prev, ...editedFields }));
      setEditedFields({});
      invalidateWeddingCache();
      toast({ title: 'Success', description: 'Content saved successfully' });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-cinematic-gold" />
      </div>
    );
  }

  return (
    <>
      <Separator className="bg-champagne-silk" />
      <Card className="border-charcoal-ink/5 shadow-none">
        <CardContent className="p-4 space-y-4">
          {/* Header with Save button */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-charcoal-ink">{title}</h3>
              {description && <p className="text-xs text-charcoal-ink/40 mt-0.5">{description}</p>}
            </div>
            {hasChanges && (
              <Button
                onClick={handleSave}
                disabled={saving}
                size="sm"
                className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90 rounded px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] transition-colors duration-300 shrink-0"
              >
                {saving ? (
                  <>
                    <Loader2 className="size-3 animate-spin mr-1" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="size-3 mr-1" />
                    Save ({Object.keys(editedFields).length})
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Fields */}
          {fields.map((field) => {
            const value = getFieldValue(field.key);
            const isChanged = editedFields[field.key] !== undefined;
            return (
              <div key={field.key} className="space-y-1.5">
                <Label
                  htmlFor={`content-${section}-${field.key}`}
                  className="text-xs font-medium text-charcoal-ink/50 uppercase tracking-wider flex items-center gap-1.5"
                >
                  {field.label}
                  {isChanged && <span className="inline-flex h-1.5 w-1.5 rounded-full bg-cinematic-gold" />}
                </Label>
                {field.type === 'textarea' ? (
                  <Textarea
                    id={`content-${section}-${field.key}`}
                    value={value}
                    onChange={(e) => setFieldValue(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={2}
                    className={`border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20 resize-none ${
                      isChanged ? 'border-cinematic-gold/50' : ''
                    }`}
                  />
                ) : (
                  <Input
                    id={`content-${section}-${field.key}`}
                    type={field.type === 'url' ? 'url' : 'text'}
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
    </>
  );
}
