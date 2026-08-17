'use client';

import { useState, useEffect } from 'react';
import { useNavigationStore } from '@/store/useNavigationStore';
import { usePublicWedding } from '@/hooks/usePublicWedding'
import { useWeddingSlug } from '@/hooks/useWeddingSlug';;
import { useLiveWeddingData } from '@/hooks/useLiveWeddingData';
import { useImageAutoContrast } from '@/hooks/useImageAutoContrast';
import { useHeroAutoContrast } from '@/hooks/useHeroAutoContrast';



function useCountdown(targetTimestamp: number) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });

  useEffect(() => {
    const calc = () => {
      const now = Date.now();
      const diff = Math.max(0, targetTimestamp - now);
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        mins: Math.floor((diff / (1000 * 60)) % 60),
        secs: Math.floor((diff / 1000) % 60),
      });
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [targetTimestamp]);

  return timeLeft;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

function parseWeddingTimestamp(dateStr: string | null | undefined): number {
  if (!dateStr) return Date.now() + 365*24*3600*1000;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return Date.now() + 365*24*3600*1000;
    return d.getTime();
  } catch {
    return Date.now() + 365*24*3600*1000;
  }
}

export default function HomePage() {
  const { data, getField } = usePublicWedding(useWeddingSlug());

  const bannerUrl = data?.wedding.bannerUrl || '';
  const heroImgUrl = data?.wedding.heroImageUrl || '';

  // Independent auto-contrast for the banner headline — samples the actual
  // banner IMAGE pixels (not the page background) to pick text colour.
  const { textColor: bannerTextColor, subtitleColor: bannerSubtitleColor, textShadow: bannerTextShadow } = useImageAutoContrast(bannerUrl);
  const heroVideoUrl = data?.wedding.heroVideoUrl || null;

  // Hero section auto-contrast — samples the BOTTOM of the image where text sits
  const heroContrast = useHeroAutoContrast(heroImgUrl, heroVideoUrl);
  const coupleName = getField('hero', 'title') || data?.wedding.coupleName || '';
  const heroSubtitle = getField('hero', 'subtitle', '');
  const dateText = getField('hero', 'dateDisplay') || formatDate(data?.wedding.weddingDate);
  const countdownDateStr = getField('hero', 'countdownDate');
  const weddingTimestamp = countdownDateStr
    ? parseWeddingTimestamp(countdownDateStr)
    : parseWeddingTimestamp(data?.wedding.weddingDate);
  const heroDescription = getField('hero', 'description', '');

  // Ceremony section
  const teaCeremonyEnabled = getField('hero', 'teaCeremonyEnabled', 'true') === 'true';
  const teaCeremonyImage = getField('hero', 'teaCeremonyImage', '');
  const teaCeremonyLabel = getField('hero', 'teaCeremonyLabel', '');
  const teaCeremonyTitle = getField('hero', 'teaCeremonyTitle', '');
  const teaCeremonyBody = getField('hero', 'teaCeremonyBody', '');

  const teaCeremonySection = (teaCeremonyEnabled && teaCeremonyImage && teaCeremonyTitle) ? (
          <section className="py-section-gap px-4 md:px-canvas-margin max-w-[1440px] mx-auto">
            <div className="max-w-4xl mx-auto flex flex-col items-center">
              <div className="relative w-full aspect-[2/3] md:aspect-auto md:h-[800px] overflow-hidden rounded-lg shadow-xl mb-8 group">
                <img
                  alt={teaCeremonyTitle}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  src={teaCeremonyImage}
                />
              </div>
              <div className="text-center">
                <span className="font-label-sm text-label-sm leading-label-sm text-cinematic-gold tracking-[0.2em] uppercase block mb-2 font-semibold">{teaCeremonyLabel}</span>
                <h3 className="font-display-hero text-headline-lg-mobile leading-headline-lg-mobile md:text-headline-lg md:leading-headline-lg font-semibold text-charcoal-ink">{teaCeremonyTitle}</h3>
                {teaCeremonyBody && (
                  <p className="font-body-md text-body-md text-charcoal-ink/80 leading-relaxed mt-4 max-w-2xl mx-auto">{teaCeremonyBody}</p>
                )}
              </div>
            </div>
          </section>
  ) : null;

  // CMS font — applied ONLY to the master head copy (couple name)
  const heroFont = getField('hero', 'fontFamily', '');

  // Narrative section
  const narrativeLabel = getField('hero', 'narrativeLabel', '');
  const narrativeTitle = getField('hero', 'narrativeTitle', '');
  const narrativeBody = getField('hero', 'narrativeBody', '');

  const countdown = useCountdown(weddingTimestamp);
  const { setSection } = useNavigationStore();
  const [showFab, setShowFab] = useState(false);

  // Live wedding data
  const weddingId = data?.wedding.id ?? null;
  const { isConnected, rsvpFlash, liveRsvpIncrement } = useLiveWeddingData({ weddingId });
  const baseRsvpCount = data?.rsvpCount ?? 0;
  const displayRsvpCount = baseRsvpCount + liveRsvpIncrement;

  useEffect(() => {
    const onScroll = () => setShowFab(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      {/* ===== TOP BANNER ===== */}
      {bannerUrl && (
      <div
        className="w-full h-[360px] md:h-[420px] mt-[54px] md:mt-[64px] relative z-40 flex items-center justify-center"
        style={{ backgroundImage: `url('${bannerUrl}')` }}
      >
        <div className="relative z-10 text-center px-6">
          {coupleName && (
          <h1
            className="font-display-hero text-[44px] md:text-[72px] leading-[1.05] tracking-tight font-bold"
            style={{
              fontFamily: `'${heroFont}', serif`,
              color: bannerTextColor,
              textShadow: bannerTextShadow,
            }}
          >
            {coupleName}
          </h1>
          )}
          {heroSubtitle && (
            <p
              className="mt-2 text-sm md:text-base italic tracking-wide"
              style={{ color: bannerSubtitleColor }}
            >
              {heroSubtitle}
            </p>
          )}
        </div>
      </div>
      )}

      {/* ===== MAIN CONTENT ===== */}
      <main className="pb-section-gap px-4 md:px-canvas-margin max-w-[1440px] mx-auto min-h-screen pt-[20px] md:pt-[40px]">
        {/* ===== HERO SECTION ===== */}
        {(heroVideoUrl || heroImgUrl || dateText || heroDescription) && (
        <section className="relative w-full flex flex-col justify-end overflow-hidden" style={{ minHeight: (heroVideoUrl || heroImgUrl) ? '795px' : 'auto', height: (heroVideoUrl || heroImgUrl) ? undefined : 'auto' }}>
          {/* Background — full bleed, video or image */}
          <div className="absolute inset-0 z-0" style={{ display: (heroVideoUrl || heroImgUrl) ? 'block' : 'none' }}>
            {heroVideoUrl ? (
              <video
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover object-center"
                src={heroVideoUrl}
              />
            ) : heroImgUrl ? (
              <img
                alt="Hero Wedding Portrait"
                className="w-full h-full object-cover object-center"
                src={heroImgUrl}
              />
            ) : null}
          </div>

          {/* Content Overlay */}
          <div className="relative z-10 w-full px-8 md:px-24 pb-20 md:pb-32 flex flex-col items-center text-center">
            {/* Master Date Badge */}
            <div
              className="animate-fade-in delay-100 mb-8 inline-flex items-center justify-center border px-6 py-2 rounded-full backdrop-blur-sm"
              style={{
                borderColor: heroContrast.borderColor,
                backgroundColor: heroContrast.cardBg,
              }}
            >
              <span
                className="font-label-sm text-label-sm leading-label-sm tracking-[0.2em] uppercase font-semibold"
                style={{
                  color: heroContrast.textColor,
                  textShadow: heroContrast.textShadow,
                }}
              >
                {dateText}
              </span>
            </div>

            {/* Description */}
            <p
              className="animate-slide-up delay-300 font-body-md text-body-md leading-body-md max-w-md mx-auto mb-12 italic"
              style={{
                color: heroContrast.textColorMuted,
                textShadow: heroContrast.textShadow,
              }}
            >
              {heroDescription}
            </p>

            {/* Countdown Component */}
            <div className="animate-slide-up delay-400 grid grid-cols-4 gap-3 md:gap-4 w-full max-w-md mx-auto">
              {[
                { value: countdown.days, label: 'DAYS' },
                { value: countdown.hours, label: 'HOURS' },
                { value: countdown.mins, label: 'MINS' },
                { value: countdown.secs, label: 'SECS' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col items-center justify-center rounded-lg border backdrop-blur-sm py-4 md:py-5"
                  style={{
                    borderColor: heroContrast.borderColor,
                    backgroundColor: heroContrast.cardBg,
                  }}
                >
                  <span
                    className="font-display-hero text-3xl md:text-4xl font-bold leading-none"
                    style={{
                      color: heroContrast.textColor,
                      textShadow: heroContrast.textShadowStrong,
                    }}
                  >
                    {String(item.value).padStart(2, '0')}
                  </span>
                  <span
                    className="font-label-sm text-[9px] md:text-[10px] tracking-widest uppercase mt-2 font-semibold"
                    style={{
                      color: heroContrast.textColorMuted,
                      textShadow: heroContrast.textShadow,
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Live RSVP Counter */}
          {isConnected && displayRsvpCount > 0 && (
            <div
              className={`relative z-10 mt-6 animate-fade-in flex items-center justify-center gap-2 transition-all duration-500 ${
                rsvpFlash ? 'scale-105' : 'scale-100'
              }`}
              style={{ textShadow: heroContrast.textShadow }}
            >
              <span className="text-base">🎉</span>
              <span
                className="font-label-sm text-label-sm tracking-wide"
                style={{ color: heroContrast.textColorMuted }}
              >
                <span className="font-bold" style={{ color: heroContrast.textColor }}>{displayRsvpCount}</span>{' '}
                {displayRsvpCount === 1 ? 'guest has' : 'guests have'} RSVP'd
              </span>
              <span className="relative flex h-2 w-2 ml-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
            </div>
          )}

          {/* Scroll Indicator */}
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 animate-fade-in delay-400 flex flex-col items-center opacity-70"
            style={{ textShadow: heroContrast.textShadow }}
          >
            <span
              className="font-label-sm text-[10px] tracking-widest mb-2 uppercase font-semibold"
              style={{ color: heroContrast.textColorMuted }}
            >
              Scroll
            </span>
            <span
              className="material-symbols-outlined animate-bounce"
              style={{ color: heroContrast.textColorMuted }}
            >
              arrow_downward
            </span>
          </div>
        </section>
        )}

        {teaCeremonySection}

        {/* ===== NARRATIVE SECTION ===== */}
        {narrativeTitle && (
        <section className="py-section-gap px-4 md:px-canvas-margin max-w-[1440px] mx-auto">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            {narrativeLabel && <span className="font-label-sm text-label-sm leading-label-sm text-cinematic-gold tracking-[0.2em] uppercase block font-semibold">{narrativeLabel}</span>}
            <h3 className="font-display-hero text-headline-lg-mobile leading-headline-lg-mobile md:text-headline-lg md:leading-headline-lg font-semibold text-charcoal-ink">{narrativeTitle}</h3>
            {narrativeBody && <p className="font-body-md text-body-md text-charcoal-ink/80 leading-relaxed">
              {narrativeBody}
            </p>}
          </div>
        </section>
        )}
      </main>

      {/* ===== FLOATING ACTION BUTTON ===== */}
      <div
        className={`fixed bottom-24 right-6 md:bottom-12 md:right-12 z-[55] transition-transform duration-300 ${
          showFab ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
        }`}
      >
        <button
          onClick={() => setSection('rsvp')}
          className="bg-charcoal-ink text-paper-cream w-16 h-16 rounded-full shadow-[0_8px_30px_rgba(26,26,26,0.12)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all border border-cinematic-gold/30"
        >
          <span className="material-symbols-outlined">edit_calendar</span>
        </button>
      </div>
    </>
  );
}