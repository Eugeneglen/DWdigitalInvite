'use client';

import { useState, useEffect } from 'react';
import type { Section } from '@/store/useNavigationStore';

// ── Types ───────────────────────────────────────────────────────────────

export interface NavTab {
  id: string;
  label: string;
  section: Section;
  enabled: boolean;
}

export interface FooterContent {
  copyright: string;
  privacyPolicy: string;
  dataProtection: string;
  termsOfService: string;
}

export interface SiteSettings {
  navTabs: NavTab[];
  footerContent: FooterContent;
  headerBgColor: string;
}

// ── Defaults (match API defaults) ────────────────────────────────────────

const DEFAULT_NAV_TABS: NavTab[] = [
  { id: 'home', label: 'Home', section: 'home', enabled: true },
  { id: 'schedule', label: 'Schedule', section: 'schedule', enabled: true },
  { id: 'rsvp', label: 'RSVP', section: 'rsvp', enabled: true },
  { id: 'getting-there', label: 'Getting There', section: 'getting-there', enabled: true },
  { id: 'story', label: 'Story', section: 'story', enabled: true },
  { id: 'wishes', label: 'Wishes', section: 'wishes', enabled: true },
  { id: 'qa', label: 'Q&A', section: 'qa', enabled: true },
  { id: 'moments', label: 'Moments', section: 'moments', enabled: true },
];

const DEFAULT_FOOTER: FooterContent = {
  copyright: '© 2026 DREAMWEAVERS DIGITAL HEIRLOOMS. All rights reserved.',
  privacyPolicy: 'Privacy Policy content will appear here once configured by the administrator.',
  dataProtection: 'Data Protection content will appear here once configured by the administrator.',
  termsOfService: 'Terms of Service content will appear here once configured by the administrator.',
};

// ── Module-level cache so multiple components share one fetch ───────────
// Cache expires after 60 seconds so settings changes (e.g., nav tabs,
// footer text) eventually propagate without requiring a full page reload.

let cachedPromise: Promise<SiteSettings> | null = null;
let cachedData: SiteSettings | null = null;
let cachedAt: number = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

async function fetchSiteSettings(): Promise<SiteSettings> {
  // Check if cached data is still fresh
  if (cachedData && Date.now() - cachedAt < CACHE_TTL_MS) return cachedData;
  // Cache expired — clear it
  cachedData = null;
  if (cachedPromise) return cachedPromise;

  cachedPromise = fetch('/api/site-settings?XTransformPort=3000')
    .then((res) => {
      if (!res.ok) throw new Error('Failed to fetch site settings');
      return res.json();
    })
    .then((data: SiteSettings) => {
      cachedData = data;
      cachedAt = Date.now();
      cachedPromise = null;
      return data;
    })
    .catch(() => {
      cachedPromise = null;
      return { navTabs: DEFAULT_NAV_TABS, footerContent: DEFAULT_FOOTER, headerBgColor: '' };
    });

  return cachedPromise;
}

/** Invalidate cache — call after CMS saves settings */
export function invalidateSiteSettingsCache() {
  cachedData = null;
  cachedPromise = null;
}

// ── Hook ─────────────────────────────────────────────────────────────────

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>({
    navTabs: DEFAULT_NAV_TABS,
    footerContent: DEFAULT_FOOTER,
    headerBgColor: '',
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchSiteSettings().then((data) => {
      setSettings(data);
      setLoaded(true);
    });
  }, []);

  return { ...settings, loaded };
}