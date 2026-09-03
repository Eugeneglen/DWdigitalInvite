'use client'

/* ═══════════════════════════════════════════════════════════════════════════
   HeirloomGuestPreview
   Phone-frame stage showing a looping video of the mobile digital experience,
   plus a "View the Full Desktop Experience" button that opens a modal with
   the desktop experience video.

   Self-contained: uses existing tailwind-output.css token classes + custom
   .h-* classes defined in a <style> block. Zero Tailwind arbitrary values.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

const inter = 'h-inter'

export function HeirloomGuestPreview({ className = 'mt-10 sm:mt-14' }: { className?: string } = {}) {
  const [showFull, setShowFull] = useState(false)

  return (
    <div className={`${className} flex flex-col items-center`}>
      <style>{`
        .h-bg-ink-85 { background-color: rgba(26,26,26,0.85); }
        .h-cream-70 { color: rgba(252,249,242,0.7); }
        .h-shadow-ink-20 { box-shadow: 0 20px 40px rgba(26,26,26,0.20); }
        .h-gold-bd { border-color: #D4AF37; }
        .h-gold-bd-30 { border-color: rgba(212,175,55,0.3); }
        .h-inter { font-family: var(--font-inter), sans-serif; }
        /* Structural classes */
        .h-aspect-916 { aspect-ratio: 9 / 16; }
        .h-border-6 { border-width: 6px; }
        .h-h-88vh { max-height: 88vh; }
        .h-rounded-22 { border-radius: 2.2rem; }
        .h-text-8 { font-size: 8px; }
        .h-tracking-018 { letter-spacing: 0.18em; }
        .h-maxw-340 { max-width: 340px; }
        .h-maxw-900 { max-width: 900px; }
        .h-maxw-95vw { max-width: 95vw; }
      `}</style>

      {/* Phone-frame mockup */}
      <div
        className="relative w-full h-maxw-340 h-aspect-916 h-rounded-22 h-border-6 h-bg-ink-85 bg-charcoal-ink h-shadow-ink-20 overflow-hidden"
        role="region"
        aria-label="Live guest-experience preview — what your guests see on their phone"
      >
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-4 h-bg-ink-85 rounded-b-2xl z-30" />
        {/* Status bar accent */}
        <div className="absolute top-1.5 left-5 right-5 flex justify-between items-center h-text-8 h-cream-70 z-30 pointer-events-none">
          <span className={inter}>9:41</span>
          <span className={inter}>Heirloom</span>
        </div>

        {/* Looping video of the mobile digital experience */}
        <div className="absolute inset-0 pt-5">
          <video
            src="/heirloom/video/poppy-mobile.mov"
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-contain bg-charcoal-ink"
          />
        </div>
      </div>

      {/* View the Full Desktop Experience button */}
      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          onClick={() => setShowFull(true)}
          className={`${inter} mt-2 inline-flex items-center gap-2 border h-gold-bd text-cinematic-gold px-6 py-2.5 text-xs font-medium h-tracking-018 uppercase hover:bg-cinematic-gold hover:text-charcoal-ink transition-all duration-300 cursor-pointer`}
        >
          View the Full Desktop Experience
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </button>
      </div>

      {/* Full Desktop Experience modal — looping landscape video */}
      <Dialog open={showFull} onOpenChange={setShowFull}>
        <DialogContent className="h-maxw-95vw sm:h-maxw-900 p-0 overflow-hidden bg-charcoal-ink h-gold-bd-30">
          <DialogTitle className="sr-only">Heirloom — Full Desktop Experience</DialogTitle>
          <div className="relative w-full aspect-video h-h-88vh bg-charcoal-ink">
            <video
              src="/heirloom/video/poppy-desktop.mov"
              autoPlay
              loop
              muted
              playsInline
              controls
              className="absolute inset-0 w-full h-full object-contain bg-charcoal-ink"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
