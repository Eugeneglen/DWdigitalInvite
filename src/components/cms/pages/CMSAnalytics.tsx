'use client';

import { useCallback, useEffect, useState } from 'react';
import { subDays, format } from 'date-fns';
import { AlertCircle, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from 'recharts';
import type { AuthUser } from '@/store/useCMSStore';

// --- Types ---

interface AnalyticsData {
  // KPIs
  totalRsvps: number;
  totalGuests: number;
  attendingGuests: number;
  attendanceRate: number;
  totalWishes: number;
  totalContacts: number;
  // Trends
  rsvpTrend?: number;
  wishTrend?: number;
  // Charts
  rsvpTimeline: { date: string; count: number }[];
  attendanceBreakdown: { name: string; value: number }[];
  dietaryRequirements: { name: string; count: number }[];
  partySizeDistribution: { name: string; count: number }[];
  wishesTimeline: { date: string; count: number }[];
  honeymoonDestinations: { name: string; count: number }[];
}

interface PageProps {
  selectedTenantId: string | null;
  authUser: AuthUser | null;
}

const GOLD = '#C5A059';
const EMERALD = '#10b981';
const AMBER = '#f59e0b';
const ROSE = '#ef4444';
const INDIGO = '#6366f1';
const PIE_COLORS = [EMERALD, ROSE, AMBER];

// --- Preset Buttons ---

const PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'All Time', days: 0 },
] as const;

// --- Sub Components ---

function KPICard({
  label,
  value,
  trend,
  loading,
}: {
  label: string;
  value: string | number;
  trend?: number | null;
  loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      {loading ? (
        <Skeleton className="h-8 w-20 mt-2" />
      ) : (
        <div className="flex items-end gap-2 mt-1">
          <p className="text-2xl font-semibold text-charcoal-ink">{value}</p>
          {trend !== null && trend !== undefined && (
            <div
              className={`flex items-center gap-0.5 text-xs font-medium mb-1 ${
                trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-red-600' : 'text-gray-400'
              }`}
            >
              {trend > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : trend < 0 ? (
                <TrendingDown className="h-3 w-3" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TrendIndicator({ value }: { value?: number | null }) {
  if (value === null || value === undefined) return null;
  return (
    <span
      className={`text-xs font-medium ${
        value > 0 ? 'text-emerald-600' : value < 0 ? 'text-red-600' : 'text-gray-400'
      }`}
    >
      {value > 0 ? '+' : ''}
      {value}%
    </span>
  );
}

// --- Custom Tooltip ---

const tooltipStyle = {
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  fontSize: '12px',
};

// --- Pie Label ---

const CENTER_LABEL = ({ viewBox, total }: { viewBox?: { cx: number; cy: number }; total: number }) => {
  if (!viewBox) return null;
  return (
    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="central">
      <tspan x={viewBox.cx} y={viewBox.cy - 8} className="fill-charcoal-ink" fontSize="20" fontWeight="600">
        {total}
      </tspan>
      <tspan x={viewBox.cx} y={viewBox.cy + 12} className="fill-gray-400" fontSize="11">
        guests
      </tspan>
    </text>
  );
};

// --- Main Component ---

export default function CMSAnalytics({ selectedTenantId, authUser }: PageProps) {
  const tenantId = authUser?.tenantId || selectedTenantId;

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date range
  const [activePreset, setActivePreset] = useState(30);
  const [fromDate, setFromDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const fetchAnalytics = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        ...(fromDate ? { fromDate } : {}),
        ...(toDate ? { toDate } : {}),
      });
      const res = await fetch(`/api/cms/tenants/${tenantId}/analytics?${params}`);
      const resData = await res.json();
      if (resData.success) {
        setData(resData.data);
      } else {
        setError(resData.error || 'Failed to load analytics');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, fromDate, toDate]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const applyPreset = (days: number) => {
    setActivePreset(days);
    if (days === 0) {
      setFromDate('');
      setToDate('');
    } else {
      setFromDate(format(subDays(new Date(), days), 'yyyy-MM-dd'));
      setToDate(format(new Date(), 'yyyy-MM-dd'));
    }
  };

  if (!tenantId) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-charcoal-ink">Analytics</h1>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
          <AlertCircle className="h-8 w-8 text-amber-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No tenant selected. Please select a tenant to view analytics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-xl font-semibold text-charcoal-ink">Analytics</h1>

      {/* Date Range Picker */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <Button
                key={preset.days}
                variant={activePreset === preset.days ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyPreset(preset.days)}
                className={`h-8 text-xs ${
                  activePreset === preset.days ? 'bg-charcoal-ink text-white hover:bg-charcoal-ink/90' : ''
                }`}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2 sm:mt-0 sm:ml-auto">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-500">From</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setActivePreset(-1); }}
                className="h-8 border-gray-300 text-xs w-36"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-500">To</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setActivePreset(-1); }}
                className="h-8 border-gray-300 text-xs w-36"
              />
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600 mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchAnalytics}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KPICard
              label="Total RSVPs"
              value={data?.totalRsvps ?? '—'}
              trend={data?.rsvpTrend ?? null}
              loading={loading}
            />
            <KPICard
              label="Attendance Rate"
              value={data?.attendanceRate != null ? `${data.attendanceRate}%` : '—'}
              loading={loading}
            />
            <KPICard
              label="Total Wishes"
              value={data?.totalWishes ?? '—'}
              trend={data?.wishTrend ?? null}
              loading={loading}
            />
            <KPICard
              label="Total Contacts"
              value={data?.totalContacts ?? '—'}
              loading={loading}
            />
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* RSVP Timeline */}
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-charcoal-ink">RSVP Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : data?.rsvpTimeline && data.rsvpTimeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={data.rsvpTimeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" fill={GOLD} radius={[4, 4, 0, 0]} name="RSVPs" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-sm text-gray-400">
                    No RSVP data in this period.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Attendance Breakdown */}
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-charcoal-ink">Attendance Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : data?.attendanceBreakdown && data.attendanceBreakdown.some((d) => d.value > 0) ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={data.attendanceBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {data.attendanceBreakdown.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index] || PIE_COLORS[0]} />
                        ))}
                        <Label
                          content={<CENTER_LABEL total={data.totalGuests || 0} viewBox={undefined} />}
                          position="center"
                        />
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-sm text-gray-400">
                    No attendance data in this period.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dietary Requirements */}
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-charcoal-ink">Dietary Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : data?.dietaryRequirements && data.dietaryRequirements.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={data.dietaryRequirements} layout="vertical" margin={{ left: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#2C2C2C' }} width={55} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" fill={INDIGO} radius={[0, 4, 4, 0]} name="Count" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-sm text-gray-400">
                    No dietary data available.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Party Size Distribution */}
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-charcoal-ink">Party Size Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : data?.partySizeDistribution && data.partySizeDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={data.partySizeDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" fill={EMERALD} radius={[4, 4, 0, 0]} name="RSVPs" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-sm text-gray-400">
                    No party size data available.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Wishes Over Time - Full Width */}
            <Card className="shadow-sm border-gray-200 md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-charcoal-ink">Wishes Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : data?.wishesTimeline && data.wishesTimeline.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={data.wishesTimeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke={GOLD}
                        fill={GOLD}
                        fillOpacity={0.15}
                        strokeWidth={2}
                        name="Wishes"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-sm text-gray-400">
                    No wishes data in this period.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Honeymoon Destinations - Full Width */}
            <Card className="shadow-sm border-gray-200 md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-charcoal-ink">Top Honeymoon Destinations</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : data?.honeymoonDestinations && data.honeymoonDestinations.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(250, data.honeymoonDestinations.length * 40 + 20)}>
                    <BarChart data={data.honeymoonDestinations} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 12, fill: '#2C2C2C' }}
                        width={80}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" fill={ROSE} radius={[0, 4, 4, 0]} name="Votes" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-sm text-gray-400">
                    No honeymoon votes recorded.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}