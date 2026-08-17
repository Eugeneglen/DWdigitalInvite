'use client';

import { useMemo } from 'react';
import SectionBanner from '../SectionBanner';
import { usePublicWedding } from '@/hooks/usePublicWedding'
import { useWeddingSlug } from '@/hooks/useWeddingSlug';;

interface VideoConfig {
  url?: string;
  title?: string;
  caption?: string;
  autoplay?: boolean;
  muted?: boolean;
  showControls?: boolean;
}

/**
 * Convert a YouTube/Vimeo watch URL to an embeddable iframe URL.
 * Returns null if the URL is not a recognized platform.
 */
function toEmbedUrl(raw: string, autoplay = false, muted = true): string | null {
  if (!raw) return null;

  // YouTube: https://www.youtube.com/watch?v=XXXXX or https://youtu.be/XXXXX
  const ytWatch = raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytWatch) {
    const params = new URLSearchParams();
    if (autoplay) params.set('autoplay', '1');
    if (muted || autoplay) params.set('muted', '1');
    params.set('rel', '0');
    params.set('modestbranding', '1');
    return `https://www.youtube.com/embed/${ytWatch[1]}?${params.toString()}`;
  }

  // Vimeo: https://vimeo.com/XXXXX or https://player.vimeo.com/video/XXXXX
  const vimeoMatch = raw.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/);
  if (vimeoMatch) {
    const params = new URLSearchParams();
    if (autoplay) params.set('autoplay', '1');
    if (muted || autoplay) params.set('muted', '1');
    params.set('byline', '0');
    params.set('title', '0');
    return `https://player.vimeo.com/video/${vimeoMatch[1]}?${params.toString()}`;
  }

  return null;
}

/** Check if a URL points to a direct video file (mp4, webm, ogg) */
function isDirectVideo(raw: string): boolean {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(raw);
}

export default function VideoPage() {
  const { data, getField } = usePublicWedding(useWeddingSlug());
  const config: VideoConfig = (data?.featureConfigs?.['video'] as VideoConfig) ?? {};

  const videoUrl = config.url?.trim();
  const videoTitle = config.title?.trim() || getField('video', 'title', 'Our Wedding Video');
  const videoCaption = config.caption?.trim() || getField('video', 'caption', '');
  const autoplay = config.autoplay ?? false;
  const muted = config.muted ?? true;
  const showControls = config.showControls ?? true;

  const embedUrl = useMemo(() => (videoUrl ? toEmbedUrl(videoUrl, autoplay, muted) : null), [videoUrl, autoplay, muted]);
  const directVideo = videoUrl && isDirectVideo(videoUrl);

  // No video configured — show empty state
  if (!videoUrl) {
    return null;
  }

  return (
    <div className="min-h-screen bg-paper-cream">
      <SectionBanner title={videoTitle} subtitle="A moment to remember" />

      <div className="px-4 md:px-6 py-10 md:py-16 max-w-4xl mx-auto w-full">
        <div className="space-y-6">
          {/* Video container */}
          <div className="relative w-full rounded-2xl overflow-hidden bg-charcoal-ink/5 border border-champagne-silk/20 shadow-sm">
            <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  title={videoTitle}
                  className="absolute inset-0 w-full h-full"
                  allow={autoplay ? 'autoplay; encrypted-media' : 'encrypted-media'}
                  allowFullScreen
                />
              ) : directVideo ? (
                <video
                  src={videoUrl}
                  title={videoTitle}
                  className="absolute inset-0 w-full h-full object-contain bg-black"
                  autoPlay={autoplay}
                  muted={muted}
                  controls={showControls}
                  playsInline
                />
              ) : (
                // Fallback: try as iframe for unknown URLs
                <iframe
                  src={videoUrl}
                  title={videoTitle}
                  className="absolute inset-0 w-full h-full"
                  allow={autoplay ? 'autoplay; encrypted-media' : 'encrypted-media'}
                  allowFullScreen
                />
              )}
            </div>
          </div>

          {/* Caption */}
          {videoCaption && (
            <p className="text-center text-sm text-charcoal-ink/50 leading-relaxed max-w-lg mx-auto">
              {videoCaption}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}