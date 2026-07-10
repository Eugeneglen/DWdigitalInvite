import { create } from 'zustand';

export type Section =
  | 'home'
  | 'schedule'
  | 'rsvp'
  | 'getting-there'
  | 'story'
  | 'wishes'
  | 'qa'
  | 'moments';

export interface NavTab {
  id: string;
  label: string;
  section: Section;
  enabled: boolean;
}

/** Sections that are always shown (default for every wedding) */
export const DEFAULT_SECTIONS: Section[] = ['home', 'schedule', 'rsvp', 'getting-there'];

/** Sections that are optional (admin toggles per wedding) */
export const OPTIONAL_SECTIONS: { section: Section; label: string; featureKey: string }[] = [
  { section: 'story', label: 'Story', featureKey: 'story' },
  { section: 'wishes', label: 'Wishes', featureKey: 'wishes' },
  { section: 'qa', label: 'Q&A', featureKey: 'qa' },
  { section: 'moments', label: 'Moments', featureKey: 'moments' },
];

/** Map nav section → WeddingFeature featureKey */
const SECTION_TO_FEATURE: Partial<Record<Section, string>> = {
  schedule: 'schedule',
  rsvp: 'rsvp',
  'getting-there': 'getting-there',
  story: 'story',
  wishes: 'wishes',
  qa: 'qa',
  moments: 'moments',
};

/** Filter global nav tabs by wedding feature flags.
 *  When featureFlags is empty (no wedding data loaded yet), show all tabs. */
export function filterTabsByFeatures(
  tabs: NavTab[],
  featureFlags: Record<string, boolean>,
): NavTab[] {
  const hasFlags = Object.keys(featureFlags).length > 0;
  return tabs.filter((tab) => {
    if (tab.section === 'home') return true; // always shown
    const featureKey = SECTION_TO_FEATURE[tab.section];
    if (!featureKey) return true; // unknown section → show
    return !hasFlags || featureFlags[featureKey] === true;
  });
}

interface NavigationState {
  currentSection: Section;
  drawerOpen: boolean;
  /** The filtered list of nav tabs available for this wedding */
  availableTabs: NavTab[];
  setAvailableTabs: (tabs: NavTab[]) => void;
  setSection: (section: Section) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  currentSection: 'home',
  drawerOpen: false,
  availableTabs: [],
  setAvailableTabs: (tabs) => set({ availableTabs: tabs }),
  setSection: (section) => {
    set({ currentSection: section, drawerOpen: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
  toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
}));