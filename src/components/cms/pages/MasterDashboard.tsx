'use client';

import React, { useEffect, useState } from 'react';
import {
  Heart, CheckCircle, Mail, Users, MessageSquareHeart,
  AlertTriangle, Clock, Calendar, TrendingUp, TrendingDown,
  FileWarning, Activity, ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// ── Types (matches new /api/master/dashboard response) ─────────────────────

interface DashboardData {
  totalWeddings: number;
  activeWeddings: number;
  totalRsvps: number;
  totalWishes: number;
  alerts: {
    expiringWeddings: { id: string; slug: string; coupleName: string; accessExpiryDate: string | null; accountStatus: string; plan: string }[];
    upcomingWeddings: { id: string; slug: string; coupleName: string; weddingDate: string; status: string; plan: string }[];
    inactiveStaff: { id: string; email: string; name: string; role: string; lastLoginAt: string | null }[];
    incompleteDrafts: { slug: string; coupleName: string; contentCount: number }[];
  };
  pipeline: { ONBOARDING: number; ACTIVE: number; COMPLETED: number; EXPIRED: number; SUSPENDED: number };
  thisMonth: { newWeddings: number; newWeddingsLastMonth: number; weddingGrowthPct: number; rsvps: number; rsvpsLastMonth: number; rsvpGrowthPct: number };
  staffWorkload: { id: string; name: string; email: string; role: string; consultantWeddings: number; coordinatorWeddings: number; totalWeddings: number; lastLoginAt: string | null }[];
  activityFeed: { id: string; action: string; entity: string; entityId: string | null; details: string | null; createdAt: string; userName: string; userEmail: string | null }[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

const planBadge: Record<string, string> = {
  DIAMOND: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  PLATINUM: 'bg-violet-50 text-violet-700 border-violet-200',
  GOLD: 'bg-amber-50 text-amber-700 border-amber-200',
  FREE: 'bg-slate-50 text-slate-600 border-slate-200',
  PREMIUM: 'bg-violet-50 text-violet-700 border-violet-200',
};

const pipelineStages = [
  { key: 'ONBOARDING', label: 'Onboarding', color: 'bg-blue-500' },
  { key: 'ACTIVE', label: 'Active', color: 'bg-emerald-500' },
  { key: 'COMPLETED', label: 'Completed', color: 'bg-slate-400' },
  { key: 'EXPIRED', label: 'Expired', color: 'bg-red-400' },
  { key: 'SUSPENDED', label: 'Suspended', color: 'bg-orange-400' },
] as const;

// ── Components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, bg }: { label: string; value: number; icon: React.ElementType; color: string; bg: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex items-center justify-center h-12 w-12 rounded-xl ${bg}`}>
          <Icon className={`h-6 w-6 ${color}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function GrowthIndicator({ pct }: { pct: number }) {
  if (pct > 0) return <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><TrendingUp className="size-3" />+{pct}%</span>;
  if (pct < 0) return <span className="inline-flex items-center gap-1 text-xs text-red-500"><TrendingDown className="size-3" />{pct}%</span>;
  return <span className="text-xs text-slate-400">—</span>;
}

function AlertCard({ icon: Icon, title, items, emptyMsg, color }: {
  icon: React.ElementType; title: string; items: React.ReactNode[]; emptyMsg: string; color: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Icon className={`size-4 ${color}`} />
          {title}
          {items.length > 0 && <Badge variant="secondary" className="ml-auto">{items.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <p className="text-xs text-slate-400 italic">{emptyMsg}</p>
        ) : (
          <div className="space-y-2">{items}</div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function MasterDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/master/dashboard?XTransformPort=3000');
        if (res.ok) setData(await res.json());
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data) {
    return <div className="py-20 text-center text-slate-400">Failed to load dashboard data.</div>;
  }

  const pipelineTotal = Object.values(data.pipeline).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-6">
      {/* ── Summary Stats ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Weddings" value={data.totalWeddings} icon={Heart} color="text-rose-500" bg="bg-rose-50" />
        <StatCard label="Active Sites" value={data.activeWeddings} icon={CheckCircle} color="text-emerald-500" bg="bg-emerald-50" />
        <StatCard label="Total RSVPs" value={data.totalRsvps} icon={Mail} color="text-blue-500" bg="bg-blue-50" />
        <StatCard label="Total Wishes" value={data.totalWishes} icon={MessageSquareHeart} color="text-amber-500" bg="bg-amber-50" />
      </div>

      {/* ── This Month ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">New Weddings This Month</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{data.thisMonth.newWeddings}</p>
              <p className="text-xs text-slate-400 mt-1">Last month: {data.thisMonth.newWeddingsLastMonth}</p>
            </div>
            <GrowthIndicator pct={data.thisMonth.weddingGrowthPct} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">RSVPs This Month</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{data.thisMonth.rsvps}</p>
              <p className="text-xs text-slate-400 mt-1">Last month: {data.thisMonth.rsvpsLastMonth}</p>
            </div>
            <GrowthIndicator pct={data.thisMonth.rsvpGrowthPct} />
          </CardContent>
        </Card>
      </div>

      {/* ── Alerts ────────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Alerts</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <AlertCard
            icon={Clock}
            title="Expiring Access"
            color="text-red-500"
            emptyMsg="No weddings expiring soon"
            items={data.alerts.expiringWeddings.map((w) => (
              <div key={w.id} className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">{w.coupleName}</span>
                <Badge variant="outline" className={planBadge[w.plan] || ''}>{w.plan}</Badge>
              </div>
            ))}
          />
          <AlertCard
            icon={Calendar}
            title="Upcoming Weddings"
            color="text-blue-500"
            emptyMsg="No weddings in next 30 days"
            items={data.alerts.upcomingWeddings.map((w) => (
              <div key={w.id} className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">{w.coupleName}</span>
                <span className="text-slate-400">{formatDate(w.weddingDate)}</span>
              </div>
            ))}
          />
          <AlertCard
            icon={Clock}
            title="Inactive Staff"
            color="text-orange-500"
            emptyMsg="All staff active"
            items={data.alerts.inactiveStaff.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">{s.name}</span>
                <span className="text-slate-400">Last: {relativeTime(s.lastLoginAt || '')}</span>
              </div>
            ))}
          />
          <AlertCard
            icon={FileWarning}
            title="Incomplete Drafts"
            color="text-amber-500"
            emptyMsg="All drafts complete"
            items={data.alerts.incompleteDrafts.map((w) => (
              <div key={w.slug} className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">{w.coupleName}</span>
                <span className="text-slate-400">{w.contentCount} items</span>
              </div>
            ))}
          />
        </div>
      </div>

      {/* ── Pipeline Funnel ───────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Pipeline</h3>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-end gap-2 h-32">
              {pipelineStages.map((stage) => {
                const count = data.pipeline[stage.key];
                const pct = Math.round((count / pipelineTotal) * 100);
                const height = Math.max(pct, 5); // min 5% height for visibility
                return (
                  <div key={stage.key} className="flex-1 flex flex-col items-center justify-end">
                    <span className="text-sm font-bold text-slate-900 mb-1">{count}</span>
                    <div
                      className={`w-full ${stage.color} rounded-t-md transition-all`}
                      style={{ height: `${height}%` }}
                      title={`${stage.label}: ${count} (${pct}%)`}
                    />
                    <span className="text-xs text-slate-500 mt-2">{stage.label}</span>
                    <span className="text-xs text-slate-400">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Staff Workload + Activity Feed ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Staff Workload */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Staff Workload</h3>
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left p-3 text-xs text-slate-500 uppercase">Staff</th>
                    <th className="text-center p-3 text-xs text-slate-500 uppercase">Role</th>
                    <th className="text-center p-3 text-xs text-slate-500 uppercase">Weddings</th>
                    <th className="text-right p-3 text-xs text-slate-500 uppercase">Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {data.staffWorkload.map((staff) => (
                    <tr key={staff.id} className="border-b border-slate-50 last:border-0">
                      <td className="p-3">
                        <p className="font-medium text-slate-800">{staff.name}</p>
                        <p className="text-xs text-slate-400">{staff.email}</p>
                      </td>
                      <td className="text-center p-3">
                        <Badge variant="outline" className="text-xs">{staff.role.replace(/_/g, ' ')}</Badge>
                      </td>
                      <td className="text-center p-3">
                        <span className="font-bold text-slate-900">{staff.totalWeddings}</span>
                      </td>
                      <td className="text-right p-3 text-xs text-slate-400">
                        {relativeTime(staff.lastLoginAt || '')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Activity Feed */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Recent Activity</h3>
          <Card>
            <CardContent className="p-0">
              <div className="max-h-80 overflow-y-auto">
                {data.activityFeed.length === 0 ? (
                  <p className="text-sm text-slate-400 italic p-4 text-center">No recent activity</p>
                ) : (
                  data.activityFeed.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 p-3 border-b border-slate-50 last:border-0">
                      <div className={`flex items-center justify-center h-7 w-7 rounded-full shrink-0 ${
                        log.action === 'CREATE' ? 'bg-emerald-50' : log.action === 'DELETE' ? 'bg-red-50' : 'bg-blue-50'
                      }`}>
                        <Activity className={`size-3.5 ${
                          log.action === 'CREATE' ? 'text-emerald-500' : log.action === 'DELETE' ? 'text-red-400' : 'text-blue-500'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700">
                          <span className="font-medium">{log.userName}</span>{' '}
                          <span className="text-slate-400">{log.action.toLowerCase()}d</span>{' '}
                          <span className="text-slate-600">{log.entity || 'item'}</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{relativeTime(log.createdAt)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
