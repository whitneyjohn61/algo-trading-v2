/**
 * PortfolioDashboard component tests — renders sub-components, triggers API fetch.
 */

import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { usePortfolioStore } from '@/store/portfolioStore';

// ── Mock child components (test SummaryCards separately) ──
jest.mock('@/components/portfolio/SummaryCards', () => ({
  SummaryCards: () => <div data-testid="summary-cards" />,
}));
jest.mock('@/components/portfolio/EquityCurveChart', () => ({
  EquityCurveChart: () => <div data-testid="equity-curve-chart" />,
}));
jest.mock('@/components/portfolio/StrategyAllocationPanel', () => ({
  StrategyAllocationPanel: () => <div data-testid="strategy-allocation" />,
}));
jest.mock('@/components/portfolio/OpenPositionsTable', () => ({
  OpenPositionsTable: () => <div data-testid="open-positions" />,
}));
jest.mock('@/components/portfolio/RecentTradesFeed', () => ({
  RecentTradesFeed: () => <div data-testid="recent-trades" />,
}));

// ── Mock API module ──
const mockApi = {
  portfolio: {
    getSummary: jest.fn().mockResolvedValue({
      totalEquity: 10000, availableBalance: 8000, unrealizedPnl: 200,
      positionCount: 1, positions: [], strategyAllocations: [],
      drawdownPct: 0, peakEquity: 10000, realizedPnlToday: 0,
    }),
    getCircuitBreaker: jest.fn().mockResolvedValue({
      tradingAccountId: 1, portfolioTriggered: false,
      portfolioDrawdownPct: 0, portfolioThreshold: 25,
      triggeredAt: null, haltedStrategies: [],
    }),
  },
};
jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: mockApi,
}));

import { PortfolioDashboard } from '@/components/portfolio/PortfolioDashboard';

describe('PortfolioDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePortfolioStore.getState().clear();
  });

  it('should render all sub-components', () => {
    render(<PortfolioDashboard />);

    expect(screen.getByTestId('summary-cards')).toBeInTheDocument();
    expect(screen.getByTestId('equity-curve-chart')).toBeInTheDocument();
    expect(screen.getByTestId('strategy-allocation')).toBeInTheDocument();
    expect(screen.getByTestId('open-positions')).toBeInTheDocument();
    expect(screen.getByTestId('recent-trades')).toBeInTheDocument();
  });

  it('should call API on mount', async () => {
    render(<PortfolioDashboard />);

    await waitFor(() => {
      expect(mockApi.portfolio.getSummary).toHaveBeenCalledTimes(1);
      expect(mockApi.portfolio.getCircuitBreaker).toHaveBeenCalledTimes(1);
    });
  });

  it('should update portfolio store from API response', async () => {
    render(<PortfolioDashboard />);

    await waitFor(() => {
      const state = usePortfolioStore.getState();
      expect(state.totalEquity).toBe(10000);
      expect(state.availableBalance).toBe(8000);
    });
  });

  it('should handle API errors gracefully (Promise.allSettled catches per-call)', async () => {
    // When getSummary rejects, allSettled reports it as { status: 'rejected' }
    // The component only sets error in the outer catch, so the summary just won't update
    mockApi.portfolio.getSummary.mockRejectedValueOnce(new Error('Network error'));

    render(<PortfolioDashboard />);

    // Since allSettled catches internally, summary data simply isn't set
    await waitFor(() => {
      expect(mockApi.portfolio.getSummary).toHaveBeenCalled();
    });

    // totalEquity should remain 0 since the fetch failed
    expect(usePortfolioStore.getState().totalEquity).toBe(0);
  });
});
