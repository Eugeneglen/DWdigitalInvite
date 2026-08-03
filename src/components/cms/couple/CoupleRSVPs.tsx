'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, Mail, Search, CheckCircle, XCircle, MinusCircle, Download, Link2, UserPlus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import SectionContentFields, { type ContentField } from './SectionContentFields';

const API_BASE = '/api/cms/rsvps?XTransformPort=3000';

const RSVP_CONTENT_FIELDS: ContentField[] = [
  { key: 'deadline', label: 'RSVP Deadline', type: 'text', placeholder: 'e.g. 2027-11-01' },
  { key: 'thankYouMessage', label: 'Thank You Message', type: 'textarea', placeholder: 'Message shown after RSVP submission...' },
  { key: 'declinedMessage', label: 'Declined Message', type: 'textarea', placeholder: 'Message shown when guest declines...' },
  { key: 'ceremonyName', label: 'Ceremony Name', type: 'text', placeholder: 'e.g. Wedding Solemnisation, Wedding Reception' },
  { key: 'optYes', label: '"Yes" Option Label', type: 'text', placeholder: 'e.g. Yes!' },
  { key: 'optPartial', label: '"Partial" Option Label', type: 'text', placeholder: "e.g. Yes, but I won't be staying for the reception" },
  { key: 'optNo', label: '"No" Option Label', type: 'text', placeholder: "e.g. I'm sorry, I won't be able to make it" },
  { key: 'dietaryOptions', label: 'Dietary Options', type: 'text', placeholder: 'Comma-separated: Halal, Vegetarian, No Seafood, Vegan' },
  { key: 'step0Title', label: 'Step 1 Title', type: 'text', placeholder: 'e.g. Enter your name to RSVP' },
  { key: 'step0Subtext', label: 'Step 1 Subtitle', type: 'text', placeholder: 'e.g. You can respond for more guests in the following steps.' },
  { key: 'step1Title', label: 'Step 2 Title', type: 'text', placeholder: 'e.g. How many people are in your party?' },
  { key: 'step2Title', label: 'Step 3 Title', type: 'text', placeholder: 'e.g. Confirm each guest and their dietary needs.' },
  { key: 'step2Subtext', label: 'Step 3 Subtitle', type: 'text', placeholder: 'e.g. Dietary selections are optional.' },
  { key: 'resultThankYou', label: 'Thank You Title', type: 'text', placeholder: 'e.g. Thank you' },
  { key: 'resultWeMissYou', label: 'Declined Title', type: 'text', placeholder: "e.g. We'll Miss You" },
];

interface GuestResponse {
  id: string;
  name: string;
  attendance: string;
  dietary: string | null;
}

interface LinkedGuest {
  id: string;
  name: string;
  invitationCode: string;
  groupName: string | null;
  tableNumber: number | null;
}

interface RSVPItem {
  id: string;
  firstName: string;
  lastName: string;
  partySize: number;
  createdAt: string;
  guests: GuestResponse[];
  guestId: string | null;
  guest: LinkedGuest | null;
}

function computeStatus(guests: GuestResponse[]): { label: string; color: string; icon: React.ElementType } {
  if (guests.length === 0) return { label: 'Unknown', color: 'bg-gray-50 text-gray-600 border-gray-200', icon: MinusCircle };
  const allYes = guests.every((g) => g.attendance === 'yes');
  const allNo = guests.every((g) => g.attendance === 'no');
  if (allYes) return { label: 'All Attending', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle };
  if (allNo) return { label: 'All Declined', color: 'bg-red-50 text-red-600 border-red-200', icon: XCircle };
  return { label: 'Mixed', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: MinusCircle };
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-SG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export default function CoupleRSVPs() {
  const [rsvps, setRsvps] = useState<RSVPItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [linking, setLinking] = useState<string | null>(null); // tracks which RSVP is being processed

  const fetchRSVPs = useCallback(async () => {
    try {
      setLoading(true);
      let url = API_BASE;
      if (statusFilter !== 'all') url += `&status=${statusFilter}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load RSVPs');
      const data = await res.json();
      let items: RSVPItem[] = data.rsvps ?? [];

      // Client-side search
      if (search) {
        const q = search.toLowerCase();
        items = items.filter(
          (r) =>
            r.firstName.toLowerCase().includes(q) ||
            r.lastName.toLowerCase().includes(q) ||
            r.guests.some((g) => g.name.toLowerCase().includes(q))
        );
      }

      setRsvps(items);
      setTotal(data.total ?? 0);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchRSVPs();
  }, [fetchRSVPs]);

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const res = await fetch('/api/cms/export?XTransformPort=3000&type=rsvps');
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rsvps-export.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Success', description: 'Export downloaded' });
    } catch {
      toast({ title: 'Error', description: 'Export failed', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  // Create a new Guest record from an unmatched RSVP submission
  const handleCreateGuest = async (rsvpId: string) => {
    try {
      setLinking(rsvpId);
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rsvpId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create guest');
      }
      toast({ title: 'Success', description: 'Guest created from RSVP' });
      fetchRSVPs(); // refresh the list
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to create guest',
        variant: 'destructive',
      });
    } finally {
      setLinking(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="size-8 animate-spin text-cinematic-gold" />
        <p className="text-sm text-charcoal-ink/50 font-medium">Loading RSVPs…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-charcoal-ink">RSVP Responses</h2>
          <p className="text-sm text-charcoal-ink/50 mt-1">
            View and track all guest RSVP submissions.
          </p>
        </div>
        <Button
          onClick={handleExportCSV}
          disabled={exporting}
          variant="outline"
          className="border-charcoal-ink/15 text-charcoal-ink hover:border-cinematic-gold hover:text-cinematic-gold rounded px-4 py-2 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300 shrink-0"
        >
          {exporting ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Download className="size-4 mr-1.5" />}
          Export Detail
        </Button>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-charcoal-ink/30" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="pl-9 border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44 border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Responses</SelectItem>
            <SelectItem value="attending">All Attending</SelectItem>
            <SelectItem value="declined">All Declined</SelectItem>
            <SelectItem value="mixed">Mixed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* RSVP List */}
      {rsvps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Mail className="size-10 text-champagne-silk" />
          <p className="text-sm text-charcoal-ink/40 font-medium">
            {total === 0 ? 'No RSVPs received yet' : 'No RSVPs match your filters'}
          </p>
          <p className="text-xs text-charcoal-ink/30">
            {total === 0
              ? 'RSVPs will appear here once guests start responding.'
              : 'Try adjusting your search or filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {rsvps.map((rsvp) => {
            const status = computeStatus(rsvp.guests);
            const StatusIcon = status.icon;
            const attendingCount = rsvp.guests.filter((g) => g.attendance === 'yes').length;

            return (
              <Card key={rsvp.id} className="border-charcoal-ink/5 shadow-none hover:border-champagne-silk transition-colors duration-200">
                <CardContent className="p-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center justify-center h-9 w-9 rounded-full bg-charcoal-ink/5 text-charcoal-ink text-sm font-semibold shrink-0">
                        {rsvp.firstName[0]}{rsvp.lastName[0]}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-charcoal-ink">
                          {rsvp.firstName} {rsvp.lastName}
                        </h3>
                        <p className="text-xs text-charcoal-ink/40">{formatDate(rsvp.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {rsvp.guest ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-medium flex items-center gap-1 bg-cinematic-gold/5 text-cinematic-gold border-cinematic-gold/20"
                        >
                          <Link2 className="size-3" />
                          {rsvp.guest.name}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-medium flex items-center gap-1 bg-amber-50 text-amber-600 border-amber-200"
                        >
                          <MinusCircle className="size-3" />
                          Unmatched
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-medium flex items-center gap-1 ${status.color}`}
                      >
                        <StatusIcon className="size-3" />
                        {status.label}
                      </Badge>
                    </div>
                  </div>

                  {/* Guest responses */}
                  <div className="bg-charcoal-ink/[0.02] rounded-lg p-3 space-y-2">
                    {rsvp.guests.map((guest) => (
                      <div key={guest.id} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {guest.attendance === 'yes' ? (
                            <CheckCircle className="size-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <XCircle className="size-3.5 text-red-400 shrink-0" />
                          )}
                          <span className="text-xs text-charcoal-ink/70 truncate">{guest.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {guest.dietary && (
                            <span className="text-[10px] text-charcoal-ink/40 bg-white px-1.5 py-0.5 rounded border border-charcoal-ink/5">
                              {guest.dietary}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="pt-1 border-t border-charcoal-ink/5 flex items-center justify-between">
                      <span className="text-[10px] text-charcoal-ink/40">
                        Party size: {rsvp.partySize}
                      </span>
                      <span className="text-[10px] font-medium text-charcoal-ink/50">
                        {attendingCount} of {rsvp.guests.length} attending
                      </span>
                    </div>
                  </div>

                  {/* Action buttons for unmatched RSVPs */}
                  {!rsvp.guest && (
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCreateGuest(rsvp.id)}
                        disabled={linking === rsvp.id}
                        className="h-7 text-[11px] border-charcoal-ink/10 text-charcoal-ink/60 hover:border-cinematic-gold hover:text-cinematic-gold"
                      >
                        {linking === rsvp.id ? (
                          <Loader2 className="size-3 mr-1 animate-spin" />
                        ) : (
                          <UserPlus className="size-3 mr-1" />
                        )}
                        Create Guest from RSVP
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* RSVP Section Text — moved from Content Editor */}
      <SectionContentFields
        section="rsvp"
        title="RSVP Section Text"
        description="Customise the text displayed on your RSVP form"
        fields={RSVP_CONTENT_FIELDS}
      />
    </div>
  );
}