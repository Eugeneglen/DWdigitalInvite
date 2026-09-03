'use client'

/* ═══════════════════════════════════════════════════════════════════════════
   HeirloomGuestPreview
   A phone-frame stage showing a looping video of the mobile digital experience,
   plus a "View the Full Desktop Experience" button that opens a modal with
   the desktop experience video.

   Self-contained — no external CSS token dependencies. All colors/fonts inlined
   so it works regardless of the host project's Tailwind build pipeline.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

const inter = 'font-[family-name:var(--font-inter)]'
const playfair = 'font-[family-name:var(--font-playfair)]'

export function HeirloomGuestPreview({ className = 'mt-10 sm:mt-14' }: { className?: string } = {}) {
  const [showFull, setShowFull] = useState(false)

  return (
    <div className={`${className} flex flex-col items-center`}>
      {/* Phone-frame mockup — what guests see on their phone */}
      <div
        className="relative w-full max-w-[340px] aspect-[9/16] rounded-[2.2rem] border-[6px] border-[#1A1A1A]/85 bg-[#1A1A1A] shadow-2xl shadow-[#1A1A1A]/20 overflow-hidden"
        role="region"
        aria-label="Live guest-experience preview — what your guests see on their phone"
      >
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-4 bg-[#1A1A1A]/85 rounded-b-2xl z-30" />
        {/* Status bar accent */}
        <div className="absolute top-1.5 left-5 right-5 flex justify-between items-center text-[8px] text-[#FCF9F2]/70 z-30 pointer-events-none">
          <span className={`${inter}`}>9:41</span>
          <span className={`${inter}`}>Heirloom</span>
        </div>

        {/* Looping video of the mobile digital experience */}
        <div className="absolute inset-0 pt-5">
          <video
            src="/heirloom/video/poppy-mobile.mov"
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-contain bg-[#1A1A1A]"
          />
        </div>
      </div>

      {/* View the Full Desktop Experience button */}
      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          onClick={() => setShowFull(true)}
          className={`${inter} mt-2 inline-flex items-center gap-2 border border-[#D4AF37] text-[#D4AF37] px-6 py-2.5 text-xs font-medium tracking-[0.18em] uppercase hover:bg-[#D4AF37] hover:text-[#1A1A1A] transition-all duration-300 cursor-pointer`}
        >
          View the Full Desktop Experience
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </button>
      </div>

      {/* Full Desktop Experience modal — looping landscape video */}
      <Dialog open={showFull} onOpenChange={setShowFull}>
        <DialogContent className="max-w-[95vw] sm:max-w-[900px] p-0 overflow-hidden bg-[#1A1A1A] border-[#D4AF37]/30">
          <DialogTitle className="sr-only">Heirloom — Full Desktop Experience</DialogTitle>
          <div className="relative w-full aspect-video max-h-[88vh] bg-[#1A1A1A]">
            <video
              src="/heirloom/video/poppy-desktop.mov"
              autoPlay
              loop
              muted
              playsInline
              controls
              className="absolute inset-0 w-full h-full object-contain bg-[#1A1A1A]"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
