'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, Palette } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { invalidateWeddingCache } from '@/hooks/usePublicWedding';
import { getAutoTextColor, isDarkBackground } from '@/lib/contrast';

const CONTENT_API = '/api/cms/content?XTransformPort=3000';

/** The default DW beige / paper-cream */
const DEFAULT_BG = '#FCF9F2';

/** Curated preset colours matching DW wedding aesthetics */
const PRESETS = [
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

export default function BackgroundColorPicker() {
  const [color, setColor] = useState(DEFAULT_BG);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── Fetch ──────────────────────────────────────────────
  const fetchColor = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${CONTENT_API}&section=global`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      const bgItem = (data.content ?? []).find(
        (item: { fieldKey: string; fieldValue: string }) => item.fieldKey === 'backgroundColor'
      );
      if (bgItem?.fieldValue) {
        setColor(bgItem.fieldValue);
      }
    } catch {
      // Silently fall back to default
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchColor();
  }, [fetchColor]);

  // ── Save ───────────────────────────────────────────────
  const saveColor = async (newColor: string) => {
    setColor(newColor);
    setSaving(true);
    try {
      const res = await fetch(CONTENT_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              section: 'global',
              fieldKey: 'backgroundColor',
              fieldValue: newColor,
              fieldType: 'TEXT',
            },
          ],
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      invalidateWeddingCache();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save background colour',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Derived ────────────────────────────────────────────
  const isDark = isDarkBackground(color);
  const autoText = getAutoTextColor(color);

  if (loading) {
    return (
      <Card className="border-charcoal-ink/5 shadow-none">
        <CardContent className="p-4 flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-cinematic-gold" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-charcoal-ink/5 shadow-none">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="size-4 text-cinematic-gold" />
          <Label className="text-xs font-medium text-charcoal-ink/50 uppercase tracking-wider">
            Background Colour
          </Label>
          {saving && <Loader2 className="size-3.5 animate-spin text-cinematic-gold ml-auto" />}
        </div>

        {/* Current colour preview bar */}
        <div
          className="relative h-14 rounded-md border border-charcoal-ink/10 overflow-hidden transition-colors duration-300"
          style={{ backgroundColor: color }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center text-xs font-medium whitespace-nowrap transition-colors duration-300"
            style={{ color: autoText, opacity: 0.7 }}
          >
            {color.toUpperCase()}
            <span className="ml-2">— {isDark ? 'Dark' : 'Light'}</span>
          </div>
          <input
            type="color"
            value={color}
            onChange={(e) => saveColor(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            title="Pick a custom colour"
          />
        </div>

        {/* Preset swatches grid */}
        <div>
          <p className="text-[11px] text-charcoal-ink/40 mb-2">Presets</p>
          <div className="grid grid-cols-4 gap-1.5">
            {PRESETS.map((preset) => {
              const isActive = color.toUpperCase() === preset.value.toUpperCase();
              return (
                <button
                  key={preset.value}
                  onClick={() => saveColor(preset.value)}
                  className={`
                    group relative h-10 rounded-md border transition-all duration-150
                    ${isActive
                      ? 'border-cinematic-gold ring-2 ring-cinematic-gold/30 scale-105'
                      : 'border-charcoal-ink/10 hover:border-cinematic-gold/50 hover:scale-105'
                    }
                  `}
                  style={{ backgroundColor: preset.value }}
                  title={preset.label}
                  aria-label={preset.label}
                >
                  {isActive && (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ color: isDarkBackground(preset.value) ? '#E8E0D0' : '#1A1A1A' }}
                    >
                      <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                  <span
                    className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-charcoal-ink text-paper-cream opacity-0 sm:group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10"
                  >
                    {preset.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {color.toUpperCase() !== DEFAULT_BG.toUpperCase() && (
          <button
            onClick={() => saveColor(DEFAULT_BG)}
            className="text-[11px] text-charcoal-ink/40 hover:text-cinematic-gold transition-colors"
          >
            Reset to default (Paper Cream)
          </button>
        )}
      </CardContent>
    </Card>
  );
}