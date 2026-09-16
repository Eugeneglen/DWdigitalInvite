'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, Heart, MapPin, CalendarDays, Clock, Save, Map, Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useCoupleCMSStore } from '@/store/useCoupleCMSStore';
import { invalidateWeddingCache } from '@/hooks/usePublicWedding';
import MirrorImageUpload from './MirrorImageUpload';

interface WeddingData {
  id: string;
  coupleName: string;
  brideName: string | null;
  groomName: string | null;
  weddingDate: string;
  weddingTime: string | null;
  venue: string | null;
  venueAddress: string | null;
  googleMapsUrl: string | null;
  heroImageUrl: string | null;
  bannerUrl: string | null;
  [key: string]: unknown;
}

const API_BASE = '/api/cms/wedding?XTransformPort=3000';
const CONTENT_API = '/api/cms/content?XTransformPort=3000';

const MAP_TYPE_OPTIONS = [
  { value: 'google-map', label: 'Google Map', icon: Map },
  { value: 'custom-map', label: 'Upload Custom Map', icon: Upload },
] as const;

export default function CoupleDetails() {
  const [wedding, setWedding] = useState<WeddingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [coupleName, setCoupleName] = useState('');
  const [brideName, setBrideName] = useState('');
  const [groomName, setGroomName] = useState('');
  const [weddingDate, setWeddingDate] = useState('');
  const [weddingTime, setWeddingTime] = useState('');
  const [venue, setVenue] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [mapType, setMapType] = useState('google-map');
  const [customMapImage, setCustomMapImage] = useState('');

  const fetchWedding = async () => {
    try {
      setLoading(true);
      const res = await fetch(API_BASE);
      if (!res.ok) throw new Error('Failed to load wedding data');
      const data = await res.json();
      const w = data.wedding as WeddingData;
      setWedding(w);

      // Populate form
      setCoupleName(w.coupleName ?? '');
      setBrideName(w.brideName ?? '');
      setGroomName(w.groomName ?? '');
      // Convert ISO date to YYYY-MM-DD for input
      if (w.weddingDate) {
        const d = new Date(w.weddingDate);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setWeddingDate(`${yyyy}-${mm}-${dd}`);
      }
      setWeddingTime(w.weddingTime ?? '');
      setVenue(w.venue ?? '');
      setVenueAddress(w.venueAddress ?? '');
      setGoogleMapsUrl(w.googleMapsUrl ?? '');

      // Fetch content fields for map type and custom map image
      try {
        const contentRes = await fetch(`${CONTENT_API}&section=getting-there`);
        if (contentRes.ok) {
          const contentData = await contentRes.json();
          const items: Array<{ fieldKey: string; fieldValue: string }> = contentData.content || [];
          const mt = items.find(i => i.fieldKey === 'mapType');
          const cm = items.find(i => i.fieldKey === 'customMapImage');
          if (mt) setMapType(mt.fieldValue || 'google-map');
          if (cm) setCustomMapImage(cm.fieldValue || '');
        }
      } catch { /* non-critical */ }
    } catch {
      toast({ title: 'Error', description: 'Failed to load wedding details', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWedding();
  }, []);

  const saveContent = useCallback(async (items: Array<{ section: string; fieldKey: string; fieldValue: string; fieldType: string }>) => {
    const res = await fetch(CONTENT_API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) throw new Error('Failed to save content');
  }, []);

  const handleSave = async () => {
    if (!coupleName.trim()) {
      toast({ title: 'Error', description: 'Couple Display Name is required', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(API_BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coupleName: coupleName.trim(),
          brideName: brideName.trim() || null,
          groomName: groomName.trim() || null,
          weddingDate: weddingDate || null,
          weddingTime: weddingTime || null,
          venue: venue.trim() || null,
          venueAddress: venueAddress.trim() || null,
          googleMapsUrl: googleMapsUrl.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save changes');
      }

      const data = await res.json();
      const updatedWedding = data.wedding as WeddingData;
      setWedding(updatedWedding);
      useCoupleCMSStore.getState().setWeddingData(updatedWedding);

      // Save map type content fields
      await saveContent([
        { section: 'getting-there', fieldKey: 'mapType', fieldValue: mapType, fieldType: 'TEXT' },
        { section: 'getting-there', fieldKey: 'customMapImage', fieldValue: customMapImage, fieldType: 'TEXT' },
      ]);

      invalidateWeddingCache();
      toast({ title: 'Success', description: 'Wedding details saved successfully' });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save changes', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="size-8 animate-spin text-cinematic-gold" />
        <p className="text-sm text-charcoal-ink/50 font-medium">Loading your wedding details…</p>
      </div>
    );
  }

  if (!wedding) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-sm text-charcoal-ink/60">No wedding data found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-semibold text-charcoal-ink">Your Details</h2>
        <p className="text-sm text-charcoal-ink/50 mt-1">
          Edit your couple information, wedding date, and venue details.
        </p>
      </div>

      <Separator className="bg-champagne-silk" />

      {/* Couple Names Section */}
      <Card className="border-charcoal-ink/5 shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-charcoal-ink">
            <Heart className="size-4 text-cinematic-gold" />
            Couple Names
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="coupleName" className="text-sm font-medium text-charcoal-ink/70">
              Couple Display Name
            </Label>
            <Input
              id="coupleName"
              value={coupleName}
              onChange={(e) => setCoupleName(e.target.value)}
              placeholder="e.g. Eleanor & James"
              className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="brideName" className="text-sm font-medium text-charcoal-ink/70">
                Bride&apos;s First Name
              </Label>
              <Input
                id="brideName"
                value={brideName}
                onChange={(e) => setBrideName(e.target.value)}
                placeholder="Eleanor"
                className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="groomName" className="text-sm font-medium text-charcoal-ink/70">
                Groom&apos;s First Name
              </Label>
              <Input
                id="groomName"
                value={groomName}
                onChange={(e) => setGroomName(e.target.value)}
                placeholder="James"
                className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Date & Time Section */}
      <Card className="border-charcoal-ink/5 shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-charcoal-ink">
            <CalendarDays className="size-4 text-cinematic-gold" />
            Date & Time
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="weddingDate" className="text-sm font-medium text-charcoal-ink/70">
                Wedding Date
              </Label>
              <Input
                id="weddingDate"
                type="date"
                value={weddingDate}
                onChange={(e) => setWeddingDate(e.target.value)}
                className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weddingTime" className="text-sm font-medium text-charcoal-ink/70">
                Wedding Time
              </Label>
              <Input
                id="weddingTime"
                type="time"
                value={weddingTime}
                onChange={(e) => setWeddingTime(e.target.value)}
                className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Venue Section */}
      <Card className="border-charcoal-ink/5 shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-charcoal-ink">
            <MapPin className="size-4 text-cinematic-gold" />
            Venue Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="venue" className="text-sm font-medium text-charcoal-ink/70">
              Venue Name
            </Label>
            <Input
              id="venue"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="e.g. The Ritz-Carlton, Millenia Singapore"
              className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="venueAddress" className="text-sm font-medium text-charcoal-ink/70">
              Venue Address
            </Label>
            <Textarea
              id="venueAddress"
              value={venueAddress}
              onChange={(e) => setVenueAddress(e.target.value)}
              placeholder="Full venue address"
              rows={3}
              className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20 resize-none"
            />
          </div>
          {/* Map Type Selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-charcoal-ink/70">
              Map Type
            </Label>
            <div className="flex gap-3">
              {MAP_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMapType(value)}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all duration-200 ${
                    mapType === value
                      ? 'border-cinematic-gold bg-cinematic-gold/5 text-charcoal-ink'
                      : 'border-charcoal-ink/10 text-charcoal-ink/50 hover:border-charcoal-ink/20 hover:text-charcoal-ink/70'
                  }`}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Google Maps URL — shown when Google Map is selected */}
          {mapType === 'google-map' && (
            <div className="space-y-1.5">
              <Label htmlFor="googleMapsUrl" className="text-sm font-medium text-charcoal-ink/70">
                Google Maps URL
              </Label>
              <Input
                id="googleMapsUrl"
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
                placeholder="https://maps.google.com/..."
                className="border-charcoal-ink/10 focus:border-cinematic-gold focus:ring-cinematic-gold/20"
              />
            </div>
          )}

          {/* Custom Map Upload — shown when Upload Custom Map is selected */}
          {mapType === 'custom-map' && (
            <MirrorImageUpload
              category="schedule"
              value={customMapImage}
              onChange={setCustomMapImage}
              onRemove={() => setCustomMapImage('')}
              label="Custom Map Image"
              helperText="Upload a JPG, PNG, or WebP image of your venue map"
              aspectClass="aspect-[4/3]"
              accept="image/jpeg,image/png,image/webp"
            />
          )}
        </CardContent>
      </Card>

      {/* Sticky Save Bar — bottom right (always visible — only way to save wedding details) */}
      <div className="sticky bottom-0 flex justify-end gap-2 py-4 bg-white/95 backdrop-blur-sm border-t border-charcoal-ink/5">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-cinematic-gold text-charcoal-ink hover:bg-cinematic-gold/90 rounded px-6 py-2.5 text-[13px] font-medium uppercase tracking-[0.08em] transition-colors duration-300 disabled:opacity-50 shrink-0 min-w-fit"
        >
          {saving ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="size-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}