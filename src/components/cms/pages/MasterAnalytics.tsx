'use client';

import React, { useEffect, useState } from 'react';
import {
  Heart, CheckCircle, Mail, Users, MessageSquareHeart, UserCheck,
  TrendingUp, Calendar, Award, Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// ── Types (matches new /api/master/analytics response) ─────────────────────

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

const planColors: Record<string, string> = {
  GOLD: 'bg-amber-400',
  PLATINUM: 'bg-violet-400',
  DIAMOND: 'bg-cyan-400',
};

const planBadge: Record<string, string> = {
  GOLD: 'bg-amber-50 text-amber-700 border-amber-200',
  PLATINUM: 'bg-violet-50 text-violet-700 border-violet-200',
  DIAMOND: 'bg-cyan-50 text-cyan-700 border-cyan-200',
};

function relativeTime(dateStr: string): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function MasterAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/master/analytics?range=${range}&XTransformPort=3000`);
        if (res.ok) setData(await res.json());
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [range]);

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

  const maxGrowth = Math.max(...data.growthData.map((d) => d.count), 1);
  const maxActive = Math.max(...data.activeOverTime.map((d) => d.count), 1);
  const maxRsvpTrend = Math.max(...data.rsvpAnalytics.trend.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      {/* ── Header + Date Range ───────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Analytics</h2>
          <p className="text-sm text-slate-500 mt-1">Business performance insights</p>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last 365 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

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

      {/* ── Revenue & Packaging ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Plan Distribution</h3>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-center gap-8 mb-4">
                {data.planDistribution.map((p) => (
                  <div key={p.plan} className="text-center">
                    <div className={`w-16 h-16 rounded-full ${planColors[p.plan] || 'bg-slate-300'} flex items-center justify-center mx-auto mb-2`}>
                      <span className="text-xl font-bold text-white">{p.count}</span>
                    </div>
                    <p className="text-xs font-medium text-slate-700">{p.plan}</p>
                    <p className="text-xs text-slate-400">{p.percentage}%</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Growth Chart ────────────────────────────────────────────── */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">New Weddings per Month</h3>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-end gap-1.5 h-40">
                {data.growthData.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end">
                    <span className="text-xs font-bold text-slate-700 mb-1">{d.count > 0 ? d.count : ''}</span>
                    <div
                      className="w-full bg-rose-400 rounded-t-md transition-all hover:bg-rose-500"
                      style={{ height: `${Math.max((d.count / maxGrowth) * 100, 2)}%` }}
                      title={`${d.month}: ${d.count}`}
                    />
                    <span className="text-xs text-slate-400 mt-1">{d.month}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── RSVP Trend ───────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">RSVP Trend ({data.range} days)</h3>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-end gap-0.5 h-32">
              {data.rsvpAnalytics.trend.map((d, i) => (
                <div
                  key={i}
                  className="flex-1 bg-blue-400 rounded-t-sm transition-all hover:bg-blue-500"
                  style={{ height: `${Math.max((d.count / maxRsvpTrend) * 100, 1)}%` }}
                  title={`${d.date}: ${d.count} RSVPs`}
                />
              ))}
            </div>
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-slate-400">
                Avg party size: <span className="font-medium text-slate-600">{data.rsvpAnalytics.avgPartySize}</span>
              </p>
              <p className="text-xs text-slate-400">
                Total guests: <span className="font-medium text-slate-600">{data.rsvpAnalytics.totalGuestsInRange}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Staff Performance ────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Staff Performance</h3>
        <Card>
          <CardContent className="p-0">
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
          </CardContent>
        </Card>
      </div>

      {/* ── Couple Engagement ────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Couple Engagement — Content Completion</h3>
        <Card>
          <CardContent className="p-0">
            <div className="max-h-64 overflow-y-auto">
              {data.coupleEngagement.weddingCompletion.map((w) => (
                <div key={w.slug} className="flex items-center gap-4 p-3 border-b border-slate-50 last:border-0">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{w.coupleName}</p>
                    <p className="text-xs text-slate-400">{w.slug}</p>
                  </div>
                  <div className="w-48">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${w.completionPct >= 80 ? 'bg-emerald-400' : w.completionPct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                        style={{ width: `${w.completionPct}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-700 w-12 text-right">{w.completionPct}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
