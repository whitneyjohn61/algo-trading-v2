/**
 * Strategy 4 — Cross-Sectional Momentum (Rotation)
 *
 * Timeframes: Daily (1D), rebalanced weekly (Monday 00:00 UTC)
 *
 * Metrics:
 *   ROC(7, 14, 30), Composite momentum = 40% ROC7 + 35% ROC14 + 25% ROC30,
 *   Realized volatility (14d), ATR(14), Drawdown from 30d high
 *
 * Universe: Top 30 coins by 14d avg volume (> $10M daily)
 * Long basket: Top 5 by volatility-adjusted momentum
 * Short basket: Bottom 5 (skip shorts if BTC > 50d EMA — bull market filter)
 * Position sizing: Equal volatility-weighted (ATR-based)
 * Rebalance: Weekly on Monday
 */

import { RocIndicator } from '../indicators/roc';
import { RealizedVolIndicator } from '../indicators/realizedVol';
import { AtrIndicator } from '../indicators/atr';
import { EmaIndicator } from '../indicators/ema';
import type {
  Strategy, StrategyConfig, StrategyState, StrategySignal,
  MultiTimeframeData, StrategyStatus,
} from './types';

const DEFAULT_PARAMS = {
  roc7Period: 7,
  roc14Period: 14,
  roc30Period: 30,
  roc7Weight: 0.40,
  roc14Weight: 0.35,
  roc30Weight: 0.25,
  realizedVolPeriod: 14,
  atrPeriod: 14,
  btcEmaPeriod: 50,
  longBasketSize: 5,
  shortBasketSize: 5,
  maxDrawdownFromHighPct: 60, // Exclude coins down > 60% from 30d high
};

const CONFIG: StrategyConfig = {
  id: 'cross_momentum',
  name: 'Cross-Sectional Momentum',
  category: 'momentum',
  timeframes: ['D'],
  primaryTimeframe: 'D',
  symbols: [], // Dynamic — set by universe scanner
  maxLeverage: 2,
  capitalAllocationPercent: 30,
  warmupCandles: 35, // Need 30 for ROC30 + buffer
  params: DEFAULT_PARAMS,
};

interface SymbolRank {
  symbol: string;
  compositeScore: number;
  volAdjustedScore: number;
  realizedVol: number;
  atr: number;
  drawdownPct: number;
}

export class CrossMomentumStrategy implements Strategy {
  readonly config: StrategyConfig;
  private readonly p: typeof DEFAULT_PARAMS;
  private longBasket: Set<string> = new Set();
  private shortBasket: Set<string> = new Set();
  private status: StrategyStatus = 'idle';
  private signals: Record<string, StrategySignal> = {};
  private metrics = { signalsEmitted: 0, tradesOpened: 0, tradesClosed: 0, winRate: 0, totalPnl: 0 };
  private lastRebalanceDay: number = 0;

  private roc7: RocIndicator;
  private roc14: RocIndicator;
  private roc30: RocIndicator;
  private realizedVol: RealizedVolIndicator;
  private atr: AtrIndicator;
  private btcEma: EmaIndicator;

  constructor(params?: Record<string, number>) {
    const p = { ...DEFAULT_PARAMS, ...params };
    this.p = p;
    this.config = { ...CONFIG, params: p };

    this.roc7 = new RocIndicator(p.roc7Period);
    this.roc14 = new RocIndicator(p.roc14Period);
    this.roc30 = new RocIndicator(p.roc30Period);
    this.realizedVol = new RealizedVolIndicator(p.realizedVolPeriod);
    this.atr = new AtrIndicator(p.atrPeriod);
    this.btcEma = new EmaIndicator(p.btcEmaPeriod);
  }

  /** Call to update universe from scanner */
  updateUniverse(symbols: string[]): void {
    this.config.symbols = symbols;
  }

  initialize(_data: MultiTimeframeData): void {
    this.status = 'running';
  }

  onCandle(data: MultiTimeframeData): StrategySignal[] {
    if (this.status !== 'running') return [];

    const daily = data['D'] || [];
    if (daily.length < this.config.warmupCandles) return [];

    const p = this.p;
    const lastCandle = daily[daily.length - 1]!;

    // Only rebalance on Mondays (day 1)
    const candleDate = new Date(lastCandle.timestamp);
    const dayOfWeek = candleDate.getUTCDay();
    const dayKey = Math.floor(lastCandle.timestamp / 86400000);

    if (dayOfWeek !== 1 || dayKey === this.lastRebalanceDay) {
      return []; // Not a Monday, or already rebalanced today
    }

    this.lastRebalanceDay = dayKey;

    // ── BTC bull market filter ──
    // Need BTC data to determine if we should short
    const btcEmaValues = this.btcEma.calculate(daily);
    const lastBtcEma = btcEmaValues.length > 0 ? btcEmaValues[btcEmaValues.length - 1]!.value : null;
    const btcPrice = lastCandle.close; // Assumes daily data contains BTC
    const isBullMarket = lastBtcEma !== null && btcPrice > lastBtcEma;

    // ── Rank all symbols ──
    // Note: In live, each symbol's candles would be passed separately via data structure.
    // For now, this processes the single daily candle array (BTC baseline).
    // The Universe Scanner provides symbol-specific candles in production.
    const rankings: SymbolRank[] = [];

    for (const symbol of this.config.symbols) {
      // In production, data[`D_${symbol}`] would have per-symbol candles.
      // For the scaffold, we compute against the provided daily candles.
      const symbolCandles = daily; // TODO: per-symbol candle data in Phase 4.9

      const roc7Vals = this.roc7.calculate(symbolCandles);
      const roc14Vals = this.roc14.calculate(symbolCandles);
      const roc30Vals = this.roc30.calculate(symbolCandles);
      const rvVals = this.realizedVol.calculate(symbolCandles);
      const atrVals = this.atr.calculate(symbolCandles);

      const lastRoc7 = roc7Vals.length > 0 ? roc7Vals[roc7Vals.length - 1]!.value : 0;
      const lastRoc14 = roc14Vals.length > 0 ? roc14Vals[roc14Vals.length - 1]!.value : 0;
      const lastRoc30 = roc30Vals.length > 0 ? roc30Vals[roc30Vals.length - 1]!.value : 0;
      const lastRv = rvVals.length > 0 ? rvVals[rvVals.length - 1]!.value : 1;
      const lastAtr = atrVals.length > 0 ? atrVals[atrVals.length - 1]!.value : 0;

      // Composite momentum score
      const composite = lastRoc7 * p.roc7Weight + lastRoc14 * p.roc14Weight + lastRoc30 * p.roc30Weight;
      const volAdj = lastRv > 0 ? composite / lastRv : composite;

      // Drawdown from 30d high
      const recent30 = symbolCandles.slice(-30);
      const high30d = recent30.reduce((max, c) => Math.max(max, c.high), 0);
      const drawdownPct = high30d > 0 ? ((high30d - lastCandle.close) / high30d) * 100 : 0;

      // Exclude coins with extreme drawdown
      if (drawdownPct > p.maxDrawdownFromHighPct) continue;

      rankings.push({
        symbol,
        compositeScore: composite,
        volAdjustedScore: volAdj,
        realizedVol: lastRv,
        atr: lastAtr,
        drawdownPct,
      });
    }

    // Sort by vol-adjusted score (descending)
    rankings.sort((a, b) => b.volAdjustedScore - a.volAdjustedScore);

    // ── Build new baskets ──
    const newLongs = new Set(rankings.slice(0, p.longBasketSize).map(r => r.symbol));
    const newShorts = isBullMarket
      ? new Set<string>() // Skip shorts in bull market
      : new Set(rankings.slice(-p.shortBasketSize).map(r => r.symbol));

    const signals: StrategySignal[] = [];

    // ── Exit positions no longer in basket ──
    for (const sym of this.longBasket) {
      if (!newLongs.has(sym)) {
        signals.push({ action: 'exit', symbol: sym, confidence: 1, reason: 'Dropped from long basket on rebalance' });
        this.metrics.signalsEmitted++;
        this.metrics.tradesClosed++;
      }
    }
    for (const sym of this.shortBasket) {
      if (!newShorts.has(sym)) {
        signals.push({ action: 'exit', symbol: sym, confidence: 1, reason: 'Dropped from short basket on rebalance' });
        this.metrics.signalsEmitted++;
        this.metrics.tradesClosed++;
      }
    }

    // ── Enter new positions ──
    for (const sym of newLongs) {
      if (!this.longBasket.has(sym)) {
        const rank = rankings.find(r => r.symbol === sym);
        signals.push({
          action: 'entry_long', symbol: sym, confidence: 0.8,
          reason: `Weekly rebalance: top momentum (score ${rank?.volAdjustedScore.toFixed(2)})`,
          indicators: { compositeScore: rank?.compositeScore || 0, realizedVol: rank?.realizedVol || 0 },
        });
        this.metrics.signalsEmitted++;
        this.metrics.tradesOpened++;
      }
    }
    for (const sym of newShorts) {
      if (!this.shortBasket.has(sym)) {
        const rank = rankings.find(r => r.symbol === sym);
        signals.push({
          action: 'entry_short', symbol: sym, confidence: 0.8,
          reason: `Weekly rebalance: bottom momentum (score ${rank?.volAdjustedScore.toFixed(2)})`,
          indicators: { compositeScore: rank?.compositeScore || 0, realizedVol: rank?.realizedVol || 0 },
        });
        this.metrics.signalsEmitted++;
        this.metrics.tradesOpened++;
      }
    }

    // Update baskets
    this.longBasket = newLongs;
    this.shortBasket = newShorts;

    for (const sig of signals) this.signals[sig.symbol] = sig;
    return signals;
  }

  getState(): StrategyState {
    return {
      status: this.status,
      activePositions: [...this.longBasket, ...this.shortBasket],
      lastSignals: { ...this.signals },
      lastProcessedTime: {},
      metrics: { ...this.metrics },
    };
  }

  reset(): void {
    this.longBasket.clear();
    this.shortBasket.clear();
    this.signals = {};
    this.metrics = { signalsEmitted: 0, tradesOpened: 0, tradesClosed: 0, winRate: 0, totalPnl: 0 };
    this.lastRebalanceDay = 0;
    this.status = 'idle';
  }
}
