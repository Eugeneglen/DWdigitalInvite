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
  FileEdit,
  ImageOff,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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

interface ContentBlock {
  id: string;
  sectionKey: string;
  title: string;
  content: string;
  imageUrl: string;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

interface TenantBasic {
  id: string;
  name: string;
}

// --- Constants ---

const SECTION_KEYS = [
  'story-chapter1',
  'story-proposal',
  'getting-there-car',
  'getting-there-transit',
  'venue-description',
  'narrative',
  'story-tidbit-1',
  'story-tidbit-2',
  'custom',
];

const SECTION_LABELS: Record<string, string> = {
  'story-chapter1': 'Story — Chapter 1',
  'story-proposal': 'Story — Proposal',
  'getting-there-car': 'Getting There — Car',
  'getting-there-transit': 'Getting There — Transit',
  'venue-description': 'Venue — Description',
  'narrative': 'Narrative',
  'story-tidbit-1': 'Story — Tidbit 1',
  'story-tidbit-2': 'Story — Tidbit 2',
  'custom': 'Custom',
};

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700 border-amber-200',
  published: 'bg-green-50 text-green-700 border-green-200',
};

// --- Schema ---

const contentSchema = z.object({
  sectionKey: z.string().min(1, 'Section is required'),
  title: z.string().min(1, 'Title is required'),
  content: z.string().optional().default(''),
  imageUrl: z.string().optional().default(''),
  status: z.enum(['draft', 'published']).optional().default('draft'),
});

type ContentFormValues = z.infer<typeof contentSchema>;

// --- Main Component ---

export default function CMSContent() {
  const authUser = useCMSStore((s) => s.authUser);
  const selectedTenantId = useCMSStore((s) => s.selectedTenantId);
  const setSelectedTenantId = useCMSStore((s) => s.setSelectedTenantId);

  const [items, setItems] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectionFilter, setSectionFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentBlock | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContentBlock | null>(null);
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
      if (sectionFilter !== 'all') params.set('sectionKey', sectionFilter);
      const res = await fetch(
        `/api/cms/tenants/${selectedTenantId}/blocks?${params.toString()}`,
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
  }, [selectedTenantId, sectionFilter, authUser?.token]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ContentFormValues>({
    resolver: zodResolver(contentSchema),
    defaultValues: { sectionKey: '', title: '', content: '', imageUrl: '', status: 'draft' },
  });

  const openCreate = () => {
    setEditingItem(null);
    reset({
      sectionKey: sectionFilter !== 'all' ? sectionFilter : '',
      title: '',
      content: '',
      imageUrl: '',
      status: 'draft',
    });
    setDialogOpen(true);
  };

  const openEdit = (item: ContentBlock) => {
    setEditingItem(item);
    reset({
      sectionKey: item.sectionKey,
      title: item.title,
      content: item.content || '',
      imageUrl: item.imageUrl || '',
      status: item.status,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values: ContentFormValues) => {
    if (!selectedTenantId) return;
    setSaving(true);
    try {
      const isEdit = !!editingItem;
      const url = isEdit
        ? `/api/cms/tenants/${selectedTenantId}/blocks/${editingItem.id}`
        : `/api/cms/tenants/${selectedTenantId}/blocks`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(isEdit ? 'Block updated' : 'Block added');
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
      const res = await fetch(`/api/cms/tenants/${selectedTenantId}/blocks/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authUser?.token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Block deleted');
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
          <h1 className="text-xl font-semibold text-charcoal-ink">Content Blocks</h1>
          <p className="text-sm text-gray-500 mt-1">Select a tenant to manage its content blocks.</p>
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
        <h1 className="text-xl font-semibold text-charcoal-ink">Content Blocks</h1>
        <Button
          onClick={openCreate}
          className="bg-charcoal-ink text-white hover:bg-charcoal-ink/90 h-9"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Block
        </Button>
      </div>

      {/* Section Filter */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <Label className="text-sm font-medium text-charcoal-ink flex-shrink-0">Filter by Section:</Label>
        <Select value={sectionFilter} onValueChange={setSectionFilter}>
          <SelectTrigger className="h-9 border-gray-300 w-full sm:w-64">
            <SelectValue placeholder="All sections" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sections</SelectItem>
            {SECTION_KEYS.map((key) => (
              <SelectItem key={key} value={key}>
                {SECTION_LABELS[key] || key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex items-start gap-4">
              <Skeleton className="h-16 w-16 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center">
          <FileEdit className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">No content blocks found</p>
          <p className="text-xs text-gray-400 mt-1">
            {sectionFilter !== 'all'
              ? `No blocks in "${SECTION_LABELS[sectionFilter] || sectionFilter}" section.`
              : 'Click "Add Block" to create the first one.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex items-start gap-4 hover:border-gray-300 transition-colors"
            >
              {/* Image Preview */}
              <div className="h-16 w-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200 hidden sm:block">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    width={64}
                    height={64}
                    className="object-cover h-full w-full"
                    unoptimized
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <ImageOff className="h-5 w-5 text-gray-300" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-medium text-charcoal-ink">{item.title}</h4>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${STATUS_STYLES[item.status] || ''}`}
                  >
                    {item.status}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 bg-gray-50 text-gray-600 border-gray-200"
                  >
                    {SECTION_LABELS[item.sectionKey] || item.sectionKey}
                  </Badge>
                </div>
                {item.content && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                    {item.content}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-500 hover:text-charcoal-ink"
                  onClick={() => openEdit(item)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-500 hover:text-red-600"
                  onClick={() => setDeleteTarget(item)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-charcoal-ink">
              {editingItem ? 'Edit Block' : 'Add Block'}
            </DialogTitle>
            <DialogDescription>
              {editingItem ? 'Update the content block below.' : 'Add a new content block.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-charcoal-ink">Section *</Label>
                <Select
                  defaultValue={editingItem?.sectionKey || ''}
                  onValueChange={(val) => setValue('sectionKey', val)}
                >
                  <SelectTrigger className="h-9 border-gray-300">
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTION_KEYS.map((key) => (
                      <SelectItem key={key} value={key}>
                        {SECTION_LABELS[key] || key}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.sectionKey && <p className="text-xs text-red-600">{errors.sectionKey.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-charcoal-ink">Status</Label>
                <Select
                  defaultValue={editingItem?.status || 'draft'}
                  onValueChange={(val) => setValue('status', val as 'draft' | 'published')}
                >
                  <SelectTrigger className="h-9 border-gray-300">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="block-title" className="text-sm font-medium text-charcoal-ink">Title *</Label>
              <Input
                id="block-title"
                placeholder="Block title"
                {...register('title')}
                className="h-9 border-gray-300"
              />
              {errors.title && <p className="text-xs text-red-600">{errors.title.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="block-content" className="text-sm font-medium text-charcoal-ink">Content</Label>
              <Textarea
                id="block-content"
                placeholder="Block content..."
                {...register('content')}
                className="border-gray-300 min-h-[120px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="block-image" className="text-sm font-medium text-charcoal-ink">Image URL</Label>
              <Input
                id="block-image"
                placeholder="https://example.com/image.jpg"
                {...register('imageUrl')}
                className="h-9 border-gray-300"
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
                {editingItem ? 'Save Changes' : 'Add Block'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Block</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.title}</strong>? This action cannot be undone.
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