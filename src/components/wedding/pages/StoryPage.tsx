'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import SectionBanner from '../SectionBanner';
import { usePublicWedding } from '@/hooks/usePublicWedding'
import { useWeddingSlug } from '@/hooks/useWeddingSlug';;

interface Tidbit {
  q: string;
  a: string;
}

interface Destination {
  name: string;
}

function safeParseJSON<T>(str: string | undefined | null): T | null {
  if (!str) return null;
  try {
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
}

function formatStoryDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-SG', { month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function StoryPage() {
  const mainRef = useRef<HTMLElement>(null);
  const voterNameRef = useRef<string | null>(null);
  const [votes, setVotes] = useState<Record<number, boolean>>({});
  const [suggestion, setSuggestion] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [dbVoteCounts, setDbVoteCounts] = useState<Record<string, number>>({});
  const weddingSlug = useWeddingSlug();
  const { data, getField } = usePublicWedding(weddingSlug);

  const subtitle = getField('story', 'subtitle', '');
  const stories = (data?.stories && data.stories.length > 0) ? data.stories : [];
  const storyImages = data?.mediaByCategory?.story ?? [];
  const heroImg = storyImages[0]?.url || '';

  // Tidbits — read from CMS content, fallback to defaults
  const tidbitsEnabled = getField('story', 'tidbitsEnabled', 'true') === 'true';
  const tidbits = safeParseJSON<Tidbit[]>(getField('story', 'tidbits', ''));
  const tidbitsTitle = getField('story', 'tidbitsTitle', '');
  const tidbitsSubtitle = getField('story', 'tidbitsSubtitle', '');

  // Honeymoon — read from CMS content, fallback to defaults
  const honeymoonEnabled = getField('story', 'honeymoonEnabled', 'true') === 'true';
  const destinations = safeParseJSON<Destination[]>(getField('story', 'honeymoonDestinations', ''));
  const honeymoonTitle = getField('story', 'honeymoonTitle', '');
  const honeymoonSubtitle = getField('story', 'honeymoonSubtitle', '');
  const honeymoonVotes = safeParseJSON<Record<string, number>>(getField('story', 'honeymoonVotes', ''), {});
  const honeymoonEyebrow = getField('story', 'honeymoonEyebrow', '');

  const handleVote = useCallback(async (index: number) => {
    setVotes((prev) => {
      if (prev[index]) return prev;
      return { ...prev, [index]: true };
    });

    if (votes[index]) return;

    if (!voterNameRef.current) {
      const name = window.prompt('Your name');
      if (!name) return;
      voterNameRef.current = name;
    }

    const destName = (destinations ?? [])[index]?.name;
    if (!destName) return;

    try {
      await fetch('/api/story/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: destName, voterName: voterNameRef.current, weddingSlug }),
      });
      // Refresh vote counts from DB
      const res = await fetch(`/api/story/votes?weddingSlug=${encodeURIComponent(weddingSlug)}`);
      if (res.ok) {
        const json = await res.json();
        setDbVoteCounts(json.votes ?? {});
      }
    } catch {
      // Silently fail — local state already updated
    }
  }, [votes, destinations, weddingSlug]);

  const handleSubmit = useCallback(async () => {
    if (!suggestion.trim() || submitted) return;
    setSubmitted(true);

    if (!voterNameRef.current) {
      const name = window.prompt('Your name');
      if (!name) {
        setSubmitted(false);
        return;
      }
      voterNameRef.current = name;
    }

    try {
      await fetch('/api/story/suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: suggestion.trim(), suggestedBy: voterNameRef.current, weddingSlug }),
      });
    } catch {
      // Silently fail — local UI already shows submitted
    }
  }, [suggestion, submitted, weddingSlug]);

  // Fetch existing votes from DB on mount
  useEffect(() => {
    if (!weddingSlug) return;
    fetch(`/api/story/votes?weddingSlug=${encodeURIComponent(weddingSlug)}`)
      .then((res) => res.json())
      .then((json) => {
        setDbVoteCounts(json.votes ?? {});
      })
      .catch(() => {});
  }, [weddingSlug]);

  useEffect(() => {
    const container = mainRef.current;
    if (!container) return;
    const els = container.querySelectorAll('.reveal');
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Compute vote counts: DB votes + local session votes
  const getVoteCount = (index: number) => {
    const destName = (destinations ?? [])[index]?.name;
    if (!destName) return 0;
    const dbVotes = dbVoteCounts[destName] ?? 0;
    const localVote = votes[index] ? 1 : 0;
    return dbVotes + localVote;
  };

  const resolvedTidbits = tidbits ?? [];
  const resolvedDestinations = destinations ?? [];

  return (
    <>
      <SectionBanner title={getField('story', 'title', '')} />

      <main ref={mainRef} className="pb-section-gap px-4 md:px-canvas-margin max-w-[1440px] mx-auto min-h-screen pt-[20px] md:pt-[40px]">
        {/* Hero Section */}
        <section className="reveal max-w-[900px] mx-auto mb-20 flex flex-col items-center justify-center text-center">
          <p className="text-charcoal-ink max-w-2xl mx-auto opacity-80 mb-12 italic" style={{ fontSize: '18px', lineHeight: '32px' }}>
            {subtitle}
          </p>
          {heroImg ? (
            <div className="w-full max-w-4xl aspect-[16/9] inner-frame bg-surface-container-high overflow-hidden shadow-[0_20px_40px_rgba(26,26,26,0.08)]">
              <img alt="Our Story Hero" className="w-full h-full object-cover object-center" src={heroImg} />
            </div>
          ) : null}
        </section>

        {/* Timeline */}
        {stories.length > 0 && (
        <section className="reveal py-section-gap relative">
          <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-[1px] bg-champagne-silk/50 -translate-x-1/2" />
          <div className="flex flex-col gap-section-gap">
            {stories.map((story, idx) => {
              const isReversed = idx % 2 === 1;
              const dateLabel = formatStoryDate(story.date);
              const hasImage = !!story.imageUrl;
              return (
                <div key={story.id} className={`flex flex-col ${isReversed ? 'md:flex-row-reverse' : 'md:flex-row'} items-center justify-between w-full relative`}>
                  <div
                    className="absolute left-4 md:left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-cinematic-gold z-10"
                    style={{ boxShadow: '0 0 10px rgba(212,175,55,0.5)' }}
                  />
                  <div className={[
                    'w-full pl-12 md:pl-0 text-left',
                    hasImage ? 'md:w-5/12' : 'md:w-8/12 md:px-16',
                    isReversed ? (hasImage ? 'pl-0 md:pl-12' : 'pl-0 md:pl-16') : (hasImage ? 'md:text-right pr-0 md:pr-12' : 'md:text-center'),
                  ].join(' ')}>
                    {dateLabel && (
                      <span
                        className="text-cinematic-gold block mb-2 uppercase tracking-[0.2em]"
                        style={{ fontSize: '12px', lineHeight: '16px', letterSpacing: '0.1em', fontWeight: 600 }}
                      >
                        {dateLabel}
                      </span>
                    )}
                    <h3 className="text-charcoal-ink mb-4 italic" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 500, fontSize: '32px', lineHeight: '40px' }}>
                      {story.title}
                    </h3>
                    <p className="text-charcoal-ink/80 italic leading-relaxed" style={{ fontSize: '16px', lineHeight: '24px' }}>
                      {story.content}
                    </p>
                  </div>
                  {hasImage && (
                    <div className={`w-full pl-12 md:pl-0 md:w-5/12 flex ${isReversed ? 'justify-end' : 'justify-start'}`}>
                      <div className={`w-full inner-frame bg-surface-container overflow-hidden ${isReversed ? 'max-w-[350px] aspect-[3/4]' : 'max-w-[400px] aspect-square'}`}>
                        <img alt={story.title} className="w-full h-full object-cover" src={story.imageUrl} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </section>
        )}

        {/* Tidbits — only show if enabled and there are tidbits */}
        {tidbitsEnabled && resolvedTidbits.length > 0 && (
          <section className="reveal py-section-gap">
            <div className="text-center mb-16">
              <h2 className="text-[32px] md:text-[48px] text-charcoal-ink mb-4" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 600, lineHeight: '56px' }}>
                {tidbitsTitle}
              </h2>
              <p className="text-charcoal-ink/70 italic" style={{ fontSize: '16px', lineHeight: '24px' }}>
                {tidbitsSubtitle}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {resolvedTidbits.map((item, i) => (
                <div
                  key={i}
                  className="p-8 border border-champagne-silk/30 bg-white/50 backdrop-blur-sm hover:shadow-[0_8px_30px_rgba(26,26,26,0.04)] transition-all duration-300"
                >
                  <h4 className="font-headline-md text-[22px] text-charcoal-ink mb-3 font-semibold">
                    {item.q}
                  </h4>
                  <p className="text-charcoal-ink/80 italic" style={{ fontSize: '16px', lineHeight: '24px' }}>
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Honeymoon Widget — only show if enabled and there are destinations */}
        {honeymoonEnabled && resolvedDestinations.length > 0 && (
          <section className="reveal py-section-gap">
            <div className="max-w-2xl mx-auto text-center">
              <p
                className="text-cinematic-gold uppercase tracking-[0.2em] mb-3"
                style={{ fontSize: '12px', lineHeight: '16px', letterSpacing: '0.1em', fontWeight: 600 }}
              >
                {honeymoonEyebrow}
              </p>
              <h2
                className="text-charcoal-ink mb-3 italic"
                style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '40px', lineHeight: '48px' }}
              >
                {honeymoonTitle}
              </h2>
              <p
                className="text-charcoal-ink/60 mb-10 italic"
                style={{ fontSize: '16px', lineHeight: '24px' }}
              >
                {honeymoonSubtitle}
              </p>

              {/* Destination cards */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                {resolvedDestinations.map((dest, i) => {
                  const voteCount = getVoteCount(i);
                  return (
                    <button
                      key={dest.name}
                      type="button"
                      className={`bg-white border rounded-lg py-6 px-4 text-center transition-colors duration-200 cursor-pointer ${
                        votes[i]
                          ? 'border-cinematic-gold bg-cinematic-gold/5'
                          : 'border-charcoal-ink/10 hover:border-cinematic-gold/40'
                      }`}
                      onClick={() => handleVote(i)}
                    >
                      <p
                        className="text-charcoal-ink font-semibold"
                        style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', lineHeight: '24px' }}
                      >
                        {dest.name}
                      </p>
                      <p
                        className="text-charcoal-ink/50 mt-1"
                        style={{ fontSize: '14px', lineHeight: '20px' }}
                      >
                        {voteCount} {voteCount === 1 ? 'vote' : 'votes'}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Suggest input + submit */}
              <div className="flex gap-3 items-center">
                <input
                  type="text"
                  placeholder="Suggest a destination..."
                  value={suggestion}
                  onChange={(e) => setSuggestion(e.target.value)}
                  className="flex-1 bg-white border border-charcoal-ink/10 rounded-lg px-4 py-2.5 text-[14px] text-charcoal-ink placeholder:text-charcoal-ink/40 focus:outline-none focus:border-cinematic-gold/50 transition-colors"
                />
                <button
                  type="button"
                  className={`shrink-0 rounded-lg px-6 py-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] transition-opacity duration-300 ${
                    submitted ? 'bg-charcoal-ink/60 text-paper-cream/60 cursor-default' : 'bg-charcoal-ink text-paper-cream hover:opacity-90 cursor-pointer'
                  }`}
                  onClick={handleSubmit}
                >
                  {submitted ? 'Submitted' : 'Submit'}
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}