'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Loader2, Check, Type } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { invalidateWeddingCache } from '@/hooks/usePublicWedding';

const CONTENT_API = '/api/cms/content?XTransformPort=3000';

interface FontOption {
  value: string;
  category: string;
}

const FONT_OPTIONS: FontOption[] = [
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

const DEFAULT_FONT = 'Playfair Display';

interface FontPickerProps {
  section: string;
}

export default function FontPicker({ section }: FontPickerProps) {
  const [selectedFont, setSelectedFont] = useState<string>(DEFAULT_FONT);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch current font for this section on mount
  useEffect(() => {
    async function fetchFont() {
      try {
        setLoading(true);
        const res = await fetch(`${CONTENT_API}&section=${encodeURIComponent(section)}`);
        if (!res.ok) throw new Error('Failed to load font');
        const data = await res.json();
        const fontItem = (data.content ?? []).find(
          (item: { fieldKey: string; fieldValue: string }) => item.fieldKey === 'fontFamily'
        );
        if (fontItem?.fieldValue) {
          setSelectedFont(fontItem.fieldValue);
        }
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to load section font',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }
    fetchFont();
  }, [section]);

  // Scroll selected font into view on load
  useEffect(() => {
    if (!loading && listRef.current) {
      const el = listRef.current.querySelector(`[data-font="${selectedFont}"]`);
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [loading, selectedFont]);

  const handleChange = async (value: string) => {
    if (value === selectedFont || saving) return;
    setSelectedFont(value);
    setSaving(true);
    try {
      const res = await fetch(CONTENT_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              section,
              fieldKey: 'fontFamily',
              fieldValue: value,
              fieldType: 'TEXT',
            },
          ],
        }),
      });
      if (!res.ok) throw new Error('Failed to save font');
      invalidateWeddingCache();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save font selection',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-charcoal-ink/5 shadow-none">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Type className="size-4 text-cinematic-gold" />
          <Label className="text-xs font-medium text-charcoal-ink/50 uppercase tracking-wider">
            Font
          </Label>
          {saving && <Loader2 className="size-3.5 animate-spin text-cinematic-gold ml-auto" />}
        </div>

        {/* Preview */}
        {!loading && (
          <div className="min-w-0">
            <p
              className="text-lg text-charcoal-ink leading-snug truncate"
              style={{ fontFamily: `'${selectedFont}', serif` }}
            >
              Eleanor & James
            </p>
            <p
              className="text-[11px] text-charcoal-ink/40 mt-0.5 italic truncate"
              style={{ fontFamily: `'${selectedFont}', serif` }}
            >
              Together with their families
            </p>
          </div>
        )}

        {/* Scrollable font list */}
        <div>
          <Label className="text-xs font-medium text-charcoal-ink/50 uppercase tracking-wider mb-2 block">
            Choose Font
          </Label>
          <div
            ref={listRef}
            className="max-h-[220px] overflow-y-auto rounded-lg border border-charcoal-ink/10 bg-white/50"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#D4AF37 transparent',
            }}
          >
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-4 animate-spin text-cinematic-gold" />
              </div>
            ) : (
              FONT_CATEGORIES.map((category) => (
                <div key={category}>
                  <div className="sticky top-0 z-10 bg-paper-cream/95 backdrop-blur-sm px-3 py-1.5">
                    <span className="text-[10px] text-cinematic-gold/70 font-semibold uppercase tracking-widest">
                      {category}
                    </span>
                  </div>
                  {FONT_OPTIONS.filter((f) => f.category === category).map((font) => {
                    const isSelected = font.value === selectedFont;
                    return (
                      <button
                        key={font.value}
                        data-font={font.value}
                        onClick={() => handleChange(font.value)}
                        disabled={saving}
                        className={`w-full text-left transition-colors duration-150 ${
                          isSelected
                            ? 'bg-cinematic-gold/10 border-l-2 border-cinematic-gold'
                            : 'border-l-2 border-transparent hover:bg-charcoal-ink/[0.03]'
                        }`}
                      >
                        <div className="px-3 py-2">
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
                            {isSelected && (
                              <Check className="size-3 text-cinematic-gold" strokeWidth={3} />
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}