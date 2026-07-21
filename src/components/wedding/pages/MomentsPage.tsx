'use client';

import { useState, useEffect, useRef } from 'react';
import SectionBanner from '../SectionBanner';
import { usePublicWedding } from '@/hooks/usePublicWedding'
import { useWeddingSlug } from '@/hooks/useWeddingSlug';;

const FALLBACK_PHOTOS = [
  {
    alt: 'Early Years',
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAm-8WDgkq_3PeNjdM4_SPcbdyPc4j1BN1NYWpstlUalLgRDkOi-VrJG2ZcdDt04YwBhlSegxOEQ4dbw-6zr2xKHQeTO5gJe67RlcYJ2IkUn3Dp8ZbTzfL8aD2Tq8rbse4QsZBGuz1fOPmW42rjorV-F8aY14aRHg_wk_TAMAaeqaBllL8Qpx_POk9EP9b5wjS_YXtMBnKH7-nGAPwIbuNCwetnkUm6A1gonIw4KTEsPRqq2sW_1A3jAX6wnSIeZTPdzM3VYkva56VG',
  },
  {
    alt: 'College Days',
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAaySYsDYGyX6N9CoV24yS9bjuLYqQWIJwG8qS2qCMj2do69ncL22s286MrboC8HGtgl1tP6_JTj85seIO4TolelvHDIqTInWBTwFyuk_MJZN0a5w6P0QX4AQUVLx2oCOPDelyGCdOmRviKG1bD4nqPr3zkgUKWgXNmnGP5a0b4U2k-nDG2Hl_lDM2moRehiYXKnwB872KgPkaI7Br6uq1DHIKKb34AY9ybXoB9pT-x3W5PKHguLL3DaI6VsnfHWT18OAeoVAgwQsvH',
  },
  {
    alt: 'First Summer',
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCSIFjFy2YecMgyEcWPUwcxc0x0aeave6t83lRrx9I562NRYIPDn8I7lAYE1hLalBtCsq22XBSUM5UIQ9O7SG4LZbJXDpn7Y8iUaVW7FNVdfMuTbn2uGLOQCl3MV6EgnxcpYOsswCptEyKegR8_YCSeNk438RKjHVC3xs4HkIvlq5kEe3f5OTdP36lsirovgw_07Ry4YwVm06xv8uZ5GmhrX-oU02i7OASDM7Gdr1UkxL2NiOdyce7PSAl_0UW-xZMxl1DFIStbWdaU',
  },
  {
    alt: 'Where it Began',
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC8RAoFnH7L9tFmSjN3sfNRhKNcQZhi5ysusn41rPRCnxgkRdC7gmZSPZ0XoULR83j3q0uqgavwoBitCxAoF2KF-DzsGg34B0pCMslmkusZodhIipUFKpkQj-cr4FRMLcyDdy5SzxPsOAi7OKQa4uioJSi0KhKwePpXNmReV2WzTMoSRUP-wqNUrofcUas0L_WwXeNwan3c9CMIkxBHHWhkKwYOKyjXd51ixRMzL_X37bZqgP1DUhrpEUz27iNPB8XgvhtSDOiH4Pd2',
  },
  {
    alt: 'Academic Milestones',
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAo_iwupchnJHvXMl5E17TFsoHJ23KgUb5kI8vnFt1NyIODCLIK9tSJ-5NmvdWcdS21fueeNi-8HX5FPWZ-rXZPyru8V-DUKsc_aEK6yGqTQyOAJubhxaZWj_07HSUyF0yvxVn5G5WmJtNxLq9EZh0X8EJ5Q_4ZMQ7HMh_FQqAIW6OofZZw4zhAhwyIOyrlVwaURh_XvFES7-3dVvxz2sJ0iTNmt9VV0roh3t83hM1Vam0FV-9y9b3d4c46RZVcBv84AwjC1tew60c7',
  },
  {
    alt: 'Early Adventures',
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA6yfZZlKuOgc7f9BoIGCAh3JLsOmPBPPzDUbciYvBGuEIyibR3sGWAMVAKm1otVVQWGI5yGzzdXPiiZbtmXiSvQY5Mk_ZQI-pJjKHbsc3qcwpp3mK6LwLmHQQyCZYIp1ELY6UEftahE-61i-LgWdRzahJMkrnhPI9bwahxFIRLxhjIoG9HE-FPNqZI_2KBnRoblo5SKLkW6SreAOLXOETB3qeo3ymZ6wtPqOZTBpRsIId11CRKbr1xaKqF1sqRtv0N5vQHlAWhlHqA',
  },
  {
    alt: 'Social Circles',
    src: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCXe37633UXErQ8VKr_s7lNWN-MZNVGtupB_D1WmBY3PqnOFWIYr8BqlsYPPX-k-mJA8AbmrOauWIohhltVLnmMvLgbkjNALuIFpdEGRiKe3wDFCRt21tZvTIc3SMgCtoDnEBZOx7_HGu5RSa3uuFbCugmJpXpDg-QE9vxZG9QXDgqETu3c1_QmYtU8K41OyOTkwqFdFlYxdRj_WCCBTKgLSI4NchqgRYqQv4_xZQICoqEfBOB1aMyFqVS4OSA6-X7VuOvui4qjJnc_',
  },
];

const FALLBACK_SUBTITLE = 'The Journey Before the I Do—from childhood dreams to our first steps together.';

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

  const sectionTitle = getField('moments', 'title', 'Moments');
  const subtitle = getField('moments', 'subtitle', FALLBACK_SUBTITLE);

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
          {photos.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-charcoal-ink/30 text-sm italic">Photos coming soon.</p>
            </div>
          ) : (
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