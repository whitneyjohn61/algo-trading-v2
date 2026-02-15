import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TimezoneState {
  selectedTimezone: string;
  setTimezone: (timezone: string) => void;
}

export const useTimezoneStore = create<TimezoneState>()(
  persist(
    set => ({
      selectedTimezone: typeof window !== 'undefined'
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : 'UTC',

      setTimezone: (timezone: string) => {
        set({ selectedTimezone: timezone });
      },
    }),
    { name: 'timezone-storage' }
  )
);
