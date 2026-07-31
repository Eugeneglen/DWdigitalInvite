import { create } from 'zustand';

export type CMSPage = 'dashboard' | 'weddings' | 'users' | 'roles' | 'templates' | 'template-editor' | 'analytics' | 'settings' | 'audit';

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
  /** ID of the content template being edited (for template-editor page) */
  editingTemplateId: string | null;
  setEditingTemplateId: (id: string | null) => void;
}

export const useCMSStore = create<CMSState>((set) => ({
  currentPage: 'dashboard',
  setPage: (page) => set({ currentPage: page }),
  editingTemplateId: null,
  setEditingTemplateId: (id) => set({ editingTemplateId: id }),
}));
