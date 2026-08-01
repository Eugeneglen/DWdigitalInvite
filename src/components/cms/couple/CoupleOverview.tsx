'use client';

import React, { useEffect, useState } from 'react';
import {
  Loader2,
  CalendarDays,
  Mail,
  MessageSquareHeart,
  CheckCircle2,
  Circle,
  Check,
  X,
  BarChart3,
  Utensils,
  AlertCircle,
  UserCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useCoupleCMSStore, type CoupleCMSPage } from '@/store/useCoupleCMSStore';

// ── Types ──────────────────────────────────────────────────────────────────

interface OverviewData {
  daysUntil: number;
  isPast: boolean;
  weddingDate: string;
  coupleName: string;
  venue: string;
  status: string;
  guests: {
    total: number;
    byStatus: { PENDING: number; ATTENDING: number; DECLINED: number; PARTIAL: number };
    responded: number;
    attendanceRate: number;
    groups: Array<{ name: string; count: number }>;
    totalWithPlusOne: number;
  };
  rsvps: { total: number };
  wishes: { total: number };
  contacts: { total: number };
  content: { completion: number; filledSections: number; totalSections: number };
  checklist: {
    items: Array<{ key: string; label: string; done: boolean }>;
    completed: number;
    total: number;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    entity: string;
    details: string;
    createdAt: string;
    userName: string;
  }>;
  media: { total: number };
  // ── Phase 1 new fields (additive) ───────────────────────────────────
  guestListConfidence?: 'EMPTY' | 'INCOMPLETE' | 'RELIABLE';
  unmatchedRsvps?: number;
  confirmedHeadcount?: number;
  confirmedPlusOnes?: number;
  dietaryCount?: number;
  pendingFollowUps?: number;
  newWishesThisWeek?: number;
  rsvpDeadline?: string | null;
  recentGuestActivity?: Array<{
    id: string;
    type: 'rsvp' | 'wish';
    name: string;
    action: string;
    createdAt: string;
  }>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const API_URL = '/api/cms/overview?XTransformPort=3000';

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hr ago`;
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

const CHECKLIST_PAGE_MAP: Record<string, CoupleCMSPage> = {
  details: 'details',
  hero_image: 'images',
  banner_image: 'images',
  schedule: 'schedule',
  story: 'story',
  faqs: 'faqs',
  gallery: 'images',
  guests: 'guests',
  content: 'content',
  features: 'features',
};

const ACTION_STYLES: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  UPDATE: 'bg-sky-100 text-sky-700 border-sky-200',
  DELETE: 'bg-red-100 text-red-700 border-red-200',
};

function getActionStyle(action: string): string {
  return ACTION_STYLES[action] ?? 'bg-gray-100 text-gray-600 border-gray-200';
}

const CONTENT_SECTION_LABELS = [
  { key: 'hero', label: 'Hero' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'story', label: 'Story' },
  { key: 'rsvp', label: 'RSVP' },
  { key: 'getting-there', label: 'Getting There' },
  { key: 'qa', label: 'Q&A' },
  { key: 'wishes', label: 'Wishes' },
  { key: 'moments', label: 'Moments' },
  { key: 'footer', label: 'Footer' },
];

// ── Phase 2: Alert system ────────────────────────────────────────────────
// Alerts are conditional banners that appear only when action is needed.
// Dismissed alerts are stored in localStorage and reappear after 7 days
// (per user decision). Maximum 3 alerts shown at once, by priority.

const ALERT_DISMISSAL_DAYS = 7; // Reappear after 7 days

interface OverviewAlert {
  id: string;
  severity: 'red' | 'amber' | 'green' | 'blue';
  title: string;
  message: string;
  actionLabel?: string;
  actionPage?: CoupleCMSPage;
}

const ALERT_SEVERITY_STYLES: Record<string, { border: string; bg: string; icon: string; iconBg: string }> = {
  red: { border: 'border-red-200', bg: 'bg-red-50/60', icon: 'text-red-500', iconBg: 'bg-red-100' },
  amber: { border: 'border-amber-200', bg: 'bg-amber-50/60', icon: 'text-amber-500', iconBg: 'bg-amber-100' },
  green: { border: 'border-emerald-200', bg: 'bg-emerald-50/60', icon: 'text-emerald-500', iconBg: 'bg-emerald-100' },
  blue: { border: 'border-sky-200', bg: 'bg-sky-50/60', icon: 'text-sky-500', iconBg: 'bg-sky-100' },
};

function getDismissedAlerts(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('dw-dismissed-alerts');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function isAlertDismissed(alertId: string): boolean {
  const dismissed = getDismissedAlerts();
  const dismissedAt = dismissed[alertId];
  if (!dismissedAt) return false;
  const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return daysSince < ALERT_DISMISSAL_DAYS;
}

function dismissAlert(alertId: string) {
  const dismissed = getDismissedAlerts();
  dismissed[alertId] = Date.now();
  try {
    localStorage.setItem('dw-dismissed-alerts', JSON.stringify(dismissed));
  } catch {
    // localStorage might be unavailable (private browsing) — silently skip
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function CoupleOverview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alertRefreshKey, setAlertRefreshKey] = useState(0);
  const { setPage } = useCoupleCMSStore();

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(API_URL);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Request failed (${res.status})`);
        }
        const json = await res.json();
        setData(json as OverviewData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load overview');
      } finally {
        setLoading(false);
      }
    };
    fetchOverview();
  }, []);

  // ── Loading State ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="size-8 animate-spin text-cinematic-gold" />
        <p className="text-sm text-charcoal-ink/50 font-medium">Loading your workspace…</p>
      </div>
    );
  }

  // ── Error State ────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardContent className="py-8 text-center">
          <p className="text-sm text-red-600 font-medium">{error ?? 'No data available'}</p>
        </CardContent>
      </Card>
    );
  }

  // ── Derived Values ─────────────────────────────────────────────────────
  const { daysUntil, isPast, coupleName, guests, rsvps, wishes, content, checklist, recentActivity } = data;

  // Phase 1: mode-aware KPIs
  const confidence = data.guestListConfidence ?? 'RELIABLE';
  const isReliable = confidence === 'RELIABLE';
  const confirmedHeadcount = data.confirmedHeadcount ?? 0;
  const confirmedPlusOnes = data.confirmedPlusOnes ?? 0;
  const dietaryCount = data.dietaryCount ?? 0;
  const pendingFollowUps = data.pendingFollowUps ?? 0;
  const newWishesThisWeek = data.newWishesThisWeek ?? 0;
  const unmatchedRsvps = data.unmatchedRsvps ?? 0;

  // Split coupleName into bride & groom
  const nameParts = coupleName.split(/[\s&]+/).filter(Boolean);
  const brideName = nameParts[0] ?? '';
  const groomName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

  const responseRate =
    guests.total > 0 ? Math.round((guests.responded / guests.total) * 100) : 0;

  // ── Phase 2: Build alerts list ───────────────────────────────────────
  // Priority order: deadline > dietary > unmatched > partial > new wishes
  // Maximum 3 alerts shown. Dismissed alerts reappear after 7 days.
  // alertRefreshKey forces re-evaluation when an alert is dismissed.
  const rsvpDeadlineStr = data.rsvpDeadline || null;
  const partialCount = guests.byStatus.PARTIAL || 0;

  const allAlerts: OverviewAlert[] = [];

  // Alert 1: RSVP deadline approaching (within 14 days)
  if (rsvpDeadlineStr && !isPast) {
    const deadlineDate = new Date(rsvpDeadlineStr);
    if (!isNaN(deadlineDate.getTime())) {
      const daysToDeadline = Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysToDeadline <= 14 && daysToDeadline >= 0) {
        allAlerts.push({
          id: 'rsvp-deadline',
          severity: 'red',
          title: daysToDeadline === 0 ? 'RSVP deadline is today!' : `RSVP deadline in ${daysToDeadline} day${daysToDeadline !== 1 ? 's' : ''}`,
          message: pendingFollowUps > 0
            ? `${pendingFollowUps} guest${pendingFollowUps !== 1 ? 's' : ''} still haven't responded. Send reminders now.`
            : 'All guests have responded. You\'re all set!',
          actionLabel: pendingFollowUps > 0 ? 'View Guests' : undefined,
          actionPage: pendingFollowUps > 0 ? 'guests' : undefined,
        });
      }
    }
  }

  // Alert 2: Dietary review needed
  if (dietaryCount > 0) {
    allAlerts.push({
      id: 'dietary-review',
      severity: 'amber',
      title: `${dietaryCount} guest${dietaryCount !== 1 ? 's' : ''} with special dietary requirements`,
      message: 'Review the dietary list and share it with your venue or caterer.',
      actionLabel: 'View Guests',
      actionPage: 'guests',
    });
  }

  // Alert 3: Unmatched RSVPs (only in RELIABLE mode — in EMPTY/INCOMPLETE mode,
  // the confidence prompt already mentions unmatched RSVPs)
  if (isReliable && unmatchedRsvps > 0) {
    allAlerts.push({
      id: 'unmatched-rsvps',
      severity: 'amber',
      title: `${unmatchedRsvps} unmatched RSVP${unmatchedRsvps !== 1 ? 's' : ''}`,
      message: 'Some guests RSVPed who aren\'t on your list. Match them to existing guests or add as new.',
      actionLabel: 'View Guests',
      actionPage: 'guests',
    });
  }

  // Alert 4: Partial responses need clarification
  if (partialCount > 0) {
    allAlerts.push({
      id: 'partial-responses',
      severity: 'amber',
      title: `${partialCount} guest${partialCount !== 1 ? 's' : ''} with partial RSVP`,
      message: 'These guests are attending some events but not others. Contact them to clarify.',
      actionLabel: 'View Guests',
      actionPage: 'guests',
    });
  }

  // Alert 5: New wishes this week
  if (newWishesThisWeek > 0) {
    allAlerts.push({
      id: 'new-wishes',
      severity: 'green',
      title: `${newWishesThisWeek} new wish${newWishesThisWeek !== 1 ? 's' : ''} this week`,
      message: 'Take a moment to read the blessings from your guests.',
      actionLabel: 'Read Wishes',
      actionPage: 'wishes',
    });
  }

  // Filter out dismissed alerts, take max 3
  // alertRefreshKey forces re-evaluation of isAlertDismissed when an alert is dismissed
  void alertRefreshKey; // referenced to trigger re-render on dismiss
  const visibleAlerts = allAlerts
    .filter(a => !isAlertDismissed(a.id))
    .slice(0, 3);

  // Figure out which content sections are filled
  // The API doesn't tell us which sections are filled individually, so we show the overall completion
  // and infer section status from filledSections count (ordered by common priority)
  const filledSectionKeys = CONTENT_SECTION_LABELS.slice(0, content.filledSections).map((s) => s.key);

  const activityItems = recentActivity.slice(0, 8);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* 1. Welcome Message */}
      <div className="text-center py-4">
        <p className="text-2xl sm:text-3xl font-semibold text-charcoal-ink tracking-tight">
          Welcome, {brideName}{groomName ? ` & ${groomName}` : ''}!
        </p>
        <p className="text-sm text-charcoal-ink/50 mt-2">
          {isPast
            ? 'Your big day has passed!'
            : `${daysUntil} day${daysUntil !== 1 ? 's' : ''} until your big day`}
        </p>
      </div>

      {/* 2. Guest list confidence prompt (only for EMPTY/INCOMPLETE) */}
      {!isReliable && (
        <Card className={`border ${confidence === 'EMPTY' ? 'border-sky-200 bg-sky-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className={`size-5 shrink-0 mt-0.5 ${confidence === 'EMPTY' ? 'text-sky-500' : 'text-amber-500'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-charcoal-ink">
                {confidence === 'EMPTY'
                  ? 'Add your guest list to track RSVPs'
                  : 'Your guest list may be incomplete'}
              </p>
              <p className="text-xs text-charcoal-ink/50 mt-1">
                {confidence === 'EMPTY'
                  ? rsvps.total > 0
                    ? `You've received ${rsvps.total} RSVP${rsvps.total !== 1 ? 's' : ''}. Add your full guest list to track response rate and follow up with non-responders.`
                    : 'Add your full guest list to track RSVP response rate, send reminders, and manage dietary requirements.'
                  : unmatchedRsvps > 0
                    ? `${unmatchedRsvps} guest${unmatchedRsvps !== 1 ? 's' : ''} RSVPed who aren't on your list. Review and add them to track accurately.`
                    : 'Your guest list has fewer than 10 guests. Add more to get accurate response rate tracking.'}
              </p>
              <button
                type="button"
                onClick={() => setPage('guests')}
                className="text-xs font-semibold text-cinematic-gold hover:text-cinematic-gold/80 mt-2 transition-colors"
              >
                Go to Guest List →
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 2b. Alerts — conditional banners (max 3, dismissible, reappear after 7 days) */}
      {visibleAlerts.length > 0 && (
        <div className="space-y-3">
          {visibleAlerts.map((alert) => {
            const style = ALERT_SEVERITY_STYLES[alert.severity] ?? ALERT_SEVERITY_STYLES.amber;
            return (
              <Card key={alert.id} className={`border ${style.border} ${style.bg} shadow-none`}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className={`flex items-center justify-center size-8 rounded-full shrink-0 ${style.iconBg}`}>
                    <AlertCircle className={`size-4 ${style.icon}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-charcoal-ink">
                      {alert.title}
                    </p>
                    <p className="text-xs text-charcoal-ink/60 mt-0.5">
                      {alert.message}
                    </p>
                    {alert.actionLabel && alert.actionPage && (
                      <button
                        type="button"
                        onClick={() => setPage(alert.actionPage!)}
                        className="text-xs font-semibold text-cinematic-gold hover:text-cinematic-gold/80 mt-2 transition-colors"
                      >
                        {alert.actionLabel} →
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      dismissAlert(alert.id);
                      setAlertRefreshKey(k => k + 1);
                    }}
                    className="text-charcoal-ink/30 hover:text-charcoal-ink/60 transition-colors shrink-0"
                    title="Dismiss (will reappear in 7 days)"
                    aria-label="Dismiss alert"
                  >
                    <X className="size-4" />
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 3. Snapshot KPIs — 6 cards, mode-aware (2x3 on mobile, 3x2 on md+) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* KPI 1: Days until wedding (both modes) */}
        <Card className="py-0">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-cinematic-gold/10 text-cinematic-gold shrink-0">
              <CalendarDays className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-charcoal-ink/40">
                Days Left
              </p>
              <p className="text-xl font-bold text-cinematic-gold leading-tight">
                {isPast ? '—' : daysUntil}
              </p>
              {!isPast && (
                <p className="text-[11px] text-charcoal-ink/40">days</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Mode-aware — Confirmed headcount (RELIABLE) or RSVPs received (EMPTY/INCOMPLETE) */}
        {isReliable ? (
          <Card className="py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                <UserCheck className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-charcoal-ink/40">
                  Confirmed Headcount
                </p>
                <p className="text-xl font-bold text-charcoal-ink leading-tight">
                  {confirmedHeadcount}
                </p>
                {confirmedPlusOnes > 0 && (
                  <p className="text-[11px] text-charcoal-ink/40">
                    incl. {confirmedPlusOnes} plus-one{confirmedPlusOnes !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-cinematic-gold/10 text-cinematic-gold shrink-0">
                <Mail className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-charcoal-ink/40">
                  RSVPs Received
                </p>
                <p className="text-xl font-bold text-charcoal-ink leading-tight">
                  {rsvps.total}
                </p>
                <p className="text-[11px] text-charcoal-ink/40">
                  {confirmedHeadcount > 0 ? `${confirmedHeadcount} attending` : 'submissions'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI 3: Mode-aware — Response rate (RELIABLE) or Declined (EMPTY/INCOMPLETE) */}
        {isReliable ? (
          <Card className="py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-cinematic-gold/10 text-cinematic-gold shrink-0">
                <BarChart3 className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-charcoal-ink/40">
                  Response Rate
                </p>
                <p className="text-xl font-bold text-charcoal-ink leading-tight">
                  {responseRate}%
                </p>
                <p className="text-[11px] text-charcoal-ink/40">
                  {guests.responded} of {guests.total} responded
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="py-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-red-50 text-red-500 shrink-0">
                <X className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-charcoal-ink/40">
                  Declined
                </p>
                <p className="text-xl font-bold text-charcoal-ink leading-tight">
                  {guests.byStatus.DECLINED || 0}
                </p>
                <p className="text-[11px] text-charcoal-ink/40">
                  {rsvps.total > 0 ? `of ${rsvps.total} RSVPs` : 'guests'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI 4: Mode-aware — Pending follow-ups (RELIABLE) or Unmatched RSVPs (EMPTY/INCOMPLETE) */}
        {isReliable ? (
          <Card
            className="py-0 cursor-pointer hover:border-cinematic-gold/30 transition-colors"
            onClick={() => setPage('guests')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`flex items-center justify-center h-10 w-10 rounded-lg shrink-0 ${pendingFollowUps > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                <Mail className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-charcoal-ink/40">
                  Pending Follow-ups
                </p>
                <p className="text-xl font-bold text-charcoal-ink leading-tight">
                  {pendingFollowUps}
                </p>
                <p className="text-[11px] text-charcoal-ink/40">
                  {pendingFollowUps === 0 ? 'all responded!' : 'need reminders'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card
            className={`py-0 ${unmatchedRsvps > 0 ? 'cursor-pointer hover:border-amber-300 transition-colors' : ''}`}
            onClick={() => unmatchedRsvps > 0 && setPage('guests')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`flex items-center justify-center h-10 w-10 rounded-lg shrink-0 ${unmatchedRsvps > 0 ? 'bg-amber-50 text-amber-600' : 'bg-cinematic-gold/10 text-cinematic-gold'}`}>
                <AlertCircle className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-charcoal-ink/40">
                  Unmatched RSVPs
                </p>
                <p className="text-xl font-bold text-charcoal-ink leading-tight">
                  {unmatchedRsvps}
                </p>
                <p className="text-[11px] text-charcoal-ink/40">
                  {unmatchedRsvps === 0 ? 'all matched' : 'not on your list'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI 5: Dietary requirements (both modes) */}
        <Card className="py-0">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`flex items-center justify-center h-10 w-10 rounded-lg shrink-0 ${dietaryCount > 0 ? 'bg-violet-50 text-violet-600' : 'bg-cinematic-gold/10 text-cinematic-gold'}`}>
              <Utensils className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-charcoal-ink/40">
                Dietary Reqs
              </p>
              <p className="text-xl font-bold text-charcoal-ink leading-tight">
                {dietaryCount}
              </p>
              <p className="text-[11px] text-charcoal-ink/40">
                {dietaryCount === 0 ? 'none noted' : 'special needs'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* KPI 6: New wishes this week (both modes) */}
        <Card className="py-0">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`flex items-center justify-center h-10 w-10 rounded-lg shrink-0 ${newWishesThisWeek > 0 ? 'bg-rose-50 text-rose-500' : 'bg-cinematic-gold/10 text-cinematic-gold'}`}>
              <MessageSquareHeart className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-charcoal-ink/40">
                New Wishes
              </p>
              <p className="text-xl font-bold text-charcoal-ink leading-tight">
                {newWishesThisWeek}
              </p>
              <p className="text-[11px] text-charcoal-ink/40">
                {newWishesThisWeek === 0 ? `${wishes.total} total` : 'this week'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Two-column: RSVP Progress + Setup Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: RSVP Progress Card */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-semibold text-charcoal-ink">
              Guest Response Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {guests.total === 0 ? (
              <p className="text-sm text-charcoal-ink/40 py-4 text-center">
                Add guests to track responses
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-charcoal-ink/50">
                    <span>Attendance Rate</span>
                    <span className="font-semibold text-charcoal-ink">{guests.attendanceRate}%</span>
                  </div>
                  <Progress
                    value={guests.attendanceRate}
                    className="h-2 [&>[data-slot=progress-indicator]]:bg-cinematic-gold"
                  />
                </div>

                {/* Mini stats row */}
                <div className="grid grid-cols-4 gap-2 pt-2">
                  <div className="text-center space-y-1">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="size-2 rounded-full bg-amber-400 shrink-0" />
                      <span className="text-xs font-semibold text-charcoal-ink">
                        {guests.byStatus.PENDING}
                      </span>
                    </div>
                    <p className="text-[10px] text-charcoal-ink/40 uppercase tracking-wider">Pending</p>
                  </div>
                  <div className="text-center space-y-1">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-xs font-semibold text-charcoal-ink">
                        {guests.byStatus.ATTENDING}
                      </span>
                    </div>
                    <p className="text-[10px] text-charcoal-ink/40 uppercase tracking-wider">Attending</p>
                  </div>
                  <div className="text-center space-y-1">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="size-2 rounded-full bg-red-400 shrink-0" />
                      <span className="text-xs font-semibold text-charcoal-ink">
                        {guests.byStatus.DECLINED}
                      </span>
                    </div>
                    <p className="text-[10px] text-charcoal-ink/40 uppercase tracking-wider">Declined</p>
                  </div>
                  <div className="text-center space-y-1">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="size-2 rounded-full bg-sky-400 shrink-0" />
                      <span className="text-xs font-semibold text-charcoal-ink">
                        {guests.byStatus.PARTIAL}
                      </span>
                    </div>
                    <p className="text-[10px] text-charcoal-ink/40 uppercase tracking-wider">Partial</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* RIGHT: Setup Checklist Card */}
        <Card>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-charcoal-ink">
                Setup Checklist
              </CardTitle>
              <Badge variant="outline" className="text-[10px] border-cinematic-gold/30 text-cinematic-gold">
                {checklist.completed}/{checklist.total} completed
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {checklist.items.map((item) => {
                const targetPage = CHECKLIST_PAGE_MAP[item.key];
                const isDone = item.done;

                return (
                  <li key={item.key}>
                    {isDone || !targetPage ? (
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                        <span className="text-sm text-charcoal-ink">{item.label}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPage(targetPage)}
                        className="flex items-center gap-3 w-full text-left group cursor-pointer"
                      >
                        <Circle className="size-4 text-charcoal-ink/25 shrink-0 group-hover:text-cinematic-gold transition-colors" />
                        <span className="text-sm text-charcoal-ink/50 group-hover:text-charcoal-ink transition-colors">
                          {item.label}
                        </span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* 4. Content Completion Card (full width) */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-semibold text-charcoal-ink">
            Content Sections
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-charcoal-ink/50">
              <span>Completion</span>
              <span className="font-semibold text-charcoal-ink">
                {content.filledSections} of {content.totalSections} sections filled
              </span>
            </div>
            <Progress
              value={content.completion}
              className="h-2 [&>[data-slot=progress-indicator]]:bg-cinematic-gold"
            />
          </div>

          {/* Section labels with check/x icons */}
          <div className="flex flex-wrap gap-2">
            {CONTENT_SECTION_LABELS.map((section) => {
              const isFilled = filledSectionKeys.includes(section.key);
              return (
                <div
                  key={section.key}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                    isFilled
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-charcoal-ink/10 bg-gray-50 text-charcoal-ink/40'
                  }`}
                >
                  {isFilled ? (
                    <Check className="size-3" />
                  ) : (
                    <X className="size-3" />
                  )}
                  {section.label}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 5. Recent Activity Card (full width) */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-semibold text-charcoal-ink">
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activityItems.length === 0 ? (
            <p className="text-sm text-charcoal-ink/40 py-4 text-center">
              No recent activity yet
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-0">
              {activityItems.map((item, idx) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 py-3 ${
                    idx < activityItems.length - 1 ? 'border-b border-charcoal-ink/5' : ''
                  }`}
                >
                  {/* Action badge */}
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-[10px] mt-0.5 ${getActionStyle(item.action)}`}
                  >
                    {item.action}
                  </Badge>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-charcoal-ink truncate">
                        {item.entity}
                      </span>
                      {item.details && (
                        <>
                          <span className="text-charcoal-ink/20 text-xs">·</span>
                          <span className="text-sm text-charcoal-ink/50 truncate">
                            {item.details}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-charcoal-ink/35 mt-0.5">
                      {item.userName} · {formatTimeAgo(item.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}