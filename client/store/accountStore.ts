import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Account Store — manages the active trading account (TEST/LIVE mode).
 *
 * On login, the user's trading accounts are loaded.
 * The user selects TEST or LIVE mode, which sets the activeAccountId.
 * All API calls use this ID via the X-Trading-Account-Id header.
 */

export interface TradingAccount {
  id: number;
  userId: number;
  exchange: string;
  isTest: boolean;
  isActive: boolean;
  currentBalance: number;
  hasApiKeys: boolean;
}

export type TradingMode = 'test' | 'live';

interface AccountState {
  /** All trading accounts for the logged-in user */
  accounts: TradingAccount[];
  /** Currently active trading account ID */
  activeAccountId: number | null;
  /** Current mode: test or live */
  mode: TradingMode;
  /** Loading state */
  loading: boolean;

  /** Set accounts after login/fetch */
  setAccounts: (accounts: TradingAccount[]) => void;
  /** Switch between TEST and LIVE mode */
  setMode: (mode: TradingMode) => void;
  /** Directly set the active account */
  setActiveAccountId: (id: number) => void;
  /** Get the active account object */
  getActiveAccount: () => TradingAccount | null;
  /** Clear on logout */
  clear: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set, get) => ({
      accounts: [],
      activeAccountId: null,
      mode: 'test',
      loading: false,

      setAccounts: (accounts: TradingAccount[]) => {
        const { mode } = get();
        // Auto-select the account matching current mode
        const match = accounts.find(a => a.isTest === (mode === 'test'));
        set({
          accounts,
          activeAccountId: match?.id ?? accounts[0]?.id ?? null,
        });
      },

      setMode: (mode: TradingMode) => {
        const { accounts } = get();
        const match = accounts.find(a => a.isTest === (mode === 'test'));
        set({
          mode,
          activeAccountId: match?.id ?? null,
        });
      },

      setActiveAccountId: (id: number) => {
        const { accounts } = get();
        const account = accounts.find(a => a.id === id);
        set({
          activeAccountId: id,
          mode: account?.isTest ? 'test' : 'live',
        });
      },

      getActiveAccount: () => {
        const { accounts, activeAccountId } = get();
        return accounts.find(a => a.id === activeAccountId) ?? null;
      },

      clear: () => {
        set({ accounts: [], activeAccountId: null, mode: 'test' });
      },

      setLoading: (loading: boolean) => set({ loading }),
    }),
    {
      name: 'account-storage',
      partialize: state => ({
        activeAccountId: state.activeAccountId,
        mode: state.mode,
      }),
    }
  )
);
