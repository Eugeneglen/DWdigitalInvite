'use client';

import React, { useRef, useState } from 'react';
import { Upload, X, Loader2, ImageIcon, Replace } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { getSizeGuidance, isImageMime, type FileCategory } from '@/lib/file-storage-client';

const UPLOAD_API = '/api/cms/upload?XTransformPort=3000';

interface MirrorImageUploadProps {
  /** Current image URL (file URL or https://). Empty string = no image. */
  value: string;
  /** Called when a new image is uploaded (receives a file URL from /api/cms/upload). */
  onChange: (url: string) => void;
  /** Called when the image is removed. */
  onRemove: () => void;
  /**
   * Storage category — determines server-side optimization settings
   * (max dimension + JPEG quality) and the size guidance shown to the user.
   * Must match a FileCategory from file-storage-client.ts.
   */
  category: FileCategory;
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
 * Images are uploaded to /api/cms/upload which server-side optimises them
 * (resize + JPEG compress via sharp) before storing. The couple gets a
 * file URL back — no base64 data URLs in the database.
 *
 * Features:
 *  - Prominent "Upload Image" button (not a dashed box)
 *  - Aspect-matched thumbnail (mirrors frontend crop via object-cover)
 *  - Server-side image optimization (auto-resize + JPEG compress)
 *  - Client-side size pre-check with clear guidance toast
 *  - Drag-and-drop on the preview area
 *  - Replace / Remove actions
 */
export default function MirrorImageUpload({
  value,
  onChange,
  onRemove,
  category,
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

  const guidance = getSizeGuidance(category);

  const handleFile = async (file: File) => {
    if (!isImageMime(file.type)) {
      toast({ title: 'Error', description: 'Please select an image file', variant: 'destructive' });
      return;
    }

    // Client-side size pre-check (server enforces too)
    // 25 MB limit — the server auto-optimises via sharp (resize + JPEG)
    const maxSize = 25 * 1024 * 1024; // 25 MB for all images (auto-optimised)
    if (file.size > maxSize) {
      const fileMB = (file.size / 1024 / 1024).toFixed(1);
      toast({
        title: 'File too large',
        description: `Your file is ${fileMB} MB — max is 25 MB. Recommended: ${guidance.recommendedPixels} px. Server will auto-resize and compress.`,
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);
      const res = await fetch(UPLOAD_API, { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Failed to upload');
      }
      const result = await res.json();
      onChange(result.url);
      // Show optimisation info
      if (result.optimised && result.originalSize) {
        toast({
          title: 'Image optimised',
          description: `${(result.originalSize / 1024).toFixed(0)} KB → ${(result.fileSize / 1024).toFixed(0)} KB`,
        });
      }
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Failed to upload image',
        variant: 'destructive',
      });
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
              className="h-9 text-[11px] gap-1.5 border-charcoal-ink/15 hover:border-cinematic-gold hover:text-cinematic-gold"
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
              className="h-9 text-[11px] gap-1.5 text-charcoal-ink/50 hover:text-red-500 hover:bg-red-50"
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
                <p className="text-[10px] text-charcoal-ink/30 mt-1">
                  Max 25 MB · {guidance.recommendedPixels} recommended · Auto-optimised
                </p>
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
