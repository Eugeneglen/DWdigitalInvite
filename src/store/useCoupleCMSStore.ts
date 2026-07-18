import { create } from 'zustand';

export type CoupleCMSPage = 'overview' | 'details' | 'content' | 'home' | 'design' | 'schedule' | 'story' | 'moments' | 'rsvps' | 'getting-there' | 'wishes' | 'faqs' | 'features' | 'guests' | 'analytics' | 'audit' | 'sharing';

interface CoupleCMSState {
  currentPage: CoupleCMSPage;
  setPage: (page: CoupleCMSPage) => void;
  weddingId: string | null;
  setWeddingId: (id: string | null) => void;
  weddingData: Record<string, unknown> | null;
  setWeddingData: (data: Record<string, unknown> | null) => void;
  previewMode: boolean;
  togglePreview: (on: boolean) => void;
}

export const useCoupleCMSStore = create<CoupleCMSState>((set) => ({
  currentPage: 'overview',
  setPage: (page) => set({ currentPage: page }),
  weddingId: null,
  setWeddingId: (id) => set({ weddingId: id }),
  weddingData: null,
  setWeddingData: (data) => set({ weddingData: data }),
  previewMode: false,
  togglePreview: (on) => set({ previewMode: on }),
}));