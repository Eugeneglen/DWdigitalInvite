'use client'

import Image from 'next/image'
import { HeirloomGuestPreview } from '@/components/heirloom-guest-preview'

/* ─────────────────────────────────────────────
   Reveal Section Wrapper (no animation — content shows immediately)
   ───────────────────────────────────────────── */
function RevealSection({ children, className = '' }: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  return <div className={className}>{children}</div>
}

/* ─────────────────────────────────────────────
   Gold flourish divider
   ───────────────────────────────────────────── */
function Flourish() {
  return (
    <div className="flex items-center justify-center gap-3.5 my-7 opacity-80">
      <span className="block h-px w-14 bg-gradient-to-r from-transparent to-[#D4AF37]" />
      <span className="block w-1.5 h-1.5 rounded-full bg-[#D4AF37] rotate-45" />
      <span className="block h-px w-14 bg-gradient-to-l from-transparent to-[#D4AF37]" />
    </div>
  )
}

/* ─────────────────────────────────────────────
   Checkmark icon (gold, for the bullet lists)
   ───────────────────────────────────────────── */
function GoldCheck() {
  return (
    <span className="text-[#D4AF37] mt-0.5 flex-shrink-0">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="block">
        <polyline points="3,8 7,12 13,4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Page — "Coexist" strategy
   Physical invitation + digital experience, together.
   Self-contained: all colors inlined (no dependency on tailwind-output.css tokens).
   ═══════════════════════════════════════════════════════════════════════════ */
export default function HeirloomPage() {
  const playfair = 'font-[family-name:var(--font-playfair)]'
  const inter = 'font-[family-name:var(--font-inter)]'
  const cormorant = 'font-[family-name:"Cormorant_Garamond",serif]'
  const script = 'font-[family-name:"Great_Vibes",cursive]'

  return (
    <main className={`${inter} antialiased`} style={{ color: '#401020' }}>
        <style>{`
          /* Override the SaaS layout's text-charcoal-ink (#1A1A1A) with the Heirloom brown (#401020) */
          main { color: #401020 !important; }
          main h1, main h2, main h3, main h4, main p, main li, main span, main a { color: inherit; }
          main .text-\[\#D4AF37\], main [class*="text-[#D4AF37]"] { color: #D4AF37 !important; }
          /* Font family overrides — ensure Great Vibes + Cormorant Garamond load correctly */
          main [class*="Great_Vibes"] { font-family: "Great Vibes", cursive !important; }
          main [class*="Cormorant_Garamond"] { font-family: "Cormorant Garamond", serif !important; }
        `}</style>
      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1 — HERO: "A Keepsake to Hold. A Story to Experience."
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <Image
          src="/heirloom/coexist/heirloom-main.avif"
          alt="A Dreamweavers Heirloom invitation suite — the keepsake you hold"
          fill
          className="object-cover object-center"
          priority
          sizes="100vw"
        />

        <div className="relative z-10 max-w-4xl mx-auto px-8 sm:px-12 py-12 sm:py-14 text-center bg-white/60">
          <p className={`${inter} text-[11px] sm:text-xs tracking-[0.32em] uppercase font-semibold text-[#D4AF37]`}>
            Heirloom by Dreamweavers
          </p>

          <h1 className={`${playfair} mt-6 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold text-[#401020] leading-[1.08] tracking-tight`}>
            A Keepsake to Hold.
            <br />
            <span style={{ fontFamily: '"Great Vibes", cursive', color: '#D4AF37', fontSize: '1.15em' }}>
              A Story to Experience.
            </span>
          </h1>

          <Flourish />

          <p className={`${cormorant} italic text-lg sm:text-xl md:text-2xl text-[#401020]/85 max-w-2xl mx-auto leading-relaxed`}>
            A wedding invitation is more than information.
            <br className="hidden sm:block" />
            It is the first chapter of your celebration.
          </p>

          <p className={`${inter} mt-8 text-[10px] sm:text-xs tracking-[0.3em] uppercase text-[#401020]/55`}>
            Since 1998 · Singapore
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="w-px h-10 bg-gradient-to-b from-transparent to-[#401020]/40" />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2 — THE THESIS (editorial intro)
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 sm:py-32 md:py-40 bg-[#FCF9F2]">
        <div className="max-w-3xl mx-auto px-6">
          <RevealSection>
            <p className={`${inter} text-[11px] tracking-[0.3em] uppercase font-semibold text-[#D4AF37] text-center`}>
              The Philosophy
            </p>
          </RevealSection>

          <RevealSection>
            <h2 className={`${playfair} mt-5 text-2xl sm:text-3xl md:text-4xl font-semibold text-[#401020] text-center leading-[1.25]`}>
              In a world where everything is shared in a moment
              <br className="hidden md:block" /> and forgotten just as quickly,
              <br className="hidden md:block" />
              <span className="text-[#D4AF37]"> a beautifully crafted invitation remains.</span>
            </h2>
          </RevealSection>

          <RevealSection>
            <div className="mt-12 space-y-6">
              <p className={`${inter} text-base sm:text-lg text-[#401020]/70 leading-relaxed text-center`}>
                Your wedding day is one of life&rsquo;s most meaningful milestones. The people you invite are not
                merely guests&mdash;they are the family, friends, mentors, and loved ones who have shaped your journey.
                A thoughtfully presented invitation reflects the significance of that moment and the respect you hold
                for those you wish to celebrate with.
              </p>
              <p className={`${inter} text-base sm:text-lg text-[#401020]/70 leading-relaxed text-center`}>
                While digital experiences offer convenience and connection, they were never meant to replace the
                timeless sentiment of a physical invitation. Instead, they can work beautifully together.
              </p>
            </div>
          </RevealSection>

          {/* Pull quote — the coexist thesis */}
          <RevealSection>
            <div className="mt-16 text-center">
              <Flourish />
              <p className={`${playfair} italic text-2xl sm:text-3xl md:text-4xl text-[#401020] leading-[1.3] max-w-2xl mx-auto`}>
                The invitation becomes the keepsake.
                <br />
                The digital experience brings the story to life.
              </p>
              <Flourish />
            </div>
          </RevealSection>

          <RevealSection>
            <p className={`${inter} text-base sm:text-lg text-[#401020]/70 leading-relaxed text-center mt-12`}>
              Together, they create a celebration that honours tradition while embracing the way modern couples
              connect today.
            </p>
          </RevealSection>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3 — COEXIST: THE TWO HALVES
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 sm:py-32 md:py-40 bg-[#F5EEDF]">
        <div className="max-w-6xl mx-auto px-6">
          <RevealSection>
            <p className={`${inter} text-[11px] tracking-[0.3em] uppercase font-semibold text-[#D4AF37] text-center`}>
              Two Halves of One Celebration
            </p>
          </RevealSection>
          <RevealSection>
            <h2 className={`${playfair} mt-5 text-3xl sm:text-4xl md:text-5xl font-semibold text-[#401020] text-center leading-tight max-w-3xl mx-auto`}>
              Not physical <span className="text-[#401020]/40 italic">or</span> digital.
              <br />
              <span className="text-[#D4AF37]">Physical and digital.</span>
            </h2>
          </RevealSection>

          {/* Duo grid: Physical | Digital */}
          <div className="mt-16 sm:mt-20 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            {/* ── LEFT: THE BEAUTIFULLY CRAFTED INVITATION ── */}
            <RevealSection>
              <div>
                <div className="relative aspect-[4/5] overflow-hidden mb-8 shadow-xl shadow-[#401020]/15 bg-[#FCF9F2]">
                  <Image
                    src="/heirloom/coexist/poppy-flatlay.png"
                    alt="The physical Heirloom invitation — a cherished keepsake"
                    fill
                    className="object-cover object-center"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                </div>

                <p className={`${inter} text-[11px] tracking-[0.3em] uppercase font-semibold text-[#D4AF37]`}>
                  The Beautifully Crafted Invitation
                </p>
                <h3 className={`${playfair} text-2xl sm:text-3xl font-semibold text-[#401020] mt-3 leading-tight`}>
                  A cherished keepsake that endures beyond the wedding day.
                </h3>

                <ul className="mt-7 space-y-4">
                  {[
                    'A tangible expression of your celebration and gratitude',
                    'A meaningful gesture for parents, relatives, and honoured guests',
                    'A timeless heirloom preserved for years to come',
                    'The formal announcement of a once-in-a-lifetime occasion',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <GoldCheck />
                      <span className={`${inter} text-sm sm:text-base text-[#401020]/75 leading-relaxed`}>
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </RevealSection>

            {/* ── RIGHT: THE HEIRLOOM DIGITAL SUITE ── */}
            <RevealSection>
              <div>
                {/* Live animated mobile view of the digital suite */}
                <HeirloomGuestPreview className="" />

                <p className={`${inter} text-[11px] tracking-[0.3em] uppercase font-semibold text-[#D4AF37] mt-10`}>
                  The Heirloom Digital Suite
                </p>
                <h3 className={`${playfair} text-2xl sm:text-3xl font-semibold text-[#401020] mt-3 leading-tight`}>
                  Where your invitation extends into an immersive experience.
                </h3>

                <ul className="mt-7 space-y-4">
                  {[
                    'Seamlessly connected to your printed invitation',
                    'Share your story through music, video, photography, and animation',
                    'Simplify RSVPs and guest management with ease',
                    'Create a memorable journey guests can revisit long after the celebration',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <GoldCheck />
                      <span className={`${inter} text-sm sm:text-base text-[#401020]/75 leading-relaxed`}>
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 4 — CLOSING / ENQUIRY (luxury editorial ending)
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 sm:py-32 md:py-40 bg-[#FCF9F2]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <RevealSection>
            <a href="https://www.dreamweavers.com.sg/" target="_blank" rel="noopener noreferrer">
              <Image
                src="/dreamweavers-logo.png"
                alt="Dreamweavers"
                width={198}
                height={20}
                className="h-[21.6px] sm:h-[23.4px] w-auto mx-auto object-contain"
              />
            </a>
            <span className={`${inter} block text-xs tracking-[0.3em] uppercase text-[#D4AF37]/80 font-medium mt-7`}>
              Begin Your Journey
            </span>
          </RevealSection>

          <RevealSection>
            <Flourish />
            <h2 className={`${playfair} italic text-2xl sm:text-3xl md:text-[2.5rem] font-medium text-[#401020] leading-[1.35]`}>
              Trends may evolve, but meaningful gestures remain timeless.
              <br className="hidden sm:block" />
              <span className="text-[#D4AF37] not-italic font-semibold"> Honour your story</span> with a keepsake
              worth holding, and a digital experience worth sharing.
            </h2>
          </RevealSection>

          <RevealSection>
            <div className="mt-12 sm:mt-14">
              <a
                href="https://www.dreamweavers.com.sg/contact"
                target="_blank"
                rel="noopener noreferrer"
                className={`${inter} inline-block bg-[#D4AF37] text-[#401020] px-9 py-4 text-xs font-medium tracking-[0.2em] uppercase hover:bg-[#D4AF37]/90 transition-colors duration-300`}
              >
                Enquire Now
              </a>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════════════════════════ */}
      <footer className="py-8 bg-[#FCF9F2] border-t border-[#401020]/5">
        <p className={`${inter} text-xs text-[#401020]/30 text-center tracking-wide`}>
          © 2026 DREAMWEAVERS DIGITAL HEIRLOOMS. All rights reserved.
        </p>
      </footer>
    </main>
  )
}
