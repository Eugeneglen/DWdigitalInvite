'use client';

import React, { useState, useRef } from 'react';
import { Loader2, Upload, Video, X, ImageIcon, Sparkles } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

import { useCoupleCMSStore } from '@/store/useCoupleCMSStore';
import { invalidateWeddingCache } from '@/hooks/usePublicWedding';

const WEDDING_API = '/api/cms/wedding?XTransformPort=3000';
const UPLOAD_API = '/api/cms/upload?XTransformPort=3000';

/** ─── Hero Visual Section (image OR video) — used by CoupleHome ──────────── */

export function HeroVisualSection({ weddingData }: { weddingData: Record<string, unknown> | null }) {
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'image' | 'video' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const heroImgUrl = (weddingData as Record<string, string>)?.heroImageUrl || '';
  const heroVideoUrl = (weddingData as Record<string, string>)?.heroVideoUrl || '';

  // Upload a file (image or video) via the file storage backend.
  // Stores the file on disk and saves the returned URL to WeddingAccount.
  const handleFile = async (file: File) => {
    const isVideo = file.type.startsWith('video/');
    if (!isVideo && !file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Please select an image or video file', variant: 'destructive' });
      return;
    }

    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: 'Error', description: `File too large. Max ${isVideo ? '50 MB' : '10 MB'}.`, variant: 'destructive' });
      return;
    }

    setUploading(true);
    setUploadType(isVideo ? 'video' : 'image');
    try {
      // Step 1: Upload file to the storage backend
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'hero');
      const uploadRes = await fetch(UPLOAD_API, { method: 'POST', body: formData });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to upload file');
      }
      const uploadResult = await uploadRes.json();
      const fileUrl: string = uploadResult.url;

      // Step 2: Save the URL to the WeddingAccount (and clear the other field)
      const fieldKey = isVideo ? 'heroVideoUrl' : 'heroImageUrl';
      const clearKey = isVideo ? 'heroImageUrl' : 'heroVideoUrl';
      const res = await fetch(WEDDING_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [fieldKey]: fileUrl, [clearKey]: '' }),
      });
      if (!res.ok) throw new Error('Failed to save');

      // Step 3: Refresh wedding data in the store
      const weddingRes = await fetch(WEDDING_API);
      if (weddingRes.ok) {
        const data = await weddingRes.json();
        useCoupleCMSStore.getState().setWeddingData(data.wedding ?? data);
      }
      invalidateWeddingCache();
      toast({ title: 'Success', description: `${isVideo ? 'Video' : 'Image'} updated` });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to upload', variant: 'destructive' });
    } finally {
      setUploading(false);
      setUploadType(null);
    }
  };

  const handleRemove = async (type: 'image' | 'video') => {
    try {
      const res = await fetch(WEDDING_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [type === 'image' ? 'heroImageUrl' : 'heroVideoUrl']: '' }),
      });
      if (!res.ok) throw new Error('Failed to remove');

      const weddingRes = await fetch(WEDDING_API);
      if (weddingRes.ok) {
        const data = await weddingRes.json();
        useCoupleCMSStore.getState().setWeddingData(data.wedding ?? data);
      }
      invalidateWeddingCache();
      toast({ title: 'Removed', description: `${type === 'image' ? 'Image' : 'Video'} removed` });
    } catch {
      toast({ title: 'Error', description: 'Failed to remove', variant: 'destructive' });
    }
  };

  return (
    <>
      <Card className="border-charcoal-ink/5 shadow-none">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-cinematic-gold/10">
              <Sparkles className="size-3.5 text-cinematic-gold" />
            </div>
            <div>
              <Label className="text-xs font-medium text-charcoal-ink/70 uppercase tracking-wider">Hero Visual</Label>
              <p className="text-[11px] text-charcoal-ink/40">Full-bleed hero image or video on the home page</p>
            </div>
          </div>

          {/* Current media display (video or image) with remove button */}
          {heroVideoUrl ? (
            <div className="relative aspect-video rounded-lg overflow-hidden border border-charcoal-ink/10 group">
              <video src={heroVideoUrl} className="w-full h-full object-cover" controls />
              <button
                type="button"
                onClick={() => handleRemove('video')}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-red-500 transition-colors"
                title="Remove video"
              >
                <X className="size-3.5" />
              </button>
              <div className="absolute bottom-2 left-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 text-white text-[10px] font-medium">
                  <Video className="size-3" /> Video
                </span>
              </div>
            </div>
          ) : heroImgUrl ? (
            <div className="relative aspect-video rounded-lg overflow-hidden border border-charcoal-ink/10 group">
              <img src={heroImgUrl} alt="Hero" className="w-full h-full object-cover" unoptimized />
              <button
                type="button"
                onClick={() => handleRemove('image')}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-red-500 transition-colors"
                title="Remove image"
              >
                <X className="size-3.5" />
              </button>
              <div className="absolute bottom-2 left-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 text-white text-[10px] font-medium">
                  <ImageIcon className="size-3" /> Image
                </span>
              </div>
            </div>
          ) : null}

          {/* Upload buttons — always visible, support both image and video.
              Stack vertically on mobile, side-by-side on sm+ screens. */}
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => {
                if (fileRef.current) {
                  fileRef.current.accept = 'image/*';
                  fileRef.current.click();
                }
              }}
              disabled={uploading}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-charcoal-ink/10 hover:border-cinematic-gold hover:bg-cinematic-gold/5 transition-colors text-xs font-medium text-charcoal-ink/70 disabled:opacity-50"
            >
              {uploading && uploadType === 'image' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ImageIcon className="size-3.5" />
              )}
              {heroImgUrl ? 'Replace Image' : 'Upload Image'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (fileRef.current) {
                  fileRef.current.accept = 'video/mp4,video/webm,video/ogg';
                  fileRef.current.click();
                }
              }}
              disabled={uploading}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-charcoal-ink/10 hover:border-cinematic-gold hover:bg-cinematic-gold/5 transition-colors text-xs font-medium text-charcoal-ink/70 disabled:opacity-50"
            >
              {uploading && uploadType === 'video' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Video className="size-3.5" />
              )}
              {heroVideoUrl ? 'Replace Video' : 'Upload Video'}
            </button>
          </div>
          <p className="text-[10px] text-charcoal-ink/30 text-center">
            Image: max 10 MB · Video: max 50 MB (MP4, WebM, OGG) · Silent autoplay loop on guest page
          </p>

          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}

/** ─── Banner Section — used by CoupleHome ─────────────────────────────── */

export function BannerSection({ weddingData }: { weddingData: Record<string, unknown> | null }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const bannerUrl = (weddingData as Record<string, string>)?.bannerUrl || '';

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Please select an image file', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Error', description: 'File too large. Max 10 MB.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      // Step 1: Upload file to the storage backend
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'banner');
      const uploadRes = await fetch(UPLOAD_API, { method: 'POST', body: formData });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to upload file');
      }
      const uploadResult = await uploadRes.json();
      const fileUrl: string = uploadResult.url;

      // Step 2: Save the URL to the WeddingAccount
      const res = await fetch(WEDDING_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bannerUrl: fileUrl }),
      });
      if (!res.ok) throw new Error('Failed to save');

      const weddingRes = await fetch(WEDDING_API);
      if (weddingRes.ok) {
        const data = await weddingRes.json();
        useCoupleCMSStore.getState().setWeddingData(data.wedding ?? data);
      }
      invalidateWeddingCache();
      toast({ title: 'Success', description: 'Banner updated' });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to upload', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    try {
      const res = await fetch(WEDDING_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bannerUrl: '' }),
      });
      if (!res.ok) throw new Error('Failed to remove');

      const weddingRes = await fetch(WEDDING_API);
      if (weddingRes.ok) {
        const data = await weddingRes.json();
        useCoupleCMSStore.getState().setWeddingData(data.wedding ?? data);
      }
      invalidateWeddingCache();
      toast({ title: 'Removed', description: 'Banner removed' });
    } catch {
      toast({ title: 'Error', description: 'Failed to remove', variant: 'destructive' });
    }
  };

  return (
    <>
      <Card className="border-charcoal-ink/5 shadow-none">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-cinematic-gold/10">
              <ImageIcon className="size-3.5 text-cinematic-gold" />
            </div>
            <div>
              <Label className="text-xs font-medium text-charcoal-ink/70 uppercase tracking-wider">Banner Design</Label>
              <p className="text-[11px] text-charcoal-ink/40">Top banner shown across all pages</p>
            </div>
          </div>

          {bannerUrl ? (
            <div
              className="relative aspect-[21/9] rounded-lg overflow-hidden border border-charcoal-ink/10 group"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
            >
              <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" unoptimized />
            </div>
          ) : (
            <div
              className="relative aspect-[21/9] rounded-lg border-2 border-dashed border-charcoal-ink/10 hover:border-cinematic-gold hover:bg-cinematic-gold/5 transition-colors duration-200 cursor-pointer flex flex-col items-center justify-center gap-2"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
            >
              {uploading ? (
                <Loader2 className="size-6 animate-spin text-cinematic-gold" />
              ) : (
                <>
                  <Upload className="size-6 text-charcoal-ink/25" />
                  <p className="text-xs text-charcoal-ink/40 font-medium">Upload banner image</p>
                  <p className="text-[10px] text-charcoal-ink/25">Max 10 MB · Wide aspect ratio recommended</p>
                </>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-charcoal-ink/10 hover:border-cinematic-gold hover:bg-cinematic-gold/5 transition-colors text-xs font-medium text-charcoal-ink/70 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ImageIcon className="size-3.5" />
              )}
              {bannerUrl ? 'Replace' : 'Upload'}
            </button>
            {bannerUrl && (
              <button
                type="button"
                onClick={handleRemove}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 hover:border-red-400 hover:bg-red-50 transition-colors text-xs font-medium text-red-600"
              >
                <X className="size-3.5" />
                Remove
              </button>
            )}
          </div>
          <p className="text-[10px] text-charcoal-ink/30 text-center">
            Max 10 MB · Wide aspect ratio recommended · Drag & drop to replace
          </p>

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
        </CardContent>
      </Card>

    </>
  );
}