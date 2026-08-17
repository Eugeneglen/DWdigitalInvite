'use client';

import { useState } from 'react';
import SectionBanner from '../SectionBanner';
import { usePublicWedding } from '@/hooks/usePublicWedding'
import { useWeddingSlug } from '@/hooks/useWeddingSlug';;

export default function QAPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { data, getField } = usePublicWedding(useWeddingSlug());

  const sectionTitle = getField('qa', 'title', '');
  const sectionSubtitle = getField('qa', 'subtitle', '');
  const contactPrompt = getField('qa', 'contactPrompt', '');
  const contactEmail = getField('qa', 'contactEmail', '');
  const ctaDescription = getField('qa', 'ctaDescription', '');
  const ctaButtonLabel = getField('qa', 'ctaButtonLabel', '');
  const ctaEyebrow = getField('qa', 'ctaEyebrow', '');

  const faqs = data?.faqs ?? [];

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <>
      <SectionBanner title={sectionTitle} />

      <main className="pb-section-gap px-4 md:px-canvas-margin max-w-[1440px] mx-auto min-h-screen pt-[20px] md:pt-[40px]">
        {/* Intro */}
        <section className="animate-orchestral max-w-[900px] mx-auto mb-20 text-center">
          <p
            className="text-charcoal-ink/70 max-w-2xl mx-auto leading-relaxed italic"
            style={{ fontSize: '18px', lineHeight: '32px' }}
          >
            {sectionSubtitle}
          </p>
        </section>

        {/* Accordion */}
        <section className="max-w-[800px] mx-auto mb-section-gap">
          <div className="border-t border-cinematic-gold/30">
            {faqs.map((faq, idx) => {
              const isOpen = openIndex === idx;
              return (
                <article key={faq.id} className={`animate-orchestral delay-${(idx + 1) * 100} border-b border-cinematic-gold/30 group`}>
                  <button
                    className="w-full py-10 flex justify-between items-center text-left focus:outline-none"
                    onClick={() => toggle(idx)}
                  >
                    <h3
                      className="text-charcoal-ink group-hover:text-cinematic-gold transition-colors duration-300 pr-8"
                      style={{ fontFamily: "'Playfair Display', serif", fontWeight: 500, fontSize: '22px' }}
                    >
                      {faq.question}
                    </h3>
                    <span
                      className={`text-cinematic-gold flex-shrink-0 transition-transform duration-400 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    >
                      <span className="material-symbols-outlined">expand_more</span>
                    </span>
                  </button>
                  <div
                    className={`overflow-hidden px-2 transition-all duration-500 ease-in-out ${
                      isOpen ? 'max-h-[500px] opacity-100 pb-10' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <p
                      className="text-charcoal-ink/80 leading-relaxed"
                      style={{ fontSize: '18px', lineHeight: '32px' }}
                    >
                      {faq.answer}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {faqs.length === 0 && null}

        {/* CTA — only render if there's meaningful content */}
        {contactPrompt && contactEmail && (
        <section className="animate-orchestral delay-400 max-w-2xl mx-auto bg-paper-cream/40 py-16 px-8 text-center">
          {ctaEyebrow && (
          <p
            className="text-cinematic-gold uppercase tracking-[0.2em] mb-3"
            style={{ fontSize: '12px', lineHeight: '16px', letterSpacing: '0.1em', fontWeight: 600 }}
          >
            {ctaEyebrow}
          </p>
          )}
          <h2
            className="text-charcoal-ink italic mb-4"
            style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '32px', lineHeight: '40px' }}
          >
            {contactPrompt}
          </h2>
          {ctaDescription && <p className="text-charcoal-ink/60 mb-10 max-w-md mx-auto" style={{ fontSize: '16px', lineHeight: '24px' }}>
            {ctaDescription}
          </p>}
          <a
            href={`mailto:${contactEmail}?subject=Wedding%20Inquiry`}
            className="bg-charcoal-ink text-paper-cream rounded px-8 py-3.5 text-[13px] font-semibold uppercase tracking-[0.08em] hover:opacity-90 transition-opacity duration-300 inline-flex items-center gap-2.5 no-underline"
          >
            <span className="material-symbols-outlined text-paper-cream" style={{ fontSize: '18px' }}>mail</span>
            {ctaButtonLabel || 'Contact'}
          </a>
        </section>
        )}
      </main>
    </>
  );
}