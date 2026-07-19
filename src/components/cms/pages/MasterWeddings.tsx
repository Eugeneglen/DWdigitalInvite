'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  Ban,
  Play,
  Archive,
  Heart,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  KeyRound,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import WeddingCreationWizard from './WeddingCreationWizard';

// ── Types ──────────────────────────────────────────────────────────────────

interface Wedding {
  id: string;
  slug: string;
  coupleName: string;
  brideName: string | null;
  groomName: string | null;
  weddingDate: string;
  weddingTime: string | null;
  venue: string | null;
  venueAddress: string | null;
  googleMapsUrl: string | null;
  status: string;
  plan: string;
  jobNumber: string | null;
  coupleEmail: string | null;
  couplePhone: string | null;
  consultantId: string | null;
  coordinatorId: string | null;
  accountStatus: string;
  features?: { featureKey: string; isEnabled: boolean }[];
  _count?: {
    rsvps?: number;
    wishes?: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface WeddingForm {
  coupleName: string;
  brideName: string;
  groomName: string;
  weddingDate: string;
  weddingTime: string;
  venue: string;
  venueAddress: string;
  googleMapsUrl: string;
  plan: string;
  status: string;
  jobNumber: string;
  coupleEmail: string;
  couplePhone: string;
  sections: string[];
  consultantId: string;
  coordinatorId: string;
}

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

const OPTIONAL_SECTIONS = [
  { key: 'story', label: 'Story' },
  { key: 'wishes', label: 'Wishes' },
  { key: 'qa', label: 'Q&A' },
  { key: 'moments', label: 'Moments' },
  { key: 'templates', label: 'Theme Templates' },
];

const EMPTY_FORM: WeddingForm = {
  coupleName: '',
  brideName: '',
  groomName: '',
  weddingDate: '',
  weddingTime: '',
  venue: '',
  venueAddress: '',
  googleMapsUrl: '',
  plan: 'GOLD',
  status: 'DRAFT',
  jobNumber: '',
  coupleEmail: '',
  couplePhone: '',
  sections: [],
  consultantId: '',
  coordinatorId: '',
};

// ── Helpers ────────────────────────────────────────────────────────────────

const statusVariant: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DRAFT: 'bg-amber-50 text-amber-700 border-amber-200',
  SUSPENDED: 'bg-red-50 text-red-700 border-red-200',
  ARCHIVED: 'bg-slate-100 text-slate-500 border-slate-200',
  COMPLETED: 'bg-blue-50 text-blue-700 border-blue-200',
};

const planVariant: Record<string, string> = {
  PLATINUM: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  DIAMOND: 'bg-purple-50 text-purple-700 border-purple-200',
  GOLD: 'bg-slate-100 text-slate-500 border-slate-200',
};

function formatWeddingDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function truncate(str: string | null, max: number) {
  if (!str) return '—';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

function slugFromNames(coupleName: string): string {
  return coupleName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || `wedding-${Date.now()}`;
}

// ── Table Skeleton ─────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
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
      <Heart className="h-10 w-10 mb-3" />
      <p className="text-sm font-medium text-slate-500">
        {hasSearch ? 'No weddings match your search' : 'No wedding accounts yet'}
      </p>
      <p className="text-xs mt-1">
        {hasSearch
          ? 'Try adjusting your search terms'
          : 'Click "Create Wedding" to get started'}
      </p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function MasterWeddings() {
  const { selectWedding } = useCMSStore();

  // Data state
  const [weddings, setWeddings] = useState<Wedding[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [planFilter, setPlanFilter] = useState<string>('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WeddingForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Staff users for consultant/coordinator assignment
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const consultants = staff.filter((s) => s.role === 'ADMIN_1');
  const coordinators = staff.filter((s) => s.role === 'ADMIN_2');

  // Fetch staff users (consultants ADMIN_1 + coordinators ADMIN_2)
  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/master/users?XTransformPort=3000');
      if (res.ok) {
        const data = await res.json();
        const all: StaffUser[] = data.users ?? [];
        setStaff(all.filter((u) => u.role === 'ADMIN_1' || u.role === 'ADMIN_2'));
      }
    } catch {
      // silently fail — dropdowns will just be empty
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  // Credentials dialog state — lets admin retrieve registration details
  // (couple CMS URL, guest URL, login ID, password, job number) for any
  // wedding, even after the creation wizard has closed.
  const [credWedding, setCredWedding] = useState<Wedding | null>(null);
  const [defaultPassword, setDefaultPassword] = useState('Couple@123');
  const [copied, setCopied] = useState<string | null>(null);

  // Fetch the platform default couple password from system settings
  useEffect(() => {
    fetch('/api/master/settings?XTransformPort=3000')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const val = data?.settings?.default_couple_password;
        if (val) setDefaultPassword(val);
      })
      .catch(() => { /* keep default */ });
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast({ title: 'Copied', description: label });
    setTimeout(() => setCopied(null), 2000);
  };

  // ── Fetch weddings ─────────────────────────────────────────────────────

  const fetchWeddings = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (planFilter) params.set('plan', planFilter);
      params.set('page', String(page));
      params.set('limit', String(limit));
      const res = await fetch(
        `/api/master/weddings?${params.toString()}&XTransformPort=3000`
      );
      if (!res.ok) throw new Error(`Failed to fetch weddings (${res.status})`);
      const json = await res.json();
      setWeddings(Array.isArray(json) ? json : json.weddings ?? []);
      setTotal(json.total ?? weddings.length);
    } catch {
      setWeddings([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, planFilter, page]);

  // ── Search/filter debounce ─────────────────────────────────────────────
  useEffect(() => {
    setPage(1); // reset to page 1 when filters change
    const timer = setTimeout(() => {
      fetchWeddings();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, statusFilter, planFilter, fetchWeddings]);

  // ── Dialog handlers ────────────────────────────────────────────────────

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(w: Wedding) {
    setEditingId(w.id);
    const enabledSections = (w.features ?? [])
      .filter((f) => f.isEnabled && OPTIONAL_SECTIONS.some((s) => s.key === f.featureKey))
      .map((f) => f.featureKey);
    setForm({
      coupleName: w.coupleName,
      brideName: w.brideName ?? '',
      groomName: w.groomName ?? '',
      weddingDate: w.weddingDate ? w.weddingDate.slice(0, 10) : '',
      weddingTime: w.weddingTime ?? '',
      venue: w.venue ?? '',
      venueAddress: w.venueAddress ?? '',
      googleMapsUrl: w.googleMapsUrl ?? '',
      plan: w.plan,
      status: w.status,
      jobNumber: w.jobNumber ?? '',
      coupleEmail: w.coupleEmail ?? '',
      couplePhone: w.couplePhone ?? '',
      sections: enabledSections,
      consultantId: w.consultantId ?? '',
      coordinatorId: w.coordinatorId ?? '',
    });
    setDialogOpen(true);
  }

  function setField<K extends keyof WeddingForm>(key: K, value: WeddingForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── Submit (create or update) ──────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // ── Required field validation ──
    // All fields mandatory except: googleMapsUrl, weddingTime
    const errors: string[] = [];
    if (!form.coupleName.trim()) errors.push('Couple name is required');
    if (!form.brideName.trim()) errors.push('Bride name is required');
    if (!form.groomName.trim()) errors.push('Groom name is required');
    if (!form.weddingDate) errors.push('Wedding date is required');
    if (!form.venue.trim()) errors.push('Venue name is required');
    if (!form.venueAddress.trim()) errors.push('Venue address is required');
    if (!form.plan) errors.push('Plan is required');
    if (!form.status) errors.push('Status is required');
    if (!form.jobNumber.trim()) errors.push('Job number is required');
    if (!form.coupleEmail.trim()) errors.push('Couple email is required');
    if (!form.couplePhone.trim()) errors.push('Couple phone is required');

    if (errors.length > 0) {
      toast({
        title: 'Validation Error',
        description: errors[0] + (errors.length > 1 ? ` (+${errors.length - 1} more)` : ''),
        variant: 'destructive',
      });
      return;
    }

    // Email format validation
    if (form.coupleEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.coupleEmail.trim())) {
      toast({ title: 'Validation Error', description: 'Couple email is not a valid email address.', variant: 'destructive' });
      return;
    }

    try {
      setSubmitting(true);

      const payload: Record<string, unknown> = {
        coupleName: form.coupleName.trim(),
        brideName: form.brideName.trim(),
        groomName: form.groomName.trim(),
        weddingDate: new Date(form.weddingDate).toISOString(),
        weddingTime: form.weddingTime.trim() || null,
        venue: form.venue.trim(),
        venueAddress: form.venueAddress.trim(),
        googleMapsUrl: form.googleMapsUrl.trim() || null,
        plan: form.plan,
        status: form.status,
        jobNumber: form.jobNumber.trim(),
        coupleEmail: form.coupleEmail.trim(),
        couplePhone: form.couplePhone.trim(),
        sections: form.sections,
        consultantId: form.consultantId || null,
        coordinatorId: form.coordinatorId || null,
      };

      if (editingId) {
        // Update
        const res = await fetch('/api/master/weddings?XTransformPort=3000', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...payload }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(typeof err.error === 'string' ? err.error : 'Update failed');
        }
        toast({ title: 'Wedding Updated', description: `${form.coupleName.trim()} has been updated.` });
      } else {
        // Create — auto-generate slug
        payload.slug = slugFromNames(form.coupleName);
        const res = await fetch('/api/master/weddings?XTransformPort=3000', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(typeof err.error === 'string' ? err.error : 'Create failed');
        }
        toast({ title: 'Wedding Created', description: `${form.coupleName.trim()} has been created.` });
      }

      setDialogOpen(false);
      fetchWeddings();
    } catch (err) {
      toast({
        title: editingId ? 'Update Failed' : 'Create Failed',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Status toggle (Suspend / Activate) ─────────────────────────────────

  async function toggleStatus(w: Wedding) {
    const newStatus = w.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    try {
      const res = await fetch('/api/master/weddings?XTransformPort=3000', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: w.id, status: newStatus }),
      });
      if (!res.ok) throw new Error('Status update failed');
      toast({ title: 'Status Updated', description: `${w.coupleName} is now ${newStatus}.` });
      fetchWeddings();
    } catch {
      toast({ title: 'Action Failed', description: 'Could not update wedding status.', variant: 'destructive' });
    }
  }

  // ── Archive ────────────────────────────────────────────────────────────

  async function archiveWedding(w: Wedding) {
    try {
      const res = await fetch('/api/master/weddings?XTransformPort=3000', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: w.id }),
      });
      if (!res.ok) throw new Error('Archive failed');
      toast({ title: 'Wedding Archived', description: `${w.coupleName} has been archived.` });
      fetchWeddings();
    } catch {
      toast({ title: 'Archive Failed', description: 'Could not archive wedding.', variant: 'destructive' });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by couple name, bride, groom, or slug..."
              className="pl-9 border-slate-200 bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[140px] border-slate-200 bg-white">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={planFilter || 'all'} onValueChange={(v) => setPlanFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[130px] border-slate-200 bg-white">
              <SelectValue placeholder="All Packages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Packages</SelectItem>
              <SelectItem value="GOLD">Gold</SelectItem>
              <SelectItem value="PLATINUM">Platinum</SelectItem>
              <SelectItem value="DIAMOND">Diamond</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setWizardOpen(true)} className="shrink-0">
          <Plus className="h-4 w-4" />
          Create Wedding
        </Button>
      </div>

      {/* Data Table */}
      <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-6">
              <TableSkeleton />
            </div>
          ) : weddings.length === 0 ? (
            <EmptyState hasSearch={search.length > 0} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="text-slate-600 font-semibold">
                    Couple Name
                  </TableHead>
                  <TableHead className="text-slate-600 font-semibold">
                    Wedding Date
                  </TableHead>
                  <TableHead className="text-slate-600 font-semibold">
                    Venue
                  </TableHead>
                  <TableHead className="text-slate-600 font-semibold">
                    Status
                  </TableHead>
                  <TableHead className="text-slate-600 font-semibold">
                    Plan
                  </TableHead>
                  <TableHead className="text-slate-600 font-semibold text-center">
                    RSVPs
                  </TableHead>
                  <TableHead className="text-slate-600 font-semibold text-center">
                    Wishes
                  </TableHead>
                  <TableHead className="text-slate-600 font-semibold text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weddings.map((w) => (
                  <TableRow
                    key={w.id}
                    className="border-slate-100 cursor-pointer"
                    onClick={() => window.open(`/${w.slug}`, '_blank')}
                  >
                    {/* Couple Name */}
                    <TableCell>
                      <p className="font-semibold text-slate-900 text-sm">
                        {w.coupleName}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 font-mono">
                        /{w.slug}
                      </p>
                    </TableCell>

                    {/* Wedding Date */}
                    <TableCell className="text-sm text-slate-600">
                      {w.weddingDate
                        ? formatWeddingDate(w.weddingDate)
                        : '—'}
                    </TableCell>

                    {/* Venue */}
                    <TableCell className="text-sm text-slate-600 max-w-[160px] truncate">
                      {truncate(w.venueAddress, 24)}
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          statusVariant[w.status] ??
                          'bg-slate-100 text-slate-500 border-slate-200'
                        }
                      >
                        {w.status}
                      </Badge>
                    </TableCell>

                    {/* Plan */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          planVariant[w.plan] ??
                          'bg-slate-100 text-slate-500 border-slate-200'
                        }
                      >
                        {w.plan}
                      </Badge>
                    </TableCell>

                    {/* RSVPs */}
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                        {w._count?.rsvps ?? 0}
                      </Badge>
                    </TableCell>

                    {/* Wishes */}
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                        {w._count?.wishes ?? 0}
                      </Badge>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`/${w.slug}`, '_blank');
                            }}
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(w);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setCredWedding(w);
                            }}
                          >
                            <KeyRound className="h-4 w-4" />
                            Credentials
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStatus(w);
                            }}
                          >
                            {w.status === 'SUSPENDED' ? (
                              <>
                                <Play className="h-4 w-4" />
                                Activate
                              </>
                            ) : (
                              <>
                                <Ban className="h-4 w-4" />
                                Suspend
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              archiveWedding(w);
                            }}
                          >
                            <Archive className="h-4 w-4" />
                            Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-slate-500">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 text-xs"
            >
              <ChevronLeft className="size-3 mr-1" />
              Prev
            </Button>
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="h-8 text-xs"
            >
              Next
              <ChevronRight className="size-3 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Wedding' : 'Create Wedding'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update the wedding account details below.'
                : 'Fill in the details to create a new wedding account.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Couple Name */}
            <div className="space-y-2">
              <Label htmlFor="coupleName">
                Couple Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="coupleName"
                placeholder="e.g. Eleanor & James"
                value={form.coupleName}
                onChange={(e) => setField('coupleName', e.target.value)}
                required
              />
            </div>

            {/* Bride & Groom — side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brideName">Bride Name</Label>
                <Input
                  id="brideName"
                  placeholder="Bride's name"
                  value={form.brideName}
                  onChange={(e) => setField('brideName', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="groomName">Groom Name</Label>
                <Input
                  id="groomName"
                  placeholder="Groom's name"
                  value={form.groomName}
                  onChange={(e) => setField('groomName', e.target.value)}
                />
              </div>
            </div>

            {/* Wedding Date & Time — side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weddingDate">
                  Wedding Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="weddingDate"
                  type="date"
                  value={form.weddingDate}
                  onChange={(e) => setField('weddingDate', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weddingTime">Wedding Time</Label>
                <Input
                  id="weddingTime"
                  type="time"
                  value={form.weddingTime}
                  onChange={(e) => setField('weddingTime', e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Venue Name */}
            <div className="space-y-2">
              <Label htmlFor="venue">
                Venue Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="venue"
                placeholder="e.g. The Fullerton Hotel"
                value={form.venue}
                onChange={(e) => setField('venue', e.target.value)}
                required
              />
            </div>

            {/* Venue Address */}
            <div className="space-y-2">
              <Label htmlFor="venueAddress">
                Venue Address <span className="text-red-500">*</span>
              </Label>
              <Input
                id="venueAddress"
                placeholder="Full venue address"
                value={form.venueAddress}
                onChange={(e) => setField('venueAddress', e.target.value)}
                required
              />
            </div>

            {/* Google Maps URL (optional) */}
            <div className="space-y-2">
              <Label htmlFor="googleMapsUrl">Google Maps URL</Label>
              <Input
                id="googleMapsUrl"
                placeholder="https://maps.google.com/?q=..."
                value={form.googleMapsUrl}
                onChange={(e) => setField('googleMapsUrl', e.target.value)}
              />
            </div>

            {/* Job Number */}
            <div className="space-y-2">
              <Label htmlFor="jobNumber">
                Job Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="jobNumber"
                placeholder="e.g. DW-TDS-2026-000001"
                value={form.jobNumber}
                onChange={(e) => setField('jobNumber', e.target.value)}
                required
              />
            </div>

            {/* Couple Email & Phone — side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="coupleEmail">
                  Couple Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="coupleEmail"
                  type="email"
                  placeholder="couple@example.com"
                  value={form.coupleEmail}
                  onChange={(e) => setField('coupleEmail', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="couplePhone">
                  Couple Phone <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="couplePhone"
                  placeholder="+65 9123 4567"
                  value={form.couplePhone}
                  onChange={(e) => setField('couplePhone', e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Plan & Status — side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  Plan <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.plan}
                  onValueChange={(v) => setField('plan', v)}
                >
                  <SelectTrigger className="w-full border-slate-200">
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GOLD">Gold</SelectItem>
                    <SelectItem value="PLATINUM">Platinum</SelectItem>
                    <SelectItem value="DIAMOND">Diamond</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  Status <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setField('status', v)}
                >
                  <SelectTrigger className="w-full border-slate-200">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Consultant & Coordinator — side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Consultant</Label>
                <Select
                  value={form.consultantId || 'none'}
                  onValueChange={(v) => setField('consultantId', v === 'none' ? '' : v)}
                >
                  <SelectTrigger className="w-full border-slate-200">
                    <SelectValue placeholder="Select consultant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {consultants.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {consultants.length === 0 && (
                  <p className="text-xs text-amber-600">
                    No ADMIN_1 users. Add staff in the Team page.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Coordinator</Label>
                <Select
                  value={form.coordinatorId || 'none'}
                  onValueChange={(v) => setField('coordinatorId', v === 'none' ? '' : v)}
                >
                  <SelectTrigger className="w-full border-slate-200">
                    <SelectValue placeholder="Select coordinator" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {coordinators.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {coordinators.length === 0 && (
                  <p className="text-xs text-amber-600">
                    No ADMIN_2 users. Add staff in the Team page.
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Optional Sections */}
            <div className="space-y-3">
              <div>
                <Label className="text-slate-700 font-semibold">Optional Sections</Label>
                <p className="text-xs text-slate-400 mt-0.5">
                  Home, Schedule, RSVP &amp; Getting There are always included. Toggle additional sections for this wedding.
                </p>
              </div>
              <div className="space-y-3">
                {OPTIONAL_SECTIONS.map((section) => {
                  const checked = form.sections.includes(section.key);
                  return (
                    <div key={section.key} className="flex items-center justify-between">
                      <Label htmlFor={`section-${section.key}`} className="text-sm text-slate-600 cursor-pointer">
                        {section.label}
                      </Label>
                      <Switch
                        id={`section-${section.key}`}
                        checked={checked}
                        onCheckedChange={(checked) => {
                          setForm((prev) => ({
                            ...prev,
                            sections: checked
                              ? [...prev.sections, section.key]
                              : prev.sections.filter((s) => s !== section.key),
                          }));
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {editingId ? 'Saving...' : 'Creating...'}
                  </>
                ) : editingId ? (
                  'Save Changes'
                ) : (
                  'Create Wedding'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Wedding Creation Wizard (4-step) */}
      <WeddingCreationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreated={fetchWeddings}
      />

      {/* Credentials Dialog — retrieve registration details anytime */}
      <Dialog open={!!credWedding} onOpenChange={(open) => { if (!open) setCredWedding(null); }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-charcoal-ink">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-cinematic-gold/10">
                <KeyRound className="size-5 text-cinematic-gold" />
              </div>
              Wedding Registration Details
            </DialogTitle>
            <DialogDescription>
              {credWedding?.coupleName} — copy these details to share with the couple.
            </DialogDescription>
          </DialogHeader>
          {credWedding && (() => {
            const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
            const coupleCmsUrl = `${baseUrl}/?view=couple`;
            const guestUrl = `${baseUrl}/${credWedding.slug}`;
            const loginId = credWedding.coupleEmail ?? '(not set)';
            const jobNum = credWedding.jobNumber ?? '—';
            const expiry = credWedding.accessExpiryDate
              ? new Date(credWedding.accessExpiryDate).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
              : '—';
            const allDetails = `DreamWeavers Digital Invitation\n\nCouple: ${credWedding.coupleName}\nJob Number: ${jobNum}\n\nCouple CMS URL: ${coupleCmsUrl}\nGuest URL: ${guestUrl}\n\nLogin ID: ${loginId}\nPassword: ${defaultPassword}\n\nPlease log in to personalise your wedding invitation.`;
            return (
              <div className="space-y-4 py-2">
                <div className="bg-paper-cream rounded-lg p-4 space-y-3">
                  <div>
                    <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Couple</Label>
                    <p className="text-sm font-medium text-charcoal-ink mt-1">{credWedding.coupleName}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Job Number</Label>
                    <p className="text-sm font-medium text-charcoal-ink mt-1">{jobNum}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Couple CMS URL</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 text-sm bg-white border border-charcoal-ink/10 rounded px-2 py-1.5 truncate">
                        {coupleCmsUrl}
                      </code>
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(coupleCmsUrl, 'Couple CMS URL')}>
                        {copied === 'Couple CMS URL' ? <Check className="size-3" /> : <Copy className="size-3" />}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Guest Invitation URL</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 text-sm bg-white border border-charcoal-ink/10 rounded px-2 py-1.5 truncate">
                        {guestUrl}
                      </code>
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(guestUrl, 'Guest URL')}>
                        {copied === 'Guest URL' ? <Check className="size-3" /> : <Copy className="size-3" />}
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Login ID</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="flex-1 text-sm bg-white border border-charcoal-ink/10 rounded px-2 py-1.5 truncate">
                          {loginId}
                        </code>
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(loginId, 'Login ID')}>
                          {copied === 'Login ID' ? <Check className="size-3" /> : <Copy className="size-3" />}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Password</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="flex-1 text-sm bg-white border border-charcoal-ink/10 rounded px-2 py-1.5 truncate">
                          {defaultPassword}
                        </code>
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(defaultPassword, 'Password')}>
                          {copied === 'Password' ? <Check className="size-3" /> : <Copy className="size-3" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-charcoal-ink/50 uppercase tracking-wider">Access Expires</Label>
                    <p className="text-sm font-medium text-charcoal-ink mt-1">{expiry}</p>
                  </div>
                </div>
                <div className="bg-cinematic-gold/5 border border-cinematic-gold/20 rounded-lg p-3 flex items-center gap-2">
                  <p className="text-xs text-charcoal-ink/60">
                    Password shown is the platform default. If the couple has changed it, this field won't reflect their current password.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    onClick={() => copyToClipboard(allDetails, 'All Details')}
                    variant="outline"
                    className="text-xs"
                  >
                    <Copy className="size-3 mr-1" />
                    Copy All Details
                  </Button>
                  <Button onClick={() => setCredWedding(null)} className="bg-charcoal-ink text-paper-cream hover:bg-charcoal-ink/90 text-xs">
                    Done
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}