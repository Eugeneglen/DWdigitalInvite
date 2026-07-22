'use client';

import React, { useEffect, useState } from 'react';
import { useCMSStore } from '@/store/useCMSStore';
import { Heart, CheckCircle, Mail, Users, MessageSquareHeart, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// ── Types ──────────────────────────────────────────────────────────────────

interface DashboardData {
  totalWeddings: number;
  activeWeddings: number;
  totalRsvps: number;
  totalGuests: number;
  totalWishes: number;
  totalContacts: number;
  totalUsers: number;
  recentWeddings: { id: string; slug: string; coupleName: string; status: string; plan: string; updatedAt: string }[];
  recentRsvps: { id: string; firstName: string; lastName: string; partySize: number; guests: { name: string; attendance: string }[]; createdAt: string }[];
  recentWishes: { id: string; name: string; message: string; createdAt: string }[];
  recentContacts: { id: string; name: string; reason: string; createdAt: string }[];
  statusCounts: { status: string; _count: { status: number } }[];
  planCounts: { plan: string; _count: { plan: number } }[];
}

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

function formatRelative(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, bg }: {
  label: string; value: number; icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="p-5">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${bg}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div className="mt-4">
          <p className="text-3xl font-bold text-slate-900">{value}</p>
          <p className="mt-1 text-sm text-slate-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="p-5">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="mt-4">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="mt-2 h-4 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

function RecentWeddingsList({ weddings }: { weddings: DashboardData['recentWeddings'] }) {
  if (weddings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <Heart className="h-8 w-8 mb-2" />
        <p className="text-sm">No weddings yet</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
      {weddings.map((w) => (
        <div key={w.id} className="flex items-center justify-between px-3 py-3 hover:bg-slate-50 rounded-md transition-colors">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900 truncate">{w.coupleName}</p>
            <p className="text-xs text-slate-400 mt-0.5">Updated {formatRelative(w.updatedAt)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <Badge variant="outline" className={planVariant[w.plan] ?? 'bg-slate-100 text-slate-500 border-slate-200'}>
              {w.plan}
            </Badge>
            <Badge variant="outline" className={statusVariant[w.status] ?? 'bg-slate-100 text-slate-500 border-slate-200'}>
              {w.status}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentRSVPsList({ rsvps }: { rsvps: DashboardData['recentRsvps'] }) {
  if (rsvps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <Mail className="h-8 w-8 mb-2" />
        <p className="text-sm">No RSVPs yet</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
      {rsvps.map((r) => {
        const attending = r.guests?.filter(g => g.attendance === 'yes').length ?? 0;
        const declined = r.guests?.filter(g => g.attendance === 'no').length ?? 0;
        return (
          <div key={r.id} className="flex items-center justify-between px-3 py-3 hover:bg-slate-50 rounded-md transition-colors">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 truncate">{r.firstName} {r.lastName}</p>
              <p className="text-xs text-slate-400 mt-0.5">{formatRelative(r.createdAt)}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span className="text-xs text-slate-500">Party of {r.partySize}</span>
              <span className="inline-flex items-center gap-1 text-xs">
                <span className="flex items-center gap-0.5 text-emerald-600">
                  <CheckCircle className="h-3 w-3" />{attending}
                </span>
                {declined > 0 && (
                  <span className="flex items-center gap-0.5 text-red-500">
                    <span className="h-3 w-3 rounded-full border-2 border-red-300" />{declined}
                  </span>
                )}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function MasterDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentPage } = useCMSStore();

  useEffect(() => {
    // Refetch whenever the dashboard becomes the active page (not just on mount).
    // This ensures counts/lists are fresh after navigating away and back.
    if (currentPage !== 'dashboard') return;
    async function fetchDashboard() {
      try {
        setLoading(true);
        const res = await fetch('/api/master/dashboard?XTransformPort=3000', {
          headers: { 'Cache-Control': 'no-store' },
        });
        if (!res.ok) throw new Error(`Failed to load dashboard (${res.status})`);
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, [currentPage]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <p className="text-sm font-medium text-red-500">Error loading dashboard</p>
        <p className="text-xs mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          : data && (
            <>
              <StatCard label="Total Weddings" value={data.totalWeddings} icon={Heart} color="text-rose-500" bg="bg-rose-50" />
              <StatCard label="Active Invitations" value={data.activeWeddings} icon={CheckCircle} color="text-emerald-500" bg="bg-emerald-50" />
              <StatCard label="Total RSVPs" value={data.totalRsvps} icon={Mail} color="text-blue-500" bg="bg-blue-50" />
              <StatCard label="Total RSVP Guests" value={data.totalGuests} icon={Users} color="text-amber-500" bg="bg-amber-50" />
            </>
          )
        }
      </div>

      {/* Secondary stats row */}
      {!loading && data && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-lg font-semibold text-slate-900">{data.totalUsers}</p>
                <p className="text-xs text-slate-500">Platform Users</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <Heart className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-lg font-semibold text-slate-900">{data.totalWishes}</p>
                <p className="text-xs text-slate-500">Total Wishes</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <Mail className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-lg font-semibold text-slate-900">{data.totalContacts}</p>
                <p className="text-xs text-slate-500">Contact Messages</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Activity — 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-900">Recent Weddings</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="space-y-2"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-20" /></div>
                    <div className="flex gap-2"><Skeleton className="h-5 w-14 rounded-full" /><Skeleton className="h-5 w-14 rounded-full" /></div>
                  </div>
                ))}
              </div>
            ) : data && <RecentWeddingsList weddings={data.recentWeddings} />}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-900">Recent RSVPs</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div>
                    <Skeleton className="h-5 w-20" />
                  </div>
                ))}
              </div>
            ) : data && <RecentRSVPsList rsvps={data.recentRsvps} />}
          </CardContent>
        </Card>
      </div>

      {/* Recent Wishes & Contacts — 2 columns */}
      {!loading && data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <MessageSquareHeart className="h-4 w-4 text-rose-400" />
                Recent Wishes
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {data.recentWishes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                  <MessageSquareHeart className="h-6 w-6 mb-1" />
                  <p className="text-xs">No wishes yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {data.recentWishes.map((w) => (
                    <div key={w.id} className="px-3 py-2.5 hover:bg-slate-50 rounded-md transition-colors">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-900 truncate">{w.name}</p>
                        <p className="text-xs text-slate-400 shrink-0 ml-2">{formatRelative(w.createdAt)}</p>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{w.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Phone className="h-4 w-4 text-blue-400" />
                Recent Contact Messages
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {data.recentContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                  <Phone className="h-6 w-6 mb-1" />
                  <p className="text-xs">No messages yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {data.recentContacts.map((c) => (
                    <div key={c.id} className="px-3 py-2.5 hover:bg-slate-50 rounded-md transition-colors">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-900">{c.name}</p>
                        <p className="text-xs text-slate-400 shrink-0 ml-2">{formatRelative(c.createdAt)}</p>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{c.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}