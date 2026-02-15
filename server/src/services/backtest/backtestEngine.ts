/**
 * Backtest Engine — Streaming single-candle simulation.
 * Transplanted from V1's streamingBacktest.ts, adapted for V2 strategy interface.
 *
 * Lifecycle:
 *   1. Fetch candles from exchange via candleService
 *   2. Warm up strategy with initial candles
 *   3. Process remaining candles one-by-one through strategy.onCandle()
 *   4. Handle signals via TradeManager
 *   5. Calculate final metrics
 *   6. Return BacktestResult with sampled equity curve
 */

import type { Candle } from '../../indicators/types';
import type { ExchangeInterval } from '../../services/exchange/exchangeService';
import type { Strategy, MultiTimeframeData } from '../../strategies/types';
import { getStrategy, getAllStrategies } from '../../strategies/registry';
import candleService from '../../services/market/candleService';
import type {
  BacktestParams,
  BacktestResult,
  BacktestMetrics,
  EquityPoint,
  PortfolioBacktestParams,
  PortfolioBacktestResult,
} from './backtestTypes';
import { TradeManager } from './tradeManager';

// ── Interval helpers ──────────────────────────────────────────

const INTERVAL_MS: Record<string, number> = {
  '1':    60_000,
  '3':    3 * 60_000,
  '5':    5 * 60_000,
  '15':   15 * 60_000,
  '30':   30 * 60_000,
  '60':   60 * 60_000,
  '120':  2 * 60 * 60_000,
  '240':  4 * 60 * 60_000,
  '360':  6 * 60 * 60_000,
  '720':  12 * 60 * 60_000,
  'D':    24 * 60 * 60_000,
  'W':    7 * 24 * 60 * 60_000,
};

function intervalToMs(interval: string): number {
  return INTERVAL_MS[interval] || 60 * 60_000; // Default 1h
}

const MINUTES_PER_YEAR = 525_960;

function barsPerYear(interval: string): number {
  const ms = intervalToMs(interval);
  const minutesPerBar = ms / 60_000;
  return MINUTES_PER_YEAR / minutesPerBar;
}

// ── Candle fetching (paginated) ───────────────────────────────

async function fetchAllCandles(
  symbol: string,
  interval: ExchangeInterval,
  startTime: number,
  endTime: number,
): Promise<Candle[]> {
  const allCandles: Candle[] = [];
  let cursor = startTime;
  const pageSize = 1000;

  while (cursor < endTime) {
    const batch = await candleService.getCandles(symbol, interval, pageSize, cursor, endTime);
    if (!batch || batch.length === 0) break;

    for (const c of batch) {
      if (c.timestamp >= startTime && c.timestamp <= endTime) {
        allCandles.push({
          timestamp: c.timestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
        });
      }
    }

    // Advance cursor past last candle
    const lastTs = batch[batch.length - 1]!.timestamp;
    if (lastTs <= cursor) break; // No progress, prevent infinite loop
    cursor = lastTs + 1;
  }

  // Deduplicate by timestamp
  const seen = new Set<number>();
  return allCandles.filter(c => {
    if (seen.has(c.timestamp)) return false;
    seen.add(c.timestamp);
    return true;
  });
}

// ── Metrics calculation ───────────────────────────────────────

function calculateMetrics(
  trades: { pnl?: number }[],
  equityCurve: EquityPoint[],
  initialBalance: number,
  finalBalance: number,
  maxDrawdown: number,
  totalFees: number,
  interval: string,
): BacktestMetrics {
  const closedTrades = trades.filter(t => t.pnl !== undefined);
  const totalTrades = closedTrades.length;
  const wins = closedTrades.filter(t => (t.pnl || 0) > 0);
  const losses = closedTrades.filter(t => (t.pnl || 0) <= 0);

  const totalReturn = finalBalance - initialBalance;
  const totalReturnPct = initialBalance > 0 ? (totalReturn / initialBalance) * 100 : 0;
  const winRate = totalTrades > 0 ? wins.length / totalTrades : 0;

  const avgWin = wins.length > 0
    ? wins.reduce((s, t) => s + (t.pnl || 0), 0) / wins.length
    : 0;
  const avgLoss = losses.length > 0
    ? losses.reduce((s, t) => s + Math.abs(t.pnl || 0), 0) / losses.length
    : 0;

  const totalProfit = wins.reduce((s, t) => s + (t.pnl || 0), 0);
  const totalLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl || 0), 0));
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;
  const expectancy = totalTrades > 0 ? totalReturn / totalTrades : 0;

  // Sharpe and Sortino from equity curve returns
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1]!.equity;
    const curr = equityCurve[i]!.equity;
    if (prev > 0) {
      returns.push((curr - prev) / prev);
    }
  }

  let sharpeRatio = 0;
  let sortinoRatio = 0;

  if (returns.length > 1) {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    const std = Math.sqrt(variance);
    const annualizationFactor = Math.sqrt(barsPerYear(interval));

    if (std > 0) {
      sharpeRatio = (mean / std) * annualizationFactor;
    }

    // Sortino: only downside deviation
    const downReturns = returns.filter(r => r < 0);
    if (downReturns.length > 0) {
      const dnMean = downReturns.reduce((a, b) => a + b, 0) / downReturns.length;
      const dnVar = downReturns.reduce((a, b) => a + Math.pow(b - dnMean, 2), 0) / downReturns.length;
      const dnStd = Math.sqrt(dnVar);
      if (dnStd > 0) {
        sortinoRatio = (mean / dnStd) * annualizationFactor;
      }
    }
  }

  return {
    totalReturn,
    totalReturnPct: Math.round(totalReturnPct * 100) / 100,
    totalTrades,
    winningTrades: wins.length,
    losingTrades: losses.length,
    winRate: Math.round(winRate * 10000) / 10000,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    profitFactor: profitFactor === Infinity ? 999.99 : Math.round(profitFactor * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    maxDrawdownPct: Math.round(maxDrawdown * 10000) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    sortinoRatio: Math.round(sortinoRatio * 100) / 100,
    expectancy: Math.round(expectancy * 100) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
  };
}

// ── Equity curve sampling ─────────────────────────────────────

function sampleEquityCurve(curve: EquityPoint[], maxPoints: number = 500): EquityPoint[] {
  if (curve.length <= maxPoints) return curve;

  const sampled: EquityPoint[] = [curve[0]!];
  const step = (curve.length - 1) / (maxPoints - 1);

  for (let i = 1; i < maxPoints - 1; i++) {
    const idx = Math.round(i * step);
    sampled.push(curve[idx]!);
  }

  sampled.push(curve[curve.length - 1]!);
  return sampled;
}

// ── Single-strategy backtest ──────────────────────────────────

export async function runBacktest(params: BacktestParams): Promise<BacktestResult> {
  const startMs = Date.now();

  const strategy = getStrategy(params.strategyId);
  if (!strategy) {
    throw new Error(`Strategy not found: ${params.strategyId}`);
  }

  const takerFeeRate = params.takerFeeRate ?? 0.0006;
  const slippageRate = params.slippageRate ?? 0.0001;

  // Reset strategy state for clean run
  strategy.reset();

  // Apply parameter overrides
  if (params.paramOverrides) {
    for (const [key, val] of Object.entries(params.paramOverrides)) {
      if (strategy.config.params[key] !== undefined) {
        strategy.config.params[key] = val;
      }
    }
  }

  // Fetch all candles for the period
  console.log(`[Backtest] Fetching candles for ${params.symbol} ${params.interval} from ${new Date(params.startTime).toISOString()} to ${new Date(params.endTime).toISOString()}`);

  const interval = params.interval as ExchangeInterval;
  const candles = await fetchAllCandles(params.symbol, interval, params.startTime, params.endTime);

  if (candles.length < strategy.config.warmupCandles + 10) {
    throw new Error(`Insufficient candle data: got ${candles.length}, need at least ${strategy.config.warmupCandles + 10} for warmup + simulation`);
  }

  console.log(`[Backtest] Got ${candles.length} candles, warming up with ${strategy.config.warmupCandles} bars`);

  // Create trade manager
  const tradeManager = new TradeManager({
    initialBalance: params.initialBalance,
    leverage: params.leverage,
    takerFeeRate,
    slippageRate,
  });

  // Split candles: warmup + simulation
  const warmupCount = Math.min(strategy.config.warmupCandles, Math.floor(candles.length * 0.3));
  const warmupCandles = candles.slice(0, warmupCount);
  const simCandles = candles.slice(warmupCount);

  // Build multi-timeframe data for warmup (single timeframe for now)
  const warmupData: MultiTimeframeData = {
    [params.interval]: warmupCandles,
  };
  strategy.initialize(warmupData);

  // Process simulation candles
  let processedCount = 0;
  const allCandlesSoFar = [...warmupCandles];

  for (const candle of simCandles) {
    allCandlesSoFar.push(candle);

    // Build data window for strategy
    const data: MultiTimeframeData = {
      [params.interval]: allCandlesSoFar,
    };

    // Get signals from strategy
    const signals = strategy.onCandle(data);

    // Process signals through trade manager
    for (const signal of signals) {
      if (signal.symbol !== params.symbol) continue;

      switch (signal.action) {
        case 'entry_long':
        case 'entry_short':
          tradeManager.handleEntry(candle, signal);
          break;
        case 'exit':
          tradeManager.handleExit(candle, signal);
          break;
        case 'adjust':
          tradeManager.handleAdjust(signal);
          break;
        case 'hold':
        default:
          break;
      }
    }

    // Update equity tracking + SL/TP checks
    tradeManager.updateOnCandle(candle);
    processedCount++;
  }

  // Force-close any open position at last candle price
  if (tradeManager.hasPosition() && simCandles.length > 0) {
    tradeManager.handleExit(simCandles[simCandles.length - 1]!);
  }

  const trades = tradeManager.getTrades();
  const equityCurve = tradeManager.getEquityCurve();
  const finalBalance = tradeManager.getBalance();

  const metrics = calculateMetrics(
    trades,
    equityCurve,
    params.initialBalance,
    finalBalance,
    tradeManager.getMaxDrawdown(),
    tradeManager.getTotalFees(),
    params.interval,
  );

  const durationMs = Date.now() - startMs;
  console.log(`[Backtest] Complete: ${processedCount} candles, ${trades.length} trades, ${durationMs}ms`);

  return {
    params,
    metrics,
    trades,
    equityCurve,
    equityCurveSampled: sampleEquityCurve(equityCurve),
    finalBalance: Math.round(finalBalance * 100) / 100,
    durationMs,
    candlesProcessed: processedCount,
  };
}

// ── Portfolio backtest (multi-strategy) ───────────────────────

export async function runPortfolioBacktest(
  params: PortfolioBacktestParams,
): Promise<PortfolioBacktestResult> {
  const startMs = Date.now();

  // Select strategies
  let strategies: Strategy[];
  if (params.strategyIds && params.strategyIds.length > 0) {
    strategies = params.strategyIds.map(id => {
      const s = getStrategy(id);
      if (!s) throw new Error(`Strategy not found: ${id}`);
      return s;
    });
  } else {
    strategies = getAllStrategies();
  }

  if (strategies.length === 0) {
    throw new Error('No strategies available for portfolio backtest');
  }

  const takerFeeRate = params.takerFeeRate ?? 0.0006;
  const slippageRate = params.slippageRate ?? 0.0001;

  // Fetch candles once (shared across strategies)
  const interval = params.interval as ExchangeInterval;
  const candles = await fetchAllCandles(params.symbol, interval, params.startTime, params.endTime);

  // Determine max warmup across strategies
  const maxWarmup = Math.max(...strategies.map(s => s.config.warmupCandles));
  if (candles.length < maxWarmup + 10) {
    throw new Error(`Insufficient candle data: got ${candles.length}, need at least ${maxWarmup + 10}`);
  }

  // Capital allocation per strategy based on their config percentages
  const totalAllocation = strategies.reduce((s, st) => s + st.config.capitalAllocationPercent, 0);
  const perStrategyBalance: Record<string, number> = {};
  for (const s of strategies) {
    const pct = s.config.capitalAllocationPercent / (totalAllocation || 100);
    perStrategyBalance[s.config.id] = params.initialBalance * pct;
  }

  // Create a trade manager per strategy
  const managers: Record<string, TradeManager> = {};
  for (const s of strategies) {
    s.reset();
    managers[s.config.id] = new TradeManager({
      initialBalance: perStrategyBalance[s.config.id]!,
      leverage: params.leverage,
      takerFeeRate,
      slippageRate,
    });
  }

  // Warmup all strategies
  const warmupCandles = candles.slice(0, maxWarmup);
  const simCandles = candles.slice(maxWarmup);

  for (const s of strategies) {
    const warmupData: MultiTimeframeData = { [params.interval]: warmupCandles };
    s.initialize(warmupData);
  }

  // Process candles
  const allCandlesSoFar = [...warmupCandles];
  for (const candle of simCandles) {
    allCandlesSoFar.push(candle);
    const data: MultiTimeframeData = { [params.interval]: allCandlesSoFar };

    for (const s of strategies) {
      const signals = s.onCandle(data);
      const mgr = managers[s.config.id]!;

      for (const signal of signals) {
        if (signal.symbol !== params.symbol) continue;
        switch (signal.action) {
          case 'entry_long':
          case 'entry_short':
            mgr.handleEntry(candle, signal);
            break;
          case 'exit':
            mgr.handleExit(candle, signal);
            break;
          case 'adjust':
            mgr.handleAdjust(signal);
            break;
        }
      }
      mgr.updateOnCandle(candle);
    }
  }

  // Force close remaining positions
  if (simCandles.length > 0) {
    const lastCandle = simCandles[simCandles.length - 1]!;
    for (const s of strategies) {
      const mgr = managers[s.config.id]!;
      if (mgr.hasPosition()) mgr.handleExit(lastCandle);
    }
  }

  // Collect results per strategy
  const perStrategy: Record<string, BacktestMetrics> = {};
  const perStrategyEquityCurves: Record<string, EquityPoint[]> = {};
  const allTrades: Record<string, ReturnType<TradeManager['getTrades']>> = {};
  let totalFinalBalance = 0;

  for (const s of strategies) {
    const mgr = managers[s.config.id]!;
    const trades = mgr.getTrades();
    const ec = mgr.getEquityCurve();
    const fb = mgr.getBalance();
    totalFinalBalance += fb;

    perStrategy[s.config.id] = calculateMetrics(
      trades, ec,
      perStrategyBalance[s.config.id]!,
      fb,
      mgr.getMaxDrawdown(),
      mgr.getTotalFees(),
      params.interval,
    );
    perStrategyEquityCurves[s.config.id] = sampleEquityCurve(ec);
    allTrades[s.config.id] = trades;
  }

  // Build combined equity curve
  const stratIds = strategies.map(s => s.config.id);
  const firstCurve = managers[stratIds[0]!]!.getEquityCurve();
  const combinedEquityCurve: EquityPoint[] = firstCurve.map((point, idx) => {
    let totalEquity = 0;
    for (const sid of stratIds) {
      const curve = managers[sid]!.getEquityCurve();
      totalEquity += curve[idx]?.equity ?? 0;
    }
    return { time: point.time, equity: totalEquity };
  });

  // Combined metrics
  const allClosedTrades = stratIds.flatMap(sid => managers[sid]!.getTrades());
  const combinedMaxDD = Math.max(...stratIds.map(sid => managers[sid]!.getMaxDrawdown()));
  const combinedFees = stratIds.reduce((s, sid) => s + managers[sid]!.getTotalFees(), 0);

  const combined = calculateMetrics(
    allClosedTrades,
    combinedEquityCurve,
    params.initialBalance,
    totalFinalBalance,
    combinedMaxDD,
    combinedFees,
    params.interval,
  );

  return {
    params,
    combined,
    perStrategy,
    combinedEquityCurve: sampleEquityCurve(combinedEquityCurve),
    perStrategyEquityCurves,
    trades: allTrades,
    finalBalance: Math.round(totalFinalBalance * 100) / 100,
    durationMs: Date.now() - startMs,
  };
}
