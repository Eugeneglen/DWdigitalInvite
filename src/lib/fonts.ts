/**
 * Shared font catalogue for the DWdigitalInvite platform.
 *
 * Used by:
 *   - Admin CMS → Content Templates → Design → Typography (TemplateEditor.tsx)
 *   - Couple CMS → Home → Font Picker (FontPicker.tsx)
 *
 * Keeping the list in one place ensures both sides always offer the same
 * selection and the Google Fonts <link> in layout.tsx stays in sync.
 *
 * Every font here MUST also be loaded by the Google Fonts <link> tag in
 * src/app/layout.tsx (or via a local font).  Fonts not loaded will still
 * appear in the picker but render in a fallback serif/sans at runtime.
 */

export interface FontOption {
  value: string;
  category: string;
}

export const FONT_OPTIONS: FontOption[] = [
  // ── Elegant Serif (19) ───────────────────────────────────
  { value: 'Playfair Display', category: 'Elegant Serif' },
  { value: 'Cormorant Garamond', category: 'Elegant Serif' },
  { value: 'Cormorant', category: 'Elegant Serif' },
  { value: 'EB Garamond', category: 'Elegant Serif' },
  { value: 'Lora', category: 'Elegant Serif' },
  { value: 'Spectral', category: 'Elegant Serif' },
  { value: 'Libre Baskerville', category: 'Elegant Serif' },
  { value: 'Merriweather', category: 'Elegant Serif' },
  { value: 'DM Serif Display', category: 'Elegant Serif' },
  { value: 'Bodoni Moda', category: 'Elegant Serif' },
  { value: 'Philosopher', category: 'Elegant Serif' },
  { value: 'Source Serif 4', category: 'Elegant Serif' },
  { value: 'Cardo', category: 'Elegant Serif' },
  { value: 'Gelasio', category: 'Elegant Serif' },
  { value: 'Crimson Text', category: 'Elegant Serif' },
  { value: 'Aleo', category: 'Elegant Serif' },
  { value: 'Yeseva One', category: 'Elegant Serif' },
  { value: 'Frank Ruhl Libre', category: 'Elegant Serif' },
  { value: 'Bitter', category: 'Elegant Serif' },

  // ── Display Serif (10) ───────────────────────────────────
  { value: 'Cinzel', category: 'Display Serif' },
  { value: 'Cinzel Decorative', category: 'Display Serif' },
  { value: 'Prata', category: 'Display Serif' },
  { value: 'Italiana', category: 'Display Serif' },
  { value: 'Arizonia', category: 'Display Serif' },
  { value: 'Marcellus', category: 'Display Serif' },
  { value: 'Cormorant SC', category: 'Display Serif' },
  { value: 'Forum', category: 'Display Serif' },
  { value: 'Balthazar', category: 'Display Serif' },
  { value: 'Playfair Display SC', category: 'Display Serif' },

  // ── Modern Sans (16) ─────────────────────────────────────
  { value: 'Montserrat', category: 'Modern Sans' },
  { value: 'Raleway', category: 'Modern Sans' },
  { value: 'Poppins', category: 'Modern Sans' },
  { value: 'Lato', category: 'Modern Sans' },
  { value: 'Quicksand', category: 'Modern Sans' },
  { value: 'Nunito', category: 'Modern Sans' },
  { value: 'Work Sans', category: 'Modern Sans' },
  { value: 'Josefin Sans', category: 'Modern Sans' },
  { value: 'Inter', category: 'Modern Sans' },
  { value: 'Source Sans 3', category: 'Modern Sans' },
  { value: 'Manrope', category: 'Modern Sans' },
  { value: 'Mulish', category: 'Modern Sans' },
  { value: 'Karla', category: 'Modern Sans' },
  { value: 'Outfit', category: 'Modern Sans' },
  { value: 'Barlow', category: 'Modern Sans' },
  { value: 'Heebo', category: 'Modern Sans' },

  // ── Script & Calligraphy (16) ────────────────────────────
  { value: 'Great Vibes', category: 'Script & Calligraphy' },
  { value: 'Alex Brush', category: 'Script & Calligraphy' },
  { value: 'Allura', category: 'Script & Calligraphy' },
  { value: 'Parisienne', category: 'Script & Calligraphy' },
  { value: 'Tangerine', category: 'Script & Calligraphy' },
  { value: 'Sacramento', category: 'Script & Calligraphy' },
  { value: 'Petit Formal Script', category: 'Script & Calligraphy' },
  { value: 'Cookie', category: 'Script & Calligraphy' },
  { value: 'Pinyon Script', category: 'Script & Calligraphy' },
  { value: 'Italianno', category: 'Script & Calligraphy' },
  { value: 'Mrs Saint Delafield', category: 'Script & Calligraphy' },
  { value: 'Rochester', category: 'Script & Calligraphy' },
  { value: 'La Belle Aurore', category: 'Script & Calligraphy' },
  { value: 'League Script', category: 'Script & Calligraphy' },
  { value: 'Redressed', category: 'Script & Calligraphy' },
  { value: 'Marck Script', category: 'Script & Calligraphy' },

  // ── Handwritten (16) ─────────────────────────────────────
  { value: 'Dancing Script', category: 'Handwritten' },
  { value: 'Kaushan Script', category: 'Handwritten' },
  { value: 'Caveat', category: 'Handwritten' },
  { value: 'Amatic SC', category: 'Handwritten' },
  { value: 'Satisfy', category: 'Handwritten' },
  { value: 'Pacifico', category: 'Handwritten' },
  { value: 'Lobster', category: 'Handwritten' },
  { value: 'Yellowtail', category: 'Handwritten' },
  { value: 'Kalam', category: 'Handwritten' },
  { value: 'Patrick Hand', category: 'Handwritten' },
  { value: 'Indie Flower', category: 'Handwritten' },
  { value: 'Shadows Into Light', category: 'Handwritten' },
  { value: 'Gochi Hand', category: 'Handwritten' },
  { value: 'Reenie Beanie', category: 'Handwritten' },
  { value: 'Architects Daughter', category: 'Handwritten' },
  { value: 'Nanum Pen Script', category: 'Handwritten' },
];

export const FONT_CATEGORIES = [...new Set(FONT_OPTIONS.map((f) => f.category))];

export const DEFAULT_FONT = 'Playfair Display';
