'use client';

import { useAccountStore, TradingMode } from '@/store/accountStore';

/**
 * TEST / LIVE mode toggle — switches the active trading account.
 * Displayed in the header bar.
 */
export function ModeToggle() {
  const mode = useAccountStore(s => s.mode);
  const setMode = useAccountStore(s => s.setMode);
  const activeAccount = useAccountStore(s => s.getActiveAccount());

  function toggle() {
    const next: TradingMode = mode === 'test' ? 'live' : 'test';
    setMode(next);
  }

  return (
    <button
      onClick={toggle}
      className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-1"
      style={{
        borderColor: mode === 'test' ? '#f59e0b' : '#22c55e',
        color: mode === 'test' ? '#d97706' : '#16a34a',
        backgroundColor: mode === 'test' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(34, 197, 94, 0.08)',
      }}
      title={`Switch to ${mode === 'test' ? 'LIVE' : 'TEST'} mode`}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{
          backgroundColor: mode === 'test' ? '#f59e0b' : '#22c55e',
          boxShadow: mode === 'live' ? '0 0 6px rgba(34, 197, 94, 0.5)' : undefined,
        }}
      />
      {mode === 'test' ? 'TESTNET' : 'MAINNET'}
      {activeAccount && (
        <span className="text-[10px] opacity-60 ml-0.5">
          #{activeAccount.id}
        </span>
      )}
    </button>
  );
}
