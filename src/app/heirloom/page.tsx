'use client'

import Image from 'next/image'
import { HeirloomGuestPreview } from '@/components/heirloom-guest-preview'

/* ─────────────────────────────────────────────
   Reveal Section Wrapper (no animation)
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
      <span className="block h-px w-14 h-grad-l" />
      <span className="block w-1.5 h-1.5 rounded-full bg-cinematic-gold rotate-45" />
      <span className="block h-px w-14 h-grad-r" />
    </div>
  )
}

/* ─────────────────────────────────────────────
   Checkmark icon (gold)
   ───────────────────────────────────────────── */
function GoldCheck() {
  return (
    <span className="text-cinematic-gold mt-0.5 flex-shrink-0">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="block">
        <polyline points="3,8 7,12 13,4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Page — "Coexist" strategy
   Self-contained CSS: uses existing tailwind-output.css token classes +
   a <style> block with custom .h-* classes for values not in the token set.
   Zero Tailwind arbitrary values (text-[#...], bg-[#...], font-[family-name:...]).
   ═══════════════════════════════════════════════════════════════════════════ */
export default function HeirloomPage() {
  const playfair = 'h-playfair'
  const inter = 'h-inter'

  return (
    <main className={`${inter} antialiased`}>
      {/* ─── Self-contained CSS (no dependency on Tailwind compilation) ─── */}
      <style>{`
        .h-brown { color: #401020; }
        .h-brown-70 { color: rgba(64,16,32,0.7); }
        .h-brown-75 { color: rgba(64,16,32,0.75); }
        .h-brown-55 { color: rgba(64,16,32,0.55); }
        .h-brown-30 { color: rgba(64,16,32,0.3); }
        .h-brown-bd-5 { border-color: rgba(64,16,32,0.05); }
        .h-gold-80 { color: rgba(212,175,55,0.8); }
        .h-gold-bright { color: #E9CD73; }
        .h-ink-soft { color: #3a3632; }
        .h-bg-cream-dim { background-color: #F5EEDF; }
        .h-bg-ink-85 { background-color: rgba(26,26,26,0.85); }
        .h-bg-gold-90 { background-color: rgba(212,175,55,0.9); }
        .h-gold-bd-30 { border-color: rgba(212,175,55,0.3); }
        .h-script { font-family: "Great Vibes", cursive; }
        .h-cormorant { font-family: "Cormorant Garamond", serif; }
        .h-grad-l { background: linear-gradient(90deg, transparent, #D4AF37); }
        .h-grad-r { background: linear-gradient(90deg, #D4AF37, transparent); }
        .h-grad-scroll { background: linear-gradient(180deg, transparent, rgba(64,16,32,0.4)); }
        .h-shadow-ink-15 { box-shadow: 0 20px 40px rgba(64,16,32,0.15); }
        .h-shadow-ink-20 { box-shadow: 0 20px 40px rgba(26,26,26,0.20); }
        .h-cream-70 { color: rgba(252,249,242,0.7); }
        .h-champagne-70 { color: rgba(232,213,181,0.7); }
        .h-champagne-90 { color: rgba(232,213,181,0.9); }
        .h-playfair { font-family: var(--font-playfair), serif; }
        .h-inter { font-family: var(--font-inter), sans-serif; }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1 — HERO
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden py-20 sm:py-24 md:py-28">
        <Image
          src="/heirloom/coexist/heirloom-main.avif"
          alt="A Dreamweavers Heirloom invitation suite — the keepsake you hold"
          fill
          className="object-cover object-center"
          priority
          sizes="100vw"
        />

        <div className="relative z-10 max-w-4xl mx-auto px-8 sm:px-12 py-12 sm:py-14 text-center bg-white/60">
          <p className={`${inter} text-[11px] sm:text-xs tracking-[0.32em] uppercase font-semibold text-cinematic-gold`}>
            Heirloom by Dreamweavers
          </p>

          <h1 className={`${playfair} mt-6 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold h-brown leading-[1.08] tracking-tight`}>
            A Keepsake to Hold.
            <br />
            <span className="h-script text-cinematic-gold font-normal" style={{ fontSize: '1.15em' }}>
              A Story to Experience.
            </span>
          </h1>

          <Flourish />

          <p className="h-cormorant italic text-lg sm:text-xl md:text-2xl h-brown-75 max-w-2xl mx-auto leading-relaxed">
            A wedding invitation is more than information.
            <br className="hidden sm:block" />
            It is the first chapter of your celebration.
          </p>

          <p className={`${inter} mt-8 text-[10px] sm:text-xs tracking-[0.3em] uppercase h-brown-55`}>
            Since 1998 · Singapore
          </p>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="w-px h-10 h-grad-scroll" />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2 — THE THESIS
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 sm:py-32 md:py-40 bg-paper-cream">
        <div className="max-w-3xl mx-auto px-6">
          <RevealSection>
            <p className={`${inter} text-[11px] tracking-[0.3em] uppercase font-semibold text-cinematic-gold text-center`}>
              The Philosophy
            </p>
          </RevealSection>

          <RevealSection>
            <h2 className={`${playfair} mt-5 text-2xl sm:text-3xl md:text-4xl font-semibold h-brown text-center leading-[1.25]`}>
              In a world where everything is shared in a moment
              <br className="hidden md:block" /> and forgotten just as quickly,
              <br className="hidden md:block" />
              <span className="text-cinematic-gold"> a beautifully crafted invitation remains.</span>
            </h2>
          </RevealSection>

          <RevealSection>
            <div className="mt-12 space-y-6">
              <p className={`${inter} text-base sm:text-lg h-brown-70 leading-relaxed text-center`}>
                Your wedding day is one of life&rsquo;s most meaningful milestones. The people you invite are not
                merely guests&mdash;they are the family, friends, mentors, and loved ones who have shaped your journey.
                A thoughtfully presented invitation reflects the significance of that moment and the respect you hold
                for those you wish to celebrate with.
              </p>
              <p className={`${inter} text-base sm:text-lg h-brown-70 leading-relaxed text-center`}>
                While digital experiences offer convenience and connection, they were never meant to replace the
                timeless sentiment of a physical invitation. Instead, they can work beautifully together.
              </p>
            </div>
          </RevealSection>

          <RevealSection>
            <div className="mt-16 text-center">
              <Flourish />
              <p className={`${playfair} italic text-2xl sm:text-3xl md:text-4xl h-brown leading-[1.3] max-w-2xl mx-auto`}>
                The invitation becomes the keepsake.
                <br />
                The digital experience brings the story to life.
              </p>
              <Flourish />
            </div>
          </RevealSection>

          <RevealSection>
            <p className={`${inter} text-base sm:text-lg h-brown-70 leading-relaxed text-center mt-12`}>
              Together, they create a celebration that honours tradition while embracing the way modern couples
              connect today.
            </p>
          </RevealSection>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3 — COEXIST: THE TWO HALVES
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 sm:py-32 md:py-40 h-bg-cream-dim">
        <div className="max-w-6xl mx-auto px-6">
          <RevealSection>
            <p className={`${inter} text-[11px] tracking-[0.3em] uppercase font-semibold text-cinematic-gold text-center`}>
              Two Halves of One Celebration
            </p>
          </RevealSection>
          <RevealSection>
            <h2 className={`${playfair} mt-5 text-3xl sm:text-4xl md:text-5xl font-semibold h-brown text-center leading-tight max-w-3xl mx-auto`}>
              Not physical <span className="h-brown-30 italic">or</span> digital.
              <br />
              <span className="text-cinematic-gold">Physical and digital.</span>
            </h2>
          </RevealSection>

          <div className="mt-16 sm:mt-20 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            {/* ── LEFT: THE BEAUTIFULLY CRAFTED INVITATION ── */}
            <RevealSection>
              <div>
                <div className="relative aspect-[4/5] overflow-hidden mb-8 h-shadow-ink-15 bg-paper-cream">
                  <Image
                    src="/heirloom/coexist/poppy-flatlay.png"
                    alt="The physical Heirloom invitation — a cherished keepsake"
                    fill
                    className="object-cover object-center"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                </div>

                <p className={`${inter} text-[11px] tracking-[0.3em] uppercase font-semibold text-cinematic-gold`}>
                  The Beautifully Crafted Invitation
                </p>
                <h3 className={`${playfair} text-2xl sm:text-3xl font-semibold h-brown mt-3 leading-tight`}>
                  A cherished keepsake that endures beyond the wedding day.
                </h3>

                <ul className="mt-6 space-y-4">
                  {[
                    'A tangible expression of your celebration and gratitude',
                    'A meaningful gesture for parents, relatives, and honoured guests',
                    'A timeless heirloom preserved for years to come',
                    'The formal announcement of a once-in-a-lifetime occasion',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <GoldCheck />
                      <span className={`${inter} text-sm sm:text-base h-brown-75 leading-relaxed`}>
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
                <HeirloomGuestPreview className="" />

                <p className={`${inter} text-[11px] tracking-[0.3em] uppercase font-semibold text-cinematic-gold mt-10`}>
                  The Heirloom Digital Suite
                </p>
                <h3 className={`${playfair} text-2xl sm:text-3xl font-semibold h-brown mt-3 leading-tight`}>
                  Where your invitation extends into an immersive experience.
                </h3>

                <ul className="mt-6 space-y-4">
                  {[
                    'Seamlessly connected to your printed invitation',
                    'Share your story through music, video, photography, and animation',
                    'Simplify RSVPs and guest management with ease',
                    'Create a memorable journey guests can revisit long after the celebration',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <GoldCheck />
                      <span className={`${inter} text-sm sm:text-base h-brown-75 leading-relaxed`}>
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
          SECTION 4 — CLOSING / ENQUIRY
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 sm:py-32 md:py-40 bg-paper-cream">
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
            <span className={`${inter} block text-xs tracking-[0.3em] uppercase h-gold-80 font-medium mt-6`}>
              Begin Your Journey
            </span>
          </RevealSection>

          <RevealSection>
            <Flourish />
            <h2 className={`${playfair} italic text-2xl sm:text-3xl md:text-[2.5rem] font-medium h-brown leading-[1.35]`}>
              Trends may evolve, but meaningful gestures remain timeless.
              <br className="hidden sm:block" />
              <span className="text-cinematic-gold not-italic font-semibold"> Honour your story</span> with a keepsake
              worth holding, and a digital experience worth sharing.
            </h2>
          </RevealSection>

          <RevealSection>
            <div className="mt-12 sm:mt-14">
              <a
                href="https://www.dreamweavers.com.sg/contact"
                target="_blank"
                rel="noopener noreferrer"
                className={`${inter} inline-block bg-cinematic-gold h-brown px-9 py-4 text-xs font-medium tracking-[0.2em] uppercase h-bg-gold-90 transition-colors duration-300`}
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
      <footer className="py-12 bg-paper-cream border-t h-brown-bd-5">
        <p className={`${inter} text-xs h-brown-30 text-center tracking-wide`}>
          © 2026 DREAMWEAVERS DIGITAL HEIRLOOMS. All rights reserved.
        </p>
      </footer>
    </main>
  )
}
