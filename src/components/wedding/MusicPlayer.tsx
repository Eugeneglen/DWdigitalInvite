'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Music2, Volume2, VolumeX, Play, Pause } from 'lucide-react';
import { usePublicWedding } from '@/hooks/usePublicWedding'
import { useWeddingSlug } from '@/hooks/useWeddingSlug';;

interface MusicConfig {
  url?: string;
  title?: string;
  artist?: string;
  autoplay?: boolean;
  loop?: boolean;
}

export default function MusicPlayer() {
  const { data } = usePublicWedding(useWeddingSlug());
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Read config from wedding data — destructure to stable primitives to avoid
  // effect re-triggering on every render due to new object references
  const musicEnabled = data?.featureFlags?.['music'] ?? false;
  const rawConfig = data?.featureConfigs?.['music'] as MusicConfig | undefined;
  const musicUrl = rawConfig?.url ?? '';
  const musicLoop = rawConfig?.loop !== false;
  const musicAutoplay = rawConfig?.autoplay !== false;

  // Initialize audio element
  useEffect(() => {
    if (!musicEnabled || !musicUrl) return;

    const audio = new Audio(musicUrl);
    audio.loop = musicLoop;
    audio.preload = 'metadata';
    audio.volume = 0.7;

    const onLoadedMeta = () => setDuration(audio.duration);
    const onTimeUpdate = () => {
      if (audio.duration) {
        setProgress(audio.currentTime / audio.duration);
      }
    };
    const onEnded = () => {
      if (!audio.loop) setPlaying(false);
    };

    audio.addEventListener('loadedmetadata', onLoadedMeta);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    audioRef.current = audio;

    // Attempt autoplay
    if (musicAutoplay) {
      audio.play().then(() => {
        setPlaying(true);
      }).catch(() => {
        setAutoplayBlocked(true);
      });
    }

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMeta);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.src = '';
      audioRef.current = null;
    };
  }, [musicEnabled, musicUrl, musicLoop, musicAutoplay]);

  // Update volume when muted changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : 0.7;
    }
  }, [muted]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setPlaying(true);
        setAutoplayBlocked(false);
      }).catch(() => {
        // ignore
      });
    }
  }, [playing]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => !prev);
  }, []);

  // rAF removed — timeupdate event (above) already updates progress.
  // The previous rAF loop ran at 60fps even when paused, causing ~64 setState/sec
  // when combined with the timeupdate listener. The timeupdate event alone is
  // sufficient for smooth progress bar updates.

  // Close on click outside
  useEffect(() => {
    if (!expanded) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [expanded]);

  if (!musicEnabled || !musicUrl) return null;

  const displayTitle = rawConfig?.title || 'Background Music';
  const displayArtist = rawConfig?.artist || '';

  const progressPercent = duration > 0 ? (progress * 100) : 0;

  return (
    <div
      ref={containerRef}
      className="fixed z-40 bottom-[calc(env(safe-area-inset-bottom)+72px)] right-4 md:bottom-6 md:right-6 flex items-end gap-2"
    >
      {/* Expanded mini player */}
      <div
        className={`flex items-center gap-3 bg-white/95 backdrop-blur-md border border-champagne-silk/60 rounded-2xl shadow-lg px-4 py-3 transition-all duration-300 origin-bottom-right ${
          expanded
            ? 'opacity-100 scale-100 translate-x-0'
            : 'opacity-0 scale-90 translate-x-4 pointer-events-none'
        }`}
        style={{ minWidth: '220px' }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-charcoal-ink truncate">{displayTitle}</p>
          {displayArtist && (
            <p className="text-[10px] text-charcoal-ink/50 truncate">{displayArtist}</p>
          )}
          {/* Progress bar */}
          <div className="mt-1.5 h-[2px] bg-charcoal-ink/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-cinematic-gold rounded-full transition-[width] duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={togglePlay}
            className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-charcoal-ink/5 transition-colors"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? (
              <Pause className="size-3.5 text-charcoal-ink" />
            ) : (
              <Play className="size-3.5 text-charcoal-ink" />
            )}
          </button>
          <button
            onClick={toggleMute}
            className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-charcoal-ink/5 transition-colors"
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? (
              <VolumeX className="size-3.5 text-charcoal-ink/40" />
            ) : (
              <Volume2 className="size-3.5 text-charcoal-ink" />
            )}
          </button>
        </div>
      </div>

      {/* Main floating button */}
      <button
        onClick={() => {
          if (autoplayBlocked) {
            // First click: start playing
            togglePlay();
            return;
          }
          setExpanded((prev) => !prev);
        }}
        className="h-10 w-10 rounded-full bg-white/95 backdrop-blur-md border border-champagne-silk/60 shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
        aria-label={autoplayBlocked ? 'Click to play music' : expanded ? 'Collapse music player' : 'Open music player'}
      >
        {autoplayBlocked ? (
          <Play className="size-4 text-cinematic-gold" />
        ) : (
          <Music2
            className={`size-4 text-cinematic-gold ${playing ? 'animate-pulse' : ''}`}
          />
        )}
      </button>

      {/* Autoplay blocked tooltip */}
      {autoplayBlocked && (
        <div className="absolute -top-8 right-0 bg-charcoal-ink text-paper-cream text-[10px] px-2 py-1 rounded-md whitespace-nowrap">
          Click to play
        </div>
      )}
    </div>
  );
}