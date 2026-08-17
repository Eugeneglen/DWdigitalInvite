'use client';

import { useState, useEffect, useRef } from 'react';
import SectionBanner from '../SectionBanner';
import { usePublicWedding } from '@/hooks/usePublicWedding'
import { useWeddingSlug } from '@/hooks/useWeddingSlug';;

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

export default function MomentsPage() {
  const { ref, visible } = useReveal();
  const { data, getField } = usePublicWedding(useWeddingSlug());

  const sectionTitle = getField('moments', 'title', '');
  const subtitle = getField('moments', 'subtitle', '');

  const galleryMedia = (data?.mediaByCategory?.moments && data.mediaByCategory.moments.length > 0)
    ? data.mediaByCategory.moments
    : null;

  const photos = galleryMedia
    ? galleryMedia.map((m) => ({ alt: m.fileName || 'Gallery Photo', src: m.url }))
    : [];

  return (
    <>
      <SectionBanner title={sectionTitle} />

      <main className="pb-section-gap px-4 md:px-canvas-margin max-w-[1440px] mx-auto min-h-screen pt-[20px] md:pt-[40px]">
        {/* Intro */}
        <section className="max-w-[1440px] mx-auto px-8 md:px-canvas-margin mb-24 text-center">
          <p className="max-w-2xl mx-auto text-charcoal-ink/70 leading-relaxed italic" style={{ fontSize: '18px', lineHeight: '32px' }}>
            {subtitle}
          </p>
        </section>

        {/* Masonry Photo Grid */}
        <section ref={ref} className="max-w-[1440px] mx-auto px-4 md:px-8">
          {photos.length > 0 && (
          <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-6">
            {photos.map((photo, idx) => (
              <div
                key={idx}
                className="break-inside-avoid mb-6 relative group inner-frame overflow-hidden bg-white p-4 shadow-sm"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0)' : 'translateY(20px)',
                  transition: `all 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.1}s`,
                }}
              >
                <img
                  alt={photo.alt}
                  className="w-full h-auto object-cover transition-transform duration-700 ease-out mb-4 group-hover:scale-105"
                  src={photo.src}
                />
              </div>
            ))}
          </div>
          )}
        </section>
      </main>
    </>
  );
}