'use client';

import React, { useRef, useState } from 'react';
import { Upload, X, Loader2, ImageIcon, Replace } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MirrorImageUploadProps {
  /** Current image URL (data: or https://). Empty string = no image. */
  value: string;
  /** Called when a new image is selected (receives a base64 data URL). */
  onChange: (dataUrl: string) => void;
  /** Called when the image is removed. */
  onRemove: () => void;
  /** Label shown above the upload area, e.g. "Hero Visual". */
  label?: string;
  /** Helper text under the label, e.g. "Full-bleed hero image". */
  helperText?: string;
  /**
   * Frontend aspect ratio — the CMS thumbnail uses this exact ratio so the
   * couple sees how the image will crop on the guest site.
   * Examples: 'aspect-[16/9]', 'aspect-[4/3]', 'aspect-[3/4]', 'aspect-[2/3]', 'aspect-square'
   */
  aspectClass?: string;
  /** File name to display under the thumbnail (optional). */
  fileName?: string;
  /** Disabled state. */
  disabled?: boolean;
  /** Accepted file types (default: images only). */
  accept?: string;
  /**
   * Optional max width for the thumbnail (e.g. '280px', '320px').
   * Use for portrait/tall aspect ratios (2:3, 3:4) so the thumbnail doesn't
   * dominate the page at full container width. The thumbnail is centered
   * within its container when constrained.
   */
  maxWidth?: string;
}

/**
 * MirrorImageUpload — a single-image upload control where the thumbnail uses
 * the EXACT aspect ratio the guest site uses. This lets couples see precisely
 * how their image will crop before saving, preventing surprises (e.g. a wide
 * logo getting awkwardly cropped to a portrait hero).
 *
 * Features:
 *  - Prominent "Upload Image" button (not a dashed box)
 *  - Aspect-matched thumbnail (mirrors frontend crop via object-cover)
 *  - Image metadata (file name, when provided)
 *  - Replace / Remove actions
 *  - Drag-and-drop on the preview area
 */
export default function MirrorImageUpload({
  value,
  onChange,
  onRemove,
  label = 'Upload Image',
  helperText,
  aspectClass = 'aspect-[16/9]',
  fileName,
  disabled = false,
  accept = 'image/*',
  maxWidth,
}: MirrorImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
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
    if (!disabled && !uploading) fileRef.current?.click();
  };

  return (
    <div className="space-y-2">
      {/* Label + helper */}
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-charcoal-ink/70 uppercase tracking-wider">{label}</p>
          {helperText && <p className="text-[11px] text-charcoal-ink/40 mt-0.5">{helperText}</p>}
        </div>
        {value && !disabled && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openPicker}
              disabled={uploading}
              className="h-7 text-[11px] gap-1.5 border-charcoal-ink/15 hover:border-cinematic-gold hover:text-cinematic-gold"
            >
              <Replace className="size-3" />
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              disabled={uploading}
              className="h-7 text-[11px] gap-1.5 text-charcoal-ink/50 hover:text-red-500 hover:bg-red-50"
            >
              <X className="size-3" />
              Remove
            </Button>
          </div>
        )}
      </div>

      {/* Thumbnail / Upload area — uses the frontend aspect ratio.
          When maxWidth is set (for portrait/tall ratios), the thumbnail is
          constrained and centered so it doesn't dominate the page. */}
      <div
        className={`relative ${aspectClass} ${maxWidth ? '' : 'w-full'} rounded-lg overflow-hidden border-2 transition-colors duration-200 ${
          value
            ? 'border-charcoal-ink/10'
            : dragOver
              ? 'border-cinematic-gold bg-cinematic-gold/5'
              : 'border-dashed border-charcoal-ink/15 hover:border-cinematic-gold/60 hover:bg-cinematic-gold/5'
        } ${disabled ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
        style={maxWidth ? { maxWidth, marginInline: 'auto' } : undefined}
        onClick={openPicker}
        onDragOver={(e) => { e.preventDefault(); if (!disabled && !uploading) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled || uploading) return;
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
      >
        {value ? (
          <>
            <img
              src={value}
              alt={fileName || 'Preview'}
              className="w-full h-full object-cover"
              unoptimized
            />
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
                  <ImageIcon className="size-5 text-cinematic-gold" />
                </div>
                <p className="text-xs font-medium text-charcoal-ink/60">Drag & drop, or</p>
                <Button
                  type="button"
                  size="sm"
                  disabled={disabled}
                  className="h-8 text-xs gap-1.5 bg-charcoal-ink text-paper-cream hover:bg-charcoal-ink/90"
                >
                  <Upload className="size-3.5" />
                  Upload Image
                </Button>
                <p className="text-[10px] text-charcoal-ink/30 mt-1">Mirrors guest-site framing</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Metadata */}
      {value && fileName && (
        <p className="text-[11px] text-charcoal-ink/40 truncate" title={fileName}>
          {fileName}
        </p>
      )}

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept={accept}
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
