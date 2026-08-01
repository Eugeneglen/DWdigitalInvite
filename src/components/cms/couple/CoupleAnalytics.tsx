'use client';

import React, { useEffect, useState } from 'react';
import {
  Users, MessageSquareHeart, Eye, BarChart3, Loader2,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

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

  useEffect(() => {
    async function fetchAnalytics() {
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
    }
    fetchAnalytics();
  }, []);

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
    </div>
  );
}