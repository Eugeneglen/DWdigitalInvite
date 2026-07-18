'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Activity, Search, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  user: { name: string; email: string };
}

const ACTION_VARIANT: Record<string, string> = {
  CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UPDATE: 'bg-sky-50 text-sky-700 border-sky-200',
  DELETE: 'bg-red-50 text-red-700 border-red-200',
};

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
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('');

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('limit', '50');
      const res = await fetch(`/api/cms/audit?${params.toString()}&XTransformPort=3000`);
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      const data = await res.json();
      const logArray = data?.data?.logs ?? data?.logs ?? Array.isArray(data) ? data : [];
      setLogs(Array.isArray(logArray) ? logArray : []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchLogs(), 300);
    return () => clearTimeout(timer);
  }, [fetchLogs]);

  const filtered = logs.filter((log) => {
    if (actionFilter && log.action !== actionFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        log.user?.name?.toLowerCase().includes(q) ||
        log.user?.email?.toLowerCase().includes(q) ||
        log.entity?.toLowerCase().includes(q) ||
        log.action?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Activity className="size-5 text-slate-400" />
        <h2 className="text-lg font-semibold text-slate-900">Audit Log</h2>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by user, entity, or action..."
            className="pl-9 border-slate-200 bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={actionFilter || 'all'} onValueChange={(v) => setActionFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[140px] border-slate-200 bg-white">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="CREATE">Create</SelectItem>
            <SelectItem value="UPDATE">Update</SelectItem>
            <SelectItem value="DELETE">Delete</SelectItem>
          </SelectContent>
        </Select>
      </div>

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
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Activity className="h-8 w-8 mb-2" />
              <p className="text-sm">No audit log entries found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="text-xs font-medium text-slate-500">Time</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500">User</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500">Action</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500">Entity</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((log) => (
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
                    <TableCell className="text-sm text-slate-600">{log.entity || '—'}</TableCell>
                    <TableCell className="text-xs text-slate-500 max-w-[300px] truncate">
                      {formatDetails(log.details)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}
