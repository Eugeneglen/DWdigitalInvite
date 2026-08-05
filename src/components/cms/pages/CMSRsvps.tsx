'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { Search, Eye, Trash2, Loader2, RefreshCw, Users, UserCheck, UserX, Clock } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// --- Types ---

interface GuestResponse {
  id: string;
  name: string;
  attendance: 'yes' | 'no' | 'partial';
  dietary: string | null;
}

interface RsvpRecord {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  partySize: number;
  createdAt: string;
  updatedAt: string;
  guests: GuestResponse[];
}

interface RsvpSummary {
  totalRsvps: number;
  totalGuests: number;
  attendingGuests: number;
  declinedGuests: number;
  partialGuests: number;
  attendanceRate: number;
}

interface CMSRsvpsProps {
  selectedTenantId: string | null;
  authUser: { userId: string; email: string; name: string; role: string; tenantId?: string; tenantRole?: string } | null;
}

// --- Helpers ---

function getAttendanceBadge(rsvp: RsvpRecord) {
  const guests = rsvp.guests || [];
  if (guests.length === 0) return <Badge variant="secondary">No guests</Badge>;
  const allYes = guests.every((g) => g.attendance === 'yes');
  const allNo = guests.every((g) => g.attendance === 'no');
  if (allYes) return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">All Attending</Badge>;
  if (allNo) return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">All Declined</Badge>;
  return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Mixed</Badge>;
}

function getAttendanceIcon(attendance: string) {
  if (attendance === 'yes') return <UserCheck className="h-4 w-4 text-emerald-600" />;
  if (attendance === 'no') return <UserX className="h-4 w-4 text-rose-600" />;
  return <Clock className="h-4 w-4 text-amber-600" />;
}

// --- Component ---

export default function CMSRsvps({ selectedTenantId, authUser }: CMSRsvpsProps) {
  const tenantId = authUser?.tenantId || selectedTenantId;

  // State
  const [rsvps, setRsvps] = useState<RsvpRecord[]>([]);
  const [summary, setSummary] = useState<RsvpSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  // Filters
  const [search, setSearch] = useState('');
  const [attendance, setAttendance] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Detail dialog
  const [selectedRsvp, setSelectedRsvp] = useState<RsvpRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Delete dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch RSVPs
  const fetchRsvps = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (attendance && attendance !== 'all') params.set('attendance', attendance);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);

      const res = await fetch(`/api/cms/tenants/${tenantId}/rsvps?${params}`);
      const json = await res.json();
      if (json.success) {
        setRsvps(json.data.rsvps || []);
        setTotal(json.data.total || 0);
        setTotalPages(json.data.totalPages || 1);
        setSummary(json.data.summary || null);
      }
    } catch {
      toast.error('Failed to load RSVPs');
    } finally {
      setLoading(false);
    }
  }, [tenantId, page, search, attendance, fromDate, toDate]);

  useEffect(() => {
    fetchRsvps();
  }, [fetchRsvps]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, attendance, fromDate, toDate]);

  // Delete RSVP
  const handleDelete = async () => {
    if (!deleteId || !tenantId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/cms/tenants/${tenantId}/rsvps/${deleteId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        toast.success('RSVP deleted');
        fetchRsvps();
      } else {
        toast.error(json.error || 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete RSVP');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  // Open detail
  const openDetail = (rsvp: RsvpRecord) => {
    setSelectedRsvp(rsvp);
    setDetailOpen(true);
  };

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Select a tenant to view RSVPs</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">RSVP Management</h2>
          <p className="text-muted-foreground text-sm mt-1">View and manage guest RSVP submissions</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRsvps} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
              <Users className="h-3.5 w-3.5" /> Submissions
            </div>
            <p className="text-2xl font-bold text-foreground">{summary.totalRsvps}</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
              <Users className="h-3.5 w-3.5" /> Total Guests
            </div>
            <p className="text-2xl font-bold text-foreground">{summary.totalGuests}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
            <div className="flex items-center gap-2 text-emerald-700 text-xs font-medium mb-1">
              <UserCheck className="h-3.5 w-3.5" /> Attending
            </div>
            <p className="text-2xl font-bold text-emerald-700">{summary.attendingGuests}</p>
          </div>
          <div className="bg-rose-50 border border-rose-100 rounded-lg p-4">
            <div className="flex items-center gap-2 text-rose-700 text-xs font-medium mb-1">
              <UserX className="h-3.5 w-3.5" /> Declined
            </div>
            <p className="text-2xl font-bold text-rose-700">{summary.declinedGuests}</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
              <Clock className="h-3.5 w-3.5" /> Partial
            </div>
            <p className="text-2xl font-bold text-foreground">{summary.partialGuests}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-0 sm:min-w-[200px]">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Search Name</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
        <div className="w-full sm:w-[160px] sm:min-w-0">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Attendance</label>
          <Select value={attendance} onValueChange={setAttendance}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="yes">All Attending</SelectItem>
              <SelectItem value="no">All Declined</SelectItem>
              <SelectItem value="partial">All Partial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-[150px] sm:min-w-0">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9" />
        </div>
        <div className="w-full sm:w-[150px] sm:min-w-0">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9" />
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Party</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Dietary</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Date</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="p-3"><Skeleton className="h-4 w-8 mx-auto" /></td>
                    <td className="p-3"><Skeleton className="h-5 w-24 mx-auto" /></td>
                    <td className="p-3 hidden md:table-cell"><Skeleton className="h-4 w-20" /></td>
                    <td className="p-3 hidden lg:table-cell"><Skeleton className="h-4 w-24" /></td>
                    <td className="p-3"><Skeleton className="h-8 w-8 ml-auto" /></td>
                  </tr>
                ))
              ) : rsvps.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No RSVP submissions found
                  </td>
                </tr>
              ) : (
                rsvps.map((rsvp) => {
                  const dietaryItems = rsvp.guests
                    .map((g) => g.dietary)
                    .filter(Boolean)
                    .filter((v, i, a) => a.indexOf(v) === i);

                  return (
                    <tr key={rsvp.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <span className="font-medium text-foreground">
                          {rsvp.firstName} {rsvp.lastName}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-muted-foreground">{rsvp.partySize}</span>
                      </td>
                      <td className="p-3 text-center">{getAttendanceBadge(rsvp)}</td>
                      <td className="p-3 hidden md:table-cell">
                        {dietaryItems.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {dietaryItems.map((d) => (
                              <Badge key={d} variant="outline" className="text-xs">{d}</Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">None</span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground hidden lg:table-cell">
                        {formatDistanceToNow(new Date(rsvp.createdAt), { addSuffix: true })}
                      </td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(rsvp)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Showing {Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>RSVP Details</DialogTitle>
            <DialogDescription>
              {selectedRsvp && `${selectedRsvp.firstName} ${selectedRsvp.lastName} — submitted ${selectedRsvp ? format(new Date(selectedRsvp.createdAt), 'MMM d, yyyy h:mm a') : ''}`}
            </DialogDescription>
          </DialogHeader>
          {selectedRsvp && (
            <div className="space-y-4 mt-2">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="flex-1 bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Party Size</p>
                  <p className="text-lg font-bold">{selectedRsvp.partySize}</p>
                </div>
                <div className="flex-1 bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <div className="mt-1">{getAttendanceBadge(selectedRsvp)}</div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">Guest Responses</h4>
                <div className="space-y-2">
                  {selectedRsvp.guests.map((guest) => (
                    <div key={guest.id} className="flex flex-wrap items-center gap-2 bg-white border rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        {getAttendanceIcon(guest.attendance)}
                        <span className="font-medium">{guest.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {guest.dietary && (
                          <Badge variant="outline" className="text-xs">{guest.dietary}</Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={
                            guest.attendance === 'yes'
                              ? 'border-emerald-300 text-emerald-700'
                              : guest.attendance === 'no'
                              ? 'border-rose-300 text-rose-700'
                              : 'border-amber-300 text-amber-700'
                          }
                        >
                          {guest.attendance === 'yes' ? 'Attending' : guest.attendance === 'no' ? 'Declined' : 'Partial'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setDeleteId(selectedRsvp.id);
                    setDetailOpen(false);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete RSVP
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete RSVP?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this RSVP and all guest responses. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}