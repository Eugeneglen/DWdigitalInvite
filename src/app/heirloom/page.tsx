'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { X } from 'lucide-react'

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
   Gallery Card (Portrait Image + Overlay Label)
   ───────────────────────────────────────────── */
const GALLERY = [
  { src: '/heirloom/guest-hero.png', label: 'Eleanor & James', alt: 'Heirloom guest-facing hero screen' },
  { src: '/heirloom/guest-schedule.png', label: 'The Day', alt: 'Schedule page with event timeline' },
  { src: '/heirloom/guest-story.png', label: 'Our Story', alt: 'Love story introduction section' },
  { src: '/heirloom/guest-wishes.png', label: 'Wishes', alt: 'Guest wishes and blessings page' },
  { src: '/heirloom/guest-moments.png', label: 'Moments', alt: 'Photo moments gallery' },
] as const

function GalleryCard({ src, label, alt, index }: (typeof GALLERY)[number] & { index: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = '1'
          el.style.transform = 'translateY(0)'
          observer.unobserve(el)
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className="relative aspect-[3/4] overflow-hidden group"
      style={{
        opacity: 0,
        transform: 'translateY(24px)',
        transition: `opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.1}s, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.1}s`,
      }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover object-top transition-transform duration-700 group-hover:scale-105"
        sizes="(max-width: 768px) 33vw, 20vw"
      />
      {/* Bottom overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent pt-16 pb-5 px-4">
        <p className="font-[family-name:var(--font-playfair)] text-white text-center text-base sm:text-lg font-semibold leading-tight">
          {label}
        </p>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Main Page Component
   ───────────────────────────────────────────── */
export default function HeirloomPage() {
  /* Page title */
  useEffect(() => {
    document.title = 'Heirloom — Digital Wedding Experiences by Dreamweavers'
  }, [])

  /* Enquiry dialog state */
  const [enquiryOpen, setEnquiryOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  /* Scroll to section 3 */
  const scrollToHowItWorks = () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleEnquirySubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/heirloom/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        setSubmitted(true)
        setFormData({ name: '', email: '', phone: '', message: '' })
        setTimeout(() => {
          setEnquiryOpen(false)
          setSubmitted(false)
        }, 2200)
      }
    } catch {
      /* silently handle */
    } finally {
      setSubmitting(false)
    }
  }

  /* ──── PLAYFAIR & INTER FONT TOKENS ──── */
  const playfair = 'font-[family-name:var(--font-playfair)]'
  const inter = 'font-[family-name:var(--font-inter)]'

  return (
    <main className={`${inter} antialiased`}>
      {/* ═══════════════════════════════════════════
          SECTION 1: HERO
          ═══════════════════════════════════════════ */}
      <section
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
      >
        {/* Background image */}
        <Image
          src="/heirloom/hero-bg.avif"
          alt="Dreamweavers Heirloom digital wedding invitation"
          fill
          className="object-cover object-center"
          priority
          sizes="100vw"
        />

        {/* Content */}
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

        {/* Scroll indicator */}
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

          {/* Comparison grid */}
          <div className="mt-10 sm:mt-14 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
            {/* Left: Traditional */}
            <RevealSection delay={250}>
              <div className="border border-charcoal-ink/10 rounded-sm p-8 sm:p-10">
                <h3
                  className={`${inter} text-xs font-medium tracking-[0.2em] uppercase text-charcoal-ink/40 mb-7`}
                >
                  Traditional Digital Invitation
                </h3>
                <ul className="space-y-5">
                  {[
                    'Static image or PDF',
                    'Limited personalisation',
                    'No emotional storytelling',
                    'Separate RSVP management',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="text-charcoal-ink/25 mt-0.5 flex-shrink-0">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="block">
                          <line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          <line x1="14" y1="2" x2="2" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </span>
                      <span className={`${inter} text-sm sm:text-base text-charcoal-ink/65 leading-relaxed`}>
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </RevealSection>

            {/* Right: Heirloom */}
            <RevealSection delay={400}>
              <div className="border border-cinematic-gold/30 rounded-sm p-8 sm:p-10">
                <h3
                  className={`${inter} text-xs font-medium tracking-[0.2em] uppercase text-cinematic-gold mb-7`}
                >
                  Heirloom by Dreamweavers
                </h3>
                <ul className="space-y-5">
                  {[
                    'Personalised digital experience',
                    'Music, video, and animation',
                    'Interactive guest journey',
                    'Integrated RSVP and guest management',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="text-cinematic-gold mt-0.5 flex-shrink-0">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="block">
                          <polyline points="3,8 7,12 13,4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span className={`${inter} text-sm sm:text-base text-charcoal-ink/80 leading-relaxed font-medium`}>
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

      {/* ═══════════════════════════════════════════
          SECTION 3: HOW IT WORKS
          ═══════════════════════════════════════════ */}
      <section
        id="how-it-works"
        className="py-20 sm:py-24 md:py-28 bg-champagne-silk/40"
      >
        <div className="max-w-5xl mx-auto px-6">
          <RevealSection>
            <h2
              className={`${playfair} text-3xl sm:text-4xl md:text-5xl font-semibold text-charcoal-ink text-center leading-tight`}
            >
              Three Steps to Your Wedding Experience.
            </h2>
          </RevealSection>

          <div className="mt-10 sm:mt-14 grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-14 md:gap-16">
            {/* Step 1 */}
            <RevealSection delay={100}>
              <div className="border border-charcoal-ink/[0.06] rounded-sm p-7 sm:p-9 h-full flex flex-col">
                <span
                  className={`${playfair} text-4xl sm:text-5xl font-light text-cinematic-gold/60`}
                >
                  01
                </span>
                <h3
                  className={`${playfair} text-xl sm:text-2xl font-semibold text-charcoal-ink mt-4`}
                >
                  Design
                </h3>
                <p
                  className={`${inter} text-[11px] tracking-[0.15em] uppercase text-cinematic-gold/70 mt-1`}
                >
                  Create your invitation
                </p>
                <p
                  className={`${inter} text-sm text-charcoal-ink/65 leading-relaxed mt-5 flex-1`}
                >
                  Choose from thoughtfully curated colour palettes, refined typography, and elegant layouts. Add your favourite photos and personal touches — every detail is yours to shape.
                </p>
              </div>
            </RevealSection>

            {/* Step 2 */}
            <RevealSection delay={250}>
              <div className="border border-charcoal-ink/[0.06] rounded-sm p-7 sm:p-9 h-full flex flex-col">
                <span
                  className={`${playfair} text-4xl sm:text-5xl font-light text-cinematic-gold/60`}
                >
                  02
                </span>
                <h3
                  className={`${playfair} text-xl sm:text-2xl font-semibold text-charcoal-ink mt-4`}
                >
                  Share
                </h3>
                <p
                  className={`${inter} text-[11px] tracking-[0.15em] uppercase text-cinematic-gold/70 mt-1`}
                >
                  Send to your guests
                </p>
                <p
                  className={`${inter} text-sm text-charcoal-ink/65 leading-relaxed mt-5 flex-1`}
                >
                  Share a single link or a beautifully designed QR code. Your invitation reaches every guest effortlessly — no envelopes, no postage, no delays.
                </p>
              </div>
            </RevealSection>

            {/* Step 3 */}
            <RevealSection delay={400}>
              <div className="border border-charcoal-ink/[0.06] rounded-sm p-7 sm:p-9 h-full flex flex-col">
                <span
                  className={`${playfair} text-4xl sm:text-5xl font-light text-cinematic-gold/60`}
                >
                  03
                </span>
                <h3
                  className={`${playfair} text-xl sm:text-2xl font-semibold text-charcoal-ink mt-4`}
                >
                  Celebrate
                </h3>
                <p
                  className={`${inter} text-[11px] tracking-[0.15em] uppercase text-cinematic-gold/70 mt-1`}
                >
                  Watch the magic unfold
                </p>
                <p
                  className={`${inter} text-sm text-charcoal-ink/65 leading-relaxed mt-5 flex-1`}
                >
                  Your guests receive a curated journey — from your love story to the event schedule, from heartfelt wishes to shared photo memories. The experience begins the moment they open the link.
                </p>
              </div>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 4: THE GUEST EXPERIENCE
          ═══════════════════════════════════════════ */}
      <section className="py-20 sm:py-24 md:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <RevealSection>
            <h2
              className={`${playfair} text-3xl sm:text-4xl md:text-5xl font-semibold text-charcoal-ink text-center leading-tight max-w-3xl mx-auto`}
            >
              They Don't Just Receive an Invitation.
              <br className="hidden sm:block" />
              <span className="text-cinematic-gold"> They Enter Your World.</span>
            </h2>
          </RevealSection>

          <RevealSection delay={150}>
            <p
              className={`${inter} mt-4 sm:mt-5 text-base sm:text-lg text-charcoal-ink/65 text-center max-w-xl mx-auto leading-relaxed`}
            >
              This is what your guests will experience.
            </p>
          </RevealSection>

          {/* Gallery — 5 equal-width portrait cards */}
          <div className="mt-10 sm:mt-14 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
            {GALLERY.map((card, i) => (
              <GalleryCard key={card.label} {...card} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 5: CLOSING / ENQUIRY
          ═══════════════════════════════════════════ */}
      <section className="py-20 sm:py-24 md:py-28 bg-paper-cream">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <RevealSection>
            <Image
              src="/dreamweavers-logo.png"
              alt="Dreamweavers"
              width={120}
              height={14}
              className="h-[22px] sm:h-[24px] w-auto mx-auto object-contain"
            />
            <span
              className={`${inter} block text-xs tracking-[0.3em] uppercase text-cinematic-gold/80 font-medium mt-6`}
            >
              Begin Your Journey
            </span>
          </RevealSection>

          <RevealSection delay={150}>
            <h2
              className={`${playfair} text-3xl sm:text-4xl md:text-[2.75rem] font-semibold text-charcoal-ink mt-6 leading-tight`}
            >
              Beautiful Invitations. Seamless Planning. Thoughtfully Crafted.
            </h2>
          </RevealSection>

          <RevealSection delay={300}>
            <p
              className={`${inter} mt-6 text-base sm:text-lg text-charcoal-ink/65 leading-relaxed`}
            >
              Heirloom by Dreamweavers transforms your love story into an unforgettable digital experience — one your guests will remember long after the celebration.
            </p>
          </RevealSection>

          <RevealSection delay={450}>
            <div className="mt-10 sm:mt-12">
              <button
                onClick={() => setEnquiryOpen(true)}
                className={`${inter} inline-block bg-cinematic-gold text-charcoal-ink px-8 py-3.5 text-sm font-medium tracking-widest uppercase hover:bg-cinematic-gold/90 transition-colors duration-300 cursor-pointer`}
              >
                Enquire Now
              </button>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          ENQUIRY DIALOG
          ═══════════════════════════════════════════ */}
      <Dialog open={enquiryOpen} onOpenChange={setEnquiryOpen}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-[460px] bg-paper-cream border-charcoal-ink/10 rounded-none p-0 overflow-hidden"
          overlayClassName="bg-black/40 backdrop-blur-sm"
        >
          {/* Close button */}
          <button
            onClick={() => setEnquiryOpen(false)}
            className="absolute top-5 right-5 z-10 text-charcoal-ink/40 hover:text-charcoal-ink/70 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>

          <DialogTitle className="sr-only">Enquire Now</DialogTitle>
          <DialogDescription className="sr-only">Contact Dreamweavers about Heirloom digital wedding invitations</DialogDescription>

          {!submitted ? (
            <form onSubmit={handleEnquirySubmit} className="px-8 sm:px-10 pt-8 pb-10">
              {/* Header */}
              <div className="mb-7">
              <Image
                src="/dreamweavers-logo.png"
                alt="Dreamweavers"
                width={120}
                height={14}
                className="h-5 sm:h-6 w-auto object-contain"
              />
                <p className={`${inter} text-sm text-charcoal-ink/50 mt-2 leading-relaxed`}>
                  We'd love to hear from you. Share your details and we'll be in touch shortly.
                </p>
              </div>

              {/* Divider */}
              <div className="h-px bg-charcoal-ink/10 mb-7" />

              {/* Form fields */}
              <div className="space-y-6">
                {/* Full Name */}
                <div className="space-y-2">
                  <label
                    htmlFor="enquiry-name"
                    className={`${inter} block text-[11px] font-medium tracking-[0.15em] uppercase text-charcoal-ink/40`}
                  >
                    Full Name
                  </label>
                  <input
                    id="enquiry-name"
                    type="text"
                    required
                    placeholder="Your full name"
                    value={formData.name}
                    onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
                    className={`${inter} w-full bg-transparent border-0 border-b border-charcoal-ink/20 focus:border-charcoal-ink/60 text-charcoal-ink text-base placeholder:text-charcoal-ink/30 pb-2.5 px-0 outline-none transition-colors duration-200`}
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-2">
                  <label
                    htmlFor="enquiry-email"
                    className={`${inter} block text-[11px] font-medium tracking-[0.15em] uppercase text-charcoal-ink/40`}
                  >
                    Email Address
                  </label>
                  <input
                    id="enquiry-email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))}
                    className={`${inter} w-full bg-transparent border-0 border-b border-charcoal-ink/20 focus:border-charcoal-ink/60 text-charcoal-ink text-base placeholder:text-charcoal-ink/30 pb-2.5 px-0 outline-none transition-colors duration-200`}
                  />
                </div>

                {/* Contact Number */}
                <div className="space-y-2">
                  <label
                    htmlFor="enquiry-phone"
                    className={`${inter} block text-[11px] font-medium tracking-[0.15em] uppercase text-charcoal-ink/40`}
                  >
                    Contact Number
                  </label>
                  <input
                    id="enquiry-phone"
                    type="tel"
                    placeholder="+65 XXXX XXXX"
                    value={formData.phone}
                    onChange={(e) => setFormData((d) => ({ ...d, phone: e.target.value }))}
                    className={`${inter} w-full bg-transparent border-0 border-b border-charcoal-ink/20 focus:border-charcoal-ink/60 text-charcoal-ink text-base placeholder:text-charcoal-ink/30 pb-2.5 px-0 outline-none transition-colors duration-200`}
                  />
                </div>

                {/* Reason for Contact */}
                <div className="space-y-2">
                  <label
                    htmlFor="enquiry-message"
                    className={`${inter} block text-[11px] font-medium tracking-[0.15em] uppercase text-charcoal-ink/40`}
                  >
                    Reason for Contact
                  </label>
                  <textarea
                    id="enquiry-message"
                    required
                    rows={3}
                    placeholder="Tell us how we can help..."
                    value={formData.message}
                    onChange={(e) => setFormData((d) => ({ ...d, message: e.target.value }))}
                    className={`${inter} w-full bg-transparent border-0 border-b border-charcoal-ink/20 focus:border-charcoal-ink/60 text-charcoal-ink text-base placeholder:text-charcoal-ink/30 pb-2.5 px-0 pt-1 outline-none transition-colors duration-200 resize-none`}
                  />
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={submitting}
                className={`${inter} mt-9 w-full bg-charcoal-ink text-paper-cream py-3.5 text-sm font-medium tracking-[0.2em] uppercase hover:bg-charcoal-ink/85 transition-colors duration-300 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer`}
              >
                {submitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          ) : (
            /* Success state */
            <div className="px-8 sm:px-10 pt-12 pb-10 text-center">
              <div className="w-12 h-12 mx-auto mb-5 rounded-full border border-cinematic-gold/40 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-cinematic-gold">
                  <polyline points="6,12 10,16 18,8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className={`${playfair} text-xl font-semibold text-charcoal-ink`}>
                Thank You
              </h3>
              <p className={`${inter} text-sm text-charcoal-ink/55 mt-2 leading-relaxed`}>
                We've received your enquiry and will be in touch within 24 hours.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════ */}
      <footer className="py-8 bg-paper-cream border-t border-charcoal-ink/5">
        <p className={`${inter} text-xs text-charcoal-ink/30 text-center tracking-wide`}
        >
          © 2026 DREAMWEAVERS DIGITAL HEIRLOOMS. All rights reserved.
        </p>
      </footer>
    </main>
  )
}
