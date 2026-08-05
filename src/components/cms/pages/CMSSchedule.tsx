'use client';

import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  GripVertical,
  Clock,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
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

interface ScheduleItem {
  id: string;
  order: number;
  time: string;
  title: string;
  description: string;
  tags: string;
  enabled: boolean;
}

interface TenantBasic {
  id: string;
  name: string;
}

// --- Schema ---

const scheduleSchema = z.object({
  time: z.string().min(1, 'Time is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().default(''),
  tags: z.string().optional().default(''),
  enabled: z.boolean().optional().default(true),
});

type ScheduleFormValues = z.infer<typeof scheduleSchema>;

// --- Sortable Item ---

function SortableScheduleItem({
  item,
  onEdit,
  onDelete,
  onToggle,
}: {
  item: ScheduleItem;
  onEdit: (item: ScheduleItem) => void;
  onDelete: (item: ScheduleItem) => void;
  onToggle: (item: ScheduleItem) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const tags = Array.isArray(item.tags)
    ? item.tags
    : typeof item.tags === 'string'
      ? item.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-3 p-4 rounded-lg border bg-white transition-colors ${
        isDragging
          ? 'border-cinematic-gold/50 shadow-md'
          : 'border-gray-200 hover:border-gray-300'
      } ${!item.enabled ? 'opacity-60' : ''}`}
    >
      {/* Drag Handle */}
      <button
        className="mt-0.5 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* Order */}
      <span className="text-xs font-mono text-gray-400 mt-1 w-6 text-center flex-shrink-0">
        {item.order + 1}
      </span>

      {/* Time Badge */}
      <Badge
        variant="outline"
        className="bg-cinematic-gold/10 text-cinematic-gold border-cinematic-gold/30 text-xs flex-shrink-0 mt-0.5"
      >
        <Clock className="h-3 w-3 mr-1" />
        {item.time}
      </Badge>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-charcoal-ink truncate">
          {item.title}
        </h4>
        {item.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
            {item.description}
          </p>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {tags.map((tag, i) => (
              <Badge
                key={i}
                variant="outline"
                className="text-[10px] px-1.5 py-0 bg-gray-50 text-gray-600 border-gray-200"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Switch
          checked={item.enabled}
          onCheckedChange={() => onToggle(item)}
          className="scale-75 origin-left"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-500 hover:text-charcoal-ink"
          onClick={() => onEdit(item)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-500 hover:text-red-600"
          onClick={() => onDelete(item)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// --- Main Component ---

export default function CMSSchedule() {
  const authUser = useCMSStore((s) => s.authUser);
  const selectedTenantId = useCMSStore((s) => s.selectedTenantId);
  const setSelectedTenantId = useCMSStore((s) => s.setSelectedTenantId);

  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScheduleItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [tenants, setTenants] = useState<TenantBasic[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
      const res = await fetch(`/api/cms/tenants/${selectedTenantId}/schedule`, {
        headers: { Authorization: `Bearer ${authUser?.token}` },
      });
      const data = await res.json();
      if (data.success) {
        setItems((Array.isArray(data.data) ? data.data : []).sort((a: ScheduleItem, b: ScheduleItem) => a.order - b.order));
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [selectedTenantId, authUser?.token]);

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
  } = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: { time: '', title: '', description: '', tags: '', enabled: true },
  });

  const enabledWatch = watch('enabled');

  const openCreate = () => {
    setEditingItem(null);
    reset({ time: '', title: '', description: '', tags: '', enabled: true });
    setDialogOpen(true);
  };

  const openEdit = (item: ScheduleItem) => {
    setEditingItem(item);
    reset({
      time: item.time,
      title: item.title,
      description: item.description || '',
      tags: item.tags || '',
      enabled: item.enabled,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values: ScheduleFormValues) => {
    if (!selectedTenantId) return;
    setSaving(true);
    try {
      const isEdit = !!editingItem;
      const url = isEdit
        ? `/api/cms/tenants/${selectedTenantId}/schedule/${editingItem.id}`
        : `/api/cms/tenants/${selectedTenantId}/schedule`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(isEdit ? 'Event updated' : 'Event added');
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
      const res = await fetch(`/api/cms/tenants/${selectedTenantId}/schedule/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authUser?.token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Event deleted');
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

  const handleToggle = async (item: ScheduleItem) => {
    if (!selectedTenantId) return;
    try {
      const res = await fetch(`/api/cms/tenants/${selectedTenantId}/schedule/${item.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ enabled: !item.enabled }),
      });
      const data = await res.json();
      if (data.success) {
        fetchItems();
      } else {
        toast.error(data.error || 'Failed to update');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex).map((item, idx) => ({
      ...item,
      order: idx,
    }));

    setItems(reordered);

    // Persist order
    if (selectedTenantId) {
      try {
        await fetch(`/api/cms/tenants/${selectedTenantId}/schedule/reorder`, {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify({ ids: reordered.map((i) => i.id) }),
        });
      } catch {
        // Silently handle — UI is already updated
      }
    }
  };

  // No tenant selected
  if (!selectedTenantId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-charcoal-ink">Schedule</h1>
          <p className="text-sm text-gray-500 mt-1">Select a tenant to manage its schedule.</p>
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
        <h1 className="text-xl font-semibold text-charcoal-ink">Schedule</h1>
        <Button
          onClick={openCreate}
          className="bg-charcoal-ink text-white hover:bg-charcoal-ink/90 h-9"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Event
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-6" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-8 w-8" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center">
          <Clock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">No schedule events yet</p>
          <p className="text-xs text-gray-400 mt-1">Click &quot;Add Event&quot; to create the first one.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {items.map((item) => (
                <SortableScheduleItem
                  key={item.id}
                  item={item}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-charcoal-ink">
              {editingItem ? 'Edit Event' : 'Add Event'}
            </DialogTitle>
            <DialogDescription>
              {editingItem ? 'Update the schedule event details.' : 'Add a new event to the timeline.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sched-time" className="text-sm font-medium text-charcoal-ink">Time *</Label>
                <Input
                  id="sched-time"
                  placeholder="10:00 AM"
                  {...register('time')}
                  className="h-9 border-gray-300"
                />
                {errors.time && <p className="text-xs text-red-600">{errors.time.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sched-title" className="text-sm font-medium text-charcoal-ink">Title *</Label>
                <Input
                  id="sched-title"
                  placeholder="Ceremony Begins"
                  {...register('title')}
                  className="h-9 border-gray-300"
                />
                {errors.title && <p className="text-xs text-red-600">{errors.title.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sched-desc" className="text-sm font-medium text-charcoal-ink">Description</Label>
              <Textarea
                id="sched-desc"
                placeholder="Event description..."
                {...register('description')}
                className="border-gray-300 min-h-[60px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sched-tags" className="text-sm font-medium text-charcoal-ink">
                Tags <span className="text-gray-400 font-normal">(comma-separated)</span>
              </Label>
              <Input
                id="sched-tags"
                placeholder="ceremony, main-event"
                {...register('tags')}
                className="h-9 border-gray-300"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={enabledWatch}
                onCheckedChange={(checked) => setValue('enabled', checked)}
              />
              <Label className="text-sm font-medium text-charcoal-ink">Enabled</Label>
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
                {editingItem ? 'Save Changes' : 'Add Event'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
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