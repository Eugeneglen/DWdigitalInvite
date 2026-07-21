'use client';

import { createContext, useContext } from 'react';

/**
 * WeddingSlugContext — provides the wedding slug to all child components
 * inside GuestSite. This ensures every child page calls
 * `usePublicWedding(slug)` with the CORRECT slug, rather than falling back
 * to the default (no-slug) cache entry which returns the first ACTIVE wedding.
 *
 * Without this context, child pages like HomePage, SchedulePage, etc.
 * call `usePublicWedding()` with no argument → fetch
 * `/api/wedding/public` (no slug) → get the wrong wedding's data.
 */
const WeddingSlugContext = createContext<string | undefined>(undefined);

export function WeddingSlugProvider({
  slug,
  children,
}: {
  slug: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <WeddingSlugContext.Provider value={slug}>
      {children}
    </WeddingSlugContext.Provider>
  );
}

/**
 * Returns the wedding slug from context, or undefined if not inside a
 * WeddingSlugProvider (e.g., the platform landing page at `/`).
 */
export function useWeddingSlug(): string | undefined {
  return useContext(WeddingSlugContext);
}
