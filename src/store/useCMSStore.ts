import { create } from 'zustand';

export type CMSPage = 'dashboard' | 'weddings' | 'users' | 'templates' | 'analytics' | 'settings' | 'audit';

/** Auth user context passed to CMS page components */
export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  role: string;
  tenantId?: string;
  tenantRole?: string;
  token?: string;
}

interface CMSState {
  currentPage: CMSPage;
  setPage: (page: CMSPage) => void;
}

export const useCMSStore = create<CMSState>((set) => ({
  currentPage: 'dashboard',
  setPage: (page) => set({ currentPage: page }),
}));
