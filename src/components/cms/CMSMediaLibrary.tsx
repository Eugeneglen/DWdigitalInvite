'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  X,
  Search,
  Loader2,
  FileImage,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MediaAsset {
  id: string;
  accountId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  url: string;
  alt: string | null;
  folder: string | null;
  uploadedById: string;
  createdAt: string;
}

export interface CMSMediaLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string) => void;
  /** Pre-filter by folder */
  folder?: string;
  /** Accept only these MIME types */
  accept?: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncateName(name: string, maxLen = 22): string {
  if (name.length <= maxLen) return name;
  const ext = name.lastIndexOf('.');
  if (ext > 0 && name.length - ext < 8) {
    const base = name.slice(0, ext);
    const extension = name.slice(ext);
    return base.slice(0, maxLen - extension.length - 3) + '...' + extension;
  }
  return name.slice(0, maxLen - 3) + '...';
}

async function compressImage(file: File): Promise<File> {
  // Only compress images that benefit from it
  if (!file.type.startsWith('image/')) return file;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const img = await createImageBitmap(file);

  const MAX_SIZE = 1600;
  let { width, height } = img;

  if (width > MAX_SIZE || height > MAX_SIZE) {
    if (width > height) {
      height = Math.round(height * (MAX_SIZE / width));
      width = MAX_SIZE;
    } else {
      width = Math.round(width * (MAX_SIZE / height));
      height = MAX_SIZE;
    }
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.82);
  });

  return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
    type: 'image/jpeg',
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CMSMediaLibrary({
  open,
  onOpenChange,
  onSelect,
  folder,
  accept,
}: CMSMediaLibraryProps) {
  // ── State ──────────────────────────────────────────────────────────────
  const [mediaList, setMediaList] = React.useState<MediaAsset[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = React.useState<MediaAsset | null>(
    null
  );
  const [deleting, setDeleting] = React.useState(false);

  // Drag state
  const [isDragging, setIsDragging] = React.useState(false);

  // Refs
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dragCounterRef = React.useRef(0);

  // ── Fetch media ────────────────────────────────────────────────────────
  const fetchMedia = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (folder) params.set('folder', folder);
      const res = await fetch(`/api/workspace/media?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch media');
      const data = await res.json();
      let items: MediaAsset[] = data.media ?? [];

      // Filter by accept MIME types
      if (accept && accept.length > 0) {
        items = items.filter((m) => accept.includes(m.mimeType));
      }

      setMediaList(items);
    } catch {
      toast.error('Failed to load media library');
    } finally {
      setLoading(false);
    }
  }, [folder, accept]);

  // Fetch when dialog opens
  React.useEffect(() => {
    if (open) {
      setSearch('');
      fetchMedia();
    }
  }, [open, fetchMedia]);

  // ── Filtered list ──────────────────────────────────────────────────────
  const filteredMedia = React.useMemo(() => {
    if (!search.trim()) return mediaList;
    const q = search.toLowerCase();
    return mediaList.filter(
      (m) =>
        m.originalName.toLowerCase().includes(q) ||
        m.fileName.toLowerCase().includes(q)
    );
  }, [mediaList, search]);

  // ── Upload handler ─────────────────────────────────────────────────────
  const handleUpload = React.useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      // Filter by accept types
      const validFiles = accept
        ? fileArray.filter((f) => accept.includes(f.type))
        : fileArray.filter((f) =>
            ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
          );

      if (validFiles.length === 0) {
        toast.error('No valid files selected (JPEG, PNG, WebP only)');
        return;
      }

      setUploading(true);
      setUploadProgress(0);

      const total = validFiles.length;
      let completed = 0;

      for (const file of validFiles) {
        try {
          const compressed = await compressImage(file);
          const formData = new FormData();
          formData.append('file', compressed);

          const res = await fetch('/api/workspace/media', {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Upload failed');
          }

          completed++;
          setUploadProgress(Math.round((completed / total) * 100));
        } catch (err) {
          toast.error(
            `Failed to upload ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`
          );
        }
      }

      if (completed > 0) {
        toast.success(
          `Uploaded ${completed} image${completed > 1 ? 's' : ''} successfully`
        );
      }

      setUploading(false);
      setUploadProgress(0);
      fetchMedia();
    },
    [accept, fetchMedia]
  );

  // ── Delete handler ─────────────────────────────────────────────────────
  const handleDelete = React.useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/workspace/media/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      toast.success(`Deleted ${deleteTarget.originalName}`);
      setDeleteTarget(null);
      fetchMedia();
    } catch {
      toast.error('Failed to delete image');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, fetchMedia]);

  // ── Select handler ─────────────────────────────────────────────────────
  const handleSelect = React.useCallback(
    (item: MediaAsset) => {
      onSelect(item.url);
      onOpenChange(false);
    },
    [onSelect, onOpenChange]
  );

  // ── Drag & Drop ────────────────────────────────────────────────────────
  const handleDragEnter = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current += 1;
      if (dragCounterRef.current === 1) {
        setIsDragging(true);
      }
    },
    []
  );

  const handleDragLeave = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current === 0) {
        setIsDragging(false);
      }
    },
    []
  );

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleUpload(e.dataTransfer.files);
      }
    },
    [handleUpload]
  );

  const handleFileInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleUpload(e.target.files);
        // Reset input so same file can be re-selected
        e.target.value = '';
      }
    },
    [handleUpload]
  );

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-4xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden bg-[#FCF9F2] border-champagne-silk/50"
          showCloseButton={false}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 pt-5 pb-3">
            <DialogHeader className="gap-0">
              <DialogTitle
                className="font-[family-name:var(--font-inter)] text-charcoal-ink text-xl"
              >
                Media Library
              </DialogTitle>
              <DialogDescription className="font-[family-name:var(--font-inter)] text-charcoal-ink/60">
                Upload, browse, and select images for your invitation
              </DialogDescription>
            </DialogHeader>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-xs p-1.5 text-charcoal-ink/50 hover:text-charcoal-ink hover:bg-charcoal-ink/5 transition-colors"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Upload Zone */}
          <div className="px-4 sm:px-6 pb-3">
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => {
                if (!uploading) fileInputRef.current?.click();
              }}
              className={`
                relative cursor-pointer rounded-lg border-2 border-dashed
                transition-colors duration-200
                ${
                  isDragging
                    ? 'border-cinematic-gold bg-cinematic-gold/5'
                    : 'border-champagne-silk hover:border-cinematic-gold/60 hover:bg-champagne-silk/20'
                }
                ${uploading ? 'pointer-events-none opacity-60' : ''}
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleFileInputChange}
              />
              <div className="flex flex-col items-center justify-center gap-2 py-6">
                {isDragging ? (
                  <ImageIcon className="size-10 text-cinematic-gold" />
                ) : (
                  <Upload className="size-10 text-champagne-silk" />
                )}
                <p className="font-[family-name:var(--font-inter)] text-sm text-charcoal-ink/70">
                  {isDragging
                    ? 'Drop images here'
                    : 'Drop images here or click to upload'}
                </p>
                <p className="font-[family-name:var(--font-inter)] text-xs text-charcoal-ink/40">
                  JPEG, PNG, WebP up to 10MB
                </p>
              </div>

              {/* Upload progress overlay */}
              {uploading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#FCF9F2]/90 rounded-lg">
                  <Loader2 className="size-8 text-cinematic-gold animate-spin mb-3" />
                  <p className="font-[family-name:var(--font-inter)] text-sm text-charcoal-ink/70 mb-2">
                    Uploading...
                  </p>
                  <div className="w-48">
                    <Progress
                      value={uploadProgress}
                      className="h-2 bg-champagne-silk/40"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Search bar */}
          <div className="px-4 sm:px-6 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-charcoal-ink/40" />
              <Input
                placeholder="Search by filename..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 font-[family-name:var(--font-inter)] bg-white/60 border-champagne-silk/60 focus-visible:ring-cinematic-gold/40 h-9 text-sm"
              />
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6 min-h-0">
            {/* Loading state */}
            {loading && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <Skeleton className="aspect-square w-full rounded-md bg-champagne-silk/30" />
                    <Skeleton className="h-3 w-3/4 rounded bg-champagne-silk/20" />
                    <Skeleton className="h-3 w-1/2 rounded bg-champagne-silk/15" />
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loading && filteredMedia.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileImage className="size-12 text-champagne-silk mb-4" />
                <p className="font-[family-name:var(--font-inter)] text-charcoal-ink/60 text-sm mb-1">
                  {search
                    ? 'No images match your search'
                    : 'No media uploaded yet'}
                </p>
                <p className="font-[family-name:var(--font-inter)] text-charcoal-ink/40 text-xs">
                  {search
                    ? 'Try a different search term'
                    : 'Upload your first image using the area above'}
                </p>
              </div>
            )}

            {/* Image grid */}
            {!loading && filteredMedia.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredMedia.map((item) => (
                  <div
                    key={item.id}
                    className="group relative cursor-pointer"
                    onClick={() => handleSelect(item)}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-square w-full overflow-hidden rounded-md border border-champagne-silk/40 bg-white/40 transition-all duration-200 group-hover:ring-2 group-hover:ring-cinematic-gold">
                      <img
                        src={item.url}
                        alt={item.alt || item.originalName}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>

                    {/* Info below thumbnail */}
                    <div className="mt-1.5 px-0.5">
                      <p
                        className="font-[family-name:var(--font-inter)] text-xs text-charcoal-ink/80 truncate"
                        title={item.originalName}
                      >
                        {truncateName(item.originalName)}
                      </p>
                      <p className="font-[family-name:var(--font-inter)] text-[10px] text-charcoal-ink/45">
                        {formatFileSize(item.size)}
                      </p>
                    </div>

                    {/* Hover overlay */}
                    <div className="absolute inset-0 flex flex-col justify-end rounded-md bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                      <div className="p-2">
                        <p
                          className="font-[family-name:var(--font-inter)] text-[11px] text-white font-medium truncate"
                          title={item.originalName}
                        >
                          {truncateName(item.originalName, 28)}
                        </p>
                        <p className="font-[family-name:var(--font-inter)] text-[10px] text-white/70">
                          {item.width && item.height
                            ? `${item.width} × ${item.height} · ${formatFileSize(item.size)}`
                            : formatFileSize(item.size)}
                        </p>
                      </div>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(item);
                      }}
                      className="absolute top-1.5 right-1.5 flex items-center justify-center size-9 rounded-md bg-black/50 text-white/80 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 hover:bg-red-600 hover:text-white pointer-events-auto"
                      aria-label={`Delete ${item.originalName}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="bg-[#FCF9F2] border-champagne-silk/50 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-[family-name:var(--font-inter)] text-charcoal-ink">
              Delete Image
            </AlertDialogTitle>
            <AlertDialogDescription className="font-[family-name:var(--font-inter)] text-charcoal-ink/60">
              Are you sure you want to delete{' '}
              <span className="font-medium text-charcoal-ink/80">
                {deleteTarget?.originalName}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              className="font-[family-name:var(--font-inter)] border-champagne-silk/60 text-charcoal-ink/70 hover:bg-champagne-silk/20 hover:text-charcoal-ink"
              disabled={deleting}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="font-[family-name:var(--font-inter)] bg-red-600 text-white hover:bg-red-700 focus:ring-red-600/40"
            >
              {deleting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Deleting...
                </span>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}