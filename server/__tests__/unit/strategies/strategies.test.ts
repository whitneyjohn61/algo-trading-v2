import { TrendFollowingStrategy } from '../../../src/strategies/trendFollowing';
import { MeanReversionStrategy } from '../../../src/strategies/meanReversion';
import { FundingCarryStrategy } from '../../../src/strategies/fundingCarry';
import { CrossMomentumStrategy } from '../../../src/strategies/crossMomentum';
import {
  registerStrategy,
  getAllStrategies,
  getStrategy,
  hasStrategy,
} from '../../../src/strategies/registry';
import type { Candle } from '../../../src/indicators/types';
import type { MultiTimeframeData } from '../../../src/strategies/types';

// ── Test data ──────────────────────────────────────────────

function makeCandles(count: number, basePrice: number = 50000): Candle[] {
  const candles: Candle[] = [];
  const startTs = 1700000000000;
  for (let i = 0; i < count; i++) {
    const offset = Math.sin(i * 0.3) * 1000 + i * 20;
    const close = basePrice + offset;
    candles.push({
      timestamp: startTs + i * 60000,
      open: close - 50 + (i % 2) * 100,
      high: close + 200,
      low: close - 200,
      close: Number(close.toFixed(2)),
      volume: 1000 + i * 50,
    });
  }
  return candles;
}

// ── Strategy config tests ──────────────────────────────────

describe('TrendFollowingStrategy', () => {
  const strategy = new TrendFollowingStrategy();

  it('should have correct config', () => {
    expect(strategy.config.id).toBe('trend_following');
    expect(strategy.config.category).toBe('trend_following');
    expect(strategy.config.timeframes).toContain('D');
    expect(strategy.config.timeframes).toContain('240');
    expect(strategy.config.capitalAllocationPercent).toBe(30);
  });

  it('should start in idle state', () => {
    const state = strategy.getState();
    expect(state.status).toBe('idle');
    expect(state.activePositions).toEqual([]);
    expect(state.metrics.signalsEmitted).toBe(0);
  });

  it('should initialize and transition to running', () => {
    const data: MultiTimeframeData = {
      'D': makeCandles(70),
      '240': makeCandles(70),
    };
    strategy.initialize(data);
    expect(strategy.getState().status).toBe('running');
  });

  it('should return signals array on onCandle', () => {
    const data: MultiTimeframeData = {
      'D': makeCandles(70),
      '240': makeCandles(70),
    };
    const signals = strategy.onCandle(data);
    expect(Array.isArray(signals)).toBe(true);
  });

  it('should reset state', () => {
    strategy.reset();
    expect(strategy.getState().status).toBe('idle');
    expect(strategy.getState().metrics.signalsEmitted).toBe(0);
  });
});

describe('MeanReversionStrategy', () => {
  const strategy = new MeanReversionStrategy();

  it('should have correct config', () => {
    expect(strategy.config.id).toBe('mean_reversion');
    expect(strategy.config.category).toBe('mean_reversion');
    expect(strategy.config.primaryTimeframe).toBe('15');
    expect(strategy.config.capitalAllocationPercent).toBe(20);
  });

  it('should initialize to running', () => {
    strategy.initialize({ '15': makeCandles(60), '60': makeCandles(60) });
    expect(strategy.getState().status).toBe('running');
  });

  it('should return empty signals with insufficient data', () => {
    const signals = strategy.onCandle({ '15': makeCandles(10), '60': makeCandles(10) });
    expect(signals).toEqual([]);
  });
});

describe('FundingCarryStrategy', () => {
  const strategy = new FundingCarryStrategy();

  it('should have correct config', () => {
    expect(strategy.config.id).toBe('funding_carry');
    expect(strategy.config.category).toBe('carry');
    expect(strategy.config.capitalAllocationPercent).toBe(20);
  });

  it('should accept funding data updates', () => {
    strategy.updateFundingData([
      { symbol: 'BTCUSDT', currentRate: 0.001, avg7d: 0.0008, zScore30d: 1.8, oiChange24hPct: 5, nextSettlementTime: Date.now() + 28800000 },
    ]);
    expect(strategy.config.symbols).toContain('BTCUSDT');
  });
});

describe('CrossMomentumStrategy', () => {
  const strategy = new CrossMomentumStrategy();

  it('should have correct config', () => {
    expect(strategy.config.id).toBe('cross_momentum');
    expect(strategy.config.category).toBe('momentum');
    expect(strategy.config.primaryTimeframe).toBe('D');
    expect(strategy.config.capitalAllocationPercent).toBe(30);
  });

  it('should accept universe updates', () => {
    strategy.updateUniverse(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
    expect(strategy.config.symbols).toEqual(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);
  });
});

// ── Registry tests ─────────────────────────────────────────

describe('Strategy Registry', () => {
  beforeAll(() => {
    // Register fresh instances
    registerStrategy(new TrendFollowingStrategy());
    registerStrategy(new MeanReversionStrategy());
    registerStrategy(new FundingCarryStrategy());
    registerStrategy(new CrossMomentumStrategy());
  });

  it('should have all 4 strategies registered', () => {
    const all = getAllStrategies();
    expect(all.length).toBeGreaterThanOrEqual(4);
  });

  it('should find strategy by id', () => {
    expect(getStrategy('trend_following')).toBeDefined();
    expect(getStrategy('mean_reversion')).toBeDefined();
    expect(getStrategy('funding_carry')).toBeDefined();
    expect(getStrategy('cross_momentum')).toBeDefined();
  });

  it('should return undefined for unknown strategy', () => {
    expect(getStrategy('nonexistent')).toBeUndefined();
  });

  it('should report availability', () => {
    expect(hasStrategy('trend_following')).toBe(true);
    expect(hasStrategy('nonexistent')).toBe(false);
  });
});
