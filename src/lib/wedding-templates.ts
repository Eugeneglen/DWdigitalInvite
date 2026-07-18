/**
 * Shared wedding theme templates — the single source of truth.
 *
 * Imported by:
 *   - src/components/cms/pages/MasterTemplates.tsx (Admin CMS editor)
 *   - src/app/api/cms/templates/route.ts           (Couple CMS read-only API)
 *
 * IMPORTANT: Do not duplicate these values in either consumer. Always
 * import from here so admin and couple see identical palettes.
 */

export interface WeddingTemplateColors {
  bg: string;
  text: string;
  accent: string;
  secondary: string;
  muted: string;
}

export interface WeddingTemplateFonts {
  heading: string;
  body: string;
}

export interface WeddingTemplate {
  id: string;
  name: string;
  description: string;
  colors: WeddingTemplateColors;
  fonts: WeddingTemplateFonts;
  isActive: boolean;
  isDefault: boolean;
}

export const DEFAULT_TEMPLATES: WeddingTemplate[] = [
  {
    id: 'classic-elegance',
    name: 'Classic Elegance',
    description: 'Timeless cream and gold palette with a luxurious, traditional feel. Perfect for formal celebrations.',
    colors: { bg: '#FDF8F0', text: '#2C2C2C', accent: '#D4AF37', secondary: '#8B7355', muted: '#A09888' },
    fonts: { heading: 'Playfair Display', body: 'Lato' },
    isActive: true,
    isDefault: true,
  },
  {
    id: 'modern-minimalist',
    name: 'Modern Minimalist',
    description: 'Clean white slate with emerald accents. Ideal for contemporary, understated weddings.',
    colors: { bg: '#FFFFFF', text: '#334155', accent: '#059669', secondary: '#64748B', muted: '#CBD5E1' },
    fonts: { heading: 'Inter', body: 'Inter' },
    isActive: true,
    isDefault: false,
  },
  {
    id: 'romantic-blush',
    name: 'Romantic Blush',
    description: 'Soft rose-pink tones with rich burgundy and warm copper. A dreamy, romantic atmosphere.',
    colors: { bg: '#FFF0F0', text: '#6B1D3A', accent: '#B87333', secondary: '#C27C7C', muted: '#E8B4B4' },
    fonts: { heading: 'Cormorant Garamond', body: 'Nunito' },
    isActive: true,
    isDefault: false,
  },
  {
    id: 'midnight-garden',
    name: 'Midnight Garden',
    description: 'Deep navy backdrop with white text and lavender touches. Dramatic and enchanting evening affairs.',
    colors: { bg: '#0F172A', text: '#F8FAFC', accent: '#A78BFA', secondary: '#C4B5FD', muted: '#475569' },
    fonts: { heading: 'Playfair Display', body: 'Source Sans 3' },
    isActive: true,
    isDefault: false,
  },
  {
    id: 'tropical-breeze',
    name: 'Tropical Breeze',
    description: 'Warm sand and teal with vibrant coral accents. Perfect for beach or destination weddings.',
    colors: { bg: '#FAF5EF', text: '#134E4A', accent: '#F97316', secondary: '#2DD4BF', muted: '#D6CFC5' },
    fonts: { heading: 'DM Serif Display', body: 'Nunito Sans' },
    isActive: true,
    isDefault: false,
  },
  {
    id: 'autumn-warmth',
    name: 'Autumn Warmth',
    description: 'Rich ivory and espresso with glowing amber accents. Warm, cozy, and inviting fall celebrations.',
    colors: { bg: '#FFF8F0', text: '#3C2415', accent: '#F59E0B', secondary: '#92400E', muted: '#C4A882' },
    fonts: { heading: 'Cormorant Garamond', body: 'Open Sans' },
    isActive: true,
    isDefault: false,
  },
];
