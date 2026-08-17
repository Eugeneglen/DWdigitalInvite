import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/template-demo
 *
 * Returns the default ContentTemplate's content shaped as PublicWeddingData —
 * the exact same format that /api/wedding/public returns. This lets the
 * guest-facing site render the default template as a live demo when no
 * specific wedding slug is provided.
 *
 * This endpoint is READ-ONLY and requires NO authentication.
 * It does NOT touch any WeddingAccount rows.
 */
export async function GET() {
  try {
    // ── 1. Fetch the default template ─────────────────────────────────────
    const template = await db.contentTemplate.findFirst({
      where: { isDefault: true, isActive: true },
    });

    if (!template) {
      return NextResponse.json({ error: 'No default template set' }, { status: 404 });
    }

    // ── 2. Parse all 6 JSON columns ───────────────────────────────────────
    const contentItems = JSON.parse(template.content) as {
      section: string;
      fieldKey: string;
      fieldValue: string;
      fieldType: string;
    }[];
    const scheduleItems = JSON.parse(template.schedule) as {
      eventType: string;
      title: string;
      description: string | null;
      startTime: string;
      endTime: string | null;
      location: string | null;
      sortOrder: number;
    }[];
    const faqItems = JSON.parse(template.faqs) as {
      question: string;
      answer: string;
      sortOrder: number;
      isActive: boolean;
    }[];
    const storyItems = JSON.parse(template.stories) as {
      title: string;
      content: string;
      date: string | null;
      imageUrl: string | null;
      sortOrder: number;
    }[];
    const mediaItems = JSON.parse(template.media) as {
      url: string;
      thumbnailUrl: string | null;
      fileName: string;
      fileType: string;
      category: string;
      sortOrder: number;
    }[];
    const themeData = JSON.parse(template.theme) as {
      colors: { bg: string; text: string; accent: string; secondary: string; muted: string };
      fonts: { heading: string; body: string };
    };

    // ── 3. Build content map (same transform as /api/wedding/public) ──────
    const contentMap: Record<string, Record<string, string>> = {};
    for (const c of contentItems) {
      if (!contentMap[c.section]) contentMap[c.section] = {};
      contentMap[c.section][c.fieldKey] = c.fieldValue;
    }

    // Theme column is authoritative — overwrite any global values from content
    contentMap['global'] = contentMap['global'] || {};
    contentMap['global']['backgroundColor'] = themeData.colors.bg;
    contentMap['global']['textColor'] = themeData.colors.text;
    contentMap['global']['accentColor'] = themeData.colors.accent;
    contentMap['global']['secondaryColor'] = themeData.colors.secondary;
    contentMap['global']['mutedColor'] = themeData.colors.muted;
    contentMap['global']['fontFamily'] = themeData.fonts.heading;
    contentMap['global']['bodyFont'] = themeData.fonts.body;
    contentMap['hero'] = contentMap['hero'] || {};
    contentMap['hero']['fontFamily'] = themeData.fonts.heading;

    // ── 4. Extract hero/banner URLs for the wedding object ───────────────
    const heroImageUrl = contentItems.find(c => c.section === 'hero' && c.fieldKey === 'heroImageUrl')?.fieldValue || null;
    const bannerUrl = contentItems.find(c => c.section === 'hero' && c.fieldKey === 'bannerUrl')?.fieldValue || null;
    const heroVideoUrl = contentItems.find(c => c.section === 'hero' && c.fieldKey === 'heroVideoUrl')?.fieldValue || null;
    const coupleName = contentItems.find(c => c.section === 'hero' && c.fieldKey === 'title')?.fieldValue || template.name;

    // ── 5. Build mediaByCategory (same transform as /api/wedding/public) ─
    const mediaByCategory: Record<string, typeof mediaItems> = {};
    for (const m of mediaItems) {
      if (!mediaByCategory[m.category]) mediaByCategory[m.category] = [];
      mediaByCategory[m.category].push(m);
    }

    // ── 6. Set a future date for the countdown timer ─────────────────────
    // 6 months from now so the countdown always shows a positive value
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 6);

    // ── 7. Feature flags for demo ──────────────────────────────────────
    // Enable all main tabs so visitors can see the full template experience.
    // music/video are disabled since the demo has no real media files.
    // Animation flags are read from the template's hero content fields
    // (set via the Template Editor's "Ambient Animations" toggles).
    const getAnimFlag = (key: string) => {
      const val = contentMap['hero']?.[key];
      // If admin explicitly set a value in the template, use it.
      // Otherwise fall back to defaults (gold-dust ON, others OFF).
      if (val !== undefined) return val === 'true';
      return key === 'animation:gold-dust';
    };

    const featureFlags: Record<string, boolean> = {
      countdown: true,
      schedule: true,
      rsvp: true,
      story: true,
      gallery: mediaItems.length > 0,
      wishes: true,
      'getting-there': true,
      qa: faqItems.length > 0,
      moments: true,
      music: false,
      video: false,
      'animation:gold-dust': getAnimFlag('animation:gold-dust'),
      'animation:flying-stars': getAnimFlag('animation:flying-stars'),
      'animation:raining': getAnimFlag('animation:raining'),
    };

    // ── 8. Return PublicWeddingData shape ─────────────────────────────────
    return NextResponse.json({
      wedding: {
        id: `template-${template.id}`,
        slug: '',
        coupleName,
        brideName: null,
        groomName: null,
        weddingDate: futureDate.toISOString(),
        weddingTime: null,
        venue: null,
        venueAddress: null,
        googleMapsUrl: null,
        heroImageUrl,
        heroVideoUrl,
        bannerUrl,
      },
      content: contentMap,
      schedules: scheduleItems.map(s => ({
        id: `template-sched-${s.sortOrder}`,
        ...s,
      })),
      faqs: faqItems
        .filter(f => f.isActive)
        .map((f, i) => ({
          id: `template-faq-${i}`,
          ...f,
        })),
      stories: storyItems.map((s, i) => ({
        id: `template-story-${i}`,
        ...s,
      })),
      media: mediaItems.map((m, i) => ({
        id: `template-media-${i}`,
        fileSize: null,
        ...m,
      })),
      mediaByCategory,
      featureFlags,
      featureConfigs: {},
      rsvpCount: 0,
      totalGuestCount: 0,
      totalWishCount: 0,
      totalRsvpCount: 0,
      wishes: [],
    });
  } catch (error) {
    console.error('[template-demo] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
