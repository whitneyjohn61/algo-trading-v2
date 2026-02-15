/**
 * PortfolioStore unit tests — setSummary, setEquityCurve, clear.
 * Pure Zustand logic, no mocks needed.
 */

import { usePortfolioStore } from '@/store/portfolioStore';

describe('PortfolioStore', () => {
  beforeEach(() => {
    usePortfolioStore.getState().clear();
  });

  it('should start with default state', () => {
    const state = usePortfolioStore.getState();
    expect(state.totalEquity).toBe(0);
    expect(state.positions).toEqual([]);
    expect(state.equityCurve).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('should update summary via setSummary', () => {
    usePortfolioStore.getState().setSummary({
      totalEquity: 10000,
      availableBalance: 8000,
      unrealizedPnl: 200,
      positionCount: 2,
      drawdownPct: 5,
    });

    const state = usePortfolioStore.getState();
    expect(state.totalEquity).toBe(10000);
    expect(state.availableBalance).toBe(8000);
    expect(state.unrealizedPnl).toBe(200);
    expect(state.positionCount).toBe(2);
    expect(state.drawdownPct).toBe(5);
    expect(state.lastUpdated).toBeGreaterThan(0);
  });

  it('should merge partial summary without clearing other fields', () => {
    usePortfolioStore.getState().setSummary({ totalEquity: 10000, positionCount: 3 });
    usePortfolioStore.getState().setSummary({ drawdownPct: 8 });

    const state = usePortfolioStore.getState();
    expect(state.totalEquity).toBe(10000);
    expect(state.positionCount).toBe(3);
    expect(state.drawdownPct).toBe(8);
  });

  it('should set equity curve', () => {
    const curve = [
      { timestamp: 1000, equity: 10000, drawdownPct: 0 },
      { timestamp: 2000, equity: 10500, drawdownPct: 0 },
    ];
    usePortfolioStore.getState().setEquityCurve(curve);

    expect(usePortfolioStore.getState().equityCurve).toEqual(curve);
  });

  it('should set performance metrics', () => {
    const metrics = {
      returnPct: 5.2,
      sharpeRatio: 1.5,
      maxDrawdown: 3.1,
      totalPnl: 520,
      dataPoints: 30,
      periodStart: 1000,
      periodEnd: 2000,
    };
    usePortfolioStore.getState().setPerformance(metrics);

    expect(usePortfolioStore.getState().performance).toEqual(metrics);
  });

  it('should set circuit breaker status', () => {
    const cb = {
      tradingAccountId: 1,
      portfolioTriggered: false,
      portfolioDrawdownPct: 5,
      portfolioThreshold: 25,
      triggeredAt: null,
      haltedStrategies: [],
    };
    usePortfolioStore.getState().setCircuitBreaker(cb);

    expect(usePortfolioStore.getState().circuitBreaker).toEqual(cb);
  });

  it('should handle loading state', () => {
    usePortfolioStore.getState().setLoading(true);
    expect(usePortfolioStore.getState().loading).toBe(true);

    usePortfolioStore.getState().setLoading(false);
    expect(usePortfolioStore.getState().loading).toBe(false);
  });

  it('should set error and clear loading', () => {
    usePortfolioStore.getState().setLoading(true);
    usePortfolioStore.getState().setError('Network error');

    const state = usePortfolioStore.getState();
    expect(state.error).toBe('Network error');
    expect(state.loading).toBe(false);
  });

  it('should reset to initial state on clear', () => {
    usePortfolioStore.getState().setSummary({
      totalEquity: 50000,
      positionCount: 10,
      drawdownPct: 15,
    });
    usePortfolioStore.getState().clear();

    const state = usePortfolioStore.getState();
    expect(state.totalEquity).toBe(0);
    expect(state.positionCount).toBe(0);
    expect(state.drawdownPct).toBe(0);
    expect(state.positions).toEqual([]);
  });
});
