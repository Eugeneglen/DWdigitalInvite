'use client';

import { useState, useEffect } from 'react';

// Slug-aware cache — separate entries per slug, plus a default (no slug) entry
const cacheMap = new Map<string, { data: PublicWeddingData | null; promise: Promise<PublicWeddingData | null> | null }>();

function getCacheKey(slug?: string): string {
  return slug ?? '__default__';
}

export interface PublicWeddingData {
  wedding: {
    id: string;
    slug: string;
    coupleName: string;
    brideName: string | null;
    groomName: string | null;
    weddingDate: string;
    weddingTime: string | null;
    venue: string | null;
    venueAddress: string | null;
    googleMapsUrl: string | null;
    heroImageUrl: string | null;
    heroVideoUrl: string | null;
    bannerUrl: string | null;
  };
  content: Record<string, Record<string, string>>;
  schedules: {
    id: string;
    eventType: string;
    title: string;
    description: string | null;
    startTime: string;
    endTime: string | null;
    location: string | null;
    sortOrder: number;
  }[];
  faqs: {
    id: string;
    question: string;
    answer: string;
    sortOrder: number;
  }[];
  stories: {
    id: string;
    title: string;
    content: string;
    date: string | null;
    imageUrl: string | null;
    sortOrder: number;
  }[];
  media: {
    id: string;
    url: string;
    thumbnailUrl: string | null;
    fileName: string;
    fileType: string;
    fileSize: number | null;
    category: string;
    sortOrder: number;
  }[];
  mediaByCategory: Record<string, PublicWeddingData['media']>;
  featureFlags: Record<string, boolean>;
  featureConfigs: Record<string, Record<string, unknown>>;
  animationAvailability?: Record<string, boolean>;
  rsvpCount: number;
  totalGuestCount: number;
  wishes: {
    id: string;
    name: string;
    relationship: string | null;
    message: string;
    imageUrl: string | null;
    createdAt: string;
  }[];
}

async function fetchWeddingData(slug?: string): Promise<PublicWeddingData | null> {
  const key = getCacheKey(slug);
  const entry = cacheMap.get(key);

  if (entry?.data) return entry.data;
  if (entry?.promise) return entry.promise;

  // No slug → render the default ContentTemplate as a live demo
  // Slug provided → fetch that specific wedding
  const url = slug
    ? `/api/wedding/public?slug=${encodeURIComponent(slug)}&XTransformPort=3000`
    : `/api/template-demo?XTransformPort=3000`;

  const promise = fetch(url)
    .then((res) => {
      if (!res.ok) return null;
      return res.json();
    })
    .then((data) => {
      const current = cacheMap.get(key) ?? { data: null, promise: null };
      current.data = data;
      cacheMap.set(key, current);
      return data;
    })
    .catch(() => null);

  cacheMap.set(key, { data: null, promise });
  return promise;
}

/**
 * Fetches the public wedding data once and caches it for the session.
 * Cache is slug-aware — different slugs get separate caches.
 */
export function usePublicWedding(slug?: string) {
  const key = getCacheKey(slug);
  const cachedEntry = cacheMap.get(key);
  const [data, setData] = useState<PublicWeddingData | null>(cachedEntry?.data ?? null);
  const [loading, setLoading] = useState(!cachedEntry?.data);

  useEffect(() => {
    const entry = cacheMap.get(key);
    if (entry?.data) return;
    let cancelled = false;

    fetchWeddingData(slug).then((result) => {
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [slug, key]);

  /** Helper to get a content field value with fallback */
  const getField = (section: string, fieldKey: string, fallback = ''): string => {
    if (!data) return fallback;
    return data.content[section]?.[fieldKey] ?? fallback;
  };

  return { data, loading, getField };
}

/**
 * Invalidate cached wedding data.
 * Pass a specific slug to invalidate that entry only, or omit to clear all.
 */
export function invalidateWeddingCache(slug?: string) {
  if (slug) {
    cacheMap.delete(getCacheKey(slug));
  } else {
    cacheMap.clear();
  }
}