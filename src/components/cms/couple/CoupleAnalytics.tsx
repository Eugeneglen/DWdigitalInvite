'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Users, MessageSquareHeart, Eye, BarChart3, Loader2,
  UserPlus, Link2, AlertCircle,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

// ── Types ──────────────────────────────────────────────────────────────

interface AnalyticsData {
  guestStats: {
    total: number;
    attending: number;
    declined: number;
    pending: number;
    partial: number;
    responseRate: number;
  };
  wishesCount: number;
  rsvpTimeline: { date: string; count: number }[];
  groupBreakdown: {
    group: string;
    total: number;
    attending: number;
    declined: number;
    pending: number;
    responseRate: number;
  }[];
  // ── Phase 4 new fields (additive) ───────────────────────────
  nonResponders?: Array<{
    id: string;
    name: string;
    groupName: string;
    email: string | null;
    phone: string | null;
  }>;
  dietaryGuests?: Array<{
    id: string;
    name: string;
    groupName: string;
    dietaryNotes: string;
    rsvpStatus: string;
  }>;
  // ── Phase 5 new fields (additive) ───────────────────────────
  unmatchedRsvps?: Array<{
    id: string;
    name: string;
    partySize: number;
    createdAt: string;
    guests: Array<{ name: string; attendance: string; dietary: string | null }>;
  }>;
  allGuestsForMatch?: Array<{
    id: string;
    name: string;
    groupName: string;
    email: string | null;
  }>;
}

// ── Constants ──────────────────────────────────────────────────────────

const RSVP_COLORS: Record<string, string> = {
  Attending: '#10b981',
  Declined: '#ef4444',
  Pending: '#f59e0b',
  Partial: '#38bdf8',
};

const GOLD = '#D4AF37';

// ── KPI Card ───────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  icon: Icon,
  subtitle,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  subtitle?: string;
  accent?: string;
}) {
  return (
    <Card className="border-charcoal-ink/5 rounded-xl bg-white shadow-none">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs text-charcoal-ink/50 font-medium uppercase tracking-wider">
            {label}
          </p>
          <Icon className={`size-4 ${accent ?? 'text-cinematic-gold'}`} />
        </div>
        <p className="mt-2 text-2xl font-bold text-charcoal-ink">{value}</p>
        {subtitle && (
          <p className="mt-1 text-xs text-charcoal-ink/40">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Progress Ring ──────────────────────────────────────────────────────

function ProgressRing({ value, size = 48, strokeWidth = 5 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#f5f0e8"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={GOLD}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700 ease-out"
      />
    </svg>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────

function CustomPieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { fill: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-lg border border-charcoal-ink/10 bg-white px-3 py-2 shadow-sm text-xs">
      <p className="font-semibold text-charcoal-ink">{d.name}</p>
      <p className="text-charcoal-ink/60">{d.value} guest{d.value !== 1 ? 's' : ''}</p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export default function CoupleAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Phase 5: state for unmatched RSVP actions
  const [matchGuestId, setMatchGuestId] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/cms/analytics?XTransformPort=3000');
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Phase 5: Match an RSVP to an existing guest
  async function handleMatchRsvp(rsvpId: string) {
    const guestId = matchGuestId[rsvpId];
    if (!guestId) {
      toast({ title: 'Select a guest', description: 'Choose a guest from the dropdown first.', variant: 'destructive' });
      return;
    }
    try {
      setActionLoading(rsvpId);
      const res = await fetch('/api/cms/rsvps?XTransformPort=3000', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rsvpId, guestId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to match');
      }
      toast({ title: 'Matched', description: 'RSVP has been linked to the guest.' });
      setMatchGuestId(prev => { const next = { ...prev }; delete next[rsvpId]; return next; });
      await fetchAnalytics();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to match RSVP', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  }

  // Phase 5: Create a new guest from an unmatched RSVP
  async function handleAddAsGuest(rsvpId: string) {
    try {
      setActionLoading(rsvpId);
      const res = await fetch('/api/cms/rsvps?XTransformPort=3000', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rsvpId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create guest');
      }
      toast({ title: 'Guest Created', description: 'New guest added from RSVP and linked.' });
      await fetchAnalytics();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to create guest', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-sm font-medium text-red-500">Error loading analytics</p>
        <p className="text-xs text-charcoal-ink/40">{error}</p>
      </div>
    );
  }

  // ── Pie chart data ─────────────────────────────────────────────
  const pieData = data
    ? [
        { name: 'Attending', value: data.guestStats.attending },
        { name: 'Declined', value: data.guestStats.declined },
        { name: 'Pending', value: data.guestStats.pending },
        { name: 'Partial', value: data.guestStats.partial },
      ].filter((d) => d.value > 0)
    : [];

  // ── Timeline data (last 30 days, fallback to 90) ─────────────
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const thirtyDaysStr = thirtyDaysAgo.toISOString().slice(0, 10);

  const recentTimeline = data?.rsvpTimeline.filter(
    (d) => d.date >= thirtyDaysStr
  );
  const timelineData =
    (recentTimeline && recentTimeline.length > 0
      ? recentTimeline
      : data?.rsvpTimeline ?? []
    ).map((d) => ({
      ...d,
      date: new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-semibold text-charcoal-ink">Analytics</h2>
        <p className="text-sm text-charcoal-ink/50 mt-1">
          Insights and metrics for your wedding.
        </p>
      </div>

      <Separator className="bg-champagne-silk" />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-charcoal-ink/5 rounded-xl bg-white shadow-none">
              <CardContent className="p-5 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-14" />
                <Skeleton className="h-3 w-28" />
              </CardContent>
            </Card>
          ))
        ) : (
          data && (
            <>
              <KPICard
                label="Guests Invited"
                value={data.guestStats.total}
                icon={Users}
              />
              <Card className="border-charcoal-ink/5 rounded-xl bg-white shadow-none">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-charcoal-ink/50 font-medium uppercase tracking-wider">
                      Response Rate
                    </p>
                    <BarChart3 className="size-4 text-cinematic-gold" />
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <ProgressRing value={data.guestStats.responseRate} />
                    <div>
                      <p className="text-2xl font-bold text-charcoal-ink">
                        {data.guestStats.responseRate}%
                      </p>
                      <p className="text-xs text-charcoal-ink/40">
                        {data.guestStats.attending + data.guestStats.declined + data.guestStats.partial} of{' '}
                        {data.guestStats.total} responded
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <KPICard
                label="Wishes Received"
                value={data.wishesCount}
                icon={MessageSquareHeart}
              />
              <KPICard
                label="Page Views"
                value="—"
                icon={Eye}
                subtitle="Coming soon"
                accent="text-charcoal-ink/30"
              />
            </>
          )
        )}
      </div>

      {/* Charts Row: RSVP Donut + Response Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* RSVP Breakdown — Donut */}
        <Card className="border-charcoal-ink/5 rounded-xl bg-white shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-charcoal-ink">
              RSVP Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[260px] w-full rounded-lg" />
            ) : pieData.length === 0 ? (
              <div className="flex items-center justify-center h-[260px] text-charcoal-ink/30 text-sm">
                No RSVP data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={RSVP_COLORS[entry.name] ?? '#94a3b8'}
                      />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value: string) => (
                      <span className="text-xs text-charcoal-ink/60">{value}</span>
                    )}
                  />
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Response Timeline — Bar */}
        <Card className="border-charcoal-ink/5 rounded-xl bg-white shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-charcoal-ink">
              RSVP Response Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[260px] w-full rounded-lg" />
            ) : timelineData.length === 0 ? (
              <div className="flex items-center justify-center h-[260px] text-charcoal-ink/30 text-sm">
                No RSVP submissions yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={timelineData}
                  margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f5f0e8"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={{ stroke: '#f5f0e8' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid rgba(0,0,0,0.06)',
                      fontSize: '12px',
                    }}
                    labelStyle={{ color: '#5a5245' }}
                    cursor={{ fill: 'rgba(212,175,55,0.08)' }}
                  />
                  <Bar
                    dataKey="count"
                    name="RSVPs"
                    fill={GOLD}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Group Breakdown Table */}
      <Card className="border-charcoal-ink/5 rounded-xl bg-white shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-charcoal-ink">
            RSVP by Group
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded" />
              ))}
            </div>
          ) : !data || data.groupBreakdown.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-charcoal-ink/30 text-sm">
              No guest groups defined
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-champagne-silk">
                    <th className="text-left py-2.5 pr-3 text-[11px] font-medium text-charcoal-ink/40 uppercase tracking-wider">
                      Group
                    </th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-medium text-charcoal-ink/40 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-medium text-emerald-600/60 uppercase tracking-wider">
                      Attending
                    </th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-medium text-red-500/60 uppercase tracking-wider">
                      Declined
                    </th>
                    <th className="text-right py-2.5 px-3 text-[11px] font-medium text-amber-600/60 uppercase tracking-wider">
                      Pending
                    </th>
                    <th className="text-right py-2.5 pl-3 text-[11px] font-medium text-charcoal-ink/40 uppercase tracking-wider">
                      Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-champagne-silk/50">
                  {data.groupBreakdown.map((row) => (
                    <tr
                      key={row.group}
                      className="hover:bg-cinematic-gold/[0.03] transition-colors"
                    >
                      <td className="py-2.5 pr-3 font-medium text-charcoal-ink text-xs">
                        {row.group}
                      </td>
                      <td className="py-2.5 px-3 text-right text-xs text-charcoal-ink/70">
                        {row.total}
                      </td>
                      <td className="py-2.5 px-3 text-right text-xs text-emerald-700 font-medium">
                        {row.attending}
                      </td>
                      <td className="py-2.5 px-3 text-right text-xs text-red-600">
                        {row.declined}
                      </td>
                      <td className="py-2.5 px-3 text-right text-xs text-amber-600">
                        {row.pending}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <span
                          className={`inline-flex items-center text-xs font-semibold ${
                            row.responseRate >= 80
                              ? 'text-emerald-600'
                              : row.responseRate >= 50
                                ? 'text-amber-600'
                                : 'text-charcoal-ink/40'
                          }`}
                        >
                          {row.responseRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Phase 4: Non-Responders List ─────────────────────────── */}
      <Card className="border-charcoal-ink/5 rounded-xl bg-white shadow-none">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-charcoal-ink">
              Non-Responders
            </CardTitle>
            {!loading && data && (
              <span className="text-xs text-charcoal-ink/40">
                {data.nonResponders?.length ?? 0} guest{(data.nonResponders?.length ?? 0) !== 1 ? 's' : ''} pending
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded" />
              ))}
            </div>
          ) : !data || !data.nonResponders || data.nonResponders.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-charcoal-ink/30 text-sm">
              All guests have responded!
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-champagne-silk">
                    <th className="text-left py-2.5 pr-3 text-[11px] font-medium text-charcoal-ink/40 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-medium text-charcoal-ink/40 uppercase tracking-wider">
                      Group
                    </th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-medium text-charcoal-ink/40 uppercase tracking-wider">
                      Contact
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-champagne-silk/50">
                  {data.nonResponders.map((g) => (
                    <tr key={g.id} className="hover:bg-cinematic-gold/[0.03] transition-colors">
                      <td className="py-2.5 pr-3 font-medium text-charcoal-ink text-xs">
                        {g.name}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-charcoal-ink/60">
                        {g.groupName}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-charcoal-ink/50">
                        {g.email || g.phone || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Phase 4: Dietary Requirements List ────────────────────── */}
      <Card className="border-charcoal-ink/5 rounded-xl bg-white shadow-none">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-charcoal-ink">
              Dietary Requirements
            </CardTitle>
            {!loading && data && (
              <span className="text-xs text-charcoal-ink/40">
                {data.dietaryGuests?.length ?? 0} guest{(data.dietaryGuests?.length ?? 0) !== 1 ? 's' : ''} with special needs
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded" />
              ))}
            </div>
          ) : !data || !data.dietaryGuests || data.dietaryGuests.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-charcoal-ink/30 text-sm">
              No special dietary requirements noted
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-champagne-silk">
                    <th className="text-left py-2.5 pr-3 text-[11px] font-medium text-charcoal-ink/40 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-medium text-charcoal-ink/40 uppercase tracking-wider">
                      Group
                    </th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-medium text-charcoal-ink/40 uppercase tracking-wider">
                      Dietary
                    </th>
                    <th className="text-right py-2.5 pl-3 text-[11px] font-medium text-charcoal-ink/40 uppercase tracking-wider">
                      RSVP
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-champagne-silk/50">
                  {data.dietaryGuests.map((g) => (
                    <tr key={g.id} className="hover:bg-cinematic-gold/[0.03] transition-colors">
                      <td className="py-2.5 pr-3 font-medium text-charcoal-ink text-xs">
                        {g.name}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-charcoal-ink/60">
                        {g.groupName}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-violet-700 font-medium">
                        {g.dietaryNotes}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <span className={`text-xs font-semibold ${
                          g.rsvpStatus === 'ATTENDING' ? 'text-emerald-600'
                            : g.rsvpStatus === 'DECLINED' ? 'text-red-500'
                            : 'text-amber-600'
                        }`}>
                          {g.rsvpStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Phase 5: Unmatched RSVPs (submissions with no guestId link) ── */}
      <Card className="border-charcoal-ink/5 rounded-xl bg-white shadow-none">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-charcoal-ink">
              Unmatched RSVPs
            </CardTitle>
            {!loading && data && (
              <span className="text-xs text-charcoal-ink/40">
                {data.unmatchedRsvps?.length ?? 0} unmatched
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded" />
              ))}
            </div>
          ) : !data || !data.unmatchedRsvps || data.unmatchedRsvps.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-charcoal-ink/30 text-sm">
              All RSVPs are matched to guests
            </div>
          ) : (
            <div className="space-y-4">
              {data.unmatchedRsvps.map((rsvp) => {
                const rsvpStatus = rsvp.guests.length === 0 ? 'unknown'
                  : rsvp.guests.every(g => g.attendance === 'yes') ? 'attending'
                  : rsvp.guests.every(g => g.attendance === 'no') ? 'declined'
                  : 'partial';
                const statusColor = rsvpStatus === 'attending' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : rsvpStatus === 'declined' ? 'bg-red-50 text-red-600 border-red-200'
                  : rsvpStatus === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-gray-50 text-gray-600 border-gray-200';

                return (
                  <div key={rsvp.id} className="rounded-lg border border-charcoal-ink/10 p-4 space-y-3">
                    {/* RSVP info row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-charcoal-ink">{rsvp.name}</span>
                          <Badge variant="outline" className={`text-[10px] ${statusColor}`}>
                            {rsvpStatus}
                          </Badge>
                          <span className="text-xs text-charcoal-ink/40">
                            {rsvp.partySize} guest{rsvp.partySize !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {rsvp.guests.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {rsvp.guests.map((g, i) => (
                              <span key={i} className="text-[11px] text-charcoal-ink/50">
                                {g.name}
                                {g.dietary && <span className="text-violet-600 ml-1">({g.dietary})</span>}
                                {i < rsvp.guests.length - 1 && <span className="text-charcoal-ink/20"> ·</span>}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action row */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-charcoal-ink/5">
                      {/* Match to existing guest */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Select
                          value={matchGuestId[rsvp.id] || ''}
                          onValueChange={(v) => setMatchGuestId(prev => ({ ...prev, [rsvp.id]: v }))}
                          disabled={actionLoading === rsvp.id}
                        >
                          <SelectTrigger className="h-8 text-xs flex-1 min-w-0">
                            <SelectValue placeholder="Match to existing guest..." />
                          </SelectTrigger>
                          <SelectContent>
                            {(data.allGuestsForMatch ?? []).map((g) => (
                              <SelectItem key={g.id} value={g.id} className="text-xs">
                                {g.name} <span className="text-charcoal-ink/40">({g.groupName})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMatchRsvp(rsvp.id)}
                          disabled={actionLoading === rsvp.id || !matchGuestId[rsvp.id]}
                          className="h-8 text-xs gap-1.5 shrink-0 border-charcoal-ink/15"
                        >
                          {actionLoading === rsvp.id ? <Loader2 className="size-3 animate-spin" /> : <Link2 className="size-3" />}
                          Match
                        </Button>
                      </div>

                      {/* Divider */}
                      <span className="hidden sm:block text-charcoal-ink/20 text-xs">or</span>

                      {/* Add as new guest */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddAsGuest(rsvp.id)}
                        disabled={actionLoading === rsvp.id}
                        className="h-8 text-xs gap-1.5 shrink-0 border-cinematic-gold/30 text-cinematic-gold hover:bg-cinematic-gold/5"
                      >
                        <UserPlus className="size-3" />
                        Add as New Guest
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}