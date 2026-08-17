'use client';

import { useState, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import SectionBanner from '../SectionBanner';
import { usePublicWedding } from '@/hooks/usePublicWedding'
import { useWeddingSlug } from '@/hooks/useWeddingSlug';;
import { useLiveWeddingData, type LiveWish } from '@/hooks/useLiveWeddingData';

export default function WishesPage() {
  return (
    <Suspense>
      <WishesPageInner />
    </Suspense>
  );
}

function WishesPageInner() {
  const { data, getField } = usePublicWedding(useWeddingSlug());
  const weddingId = data?.wedding?.id;
  const { liveWishes, addWish } = useLiveWeddingData({ weddingId });

  const searchParams = useSearchParams();

  const sectionTitle = getField('wishes', 'title', '');
  const sectionSubtitle = getField('wishes', 'subtitle', '');
  const nameLabel = getField('wishes', 'nameLabel', 'Full Name');
  const messageLabel = getField('wishes', 'messageLabel', 'Your Message');
  const relationshipLabel = getField('wishes', 'relationshipLabel', 'Relationship');
  const submitLabel = getField('wishes', 'submitLabel', 'Submit');
  const heirloomLabel = getField('wishes', 'heirloomLabel', '');
  const formEyebrow = getField('wishes', 'formEyebrow', '');
  const formHeading = getField('wishes', 'formHeading', '');

  // Auto-fill the name from URL params (?name= or ?first=&last=).
  // Matches the RSVP page pattern so a single shared invitation link
  // (e.g. /?name=John+Doe or /?first=John&last=Doe) pre-populates both
  // the RSVP form AND this wishes form. Guest can still edit the field.
  const autoName = useMemo(() => {
    const paramFirst = searchParams.get('first');
    const paramLast = searchParams.get('last');
    const paramName = searchParams.get('name');
    if (paramFirst && paramLast) {
      return `${paramFirst} ${paramLast}`.trim();
    }
    if (paramName) {
      return paramName.trim();
    }
    return '';
  }, [searchParams]);

  const [name, setName] = useState(autoName);
  const [relationship, setRelationship] = useState('');
  const [message, setMessage] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Convert a selected File to a base64 data URL (same pattern as the
  // couple CMS InlineImageUpload / SectionImageUpload components).
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type + size (10MB limit, matching the displayed hint)
    if (!file.type.startsWith('image/')) {
      e.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(reader.result as string);
      setImageFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageDataUrl(null);
    setImageFileName('');
  };

  // Build the CMS wish cards from data.wishes
  const cmsWishCards = (data?.wishes ?? []).map((w, i) => ({
    type: w.imageUrl ? 'image' as const : (i % 2 === 0 ? 'text-card' as const : 'dark-card' as const),
    img: w.imageUrl ?? undefined,
    role: w.relationship ?? undefined,
    quote: w.message,
    author: w.name,
  }));

  // Combine: CMS wishes + optimistic local wishes + hardcoded fallback
  const allCards: typeof cmsWishCards = [
    ...cmsWishCards,
    ...liveWishes.map((w: LiveWish, i) => ({
      type: w.imageUrl ? 'image' as const : (i % 2 === 0 ? 'text-card' as const : 'dark-card' as const),
      img: w.imageUrl ?? undefined,
      role: w.relationship ?? undefined,
      quote: w.message ?? '',
      author: w.name ?? '',
    })),
    // No hardcoded fallback wishes
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/wishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          relationship: relationship.trim() || undefined,
          message: message.trim(),
          weddingId,
          imageUrl: imageDataUrl || undefined,
        }),
      });
      if (!res.ok) {
        setSubmitting(false);
        return;
      }
      const result = await res.json();

      // Optimistically add the new wish to the top of the displayed list
      // (WebSocket will also broadcast, but dedup prevents double-display)
      if (result?.wish) {
        addWish(result.wish as LiveWish);
      }
    } catch {
      setSubmitting(false);
      return;
    }

    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setName('');
        setRelationship('');
        setMessage('');
        clearImage();
      }, 3000);
    }, 1500);
  };

  return (
    <>
      <SectionBanner title={sectionTitle || undefined} />

      <main className="pb-section-gap px-4 md:px-canvas-margin max-w-[1440px] mx-auto min-h-screen pt-[20px] md:pt-[40px]">
        {/* Intro */}
        {(heirloomLabel || sectionSubtitle) && (
        <section className="max-w-[1440px] mx-auto px-8 md:px-canvas-margin mb-24 text-center">
          {heirloomLabel && (
          <span className="text-cinematic-gold uppercase mb-4 block tracking-[0.4em]" style={{ fontSize: '12px', lineHeight: '16px', letterSpacing: '0.1em', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
            {heirloomLabel}
          </span>
          )}
          {sectionSubtitle && (
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-charcoal-ink/70 leading-relaxed italic">
            {sectionSubtitle}
          </p>
          )}
        </section>
        )}

        {/* Masonry Wish Cards */}
        <section className="max-w-[1440px] mx-auto px-8 md:px-canvas-margin mb-32">
          <div className="masonry-grid">
            {allCards.map((wish, i) => (
              <div key={i} className="wish-card">
                {wish.type === 'image' && (
                  <>
                    <div className="inner-frame mb-8 overflow-hidden group">
                      <img
                        alt={wish.author}
                        className="w-full h-auto grayscale hover:grayscale-0 transition-all duration-1000 scale-100 group-hover:scale-105"
                        src={wish.img}
                      />
                    </div>
                    <div className="px-2">
                      <span
                        className="text-cinematic-gold mb-3 block uppercase"
                        style={{ fontSize: '12px', lineHeight: '16px', letterSpacing: '0.1em', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}
                      >
                        {wish.role}
                      </span>
                      <h3 className="text-3xl italic mb-4 leading-tight">{wish.quote}</h3>
                      <p className="text-charcoal-ink/50">— {wish.author}</p>
                    </div>
                  </>
                )}

                {wish.type === 'text-card' && (
                  <div className="bg-white p-12 border border-champagne-silk/20 shadow-sm">
                    <div className="flex justify-center mb-10">
                      <span className="material-symbols-outlined text-cinematic-gold text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                    </div>
                    <p className="text-xl text-center leading-relaxed text-charcoal-ink/80 italic mb-10">
                      {wish.quote}
                    </p>
                    <div className="text-center">
                      <div className="h-px w-16 bg-cinematic-gold/30 mx-auto mb-6" />
                      <p
                        className="uppercase tracking-[0.2em] text-charcoal-ink"
                        style={{ fontSize: '12px', lineHeight: '16px', letterSpacing: '0.1em', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}
                      >
                        {wish.author}
                      </p>
                    </div>
                  </div>
                )}

                {wish.type === 'dark-card' && (
                  <div className="bg-charcoal-ink text-paper-cream p-12">
                    <span className="text-7xl text-cinematic-gold/40 block mb-6" style={{ fontFamily: 'serif' }}>
                      "
                    </span>
                    <p className="text-3xl leading-tight mb-12 italic">
                      {wish.quote}
                    </p>
                    <div className="pt-6 border-t border-paper-cream/10">
                      <p
                        className="tracking-[0.3em] uppercase"
                        style={{ fontSize: '12px', lineHeight: '16px', letterSpacing: '0.1em', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}
                      >
                        {wish.author}
                      </p>
                    </div>
                  </div>
                )}

                {wish.type === 'minimal' && (
                  <div className="p-10 border-l-4 border-cinematic-gold bg-white/40">
                    <p className="text-2xl italic leading-relaxed mb-8">
                      {wish.quote}
                    </p>
                    <p
                      className="text-cinematic-gold tracking-widest"
                      style={{ fontSize: '12px', lineHeight: '16px', letterSpacing: '0.1em', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}
                    >
                      {wish.author}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Contribution Form */}
        <section className="max-w-[1440px] mx-auto px-8 md:px-canvas-margin mb-32">
          <div className="max-w-2xl mx-auto">
            {/* Section header */}
            {(formEyebrow || formHeading) && (
            <div className="text-center mb-12">
              {formEyebrow && (
              <p
                className="text-cinematic-gold uppercase tracking-[0.2em] mb-3"
                style={{ fontSize: '12px', lineHeight: '16px', letterSpacing: '0.1em', fontWeight: 600 }}
              >
                {formEyebrow}
              </p>
              )}
              {formHeading && (
              <h2
                className="text-charcoal-ink italic"
                style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '32px', lineHeight: '40px' }}
              >
                {formHeading}
              </h2>
              )}
            </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Full Name */}
              <input
                type="text"
                placeholder={nameLabel}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-line"
              />

              {/* Relationship */}
              <input
                type="text"
                placeholder={relationshipLabel}
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="input-line"
              />

              {/* Your Message */}
              <textarea
                placeholder={messageLabel}
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="input-line resize-none"
              />

              {/* Upload area — functional file input with preview */}
              <div className="border-2 border-dashed border-charcoal-ink/15 rounded bg-paper-cream/40 text-center select-none">
                {imageDataUrl ? (
                  <div className="relative p-4">
                    <img
                      src={imageDataUrl}
                      alt={imageFileName || 'Selected photo'}
                      className="max-h-64 mx-auto rounded"
                    />
                    <p className="text-[12px] text-charcoal-ink/40 mt-2 truncate">{imageFileName}</p>
                    <button
                      type="button"
                      onClick={clearImage}
                      className="mt-2 text-[12px] text-charcoal-ink/50 hover:text-red-600 transition-colors uppercase tracking-[0.1em]"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="block py-8 px-4 cursor-pointer hover:bg-paper-cream/60 transition-colors">
                    <span className="material-symbols-outlined text-charcoal-ink/30 text-[32px] mb-2 block">cloud_upload</span>
                    <p className="text-[14px] text-charcoal-ink/40">
                      Attach a photo or memento
                    </p>
                    <p className="text-[12px] text-charcoal-ink/25 mt-1">
                      JPG, PNG up to 10MB
                    </p>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileSelect}
                      className="sr-only"
                    />
                  </label>
                )}
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={submitting}
                className={`w-full rounded py-3.5 text-[13px] font-semibold uppercase tracking-[0.08em] transition-all duration-300 ${
                  submitting
                    ? 'bg-charcoal-ink/60 text-paper-cream/60 cursor-default'
                    : submitted
                    ? 'bg-charcoal-ink/60 text-paper-cream/60 cursor-default'
                    : 'bg-charcoal-ink text-paper-cream hover:opacity-90 cursor-pointer'
                }`}
              >
                {submitting ? 'Submitting...' : submitted ? 'Woven' : submitLabel}
              </button>
            </form>
          </div>
        </section>
      </main>
    </>
  );
}