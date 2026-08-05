'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { Search, X, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCMSStore } from '@/store/useCMSStore';

// --- Types ---

interface AuditLog {
  id: string;
  tenantId?: string;
  userId: string;
  action: string;
  resource?: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  createdAt: string;
  user: {
    name: string;
    email: string;
  };
}

interface AuditResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ACTION_TYPES = [
  'tenant.create',
  'tenant.update',
  'tenant.delete',
  'user.create',
  'user.update',
  'user.delete',
  'feature.toggle',
  'auth.login',
  'auth.logout',
];

const getActionColor = (action: string) => {
  if (action.includes('create')) return 'bg-green-50 text-green-700 border-green-200';
  if (action.includes('update') || action.includes('toggle')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (action.includes('delete')) return 'bg-red-50 text-red-700 border-red-200';
  if (action.includes('login')) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (action.includes('logout')) return 'bg-gray-100 text-gray-600 border-gray-200';
  return 'bg-gray-50 text-gray-700 border-gray-200';
};

function ExpandableDetails({ details }: { details: string }) {
  const [expanded, setExpanded] = useState(false);
  const truncated = details.length > 100;
  const displayText = expanded ? details : details.slice(0, 100);

  let formatted: string;
  try {
    formatted = JSON.stringify(JSON.parse(details), null, 2);
  } catch {
    formatted = details;
  }

  return (
    <div className="space-y-1">
      <span className="text-xs text-gray-600 font-mono">
        {displayText}
        {truncated && !expanded && '...'}
      </span>
      {truncated && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[10px] text-cinematic-gold hover:underline font-medium"
        >
          {expanded ? (
            <>Collapse <ChevronUp className="h-3 w-3" /></>
          ) : (
            <>Expand <ChevronDown className="h-3 w-3" /></>
          )}
        </button>
      )}
      {expanded && (
        <pre className="text-[11px] bg-gray-50 border border-gray-200 rounded p-2 overflow-x-auto max-w-[200px] sm:max-w-md text-gray-700 mt-1">
          <code>{formatted}</code>
        </pre>
      )}
    </div>
  );
}

export default function CMSAuditLog() {
  const authUser = useCMSStore((s) => s.authUser);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterUser, setFilterUser] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Users for filter dropdown
  const [userOptions, setUserOptions] = useState<{ userId: string; name: string; email: string }[]>([]);

  const LIMIT = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(filterUser ? { userId: filterUser } : {}),
        ...(filterAction ? { action: filterAction } : {}),
        ...(dateFrom ? { from: dateFrom } : {}),
        ...(dateTo ? { to: dateTo } : {}),
      });
      const res = await fetch(`/api/cms/audit?${params}`);
      const data = await res.json();
      if (data.success) {
        const resp: AuditResponse = data.data;
        setLogs(resp.logs);
        setTotal(resp.total);
        setTotalPages(resp.totalPages);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [page, filterUser, filterAction, dateFrom, dateTo]);

  const fetchUserOptions = useCallback(async () => {
    try {
      const res = await fetch('/api/cms/users');
      const data = await res.json();
      if (data.success) {
        setUserOptions(
          data.data.map((u: { id: string; name: string; email: string }) => ({
            userId: u.id,
            name: u.name,
            email: u.email,
          }))
        );
      }
    } catch {
      // silently handle
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    fetchUserOptions();
  }, [fetchLogs, fetchUserOptions]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const clearFilters = () => {
    setFilterUser('');
    setFilterAction('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasFilters = filterUser || filterAction || dateFrom || dateTo;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-semibold text-charcoal-ink">Audit Log</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`h-8 text-xs ${autoRefresh ? 'bg-charcoal-ink text-white' : ''}`}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto-refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-500">User</Label>
            <Select value={filterUser} onValueChange={(val) => { setFilterUser(val); setPage(1); }}>
              <SelectTrigger className="h-9 border-gray-300">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                {userOptions.map((u) => (
                  <SelectItem key={u.userId} value={u.userId}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-500">Action</Label>
            <Select value={filterAction} onValueChange={(val) => { setFilterAction(val); setPage(1); }}>
              <SelectTrigger className="h-9 border-gray-300">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_TYPES.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action}
                  </SelectItem>
                ))}
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
            <Label className="text-xs font-medium text-gray-500 opacity-0">Action</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="h-9 w-full"
            >
              <X className="h-3.5 w-3.5 mr-1.5" />
              Clear
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-100 hover:bg-transparent">
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Timestamp</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">User</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Resource</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden xl:table-cell">Details</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i} className="border-gray-50">
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="hidden xl:table-cell"><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-sm text-gray-400">
                    {hasFilters ? 'No logs match the current filters.' : 'No audit logs found.'}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id} className="border-gray-50 hover:bg-gray-50/50">
                    <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                      <div>{log.createdAt ? format(new Date(log.createdAt), 'MMM d, HH:mm') : '—'}</div>
                      <div className="text-gray-400">
                        {log.createdAt
                          ? formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })
                          : ''}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium text-charcoal-ink">{log.user?.name || 'Unknown'}</div>
                      <div className="text-xs text-gray-400">{log.user?.email || ''}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono px-1.5 py-0 ${getActionColor(log.action)}`}
                      >
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-gray-600">
                      {log.resource || '—'}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      {log.details ? (
                        <ExpandableDetails details={log.details} />
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-xs text-gray-400 font-mono">
                        {log.ipAddress || '—'}
                      </span>
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
    </div>
  );
}