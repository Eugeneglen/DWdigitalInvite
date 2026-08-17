'use client';

import { useCallback } from 'react';
import { useNavigationStore } from '@/store/useNavigationStore';
import SectionBanner from '@/components/wedding/SectionBanner';
import { usePublicWedding } from '@/hooks/usePublicWedding'
import { useWeddingSlug } from '@/hooks/useWeddingSlug';;


function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '';
  try {
    // Handle bare HH:MM (e.g. "16:00") stored in DB
    const bareMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (bareMatch) {
      const h = parseInt(bareMatch[1], 10);
      const m = bareMatch[2];
      const period = h >= 12 ? 'PM' : 'AM';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${h12}:${m} ${period}`;
    }
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
  } catch {
    return '';
  }
}

function formatFullDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const day = d.toLocaleDateString('en-SG', { weekday: 'long' });
    const rest = d.toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' });
    return `${day}, ${rest}`;
  } catch {
    return '';
  }
}

function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

function getCalendarDateStr(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const end = new Date(d.getTime() + 7 * 60 * 60 * 1000); // +7 hours
    const fmt = (dt: Date) => {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      const h = String(dt.getHours()).padStart(2, '0');
      const min = String(dt.getMinutes()).padStart(2, '0');
      return `${y}${m}${day}T${h}${min}00`;
    };
    return `${fmt(d)}/${fmt(end)}`;
  } catch {
    return '';
  }
}

export default function SchedulePage() {
  const { data, getField } = usePublicWedding(useWeddingSlug());
  const { setSection } = useNavigationStore();

  const fullDateText = formatFullDate(data?.wedding.weddingDate);
  const shortDateText = formatShortDate(data?.wedding.weddingDate);
  const sectionTitle = getField('schedule', 'title', '');
  const timelineHeading = getField('schedule', 'subtitle', '');
  const venueName = data?.wedding.venue || '';
  const venueAddress = data?.wedding.venueAddress || '';
  const coupleName = data?.wedding.coupleName || '';

  const schedules = data?.schedules ?? [];
  const scheduleImages = data?.mediaByCategory?.schedule ?? [];

  // Use CMS images if available, otherwise no image (empty state)
  const ceremonyImg = scheduleImages[0]?.url || '';
  const celebrationImg = scheduleImages[1]?.url || '';

  // Wedding Venue toggle
  const venueEnabled = getField('getting-there', 'venueEnabled', 'true') === 'true';

  const handleAddToCalendar = useCallback(() => {
    const calendarDates = getCalendarDateStr(data?.wedding.weddingDate);
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `${coupleName} Wedding`,
      dates: calendarDates,
      details: (() => {
        const scheduleDetails = schedules
          .filter((s) => s.startTime)
          .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))
          .map((s) => {
            const time = formatTime(s.startTime);
            return `${time} — ${s.title}`;
          })
          .join('\n');
        return `Join us for our wedding celebration!\n\n${scheduleDetails}\n\n${venueName}\n${venueAddress}`;
      })() as string,
      location: venueName,
      sprop: `name:${coupleName}`,
    });
    window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank', 'noopener');
  }, [coupleName, venueName, venueAddress, schedules, data?.wedding.weddingDate]);

  return (
    <>
      {/* Banner */}
      <SectionBanner title={sectionTitle} />

      <main className="pb-section-gap px-4 md:px-canvas-margin max-w-[1440px] mx-auto min-h-screen pt-[20px] md:pt-[40px]">
        {/* Intro Images — only show if couple has uploaded them */}
        {(ceremonyImg || celebrationImg) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16 stagger-1">
          {ceremonyImg ? (
            <div className="aspect-[4/5] overflow-hidden rounded-lg">
              <img alt="The Ceremony" className="w-full h-full object-cover" src={ceremonyImg} />
            </div>
          ) : null}
          {celebrationImg ? (
            <div className="aspect-[4/5] overflow-hidden rounded-lg">
              <img alt="The Celebration" className="w-full h-full object-cover" src={celebrationImg} />
            </div>
          ) : null}
        </div>
        )}

        {/* Date line */}
        <section className="mb-24 text-center stagger-1">
          <p className="text-body-lg leading-body-lg text-charcoal-ink/70 max-w-2xl mx-auto italic">{fullDateText}</p>
        </section>

        {/* Timeline */}
        <section className="max-w-4xl mx-auto">
          <div className="mb-24 stagger-3">
            {/* Sticky heading */}
            <div className="sticky top-24 md:top-40 bg-paper-cream/90 backdrop-blur-sm z-30 py-4 mb-12 border-b border-champagne-silk/30 flex items-baseline gap-4">
              <h2 className="font-display-hero text-headline-md leading-headline-md font-medium md:text-headline-lg md:leading-headline-lg md:font-semibold text-charcoal-ink">{timelineHeading}</h2>
              <span className="font-utility-mono text-utility-mono leading-utility-mono font-medium text-charcoal-ink/60 italic tracking-wider uppercase">{shortDateText}</span>
            </div>

            <div className="relative border-l border-champagne-silk/40 ml-4 md:ml-8 pl-8 md:pl-16 flex flex-col gap-16">
              {schedules.map((item) => {
                const timeBadge = formatTime(item.startTime);
                return (
                  <div key={item.id} className="relative group">
                    <div className="absolute -left-[calc(2px+7px)] md:-left-[calc(2px+7px)] top-2.5 w-[6px] h-[6px] rounded-full bg-cinematic-gold" />
                    <div className="flex flex-col gap-2">
                      {timeBadge && (
                        <span className="inline-block self-start px-2.5 py-1 rounded bg-champagne-silk/40 text-[11px] font-medium uppercase tracking-widest text-charcoal-ink/70 mb-1">{timeBadge}</span>
                      )}
                      <h3 className="font-display-hero text-headline-md-mobile md:text-headline-lg-mobile md:leading-headline-lg-mobile md:font-semibold text-charcoal-ink">{item.title}</h3>
                      {item.description && (
                        <p className="text-body-md leading-body-md text-charcoal-ink/70 leading-relaxed">{item.description}</p>
                      )}
                      {item.location && (
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex items-center px-3 py-1 rounded-full bg-champagne-silk/30 text-charcoal-ink text-[10px] tracking-widest uppercase font-bold">{item.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Action Buttons */}
        <section className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-24 stagger-4">
          <button
            type="button"
            onClick={handleAddToCalendar}
            className="w-full sm:w-auto border border-charcoal-ink/15 bg-white rounded px-8 py-3 text-[13px] font-medium uppercase tracking-[0.08em] text-charcoal-ink hover:border-cinematic-gold hover:text-cinematic-gold transition-colors duration-300"
          >
            Add to Calendar
          </button>
          <button
            type="button"
            onClick={() => setSection('getting-there')}
            className="w-full sm:w-auto border border-charcoal-ink/15 bg-white rounded px-8 py-3 text-[13px] font-medium uppercase tracking-[0.08em] text-charcoal-ink hover:border-cinematic-gold hover:text-cinematic-gold transition-colors duration-300"
          >
            Directions
          </button>
        </section>

        {/* Wedding Venue Section */}
        {venueEnabled && (
        <section className="stagger-4 mb-24 flex flex-col md:flex-row gap-8 md:gap-12 items-center">
          <div className="w-full md:w-1/2 shrink-0">
            <div className="aspect-[4/3] overflow-hidden rounded border border-cinematic-gold/30">
              <img
                alt={`${venueName} — Wedding Venue`}
                className="w-full h-full object-cover"
                src={getField('getting-there', 'venueImage', '')}
              />
            </div>
          </div>
          <div className="w-full md:w-1/2 flex flex-col gap-4">
            <span className="text-label-sm leading-label-sm text-cinematic-gold tracking-[0.2em] uppercase font-semibold">Wedding Venue</span>
            <h3 className="font-display-hero text-headline-lg-mobile leading-headline-lg-mobile md:text-headline-md md:leading-headline-md font-semibold text-charcoal-ink">{venueName}</h3>
            <p className="text-body-md leading-body-md text-charcoal-ink/70 leading-relaxed">
              {getField('getting-there', 'venueDescription', '')}
            </p>
          </div>
        </section>
        )}
      </main>
    </>
  );
}