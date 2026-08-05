'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Users,
  UserCheck,
  Loader2,
  AlertTriangle,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { normalizePlatformRole } from '@/lib/permissions';

// ── Types ──────────────────────────────────────────────────────────────────

interface UserItem {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UserForm {
  name: string;
  email: string;
  password: string;
  role: string;
  isActive: boolean;
}

const EMPTY_FORM: UserForm = {
  name: '',
  email: '',
  password: '',
  role: 'CONSULTANT_1',
  isActive: true,
};

// ── Helpers ────────────────────────────────────────────────────────────────

const roleVariant: Record<string, string> = {
  // New DB-driven vocabulary
  SUPER_ADMIN_1: 'bg-cinematic-gold/15 text-cinematic-gold border-cinematic-gold/30',
  SUPER_ADMIN_2: 'bg-cinematic-gold/15 text-cinematic-gold border-cinematic-gold/30',
  CONSULTANT_1: 'bg-charcoal-ink/10 text-charcoal-ink border-charcoal-ink/20',
  CONSULTANT_2: 'bg-charcoal-ink/10 text-charcoal-ink border-charcoal-ink/20',
  COORDINATOR_1: 'bg-charcoal-ink/10 text-charcoal-ink border-charcoal-ink/20',
  SUPPORT_1: 'bg-charcoal-ink/5 text-charcoal-ink/60 border-charcoal-ink/10',
  SUPPORT_2: 'bg-charcoal-ink/5 text-charcoal-ink/60 border-charcoal-ink/10',
  COUPLE: 'bg-cinematic-gold/5 text-cinematic-gold/70 border-cinematic-gold/20',
  EDITOR: 'bg-blue-50 text-blue-700 border-blue-200',
  VIEWER: 'bg-gray-50 text-gray-600 border-gray-200',
  // Legacy values
  SUPER_ADMIN: 'bg-cinematic-gold/15 text-cinematic-gold border-cinematic-gold/30',
  ACCOUNT_MANAGER_1: 'bg-charcoal-ink/10 text-charcoal-ink border-charcoal-ink/20',
  ACCOUNT_MANAGER_2: 'bg-charcoal-ink/10 text-charcoal-ink border-charcoal-ink/20',
  SUPPORT: 'bg-charcoal-ink/5 text-charcoal-ink/60 border-charcoal-ink/10',
  ADMIN_1: 'bg-charcoal-ink/10 text-charcoal-ink border-charcoal-ink/20',
  ADMIN_2: 'bg-charcoal-ink/10 text-charcoal-ink border-charcoal-ink/20',
  ADMIN_3: 'bg-charcoal-ink/10 text-charcoal-ink border-charcoal-ink/20',
  ACCOUNT_MANAGER: 'bg-charcoal-ink/10 text-charcoal-ink border-charcoal-ink/20',
};

const roleLabel: Record<string, string> = {
  // New DB-driven vocabulary
  SUPER_ADMIN_1: 'Super Admin 1',
  SUPER_ADMIN_2: 'Super Admin 2',
  CONSULTANT_1: 'Consultant 1',
  CONSULTANT_2: 'Consultant 2',
  COORDINATOR_1: 'Coordinator 1',
  SUPPORT_1: 'Support 1',
  SUPPORT_2: 'Support 2',
  COUPLE: 'Couple',
  EDITOR: 'Editor',
  VIEWER: 'Viewer',
  // Legacy values
  SUPER_ADMIN: 'Super Admin (Legacy)',
  ACCOUNT_MANAGER: 'Account Manager (Legacy)',
  ACCOUNT_MANAGER_1: 'Account Manager 1 (Legacy)',
  ACCOUNT_MANAGER_2: 'Account Manager 2 (Legacy)',
  SUPPORT: 'Support (Legacy)',
  ADMIN_1: 'Consultant (Legacy)',
  ADMIN_2: 'Coordinator (Legacy)',
  ADMIN_3: 'Operations (Legacy)',
};

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 30) return `${Math.floor(days / 30)}mo ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function StatSkeleton() {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <div className="p-4">
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-8 w-16" />
      </div>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      ))}
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
      <Users className="h-10 w-10 mb-3" />
      <p className="text-sm font-medium text-slate-500">
        {hasSearch ? 'No users match your search' : 'No users yet'}
      </p>
      <p className="text-xs mt-1">
        {hasSearch
          ? 'Try adjusting your search terms'
          : 'Click "Add User" to create the first user'}
      </p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function MasterUsers() {
  // Data state
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roles, setRoles] = useState<{ key: string; label: string; tier: string; isSystem: boolean }[]>([]);

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserItem | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Reset password dialog state
  const [resetUser, setResetUser] = useState<UserItem | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  // ── Fetch users ──────────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await fetch(
        `/api/master/users?${params.toString()}&XTransformPort=3000`
      );
      if (!res.ok) throw new Error(`Failed to fetch users (${res.status})`);
      const json = await res.json();
      setUsers(Array.isArray(json) ? json : json.users ?? []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  // ── Search debounce ───────────────────────────────────────────────────
  // Single debounced fetch — fires on mount AND when search changes (after 300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchUsers]);

  // ── Fetch roles (for dropdown) ───────────────────────────────────────
  useEffect(() => {
    async function fetchRoles() {
      try {
        const res = await fetch('/api/master/roles?XTransformPort=3000');
        if (res.ok) {
          const data = await res.json();
          // Exclude COUPLE, EDITOR, VIEWER — those are per-wedding roles,
          // not assignable from the Team page (staff management)
          const staffRoles = (data.roles || []).filter(
            (r: { key: string; tier: string }) => r.tier !== 'account'
          );
          setRoles(staffRoles);
        }
      } catch {
        // Silently fail — dropdown will be empty
      }
    }
    fetchRoles();
  }, []);

  // ── Stats ────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const admins = users.filter((u) => {
      const r = normalizePlatformRole(u.role);
      return r !== 'COUPLE';
    }).length;
    return { total, active, admins };
  }, [users]);

  // ── Form handlers ────────────────────────────────────────────────────

  function openCreate() {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setShowPassword(false);
    setFormOpen(true);
  }

  function openEdit(user: UserItem) {
    setEditingUser(user);
    setShowPassword(false);
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      isActive: user.isActive,
    });
    setFormOpen(true);
  }

  function openDelete(user: UserItem) {
    setDeletingUser(user);
    setDeleteOpen(true);
  }

  function setField<K extends keyof UserForm>(key: K, value: UserForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── Submit (create or update) ─────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const isEditing = !!editingUser;

    // Client-side validation
    if (!form.name.trim() || form.name.trim().length < 2) {
      toast({ title: 'Validation Error', description: 'Name must be at least 2 characters', variant: 'destructive' });
      return;
    }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast({ title: 'Validation Error', description: 'Please enter a valid email address', variant: 'destructive' });
      return;
    }
    if (!isEditing && (!form.password || form.password.length < 8)) {
      toast({ title: 'Validation Error', description: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }
    if (isEditing && form.password && form.password.length < 8) {
      toast({ title: 'Validation Error', description: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }

    try {
      setSubmitting(true);

      if (isEditing) {
        // Update
        const payload: Record<string, unknown> = {
          id: editingUser.id,
          name: form.name.trim(),
          role: form.role,
          isActive: form.isActive,
        };
        if (form.password) payload.password = form.password;

        const res = await fetch('/api/master/users?XTransformPort=3000', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          const msg = typeof data?.error === 'string'
            ? data.error
            : Array.isArray(data?.error)
              ? data.error.map((e: { message?: string }) => e.message ?? '').filter(Boolean).join(', ')
              : 'Update failed';
          throw new Error(msg);
        }
        toast({ title: 'User Updated', description: `${form.name} has been updated successfully.` });
      } else {
        // Create
        const res = await fetch('/api/master/users?XTransformPort=3000', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim(),
            password: form.password,
            role: form.role,
            isActive: form.isActive,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          const msg = typeof data?.error === 'string'
            ? data.error
            : Array.isArray(data?.error)
              ? data.error.map((e: { message?: string }) => e.message ?? '').filter(Boolean).join(', ')
              : 'Create failed';
          throw new Error(msg);
        }
        toast({ title: 'User Created', description: `${form.name} has been created successfully.` });
      }

      setFormOpen(false);
      fetchUsers();
    } catch (err) {
      toast({
        title: isEditing ? 'Update Failed' : 'Create Failed',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Delete handler ───────────────────────────────────────────────────

  async function handleDelete() {
    if (!deletingUser) return;

    try {
      const res = await fetch(
        `/api/master/users?id=${deletingUser.id}&hard=true&XTransformPort=3000`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = typeof data?.error === 'string'
          ? data.error
          : Array.isArray(data?.error)
            ? data.error.map((e: { message?: string }) => e.message ?? '').filter(Boolean).join(', ')
            : 'Delete failed';
        throw new Error(msg);
      }
      toast({ title: 'User Deleted', description: `${deletingUser.name} has been permanently removed.` });
      setDeleteOpen(false);
      setDeletingUser(null);
      fetchUsers();
    } catch (err) {
      toast({
        title: 'Delete Failed',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  }

  // ── Reset password handler ──────────────────────────────────────────

  function openReset(user: UserItem) {
    setResetUser(user);
    setNewPassword('');
    setResetOpen(true);
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetUser) return;
    if (newPassword.length < 8) {
      toast({ title: 'Validation Error', description: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }
    try {
      setResetting(true);
      const res = await fetch(
        `/api/master/users/${resetUser.id}/reset-password?XTransformPort=3000`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newPassword }) }
      );
      if (!res.ok) throw new Error('Failed to reset password');
      toast({ title: 'Password Reset', description: `Password updated for ${resetUser.name}.` });
      setResetOpen(false);
      setResetUser(null);
      setNewPassword('');
    } catch (err) {
      toast({ title: 'Reset Failed', description: err instanceof Error ? err.message : 'An unexpected error occurred', variant: 'destructive' });
    } finally {
      setResetting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">User Management</h2>
        <p className="text-slate-500 mt-1">Manage office staff accounts and permissions</p>
      </div>

      {/* Summary Stats */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Users */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <div className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Total Users</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              </div>
            </div>
          </Card>

          {/* Active Users */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <div className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Active Users</p>
                <p className="text-2xl font-bold text-slate-900">{stats.active}</p>
              </div>
            </div>
          </Card>

          {/* Admin Staff */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <div className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-cinematic-gold/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-cinematic-gold" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Admin Staff</p>
                <p className="text-2xl font-bold text-slate-900">{stats.admins}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Separator />

      {/* Header Row: Search + Add */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name or email..."
            className="pl-9 border-slate-200 bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          onClick={openCreate}
          className="shrink-0 bg-slate-900 text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Data Table */}
      <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <TableSkeleton />
          ) : users.length === 0 ? (
            <EmptyState hasSearch={search.length > 0} />
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 bg-slate-50/50 hover:bg-slate-50/50">
                    <TableHead className="text-slate-600 font-semibold">Name</TableHead>
                    <TableHead className="text-slate-600 font-semibold hidden md:table-cell">Email</TableHead>
                    <TableHead className="text-slate-600 font-semibold hidden md:table-cell">Role</TableHead>
                    <TableHead className="text-slate-600 font-semibold">Status</TableHead>
                    <TableHead className="text-slate-600 font-semibold hidden md:table-cell">Last Login</TableHead>
                    <TableHead className="text-slate-600 font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow
                      key={user.id}
                      className="border-slate-100"
                    >
                      {/* Name */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-500 shrink-0">
                            {user.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">
                              {user.name}
                            </p>
                            <p className="text-xs text-slate-400">
                              Joined {formatDate(user.createdAt)}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Email */}
                      <TableCell className="text-sm text-slate-600 max-w-[200px] truncate hidden md:table-cell">
                        {user.email}
                      </TableCell>

                      {/* Role */}
                      <TableCell className="hidden md:table-cell">
                        <Badge
                          variant="outline"
                          className={
                            roleVariant[user.role] ??
                            'bg-slate-100 text-slate-500 border-slate-200'
                          }
                        >
                          {roleLabel[user.role] ?? user.role}
                        </Badge>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            user.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-red-50 text-red-600 border-red-200'
                          }
                        >
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>

                      {/* Last Login */}
                      <TableCell className="text-sm text-slate-500 hidden md:table-cell">
                        {relativeTime(user.lastLoginAt)}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => openEdit(user)}
                          >
                            <Pencil className="h-4 w-4 text-slate-500" />
                            <span className="sr-only">Edit user</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => openReset(user)}
                            title="Reset password"
                          >
                            <KeyRound className="h-4 w-4 text-amber-500" />
                            <span className="sr-only">Reset password</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => openDelete(user)}
                            disabled={user.isActive === false}
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                            <span className="sr-only">Delete user</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Edit User' : 'Create User'}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'Update the user details below.'
                : 'Fill in the details to create a new user account.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="user-name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="user-name"
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                required
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="user-email">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="user-email"
                type="email"
                placeholder="user@example.com"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                required
                disabled={!!editingUser}
                className={editingUser ? 'bg-slate-50 text-slate-500' : ''}
              />
              {editingUser && (
                <p className="text-xs text-slate-400">Email cannot be changed</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="user-password">
                Password {editingUser ? '' : <span className="text-red-500">*</span>}
              </Label>
              <div className="relative">
                <Input
                  id="user-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={editingUser ? 'Leave blank to keep current' : 'Minimum 8 characters'}
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                  className="pr-10"
                  {...(!editingUser ? { required: true } : {})}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="user-role">
                Role <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.role}
                onValueChange={(v) => setField('role', v)}
              >
                <SelectTrigger id="user-role" className="w-full border-slate-200">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active Switch */}
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div className="space-y-0.5">
                <Label htmlFor="user-active" className="text-sm font-medium">
                  Active Account
                </Label>
                <p className="text-xs text-slate-400">
                  {form.isActive ? 'User can log in' : 'User is deactivated'}
                </p>
              </div>
              <Switch
                id="user-active"
                checked={form.isActive}
                onCheckedChange={(checked) => setField('isActive', checked)}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
                disabled={submitting}
                className="border-slate-300 hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-slate-900 text-white hover:bg-slate-800"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {editingUser ? 'Saving...' : 'Creating...'}
                  </>
                ) : editingUser ? (
                  'Save Changes'
                ) : (
                  'Create User'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete User
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deletingUser && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600">
                  {deletingUser.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{deletingUser.name}</p>
                  <p className="text-sm text-slate-500">{deletingUser.email}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge
                  variant="outline"
                  className={
                    roleVariant[deletingUser.role] ??
                    'bg-slate-100 text-slate-500 border-slate-200'
                  }
                >
                  {roleLabel[deletingUser.role] ?? deletingUser.role}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    deletingUser.isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-600 border-red-200'
                  }
                >
                  {deletingUser.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              className="border-slate-300 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
            >
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {resetUser?.name} ({resetUser?.email}).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs uppercase tracking-wider text-slate-500">
                New Password
              </Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                disabled={resetting}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setResetOpen(false)} disabled={resetting}>
                Cancel
              </Button>
              <Button type="submit" disabled={resetting || newPassword.length < 8}>
                {resetting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4 mr-2" />
                    Reset Password
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}