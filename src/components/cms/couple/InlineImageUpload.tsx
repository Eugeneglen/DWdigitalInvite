'use client';

import React, { useState, useRef } from 'react';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';

interface InlineImageUploadProps {
  /** Current image URL (data: or https://) */
  value: string;
  /** Called when a new image is selected (receives a base64 data URL) */
  onChange: (dataUrl: string) => void;
  /** Called when the image is removed */
  onRemove: () => void;
  /** Label shown in the upload zone */
  label?: string;
  /** Aspect ratio class, e.g. 'aspect-video', 'aspect-[4/5]' */
  aspectClass?: string;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * A single-image upload control that replaces a plain text URL input.
 * Converts the selected file to a base64 data URL and calls onChange.
 */
export default function InlineImageUpload({
  value,
  onChange,
  onRemove,
  label = 'Upload Image',
  aspectClass = 'aspect-video',
  disabled = false,
}: InlineImageUploadProps) {
  const [uploading, setUploading] = useState(false);
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
                <p className="text-[10px] text-charcoal-ink/25">or drag & drop</p>
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