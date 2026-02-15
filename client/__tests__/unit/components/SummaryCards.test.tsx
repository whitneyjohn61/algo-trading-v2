/**
 * SummaryCards component tests — renders portfolio data from store.
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { usePortfolioStore } from '@/store/portfolioStore';

// Mock lucide-react icons (they're SVG components)
jest.mock('lucide-react', () => ({
  TrendingUp: () => <span data-testid="icon-trending-up" />,
  TrendingDown: () => <span data-testid="icon-trending-down" />,
  BarChart3: () => <span data-testid="icon-bar-chart" />,
  Activity: () => <span data-testid="icon-activity" />,
  Shield: () => <span data-testid="icon-shield" />,
}));

// Mock DrawdownGauge (it uses SVG which jsdom can't render)
jest.mock('@/components/DrawdownGauge', () => ({
  DrawdownGauge: ({ drawdownPct }: { drawdownPct: number }) => (
    <div data-testid="drawdown-gauge">{drawdownPct}%</div>
  ),
}));

import { SummaryCards } from '@/components/portfolio/SummaryCards';

describe('SummaryCards', () => {
  beforeEach(() => {
    usePortfolioStore.getState().clear();
  });

  it('should render all four cards', () => {
    render(<SummaryCards />);

    expect(screen.getByText('Total Equity')).toBeInTheDocument();
    expect(screen.getByText("Today's P&L")).toBeInTheDocument();
    expect(screen.getByText('Open Positions')).toBeInTheDocument();
    expect(screen.getByText('Drawdown')).toBeInTheDocument();
  });

  it('should display equity from store', () => {
    usePortfolioStore.setState({ totalEquity: 12345.67, peakEquity: 13000 });

    render(<SummaryCards />);

    expect(screen.getByText('$12,345.67')).toBeInTheDocument();
    expect(screen.getByText(/Peak.*13,000/)).toBeInTheDocument();
  });

  it('should display position count and long/short breakdown', () => {
    usePortfolioStore.setState({
      positionCount: 3,
      positions: [
        { symbol: 'BTCUSDT', side: 'long', size: 0.1, entryPrice: 50000, markPrice: 52000, unrealizedPnl: 200, leverage: 3, margin: 1667, liquidationPrice: 45000 },
        { symbol: 'ETHUSDT', side: 'long', size: 1, entryPrice: 3000, markPrice: 3100, unrealizedPnl: 100, leverage: 2, margin: 1550, liquidationPrice: 2500 },
        { symbol: 'SOLUSDT', side: 'short', size: 10, entryPrice: 100, markPrice: 95, unrealizedPnl: 50, leverage: 5, margin: 200, liquidationPrice: 120 },
      ],
    });

    render(<SummaryCards />);

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2 Long')).toBeInTheDocument();
    expect(screen.getByText('1 Short')).toBeInTheDocument();
  });

  it('should display drawdown percentage', () => {
    usePortfolioStore.setState({ drawdownPct: 8.5 });

    render(<SummaryCards />);

    // "8.5%" appears in both the gauge mock and the card text
    const matches = screen.getAllByText('8.5%');
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('drawdown-gauge')).toBeInTheDocument();
  });

  it('should show HALTED badge when circuit breaker triggered', () => {
    usePortfolioStore.setState({
      circuitBreaker: {
        tradingAccountId: 1,
        portfolioTriggered: true,
        portfolioDrawdownPct: 30,
        portfolioThreshold: 25,
        triggeredAt: Date.now(),
        haltedStrategies: [],
      },
    });

    render(<SummaryCards />);

    expect(screen.getByText('HALTED')).toBeInTheDocument();
  });

  it('should calculate today PnL from realized + unrealized', () => {
    usePortfolioStore.setState({
      totalEquity: 10000,
      realizedPnlToday: 150,
      unrealizedPnl: -50,
    });

    render(<SummaryCards />);

    // Today's PnL = 150 + (-50) = 100 → displayed as "+$100.00"
    expect(screen.getByText('+$100.00')).toBeInTheDocument();
  });
});
