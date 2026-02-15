/**
 * Portfolio Manager, Equity Tracker, and Circuit Breaker unit tests.
 *
 * Tests pure logic and state management without DB or exchange calls.
 * DB/exchange methods are mocked to isolate business logic.
 * All methods are now account-scoped (tradingAccountId = 1 for tests).
 */

const ACCOUNT_ID = 1;

// ── Mock database ──
jest.mock('../../../src/services/database/connection', () => ({
  __esModule: true,
  default: {
    getOne: jest.fn().mockResolvedValue(null),
    getAll: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockResolvedValue({ id: 1 }),
    query: jest.fn().mockResolvedValue({ rows: [] }),
  },
}));

// ── Mock exchange adapter ──
const mockExchange = {
  name: 'bybit',
  getTotalEquity: jest.fn().mockResolvedValue(10000),
  getBalances: jest.fn().mockResolvedValue([
    { coin: 'USDT', available: 8000, total: 10000, unrealizedPnl: 200 },
  ]),
  getPositions: jest.fn().mockResolvedValue([
    {
      symbol: 'BTCUSDT', side: 'long', size: 0.1, entryPrice: 50000,
      markPrice: 52000, unrealizedPnl: 200, leverage: 3, margin: 1667,
      liquidationPrice: 45000,
    },
  ]),
};

// ── Mock exchange manager (account-scoped) ──
jest.mock('../../../src/services/exchange/exchangeManager', () => ({
  __esModule: true,
  default: {
    getForAccount: jest.fn().mockResolvedValue(mockExchange),
    getDefault: () => mockExchange,
    getActiveAccountIds: jest.fn().mockResolvedValue([ACCOUNT_ID]),
    initializeAllActive: jest.fn().mockResolvedValue([ACCOUNT_ID]),
  },
}));

// ── Mock WebSocket broadcaster (account-scoped) ──
jest.mock('../../../src/websocket/server', () => ({
  __esModule: true,
  default: {
    broadcast: jest.fn(),
    broadcastToChannel: jest.fn(),
    broadcastToAccount: jest.fn(),
    broadcastToUser: jest.fn(),
  },
}));

// ── Mock notification service ──
jest.mock('../../../src/services/monitoring/notificationService', () => ({
  __esModule: true,
  default: {
    sendCircuitBreakerAlert: jest.fn().mockResolvedValue(undefined),
    sendSystemAlert: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockResolvedValue(undefined),
  },
}));

// ── Mock strategy registry (2 strategies) ──
const mockStrategy1 = {
  config: {
    id: 'trend_following', name: 'Trend Following', category: 'trend_following',
    timeframes: ['D', '240'], primaryTimeframe: '240',
    symbols: ['BTCUSDT', 'ETHUSDT'], maxLeverage: 3,
    capitalAllocationPercent: 30, warmupCandles: 100, params: {},
  },
  getState: () => ({
    status: 'running', activePositions: ['BTCUSDT'],
    lastSignals: {}, lastProcessedTime: {},
    metrics: { signalsEmitted: 5, tradesOpened: 2, tradesClosed: 1, winRate: 50, totalPnl: 150 },
  }),
};

const mockStrategy2 = {
  config: {
    id: 'mean_reversion', name: 'Mean Reversion', category: 'mean_reversion',
    timeframes: ['15', '60'], primaryTimeframe: '15',
    symbols: ['ETHUSDT', 'SOLUSDT'], maxLeverage: 2,
    capitalAllocationPercent: 20, warmupCandles: 50, params: {},
  },
  getState: () => ({
    status: 'running', activePositions: [],
    lastSignals: {}, lastProcessedTime: {},
    metrics: { signalsEmitted: 3, tradesOpened: 1, tradesClosed: 0, winRate: 0, totalPnl: -50 },
  }),
};

jest.mock('../../../src/strategies/registry', () => ({
  getAllStrategies: () => [mockStrategy1, mockStrategy2],
  getStrategy: (id: string) => {
    if (id === 'trend_following') return mockStrategy1;
    if (id === 'mean_reversion') return mockStrategy2;
    return undefined;
  },
}));

// ── Mock strategy executor (account-scoped) ──
jest.mock('../../../src/strategies/executor', () => ({
  __esModule: true,
  default: {
    pause: jest.fn().mockReturnValue(true),
    resume: jest.fn().mockReturnValue(true),
    getStatus: jest.fn().mockReturnValue({
      trend_following: { config: mockStrategy1.config, state: mockStrategy1.getState(), paused: false },
      mean_reversion: { config: mockStrategy2.config, state: mockStrategy2.getState(), paused: false },
    }),
  },
}));

// ── Now import the modules under test ──
import portfolioManager from '../../../src/services/portfolio/portfolioManager';
import circuitBreaker from '../../../src/services/portfolio/circuitBreaker';
import wsBroadcaster from '../../../src/websocket/server';
import strategyExecutor from '../../../src/strategies/executor';
import db from '../../../src/services/database/connection';

// ════════════════════════════════════════════════════════════
// Portfolio Manager tests
// ════════════════════════════════════════════════════════════

describe('PortfolioManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPortfolioSummary', () => {
    it('should return equity, positions, and allocations', async () => {
      const summary = await portfolioManager.getPortfolioSummary(ACCOUNT_ID);

      expect(summary.tradingAccountId).toBe(ACCOUNT_ID);
      expect(summary.totalEquity).toBe(10000);
      expect(summary.availableBalance).toBe(8000);
      expect(summary.positionCount).toBe(1);
      expect(summary.positions).toHaveLength(1);
      expect(summary.positions[0]!.symbol).toBe('BTCUSDT');
      expect(summary.unrealizedPnl).toBe(200);
      expect(summary.strategyAllocations).toHaveLength(2);
      expect(summary.lastUpdated).toBeGreaterThan(0);
    });

    it('should track peak equity', async () => {
      mockExchange.getTotalEquity.mockResolvedValueOnce(15000);
      await portfolioManager.getPortfolioSummary(ACCOUNT_ID);

      mockExchange.getTotalEquity.mockResolvedValueOnce(12000);
      const summary = await portfolioManager.getPortfolioSummary(ACCOUNT_ID);

      expect(summary.peakEquity).toBe(15000);
      expect(summary.drawdownPct).toBeGreaterThan(0);
    });

    it('should calculate drawdown percentage correctly', async () => {
      // Set peak at 20000
      mockExchange.getTotalEquity.mockResolvedValueOnce(20000);
      await portfolioManager.getPortfolioSummary(ACCOUNT_ID);

      // Drop to 16000 = 20% drawdown
      mockExchange.getTotalEquity.mockResolvedValueOnce(16000);
      const summary = await portfolioManager.getPortfolioSummary(ACCOUNT_ID);

      expect(summary.drawdownPct).toBe(20);
    });

    it('should build strategy allocations from registered strategies', async () => {
      const summary = await portfolioManager.getPortfolioSummary(ACCOUNT_ID);
      const allocs = summary.strategyAllocations;

      const tf = allocs.find(a => a.strategyId === 'trend_following');
      expect(tf).toBeDefined();
      expect(tf!.targetPct).toBe(30);
      expect(tf!.isActive).toBe(true);
      expect(tf!.positionCount).toBe(1); // BTCUSDT matched

      const mr = allocs.find(a => a.strategyId === 'mean_reversion');
      expect(mr).toBeDefined();
      expect(mr!.targetPct).toBe(20);
      expect(mr!.positionCount).toBe(0); // No active positions
    });
  });

  describe('getEquity', () => {
    it('should return current equity from exchange', async () => {
      mockExchange.getTotalEquity.mockResolvedValueOnce(12345);
      const equity = await portfolioManager.getEquity(ACCOUNT_ID);
      expect(equity).toBe(12345);
    });

    it('should update peak equity when equity increases', async () => {
      mockExchange.getTotalEquity.mockResolvedValueOnce(50000);
      await portfolioManager.getEquity(ACCOUNT_ID);
      expect(portfolioManager.getPeakEquity(ACCOUNT_ID)).toBe(50000);
    });
  });

  describe('getAllocatedCapital', () => {
    it('should return capital for a known strategy', async () => {
      // Set equity to 10000 first
      mockExchange.getTotalEquity.mockResolvedValueOnce(10000);
      await portfolioManager.getEquity(ACCOUNT_ID);

      const capital = portfolioManager.getAllocatedCapital(ACCOUNT_ID, 'trend_following');
      expect(capital).toBe(3000); // 30% of 10000
    });

    it('should return 0 for unknown strategy', () => {
      const capital = portfolioManager.getAllocatedCapital(ACCOUNT_ID, 'nonexistent');
      expect(capital).toBe(0);
    });
  });

  describe('recordTradePnl', () => {
    it('should accumulate daily realized P&L', async () => {
      // Reset to fresh state
      mockExchange.getTotalEquity.mockResolvedValue(10000);
      mockExchange.getBalances.mockResolvedValue([{ coin: 'USDT', available: 8000, total: 10000, unrealizedPnl: 0 }]);
      mockExchange.getPositions.mockResolvedValue([]);

      portfolioManager.recordTradePnl(ACCOUNT_ID, 'trend_following', 100);
      portfolioManager.recordTradePnl(ACCOUNT_ID, 'trend_following', -30);
      portfolioManager.recordTradePnl(ACCOUNT_ID, 'mean_reversion', 50);

      const summary = await portfolioManager.getPortfolioSummary(ACCOUNT_ID);
      expect(summary.realizedPnlToday).toBe(120); // 100 - 30 + 50
    });

    it('should update strategy performance in DB', () => {
      portfolioManager.recordTradePnl(ACCOUNT_ID, 'trend_following', 200);
      // DB insert is fire-and-forget, just verify it was called
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('getStrategyPerformance', () => {
    it('should return defaults when no DB record exists', async () => {
      (db.getOne as jest.Mock).mockResolvedValueOnce(null);
      const perf = await portfolioManager.getStrategyPerformance(ACCOUNT_ID, 'trend_following');

      expect(perf.strategyId).toBe('trend_following');
      expect(perf.totalPnl).toBe(0);
      expect(perf.winCount).toBe(0);
      expect(perf.winRate).toBe(0);
      expect(perf.currentAllocationPct).toBe(30);
    });

    it('should return metrics from DB when record exists', async () => {
      (db.getOne as jest.Mock).mockResolvedValueOnce({
        strategy_id: 'trend_following',
        total_pnl: 500,
        win_count: 7,
        loss_count: 3,
        max_drawdown: 5.2,
        sharpe_ratio: 1.8,
        current_allocation_pct: 30,
        is_active: true,
        snapshot_at: '2026-02-14T00:00:00Z',
      });

      const perf = await portfolioManager.getStrategyPerformance(ACCOUNT_ID, 'trend_following');
      expect(perf.totalPnl).toBe(500);
      expect(perf.winCount).toBe(7);
      expect(perf.lossCount).toBe(3);
      expect(perf.winRate).toBe(70);
      expect(perf.sharpeRatio).toBe(1.8);
    });
  });

  describe('getAggregatePerformance', () => {
    it('should aggregate across all strategies', async () => {
      (db.getOne as jest.Mock)
        .mockResolvedValueOnce({
          strategy_id: 'trend_following', total_pnl: 300, win_count: 5, loss_count: 2,
          max_drawdown: 4, sharpe_ratio: 1.5, current_allocation_pct: 30, is_active: true, snapshot_at: '2026-02-14T00:00:00Z',
        })
        .mockResolvedValueOnce({
          strategy_id: 'mean_reversion', total_pnl: -50, win_count: 2, loss_count: 3,
          max_drawdown: 8, sharpe_ratio: 0.3, current_allocation_pct: 20, is_active: true, snapshot_at: '2026-02-14T00:00:00Z',
        });

      const agg = await portfolioManager.getAggregatePerformance(ACCOUNT_ID);
      expect(agg.totalPnl).toBe(250); // 300 + (-50)
      expect(agg.totalWins).toBe(7); // 5 + 2
      expect(agg.totalLosses).toBe(5); // 2 + 3
      expect(agg.maxDrawdown).toBe(8); // max of 4 and 8
      expect(agg.strategySummaries).toHaveLength(2);
    });
  });
});

// ════════════════════════════════════════════════════════════
// Circuit Breaker tests
// ════════════════════════════════════════════════════════════

describe('CircuitBreaker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset circuit breaker state by stopping and re-configuring
    circuitBreaker.stop();
  });

  describe('getStatus', () => {
    it('should return initial status with defaults', () => {
      const status = circuitBreaker.getStatus(ACCOUNT_ID);

      expect(status.tradingAccountId).toBe(ACCOUNT_ID);
      expect(status.portfolioTriggered).toBe(false);
      expect(status.portfolioThreshold).toBe(25);
      expect(status.haltedStrategies).toHaveLength(0);
      expect(status.config.portfolioDrawdownThreshold).toBe(25);
      expect(status.config.strategyDrawdownThreshold).toBe(15);
      expect(status.config.autoResumeThreshold).toBe(10);
    });
  });

  describe('updateConfig', () => {
    it('should update thresholds', () => {
      circuitBreaker.updateConfig({ portfolioDrawdownThreshold: 30 });
      const status = circuitBreaker.getStatus(ACCOUNT_ID);
      expect(status.config.portfolioDrawdownThreshold).toBe(30);
      // Others should keep defaults
      expect(status.config.strategyDrawdownThreshold).toBe(15);
    });
  });

  describe('isPortfolioTriggered / isStrategyHalted', () => {
    it('should return false initially', () => {
      expect(circuitBreaker.isPortfolioTriggered(ACCOUNT_ID)).toBe(false);
      expect(circuitBreaker.isStrategyHalted(ACCOUNT_ID, 'trend_following')).toBe(false);
    });
  });

  describe('evaluate — portfolio-level trigger', () => {
    it('should trigger halt when drawdown exceeds threshold', async () => {
      // Set peak high, then drop equity to create drawdown
      mockExchange.getTotalEquity.mockResolvedValueOnce(100000);
      await portfolioManager.getEquity(ACCOUNT_ID);

      // Now set equity to 70000 = 30% drawdown (> 25% threshold)
      mockExchange.getTotalEquity.mockResolvedValueOnce(70000);
      await portfolioManager.getEquity(ACCOUNT_ID);

      await circuitBreaker.evaluate(ACCOUNT_ID);

      expect(circuitBreaker.isPortfolioTriggered(ACCOUNT_ID)).toBe(true);
      expect(strategyExecutor.pause).toHaveBeenCalledWith(ACCOUNT_ID, expect.any(String));
      expect(wsBroadcaster.broadcastToAccount).toHaveBeenCalledWith(
        ACCOUNT_ID, 'portfolio:circuit_breaker',
        expect.objectContaining({ type: 'portfolio', action: 'triggered' })
      );
    });

    it('should auto-resume when drawdown recovers below threshold', async () => {
      // First trigger (30% drawdown)
      mockExchange.getTotalEquity.mockResolvedValueOnce(100000);
      await portfolioManager.getEquity(ACCOUNT_ID);
      mockExchange.getTotalEquity.mockResolvedValueOnce(70000);
      await portfolioManager.getEquity(ACCOUNT_ID);
      await circuitBreaker.evaluate(ACCOUNT_ID);
      expect(circuitBreaker.isPortfolioTriggered(ACCOUNT_ID)).toBe(true);

      // Recover to 95000 = 5% drawdown (< 10% auto-resume threshold)
      mockExchange.getTotalEquity.mockResolvedValueOnce(95000);
      await portfolioManager.getEquity(ACCOUNT_ID);
      await circuitBreaker.evaluate(ACCOUNT_ID);

      expect(circuitBreaker.isPortfolioTriggered(ACCOUNT_ID)).toBe(false);
      expect(strategyExecutor.resume).toHaveBeenCalledWith(ACCOUNT_ID, expect.any(String));
    });
  });

  describe('forceResume', () => {
    it('should force-resume portfolio halt', async () => {
      // Trigger halt
      mockExchange.getTotalEquity.mockResolvedValueOnce(100000);
      await portfolioManager.getEquity(ACCOUNT_ID);
      mockExchange.getTotalEquity.mockResolvedValueOnce(70000);
      await portfolioManager.getEquity(ACCOUNT_ID);
      await circuitBreaker.evaluate(ACCOUNT_ID);
      expect(circuitBreaker.isPortfolioTriggered(ACCOUNT_ID)).toBe(true);

      // Force resume
      const result = await circuitBreaker.forceResume(ACCOUNT_ID);
      expect(result).toBe(true);
      expect(circuitBreaker.isPortfolioTriggered(ACCOUNT_ID)).toBe(false);
    });

    it('should return false when nothing to resume', async () => {
      const result = await circuitBreaker.forceResume(ACCOUNT_ID);
      expect(result).toBe(false);
    });
  });

  describe('start / stop', () => {
    it('should track running state', () => {
      expect(circuitBreaker.isRunning()).toBe(false);
      circuitBreaker.start();
      expect(circuitBreaker.isRunning()).toBe(true);
      circuitBreaker.stop();
      expect(circuitBreaker.isRunning()).toBe(false);
    });
  });
});
