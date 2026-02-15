import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  isHydrated: boolean;
  setTheme: (theme: Theme) => void;
  setHydrated: (hydrated: boolean) => void;
  getEffectiveTheme: () => 'light' | 'dark';
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      isHydrated: false,

      setTheme: (theme: Theme) => {
        set({ theme });
        if (typeof window !== 'undefined') {
          const effective =
            theme === 'system'
              ? window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light'
              : theme;
          document.documentElement.classList.remove('light', 'dark');
          document.documentElement.classList.add(effective);
        }
      },

      setHydrated: (hydrated: boolean) => set({ isHydrated: hydrated }),

      getEffectiveTheme: () => {
        const { theme, isHydrated } = get();
        if (typeof window === 'undefined' || !isHydrated) return 'light';
        if (theme === 'system') {
          return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return theme;
      },
    }),
    {
      name: 'theme-storage',
      onRehydrateStorage: () => state => {
        state?.setHydrated(true);
      },
    }
  )
);
