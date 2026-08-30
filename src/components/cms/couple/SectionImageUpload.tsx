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
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { getSizeGuidance, isImageMime, type FileCategory } from '@/lib/file-storage-client';

const MEDIA_API = '/api/cms/media?XTransformPort=3000';
const UPLOAD_API = '/api/cms/upload?XTransformPort=3000';

interface MediaItem {
  id: string;
  url: string;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  category: string;
  sortOrder: number;
}

interface SectionImageUploadProps {
  category: string;
  label: string;
  maxImages: number;
}

export default function SectionImageUpload({ category, label, maxImages }: SectionImageUploadProps) {
  const [images, setImages] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const guidance = getSizeGuidance(category as FileCategory);

  const fetchImages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${MEDIA_API}&category=${encodeURIComponent(category)}`);
      if (!res.ok) throw new Error('Failed to load images');
      const data = await res.json();
      setImages(data.media ?? []);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load images',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter((f) => isImageMime(f.type));
    if (imageFiles.length === 0) {
      toast({
        title: 'Invalid file',
        description: 'Please select image files (PNG, JPG, GIF, WebP)',
        variant: 'destructive',
      });
      return;
    }

    const remaining = maxImages - images.length;
    if (remaining <= 0) {
      toast({
        title: 'Limit reached',
        description: `${label} section is full (${maxImages} images max). Remove an image first.`,
        variant: 'destructive',
      });
      return;
    }

    const toUpload = imageFiles.slice(0, remaining);
    const maxSize = 25 * 1024 * 1024; // 25 MB (auto-optimised)

    setUploading(true);
    let successCount = 0;
    for (const file of toUpload) {
      // Client-side size pre-check
      if (file.size > maxSize) {
        const fileMB = (file.size / 1024 / 1024).toFixed(1);
        toast({
          title: 'File too large',
          description: `"${file.name}" is ${fileMB} MB — max is 25 MB. Recommended: ${guidance.recommendedPixels} px. Server will auto-resize and compress.`,
          variant: 'destructive',
        });
        continue;
      }
      try {
        // Step 1: Upload to /api/cms/upload (server-side optimises via sharp)
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', category);
        const uploadRes = await fetch(UPLOAD_API, { method: 'POST', body: formData });
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || 'Failed to upload');
        }
        const uploadResult = await uploadRes.json();

        // Step 2: Create media library entry with the file URL (not base64)
        const res = await fetch(MEDIA_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: uploadResult.url,
            fileName: file.name,
            category,
            fileType: 'IMAGE',
            fileSize: uploadResult.fileSize,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || 'Failed to save');
        }
        successCount++;
      } catch (err) {
        toast({
          title: 'Upload failed',
          description: err instanceof Error ? err.message : `Failed to upload ${file.name}`,
          variant: 'destructive',
        });
      }
    }
    setUploading(false);
    if (successCount > 0) {
      invalidateWeddingCache();
      toast({
        title: 'Success',
        description: `${successCount} image${successCount > 1 ? 's' : ''} added to ${label}`,
      });
    }
    fetchImages();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm('Delete this image?', 'This action cannot be undone.');
    if (!ok) return;

    try {
      setDeleting(id);
      const res = await fetch(`${MEDIA_API}&id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Failed to delete image');
      }
      invalidateWeddingCache();
      toast({
        title: 'Deleted',
        description: 'Image removed successfully',
      });
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
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-charcoal-ink/50">
          {label} ({images.length}/{maxImages})
        </p>
      </div>

      {/* Grid */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
        onDragOver={(e) => {
          e.preventDefault();
          if (canAddMore) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {/* Add image card */}
        {canAddMore && (
          <Card
            className={`border-2 border-dashed aspect-square flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors duration-200 ${
              dragOver
                ? 'border-cinematic-gold bg-cinematic-gold/5'
                : 'border-charcoal-ink/10 hover:border-champagne-silk hover:bg-champagne-silk/10'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="size-6 animate-spin text-cinematic-gold" />
            ) : (
              <>
                <ImagePlus className="size-6 text-champagne-silk" />
                <p className="text-xs text-charcoal-ink/40 font-medium">Add image</p>
                <p className="text-[10px] text-charcoal-ink/25">
                  {maxImages - images.length} remaining
                </p>
              </>
            )}
          </Card>
        )}

        {/* Image cards */}
        {images.map((item) => (
          <Card
            key={item.id}
            className="border-charcoal-ink/5 shadow-none overflow-hidden group hover:border-champagne-silk transition-colors duration-200"
          >
            {/* Thumbnail */}
            <div
              className="relative aspect-square bg-charcoal-ink/5 cursor-pointer"
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
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
                <Eye className="size-6 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200" />
              </div>
            </div>

            {/* Info bar */}
            <div className="p-2.5">
              <p className="text-xs font-medium text-charcoal-ink truncate mb-2" title={item.fileName}>
                {item.fileName}
              </p>
              <div className="flex items-center justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(item.id)}
                  disabled={deleting === item.id}
                  className="h-9 w-9 p-0 text-charcoal-ink/40 hover:text-red-500 hover:bg-red-50"
                  title="Delete"
                >
                  {deleting === item.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="sm:max-w-2xl p-2">
          <DialogHeader>
            <DialogTitle className="sr-only">Image Preview</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full rounded-lg"
              unoptimized
            />
          )}
        </DialogContent>
      </Dialog>

      {ConfirmDialog}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleUpload(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}