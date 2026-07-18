'use client';

import { useEffect, useState } from 'react';
import { Palette, Check, Loader2, Sparkles } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface TemplateColors {
  bg: string;
  text: string;
  accent: string;
  secondary: string;
  muted: string;
}
interface TemplateFonts {
  heading: string;
  body: string;
}
interface WeddingTemplate {
  id: string;
  name: string;
  description: string;
  colors: TemplateColors;
  fonts: TemplateFonts;
  isActive: boolean;
  isDefault: boolean;
}

const CONTENT_API = '/api/cms/content?XTransformPort=3000';
const TEMPLATES_API = '/api/cms/templates?XTransformPort=3000';

export default function CoupleDesign() {
  const [templates, setTemplates] = useState<WeddingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [currentColors, setCurrentColors] = useState<Record<string, string>>({});
  const [currentFont, setCurrentFont] = useState<string>('');

  // Fetch templates + current global content
  useEffect(() => {
    async function load() {
      try {
        const [tmplRes, contentRes] = await Promise.all([
          fetch(TEMPLATES_API),
          fetch(`${CONTENT_API}&section=global`),
        ]);
        if (tmplRes.ok) {
          const data = await tmplRes.json();
          setTemplates(data.templates ?? []);
        }
        if (contentRes.ok) {
          const data = await contentRes.json();
          const items: Array<{ fieldKey: string; fieldValue: string }> = data.content ?? [];
          const map: Record<string, string> = {};
          for (const it of items) map[it.fieldKey] = it.fieldValue;
          setCurrentColors(map);
          if (map.fontFamily) setCurrentFont(map.fontFamily);
        }
      } catch {
        toast({ title: 'Error', description: 'Failed to load templates', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Determine which template is currently applied (by matching all 5 colors)
  const appliedTemplateId = (() => {
    if (!currentColors.backgroundColor) return null;
    return templates.find((t) =>
      t.colors.bg === currentColors.backgroundColor &&
      t.colors.text === (currentColors.textColor || t.colors.text) &&
      t.colors.accent === (currentColors.accentColor || t.colors.accent)
    )?.id ?? null;
  })();

  async function applyTemplate(t: WeddingTemplate) {
    setApplying(t.id);
    try {
      // Write all template colors + fonts to WeddingContent (section: global)
      const items = [
        { section: 'global', fieldKey: 'backgroundColor', fieldValue: t.colors.bg, fieldType: 'TEXT' },
        { section: 'global', fieldKey: 'textColor', fieldValue: t.colors.text, fieldType: 'TEXT' },
        { section: 'global', fieldKey: 'accentColor', fieldValue: t.colors.accent, fieldType: 'TEXT' },
        { section: 'global', fieldKey: 'secondaryColor', fieldValue: t.colors.secondary, fieldType: 'TEXT' },
        { section: 'global', fieldKey: 'mutedColor', fieldValue: t.colors.muted, fieldType: 'TEXT' },
        { section: 'global', fieldKey: 'fontFamily', fieldValue: t.fonts.heading, fieldType: 'TEXT' },
        { section: 'global', fieldKey: 'bodyFont', fieldValue: t.fonts.body, fieldType: 'TEXT' },
        { section: 'hero', fieldKey: 'fontFamily', fieldValue: t.fonts.heading, fieldType: 'TEXT' },
      ];
      const res = await fetch(CONTENT_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error('Failed to apply template');
      setCurrentColors({
        backgroundColor: t.colors.bg,
        textColor: t.colors.text,
        accentColor: t.colors.accent,
        secondaryColor: t.colors.secondary,
        mutedColor: t.colors.muted,
        fontFamily: t.fonts.heading,
        bodyFont: t.fonts.body,
      });
      setCurrentFont(t.fonts.heading);
      toast({ title: 'Template Applied', description: `${t.name} is now your wedding theme.` });
    } catch {
      toast({ title: 'Error', description: 'Failed to apply template', variant: 'destructive' });
    } finally {
      setApplying(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-cinematic-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Palette className="size-5 text-cinematic-gold" />
        <div>
          <h2 className="text-lg font-semibold text-charcoal-ink">Design</h2>
          <p className="text-xs text-charcoal-ink/50">Browse curated themes and apply one to your wedding site.</p>
        </div>
      </div>

      <Separator className="bg-champagne-silk" />

      {/* Template grid */}
      <div>
        <Label className="text-xs font-medium text-charcoal-ink/50 uppercase tracking-wider mb-3 block">
          Choose a Theme ({templates.length} available)
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => {
            const isApplied = appliedTemplateId === t.id;
            const isApplying = applying === t.id;
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
                <h3 className="text-sm font-semibold text-charcoal-ink">{t.name}</h3>
                {t.isDefault && (
                  <span className="inline-block text-[10px] text-cinematic-gold uppercase tracking-wider mt-0.5">Default</span>
                )}
                <p className="text-[11px] text-charcoal-ink/50 mt-1 leading-relaxed line-clamp-2">{t.description}</p>
                <p className="text-[10px] text-charcoal-ink/40 mt-2">
                  <span className="font-medium">Fonts:</span> {t.fonts.heading} / {t.fonts.body}
                </p>

                {/* Apply button */}
                <Button
                  onClick={() => applyTemplate(t)}
                  disabled={isApplied || isApplying}
                  className="w-full mt-3 h-8 text-xs font-medium rounded-md"
                  variant={isApplied ? 'outline' : 'default'}
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="size-3 mr-1 animate-spin" />
                      Applying…
                    </>
                  ) : isApplied ? (
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

      {/* Current settings summary */}
      <div className="bg-paper-cream rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-cinematic-gold" />
          <p className="text-xs font-medium text-charcoal-ink/70 uppercase tracking-wider">Current Theme</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-charcoal-ink/50">Background:</span>{' '}
            <span className="font-mono text-charcoal-ink">{currentColors.backgroundColor || '#FCF9F2'}</span>
          </div>
          <div>
            <span className="text-charcoal-ink/50">Text:</span>{' '}
            <span className="font-mono text-charcoal-ink">{currentColors.textColor || '(auto)'}</span>
          </div>
          <div>
            <span className="text-charcoal-ink/50">Accent:</span>{' '}
            <span className="font-mono text-charcoal-ink">{currentColors.accentColor || '(auto)'}</span>
          </div>
          <div>
            <span className="text-charcoal-ink/50">Font:</span>{' '}
            <span className="text-charcoal-ink">{currentFont || 'Playfair Display'}</span>
          </div>
        </div>
        <p className="text-[11px] text-charcoal-ink/40 mt-2">
          For finer control, use the Colour &amp; Font pickers on the Home page.
        </p>
      </div>
    </div>
  );
}
