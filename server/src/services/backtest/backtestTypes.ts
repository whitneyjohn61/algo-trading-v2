/**
 * Backtest types — parameters, results, and trade records.
 * Adapted from V1's streaming backtest types to work with V2's
 * multi-timeframe strategy interface.
 */

import type { StrategySignal } from '../../strategies/types';

// ── Parameters ──────────────────────────────────────────────

export interface BacktestParams {
  /** Strategy ID from registry */
  strategyId: string;
  /** Trading symbol (e.g. 'BTCUSDT') */
  symbol: string;
  /** Candle interval for primary timeframe (e.g. '1h', '4h') */
  interval: string;
  /** Start of backtest period (UTC ms) */
  startTime: number;
  /** End of backtest period (UTC ms) */
  endTime: number;
  /** Starting capital in USD */
  initialBalance: number;
  /** Leverage multiplier (default 1) */
  leverage: number;
  /** Taker fee rate (default 0.0006 = 0.06%) */
  takerFeeRate?: number;
  /** Slippage rate (default 0.0001 = 0.01%) */
  slippageRate?: number;
  /** Strategy parameter overrides */
  paramOverrides?: Record<string, number>;
  /** Whether to store results in DB */
  saveToDb?: boolean;
}

export interface PortfolioBacktestParams {
  /** Strategy IDs to include (empty = all) */
  strategyIds?: string[];
  symbol: string;
  interval: string;
  startTime: number;
  endTime: number;
  initialBalance: number;
  leverage: number;
  takerFeeRate?: number;
  slippageRate?: number;
  saveToDb?: boolean;
}

// ── Trade records ───────────────────────────────────────────

export interface BacktestTrade {
  id: number;
  side: 'long' | 'short';
  entryTime: number;
  entryPrice: number;
  entryQty: number;
  exitTime?: number;
  exitPrice?: number;
  pnl?: number;
  fees: number;
  entrySignal?: StrategySignal;
  exitSignal?: StrategySignal;
  notes?: string;
}

// ── Equity point ────────────────────────────────────────────

export interface EquityPoint {
  time: number;   // UTC ms
  equity: number;
}

// ── Metrics ─────────────────────────────────────────────────

export interface BacktestMetrics {
  totalReturn: number;
  totalReturnPct: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  expectancy: number;
  totalFees: number;
}

// ── Results ─────────────────────────────────────────────────

export interface BacktestResult {
  params: BacktestParams;
  metrics: BacktestMetrics;
  trades: BacktestTrade[];
  equityCurve: EquityPoint[];
  /** Sampled equity curve for API response (max ~500 points) */
  equityCurveSampled: EquityPoint[];
  finalBalance: number;
  durationMs: number;
  candlesProcessed: number;
}

export interface PortfolioBacktestResult {
  params: PortfolioBacktestParams;
  combined: BacktestMetrics;
  perStrategy: Record<string, BacktestMetrics>;
  combinedEquityCurve: EquityPoint[];
  perStrategyEquityCurves: Record<string, EquityPoint[]>;
  trades: Record<string, BacktestTrade[]>;
  finalBalance: number;
  durationMs: number;
}

// ── DB row types ────────────────────────────────────────────

export interface BacktestRunRow {
  id: number;
  user_id: string;
  strategy: string;
  parameters: Record<string, unknown>;
  params_hash: string;
  symbol: string;
  exchange: string;
  interval: string;
  start_time: string;
  end_time: string;
  initial_balance: number;
  final_balance: number;
  total_return: number;
  total_trades: number;
  win_rate: number;
  max_drawdown: number;
  total_fees: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  profit_factor: number;
  expectancy: number;
  equity_curve: EquityPoint[];
  leverage: number;
  created_at: string;
}

export interface BacktestTradeRow {
  id: number;
  run_id: number;
  side: string;
  entry_time: string;
  entry_price: number;
  entry_qty: number;
  exit_time?: string;
  exit_price?: number;
  pnl?: number;
  entry_trigger?: Record<string, unknown>;
  exit_trigger?: Record<string, unknown>;
  notes?: string;
}
