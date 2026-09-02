/**
 * Contrast utilities for automatic text/border colour adaptation
 * when the page background is dark (e.g. black, dark charcoal).
 *
 * Uses WCAG 2.0 relative luminance for accurate light/dark detection.
 */

/** WCAG 2.0 relative luminance (0–1) */
export function getLuminance(hex: string): number {
  const c = hex.replace('#', '');
  if (c.length < 6) return 0.5; // safety fallback

  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;

  const toLinear = (v: number) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** True when the background luminance is below the "dark" threshold (~#3C3C3C) */
export function isDarkBackground(hex: string): boolean {
  return getLuminance(hex) < 0.12;
}

/** Auto-detect primary text colour for a given background */
export function getAutoTextColor(bgHex: string): string {
  return isDarkBackground(bgHex) ? '#E8E0D0' : '#1A1A1A';
}

/** Auto-detect a muted border/accent colour for a given background */
export function getAutoBorderColor(bgHex: string): string {
  return isDarkBackground(bgHex) ? '#3A3428' : '#E8D5B5';
}

/**
 * Auto-detect text colour directly from average RGB values (0–255).
 * Useful when sampling pixels from a canvas (avoids hex round-trip).
 */
export function getAutoTextColorFromRGB(r: number, g: number, b: number): string {
  const toLinear = (v: number) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  const luminance = 0.2126 * toLinear(r / 255) + 0.7152 * toLinear(g / 255) + 0.0722 * toLinear(b / 255);
  // Slightly higher threshold (0.18) for images vs solid colours (0.12)
  // to account for tonal variation in photographs/patterns
  return luminance < 0.18 ? '#E8E0D0' : '#1A1A1A';
}

/** Quick perceived luminance (0–1) — used for UI pickers only */
export function getPerceivedLuminance(hex: string): number {
  const c = hex.replace('#', '');
  if (c.length < 6) return 0.5;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** WCAG 2.0 contrast ratio (1–21) between two colours */
export function getContrastRatio(hexA: string, hexB: string): number {
  const la = getLuminance(hexA);
  const lb = getLuminance(hexB);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * True when `fgHex` remains readable on `bgHex` (contrast ratio ≥ minRatio).
 * Invalid/truncated colours return false so callers fall back to auto-contrast.
 *
 * Default 3.0 ≈ WCAG AA for large text — the practical minimum for
 * "visible at all"; anything below is treated as broken data, not design.
 */
export function isReadableOn(fgHex: string, bgHex: string, minRatio = 3): boolean {
  if (!fgHex || !bgHex) return false;
  const fg = fgHex.replace('#', '');
  const bg = bgHex.replace('#', '');
  if (fg.length < 6 || bg.length < 6) return false;
  return getContrastRatio(fgHex, bgHex) >= minRatio;
}

/**
 * Parse "#RRGGBB" into [r, g, b] (0–255 integers).
 */
function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  return [
    parseInt(c.substring(0, 2), 16),
    parseInt(c.substring(2, 4), 16),
    parseInt(c.substring(4, 6), 16),
  ];
}

/**
 * Generate a <style> tag content that overrides all Tailwind-generated
 * charcoal-ink and champagne-silk utility classes scoped under
 * `[data-wedding-root]`.
 *
 * This is needed because Tailwind 4 resolves `@theme inline` colours
 * to hardcoded rgb/oklch at build time, so CSS variable overrides alone
 * don't affect utility classes.
 */
export function generateThemeOverrideStyle(
  textColor: string,
  borderColor: string,
  headerTextColor?: string,
  headerBg?: string,
): string {
  const [tr, tg, tb] = hexToRgb(textColor);
  const [br, bg_, bb] = hexToRgb(borderColor);
  const SCOPE = '[data-wedding-root]';

  const lines: string[] = [];

  // Helper to generate a single rule.
  // When `self` is true, also emits a self-referencing rule for elements
  // that have BOTH the scope attribute AND the target class (e.g. the
  // root div itself or the <header> which carries both the data-attr
  // and the Tailwind class).
  const rule = (selector: string, prop: string, r: number, g: number, b: number, alpha?: number, scope?: string, self = false) => {
    const color = alpha !== undefined
      ? `rgb(${r} ${g} ${b} / ${alpha})`
      : `rgb(${r} ${g} ${b})`;
    const sc = scope || SCOPE;
    lines.push(`${sc} ${selector} { ${prop}: ${color}; }`);
    if (self) {
      // Self-referencing: scope AND selector on the same element
      const sel = selector.startsWith('.') ? selector.substring(1) : selector;
      lines.push(`${sc}.${sel} { ${prop}: ${color}; }`);
    }
  };

  // ── text-charcoal-ink ──
  // Override text colour to the theme text colour (e.g. light on dark themes).
  rule('.text-charcoal-ink', 'color', tr, tg, tb);
  for (const a of [20, 25, 30, 35, 40, 50, 60, 70, 75, 80]) {
    rule(`.text-charcoal-ink\\/${a}`, 'color', tr, tg, tb, a / 100);
  }

  // ── White-card protection ──
  // Elements inside white-background containers (cards, modals, etc.) must
  // keep dark text for readability, regardless of the page theme colour.
  // We override the theme text colour back to dark (#1A1A1A) for any
  // .text-charcoal-ink element that is a descendant of .bg-white or
  // .bg-paper-cream — including alpha variants like bg-white/50 (common
  // on Story tidbit cards, glass panels, etc.). Uses !important + higher
  // specificity to win over the theme override above.
  // Note: alpha variants use rgba() (not rgb() with slash alpha, which is
  // invalid in the comma-separated form).
  const DARK_R = 26, DARK_G = 26, DARK_B = 26;
  // Solid containers
  lines.push(`${SCOPE} .bg-white .text-charcoal-ink { color: rgb(${DARK_R}, ${DARK_G}, ${DARK_B}) !important; }`);
  lines.push(`${SCOPE} .bg-paper-cream .text-charcoal-ink { color: rgb(${DARK_R}, ${DARK_G}, ${DARK_B}) !important; }`);
  // Alpha-variant containers (bg-white/20, bg-white/50, bg-paper-cream/40, etc.)
  // These are semi-transparent white overlays — still light enough that dark
  // text is more readable than the theme text colour on dark themes.
  for (const a of [5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95]) {
    lines.push(`${SCOPE} .bg-white\\/${a} .text-charcoal-ink { color: rgb(${DARK_R}, ${DARK_G}, ${DARK_B}) !important; }`);
    lines.push(`${SCOPE} .bg-paper-cream\\/${a} .text-charcoal-ink { color: rgb(${DARK_R}, ${DARK_G}, ${DARK_B}) !important; }`);
  }
  // Alpha-variant text inside solid containers
  for (const a of [20, 25, 30, 35, 40, 50, 60, 70, 75, 80]) {
    lines.push(`${SCOPE} .bg-white .text-charcoal-ink\\/${a} { color: rgba(${DARK_R}, ${DARK_G}, ${DARK_B}, ${a / 100}) !important; }`);
    lines.push(`${SCOPE} .bg-paper-cream .text-charcoal-ink\\/${a} { color: rgba(${DARK_R}, ${DARK_G}, ${DARK_B}, ${a / 100}) !important; }`);
  }
  // Alpha-variant text inside alpha-variant containers (e.g. text-charcoal-ink/80
  // inside bg-white/50 — common on Story tidbit cards)
  for (const ca of [5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95]) {
    for (const ta of [20, 25, 30, 35, 40, 50, 60, 70, 75, 80]) {
      lines.push(`${SCOPE} .bg-white\\/${ca} .text-charcoal-ink\\/${ta} { color: rgba(${DARK_R}, ${DARK_G}, ${DARK_B}, ${ta / 100}) !important; }`);
      lines.push(`${SCOPE} .bg-paper-cream\\/${ca} .text-charcoal-ink\\/${ta} { color: rgba(${DARK_R}, ${DARK_G}, ${DARK_B}, ${ta / 100}) !important; }`);
    }
  }
  // Same-element combos (bg-white + text-charcoal-ink on ONE element — e.g.
  // the Schedule page "Add to Calendar"/"Directions" buttons). The descendant
  // rules above don't match these, so the theme remap used to paint their
  // labels in the theme colour (cream-on-white on dark themes — invisible).
  lines.push(`${SCOPE} .bg-white.text-charcoal-ink { color: rgb(${DARK_R}, ${DARK_G}, ${DARK_B}) !important; }`);
  lines.push(`${SCOPE} .bg-paper-cream.text-charcoal-ink { color: rgb(${DARK_R}, ${DARK_G}, ${DARK_B}) !important; }`);
  for (const ca of [5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95]) {
    lines.push(`${SCOPE} .bg-white\\/${ca}.text-charcoal-ink { color: rgb(${DARK_R}, ${DARK_G}, ${DARK_B}) !important; }`);
    lines.push(`${SCOPE} .bg-paper-cream\\/${ca}.text-charcoal-ink { color: rgb(${DARK_R}, ${DARK_G}, ${DARK_B}) !important; }`);
  }
  for (const ta of [20, 25, 30, 35, 40, 50, 60, 70, 75, 80]) {
    lines.push(`${SCOPE} .bg-white.text-charcoal-ink\\/${ta} { color: rgba(${DARK_R}, ${DARK_G}, ${DARK_B}, ${ta / 100}) !important; }`);
    lines.push(`${SCOPE} .bg-paper-cream.text-charcoal-ink\\/${ta} { color: rgba(${DARK_R}, ${DARK_G}, ${DARK_B}, ${ta / 100}) !important; }`);
    for (const ca of [5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95]) {
      lines.push(`${SCOPE} .bg-white\\/${ca}.text-charcoal-ink\\/${ta} { color: rgba(${DARK_R}, ${DARK_G}, ${DARK_B}, ${ta / 100}) !important; }`);
      lines.push(`${SCOPE} .bg-paper-cream\\/${ca}.text-charcoal-ink\\/${ta} { color: rgba(${DARK_R}, ${DARK_G}, ${DARK_B}, ${ta / 100}) !important; }`);
    }
  }

  // ── border-charcoal-ink ──
  rule('.border-charcoal-ink', 'border-color', tr, tg, tb);
  for (const a of [5, 8, 10, 15, 20, 30, 40]) {
    rule(`.border-charcoal-ink\\/${a}`, 'border-color', tr, tg, tb, a / 100);
  }

  // ── bg-charcoal-ink ──
  rule('.bg-charcoal-ink', 'background-color', tr, tg, tb);
  for (const a of [3, 5, 10, 20, 30, 60, 90]) {
    rule(`.bg-charcoal-ink\\/${a}`, 'background-color', tr, tg, tb, a / 100);
  }

  // ── border-champagne-silk ──
  rule('.border-champagne-silk', 'border-color', br, bg_, bb);
  for (const a of [10, 20, 30, 40, 50, 60]) {
    rule(`.border-champagne-silk\\/${a}`, 'border-color', br, bg_, bb, a / 100);
  }

  // ── bg-champagne-silk ──
  rule('.bg-champagne-silk', 'background-color', br, bg_, bb);
  for (const a of [20, 30, 40, 50, 60]) {
    rule(`.bg-champagne-silk\\/${a}`, 'background-color', br, bg_, bb, a / 100);
  }

  // ── text-champagne-silk ──
  rule('.text-champagne-silk', 'color', br, bg_, bb);

  // ── divide-champagne-silk (uses :where) ──
  lines.push(`${SCOPE} :where(.divide-champagne-silk > :not(:last-child)) { border-color: rgb(${br} ${bg_} ${bb}); }`);
  for (const a of [50]) {
    lines.push(`${SCOPE} :where(.divide-champagne-silk\\/${a} > :not(:last-child)) { border-color: rgb(${br} ${bg_} ${bb} / ${a / 100}); }`);
  }

  // ── Dark-theme CTA/button repair (P0) ─────────────────────────────────
  // The bg-charcoal-ink remap above re-paints solid charcoal buttons/panels
  // with the (light) theme text colour on dark themes, but their
  // .text-paper-cream labels were never remapped — producing light-on-light
  // (≈1.2:1, invisible) CTAs. Restore the inverse pairing:
  //
  //   1. ON / INSIDE a solid .bg-charcoal-ink surface (now light) →
  //      .text-paper-cream flips to dark ink.
  //   2. INSIDE light cards (.bg-white / .bg-paper-cream, solid + alpha) →
  //      the button KEEPS its original charcoal background and cream label
  //      (mirrors the white-card text protection above, so embedded CTAs
  //      render exactly as they do on light themes).
  //   3. .hover\:bg-black hover states re-paint to the light theme colour so
  //      the swapped dark label stays readable on hover.
  //
  // Only emitted when the theme text colour is LIGHT (a dark theme). On light
  // themes the bg-charcoal-ink remap is an identity transform, so no swap is
  // needed — output stays byte-compatible with the pre-fix behaviour.
  if (!isDarkBackground(textColor)) {
    const INK = 'rgb(26, 26, 26)';       // original charcoal-ink
    const CREAM = 'rgb(252, 249, 242)'; // original paper-cream

    // 1) paper-cream labels on/inside remapped (now light) charcoal surfaces
    lines.push(`${SCOPE} .bg-charcoal-ink .text-paper-cream { color: ${INK}; }`);
    lines.push(`${SCOPE} .bg-charcoal-ink.text-paper-cream { color: ${INK}; }`);
    for (const a of [30, 40, 50, 60, 70, 80, 90]) {
      lines.push(`${SCOPE} .bg-charcoal-ink .text-paper-cream\\/${a} { color: rgba(26, 26, 26, ${a / 100}); }`);
      lines.push(`${SCOPE} .bg-charcoal-ink.text-paper-cream\\/${a} { color: rgba(26, 26, 26, ${a / 100}); }`);
    }

    // 2) Light-card restore — embedded charcoal buttons keep the original
    //    charcoal bg + cream label (identical to light-theme rendering).
    //    !important + higher specificity beats the remaps above, exactly like
    //    the white-card text protection.
    const containers: string[] = ['.bg-white', '.bg-paper-cream'];
    for (const a of [5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95]) {
      containers.push(`.bg-white\\/${a}`, `.bg-paper-cream\\/${a}`);
    }
    for (const c of containers) {
      // background restore (solid + alpha variants of the button/panel bg)
      lines.push(`${SCOPE} ${c} .bg-charcoal-ink { background-color: ${INK} !important; }`);
      for (const ba of [3, 5, 10, 20, 30, 60, 90]) {
        lines.push(`${SCOPE} ${c} .bg-charcoal-ink\\/${ba} { background-color: rgba(26, 26, 26, ${ba / 100}) !important; }`);
      }
      // label restore (solid + alpha)
      lines.push(`${SCOPE} ${c} .bg-charcoal-ink .text-paper-cream { color: ${CREAM} !important; }`);
      lines.push(`${SCOPE} ${c} .bg-charcoal-ink.text-paper-cream { color: ${CREAM} !important; }`);
      for (const ta of [30, 40, 50, 60, 70, 80, 90]) {
        lines.push(`${SCOPE} ${c} .bg-charcoal-ink .text-paper-cream\\/${ta} { color: rgba(252, 249, 242, ${ta / 100}) !important; }`);
        lines.push(`${SCOPE} ${c} .bg-charcoal-ink.text-paper-cream\\/${ta} { color: rgba(252, 249, 242, ${ta / 100}) !important; }`);
      }
    }

    // 3) hover\:bg-black — would pair black with the swapped dark label;
    //    re-paint to the light theme colour so the hover pairing stays readable
    lines.push(`${SCOPE} .hover\\:bg-black:hover { background-color: rgb(${tr} ${tg} ${tb}); }`);
  }

  // ── Header-specific overrides ──
  // When the header bg differs from page bg, its text AND border colours
  // must contrast with the header bg, not the page bg.
  // Use `self = true` because the <header> element carries both
  // data-wedding-header AND the Tailwind classes directly.
  if (headerTextColor && headerTextColor !== textColor) {
    const [hr, hg, hb] = hexToRgb(headerTextColor);
    const HSCOPE = '[data-wedding-header]';

    // Re-derive the correct border colour for the header bg
    const headerBorder = getAutoBorderColor(headerBg!);
    const [hbr, hbg, hbb] = hexToRgb(headerBorder);

    // Text overrides
    rule('.text-charcoal-ink', 'color', hr, hg, hb, undefined, HSCOPE, true);
    for (const a of [20, 25, 30, 35, 40, 50, 60, 70, 75, 80]) {
      rule(`.text-charcoal-ink\\/${a}`, 'color', hr, hg, hb, a / 100, HSCOPE, true);
    }

    // Border overrides (champagne-silk)
    rule('.border-champagne-silk', 'border-color', hbr, hbg, hbb, undefined, HSCOPE, true);
    for (const a of [10, 20, 30, 40, 50, 60]) {
      rule(`.border-champagne-silk\\/${a}`, 'border-color', hbr, hbg, hbb, a / 100, HSCOPE, true);
    }

    // Background overrides (charcoal-ink used in buttons etc.)
    rule('.bg-charcoal-ink', 'background-color', hr, hg, hb, undefined, HSCOPE, true);
    for (const a of [3, 5, 10, 20, 30, 60, 90]) {
      rule(`.bg-charcoal-ink\\/${a}`, 'background-color', hr, hg, hb, a / 100, HSCOPE, true);
    }

    // ── Chrome-specific overrides (footer, mobile drawer, bottom nav) ──
    // These elements share the header's bg/text colour (the "platform chrome")
    // and must NOT inherit the body text colour. They carry data-wedding-chrome.
    // Use descendant selectors (no `self`) since the chrome text colour applies
    // to inner links/labels, not the element carrying the attribute itself.
    const CSCOPE = '[data-wedding-chrome]';
    rule('.text-charcoal-ink', 'color', hr, hg, hb, undefined, CSCOPE);
    for (const a of [20, 25, 30, 35, 40, 50, 60, 70, 75, 80]) {
      rule(`.text-charcoal-ink\\/${a}`, 'color', hr, hg, hb, a / 100, CSCOPE);
    }
    rule('.border-champagne-silk', 'border-color', hbr, hbg, hbb, undefined, CSCOPE);
    for (const a of [10, 20, 30, 40, 50, 60]) {
      rule(`.border-champagne-silk\\/${a}`, 'border-color', hbr, hbg, hbb, a / 100, CSCOPE);
    }
  }

  return lines.join('\n');
}