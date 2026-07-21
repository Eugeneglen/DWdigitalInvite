'use client';

import { useState } from 'react';
import SectionBanner from '../SectionBanner';
import { usePublicWedding } from '@/hooks/usePublicWedding'
import { useWeddingSlug } from '@/hooks/useWeddingSlug';;

const FALLBACK_VENUE = 'The Singapore EDITION';
const FALLBACK_ADDRESS = '38 Cuscaden Road, Singapore 249731';

export default function GettingTherePage() {
  const [tab, setTab] = useState<'car' | 'transit'>('transit');
  const { data, getField } = usePublicWedding(useWeddingSlug());

  const venueName = data?.wedding.venue || FALLBACK_VENUE;
  const venueAddress = data?.wedding.venueAddress || FALLBACK_ADDRESS;

  const carContent = getField('getting-there', 'carContent', '');
  const transitContent = getField('getting-there', 'transitContent', '');
  const carTitle = getField('getting-there', 'carTitle', 'BY CAR');
  const transitTitle = getField('getting-there', 'transitTitle', 'PUBLIC TRANSIT');
  const parkingNote = getField('getting-there', 'parkingNote', '');

  const googleMapsUrl = data?.wedding.googleMapsUrl;
  const mapsEmbedUrl = googleMapsUrl
    ? googleMapsUrl.replace(/\/$/, '') + '/embed'
    : `https://maps.google.com/maps?q=${encodeURIComponent(venueName + ' ' + venueAddress)}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
  const mapsLinkUrl = googleMapsUrl
    ? googleMapsUrl
    : `https://www.google.com/maps/search/${encodeURIComponent(venueName + ' ' + venueAddress)}`;

  return (
    <>
      <SectionBanner title={getField('getting-there', 'title', 'Getting There')} subtitle={getField('getting-there', 'subtitle', '')} />

      <main className="pb-section-gap px-4 md:px-canvas-margin max-w-[1440px] mx-auto min-h-screen pt-[20px] md:pt-[40px] flex flex-col gap-8">
        {/* Address */}
        <section className="flex flex-col gap-6 max-w-md mx-auto w-full">
          <div className="space-y-4 text-center pb-2 pt-1">
            <h3
              className="text-xs uppercase tracking-[0.2em] text-cinematic-gold font-bold"
              style={{ fontSize: '12px', lineHeight: '16px', letterSpacing: '0.1em', fontWeight: 600 }}
            >
              ADDRESS
            </h3>
            <div>
              <p className="text-xl text-charcoal-ink font-semibold" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 500, fontSize: '32px', lineHeight: '40px' }}>
                {venueName}
              </p>
              <p className="text-charcoal-ink/70 italic mt-1" style={{ fontSize: '16px', lineHeight: '24px' }}>
                {venueAddress}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 pt-1 border-b border-champagne-silk/30">
            <button
              className={`flex-1 pb-4 font-medium transition-colors duration-300 ${
                tab === 'car'
                  ? 'text-charcoal-ink border-b-2 border-charcoal-ink font-bold'
                  : 'text-charcoal-ink/40'
              }`}
              style={{ fontSize: '12px', lineHeight: '16px', letterSpacing: '0.1em', fontWeight: tab === 'car' ? 600 : 500, textTransform: 'uppercase' }}
              onClick={() => setTab('car')}
            >
              {carTitle}
            </button>
            <button
              className={`flex-1 pb-4 font-medium transition-colors duration-300 ${
                tab === 'transit'
                  ? 'text-charcoal-ink border-b-2 border-charcoal-ink font-bold'
                  : 'text-charcoal-ink/40'
              }`}
              style={{ fontSize: '12px', lineHeight: '16px', letterSpacing: '0.1em', fontWeight: tab === 'transit' ? 600 : 500, textTransform: 'uppercase' }}
              onClick={() => setTab('transit')}
            >
              {transitTitle}
            </button>
          </div>
        </section>

        {/* Tab Content: By Car */}
        {tab === 'car' && (
          <section className="max-w-md mx-auto w-full">
            <div className="col-span-2 space-y-8 py-4">
              {carContent ? (
                <div className="space-y-2">
                  <p className="text-charcoal-ink/80 leading-relaxed" style={{ fontSize: '16px', lineHeight: '24px', whiteSpace: 'pre-line' }}>
                    {carContent}
                  </p>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-charcoal-ink/30 text-sm italic">Driving directions coming soon.</p>
                </div>
              )}
              {parkingNote && (
                <div className="border-t border-champagne-silk/30 pt-4 space-y-2">
                  <p className="text-sm text-charcoal-ink/60 leading-relaxed">{parkingNote}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Tab Content: Public Transit */}
        {tab === 'transit' && (
          <section className="max-w-md mx-auto w-full">
            <div className="col-span-2 space-y-8 py-4">
              {transitContent ? (
                <div className="space-y-2">
                  <p className="text-charcoal-ink/80 leading-relaxed" style={{ fontSize: '16px', lineHeight: '24px', whiteSpace: 'pre-line' }}>
                    {transitContent}
                  </p>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-charcoal-ink/30 text-sm italic">Transit directions coming soon.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Find Your Way — always visible on both tabs */}
        <section className="max-w-md mx-auto w-full">
          <div className="border-t border-champagne-silk/30 pt-8 space-y-4">
            <h3
              className="text-xs uppercase tracking-[0.2em] text-cinematic-gold font-bold"
              style={{ fontSize: '12px', lineHeight: '16px', letterSpacing: '0.1em', fontWeight: 600 }}
            >
              FIND YOUR WAY
            </h3>
            <div className="relative rounded-lg overflow-hidden border border-charcoal-ink/10">
              <iframe
                src={mapsEmbedUrl}
                width="100%"
                height="280"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`${venueName} Location`}
                className="w-full"
              />
              <a
                href={mapsLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute top-3 left-3 flex items-center gap-1.5 bg-white border border-charcoal-ink/10 rounded-md px-3 py-1.5 text-[13px] font-medium text-charcoal-ink hover:bg-charcoal-ink/5 transition-colors duration-200 shadow-sm"
              >
                <span className="material-symbols-outlined text-charcoal-ink" style={{ fontSize: '18px' }}>open_in_new</span>
                Open in Maps
              </a>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}