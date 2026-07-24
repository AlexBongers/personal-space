import { create } from 'zustand';
import { Page, fetchPages, createPage, updatePage, deletePage } from '../api';

interface PagesState {
  pages: Page[];
  loading: boolean;
  error: string | null;
  loadPages: () => Promise<void>;
  addPage: (data: { title?: string; icon?: string; parent_id?: string }) => Promise<Page>;
  renamePage: (id: string, title: string) => Promise<void>;
  changeIcon: (id: string, icon: string) => Promise<void>;
  removePage: (id: string) => Promise<void>;
}

export const usePagesStore = create<PagesState>((set, get) => ({
  pages: [],
  loading: false,
  error: null,

  loadPages: async () => {
    set({ loading: true, error: null });
    try {
      const pages = await fetchPages();
      set({ pages, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  addPage: async (data) => {
    const page = await createPage(data);
    await get().loadPages();
    return page;
  },

  renamePage: async (id, title) => {
    await updatePage(id, { title });
    await get().loadPages();
  },

  changeIcon: async (id, icon) => {
    await updatePage(id, { icon });
    await get().loadPages();
  },

  removePage: async (id) => {
    await deletePage(id);
    await get().loadPages();
  },
}));