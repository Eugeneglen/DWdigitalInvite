'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Activity, Search, Loader2, X, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
  user: { name: string; email: string } | null;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface WeddingOption {
  id: string;
  coupleName: string;
  slug: string;
}

const ACTION_VARIANT: Record<string, string> = {
  CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UPDATE: 'bg-sky-50 text-sky-700 border-sky-200',
  DELETE: 'bg-red-50 text-red-700 border-red-200',
};

// Static list of known entity types (derived from actual DB data)
const ENTITY_OPTIONS = [
  { value: 'WeddingAccount', label: 'Wedding Account' },
  { value: 'WeddingContent', label: 'Wedding Content' },
  { value: 'WeddingMedia', label: 'Wedding Media' },
  { value: 'SystemSetting', label: 'System Setting' },
  { value: 'User', label: 'User' },
];

const PAGE_SIZE = 25;

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
}

function formatDetails(details: string | null): string {
  if (!details) return '—';
  try {
    const parsed = JSON.parse(details);
    return Object.entries(parsed)
      .map(([k, v]) => `${k}: ${typeof v === 'string' ? v.slice(0, 40) : JSON.stringify(v).slice(0, 40)}`)
      .join(', ');
  } catch {
    return details.slice(0, 80);
  }
}

export default function MasterAuditLog() {
  // ── Data state ────────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [userFilter, setUserFilter] = useState<string>('');
  const [weddingFilter, setWeddingFilter] = useState<string>('');
  const [entityFilter, setEntityFilter] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [page, setPage] = useState(1);

  // ── Dropdown options ──────────────────────────────────────────────────────
  const [users, setUsers] = useState<UserOption[]>([]);
  const [weddings, setWeddings] = useState<WeddingOption[]>([]);

  // ── Load dropdown options once on mount ───────────────────────────────────
  useEffect(() => {
    async function loadOptions() {
      try {
        const [usersRes, weddingsRes] = await Promise.all([
          fetch('/api/master/users?XTransformPort=3000'),
          fetch('/api/master/weddings?page=1&limit=100&XTransformPort=3000'),
        ]);
        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers((data.users ?? []) as UserOption[]);
        }
        if (weddingsRes.ok) {
          const data = await weddingsRes.json();
          setWeddings((data.weddings ?? []) as WeddingOption[]);
        }
      } catch {
        // Non-fatal — dropdowns will just be empty
      }
    }
    loadOptions();
  }, []);

  // ── Build query params from filters ───────────────────────────────────────
  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set('limit', String(PAGE_SIZE));
    params.set('page', String(page));
    if (search.trim()) params.set('search', search.trim());
    if (actionFilter) params.set('action', actionFilter);
    if (userFilter) params.set('userId', userFilter);
    if (weddingFilter) params.set('tenantId', weddingFilter);
    if (entityFilter) params.set('entity', entityFilter);
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    return params;
  }, [search, actionFilter, userFilter, weddingFilter, entityFilter, fromDate, toDate, page]);

  // ── Fetch logs whenever filters or page change ────────────────────────────
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = buildParams();
      const res = await fetch(`/api/cms/audit?${params.toString()}&XTransformPort=3000`);
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      const data = await res.json();
      const logArray = data?.data?.logs ?? data?.logs ?? (Array.isArray(data) ? data : []);
      setLogs(Array.isArray(logArray) ? logArray : []);
      setTotal(data?.data?.total ?? data?.total ?? 0);
      setTotalPages(data?.data?.totalPages ?? data?.totalPages ?? 1);
    } catch {
      setLogs([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  // Debounce search input, fetch on any filter/page change
  useEffect(() => {
    const timer = setTimeout(() => fetchLogs(), 300);
    return () => clearTimeout(timer);
  }, [fetchLogs]);

  // Reset to page 1 whenever any filter changes (not on page change itself)
  useEffect(() => {
    setPage(1);
  }, [search, actionFilter, userFilter, weddingFilter, entityFilter, fromDate, toDate]);

  // ── Clear all filters ─────────────────────────────────────────────────────
  const handleClear = () => {
    setSearch('');
    setActionFilter('');
    setUserFilter('');
    setWeddingFilter('');
    setEntityFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (search.trim()) n++;
    if (actionFilter) n++;
    if (userFilter) n++;
    if (weddingFilter) n++;
    if (entityFilter) n++;
    if (fromDate) n++;
    if (toDate) n++;
    return n;
  }, [search, actionFilter, userFilter, weddingFilter, entityFilter, fromDate, toDate]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900">Audit Log</h2>
          {total > 0 && (
            <Badge variant="outline" className="text-xs font-normal text-slate-500 border-slate-200">
              {total} {total === 1 ? 'entry' : 'entries'}
            </Badge>
          )}
        </div>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClear} className="h-8 text-xs text-slate-500 hover:text-slate-700">
            <X className="size-3 mr-1" />
            Clear {activeFilterCount} {activeFilterCount === 1 ? 'filter' : 'filters'}
          </Button>
        )}
      </div>

      {/* Filters — Row 1: Search + Action + Entity */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-0 sm:min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by user, entity, action, or details..."
            className="pl-9 border-slate-200 bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={actionFilter || 'all'} onValueChange={(v) => setActionFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-[140px] sm:min-w-0 border-slate-200 bg-white">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="CREATE">Create</SelectItem>
            <SelectItem value="UPDATE">Update</SelectItem>
            <SelectItem value="DELETE">Delete</SelectItem>
          </SelectContent>
        </Select>
        <Select value={entityFilter || 'all'} onValueChange={(v) => setEntityFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-[170px] sm:min-w-0 border-slate-200 bg-white">
            <SelectValue placeholder="All Entities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            {ENTITY_OPTIONS.map((e) => (
              <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filters — Row 2: User + Wedding + Date range */}
      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-slate-500">User</Label>
          <Select value={userFilter || 'all'} onValueChange={(v) => setUserFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-[200px] sm:min-w-0 border-slate-200 bg-white">
              <SelectValue placeholder="All Users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name || u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-slate-500">Wedding</Label>
          <Select value={weddingFilter || 'all'} onValueChange={(v) => setWeddingFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-[220px] sm:min-w-0 border-slate-200 bg-white">
              <SelectValue placeholder="All Weddings" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Weddings</SelectItem>
              {weddings.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.coupleName} ({w.slug})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-slate-500">From Date</Label>
          <Input
            type="date"
            className="w-full sm:w-[160px] sm:min-w-0 border-slate-200 bg-white"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-slate-500">To Date</Label>
          <Input
            type="date"
            className="w-full sm:w-[160px] sm:min-w-0 border-slate-200 bg-white"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      {/* Active filter indicator */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Filter className="size-3" />
          <span>
            Filtering by {activeFilterCount} {activeFilterCount === 1 ? 'criterion' : 'criteria'} — showing {total} {total === 1 ? 'match' : 'matches'}
          </span>
        </div>
      )}

      {/* Table */}
      <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Activity className="h-8 w-8 mb-2" />
              <p className="text-sm">
                {activeFilterCount > 0
                  ? 'No audit log entries match your filters'
                  : 'No audit log entries found'}
              </p>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={handleClear} className="mt-2 h-8 text-xs">
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="text-xs font-medium text-slate-500">Time</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500">User</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500">Action</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 hidden md:table-cell">Entity</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500 hidden md:table-cell">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className="border-slate-100">
                    <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                      {formatRelative(log.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-700">
                      <div>
                        <p className="font-medium">{log.user?.name || 'Unknown'}</p>
                        <p className="text-xs text-slate-400">{log.user?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ACTION_VARIANT[log.action] ?? 'bg-slate-100 text-slate-500 border-slate-200'}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 hidden md:table-cell">{log.entity || '—'}</TableCell>
                    <TableCell className="text-xs text-slate-500 max-w-[300px] truncate hidden md:table-cell">
                      {formatDetails(log.details)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {!loading && logs.length > 0 && (
          <div className="flex flex-wrap items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/30 gap-2">
            <p className="text-xs text-slate-500">
              Page {page} of {Math.max(1, totalPages)} · {total} total {total === 1 ? 'entry' : 'entries'}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-8"
              >
                <ChevronLeft className="size-3 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-8"
              >
                Next
                <ChevronRight className="size-3 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
