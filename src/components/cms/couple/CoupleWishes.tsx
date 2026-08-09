'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, Trash2, MessageSquareHeart, Search, Heart, User, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { invalidateWeddingCache } from '@/hooks/usePublicWedding';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import SectionContentFields, { type ContentField } from './SectionContentFields';

const WISHES_CONTENT_FIELDS: ContentField[] = [
  { key: 'title', label: 'Section Title', type: 'text', placeholder: 'e.g. Wishes & Blessings' },
  { key: 'subtitle', label: 'Section Subtitle', type: 'text', placeholder: 'e.g. Leave your heartfelt message for the couple' },
  { key: 'nameLabel', label: 'Name Field Label', type: 'text', placeholder: 'e.g. Your Name' },
  { key: 'messageLabel', label: 'Message Field Label', type: 'text', placeholder: 'e.g. Your Message' },
  { key: 'relationshipLabel', label: 'Relationship Field Label', type: 'text', placeholder: 'e.g. Your Relationship to the Couple' },
  { key: 'submitLabel', label: 'Submit Button Label', type: 'text', placeholder: 'e.g. Weave into Archive' },
  { key: 'heirloomLabel', label: 'Section Label (Eyebrow)', type: 'text', placeholder: 'e.g. The Living Heirloom' },
  { key: 'formEyebrow', label: 'Form Section Eyebrow', type: 'text', placeholder: 'e.g. YOUR TURN' },
  { key: 'formHeading', label: 'Form Section Heading', type: 'text', placeholder: 'e.g. Contribute to the Heirloom' },
];

const API_BASE = '/api/cms/wishes?XTransformPort=3000';

interface WishItem {
  id: string;
  name: string;
  relationship: string | null;
  message: string;
  imageUrl: string | null;
  createdAt: string;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-SG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

export default function CoupleWishes() {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [wishes, setWishes] = useState<WishItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const res = await fetch('/api/cms/export?XTransformPort=3000&type=wishes');
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wishes-export.csv`;
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

  const fetchWishes = useCallback(async () => {
    try {
      setLoading(true);
      let url = API_BASE;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load wishes');
      const data = await res.json();
      setWishes(data.wishes ?? []);
      setTotal(data.total ?? 0);
    } catch {
      toast({ title: 'Error', description: 'Failed to load wishes', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchWishes();
  }, [fetchWishes]);

  const handleDelete = async (id: string) => {
    const ok = await confirm('Delete this wish?', 'This action cannot be undone.');
    if (!ok) return;

    try {
      setDeleting(id);
      const res = await fetch(`${API_BASE}&id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete wish');
      }

      invalidateWeddingCache();
      toast({ title: 'Success', description: 'Wish deleted' });
      fetchWishes();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete wish', variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  // Relationship distribution
  const relationships = wishes.reduce<Record<string, number>>((acc, w) => {
    const rel = w.relationship || 'Not specified';
    acc[rel] = (acc[rel] || 0) + 1;
    return acc;
  }, {});

  const topRelationships = Object.entries(relationships)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="size-8 animate-spin text-cinematic-gold" />
        <p className="text-sm text-charcoal-ink/50 font-medium">Loading wishes…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-charcoal-ink">Wishes & Blessings</h2>
          <p className="text-sm text-charcoal-ink/50 mt-1">
            View and manage heartfelt messages from your guests.
          </p>
        </div>
        <Button
          onClick={handleExportCSV}
          disabled={exporting}
          variant="outline"
          className="border-charcoal-ink/15 text-charcoal-ink hover:border-cinematic-gold hover:text-cinematic-gold rounded px-4 py-2 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300 shrink-0"
        >
          {exporting ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Download className="size-4 mr-1.5" />}
          Export CSV
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-charcoal-ink/5 bg-white p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Heart className="size-4 text-cinematic-gold" />
            <p className="text-2xl font-bold text-charcoal-ink">{total}</p>
          </div>
          <p className="text-xs text-charcoal-ink/40 font-medium uppercase tracking-wider">Total Wishes</p>
        </div>
        <div className="rounded-xl border border-charcoal-ink/5 bg-white p-4 sm:col-span-2">
          <p className="text-xs text-charcoal-ink/40 font-medium uppercase tracking-wider mb-2">Top Relationships</p>
          <div className="flex flex-wrap gap-1.5">
            {topRelationships.length > 0 ? (
              topRelationships.map(([rel, count]) => (
                <Badge
                  key={rel}
                  variant="outline"
                  className="text-xs font-medium border-champagne-silk text-charcoal-ink/60 bg-white"
                >
                  {rel} ({count})
                </Badge>
              ))
            ) : (
              <span className="text-xs text-charcoal-ink/30">No data yet</span>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-charcoal-ink/30" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search wishes by name, message, or relationship…"
          className="pl-9 border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
        />
      </div>

      {/* Wishes List */}
      {wishes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <MessageSquareHeart className="size-10 text-champagne-silk" />
          <p className="text-sm text-charcoal-ink/40 font-medium">
            {total === 0 ? 'No wishes received yet' : 'No wishes match your search'}
          </p>
          <p className="text-xs text-charcoal-ink/30">
            {total === 0
              ? 'Wishes will appear here once guests start sending them.'
              : 'Try a different search term.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {wishes.map((wish) => (
            <Card
              key={wish.id}
              className="border-charcoal-ink/5 shadow-none hover:border-champagne-silk transition-colors duration-200"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Header: name + relationship + time */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-cinematic-gold/10 text-cinematic-gold shrink-0">
                        <User className="size-3.5" />
                      </div>
                      <h3 className="text-sm font-semibold text-charcoal-ink">{wish.name}</h3>
                      {wish.relationship && (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-medium border-champagne-silk text-charcoal-ink/50"
                        >
                          {wish.relationship}
                        </Badge>
                      )}
                      <span className="text-[10px] text-charcoal-ink/30 ml-auto">
                        {timeAgo(wish.createdAt)}
                      </span>
                    </div>

                    {/* Message */}
                    <p className="text-xs text-charcoal-ink/60 leading-relaxed whitespace-pre-wrap">
                      {wish.message}
                    </p>
                  </div>

                  {/* Delete button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(wish.id)}
                    disabled={deleting === wish.id}
                    className="h-9 w-9 p-0 text-charcoal-ink/30 hover:text-red-500 hover:bg-red-50 shrink-0 mt-1"
                    title="Delete wish"
                  >
                    {deleting === wish.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Wishes Section Text — moved from Content Editor */}
      <SectionContentFields
        section="wishes"
        title="Wishes Section Text"
        description="Customise the section header and form labels"
        fields={WISHES_CONTENT_FIELDS}
      />
      <ConfirmDialog />
    </div>
  );
}