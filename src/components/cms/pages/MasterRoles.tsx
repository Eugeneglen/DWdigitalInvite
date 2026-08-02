'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Shield,
  Lock,
  Check,
  X,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { Checkbox } from '@/components/ui/checkbox';
import { ALL_PERMISSIONS, ALL_PLATFORM_PERMISSIONS, ALL_WEDDING_PERMISSIONS } from '@/lib/permissions';

interface Role {
  id: string;
  key: string;
  label: string;
  tier: string;
  isSystem: boolean;
  permissions: string[];
  sortOrder: number;
}

const PERMISSION_LABELS: Record<string, string> = {
  'platform:users:manage': 'Manage Users',
  'platform:weddings:read': 'Read Weddings',
  'platform:weddings:write': 'Write Weddings',
  'platform:weddings:read-all': 'Read-Only All Weddings',
  'platform:settings:read': 'Read Settings',
  'platform:settings:write': 'Write Settings',
  'platform:analytics:read': 'Read Analytics',
  'platform:audit:read': 'Read Audit Log',
  'platform:templates:manage': 'Manage Templates',
  'wedding:read': 'Read Wedding',
  'wedding:content:write': 'Edit Content',
  'wedding:media:write': 'Edit Media',
  'wedding:guests:write': 'Manage Guests',
  'wedding:rsvps:read': 'Read RSVPs',
  'wedding:rsvps:manage': 'Manage RSVPs',
  'wedding:schedule:write': 'Edit Schedule',
  'wedding:settings:write': 'Edit Settings',
  'wedding:analytics:read': 'Read Analytics',
  'wedding:wishes:moderate': 'Moderate Wishes',
  'wedding:members:invite': 'Invite Members',
  'wedding:members:remove': 'Remove Members',
};

const TIER_LABELS: Record<string, string> = {
  platform: 'Platform',
  wedding_staff: 'Wedding Staff',
  account: 'Account',
};

const EMPTY_ROLE_FORM = {
  key: '',
  label: '',
  tier: 'wedding_staff' as 'platform' | 'wedding_staff' | 'account',
  permissions: [] as string[],
};

export default function MasterRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form, setForm] = useState(EMPTY_ROLE_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/master/roles?XTransformPort=3000');
      if (!res.ok) throw new Error('Failed to fetch roles');
      const data = await res.json();
      setRoles(data.roles || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load roles', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  function openCreate() {
    setEditingRole(null);
    setForm(EMPTY_ROLE_FORM);
    setFormOpen(true);
  }

  function openEdit(role: Role) {
    setEditingRole(role);
    setForm({
      key: role.key,
      label: role.label,
      tier: role.tier as 'platform' | 'wedding_staff' | 'account',
      permissions: role.permissions.includes('*') ? [] : role.permissions,
    });
    setFormOpen(true);
  }

  function togglePermission(perm: string) {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSubmitting(true);
      const isEditing = !!editingRole;
      const url = isEditing
        ? `/api/master/roles?XTransformPort=3000`
        : `/api/master/roles?XTransformPort=3000`;
      const method = isEditing ? 'PATCH' : 'POST';
      const body = isEditing
        ? { id: editingRole.id, label: form.label, permissions: form.permissions }
        : { key: form.key, label: form.label, tier: form.tier, permissions: form.permissions };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to save role');
      }

      toast({
        title: isEditing ? 'Role Updated' : 'Role Created',
        description: `${form.label} has been ${isEditing ? 'updated' : 'created'}.`,
      });
      setFormOpen(false);
      fetchRoles();
    } catch (err) {
      toast({
        title: 'Save Failed',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(role: Role) {
    if (!confirm(`Delete the role "${role.label}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/master/roles?id=${role.id}&XTransformPort=3000`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to delete role');
      }
      toast({ title: 'Role Deleted', description: `${role.label} has been removed.` });
      fetchRoles();
    } catch (err) {
      toast({
        title: 'Delete Failed',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-cinematic-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Roles &amp; Permissions</h2>
          <p className="text-slate-500 mt-1">Manage staff roles and their permissions</p>
        </div>
        <Button onClick={openCreate} className="bg-slate-900 text-white hover:bg-slate-800">
          <Plus className="size-4 mr-2" />
          Add Role
        </Button>
      </div>

      {/* Roles table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell>
                    {role.isSystem ? (
                      <Lock className="size-4 text-slate-400" title="System role — cannot delete" />
                    ) : (
                      <Shield className="size-4 text-slate-300" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-slate-900">{role.label}</p>
                      <p className="text-xs text-slate-400 font-mono">{role.key}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {TIER_LABELS[role.tier] || role.tier}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {role.permissions.includes('*') ? (
                      <Badge className="bg-cinematic-gold/15 text-cinematic-gold border-cinematic-gold/30">
                        All Permissions (Wildcard)
                      </Badge>
                    ) : (
                      <span className="text-sm text-slate-500">
                        {role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(role)}
                      >
                        <Pencil className="h-4 w-4 text-slate-500" />
                        <span className="sr-only">Edit role</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDelete(role)}
                        disabled={role.isSystem}
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                        <span className="sr-only">Delete role</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Role Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Edit Role' : 'Add Role'}</DialogTitle>
            <DialogDescription>
              {editingRole
                ? `Update permissions for ${editingRole.label}.`
                : 'Create a new staff role with custom permissions.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Key (only for new roles) */}
            {!editingRole && (
              <div className="space-y-1.5">
                <Label htmlFor="role-key" className="text-xs uppercase tracking-wider text-slate-500">
                  Role Key (UPPER_SNAKE_CASE)
                </Label>
                <Input
                  id="role-key"
                  value={form.key}
                  onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') })}
                  placeholder="e.g. JUNIOR_CONSULTANT"
                  required
                  disabled={submitting}
                  className="font-mono"
                />
              </div>
            )}

            {/* Label */}
            <div className="space-y-1.5">
              <Label htmlFor="role-label" className="text-xs uppercase tracking-wider text-slate-500">
                Display Label
              </Label>
              <Input
                id="role-label"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="e.g. Junior Consultant"
                required
                disabled={submitting}
              />
            </div>

            {/* Tier (only for new roles) */}
            {!editingRole && (
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-slate-500">Tier</Label>
                <Select
                  value={form.tier}
                  onValueChange={(v) => setForm({ ...form, tier: v as 'platform' | 'wedding_staff' | 'account' })}
                  disabled={submitting}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="platform">Platform (global access)</SelectItem>
                    <SelectItem value="wedding_staff">Wedding Staff (per-wedding)</SelectItem>
                    <SelectItem value="account">Account (couple-invited)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Permissions */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-slate-500">
                Permissions {editingRole?.permissions.includes('*') && '(System role — wildcard)'}
              </Label>
              {editingRole?.permissions.includes('*') ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  This is a system role with wildcard (*) permissions. It grants all permissions.
                  You can still customize it below, but the wildcard will be replaced.
                </div>
              ) : null}
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                {/* Platform permissions */}
                <div className="p-3 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Platform Permissions</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ALL_PLATFORM_PERMISSIONS.map((perm) => (
                      <label key={perm} className="flex items-center gap-2 cursor-pointer hover:bg-white rounded px-2 py-1">
                        <Checkbox
                          checked={form.permissions.includes(perm)}
                          onCheckedChange={() => togglePermission(perm)}
                        />
                        <span className="text-sm text-slate-700">{PERMISSION_LABELS[perm] || perm}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {/* Wedding permissions */}
                <div className="p-3">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Wedding Permissions</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ALL_WEDDING_PERMISSIONS.map((perm) => (
                      <label key={perm} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded px-2 py-1">
                        <Checkbox
                          checked={form.permissions.includes(perm)}
                          onCheckedChange={() => togglePermission(perm)}
                        />
                        <span className="text-sm text-slate-700">{PERMISSION_LABELS[perm] || perm}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : editingRole ? (
                  'Save Changes'
                ) : (
                  'Create Role'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
