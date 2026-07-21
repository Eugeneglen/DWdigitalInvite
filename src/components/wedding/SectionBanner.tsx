'use client';

import { usePublicWedding } from '@/hooks/usePublicWedding'
import { useWeddingSlug } from '@/hooks/useWeddingSlug';;
import { useImageAutoContrast } from '@/hooks/useImageAutoContrast';

const FALLBACK_BG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuA-OyKfcsxXAmZDArHbDXl1cVCgGUG5liFPzyHdVvMG6_4jN9pNTrN9GCrkdnegli9UPJUSPs39KJRsRP7AiLem4xYS-q1ZYq1T3DAIqyvn3wAvbdkoMVkufft0SpQw4gDTPSnIml6k62lRYobUrNu70UGIILiMZQ0fAydTXXwVZ1oswQZ-mjPT8H9mDDqfhxsMSI5zla8GKz_ILXbmdRjtRUk682dPEDBD6I81DzEx7dITgjb6vxQoee5599jkYf_vCYP7npydvxqx';

interface SectionBannerProps {
  title: string;
  subtitle?: string;
  /** Override banner image URL. If omitted, reads from wedding data. */
  bannerUrl?: string | null;
}

export default function SectionBanner({ title, subtitle, bannerUrl: bannerUrlProp }: SectionBannerProps) {
  const { data } = usePublicWedding(useWeddingSlug());
  const bannerUrl = bannerUrlProp ?? data?.wedding.bannerUrl ?? FALLBACK_BG;

  // Auto-contrast: sample the banner image pixels to pick readable text colour.
  // Same hook HomePage uses for its hero — keeps section banners consistent
  // with the home page regardless of the banner image brightness.
  const { textColor: bannerTextColor, subtitleColor: bannerSubtitleColor, textShadow: bannerTextShadow } = useImageAutoContrast(bannerUrl);

  return (
    <div
      className="w-full h-[360px] md:h-[420px] bg-cover bg-center mt-[54px] md:mt-[64px] relative z-40 border-b border-champagne-silk/20 flex items-center justify-center"
      style={{ backgroundImage: `url('${bannerUrl}')` }}
    >
      {/* Gradient overlay — subtle dark gradient for text readability on any image */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/30" />

      {/* Centered text */}
      <div className="relative z-10 text-center px-6">
        <h1
          className="text-[44px] md:text-[72px] leading-[1.05] tracking-tight font-bold drop-shadow-sm"
          style={{
            fontFamily: "'Playfair Display', serif",
            color: bannerTextColor,
            textShadow: bannerTextShadow,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="mt-3 text-[11px] md:text-xs uppercase tracking-[0.25em] font-semibold drop-shadow"
            style={{ color: bannerSubtitleColor }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
