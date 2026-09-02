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
  const { data, getFont, getField } = usePublicWedding(useWeddingSlug());
  const rawBannerUrl = bannerUrlProp ?? data?.wedding.bannerUrl ?? '';
  // Page background — drives the fallback text colour when the banner image
  // cannot be analysed/loaded (the banner then renders on the page bg).
  const pageBackgroundColor = getField('global', 'backgroundColor', '#FCF9F2');

  // Couple's selected "Banner Headline Font" — hero section first (what the
  // CMS font picker writes), falling back to global (template applies) then
  // the default. Per the design plan, ONLY the banner headline title uses
  // this font; the subtitle and all other site text stay in Playfair
  // Display. Previously this read ONLY global.fontFamily while the CMS font
  // picker wrote only hero.fontFamily, so the banners on every page except
  // the homepage never reflected the couple's font choice.
  const bannerFont = getFont();

  // Hooks must always be called (React rules of hooks)
  const { textColor: bannerTextColor, subtitleColor: bannerSubtitleColor, textShadow: bannerTextShadow } = useImageAutoContrast(rawBannerUrl, pageBackgroundColor);

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
              // See HomePage.tsx: single-weight fonts (most scripts) must not
              // be faux-bolded — render their natural weight so the banner
              // matches the CMS font picker showcase. Real bolds still apply.
              fontSynthesis: 'none',
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
