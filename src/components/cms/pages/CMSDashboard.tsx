'use client';

import { useEffect, useState } from 'react';
import {
  Building2,
  CalendarCheck,
  Users,
  Activity,
  UserCheck,
  Heart,
  CalendarClock,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow, differenceInDays, format } from 'date-fns';
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
  Label,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCMSStore, type AuthUser } from '@/store/useCMSStore';

// --- Types ---

interface StatsData {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  recentLogCount: number;
}

interface AuditLogItem {
  id: string;
  action: string;
  resource?: string;
  createdAt: string;
  user: { name: string };
}

interface TenantRsvpSummary {
  totalRsvps: number;
  totalGuests: number;
  attendingGuests: number;
  declinedGuests: number;
  partialGuests: number;
  attendanceRate: number;
}

interface TenantWishSummary {
  totalWishes: number;
  hiddenWishes: number;
}

interface TenantInfo {
  id: string;
  name: string;
  eventDate: string | null;
}

interface ActivityItem {
  id: string;
  type: 'rsvp' | 'wish';
  name: string;
  action: string;
  createdAt: string;
}

// --- Shared Components ---

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subValue?: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          {loading ? (
            <Skeleton className="h-8 w-20 mt-2" />
          ) : (
            <p className="text-2xl font-semibold text-charcoal-ink mt-1">{value}</p>
          )}
          {subValue && !loading && (
            <p className="text-xs text-gray-400 mt-1">{subValue}</p>
          )}
        </div>
        <div className="h-11 w-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
          <Icon className="h-5 w-5 text-gray-600" />
        </div>
      </div>
    </div>
  );
}

function getActionColor(action: string) {
  if (action.includes('create')) return 'bg-green-50 text-green-700 border-green-200';
  if (action.includes('update') || action.includes('toggle')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (action.includes('delete')) return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-gray-50 text-gray-700 border-gray-200';
}

// --- Master Admin Dashboard ---

function MasterAdminView({ authUser }: { authUser: AuthUser }) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [recentLogs, setRecentLogs] = useState<AuditLogItem[]>([]);
  const [recentRsvps, setRecentRsvps] = useState<ActivityItem[]>([]);
  const [recentWishes, setRecentWishes] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, logsRes, rsvpsRes, wishesRes] = await Promise.all([
        fetch('/api/cms/stats'),
        fetch('/api/cms/audit?limit=5'),
        fetch('/api/cms/recent-submissions?limit=5&type=rsvp').catch(() => null),
        fetch('/api/cms/recent-submissions?limit=5&type=wish').catch(() => null),
      ]);

      if (statsRes.ok) {
        const d = await statsRes.json();
        if (d.success) setStats(d.data);
      }
      if (logsRes.ok) {
        const d = await logsRes.json();
        if (d.success) setRecentLogs(d.data.logs);
      }
      if (rsvpsRes?.ok) {
        const d = await rsvpsRes.json();
        if (d.success) setRecentRsvps(d.data);
      }
      if (wishesRes?.ok) {
        const d = await wishesRes.json();
        if (d.success) setRecentWishes(d.data);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [authUser.token]);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-xl font-semibold text-charcoal-ink">
          Welcome back, {authUser.name?.split(' ')[0] || 'Admin'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Here&apos;s an overview of your platform.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Building2}
          label="Total Tenants"
          value={stats?.totalTenants ?? '—'}
          subValue={stats ? `${stats.activeTenants} active` : undefined}
          loading={loading}
        />
        <StatCard
          icon={CalendarCheck}
          label="Active Events"
          value={stats?.activeTenants ?? '—'}
          loading={loading}
        />
        <StatCard
          icon={Users}
          label="Total Users"
          value={stats?.totalUsers ?? '—'}
          loading={loading}
        />
        <StatCard
          icon={Activity}
          label="System Health"
          value="Operational"
          loading={loading}
        />
      </div>

      {/* Recent Submissions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent RSVPs */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-charcoal-ink">Recent RSVPs</h2>
          </div>
          <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))
            ) : recentRsvps.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-gray-400">
                No recent RSVPs.
              </div>
            ) : (
              recentRsvps.map((item) => (
                <div key={item.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50/50">
                  <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal-ink truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">{item.action}</p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {item.createdAt ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true }) : '—'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Wishes */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-500" />
            <h2 className="text-sm font-semibold text-charcoal-ink">Recent Wishes</h2>
          </div>
          <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))
            ) : recentWishes.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-gray-400">
                No recent wishes.
              </div>
            ) : (
              recentWishes.map((item) => (
                <div key={item.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50/50">
                  <div className="h-8 w-8 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
                    <Heart className="h-3.5 w-3.5 text-rose-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal-ink truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">{item.action}</p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {item.createdAt ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true }) : '—'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Audit Activity */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-charcoal-ink">Recent Activity</h2>
        </div>
        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center gap-4">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-3 w-20" />
              </div>
            ))
          ) : recentLogs.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              No recent activity to display.
            </div>
          ) : (
            recentLogs.map((log) => (
              <div
                key={log.id}
                className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50/50 transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Activity className="h-3.5 w-3.5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-charcoal-ink">
                      {log.user?.name || 'Unknown'}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 font-mono ${getActionColor(log.action)}`}
                    >
                      {log.action}
                    </Badge>
                    {log.resource && (
                      <span className="text-xs text-gray-400">{log.resource}</span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {log.createdAt
                    ? formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })
                    : '—'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// --- Tenant Admin/Editor Dashboard ---

const COLORS = {
  attending: '#10b981',
  partial: '#f59e0b',
  declined: '#ef4444',
};

const PIE_LABEL = ({ viewBox, total }: { viewBox?: { cx: number; cy: number }; total: number }) => {
  if (!viewBox) return null;
  return (
    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="central">
      <tspan x={viewBox.cx} y={viewBox.cy - 8} className="fill-charcoal-ink" fontSize="22" fontWeight="600">
        {total}
      </tspan>
      <tspan x={viewBox.cx} y={viewBox.cy + 12} className="fill-gray-400" fontSize="11">
        guests
      </tspan>
    </text>
  );
};

function TenantDashboard({ tenantId, authUser }: { tenantId: string; authUser: AuthUser }) {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [rsvpSummary, setRsvpSummary] = useState<TenantRsvpSummary | null>(null);
  const [wishSummary, setWishSummary] = useState<TenantWishSummary | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [wishesTrend, setWishesTrend] = useState<{ date: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tenantRes, rsvpRes, wishesRes, activityRes, trendRes] = await Promise.all([
        fetch(`/api/cms/tenants/${tenantId}`),
        fetch(`/api/cms/tenants/${tenantId}/rsvps?limit=1`),
        fetch(`/api/cms/tenants/${tenantId}/wishes?limit=1`),
        fetch(`/api/cms/tenants/${tenantId}/activity?limit=8`).catch(() => null),
        fetch(`/api/cms/tenants/${tenantId}/analytics?fromDate=&toDate=`).catch(() => null),
      ]);

      if (!tenantRes.ok) throw new Error('Failed to load tenant');
      const tData = await tenantRes.json();
      if (tData.success) setTenant(tData.data);

      if (rsvpRes.ok) {
        const d = await rsvpRes.json();
        if (d.success && d.data.summary) setRsvpSummary(d.data.summary);
      }

      if (wishesRes.ok) {
        const d = await wishesRes.json();
        if (d.success && d.data.stats) {
          setWishSummary({ totalWishes: d.data.stats.total, hiddenWishes: d.data.stats.hidden });
        }
      }

      if (activityRes?.ok) {
        const d = await activityRes.json();
        if (d.success) setActivity(d.data.activities || []);
      }

      if (trendRes?.ok) {
        const d = await trendRes.json();
        if (d.success && d.data.wishesTimeline) {
          setWishesTrend(d.data.wishesTimeline);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenantId, authUser.token]);

  const daysUntilEvent = tenant?.eventDate
    ? differenceInDays(new Date(tenant.eventDate), new Date())
    : null;

  const funnelData = rsvpSummary
    ? [
        { name: 'Attending', value: rsvpSummary.attendingGuests, fill: COLORS.attending },
        { name: 'Partial', value: rsvpSummary.partialGuests, fill: COLORS.partial },
        { name: 'Declined', value: rsvpSummary.declinedGuests, fill: COLORS.declined },
      ]
    : [];

  const pieData = rsvpSummary
    ? [
        { name: 'Yes', value: rsvpSummary.attendingGuests },
        { name: 'Partial', value: rsvpSummary.partialGuests },
        { name: 'No', value: rsvpSummary.declinedGuests },
      ]
    : [];

  const pieColors = [COLORS.attending, COLORS.partial, COLORS.declined];

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-charcoal-ink">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Welcome back, {authUser.name?.split(' ')[0] || 'Admin'}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600 mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-xl font-semibold text-charcoal-ink">
          Welcome back, {authUser.name?.split(' ')[0] || 'Admin'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {tenant?.name || 'Your event'} &mdash; {daysUntilEvent !== null && daysUntilEvent > 0
            ? `${daysUntilEvent} days until the event`
            : tenant?.eventDate
              ? format(new Date(tenant.eventDate), 'MMM d, yyyy')
              : 'Event date not set'}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={UserCheck}
          label="Total RSVPs"
          value={rsvpSummary?.totalRsvps ?? '—'}
          subValue={rsvpSummary ? `${rsvpSummary.attendanceRate}% attendance` : undefined}
          loading={loading}
        />
        <StatCard
          icon={Users}
          label="Total Guests"
          value={rsvpSummary?.totalGuests ?? '—'}
          subValue={rsvpSummary ? `${rsvpSummary.attendingGuests} attending` : undefined}
          loading={loading}
        />
        <StatCard
          icon={Heart}
          label="Wishes Received"
          value={wishSummary?.totalWishes ?? '—'}
          subValue={wishSummary ? `${wishSummary.hiddenWishes} hidden` : undefined}
          loading={loading}
        />
        <StatCard
          icon={CalendarClock}
          label="Days Until Event"
          value={daysUntilEvent !== null ? daysUntilEvent : '—'}
          subValue={tenant?.eventDate ? format(new Date(tenant.eventDate), 'MMM d, yyyy') : 'No date set'}
          loading={loading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RSVP Funnel */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-charcoal-ink">RSVP Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : funnelData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={funnelData} barSize={48}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-sm text-gray-400">
                No RSVP data yet.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attendance Donut */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-charcoal-ink">Attendance Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : pieData.some((d) => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={pieColors[index]} />
                    ))}
                    <Label
                      content={<PIE_LABEL total={rsvpSummary?.totalGuests ?? 0} viewBox={undefined} />}
                      position="center"
                    />
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-sm text-gray-400">
                No attendance data yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Wishes Trend */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-charcoal-ink">Wishes Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[250px] w-full" />
          ) : wishesTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={wishesTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#C5A059"
                  fill="#C5A059"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-sm text-gray-400">
              No wishes data yet.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity Feed */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-charcoal-ink">Recent Activity</h2>
        </div>
        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center gap-4">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-3 w-20" />
              </div>
            ))
          ) : activity.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              No recent activity.
            </div>
          ) : (
            activity.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50/50 transition-colors"
              >
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    item.type === 'rsvp' ? 'bg-emerald-50' : 'bg-rose-50'
                  }`}
                >
                  {item.type === 'rsvp' ? (
                    <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Heart className="h-3.5 w-3.5 text-rose-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-charcoal-ink truncate">{item.name}</p>
                  <p className="text-xs text-gray-400">{item.action}</p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {item.createdAt
                    ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })
                    : '—'}
                </span>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// --- Main Dashboard ---

export default function CMSDashboard() {
  const authUser = useCMSStore((s) => s.authUser);
  const selectedTenantId = useCMSStore((s) => s.selectedTenantId);

  const effectiveTenantId = authUser?.tenantId || selectedTenantId;
  const isMasterAdmin = authUser?.role === 'master_admin';

  if (!authUser) return null;

  // Master admin with no selected tenant → master view
  if (isMasterAdmin && !effectiveTenantId) {
    return <MasterAdminView authUser={authUser} />;
  }

  // Tenant admin/editor OR master admin viewing a specific tenant → tenant view
  if (effectiveTenantId) {
    return <TenantDashboard tenantId={effectiveTenantId} authUser={authUser} />;
  }

  // Fallback for tenant users with no tenantId (shouldn't happen normally)
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-charcoal-ink">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">No tenant associated with your account.</p>
      </div>
    </div>
  );
}