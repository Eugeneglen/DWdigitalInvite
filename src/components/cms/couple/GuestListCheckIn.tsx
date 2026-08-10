'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2, Search, Crown, Baby, PersonStanding, UtensilsCrossed,
  CheckCircle2, XCircle, RotateCcw, ArrowLeft,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CHECKIN_API, GUEST_STATS_API, type GuestItem, type GuestStats,
  getCheckInStatusConfig, getEffectiveDietary,
} from './guest-types';

interface CheckInResult {
  id: string;
  name: string;
  chineseName: string | null;
  phone: string | null;
  side: string | null;
  tableNumber: number | null;
  dietaryNotes: string | null;
  isVip: boolean;
  isElderly: boolean;
  needsBabyChair: boolean;
  specialNotes: string | null;
  rsvpStatus: string;
  checkInStatus: string | null;
  groupName: string | null;
  relationship: string | null;
  invitedBy: string | null;
}

interface GuestListCheckInProps {
  onClose: () => void;
}

type Step = 'select-side' | 'search' | 'results';

export default function GuestListCheckIn({ onClose }: GuestListCheckInProps) {
  const [step, setStep] = useState<Step>('select-side');
  const [side, setSide] = useState<string>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [results, setResults] = useState<CheckInResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [stats, setStats] = useState<GuestStats | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(GUEST_STATS_API);
      if (res.ok) setStats(await res.json());
    } catch { /* silent */ }
  }, []);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Focus search input when entering search step
  useEffect(() => {
    if (step === 'search') {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [step]);

  // Debounce search
  useEffect(() => {
    if (step !== 'search') return;
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search, step]);

  // Search API
  const searchGuests = useCallback(async () => {
    if (!debouncedSearch) { setResults([]); return; }
    try {
      setLoading(true);
      const params = new URLSearchParams({
        side,
        search: debouncedSearch,
        rsvpOnly: 'true',
      });
      const res = await fetch(`${CHECKIN_API}&${params.toString()}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setResults((data.guests ?? []).slice(0, 5));
    } catch {
      toast({ title: 'Error', description: 'Search failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, side]);

  useEffect(() => {
    if (step === 'search') searchGuests();
  }, [step, searchGuests]);

  // Check-in action
  const handleAction = async (guestId: string, action: 'CHECK_IN' | 'UNDO' | 'NO_SHOW') => {
    try {
      setActionLoading(guestId);
      const res = await fetch(CHECKIN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId, action }),
      });
      if (!res.ok) throw new Error('Action failed');
      const { guest } = await res.json();
      // Update local state
      setResults((prev) =>
        prev.map((g) => (g.id === guestId ? { ...g, checkInStatus: guest.checkInStatus } : g))
      );
      fetchStats();
      if (action === 'CHECK_IN') toast({ title: 'Checked In', description: 'Guest has been checked in successfully' });
      else if (action === 'NO_SHOW') toast({ title: 'Marked No Show', description: 'Guest marked as no show' });
      else toast({ title: 'Undone', description: 'Check-in has been undone' });
    } catch {
      toast({ title: 'Error', description: 'Action failed', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const checkedIn = stats?.checkedIn ?? 0;
  const totalAttending = (stats?.attending ?? 0) + (stats?.partial ?? 0);

  // ---- Step 1: Side Selector ----
  if (step === 'select-side') {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-6">
        <h3 className="text-lg font-semibold text-charcoal-ink">Check-In Mode</h3>
        <p className="text-sm text-charcoal-ink/50 text-center">Select which side&apos;s guests to check in</p>
        <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
          <button
            onClick={() => { setSide('GROOM'); setStep('search'); }}
            className="flex flex-col items-center gap-2 py-8 rounded-xl border-2 border-charcoal-ink/10 text-charcoal-ink/70 hover:border-cinematic-gold hover:bg-cinematic-gold/5 transition-all duration-200 cursor-pointer"
          >
            <span className="text-4xl">🤵</span>
            <span className="font-semibold text-sm">Groom&apos;s Side</span>
          </button>
          <button
            onClick={() => { setSide('BRIDE'); setStep('search'); }}
            className="flex flex-col items-center gap-2 py-8 rounded-xl border-2 border-charcoal-ink/10 text-charcoal-ink/70 hover:border-cinematic-gold hover:bg-cinematic-gold/5 transition-all duration-200 cursor-pointer"
          >
            <span className="text-4xl">👰</span>
            <span className="font-semibold text-sm">Bride&apos;s Side</span>
          </button>
        </div>
        <Button variant="ghost" onClick={onClose} className="text-charcoal-ink/40 hover:text-charcoal-ink/70">
          Cancel
        </Button>
      </div>
    );
  }

  // ---- Step 2/3: Search & Results ----
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2 shrink-0">
        <button
          onClick={() => { setStep('select-side'); setSearch(''); setResults([]); }}
          className="p-1.5 rounded-md text-charcoal-ink/40 hover:text-charcoal-ink hover:bg-charcoal-ink/5 transition-colors cursor-pointer"
          title="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-charcoal-ink">
            {side === 'GROOM' ? '🤵 Groom' : '👰 Bride'} Check-In
          </h3>
          <p className="text-xs text-charcoal-ink/40">
            {checkedIn} checked in / {totalAttending} total attending
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {totalAttending > 0 && (
        <div className="px-4 pb-3 shrink-0">
          <div className="w-full h-2 rounded-full bg-charcoal-ink/5 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (checkedIn / totalAttending) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Search */}
      <div className="px-4 pb-3 shrink-0">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-charcoal-ink/25" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type guest name, Chinese name, or phone..."
            className="w-full pl-12 pr-4 py-4 text-lg border border-charcoal-ink/10 rounded-xl bg-white focus:border-cinematic-gold focus:ring-2 focus:ring-cinematic-gold/20 outline-none transition-all text-center placeholder:text-charcoal-ink/25 placeholder:text-base"
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="px-4 space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && debouncedSearch && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-charcoal-ink/30">
          <Search className="size-8 mb-2" />
          <p className="text-sm">No matching guests found</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-3 [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-champagne-silk/50 [&::-webkit-scrollbar-thumb]:rounded-full">
          {results.map((guest) => {
            const dietary = guest.dietaryNotes;
            const isCheckedIn = guest.checkInStatus === 'CHECKED_IN';
            const isNoShow = guest.checkInStatus === 'NO_SHOW';
            const statusCfg = getCheckInStatusConfig(guest.checkInStatus ?? '');

            return (
              <div
                key={guest.id}
                className={`rounded-xl border-2 p-4 transition-all duration-200 ${
                  isCheckedIn
                    ? 'border-emerald-300 bg-emerald-50/50'
                    : isNoShow
                      ? 'border-red-200 bg-red-50/50'
                      : 'border-champagne-silk/60 bg-white hover:border-cinematic-gold/40'
                }`}
              >
                {/* Name + status badge */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h4 className="text-lg font-bold text-charcoal-ink">{guest.name}</h4>
                    {guest.chineseName && (
                      <p className="text-sm text-charcoal-ink/50 mt-0.5">{guest.chineseName}</p>
                    )}
                  </div>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${statusCfg.color}`}>
                    {statusCfg.label}
                  </Badge>
                </div>

                {/* Table number - VERY PROMINENT */}
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex flex-col items-center justify-center bg-paper-cream rounded-lg px-5 py-2 min-w-[100px]">
                    <span className="text-3xl font-bold text-cinematic-gold">
                      {guest.tableNumber ?? '—'}
                    </span>
                    <span className="text-[10px] text-charcoal-ink/40 uppercase tracking-wider">Table</span>
                  </div>
                  <div className="text-sm text-charcoal-ink/60">
                    <p>1 seat</p>
                  </div>
                </div>

                {/* Special icons row */}
                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                  {guest.isVip && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-medium">
                      <Crown className="size-3" /> VIP
                    </span>
                  )}
                  {guest.isElderly && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[11px] font-medium">
                      <PersonStanding className="size-3" /> Elderly
                    </span>
                  )}
                  {guest.needsBabyChair && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-50 text-pink-600 text-[11px] font-medium">
                      <Baby className="size-3" /> Baby Chair
                    </span>
                  )}
                  {dietary && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 text-[11px] font-medium">
                      <UtensilsCrossed className="size-3" /> {dietary}
                    </span>
                  )}
                </div>

                {/* Special notes */}
                {guest.specialNotes && (
                  <p className="text-xs text-charcoal-ink/40 mb-3 italic">📝 {guest.specialNotes}</p>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  {isCheckedIn ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction(guest.id, 'UNDO')}
                      disabled={actionLoading === guest.id}
                      className="flex-1 border-charcoal-ink/15 text-charcoal-ink/60 hover:border-amber-400 hover:text-amber-600 h-10"
                    >
                      {actionLoading === guest.id ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4 mr-1" />}
                      Undo Check-In
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleAction(guest.id, 'CHECK_IN')}
                      disabled={actionLoading === guest.id}
                      className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700 h-10 font-semibold"
                    >
                      {actionLoading === guest.id ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4 mr-1" />}
                      Check In
                    </Button>
                  )}
                  {!isCheckedIn && !isNoShow && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction(guest.id, 'NO_SHOW')}
                      disabled={actionLoading === guest.id}
                      className="border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 h-10"
                    >
                      <XCircle className="size-4 mr-1" />
                      No Show
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom counter */}
      <div className="px-4 py-3 border-t border-champagne-silk/40 bg-white shrink-0 text-center">
        <p className="text-xs text-charcoal-ink/40">
          <strong className="text-emerald-600">{checkedIn}</strong> checked in / {totalAttending} total attending
        </p>
      </div>
    </div>
  );
}
