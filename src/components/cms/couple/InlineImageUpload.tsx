'use client';

import React, { useState, useRef } from 'react';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getSizeGuidance, isImageMime, type FileCategory } from '@/lib/file-storage-client';

const UPLOAD_API = '/api/cms/upload?XTransformPort=3000';

interface InlineImageUploadProps {
  /** Current image URL (file URL or https://) */
  value: string;
  /** Called when a new image is uploaded (receives a file URL from /api/cms/upload) */
  onChange: (url: string) => void;
  /** Called when the image is removed */
  onRemove: () => void;
  /**
   * Storage category — determines server-side optimization settings
   * and the size guidance shown to the user.
   */
  category: FileCategory;
  /** Label shown in the upload zone */
  label?: string;
  /** Aspect ratio class, e.g. 'aspect-video', 'aspect-[4/5]' */
  aspectClass?: string;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * A single-image upload control that replaces a plain text URL input.
 * Uploads to /api/cms/upload for server-side optimization (resize + JPEG).
 * Returns a file URL — no base64 data URLs in the database.
 */
export default function InlineImageUpload({
  value,
  onChange,
  onRemove,
  category,
  label = 'Upload Image',
  aspectClass = 'aspect-video',
  disabled = false,
}: InlineImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const guidance = getSizeGuidance(category);

  const handleFile = async (file: File) => {
    if (!isImageMime(file.type)) {
      toast({ title: 'Error', description: 'Please select an image file', variant: 'destructive' });
      return;
    }

    const maxSize = 25 * 1024 * 1024; // 25 MB (auto-optimised)
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

  return (
    <div className="space-y-2">
      {/* Upload / Preview area */}
      <div
        className={`
          relative ${aspectClass} w-full rounded-lg border-2 border-dashed overflow-hidden
          transition-colors duration-200 cursor-pointer group
          ${value
            ? 'border-charcoal-ink/10 hover:border-cinematic-gold/50'
            : 'border-charcoal-ink/10 hover:border-cinematic-gold hover:bg-cinematic-gold/5'
          }
          ${disabled ? 'pointer-events-none opacity-60' : ''}
        `}
        onClick={() => !disabled && !uploading && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => {
          e.preventDefault();
          if (disabled || uploading) return;
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        {value ? (
          <>
            <img
              src={value}
              alt="Preview"
              className="w-full h-full object-cover"
              unoptimized
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center gap-2">
              <span className="text-white text-xs font-medium opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                Replace
              </span>
            </div>
            {/* Remove button */}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="absolute top-2 right-2 p-2.5 rounded-full bg-black/50 text-white hover:bg-red-500 transition-colors"
                title="Remove image"
              >
                <X className="size-3.5" />
              </button>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            {uploading ? (
              <Loader2 className="size-6 animate-spin text-cinematic-gold" />
            ) : (
              <>
                <Upload className="size-6 text-charcoal-ink/25 group-hover:text-cinematic-gold transition-colors" />
                <p className="text-xs text-charcoal-ink/40 font-medium group-hover:text-cinematic-gold/70 transition-colors">
                  {label}
                </p>
                <p className="text-[10px] text-charcoal-ink/25">
                  Max 25 MB · {guidance.recommendedPixels} recommended · or drag & drop
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
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
