'use client';

import { useCallback } from 'react';
import { useNavigationStore } from '@/store/useNavigationStore';
import { usePublicWedding } from '@/hooks/usePublicWedding'
import { useWeddingSlug } from '@/hooks/useWeddingSlug';;

const CEREMONY_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAsLNSEjy771owdkkDbKTl1nE5oEzBQFVHob_HKiQb9eJb1X7I79-CxGjCPeKwCSHhwswJRqSrt3ox_aktMQUGlyzg6Eoo5R0aH6CYxxKj5f3uZCWdaDfZEIqmxwZd5DgdvCUWZfIdnNvixcYvcspOOFnGM2ThX9BPZz-ftetacA-b6CkxEEp9BdSatnTG55-e8tZz1jlG1euZgtw17iI67tcMGtR2azzCg8GvNH-xQPfUJlAXxGC3jU9Q7dbVZPK-xnHwtTl5eRNknueI';
const CELEBRATION_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuC01POr_eFI2RUG86kAb7dHs-q12Kj6HzxEoXpnzTnJ9n_VB9_BJL6Iy8vtGixOWTn1jVNZKDjXNQkHSy9Gsa8KI5IomZe3968VCNWHhXNZ44gbgs5LCBp4_Axjbj72RJwN0BWAIEmrqH8lgR-_j2_9Ci79wI4t583OCS4YuDca-s2xldrzBhBM-KeS4GFVFDSQdzWRY-4chmwkFfFgO3g-S4VS_jae416SCd-357i_ix3m68zwnHtpBSxyXFSjZISZ_Z66Jlxj6Npv_Lo';

const FALLBACK_BANNER_BG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuA-OyKfcsxXAmZDArHbDXl1cVCgGUG5liFPzyHdVvMG6_4jN9pNTrN9GCrkdnegli9UPJUSPs39KJRsRP7AiLem4xYS-q1ZYq1T3DAIqyvn3wAvbdkoMVkufft0SpQw4gDTPSnIml6k62lRYobUrNu70UGIILiMZQ0fAydTXXwVZ1oswQZ-mjPT8H9mDDqfhxsMSI5zla8GKz_ILXbmdRjtRUk682dPEDBD6I81DzEx7dITgjb6vxQoee5599jkYf_vCYP7npydvxqx';

const FALLBACK_SCHEDULE_ITEMS = [
  {
    id: 'fallback-1',
    eventType: 'ceremony',
    title: 'The Ceremony',
    description: 'Join us as we exchange our vows and start our new chapter together.',
    startTime: '2027-12-25T16:00:00',
    endTime: null,
    location: 'Formal Attire',
    sortOrder: 0,
  },
  {
    id: 'fallback-2',
    eventType: 'cocktail',
    title: 'Cocktail Hour',
    description: 'Enjoy signature drinks and light hors d\'oeuvres in the garden courtyard.',
    startTime: '2027-12-25T17:30:00',
    endTime: null,
    location: null,
    sortOrder: 1,
  },
  {
    id: 'fallback-3',
    eventType: 'dinner',
    title: 'Dinner & Dancing',
    description: 'A seated dinner followed by a night of celebration, music, and joy on the dance floor.',
    startTime: '2027-12-25T19:00:00',
    endTime: null,
    location: null,
    sortOrder: 2,
  },
];

const FALLBACK_DATE_TEXT = 'Saturday, December 25, 2027';
const FALLBACK_SHORT_DATE = 'December 25, 2027';
const FALLBACK_VENUE = 'The Singapore EDITION';
const FALLBACK_VENUE_ADDRESS = '38 Cuscaden Road, Singapore 249731';
const FALLBACK_VENUE_DESCRIPTION = 'Nestled in the heart of Orchard Road, The Singapore EDITION is a luxury boutique hotel blending timeless elegance with modern sophistication. Its intimate event spaces and bespoke service make it the perfect setting for an unforgettable celebration.';
const FALLBACK_VENUE_IMAGE = 'https://sfile.chatglm.cn/images-ppt/4adf4afbb9a2.jpg';
const FALLBACK_COUPLE_NAME = 'Eleanor & James';

function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '';
  try {
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
  } catch {
    return '';
  }
}

function formatFullDate(dateStr: string | null | undefined): string {
  if (!dateStr) return FALLBACK_DATE_TEXT;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return FALLBACK_DATE_TEXT;
    const day = d.toLocaleDateString('en-SG', { weekday: 'long' });
    const rest = d.toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' });
    return `${day}, ${rest}`;
  } catch {
    return FALLBACK_DATE_TEXT;
  }
}

function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return FALLBACK_SHORT_DATE;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return FALLBACK_SHORT_DATE;
    return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return FALLBACK_SHORT_DATE;
  }
}

function getCalendarDateStr(dateStr: string | null | undefined): string {
  if (!dateStr) return '20271225T160000/20271225T230000';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '20271225T160000/20271225T230000';
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
    return '20271225T160000/20271225T230000';
  }
}

export default function SchedulePage() {
  const { data, getField } = usePublicWedding(useWeddingSlug());
  const { setSection } = useNavigationStore();

  const bannerUrl = data?.wedding.bannerUrl || FALLBACK_BANNER_BG;
  const fullDateText = formatFullDate(data?.wedding.weddingDate);
  const shortDateText = formatShortDate(data?.wedding.weddingDate);
  const sectionTitle = getField('schedule', 'title', 'The Schedule');
  const timelineHeading = getField('schedule', 'subtitle', 'The Celebration');
  const venueName = data?.wedding.venue || FALLBACK_VENUE;
  const venueAddress = data?.wedding.venueAddress || FALLBACK_VENUE_ADDRESS;
  const coupleName = data?.wedding.coupleName || FALLBACK_COUPLE_NAME;

  const schedules = (data?.schedules && data.schedules.length > 0) ? data.schedules : FALLBACK_SCHEDULE_ITEMS;
  const scheduleImages = data?.mediaByCategory?.schedule ?? [];

  // Use CMS images if available, otherwise no image (empty state)
  const ceremonyImg = scheduleImages[0]?.url || '';
  const celebrationImg = scheduleImages[1]?.url || '';

  const handleAddToCalendar = useCallback(() => {
    const calendarDates = getCalendarDateStr(data?.wedding.weddingDate);
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `${coupleName} Wedding`,
      dates: calendarDates,
      details: (() => {
        const scheduleDetails = schedules
          .filter((s) => s.startTime)
          .sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime())
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
      <div
        className="w-full h-[360px] md:h-[420px] bg-cover bg-center mt-[54px] md:mt-[64px] relative z-40 border-b border-champagne-silk/20 flex items-center justify-center"
        style={{ backgroundImage: `url('${bannerUrl}')` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-paper-cream/30 via-paper-cream/10 to-paper-cream/60" />
        <div className="relative z-10 text-center px-6">
          <h1 className="font-display-hero text-[44px] md:text-[72px] leading-[1.05] text-charcoal-ink tracking-tight font-bold drop-shadow-sm">{sectionTitle}</h1>
        </div>
      </div>

      <main className="pb-section-gap px-4 md:px-canvas-margin max-w-[1440px] mx-auto min-h-screen pt-[20px] md:pt-[40px]">
        {/* Intro Images — only show if couple has uploaded them */}
        {(ceremonyImg || celebrationImg) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16 stagger-1">
          {ceremonyImg ? (
            <div className="aspect-[4/5] overflow-hidden rounded-lg">
              <img alt="The Ceremony" className="w-full h-full object-cover" src={ceremonyImg} />
            </div>
          ) : <div className="aspect-[4/5] rounded-lg bg-champagne-silk/20 flex items-center justify-center"><p className="text-charcoal-ink/25 text-xs italic">Photo coming soon</p></div>}
          {celebrationImg ? (
            <div className="aspect-[4/5] overflow-hidden rounded-lg">
              <img alt="The Celebration" className="w-full h-full object-cover" src={celebrationImg} />
            </div>
          ) : <div className="aspect-[4/5] rounded-lg bg-champagne-silk/20 flex items-center justify-center"><p className="text-charcoal-ink/25 text-xs italic">Photo coming soon</p></div>}
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
        <section className="stagger-4 mb-24 flex flex-col md:flex-row gap-8 md:gap-12 items-center">
          <div className="w-full md:w-1/2 shrink-0">
            <div className="aspect-[4/3] overflow-hidden rounded border border-cinematic-gold/30">
              <img
                alt={`${venueName} — Wedding Venue`}
                className="w-full h-full object-cover"
                src={getField('getting-there', 'venueImage', FALLBACK_VENUE_IMAGE)}
              />
            </div>
          </div>
          <div className="w-full md:w-1/2 flex flex-col gap-4">
            <span className="text-label-sm leading-label-sm text-cinematic-gold tracking-[0.2em] uppercase font-semibold">Wedding Venue</span>
            <h3 className="font-display-hero text-headline-lg-mobile leading-headline-lg-mobile md:text-headline-md md:leading-headline-md font-semibold text-charcoal-ink">{venueName}</h3>
            <p className="text-body-md leading-body-md text-charcoal-ink/70 leading-relaxed">
              {getField('getting-there', 'venueDescription', FALLBACK_VENUE_DESCRIPTION)}
            </p>
          </div>
        </section>
      </main>
    </>
  );
}