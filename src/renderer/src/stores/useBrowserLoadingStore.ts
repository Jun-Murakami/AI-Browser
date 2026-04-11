import { create } from 'zustand';

interface BrowserLoadingState {
  browserLoadings: Record<string, boolean>;
  setBrowserLoading: (browserId: string, isLoading: boolean) => void;
}

export const useBrowserLoadingStore = create<BrowserLoadingState>((set) => ({
  browserLoadings: {},
  setBrowserLoading: (browserId, isLoading) => {
    set((state) => {
      if (state.browserLoadings[browserId] === isLoading) return state;
      return {
        browserLoadings: { ...state.browserLoadings, [browserId]: isLoading },
      };
    });
  },
}));
