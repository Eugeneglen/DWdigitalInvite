'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Loader2, Timer, CalendarClock, Mail, BookOpen, Image, Heart, MapPin, HelpCircle, Sparkles, Video, Music2, Save, Palette, Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { invalidateWeddingCache } from '@/hooks/usePublicWedding';
// (Animation settings now live in CoupleHome.tsx — no imports needed here)

const API_BASE = '/api/cms/features?XTransformPort=3000';

interface FeatureConfig {
  featureKey: string;
  displayName: string;
  description: string;
  icon: React.ElementType;
}

const FEATURE_REGISTRY: Record<string, FeatureConfig> = {
  countdown: {
    featureKey: 'countdown',
    displayName: 'Countdown Timer',
    description: 'Show a live countdown to your wedding day',
    icon: Timer,
  },
  schedule: {
    featureKey: 'schedule',
    displayName: 'Event Schedule',
    description: 'Display the timeline of your wedding day events',
    icon: CalendarClock,
  },
  rsvp: {
    featureKey: 'rsvp',
    displayName: 'RSVP Form',
    description: 'Allow guests to submit their attendance response',
    icon: Mail,
  },
  story: {
    featureKey: 'story',
    displayName: 'Our Story',
    description: 'Share your love story timeline with guests',
    icon: BookOpen,
  },
  gallery: {
    featureKey: 'gallery',
    displayName: 'Photo Gallery',
    description: 'Display a gallery of your favorite moments',
    icon: Image,
  },
  wishes: {
    featureKey: 'wishes',
    displayName: 'Wishes & Blessings',
    description: 'Let guests leave their heartfelt messages',
    icon: Heart,
  },
  'getting-there': {
    featureKey: 'getting-there',
    displayName: 'Getting There',
    description: 'Provide directions and venue information',
    icon: MapPin,
  },
  qa: {
    featureKey: 'qa',
    displayName: 'Questions & Answers',
    description: 'Address common guest questions',
    icon: HelpCircle,
  },
  moments: {
    featureKey: 'moments',
    displayName: 'Moments',
    description: 'Share special moments captured on your journey',
    icon: Sparkles,
  },
  video: {
    featureKey: 'video',
    displayName: 'Wedding Video',
    description: 'Embed a wedding video on your page',
    icon: Video,
  },
  templates: {
    featureKey: 'templates',
    displayName: 'Theme Templates',
    description: 'Browse and apply 6 curated design themes (Diamond feature)',
    icon: Palette,
  },
  music: {
    featureKey: 'music',
    displayName: 'Background Music',
    description: 'Play background music on your wedding page',
    icon: Music2,
  },
};

const FEATURE_ORDER = [
  'countdown',
  'schedule',
  'rsvp',
  'story',
  'gallery',
  'wishes',
  'getting-there',
  'qa',
  'moments',
  'video',
  'music',
];

interface FeatureItem {
  featureKey: string;
  isEnabled: boolean;
  config?: string | null;
}

interface MusicConfig {
  url: string;
  title: string;
  artist: string;
  autoplay: boolean;
  loop: boolean;
}

const DEFAULT_MUSIC_CONFIG: MusicConfig = {
  url: '',
  title: '',
  artist: '',
  autoplay: true,
  loop: true,
};

function parseMusicConfig(config: string | null | undefined): MusicConfig {
  if (!config) return { ...DEFAULT_MUSIC_CONFIG };
  try {
    return { ...DEFAULT_MUSIC_CONFIG, ...JSON.parse(config) };
  } catch {
    return { ...DEFAULT_MUSIC_CONFIG };
  }
}

interface VideoConfig {
  url: string;
  title: string;
  caption: string;
  autoplay: boolean;
  muted: boolean;
  showControls: boolean;
}

const DEFAULT_VIDEO_CONFIG: VideoConfig = {
  url: '',
  title: '',
  caption: '',
  autoplay: false,
  muted: true,
  showControls: true,
};

function parseVideoConfig(config: string | null | undefined): VideoConfig {
  if (!config) return { ...DEFAULT_VIDEO_CONFIG };
  try {
    return { ...DEFAULT_VIDEO_CONFIG, ...JSON.parse(config) };
  } catch {
    return { ...DEFAULT_VIDEO_CONFIG };
  }
}



export default function CoupleFeatures() {
  const [features, setFeatures] = useState<FeatureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Music config local state
  const [musicConfig, setMusicConfig] = useState<MusicConfig>(DEFAULT_MUSIC_CONFIG);
  const [savingMusic, setSavingMusic] = useState(false);
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const musicFileRef = useRef<HTMLInputElement>(null);

  // Video config local state
  const [videoConfig, setVideoConfig] = useState<VideoConfig>(DEFAULT_VIDEO_CONFIG);
  const [savingVideo, setSavingVideo] = useState(false);

  // (Animation settings moved to CoupleHome.tsx — placed above the Color/Font pickers)


  const fetchFeatures = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(API_BASE);
      if (!res.ok) throw new Error('Failed to load features');
      const data = await res.json();
      const rawFeatures: FeatureItem[] = data.features ?? [];
      setFeatures(rawFeatures);
      // Load music config from features
      const musicFeature = rawFeatures.find((f) => f.featureKey === 'music');
      setMusicConfig(parseMusicConfig(musicFeature?.config));

      const videoFeature = rawFeatures.find((f) => f.featureKey === 'video');
      setVideoConfig(parseVideoConfig(videoFeature?.config));

    } catch {
      toast({ title: 'Error', description: 'Failed to load features', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const getFeatureConfig = (key: string): FeatureConfig => {
    return (
      FEATURE_REGISTRY[key] ?? {
        featureKey: key,
        displayName: key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        description: 'Toggle this feature on or off',
        icon: Sparkles,
      }
    );
  };

  const handleToggle = (key: string) => {
    // Optimistic update
    setFeatures((prev) =>
      prev.map((f) => (f.featureKey === key ? { ...f, isEnabled: !f.isEnabled } : f))
    );

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set saving indicator
    setSavingKey(key);

    // Immediate save on toggle
    const updatedFeatures = features.map((f) =>
      f.featureKey === key ? { ...f, isEnabled: !f.isEnabled } : f
    );

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(API_BASE, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ features: updatedFeatures }),
        });

        if (!res.ok) {
          throw new Error('Failed to save features');
        }

        const config = getFeatureConfig(key);
        const isEnabled = updatedFeatures.find((f) => f.featureKey === key)?.isEnabled;
        invalidateWeddingCache();
        toast({ title: 'Success', description: `${config.displayName} ${isEnabled ? 'enabled' : 'disabled'}` });
      } catch {
        // Revert optimistic update
        setFeatures(features);
        toast({ title: 'Error', description: 'Failed to save feature changes', variant: 'destructive' });
      } finally {
        setSavingKey(null);
      }
    }, 300);
  };

  const handleSaveMusicConfig = async () => {
    setSavingMusic(true);
    try {
      const currentMusicFeature = features.find((f) => f.featureKey === 'music');
      if (!currentMusicFeature) return;

      const updatedFeatures = features.map((f) =>
        f.featureKey === 'music'
          ? { ...f, config: JSON.stringify(musicConfig) }
          : f
      );

      const res = await fetch(API_BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: updatedFeatures }),
      });

      if (!res.ok) throw new Error('Failed to save music settings');
      setFeatures(updatedFeatures);
      invalidateWeddingCache();
      toast({ title: 'Success', description: 'Music settings saved' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save music settings', variant: 'destructive' });
    } finally {
      setSavingMusic(false);
    }
  };

  // Upload a music file to the storage backend and set the URL in the config.
  const handleMusicFileUpload = async (file: File) => {
    if (!file.type.startsWith('audio/')) {
      toast({ title: 'Error', description: 'Please select an audio file (MP3, WAV, OGG, M4A)', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Error', description: 'File too large. Max 10 MB.', variant: 'destructive' });
      return;
    }

    setUploadingMusic(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'music');
      const uploadRes = await fetch('/api/cms/upload?XTransformPort=3000', { method: 'POST', body: formData });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to upload file');
      }
      const uploadResult = await uploadRes.json();
      // Set the URL in the music config and auto-fill the title if empty
      setMusicConfig((prev) => ({
        ...prev,
        url: uploadResult.url,
        title: prev.title || file.name.replace(/\.[^/.]+$/, ''),
      }));
      invalidateWeddingCache();
      toast({ title: 'Success', description: 'Music file uploaded. Click "Save Music Settings" to apply.' });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to upload', variant: 'destructive' });
    } finally {
      setUploadingMusic(false);
    }
  };

  const handleSaveVideoConfig = async () => {
    setSavingVideo(true);
    try {
      const currentVideoFeature = features.find((f) => f.featureKey === 'video');
      if (!currentVideoFeature) return;

      const updatedFeatures = features.map((f) =>
        f.featureKey === 'video'
          ? { ...f, config: JSON.stringify(videoConfig) }
          : f
      );

      const res = await fetch(API_BASE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: updatedFeatures }),
      });

      if (!res.ok) throw new Error('Failed to save video settings');
      setFeatures(updatedFeatures);
      invalidateWeddingCache();
      toast({ title: 'Success', description: 'Video settings saved' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save video settings', variant: 'destructive' });
    } finally {
      setSavingVideo(false);
    }
  };



  const isMusicEnabled = features.find((f) => f.featureKey === 'music')?.isEnabled ?? false;

  // (Animation settings moved to CoupleHome.tsx)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="size-8 animate-spin text-cinematic-gold" />
        <p className="text-sm text-charcoal-ink/50 font-medium">Loading features…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-semibold text-charcoal-ink">Invitation Features</h2>
        <p className="text-sm text-charcoal-ink/50 mt-1">
          Toggle which sections are visible to your guests on the invitation.
        </p>
      </div>

      <Separator className="bg-champagne-silk" />

      {/* Feature Toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FEATURE_ORDER.map((key) => {
          const config = getFeatureConfig(key);
          const feature = features.find((f) => f.featureKey === key);
          const isEnabled = feature?.isEnabled ?? false;
          const isSaving = savingKey === key;
          const Icon = config.icon;

          return (
            <Card
              key={key}
              className={`border-charcoal-ink/5 shadow-none transition-colors duration-200 ${
                isEnabled
                  ? 'bg-white hover:border-champagne-silk'
                  : 'bg-charcoal-ink/[0.02]'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className={`flex items-center justify-center h-9 w-9 rounded-lg shrink-0 transition-colors duration-200 ${
                        isEnabled
                          ? 'bg-cinematic-gold/10 text-cinematic-gold'
                          : 'bg-charcoal-ink/5 text-charcoal-ink/30'
                      }`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-charcoal-ink">
                        {config.displayName}
                      </h3>
                      <p className="text-xs text-charcoal-ink/40 mt-0.5 leading-relaxed">
                        {config.description}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    {isSaving ? (
                      <Loader2 className="size-4 animate-spin text-cinematic-gold/60" />
                    ) : (
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => handleToggle(key)}
                      />
                    )}
                  </div>
                </div>

                {/* Music inline settings */}
                {key === 'music' && isEnabled && (
                  <div className="mt-4 pt-4 border-t border-champagne-silk/60 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-charcoal-ink/70">Music File</Label>
                      <div className="flex gap-2">
                        <Input
                          type="url"
                          placeholder="https://example.com/song.mp3"
                          value={musicConfig.url}
                          onChange={(e) => setMusicConfig((prev) => ({ ...prev, url: e.target.value }))}
                          className="h-8 text-xs flex-1"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={uploadingMusic}
                          onClick={() => musicFileRef.current?.click()}
                          className="h-8 text-xs shrink-0"
                        >
                          {uploadingMusic ? (
                            <Loader2 className="size-3 animate-spin mr-1.5" />
                          ) : (
                            <Upload className="size-3 mr-1.5" />
                          )}
                          Upload
                        </Button>
                        <input
                          ref={musicFileRef}
                          type="file"
                          accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/m4a,audio/x-m4a"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleMusicFileUpload(file);
                            e.target.value = '';
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-charcoal-ink/30">Upload an MP3/WAV/OGG/M4A file (max 10 MB) or paste a direct URL</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-charcoal-ink/70">Song Title</Label>
                        <Input
                          placeholder="Our Song"
                          value={musicConfig.title}
                          onChange={(e) => setMusicConfig((prev) => ({ ...prev, title: e.target.value }))}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-charcoal-ink/70">Artist Name</Label>
                        <Input
                          placeholder="Artist"
                          value={musicConfig.artist}
                          onChange={(e) => setMusicConfig((prev) => ({ ...prev, artist: e.target.value }))}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={musicConfig.autoplay}
                          onCheckedChange={(checked) => setMusicConfig((prev) => ({ ...prev, autoplay: checked }))}
                        />
                        <Label className="text-xs text-charcoal-ink/60">Autoplay</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={musicConfig.loop}
                          onCheckedChange={(checked) => setMusicConfig((prev) => ({ ...prev, loop: checked }))}
                        />
                        <Label className="text-xs text-charcoal-ink/60">Loop</Label>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleSaveMusicConfig}
                      disabled={savingMusic || !musicConfig.url}
                      className="h-7 text-xs mt-1"
                    >
                      {savingMusic ? (
                        <Loader2 className="size-3 animate-spin mr-1.5" />
                      ) : (
                        <Save className="size-3 mr-1.5" />
                      )}
                      Save Music Settings
                    </Button>
                  </div>
                )}

                {/* Video inline settings */}
                {key === 'video' && isEnabled && (
                  <div className="mt-4 pt-4 border-t border-champagne-silk/60 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-charcoal-ink/70">Video URL</Label>
                      <Input
                        type="url"
                        placeholder="YouTube, Vimeo, or direct video URL"
                        value={videoConfig.url}
                        onChange={(e) => setVideoConfig((prev) => ({ ...prev, url: e.target.value }))}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-charcoal-ink/70">Video Title</Label>
                      <Input
                        placeholder="Our Wedding Video"
                        value={videoConfig.title}
                        onChange={(e) => setVideoConfig((prev) => ({ ...prev, title: e.target.value }))}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-charcoal-ink/70">Caption</Label>
                      <Textarea
                        placeholder="A short description..."
                        value={videoConfig.caption}
                        onChange={(e) => setVideoConfig((prev) => ({ ...prev, caption: e.target.value }))}
                        className="h-16 text-xs resize-none"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={videoConfig.autoplay}
                          onCheckedChange={(checked) => setVideoConfig((prev) => ({ ...prev, autoplay: checked }))}
                        />
                        <Label className="text-xs text-charcoal-ink/60">Autoplay</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={videoConfig.muted}
                          onCheckedChange={(checked) => setVideoConfig((prev) => ({ ...prev, muted: checked }))}
                        />
                        <Label className="text-xs text-charcoal-ink/60">Muted</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={videoConfig.showControls}
                          onCheckedChange={(checked) => setVideoConfig((prev) => ({ ...prev, showControls: checked }))}
                        />
                        <Label className="text-xs text-charcoal-ink/60">Show Controls</Label>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleSaveVideoConfig}
                      disabled={savingVideo || !videoConfig.url}
                      className="h-7 text-xs mt-1"
                    >
                      {savingVideo ? (
                        <Loader2 className="size-3 animate-spin mr-1.5" />
                      ) : (
                        <Save className="size-3 mr-1.5" />
                      )}
                      Save Video Settings
                    </Button>
                  </div>
                )}

                {/* (Animation settings moved to CoupleHome.tsx) */}


              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
