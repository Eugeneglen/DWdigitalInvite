'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ImageIcon,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useCMSStore } from '@/store/useCMSStore';

// --- Types ---

interface MediaItem {
  id: string;
  url: string;
  caption: string;
  altText: string;
  category: string;
  isCover: boolean;
  createdAt: string;
}

interface TenantBasic {
  id: string;
  name: string;
}

// --- Constants ---

const MEDIA_CATEGORIES = [
  'hero',
  'tea-ceremony',
  'venue',
  'schedule',
  'story',
  'gallery',
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  hero: 'Hero',
  'tea-ceremony': 'Ceremony Section',
  venue: 'Venue',
  schedule: 'Schedule',
  story: 'Story',
  gallery: 'Gallery',
};

// --- Schema ---

const mediaSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  category: z.string().min(1, 'Category is required'),
  caption: z.string().optional().default(''),
  altText: z.string().optional().default(''),
});

type MediaFormValues = z.infer<typeof mediaSchema>;

// --- Media Card ---

function MediaCard({
  item,
  onEdit,
  onDelete,
}: {
  item: MediaItem;
  onEdit: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden group">
      {/* Image */}
      <div className="relative aspect-square bg-gray-100 overflow-hidden">
        {item.url ? (
          <Image
            src={item.url}
            alt={item.altText || item.caption || 'Media'}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, 25vw"
            unoptimized
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <ImageIcon className="h-8 w-8 text-gray-300" />
          </div>
        )}

        {/* Cover Badge */}
        {item.isCover && (
          <Badge className="absolute top-2 left-2 bg-cinematic-gold text-white border-cinematic-gold text-[10px]">
            <Star className="h-3 w-3 mr-1" />
            Cover
          </Badge>
        )}

        {/* Category Badge */}
        <Badge
          variant="outline"
          className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm text-[10px] text-charcoal-ink border-gray-200"
        >
          {CATEGORY_LABELS[item.category] || item.category}
        </Badge>
      </div>

      {/* Info */}
      <div className="p-3">
        {item.caption && (
          <p className="text-xs font-medium text-charcoal-ink truncate">{item.caption}</p>
        )}
        {item.altText && !item.caption && (
          <p className="text-xs text-gray-500 truncate">{item.altText}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-gray-500 hover:text-charcoal-ink flex-1"
            onClick={() => onEdit(item)}
          >
            <Pencil className="h-3 w-3 mr-1" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-gray-500 hover:text-red-600 flex-1"
            onClick={() => onDelete(item)}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

// --- Main Component ---

export default function CMSMedia() {
  const authUser = useCMSStore((s) => s.authUser);
  const selectedTenantId = useCMSStore((s) => s.selectedTenantId);
  const setSelectedTenantId = useCMSStore((s) => s.setSelectedTenantId);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [tenants, setTenants] = useState<TenantBasic[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);

  const authHeaders = {
    Authorization: `Bearer ${authUser?.token}`,
    'Content-Type': 'application/json',
  };

  // Fetch tenants if no selected tenant
  useEffect(() => {
    if (selectedTenantId) return;
    const fetchTenants = async () => {
      setTenantsLoading(true);
      try {
        const res = await fetch('/api/cms/tenants?limit=100', {
          headers: { Authorization: `Bearer ${authUser?.token}` },
        });
        const data = await res.json();
        if (data.success) {
          setTenants(data.data.tenants || []);
        }
      } catch {
        // silently handle
      } finally {
        setTenantsLoading(false);
      }
    };
    fetchTenants();
  }, [selectedTenantId, authUser?.token]);

  const fetchItems = useCallback(async () => {
    if (!selectedTenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCategory !== 'all') params.set('category', activeCategory);
      const res = await fetch(
        `/api/cms/tenants/${selectedTenantId}/media?${params.toString()}`,
        { headers: { Authorization: `Bearer ${authUser?.token}` } }
      );
      const data = await res.json();
      if (data.success) {
        setItems(Array.isArray(data.data) ? data.data : []);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [selectedTenantId, activeCategory, authUser?.token]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<MediaFormValues>({
    resolver: zodResolver(mediaSchema),
    defaultValues: { url: '', category: '', caption: '', altText: '' },
  });

  const watchUrlValue = watch('url');

  const openCreate = () => {
    setEditingItem(null);
    reset({ url: '', category: activeCategory !== 'all' ? activeCategory : '', caption: '', altText: '' });
    setDialogOpen(true);
  };

  const openEdit = (item: MediaItem) => {
    setEditingItem(item);
    reset({
      url: item.url,
      category: item.category,
      caption: item.caption || '',
      altText: item.altText || '',
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values: MediaFormValues) => {
    if (!selectedTenantId) return;
    setSaving(true);
    try {
      const isEdit = !!editingItem;
      const url = isEdit
        ? `/api/cms/tenants/${selectedTenantId}/media/${editingItem.id}`
        : `/api/cms/tenants/${selectedTenantId}/media`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(isEdit ? 'Media updated' : 'Media added');
        setDialogOpen(false);
        fetchItems();
      } else {
        toast.error(data.error || 'Something went wrong');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !selectedTenantId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/cms/tenants/${selectedTenantId}/media/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authUser?.token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Media deleted');
        setDeleteTarget(null);
        fetchItems();
      } else {
        toast.error(data.error || 'Failed to delete');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setDeleting(false);
    }
  };

  // No tenant selected
  if (!selectedTenantId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-charcoal-ink">Media Library</h1>
          <p className="text-sm text-gray-500 mt-1">Select a tenant to manage its media.</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <Label className="text-sm font-medium text-charcoal-ink">Select Tenant</Label>
          {tenantsLoading ? (
            <Skeleton className="h-9 w-full mt-2" />
          ) : (
            <Select onValueChange={(val) => setSelectedTenantId(val)}>
              <SelectTrigger className="mt-2 h-9 border-gray-300">
                <SelectValue placeholder="Choose a tenant..." />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-semibold text-charcoal-ink">Media Library</h1>
        <Button
          onClick={openCreate}
          className="bg-charcoal-ink text-white hover:bg-charcoal-ink/90 h-9"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Media
        </Button>
      </div>

      {/* Category Filter Tabs */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="flex-wrap h-auto gap-1 bg-gray-100 p-1">
          <TabsTrigger value="all" className="text-xs h-7 px-3">All</TabsTrigger>
          {MEDIA_CATEGORIES.map((cat) => (
            <TabsTrigger key={cat} value={cat} className="text-xs h-7 px-3">
              {CATEGORY_LABELS[cat]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <Skeleton className="aspect-square w-full" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center">
          <ImageIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">No media items found</p>
          <p className="text-xs text-gray-400 mt-1">
            {activeCategory !== 'all'
              ? `No items in "${CATEGORY_LABELS[activeCategory] || activeCategory}" category.`
              : 'Click "Add Media" to upload the first one.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-charcoal-ink">
              {editingItem ? 'Edit Media' : 'Add Media'}
            </DialogTitle>
            <DialogDescription>
              {editingItem ? 'Update the media details below.' : 'Add a new media item to the library.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="media-url" className="text-sm font-medium text-charcoal-ink">Image URL *</Label>
              <Input
                id="media-url"
                placeholder="https://example.com/image.jpg"
                {...register('url')}
                className="h-9 border-gray-300"
              />
              {errors.url && <p className="text-xs text-red-600">{errors.url.message}</p>}
            </div>

            {/* Image Preview */}
            {watchUrlValue && (
              <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                <Image
                  src={watchUrlValue}
                  alt="Preview"
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 90vw, 500px"
                  unoptimized
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-charcoal-ink">Category *</Label>
              <Select
                defaultValue={editingItem?.category || ''}
                onValueChange={(val) => setValue('category', val)}
              >
                <SelectTrigger className="h-9 border-gray-300">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {MEDIA_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-red-600">{errors.category.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="media-caption" className="text-sm font-medium text-charcoal-ink">Caption</Label>
              <Input
                id="media-caption"
                placeholder="A beautiful moment..."
                {...register('caption')}
                className="h-9 border-gray-300"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="media-alt" className="text-sm font-medium text-charcoal-ink">Alt Text</Label>
              <Textarea
                id="media-alt"
                placeholder="Describe this image for accessibility..."
                {...register('altText')}
                className="border-gray-300 min-h-[60px]"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="h-9 bg-charcoal-ink text-white hover:bg-charcoal-ink/90"
              >
                {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                {editingItem ? 'Save Changes' : 'Add Media'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Media</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this media item? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

