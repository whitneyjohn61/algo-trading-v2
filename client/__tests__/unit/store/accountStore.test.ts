/**
 * AccountStore unit tests — mode switching, account selection, activeAccountId.
 * Pure Zustand logic, no mocks needed.
 */

import { useAccountStore, TradingAccount } from '@/store/accountStore';

const testAccount: TradingAccount = {
  id: 1, userId: 1, exchange: 'bybit', isTest: true, isActive: true,
  currentBalance: 10000, hasApiKeys: true,
};

const liveAccount: TradingAccount = {
  id: 2, userId: 1, exchange: 'bybit', isTest: false, isActive: true,
  currentBalance: 50000, hasApiKeys: true,
};

describe('AccountStore', () => {
  beforeEach(() => {
    useAccountStore.setState({
      accounts: [],
      activeAccountId: null,
      mode: 'test',
      loading: false,
    });
  });

  it('should start with default state', () => {
    const state = useAccountStore.getState();
    expect(state.accounts).toEqual([]);
    expect(state.activeAccountId).toBeNull();
    expect(state.mode).toBe('test');
    expect(state.loading).toBe(false);
  });

  it('should auto-select test account when setAccounts called in test mode', () => {
    useAccountStore.getState().setAccounts([testAccount, liveAccount]);

    const state = useAccountStore.getState();
    expect(state.accounts).toHaveLength(2);
    expect(state.activeAccountId).toBe(1); // test account
  });

  it('should switch to live account when mode changed to live', () => {
    useAccountStore.getState().setAccounts([testAccount, liveAccount]);
    useAccountStore.getState().setMode('live');

    const state = useAccountStore.getState();
    expect(state.mode).toBe('live');
    expect(state.activeAccountId).toBe(2); // live account
  });

  it('should switch back to test account when mode changed to test', () => {
    useAccountStore.getState().setAccounts([testAccount, liveAccount]);
    useAccountStore.getState().setMode('live');
    useAccountStore.getState().setMode('test');

    const state = useAccountStore.getState();
    expect(state.mode).toBe('test');
    expect(state.activeAccountId).toBe(1);
  });

  it('should set mode based on account when setActiveAccountId called', () => {
    useAccountStore.getState().setAccounts([testAccount, liveAccount]);
    useAccountStore.getState().setActiveAccountId(2);

    const state = useAccountStore.getState();
    expect(state.activeAccountId).toBe(2);
    expect(state.mode).toBe('live'); // auto-detected from isTest=false
  });

  it('should return active account via getActiveAccount', () => {
    useAccountStore.getState().setAccounts([testAccount, liveAccount]);
    const active = useAccountStore.getState().getActiveAccount();
    expect(active).not.toBeNull();
    expect(active!.id).toBe(1);
    expect(active!.isTest).toBe(true);
  });

  it('should return null from getActiveAccount when no accounts', () => {
    const active = useAccountStore.getState().getActiveAccount();
    expect(active).toBeNull();
  });

  it('should clear all state on clear()', () => {
    useAccountStore.getState().setAccounts([testAccount, liveAccount]);
    useAccountStore.getState().clear();

    const state = useAccountStore.getState();
    expect(state.accounts).toEqual([]);
    expect(state.activeAccountId).toBeNull();
    expect(state.mode).toBe('test');
  });

  it('should handle setLoading', () => {
    useAccountStore.getState().setLoading(true);
    expect(useAccountStore.getState().loading).toBe(true);

    useAccountStore.getState().setLoading(false);
    expect(useAccountStore.getState().loading).toBe(false);
  });

  it('should fallback to first account if no mode match', () => {
    // Only have a live account, but mode is test
    useAccountStore.getState().setAccounts([liveAccount]);

    const state = useAccountStore.getState();
    // Falls back to first account since no test account exists
    expect(state.activeAccountId).toBe(2);
  });
});
