'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, ToggleLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCMSStore } from '@/store/useCMSStore';

// --- Types ---

interface Tenant {
  id: string;
  name: string;
  slug: string;
  eventType: string;
  status: string;
  coupleName1: string | null;
  coupleName2: string | null;
  eventDate: string | null;
  venue: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TenantsResponse {
  tenants: Tenant[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// --- Zod Schema ---

const tenantSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z.string().min(2, 'Slug must be at least 2 characters'),
  eventType: z.string().min(1, 'Event type is required'),
  coupleName1: z.string().optional(),
  coupleName2: z.string().optional(),
  eventDate: z.string().optional(),
  venue: z.string().optional(),
});

type TenantFormValues = z.infer<typeof tenantSchema>;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const EVENT_TYPES = ['wedding', 'birthday', 'corporate', 'anniversary', 'other'];

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-50 text-green-700 border-green-200',
  inactive: 'bg-amber-50 text-amber-700 border-amber-200',
  archived: 'bg-gray-100 text-gray-600 border-gray-200',
};

export default function CMSTenants() {
  const authUser = useCMSStore((s) => s.authUser);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const LIMIT = 10;

  const headers = {
    Authorization: `Bearer ${authUser?.token}`,
    'Content-Type': 'application/json',
  };

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/cms/tenants?${params}`, { headers: { Authorization: `Bearer ${authUser?.token}` } });
      const data = await res.json();
      if (data.success) {
        const resp: TenantsResponse = data.data;
        setTenants(resp.tenants);
        setTotal(resp.total);
        setTotalPages(resp.totalPages);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [page, search, authUser?.token]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TenantFormValues>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
      name: '',
      slug: '',
      eventType: 'wedding',
      coupleName1: '',
      coupleName2: '',
      eventDate: '',
      venue: '',
    },
  });

  const watchName = watch('name');

  const openCreate = () => {
    setEditingTenant(null);
    reset({
      name: '',
      slug: '',
      eventType: 'wedding',
      coupleName1: '',
      coupleName2: '',
      eventDate: '',
      venue: '',
    });
    setDialogOpen(true);
  };

  const openEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    reset({
      name: tenant.name,
      slug: tenant.slug,
      eventType: tenant.eventType,
      coupleName1: tenant.coupleName1 || '',
      coupleName2: tenant.coupleName2 || '',
      eventDate: tenant.eventDate ? tenant.eventDate.slice(0, 10) : '',
      venue: tenant.venue || '',
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values: TenantFormValues) => {
    setSaving(true);
    try {
      const isEdit = !!editingTenant;
      const url = isEdit
        ? `/api/cms/tenants/${editingTenant.id}`
        : '/api/cms/tenants';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(values),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(isEdit ? 'Tenant updated' : 'Tenant created');
        setDialogOpen(false);
        fetchTenants();
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
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/cms/tenants/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authUser?.token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Tenant deleted');
        setDeleteTarget(null);
        fetchTenants();
      } else {
        toast.error(data.error || 'Failed to delete');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleStatus = async (tenant: Tenant) => {
    const nextStatus = tenant.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`/api/cms/tenants/${tenant.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Tenant ${nextStatus === 'active' ? 'activated' : 'deactivated'}`);
        fetchTenants();
      } else {
        toast.error(data.error || 'Failed to update status');
      }
    } catch {
      toast.error('Network error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-semibold text-charcoal-ink">Tenants</h1>
        <Button
          onClick={openCreate}
          className="bg-charcoal-ink text-white hover:bg-charcoal-ink/90 h-9"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New Tenant
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search tenants..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="pl-9 h-9 border-gray-300"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-100 hover:bg-transparent">
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Slug</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Event Type</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Couple</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Created</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-gray-50">
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : tenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-sm text-gray-400">
                    {search ? 'No tenants match your search.' : 'No tenants found.'}
                  </TableCell>
                </TableRow>
              ) : (
                tenants.map((tenant) => (
                  <TableRow key={tenant.id} className="border-gray-50 hover:bg-gray-50/50">
                    <TableCell className="font-medium text-charcoal-ink text-sm">
                      {tenant.name}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {tenant.slug}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {tenant.eventType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs capitalize ${STATUS_STYLES[tenant.status] || STATUS_STYLES.active}`}
                      >
                        {tenant.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-gray-600">
                      {[tenant.coupleName1, tenant.coupleName2].filter(Boolean).join(' & ') || '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-gray-400">
                      {tenant.createdAt
                        ? formatDistanceToNow(new Date(tenant.createdAt), { addSuffix: true })
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(tenant)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStatus(tenant)}>
                            <ToggleLeft className="h-4 w-4 mr-2" />
                            {tenant.status === 'active' ? 'Deactivate' : 'Activate'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(tenant)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="h-8 text-xs"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="h-8 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-charcoal-ink">
              {editingTenant ? 'Edit Tenant' : 'Create Tenant'}
            </DialogTitle>
            <DialogDescription>
              {editingTenant ? 'Update the tenant details below.' : 'Add a new tenant to the platform.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tenant-name" className="text-sm font-medium text-charcoal-ink">Name</Label>
              <Input
                id="tenant-name"
                placeholder="Eleanor & James Wedding"
                {...register('name', {
                  onChange: (e) => {
                    if (!editingTenant) {
                      setValue('slug', slugify(e.target.value));
                    }
                  },
                })}
                className="h-9 border-gray-300"
              />
              {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenant-slug" className="text-sm font-medium text-charcoal-ink">Slug</Label>
              <Input
                id="tenant-slug"
                placeholder="eleanor-james"
                {...register('slug')}
                className="h-9 border-gray-300 font-mono text-sm"
              />
              {errors.slug && <p className="text-xs text-red-600">{errors.slug.message}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-charcoal-ink">Event Type</Label>
              <Select
                defaultValue={editingTenant?.eventType || 'wedding'}
                onValueChange={(val) => setValue('eventType', val)}
              >
                <SelectTrigger className="h-9 border-gray-300">
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type} className="capitalize">
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.eventType && <p className="text-xs text-red-600">{errors.eventType.message}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="couple1" className="text-sm font-medium text-charcoal-ink">Partner 1</Label>
                <Input
                  id="couple1"
                  placeholder="Eleanor"
                  {...register('coupleName1')}
                  className="h-9 border-gray-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="couple2" className="text-sm font-medium text-charcoal-ink">Partner 2</Label>
                <Input
                  id="couple2"
                  placeholder="James"
                  {...register('coupleName2')}
                  className="h-9 border-gray-300"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-date" className="text-sm font-medium text-charcoal-ink">Event Date</Label>
              <Input
                id="event-date"
                type="date"
                {...register('eventDate')}
                className="h-9 border-gray-300"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="venue" className="text-sm font-medium text-charcoal-ink">Venue</Label>
              <Textarea
                id="venue"
                placeholder="Venue name and address"
                {...register('venue')}
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
                {editingTenant ? 'Save Changes' : 'Create Tenant'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tenant</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone
              and will remove all associated data including users and feature toggles.
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