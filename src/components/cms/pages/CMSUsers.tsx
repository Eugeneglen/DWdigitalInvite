'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Search, MoreHorizontal, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { ROLE_LABELS, TENANT_ROLE_LABELS } from '@/lib/constants';

// --- Types ---

interface TenantUser {
  id: string;
  tenantId: string;
  role: string;
  tenant?: { name: string };
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string;
  createdAt: string;
  tenantUsers?: TenantUser[];
}

// --- Zod Schema ---

const userSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  tenantId: z.string().optional(),
  tenantRole: z.string().optional(),
});

type UserFormValues = z.infer<typeof userSchema>;

const ROLE_STYLES: Record<string, string> = {
  master_admin: 'bg-cinematic-gold/10 text-cinematic-gold border-cinematic-gold/30',
  tenant_admin: 'bg-green-50 text-green-700 border-green-200',
  editor: 'bg-amber-50 text-amber-700 border-amber-200',
  viewer: 'bg-gray-100 text-gray-600 border-gray-200',
};

export default function CMSUsers() {
  const authUser = useCMSStore((s) => s.authUser);
  const [users, setUsers] = useState<User[]>([]);
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const headers = {
    Authorization: `Bearer ${authUser?.token}`,
    'Content-Type': 'application/json',
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ...(search ? { search } : {}) });
      const res = await fetch(`/api/cms/users?${params}`, {
        headers: { Authorization: `Bearer ${authUser?.token}` },
      });
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [search, authUser?.token]);

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch('/api/cms/tenants?limit=100', {
        headers: { Authorization: `Bearer ${authUser?.token}` },
      });
      const data = await res.json();
      if (data.success) {
        setTenants(data.data.tenants.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
      }
    } catch {
      // silently handle
    }
  }, [authUser?.token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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
  } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: '',
      password: '',
      name: '',
      tenantId: '',
      tenantRole: 'editor',
    },
  });

  const openCreate = () => {
    reset({
      email: '',
      password: '',
      name: '',
      tenantId: '',
      tenantRole: 'editor',
    });
    setDialogOpen(true);
  };

  const onSubmit = async (values: UserFormValues) => {
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        email: values.email,
        password: values.password,
        name: values.name,
      };
      if (values.tenantId) {
        payload.tenantId = values.tenantId;
        payload.tenantRole = values.tenantRole || 'editor';
      }

      const res = await fetch('/api/cms/users', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('User created');
        setDialogOpen(false);
        fetchUsers();
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
      const res = await fetch(`/api/cms/users/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authUser?.token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast.success('User deleted');
        setDeleteTarget(null);
        fetchUsers();
      } else {
        toast.error(data.error || 'Failed to delete');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setDeleting(false);
    }
  };

  const getTenantInfo = (user: User) => {
    if (!user.tenantUsers?.length) return null;
    const tu = user.tenantUsers[0];
    return {
      name: tu.tenant?.name || 'Unknown',
      role: tu.role,
    };
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-semibold text-charcoal-ink">Users</h1>
        <Button
          onClick={openCreate}
          className="bg-charcoal-ink text-white hover:bg-charcoal-ink/90 h-9"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Invite User
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Email</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Tenant</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Tenant Role</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Created</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-gray-50">
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-sm text-gray-400">
                    {search ? 'No users match your search.' : 'No users found.'}
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => {
                  const tenantInfo = getTenantInfo(user);
                  return (
                    <TableRow key={user.id} className="border-gray-50 hover:bg-gray-50/50">
                      <TableCell className="font-medium text-charcoal-ink text-sm">
                        {user.name}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 hidden sm:table-cell">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs ${ROLE_STYLES[user.role] || ROLE_STYLES.viewer}`}
                        >
                          {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-gray-600">
                        {tenantInfo?.name || '—'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {tenantInfo ? (
                          <Badge variant="outline" className="text-xs">
                            {TENANT_ROLE_LABELS[tenantInfo.role as keyof typeof TENANT_ROLE_LABELS] || tenantInfo.role}
                          </Badge>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-gray-400">
                        {user.createdAt
                          ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })
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
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(user)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-charcoal-ink">Invite User</DialogTitle>
            <DialogDescription>
              Create a new user account on the platform.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-name" className="text-sm font-medium text-charcoal-ink">Name</Label>
              <Input
                id="user-name"
                placeholder="John Doe"
                {...register('name')}
                className="h-9 border-gray-300"
              />
              {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-email" className="text-sm font-medium text-charcoal-ink">Email</Label>
              <Input
                id="user-email"
                type="email"
                placeholder="john@example.com"
                {...register('email')}
                className="h-9 border-gray-300"
              />
              {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-password" className="text-sm font-medium text-charcoal-ink">Password</Label>
              <Input
                id="user-password"
                type="password"
                placeholder="Min. 6 characters"
                {...register('password')}
                className="h-9 border-gray-300"
              />
              {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-charcoal-ink">Assign to Tenant (optional)</Label>
              <Select onValueChange={(val) => setValue('tenantId', val)}>
                <SelectTrigger className="h-9 border-gray-300">
                  <SelectValue placeholder="No tenant assignment" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-charcoal-ink">Tenant Role</Label>
              <Select defaultValue="editor" onValueChange={(val) => setValue('tenantRole', val)}>
                <SelectTrigger className="h-9 border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
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
                Create User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong> ({deleteTarget?.email})?
              This action cannot be undone.
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