'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Heart, Users, Loader2, MapPin,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// ── Types ──────────────────────────────────────────────────────

interface HoneymoonAnalytics {
  totalVotes: number;
  uniqueVoters: number;
  ranking: Array<{
    rank: number;
    destination: string;
    votes: number;
    percentage: number;
  }>;
  chartData: Array<{ name: string; value: number }>;
  topSuggestions: Array<{ name: string; count: number }>;
}

// ── Chart Colors ───────────────────────────────────────────────

const VOTE_COLORS = [
  '#D4AF37', // cinematic-gold
  '#10b981', // emerald
  '#38bdf8', // sky
  '#f59e0b', // amber
  '#a78bfa', // violet
  '#f87171', // red
  '#2dd4bf', // teal
  '#fb923c', // orange
];

// ── Custom Tooltip ─────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload?: { fill: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-lg border border-charcoal-ink/10 bg-white px-3 py-2 shadow-sm text-xs">
      <p className="font-semibold text-charcoal-ink">{d.name}</p>
      <p className="text-charcoal-ink/60">
        {d.value} vote{d.value !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3">
      <div className="flex size-12 items-center justify-center rounded-full bg-cinematic-gold/10">
        <Heart className="size-5 text-cinematic-gold" />
      </div>
      <p className="text-sm font-medium text-charcoal-ink/50">
        No honeymoon votes yet.
      </p>
      <p className="text-xs text-charcoal-ink/30 max-w-[280px] text-center">
        Share your invitation to start collecting votes.
      </p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────

export default function HoneymoonVoteAnalytics() {
  const [data, setData] = useState<HoneymoonAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchVotes = useCallback(async () => {
    try {
      const res = await fetch('/api/cms/honeymoon-analytics?XTransformPort=3000');
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } catch {
      // silently retry on next poll
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVotes();
    // Poll every 15s for live updates
    const interval = setInterval(fetchVotes, 15_000);
    return () => clearInterval(interval);
  }, [fetchVotes]);

  if (loading) {
    return (
      <Card className="border-charcoal-ink/5 rounded-xl bg-white shadow-none">
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
          </div>
          <Skeleton className="h-[200px] w-full rounded-lg" />
          <Skeleton className="h-[120px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const hasVotes = data && data.totalVotes > 0;

  return (
    <Card className="border-charcoal-ink/5 rounded-xl bg-white shadow-none">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-charcoal-ink">
            After the &ldquo;I Do&rdquo; — Live Voting
          </CardTitle>
          {data && (
            <span className="text-[10px] text-charcoal-ink/30 uppercase tracking-wider">
              Auto-refreshes
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasVotes ? (
          <EmptyState />
        ) : (
          <div className="space-y-5">
            {/* ── Summary Cards ──────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-cinematic-gold/20 bg-cinematic-gold/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-charcoal-ink/40">
                    Total Votes
                  </p>
                  <Heart className="size-3.5 text-cinematic-gold" />
                </div>
                <p className="mt-1.5 text-2xl font-bold text-charcoal-ink">
                  {data.totalVotes}
                </p>
              </div>
              <div className="rounded-lg border border-charcoal-ink/5 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-charcoal-ink/40">
                    Unique Voters
                  </p>
                  <Users className="size-3.5 text-charcoal-ink/30" />
                </div>
                <p className="mt-1.5 text-2xl font-bold text-charcoal-ink">
                  {data.uniqueVoters}
                </p>
              </div>
            </div>

            {/* ── Vote Chart (Donut) ──────────────────── */}
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-charcoal-ink/40 mb-2">
                Vote Distribution
              </p>
              {data.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={data.chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {data.chartData.map((_entry, i) => (
                        <Cell
                          key={data.chartData[i].name}
                          fill={VOTE_COLORS[i % VOTE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : null}
            </div>

            {/* ── Ranking Table ───────────────────────── */}
            {data.ranking.length > 0 && (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-charcoal-ink/40 mb-2">
                  Destination Rankings
                </p>
                <div className="max-h-60 overflow-x-auto overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-champagne-silk">
                        <th className="text-left py-2 pr-3 text-[11px] font-medium text-charcoal-ink/40 uppercase tracking-wider">
                          Rank
                        </th>
                        <th className="text-left py-2 px-3 text-[11px] font-medium text-charcoal-ink/40 uppercase tracking-wider">
                          Destination
                        </th>
                        <th className="text-right py-2 px-3 text-[11px] font-medium text-charcoal-ink/40 uppercase tracking-wider">
                          Votes
                        </th>
                        <th className="text-right py-2 pl-3 text-[11px] font-medium text-charcoal-ink/40 uppercase tracking-wider">
                          %
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-champagne-silk/50">
                      {data.ranking.map((row) => (
                        <tr
                          key={row.destination}
                          className="hover:bg-cinematic-gold/[0.03] transition-colors"
                        >
                          <td className="py-2.5 pr-3">
                            <span
                              className={`inline-flex size-6 items-center justify-center rounded-full text-[11px] font-bold ${
                                row.rank === 1
                                  ? 'bg-cinematic-gold text-white'
                                  : 'bg-charcoal-ink/5 text-charcoal-ink/40'
                              }`}
                            >
                              {row.rank}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-xs font-medium text-charcoal-ink">
                            {row.destination}
                          </td>
                          <td className="py-2.5 px-3 text-right text-xs text-charcoal-ink/70">
                            {row.votes}
                          </td>
                          <td className="py-2.5 pl-3 text-right">
                            <span
                              className={`text-xs font-semibold ${
                                row.rank === 1
                                  ? 'text-cinematic-gold'
                                  : 'text-charcoal-ink/40'
                              }`}
                            >
                              {row.percentage}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Top 5 Suggestions ────────────────────── */}
            {data.topSuggestions.length > 0 && (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-charcoal-ink/40 mb-2">
                  Top 5 Other Suggestions
                </p>
                <div className="space-y-2">
                  {data.topSuggestions.map((s, i) => (
                    <div
                      key={s.name}
                      className="flex items-center justify-between rounded-lg border border-charcoal-ink/5 px-3.5 py-2.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <MapPin className="size-3.5 text-charcoal-ink/25" />
                        <span className="text-xs font-medium text-charcoal-ink">
                          {s.name}
                        </span>
                      </div>
                      <span className="text-xs text-charcoal-ink/40">
                        {s.count} {s.count === 1 ? 'suggestion' : 'suggestions'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
