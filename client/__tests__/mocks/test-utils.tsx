/**
 * Client test utilities — custom render, store resets, common mocks.
 */

import React from 'react';
import { render, RenderOptions } from '@testing-library/react';

// ── Mock Next.js navigation ──
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// ── Mock react-hot-toast ──
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
    dismiss: jest.fn(),
  },
  Toaster: () => null,
}));

// ── Store reset helpers ──

export function resetAllStores() {
  // Reset auth store
  const { useAuthStore } = require('@/store/authStore');
  useAuthStore.setState({
    isAuthenticated: false,
    user: null,
    token: null,
  });

  // Reset account store
  const { useAccountStore } = require('@/store/accountStore');
  useAccountStore.setState({
    accounts: [],
    activeAccountId: null,
    mode: 'test',
    loading: false,
  });

  // Reset portfolio store
  const { usePortfolioStore } = require('@/store/portfolioStore');
  usePortfolioStore.setState({
    totalEquity: 0,
    availableBalance: 0,
    unrealizedPnl: 0,
    realizedPnlToday: 0,
    peakEquity: 0,
    drawdownPct: 0,
    positionCount: 0,
    positions: [],
    strategyAllocations: [],
    equityCurve: [],
    performance: null,
    circuitBreaker: null,
    lastUpdated: 0,
    loading: false,
    error: null,
  });
}

// ── Custom render (no providers needed — Zustand is global) ──

function customRender(ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { ...options });
}

export * from '@testing-library/react';
export { customRender as render };
