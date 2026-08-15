'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Image from 'next/image'

/* ─────────────────────────────────────────────
   Reveal Section Wrapper
   ───────────────────────────────────────────── */
function RevealSection({ children, className = '', delay = 0 }: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            el.style.opacity = '1'
            el.style.transform = 'translateY(0)'
          }, delay)
          observer.unobserve(el)
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [delay])

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: 0,
        transform: 'translateY(30px)',
        transition: 'opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1), transform 0.9s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {children}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Mobile Demo Modal
   ───────────────────────────────────────────── */
function MobileDemoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => videoRef.current?.play().catch(() => {}), 200)
    return () => { clearTimeout(t); document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 md:p-8"
      style={{ zIndex: 9999, opacity: 0, animation: 'fadeIn 0.3s ease forwards' }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div
        className="relative flex-shrink-0"
        style={{ zIndex: 10000, opacity: 0, animation: 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors cursor-pointer"
          aria-label="Close mobile demo"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="relative bg-[#1A1A1A] rounded-[2.5rem] p-3 shadow-2xl shadow-black/40">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-[#1A1A1A] rounded-b-2xl" />
          <div className="relative w-[260px] h-[535px] md:w-[300px] md:h-[618px] bg-black rounded-[2rem] overflow-hidden">
            <video
              ref={videoRef}
              src="/heirloom/preview/hero-video.mp4"
              autoPlay
              loop
              muted
              playsInline
              poster="/heirloom/preview/hero.png"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-28 h-1 bg-white/30 rounded-full" />
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Desktop Video Section
   ───────────────────────────────────────────── */
function DesktopVideoSection({ onOpenMobileDemo }: { onOpenMobileDemo: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = videoRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play().catch(() => {})
        } else {
          el.pause()
        }
      },
      { threshold: 0.2 }
    )

    observer.observe(el)
    return () => { observer.disconnect(); el.pause() }
  }, [])

  const playfair = 'font-[family-name:var(--font-playfair)]'
  const inter = 'font-[family-name:var(--font-inter)]'

  return (
    <section className="py-20 sm:py-24 md:py-28" style={{ backgroundColor: '#2C2520' }}>
      <div className="max-w-4xl mx-auto px-6">
        <RevealSection>
          <h2
            className={`${playfair} text-3xl sm:text-4xl md:text-5xl font-semibold text-white text-center leading-tight max-w-3xl mx-auto`}
          >
            They Don&apos;t Just Receive an Invitation.
            <br className="hidden sm:block" />
            <span className="text-cinematic-gold"> They Enter Your World.</span>
          </h2>
        </RevealSection>

        <RevealSection delay={150}>
          <p
            className={`${inter} mt-4 sm:mt-5 text-base sm:text-lg text-white/60 text-center max-w-xl mx-auto leading-relaxed`}
          >
            This is what your guests will experience.
          </p>
        </RevealSection>

        <RevealSection delay={300}>
          <div className="mt-10 sm:mt-14 w-4/5 mx-auto">
            <div className="relative rounded-lg overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10">
              <video
                ref={videoRef}
                src="/heirloom/preview/desktop-video.mp4"
                poster="/heirloom/preview/desktop-poster.png"
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-auto block"
              />
            </div>
          </div>
        </RevealSection>

        <RevealSection delay={450}>
          <div className="mt-10 text-center">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpenMobileDemo() }}
              className={`${inter} border border-cinematic-gold text-cinematic-gold px-8 py-3 text-sm font-medium tracking-widest uppercase hover:bg-cinematic-gold hover:text-charcoal-ink transition-all duration-300 cursor-pointer`}
            >
              View Mobile Demo
            </button>
          </div>
        </RevealSection>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────
   Main Page Component
   ───────────────────────────────────────────── */
export default function HeirloomPage() {
  const [mobileDemoOpen, setMobileDemoOpen] = useState(false)
  const openMobileDemo = useCallback(() => setMobileDemoOpen(true), [])
  const closeMobileDemo = useCallback(() => setMobileDemoOpen(false), [])

  useEffect(() => {
    document.title = 'Heirloom — Digital Wedding Experiences by Dreamweavers'
  }, [])

  const scrollToHowItWorks = () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
  }

  const playfair = 'font-[family-name:var(--font-playfair)]'
  const inter = 'font-[family-name:var(--font-inter)]'

  return (
    <main className={`${inter} antialiased`}>
      {/* ═══════════════════════════════════════════
          SECTION 1: HERO
          ═══════════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <Image
          src="/heirloom/hero-bg.avif"
          alt="Dreamweavers Heirloom digital wedding invitation"
          fill
          className="object-cover object-center"
          priority
          sizes="100vw"
        />

        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <h1
            className={`${playfair} text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold text-charcoal-ink leading-[1.1] tracking-tight`}
            style={{
              opacity: 0,
              animation: 'fadeInUp 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards',
            }}
          >
            Your wedding begins before your guests arrive.
          </h1>

          <p
            className={`${inter} mt-6 text-base sm:text-lg text-charcoal-ink/65 leading-relaxed max-w-xl mx-auto`}
            style={{
              opacity: 0,
              animation: 'fadeInUp 1s cubic-bezier(0.16, 1, 0.3, 1) 0.6s forwards',
            }}
          >
            A beautifully personalised digital wedding experience by Dreamweavers.
          </p>

          <p
            className={`${inter} mt-4 text-xs tracking-[0.25em] uppercase text-cinematic-gold/90`}
            style={{
              opacity: 0,
              animation: 'fadeInUp 1s cubic-bezier(0.16, 1, 0.3, 1) 0.9s forwards',
            }}
          >
            Since 1998 · Singapore
          </p>

          <div
            className="mt-10"
            style={{
              opacity: 0,
              animation: 'fadeInUp 1s cubic-bezier(0.16, 1, 0.3, 1) 1.2s forwards',
            }}
          >
            <button
              onClick={scrollToHowItWorks}
              className={`${inter} border border-cinematic-gold text-cinematic-gold px-8 py-3 text-sm font-medium tracking-widest uppercase hover:bg-cinematic-gold hover:text-charcoal-ink transition-all duration-300 cursor-pointer`}
            >
              Discover Heirloom
            </button>
          </div>
        </div>

        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          style={{
            opacity: 0,
            animation: 'fadeInUp 1s ease 1.6s forwards',
          }}
        >
          <div className="w-px h-10 bg-gradient-to-b from-transparent to-charcoal-ink/30" />
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 2: THE PROBLEM → THE REVEAL
          ═══════════════════════════════════════════ */}
      <section className="py-20 sm:py-24 md:py-28 bg-paper-cream">
        <div className="max-w-5xl mx-auto px-6">
          <RevealSection>
            <h2
              className={`${playfair} text-3xl sm:text-4xl md:text-5xl font-semibold text-charcoal-ink text-center leading-tight`}
            >
              More Than an Invitation.
            </h2>
          </RevealSection>

          <RevealSection delay={150}>
            <p
              className={`${inter} mt-4 sm:mt-5 text-base sm:text-lg text-charcoal-ink/60 text-center max-w-2xl mx-auto leading-relaxed`}
            >
              Most digital invitations deliver information. Heirloom delivers an experience.
            </p>
          </RevealSection>

          <div className="mt-10 sm:mt-14 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
            <RevealSection delay={250}>
              <div className="border border-charcoal-ink/10 rounded-sm p-8 sm:p-10">
                <h3 className={`${inter} text-xs font-medium tracking-[0.2em] uppercase text-charcoal-ink/40 mb-7`}>
                  Traditional Digital Invitation
                </h3>
                <ul className="space-y-5">
                  {['Static image or PDF', 'Limited personalisation', 'No emotional storytelling', 'Separate RSVP management'].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="text-charcoal-ink/25 mt-0.5 flex-shrink-0">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="block">
                          <line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          <line x1="14" y1="2" x2="2" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </span>
                      <span className={`${inter} text-sm sm:text-base text-charcoal-ink/65 leading-relaxed`}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </RevealSection>

            <RevealSection delay={400}>
              <div className="border border-cinematic-gold/30 rounded-sm p-8 sm:p-10">
                <h3 className={`${inter} text-xs font-medium tracking-[0.2em] uppercase text-cinematic-gold mb-7`}>
                  Heirloom by Dreamweavers
                </h3>
                <ul className="space-y-5">
                  {['Personalised digital experience', 'Music, video, and animation', 'Interactive guest journey', 'Integrated RSVP and guest management'].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="text-cinematic-gold mt-0.5 flex-shrink-0">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="block">
                          <polyline points="3,8 7,12 13,4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span className={`${inter} text-sm sm:text-base text-charcoal-ink/80 leading-relaxed font-medium`}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 3: HOW IT WORKS
          ═══════════════════════════════════════════ */}
      <section id="how-it-works" className="py-20 sm:py-24 md:py-28 bg-champagne-silk/40">
        <div className="max-w-5xl mx-auto px-6">
          <RevealSection>
            <h2 className={`${playfair} text-3xl sm:text-4xl md:text-5xl font-semibold text-charcoal-ink text-center leading-tight`}>
              Three Steps to Your Wedding Experience.
            </h2>
          </RevealSection>

          <div className="mt-10 sm:mt-14 grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-14 md:gap-16">
            {[
              { num: '01', title: 'Design', sub: 'Create your invitation', desc: 'Choose from thoughtfully curated colour palettes, refined typography, and elegant layouts. Add your favourite photos and personal touches — every detail is yours to shape.' },
              { num: '02', title: 'Share', sub: 'Send to your guests', desc: 'Share a single link or a beautifully designed QR code. Your invitation reaches every guest effortlessly — no envelopes, no postage, no delays.' },
              { num: '03', title: 'Celebrate', sub: 'Watch the magic unfold', desc: 'Your guests receive a curated journey — from your love story to the event schedule, from heartfelt wishes to shared photo memories. The experience begins the moment they open the link.' },
            ].map((step, i) => (
              <RevealSection key={step.num} delay={100 + i * 150}>
                <div className="border border-charcoal-ink/[0.06] rounded-sm p-7 sm:p-9 h-full flex flex-col">
                  <span className={`${playfair} text-4xl sm:text-5xl font-light text-cinematic-gold/60`}>{step.num}</span>
                  <h3 className={`${playfair} text-xl sm:text-2xl font-semibold text-charcoal-ink mt-4`}>{step.title}</h3>
                  <p className={`${inter} text-[11px] tracking-[0.15em] uppercase text-cinematic-gold/70 mt-1`}>{step.sub}</p>
                  <p className={`${inter} text-sm text-charcoal-ink/65 leading-relaxed mt-5 flex-1`}>{step.desc}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 4: DESKTOP VIDEO
          ═══════════════════════════════════════════ */}
      <DesktopVideoSection onOpenMobileDemo={openMobileDemo} />

      {/* ═══════════════════════════════════════════
          SECTION 5: CLOSING / ENQUIRY
          ═══════════════════════════════════════════ */}
      <section className="py-20 sm:py-24 md:py-28 bg-paper-cream">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <RevealSection>
            <a href="https://www.dreamweavers.com.sg/" target="_blank" rel="noopener noreferrer">
              <Image src="/dreamweavers-logo.png" alt="Dreamweavers" width={120} height={14} className="h-[24px] sm:h-[26px] w-auto mx-auto object-contain" />
            </a>
            <span className={`${inter} block text-xs tracking-[0.3em] uppercase text-cinematic-gold/80 font-medium mt-6`}>
              Begin Your Journey
            </span>
          </RevealSection>

          <RevealSection delay={150}>
            <h2 className={`${playfair} text-3xl sm:text-4xl md:text-[2.75rem] font-semibold text-charcoal-ink mt-6 leading-tight`}>
              Beautiful Invitations. Seamless Planning. Thoughtfully Crafted.
            </h2>
          </RevealSection>

          <RevealSection delay={300}>
            <p className={`${inter} mt-6 text-base sm:text-lg text-charcoal-ink/65 leading-relaxed`}>
              Heirloom by Dreamweavers transforms your love story into an unforgettable digital experience — one your guests will remember long after the celebration.
            </p>
          </RevealSection>

          <RevealSection delay={450}>
            <div className="mt-10 sm:mt-12">
              <a
                href="https://www.dreamweavers.com.sg/contact"
                target="_blank"
                rel="noopener noreferrer"
                className={`${inter} inline-block bg-cinematic-gold text-charcoal-ink px-8 py-3.5 text-sm font-medium tracking-widest uppercase hover:bg-cinematic-gold/90 transition-colors duration-300`}
              >
                Enquire Now
              </a>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════ */}
      <footer className="py-8 bg-paper-cream border-t border-charcoal-ink/5">
        <p className={`${inter} text-xs text-charcoal-ink/30 text-center tracking-wide`}>
          © 2026 DREAMWEAVERS DIGITAL HEIRLOOMS. All rights reserved.
        </p>
      </footer>

      {/* Mobile Demo Modal — rendered last, outside <main> flow */}
      <MobileDemoModal open={mobileDemoOpen} onClose={closeMobileDemo} />
    </main>
  )
}
