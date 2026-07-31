'use client';

import React, { useEffect, useState } from 'react';
import {
  Heart, CheckCircle, Mail, Users, Download,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, LineChart, Line,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────────────────

interface AnalyticsData {
  range: number;
  planDistribution: { plan: string; count: number; percentage: number }[];
  monthlyTrend: { month: string; GOLD: number; PLATINUM: number; DIAMOND: number }[];
  growthData: { month: string; count: number }[];
  activeOverTime: { month: string; count: number }[];
  staffPerformance: { id: string; name: string; email: string; role: string; weddingsAssigned: number; rsvpsOnAssignedWeddings: number; auditActionsInRange: number }[];
  coupleEngagement: {
    totalCouples: number;
    activeCouples7d: number;
    activeCouples30d: number;
    avgCompletionPct: number;
    weddingCompletion: { slug: string; coupleName: string; contentCount: number; completionPct: number }[];
  };
  rsvpAnalytics: {
    totalInRange: number;
    totalGuestsInRange: number;
    avgPartySize: number;
    trend: { date: string; count: number }[];
  };
  totalWeddings: number;
  activeWeddings: number;
}

const PLAN_COLORS: Record<string, string> = {
  GOLD: '#f59e0b',
  PLATINUM: '#8b5cf6',
  DIAMOND: '#06b6d4',
};

const PLAN_BADGE: Record<string, string> = {
  GOLD: 'bg-amber-50 text-amber-700 border-amber-200',
  PLATINUM: 'bg-violet-50 text-violet-700 border-violet-200',
  DIAMOND: 'bg-cyan-50 text-cyan-700 border-cyan-200',
};

// ── CSV Export ──────────────────────────────────────────────────────────────

function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Empty State ─────────────────────────────────────────────────────────────

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-40 text-sm text-slate-400 italic">
      {message}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function MasterAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('mtd');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        let url = `/api/master/analytics?period=${period}&XTransformPort=3000`;
        if (period === 'custom' && customFrom && customTo) {
          url += `&from=${customFrom}&to=${customTo}`;
        }
        const res = await fetch(url);
        if (res.ok) setData(await res.json());
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [period, customFrom, customTo]);

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
    return <div className="py-20 text-center text-slate-400">Failed to load analytics data.</div>;
  }

  const hasRsvpData = data.rsvpAnalytics.trend.some((d) => d.count > 0);
  const hasGrowthData = data.growthData.some((d) => d.count > 0);

  // Format RSVP trend dates for chart
  const rsvpTrendFormatted = data.rsvpAnalytics.trend.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
  }));

  return (
    <div className="space-y-6">
      {/* ── Header + Period Selector ──────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Analytics</h2>
          <p className="text-sm text-slate-500 mt-1">Business performance insights</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={period === 'mtd' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setPeriod('mtd'); setShowCustom(false); }}
          >MTD</Button>
          <Button
            variant={period === 'ytd' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setPeriod('ytd'); setShowCustom(false); }}
          >YTD</Button>
          <Button
            variant={period === 'custom' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowCustom(!showCustom)}
          >Custom</Button>
        </div>
      </div>

      {showCustom && (
        <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-3">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => { setCustomFrom(e.target.value); setPeriod('custom'); }}
            className="text-sm border border-slate-200 rounded px-2 py-1"
          />
          <span className="text-slate-400 text-sm">to</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => { setCustomTo(e.target.value); setPeriod('custom'); }}
            className="text-sm border border-slate-200 rounded px-2 py-1"
          />
          {customFrom && customTo && (
            <Button size="sm" onClick={() => setPeriod('custom')}>Apply</Button>
          )}
        </div>
      )}

      {/* ── Summary KPIs ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <Heart className="size-5 text-rose-500" />
              <span className="text-xs text-slate-500 uppercase tracking-wider">Total Weddings</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{data.totalWeddings}</p>
            <p className="text-xs text-slate-400 mt-1">{data.activeWeddings} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <Mail className="size-5 text-blue-500" />
              <span className="text-xs text-slate-500 uppercase tracking-wider">RSVPs ({data.range}d)</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{data.rsvpAnalytics.totalInRange}</p>
            <p className="text-xs text-slate-400 mt-1">{data.rsvpAnalytics.totalGuestsInRange} guests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <Users className="size-5 text-emerald-500" />
              <span className="text-xs text-slate-500 uppercase tracking-wider">Couples Active</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{data.coupleEngagement.activeCouples7d}</p>
            <p className="text-xs text-slate-400 mt-1">in last 7 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="size-5 text-amber-500" />
              <span className="text-xs text-slate-500 uppercase tracking-wider">Avg Completion</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{data.coupleEngagement.avgCompletionPct}%</p>
            <p className="text-xs text-slate-400 mt-1">content filled</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Revenue & Packaging + Growth ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan Distribution Donut */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Plan Distribution</h3>
          <Card>
            <CardContent className="p-5">
              {data.planDistribution.every((p) => p.count === 0) ? (
                <EmptyChartState message="No weddings yet" />
              ) : (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width="50%" height={180}>
                    <PieChart>
                      <Pie
                        data={data.planDistribution}
                        dataKey="count"
                        nameKey="plan"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={2}
                      >
                        {data.planDistribution.map((entry) => (
                          <Cell key={entry.plan} fill={PLAN_COLORS[entry.plan] || '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [`${value} wedding(s)`, name]}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-3 flex-1">
                    {data.planDistribution.map((p) => (
                      <div key={p.plan} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAN_COLORS[p.plan] || '#94a3b8' }} />
                          <span className="text-sm font-medium text-slate-700">{p.plan}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-slate-900">{p.count}</span>
                          <span className="text-xs text-slate-400 ml-2">({p.percentage}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Growth Chart */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">New Weddings per Month</h3>
          <Card>
            <CardContent className="p-5">
              {!hasGrowthData ? (
                <EmptyChartState message="No new weddings in the last 12 months" />
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.growthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      formatter={(value: number) => [`${value} wedding(s)`, 'New']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    />
                    <Bar dataKey="count" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Active Weddings Over Time ────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Cumulative Weddings Over Time</h3>
        <Card>
          <CardContent className="p-5">
            {data.activeOverTime.every((d) => d.count === 0) ? (
              <EmptyChartState message="No data" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.activeOverTime}>
                  <defs>
                    <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    formatter={(value: number) => [`${value} total`, 'Cumulative']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} fill="url(#activeGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── RSVP Trend ───────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">RSVP Trend ({data.range} days)</h3>
        <Card>
          <CardContent className="p-5">
            {!hasRsvpData ? (
              <EmptyChartState message="No RSVPs in this period" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={rsvpTrendFormatted}>
                    <defs>
                      <linearGradient id="rsvpGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      formatter={(value: number) => [`${value} RSVP(s)`, '']}
                      labelFormatter={(label: string) => `Date: ${label}`}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    />
                    <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fill="url(#rsvpGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-between mt-4 text-xs text-slate-400">
                  <span>Avg party size: <span className="font-medium text-slate-600">{data.rsvpAnalytics.avgPartySize}</span></span>
                  <span>Total guests: <span className="font-medium text-slate-600">{data.rsvpAnalytics.totalGuestsInRange}</span></span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Staff Performance ────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Staff Performance</h3>
          {data.staffPerformance.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCSV(
                'staff-performance.csv',
                ['Name', 'Email', 'Role', 'Weddings Assigned', 'RSVPs on Assigned', `Actions (${data.range}d)`],
                data.staffPerformance.map((s) => [s.name, s.email, s.role, s.weddingsAssigned, s.rsvpsOnAssignedWeddings, s.auditActionsInRange]),
              )}
            >
              <Download className="size-3.5 mr-1.5" />
              Export CSV
            </Button>
          )}
        </div>
        <Card>
          <CardContent className="p-0">
            {data.staffPerformance.length === 0 ? (
              <EmptyChartState message="No staff to display" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left p-3 text-xs text-slate-500 uppercase">Staff</th>
                    <th className="text-center p-3 text-xs text-slate-500 uppercase">Role</th>
                    <th className="text-center p-3 text-xs text-slate-500 uppercase">Weddings</th>
                    <th className="text-center p-3 text-xs text-slate-500 uppercase">RSVPs</th>
                    <th className="text-center p-3 text-xs text-slate-500 uppercase">Actions ({data.range}d)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.staffPerformance.map((staff) => (
                    <tr key={staff.id} className="border-b border-slate-50 last:border-0">
                      <td className="p-3">
                        <p className="font-medium text-slate-800">{staff.name}</p>
                        <p className="text-xs text-slate-400">{staff.email}</p>
                      </td>
                      <td className="text-center p-3">
                        <Badge variant="outline" className="text-xs">{staff.role.replace(/_/g, ' ')}</Badge>
                      </td>
                      <td className="text-center p-3 font-bold text-slate-900">{staff.weddingsAssigned}</td>
                      <td className="text-center p-3 font-bold text-slate-900">{staff.rsvpsOnAssignedWeddings}</td>
                      <td className="text-center p-3 text-slate-600">{staff.auditActionsInRange}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Couple Engagement ────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Couple Engagement — Content Completion</h3>
          {data.coupleEngagement.weddingCompletion.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCSV(
                'couple-engagement.csv',
                ['Couple Name', 'Slug', 'Content Items', 'Completion %'],
                data.coupleEngagement.weddingCompletion.map((w) => [w.coupleName, w.slug, w.contentCount, `${w.completionPct}%`]),
              )}
            >
              <Download className="size-3.5 mr-1.5" />
              Export CSV
            </Button>
          )}
        </div>
        <Card>
          <CardContent className="p-0">
            {data.coupleEngagement.weddingCompletion.length === 0 ? (
              <EmptyChartState message="No weddings to display" />
            ) : (
              <div className="max-h-64 overflow-y-auto">
                {data.coupleEngagement.weddingCompletion.map((w) => (
                  <div key={w.slug} className="flex items-center gap-4 p-3 border-b border-slate-50 last:border-0">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800">{w.coupleName}</p>
                      <p className="text-xs text-slate-400">{w.slug} · {w.contentCount} items</p>
                    </div>
                    <div className="w-48">
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${w.completionPct >= 80 ? 'bg-emerald-400' : w.completionPct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${w.completionPct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-bold text-slate-700 w-12 text-right">{w.completionPct}%</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
