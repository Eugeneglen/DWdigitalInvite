'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { Search, Eye, Trash2, Loader2, AlertCircle, RefreshCw, Check, EyeOff, Flag } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { AuthUser } from '@/store/useCMSStore';

// --- Types ---

interface WishItem {
  id: string;
  tenantId: string;
  name: string;
  relationship: string | null;
  message: string;
  imageUrl: string | null;
  status: string; // approved | hidden | flagged
  createdAt: string;
}

interface WishesResponse {
  wishes: WishItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PageProps {
  selectedTenantId: string | null;
  authUser: AuthUser | null;
}

const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-green-50 text-green-700 border-green-200',
  hidden: 'bg-amber-50 text-amber-700 border-amber-200',
  flagged: 'bg-red-50 text-red-700 border-red-200',
};

// --- Component ---

export default function CMSWishes({ selectedTenantId, authUser }: PageProps) {
  const tenantId = authUser?.tenantId || selectedTenantId;

  const [wishes, setWishes] = useState<WishItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Summary stats
  const [stats, setStats] = useState({ total: 0, approved: 0, hidden: 0, flagged: 0 });

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<WishItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Moderation loading
  const [moderatingId, setModeratingId] = useState<string | null>(null);

  const LIMIT = 12;

  const fetchWishes = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(search ? { search } : {}),
        ...(status && status !== 'all' ? { status } : {}),
        ...(dateFrom ? { fromDate: dateFrom } : {}),
        ...(dateTo ? { toDate: dateTo } : {}),
      });
      const res = await fetch(`/api/cms/tenants/${tenantId}/wishes?${params}`);
      const data = await res.json();
      if (data.success) {
        const resp: WishesResponse = data.data;
        setWishes(resp.wishes);
        setTotal(resp.total);
        setTotalPages(resp.totalPages);
        // Compute stats from response
        if (resp.total === 0 || page === 1) {
          // Only update stats on first page or empty
          // The API should also return stats; fallback to local computation
          if (data.data.stats) {
            setStats(data.data.stats);
          }
        }
      } else {
        setError(data.error || 'Failed to load wishes');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, page, search, status, dateFrom, dateTo]);

  // Fetch stats separately to get accurate counts across all pages
  const fetchStats = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/cms/tenants/${tenantId}/wishes?limit=1`);
      const data = await res.json();
      if (data.success && data.data.stats) {
        setStats(data.data.stats);
      }
    } catch {
      // silently handle
    }
  }, [tenantId]);

  useEffect(() => {
    fetchWishes();
  }, [fetchWishes]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasFilters = search || (status && status !== 'all') || dateFrom || dateTo;

  const handleModerate = async (wishId: string, newStatus: string) => {
    if (!tenantId) return;
    setModeratingId(wishId);
    try {
      const res = await fetch(`/api/cms/tenants/${tenantId}/wishes/${wishId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Wish ${newStatus}`);
        fetchWishes();
        fetchStats();
      } else {
        toast.error(data.error || 'Failed to update');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setModeratingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !tenantId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/cms/tenants/${tenantId}/wishes/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Wish deleted');
        setDeleteTarget(null);
        fetchWishes();
        fetchStats();
      } else {
        toast.error(data.error || 'Failed to delete');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setDeleting(false);
    }
  };

  if (!tenantId) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-charcoal-ink">Wishes</h1>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
          <AlertCircle className="h-8 w-8 text-amber-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No tenant selected. Please select a tenant to manage wishes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <h1 className="text-xl font-semibold text-charcoal-ink">Wishes</h1>

      {/* Stats Bar */}
      <div className="flex flex-wrap gap-3">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-3">
          <p className="text-xs text-gray-500 font-medium">Total</p>
          <p className="text-lg font-semibold text-charcoal-ink">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-3">
          <p className="text-xs text-gray-500 font-medium">Approved</p>
          <p className="text-lg font-semibold text-green-700">{stats.approved}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-3">
          <p className="text-xs text-gray-500 font-medium">Hidden</p>
          <p className="text-lg font-semibold text-amber-700">{stats.hidden}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-3">
          <p className="text-xs text-gray-500 font-medium">Flagged</p>
          <p className="text-lg font-semibold text-red-700">{stats.flagged}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-500">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search wishes..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 h-9 border-gray-300"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-500">Status</Label>
            <Select value={status || 'all'} onValueChange={(val) => { setStatus(val); setPage(1); }}>
              <SelectTrigger className="h-9 border-gray-300">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="hidden">Hidden</SelectItem>
                <SelectItem value="flagged">Flagged</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-500">From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="h-9 border-gray-300"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-500">To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="h-9 border-gray-300"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-500 opacity-0 hidden sm:block">Action</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="h-9 w-full"
            >
              Clear
            </Button>
          </div>
        </div>
      </div>

      {/* Wishes Grid */}
      {error ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600 mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchWishes}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      ) : wishes.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center">
          <p className="text-sm text-gray-400">
            {hasFilters ? 'No wishes match the current filters.' : 'No wishes submitted yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {wishes.map((wish) => (
            <div
              key={wish.id}
              className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex flex-col"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-charcoal-ink truncate">{wish.name}</p>
                  {wish.relationship && (
                    <Badge variant="outline" className="text-[10px] mt-1 border-gray-200 text-gray-500">
                      {wish.relationship}
                    </Badge>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] flex-shrink-0 capitalize ${STATUS_STYLES[wish.status] || STATUS_STYLES.approved}`}
                >
                  {wish.status}
                </Badge>
              </div>

              {/* Message */}
              <p className="text-sm text-gray-600 line-clamp-3 flex-1 mb-3 leading-relaxed">
                {wish.message}
              </p>

              {/* Date */}
              <p className="text-xs text-gray-400 mb-3">
                {wish.createdAt
                  ? format(new Date(wish.createdAt), 'MMM d, yyyy')
                  : ''}
              </p>

              {/* Actions */}
              <div className="flex items-center gap-1.5 pt-3 border-t border-gray-100">
                {wish.status !== 'approved' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    onClick={() => handleModerate(wish.id, 'approved')}
                    disabled={moderatingId === wish.id}
                  >
                    {moderatingId === wish.id ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3 mr-1" />
                    )}
                    Approve
                  </Button>
                )}
                {wish.status === 'approved' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                    onClick={() => handleModerate(wish.id, 'hidden')}
                    disabled={moderatingId === wish.id}
                  >
                    {moderatingId === wish.id ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <EyeOff className="h-3 w-3 mr-1" />
                    )}
                    Hide
                  </Button>
                )}
                {(wish.status === 'approved' || wish.status === 'hidden') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleModerate(wish.id, 'flagged')}
                    disabled={moderatingId === wish.id}
                  >
                    {moderatingId === wish.id ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Flag className="h-3 w-3 mr-1" />
                    )}
                    Flag
                  </Button>
                )}
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50"
                  onClick={() => setDeleteTarget(wish)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Wish</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the wish from <strong>{deleteTarget?.name}</strong>? This action
              cannot be undone.
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