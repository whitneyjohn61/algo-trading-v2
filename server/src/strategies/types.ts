/**
 * Strategy types for V2 portfolio-based multi-strategy system.
 *
 * Key differences from V1:
 *   - Multi-timeframe: strategies consume candles from multiple intervals
 *   - Capital allocation: each strategy has a % of total equity
 *   - Symbol universe: each strategy defines its tradable symbols
 *   - Signal-based: strategies emit signals, executor routes to orders
 *   - Stateful: strategies track their own internal state between candles
 */

import type { Candle } from '../indicators/types';
import type { ExchangeInterval } from '../services/exchange/exchangeService';

// ── Signal types ───────────────────────────────────────────

export type SignalAction = 'entry_long' | 'entry_short' | 'exit' | 'adjust' | 'hold';

export interface StrategySignal {
  action: SignalAction;
  symbol: string;
  /** Confidence 0-1 (used for position sizing scaling) */
  confidence: number;
  /** Suggested stop loss price */
  stopLoss?: number;
  /** Suggested take profit price */
  takeProfit?: number;
  /** For adjust signals — new SL/TP values */
  newStopLoss?: number;
  newTakeProfit?: number;
  /** Human-readable reason for logging */
  reason: string;
  /** Raw indicator values that triggered this signal */
  indicators?: Record<string, number>;
}

// ── Multi-timeframe candle input ───────────────────────────

/** Candle data keyed by interval, provided to strategy on each tick */
export interface MultiTimeframeData {
  [interval: string]: Candle[];
}

// ── Strategy configuration ─────────────────────────────────

export interface StrategyConfig {
  /** Unique strategy identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Strategy category for grouping */
  category: 'trend_following' | 'mean_reversion' | 'carry' | 'momentum';
  /** Intervals this strategy needs candle data for */
  timeframes: ExchangeInterval[];
  /** Primary timeframe (determines tick frequency) */
  primaryTimeframe: ExchangeInterval;
  /** Symbols this strategy trades */
  symbols: string[];
  /** Max leverage allowed */
  maxLeverage: number;
  /** % of total portfolio equity allocated to this strategy */
  capitalAllocationPercent: number;
  /** Number of historical candles needed per timeframe for indicator warmup */
  warmupCandles: number;
  /** Strategy-specific parameters (indicator periods, thresholds, etc.) */
  params: Record<string, number>;
}

// ── Strategy state ─────────────────────────────────────────

export type StrategyStatus = 'idle' | 'warming_up' | 'running' | 'paused' | 'error';

export interface StrategyState {
  status: StrategyStatus;
  /** Symbols with active positions from this strategy */
  activePositions: string[];
  /** Last signal emitted per symbol */
  lastSignals: Record<string, StrategySignal>;
  /** Last candle timestamp processed per timeframe */
  lastProcessedTime: Record<string, number>;
  /** Error message if status is 'error' */
  error?: string;
  /** Metrics since last reset */
  metrics: {
    signalsEmitted: number;
    tradesOpened: number;
    tradesClosed: number;
    winRate: number;
    totalPnl: number;
  };
}

// ── Strategy interface ─────────────────────────────────────

/**
 * All V2 strategies implement this interface.
 *
 * Lifecycle:
 *   1. Constructor — set config
 *   2. initialize() — called once with warmup candle data
 *   3. onCandle() — called on each confirmed candle (primary timeframe)
 *   4. getState() — query current state at any time
 *   5. reset() — clear state for backtest re-runs
 */
export interface Strategy {
  readonly config: StrategyConfig;

  /** Initialize with historical candle data for indicator warmup */
  initialize(data: MultiTimeframeData): void;

  /**
   * Process a new confirmed candle. Returns signals for all symbols.
   * Called once per primary timeframe candle close.
   */
  onCandle(data: MultiTimeframeData): StrategySignal[];

  /** Get current strategy state */
  getState(): StrategyState;

  /** Reset internal state (for backtesting) */
  reset(): void;
}
