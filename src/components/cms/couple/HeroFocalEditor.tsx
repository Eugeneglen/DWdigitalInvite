'use client';

/**
 * HeroFocalEditor — "See your invitation the way guests do."
 *
 * A phone-shaped live preview of the mobile hero plus two framing controls:
 *
 *  1. FILL (smart crop) — the default full-bleed crop. The couple drags a
 *     focal pin on the phone preview; the crop anchors there on every screen
 *     size (object-position). Auto-detected at upload; adjusted by hand here.
 *  2. FIT (whole photo) — no cropping at all: the entire photo displays over
 *     an ambient backdrop sampled from its own edges.
 *
 * Zero-regression: renders ONLY when a hero image exists; saving is a plain
 * PUT /api/cms/wedding with additive fields (heroFocalX/Y, heroDisplayMode).
 * Existing weddings without these fields keep the legacy centre crop.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Move, RotateCcw, Smartphone } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

import { useCoupleCMSStore } from '@/store/useCoupleCMSStore';
import { invalidateWeddingCache } from '@/hooks/usePublicWedding';
import { useAmbientBackdrop } from '@/hooks/useAmbientBackdrop';

const WEDDING_API = '/api/cms/wedding?XTransformPort=3000';

const clamp01 = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0.5));

interface HeroFocalEditorProps {
  heroImageUrl: string;
  weddingData: Record<string, unknown> | null;
}

export function HeroFocalEditor({ heroImageUrl, weddingData }: HeroFocalEditorProps) {
  // ── Current persisted values (fall back to legacy: no focal, fill mode) ──
  const persistedFocalX = (weddingData as Record<string, number | null> | null)?.heroFocalX ?? null;
  const persistedFocalY = (weddingData as Record<string, number | null> | null)?.heroFocalY ?? null;
  const persistedMode =
    (weddingData as Record<string, string | null> | null)?.heroDisplayMode === 'fit' ? 'fit' : 'fill';

  const [focalX, setFocalX] = useState<number | null>(persistedFocalX);
  const [focalY, setFocalY] = useState<number | null>(persistedFocalY);
  const [mode, setMode] = useState<'fill' | 'fit'>(persistedMode);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Auto-clear the "Saved ✓" badge shortly after it appears (otherwise it
  // lingers until the next unrelated re-render).
  useEffect(() => {
    if (savedAt == null) return;
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSavedAt(null), 2500);
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, [savedAt]);

  // Track external changes (e.g. a fresh upload resets focal server-side)
  useEffect(() => {
    setFocalX((weddingData as Record<string, number | null> | null)?.heroFocalX ?? null);
    setFocalY((weddingData as Record<string, number | null> | null)?.heroFocalY ?? null);
    setMode((weddingData as Record<string, string | null> | null)?.heroDisplayMode === 'fit' ? 'fit' : 'fill');
  }, [weddingData]);

  const dragRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ambient = useAmbientBackdrop(mode === 'fit' ? heroImageUrl : '', 'rgb(240, 235, 226)');

  const objectPosition =
    focalX != null && focalY != null
      ? `${(focalX * 100).toFixed(2)}% ${(focalY * 100).toFixed(2)}%`
      : undefined;

  /** Persist framing fields, then refresh the couple store + public cache. */
  const save = useCallback(
    async (next: { focalX: number | null; focalY: number | null; mode: 'fill' | 'fit' }) => {
      setSaving(true);
      try {
        const body: Record<string, unknown> = { heroDisplayMode: next.mode };
        if (next.focalX != null && next.focalY != null) {
          body.heroFocalX = next.focalX;
          body.heroFocalY = next.focalY;
        } else {
          body.heroFocalX = null;
          body.heroFocalY = null;
        }
        const res = await fetch(WEDDING_API, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed to save framing');

        const weddingRes = await fetch(WEDDING_API);
        if (weddingRes.ok) {
          const data = await weddingRes.json();
          useCoupleCMSStore.getState().setWeddingData(data.wedding ?? data);
        }
        invalidateWeddingCache();
        setSavedAt(Date.now());
      } catch {
        toast({ title: 'Error', description: 'Could not save your framing preference', variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  /** Debounced save so dragging fires one save at the end, not per pixel. */
  const saveDebounced = useCallback(
    (next: { focalX: number | null; focalY: number | null; mode: 'fill' | 'fit' }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => save(next), 700);
    },
    [save],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  /** Pointer → normalised focal coords within the phone preview. */
  const updateFocalFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = dragRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const x = clamp01((clientX - rect.left) / rect.width);
      const y = clamp01((clientY - rect.top) / rect.height);
      setFocalX(x);
      setFocalY(y);
      saveDebounced({ focalX: x, focalY: y, mode });
    },
    [mode, saveDebounced],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== 'fill') return; // focal is meaningless in fit mode
    // Pointer capture is a best-effort enhancement (keeps receiving moves if
    // the cursor briefly leaves the frame). It can throw for synthetic or
    // inactive pointers — never let that abort the focal update itself.
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* drag still works via pointermove + buttons check */
    }
    updateFocalFromPointer(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== 'fill' || e.buttons !== 1) return;
    updateFocalFromPointer(e.clientX, e.clientY);
  };

  /** Keyboard alternative to dragging: arrows nudge the focal point
   *  (2% per press, 10% with Shift). Enter/Space also anchor at the
   *  element's centre so keyboard users get a starting point to nudge. */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (mode !== 'fill') return;
    const step = e.shiftKey ? 0.1 : 0.02;
    let handled = true;
    let nx = focalX ?? 0.5;
    let ny = focalY ?? 0.5;
    switch (e.key) {
      case 'ArrowLeft': nx -= step; break;
      case 'ArrowRight': nx += step; break;
      case 'ArrowUp': ny -= step; break;
      case 'ArrowDown': ny += step; break;
      case 'Enter':
      case ' ': nx = 0.5; ny = 0.5; break;
      default: handled = false;
    }
    if (!handled) return;
    e.preventDefault();
    nx = clamp01(nx);
    ny = clamp01(ny);
    setFocalX(nx);
    setFocalY(ny);
    saveDebounced({ focalX: nx, focalY: ny, mode });
  };

  const setModeAndSave = (nextMode: 'fill' | 'fit') => {
    setMode(nextMode);
    save({ focalX, focalY, mode: nextMode });
  };

  const resetFocal = () => {
    setFocalX(null);
    setFocalY(null);
    save({ focalX: null, focalY: null, mode });
  };

  const justSaved = savedAt != null;
  const hasCustomFocal = focalX != null && focalY != null;

  return (
    <Card className="border-charcoal-ink/5 shadow-none">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-cinematic-gold/10">
            <Smartphone className="size-3.5 text-cinematic-gold" />
          </div>
          <div className="flex-1">
            <Label className="text-xs font-medium text-charcoal-ink/70 uppercase tracking-wider">
              Mobile Framing
            </Label>
            <p className="text-[11px] text-charcoal-ink/40">
              Most guests open your invite on a phone — preview and perfect it here
            </p>
          </div>
          {saving ? (
            <span className="flex items-center gap-1 text-[10px] text-charcoal-ink/40">
              <Loader2 className="size-3 animate-spin" /> Saving…
            </span>
          ) : justSaved ? (
            <span className="text-[10px] text-emerald-600">Saved ✓</span>
          ) : null}
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          {/* Phone-frame live preview — mirrors the guest hero render exactly */}
          <div className="mx-auto shrink-0">
            <div
              className="w-[150px] rounded-[1.75rem] border-[6px] border-charcoal-ink/85 bg-charcoal-ink shadow-lg overflow-hidden relative"
              aria-label="Mobile preview of your hero image"
            >
              {/* Notch */}
              <div className="absolute top-0 inset-x-0 h-4 flex justify-center z-20 pointer-events-none">
                <div className="mt-1.5 w-14 h-4 rounded-full bg-charcoal-ink/90" />
              </div>
              {/* Screen: 9:19.5 ≈ modern phone */}
              <div
                ref={dragRef}
                role="application"
                aria-label="Mobile hero crop focus point. Drag, or use arrow keys to nudge; Shift for larger steps."
                tabIndex={0}
                className="relative aspect-[9/19] overflow-hidden touch-none select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-cinematic-gold"
                style={{ backgroundColor: mode === 'fit' ? ambient : 'transparent', cursor: mode === 'fill' ? 'crosshair' : 'default' }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onKeyDown={onKeyDown}
              >
                <img
                  src={heroImageUrl}
                  alt="Mobile hero preview"
                  draggable={false}
                  className={
                    mode === 'fit'
                      ? 'w-full h-full object-contain object-center pointer-events-none'
                      : 'w-full h-full object-cover object-center pointer-events-none'
                  }
                  style={mode === 'fill' && objectPosition ? { objectPosition } : undefined}
                />
                {/* Focal pin */}
                {mode === 'fill' && hasCustomFocal && (
                  <div
                    className="absolute z-10 pointer-events-none -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${(focalX ?? 0.5) * 100}%`, top: `${(focalY ?? 0.5) * 100}%` }}
                    aria-hidden
                  >
                    <div className="relative flex items-center justify-center">
                      <div className="absolute size-6 rounded-full border-2 border-white/80 shadow" />
                      <div className="size-2 rounded-full bg-white shadow ring-2 ring-black/30" />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <p className="mt-2 text-[10px] text-charcoal-ink/35 text-center max-w-[170px] mx-auto">
              {mode === 'fill'
                ? hasCustomFocal
                  ? 'Drag on the preview (or arrow keys) to move the focus'
                  : 'Tap the preview to set the focus point'
                : 'Whole photo — nothing is cropped'}
            </p>
          </div>

          {/* Controls */}
          <div className="flex-1 space-y-3 min-w-0">
            <div>
              <p className="text-[11px] font-medium text-charcoal-ink/60 mb-1.5">Display style</p>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Hero display style">
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === 'fill'}
                  onClick={() => setModeAndSave('fill')}
                  className={`px-3 py-2.5 rounded-lg border text-left transition-colors ${
                    mode === 'fill'
                      ? 'border-cinematic-gold bg-cinematic-gold/10'
                      : 'border-charcoal-ink/10 hover:border-cinematic-gold/50'
                  }`}
                >
                  <span className="block text-xs font-semibold text-charcoal-ink/80">Fill</span>
                  <span className="block text-[10px] text-charcoal-ink/40 leading-tight mt-0.5">
                    Full-screen drama, smart crop keeps the focus point in frame
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === 'fit'}
                  onClick={() => setModeAndSave('fit')}
                  className={`px-3 py-2.5 rounded-lg border text-left transition-colors ${
                    mode === 'fit'
                      ? 'border-cinematic-gold bg-cinematic-gold/10'
                      : 'border-charcoal-ink/10 hover:border-cinematic-gold/50'
                  }`}
                >
                  <span className="block text-xs font-semibold text-charcoal-ink/80">Fit</span>
                  <span className="block text-[10px] text-charcoal-ink/40 leading-tight mt-0.5">
                    Shows the entire photo, never crops anyone out
                  </span>
                </button>
              </div>
            </div>

            {mode === 'fill' && (
              <button
                type="button"
                onClick={resetFocal}
                disabled={!hasCustomFocal || saving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-charcoal-ink/10 hover:border-cinematic-gold hover:bg-cinematic-gold/5 transition-colors text-xs font-medium text-charcoal-ink/70 disabled:opacity-40"
              >
                <RotateCcw className="size-3.5" />
                Reset to centre
              </button>
            )}

            <p className="text-[10px] text-charcoal-ink/35 leading-relaxed">
              {mode === 'fill' ? (
                <>
                  <Move className="inline size-3 -mt-0.5 mr-0.5" />
                  The focus point anchors the crop on every screen size — both of you stay in frame
                  even on narrow phones. Drag it onto the midpoint between you.
                </>
              ) : (
                <>
                  The full photograph displays over a soft backdrop matched to your photo — like a
                  matted album page. Perfect when you never want a single pixel cut.
                </>
              )}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
