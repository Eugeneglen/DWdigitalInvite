'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Loader2, Trash2, ImagePlus, Eye, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { invalidateWeddingCache } from '@/hooks/usePublicWedding';

const MEDIA_API = '/api/cms/media?XTransformPort=3000';

interface MediaItem {
  id: string;
  url: string;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  category: string;
  sortOrder: number;
}

interface MirrorImageGalleryProps {
  /** Media category, e.g. 'moments', 'story', 'schedule'. */
  category: string;
  /** Human label, e.g. "Moments Gallery". */
  label: string;
  /** Max number of images allowed. */
  maxImages: number;
  /**
   * Frontend aspect ratio — each thumbnail tile uses this exact ratio so the
   * couple sees how each image will crop on the guest site.
   * Examples: 'aspect-[3/4]', 'aspect-[4/3]', 'aspect-square', 'aspect-[16/9]'
   */
  aspectClass?: string;
  /** Helper text shown under the label. */
  helperText?: string;
}

/**
 * MirrorImageGallery — a multi-image upload + gallery where each thumbnail
 * uses the EXACT aspect ratio the guest site uses. Couples see precisely how
 * each image will crop before it goes live.
 *
 * Features:
 *  - Prominent "Add Image" button as the FIRST tile (not mixed into the grid)
 *  - Aspect-matched thumbnails (mirrors frontend crop via object-cover)
 *  - Click thumbnail to preview full-size
 *  - Hover-to-delete with confirmation
 *  - Drag-and-drop anywhere on the grid
 *  - Image count badge (N/max)
 */
export default function MirrorImageGallery({
  category,
  label,
  maxImages,
  aspectClass = 'aspect-[3/4]',
  helperText,
}: MirrorImageGalleryProps) {
  const [images, setImages] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchImages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${MEDIA_API}&category=${encodeURIComponent(category)}`);
      if (!res.ok) throw new Error('Failed to load images');
      const data = await res.json();
      setImages(data.media ?? []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load images', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      toast({ title: 'Invalid file', description: 'Please select image files (PNG, JPG, GIF, WebP)', variant: 'destructive' });
      return;
    }

    const remaining = maxImages - images.length;
    if (remaining <= 0) {
      toast({
        title: 'Limit reached',
        description: `${label} is full (${maxImages} max). Remove an image first.`,
        variant: 'destructive',
      });
      return;
    }

    const toUpload = imageFiles.slice(0, remaining);
    setUploading(true);
    for (const file of toUpload) {
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const res = await fetch(MEDIA_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: dataUrl, fileName: file.name, category, fileType: 'IMAGE' }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || 'Failed to upload');
        }
      } catch (err) {
        toast({
          title: 'Upload failed',
          description: err instanceof Error ? err.message : 'Failed to upload image',
          variant: 'destructive',
        });
      }
    }
    setUploading(false);
    if (toUpload.length > 0) {
      invalidateWeddingCache();
      toast({ title: 'Success', description: `${toUpload.length} image${toUpload.length > 1 ? 's' : ''} added to ${label}` });
    }
    fetchImages();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this image? This action cannot be undone.')) return;
    try {
      setDeleting(id);
      const res = await fetch(`${MEDIA_API}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Failed to delete image');
      }
      invalidateWeddingCache();
      toast({ title: 'Deleted', description: 'Image removed successfully' });
      fetchImages();
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Failed to delete image',
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
    }
  };

  const canAddMore = images.length < maxImages;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-cinematic-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-charcoal-ink/70 uppercase tracking-wider">
            {label} <span className="text-charcoal-ink/40 font-normal">({images.length}/{maxImages})</span>
          </p>
          {helperText && <p className="text-[11px] text-charcoal-ink/40 mt-0.5">{helperText}</p>}
        </div>
        {canAddMore && (
          <Button
            type="button"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="h-8 text-xs gap-1.5 bg-charcoal-ink text-paper-cream hover:bg-charcoal-ink/90 shrink-0"
          >
            {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
            Add Image
          </Button>
        )}
      </div>

      {/* Grid — drag-drop anywhere */}
      <div
        className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 rounded-lg p-1 transition-colors ${
          dragOver ? 'bg-cinematic-gold/5' : ''
        }`}
        onDragOver={(e) => { e.preventDefault(); if (canAddMore) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (canAddMore) handleUpload(e.dataTransfer.files); }}
      >
        {/* Image cards (existing images first, then the add tile if room) */}
        {images.map((item) => (
          <Card
            key={item.id}
            className="border-charcoal-ink/5 shadow-none overflow-hidden group hover:border-champagne-silk transition-colors duration-200"
          >
            {/* Thumbnail — uses the FRONTEND aspect ratio */}
            <div
              className={`relative ${aspectClass} bg-charcoal-ink/5 cursor-pointer`}
              onClick={() => setPreviewUrl(item.url)}
            >
              <img
                src={item.url}
                alt={item.fileName}
                className="w-full h-full object-cover"
                loading="lazy"
                unoptimized
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors duration-200 flex items-center justify-center gap-2">
                <Eye className="size-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </div>
              {/* Delete button (top-right, hover) */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                disabled={deleting === item.id}
                className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/50 text-white hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100"
                title="Delete image"
              >
                {deleting === item.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
              </button>
            </div>
            {/* File name + caption input */}
            <div className="p-2 space-y-1.5">
              <p className="text-[11px] font-medium text-charcoal-ink/60 truncate" title={item.fileName}>
                {item.fileName}
              </p>
            </div>
          </Card>
        ))}

        {/* Empty state OR add-more tile */}
        {canAddMore && images.length === 0 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={`col-span-full ${aspectClass} min-h-[200px] rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 p-6 text-center transition-colors ${
              dragOver
                ? 'border-cinematic-gold bg-cinematic-gold/5'
                : 'border-charcoal-ink/15 hover:border-cinematic-gold/60 hover:bg-cinematic-gold/5'
            }`}
          >
            {uploading ? (
              <Loader2 className="size-7 animate-spin text-cinematic-gold" />
            ) : (
              <>
                <div className="flex items-center justify-center h-11 w-11 rounded-full bg-cinematic-gold/10">
                  <ImagePlus className="size-5 text-cinematic-gold" />
                </div>
                <p className="text-sm font-medium text-charcoal-ink/70">Drag & drop images, or</p>
                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium bg-charcoal-ink text-paper-cream">
                  <ImagePlus className="size-3.5" /> Add Images
                </span>
                <p className="text-[11px] text-charcoal-ink/40 mt-1">Up to {maxImages} · Mirrors guest-site framing</p>
              </>
            )}
          </button>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="sm:max-w-2xl p-2">
          <DialogHeader>
            <DialogTitle className="sr-only">Image Preview</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <img src={previewUrl} alt="Preview" className="w-full rounded-lg" unoptimized />
          )}
        </DialogContent>
      </Dialog>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { handleUpload(e.target.files); e.target.value = ''; }}
      />
    </div>
  );
}
