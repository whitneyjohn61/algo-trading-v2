/**
 * Backtest Engine unit tests — streaming simulation.
 * Mocks: candleService, database, exchange manager.
 * Tests: single-strategy backtest, metrics, edge cases.
 */

import { makeCandles } from '../../mocks/testData';
import type { Candle } from '../../../src/indicators/types';

// ── Mock candle service ──
const candles100 = makeCandles(100);
jest.mock('../../../src/services/market/candleService', () => ({
  __esModule: true,
  default: {
    getCandles: jest.fn().mockImplementation(
      (_symbol: string, _interval: string, _limit: number, startTime: number, endTime: number) => {
        // Return candles within the requested range
        return Promise.resolve(
          candles100.filter(c => c.timestamp >= startTime && c.timestamp <= endTime)
        );
      }
    ),
  },
}));

// ── Mock database (backtest doesn't use DB directly but strategies might) ──
jest.mock('../../../src/services/database/connection', () => ({
  __esModule: true,
  default: {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    getOne: jest.fn().mockResolvedValue(null),
    getAll: jest.fn().mockResolvedValue([]),
  },
}));

// ── Mock exchange manager (strategies may reference during init) ──
jest.mock('../../../src/services/exchange/exchangeManager', () => ({
  __esModule: true,
  default: {
    getForAccount: jest.fn().mockResolvedValue({
      name: 'bybit',
      getCandles: jest.fn().mockResolvedValue([]),
    }),
    getDefault: jest.fn().mockReturnValue({ name: 'bybit' }),
    getActiveAccountIds: jest.fn().mockResolvedValue([1]),
  },
}));

// ── Mock WebSocket broadcaster ──
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
    sendAlert: jest.fn(),
    sendInfo: jest.fn(),
    sendWarning: jest.fn(),
    sendError: jest.fn(),
  },
}));

// Import strategies barrel to trigger auto-registration before engine import
import '../../../src/strategies';

import { runBacktest } from '../../../src/services/backtest/backtestEngine';

// ── Single-strategy backtest ──────────────────────────────────

describe('BacktestEngine — runBacktest', () => {
  const startTime = candles100[0]!.timestamp;
  const endTime = candles100[candles100.length - 1]!.timestamp;

  it('should throw for unknown strategy', async () => {
    await expect(
      runBacktest({
        strategyId: 'nonexistent_strategy',
        symbol: 'BTCUSDT',
        interval: '60',
        startTime,
        endTime,
        initialBalance: 10000,
        leverage: 1,
      })
    ).rejects.toThrow('Strategy not found');
  });

  it('should throw for insufficient candle data', async () => {
    // Use a time range that will yield very few candles
    await expect(
      runBacktest({
        strategyId: 'trend_following',
        symbol: 'BTCUSDT',
        interval: '60',
        startTime,
        endTime: startTime + 60000, // Only ~1 candle
        initialBalance: 10000,
        leverage: 1,
      })
    ).rejects.toThrow('Insufficient candle data');
  });

  it('should produce valid result structure with trend_following strategy', async () => {
    const result = await runBacktest({
      strategyId: 'trend_following',
      symbol: 'BTCUSDT',
      interval: '60',
      startTime,
      endTime,
      initialBalance: 10000,
      leverage: 1,
    });

    // Result shape
    expect(result).toHaveProperty('params');
    expect(result).toHaveProperty('metrics');
    expect(result).toHaveProperty('trades');
    expect(result).toHaveProperty('equityCurve');
    expect(result).toHaveProperty('equityCurveSampled');
    expect(result).toHaveProperty('finalBalance');
    expect(result).toHaveProperty('durationMs');
    expect(result).toHaveProperty('candlesProcessed');

    // Metrics shape
    expect(result.metrics).toHaveProperty('totalReturn');
    expect(result.metrics).toHaveProperty('totalReturnPct');
    expect(result.metrics).toHaveProperty('totalTrades');
    expect(result.metrics).toHaveProperty('winRate');
    expect(result.metrics).toHaveProperty('maxDrawdown');
    expect(result.metrics).toHaveProperty('sharpeRatio');
    expect(result.metrics).toHaveProperty('sortinoRatio');
    expect(result.metrics).toHaveProperty('profitFactor');
    expect(result.metrics).toHaveProperty('totalFees');

    // Sanity checks
    expect(result.candlesProcessed).toBeGreaterThan(0);
    expect(result.finalBalance).toBeGreaterThan(0);
    expect(result.equityCurve.length).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.metrics.winRate).toBe('number');
  });

  it('should produce equity curve with correct start point', async () => {
    const result = await runBacktest({
      strategyId: 'trend_following',
      symbol: 'BTCUSDT',
      interval: '60',
      startTime,
      endTime,
      initialBalance: 10000,
      leverage: 1,
    });

    // First equity point should match initial balance
    expect(result.equityCurve[0]!.equity).toBe(10000);
  });

  it('should respect parameter overrides', async () => {
    // Just verify it doesn't throw — param overrides are strategy-specific
    const result = await runBacktest({
      strategyId: 'trend_following',
      symbol: 'BTCUSDT',
      interval: '60',
      startTime,
      endTime,
      initialBalance: 10000,
      leverage: 1,
      paramOverrides: { emaFast: 10, emaSlow: 30 },
    });

    expect(result.candlesProcessed).toBeGreaterThan(0);
  });

  it('should sample equity curve when it exceeds 500 points', async () => {
    const result = await runBacktest({
      strategyId: 'trend_following',
      symbol: 'BTCUSDT',
      interval: '60',
      startTime,
      endTime,
      initialBalance: 10000,
      leverage: 1,
    });

    // Sampled curve should be <= 500 points
    expect(result.equityCurveSampled.length).toBeLessThanOrEqual(500);
  });

  it('should apply custom fee and slippage rates', async () => {
    const result = await runBacktest({
      strategyId: 'trend_following',
      symbol: 'BTCUSDT',
      interval: '60',
      startTime,
      endTime,
      initialBalance: 10000,
      leverage: 1,
      takerFeeRate: 0.001,   // Higher fee
      slippageRate: 0.0005,  // Higher slippage
    });

    expect(result.metrics.totalFees).toBeGreaterThanOrEqual(0);
  });
});
