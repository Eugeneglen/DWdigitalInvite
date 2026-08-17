'use client';

import { usePublicWedding } from '@/hooks/usePublicWedding'
import { useWeddingSlug } from '@/hooks/useWeddingSlug';;
import { useImageAutoContrast } from '@/hooks/useImageAutoContrast';

interface SectionBannerProps {
  title: string;
  subtitle?: string;
  /** Override banner image URL. If omitted, reads from wedding data. */
  bannerUrl?: string | null;
}

export default function SectionBanner({ title, subtitle, bannerUrl: bannerUrlProp }: SectionBannerProps) {
  const { data, getField } = usePublicWedding(useWeddingSlug());
  const rawBannerUrl = bannerUrlProp ?? data?.wedding.bannerUrl ?? '';

  // Read the admin-chosen banner headline font (stored as global.fontFamily)
  const bannerFont = getField('global', 'fontFamily', 'Playfair Display');

  // Hooks must always be called (React rules of hooks)
  const { textColor: bannerTextColor, subtitleColor: bannerSubtitleColor, textShadow: bannerTextShadow } = useImageAutoContrast(rawBannerUrl);

  // Don't render the banner at all if there's no image
  if (!rawBannerUrl) return null;

  return (
    <div
      className="w-full h-[360px] md:h-[420px] bg-cover bg-center mt-[54px] md:mt-[64px] relative z-40 border-b border-champagne-silk/20 flex items-center justify-center"
      style={{ backgroundImage: `url('${rawBannerUrl}')` }}
    >
      {/* Centered text */}
      <div className="relative z-10 text-center px-6">
        {title && (
          <h1
            className="text-[44px] md:text-[72px] leading-[1.05] tracking-tight font-bold drop-shadow-sm"
            style={{
              fontFamily: `'${bannerFont}', serif`,
              color: bannerTextColor,
              textShadow: bannerTextShadow,
            }}
          >
            {title}
          </h1>
        )}
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
