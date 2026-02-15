/**
 * Strategy 1 — Multi-Timeframe Trend Following
 *
 * Timeframes: Daily (1D) filter + 4-Hour (4H) entry
 *
 * Indicators:
 *   Daily: EMA(50), ADX(14)
 *   4H:    EMA(9), EMA(21), ATR(14), RSI(14), Volume SMA(20)
 *
 * Entry Long:
 *   - Price > Daily 50 EMA (uptrend filter)
 *   - Daily ADX > 25 (trending market)
 *   - 4H 9-EMA crosses above 21-EMA
 *   - 4H RSI between 40-70 (not overbought)
 *   - 4H Volume > 1.2x average
 *
 * Entry Short: (mirror)
 *   - Price < Daily 50 EMA
 *   - Daily ADX > 25
 *   - 4H 9-EMA crosses below 21-EMA
 *   - 4H RSI between 30-60
 *   - 4H Volume > 1.2x average
 *
 * Stop Loss: 2x ATR(14) from entry
 * Take Profit: 3x ATR with trailing stop at 1.5x ATR
 * Exit: Trailing stop hit, OR ADX < 20, OR opposing EMA cross
 */

import { EmaIndicator } from '../indicators/ema';
import { AdxIndicator } from '../indicators/adx';
import { AtrIndicator } from '../indicators/atr';
import { RsiIndicator } from '../indicators/rsi';
import { VolumeSmaIndicator } from '../indicators/volumeSma';
import type {
  Strategy, StrategyConfig, StrategyState, StrategySignal,
  MultiTimeframeData, StrategyStatus,
} from './types';

// ── Config ─────────────────────────────────────────────────

const DEFAULT_PARAMS = {
  dailyEmaPeriod: 50,
  dailyAdxPeriod: 14,
  adxThreshold: 25,
  adxExitThreshold: 20,
  fastEmaPeriod: 9,
  slowEmaPeriod: 21,
  atrPeriod: 14,
  rsiPeriod: 14,
  volumeSmaPeriod: 20,
  volumeMultiplier: 1.2,
  slAtrMultiplier: 2,
  tpAtrMultiplier: 3,
  trailingAtrMultiplier: 1.5,
  rsiLongMin: 40,
  rsiLongMax: 70,
  rsiShortMin: 30,
  rsiShortMax: 60,
};

const CONFIG: StrategyConfig = {
  id: 'trend_following',
  name: 'Multi-TF Trend Following',
  category: 'trend_following',
  timeframes: ['D', '240'],
  primaryTimeframe: '240', // 4H
  symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT', 'ADAUSDT', 'NEARUSDT', 'INJUSDT', 'SUIUSDT', 'RENDERUSDT'],
  maxLeverage: 3,
  capitalAllocationPercent: 30,
  warmupCandles: 60,
  params: DEFAULT_PARAMS,
};

// ── Per-symbol tracking ────────────────────────────────────

interface SymbolState {
  prevFastEma: number | null;
  prevSlowEma: number | null;
  inPosition: 'long' | 'short' | null;
  entryPrice: number;
  trailingStop: number;
}

// ── Strategy ───────────────────────────────────────────────

export class TrendFollowingStrategy implements Strategy {
  readonly config: StrategyConfig;
  private readonly p: typeof DEFAULT_PARAMS;
  private state: Map<string, SymbolState> = new Map();
  private status: StrategyStatus = 'idle';
  private signals: Record<string, StrategySignal> = {};
  private metrics = { signalsEmitted: 0, tradesOpened: 0, tradesClosed: 0, winRate: 0, totalPnl: 0 };

  // Indicator instances
  private dailyEma: EmaIndicator;
  private dailyAdx: AdxIndicator;
  private fastEma: EmaIndicator;
  private slowEma: EmaIndicator;
  private atr: AtrIndicator;
  private rsi: RsiIndicator;
  private volumeSma: VolumeSmaIndicator;

  constructor(params?: Record<string, number>) {
    const p = { ...DEFAULT_PARAMS, ...params };
    this.p = p;
    this.config = { ...CONFIG, params: p };

    this.dailyEma = new EmaIndicator(p.dailyEmaPeriod);
    this.dailyAdx = new AdxIndicator(p.dailyAdxPeriod);
    this.fastEma = new EmaIndicator(p.fastEmaPeriod);
    this.slowEma = new EmaIndicator(p.slowEmaPeriod);
    this.atr = new AtrIndicator(p.atrPeriod);
    this.rsi = new RsiIndicator(p.rsiPeriod);
    this.volumeSma = new VolumeSmaIndicator(p.volumeSmaPeriod);
  }

  initialize(_data: MultiTimeframeData): void {
    this.status = 'warming_up';
    // Pre-warm: just run onCandle with historical data — indicators warm up naturally
    this.status = 'running';
  }

  onCandle(data: MultiTimeframeData): StrategySignal[] {
    if (this.status !== 'running') return [];

    const dailyCandles = data['D'] || [];
    const h4Candles = data['240'] || [];
    if (dailyCandles.length < this.config.warmupCandles || h4Candles.length < this.config.warmupCandles) {
      return [];
    }

    const signals: StrategySignal[] = [];
    const p = this.p;

    // Compute daily indicators once
    const dailyEmaValues = this.dailyEma.calculate(dailyCandles);
    const dailyAdxValues = this.dailyAdx.calculate(dailyCandles);
    const lastDailyEma = dailyEmaValues.length > 0 ? dailyEmaValues[dailyEmaValues.length - 1]!.value : null;
    const lastDailyAdx = dailyAdxValues.length > 0 ? dailyAdxValues[dailyAdxValues.length - 1]!.value : null;

    if (lastDailyEma === null || lastDailyAdx === null) return [];

    // Compute 4H indicators once
    const fastEmaValues = this.fastEma.calculate(h4Candles);
    const slowEmaValues = this.slowEma.calculate(h4Candles);
    const atrValues = this.atr.calculate(h4Candles);
    const rsiValues = this.rsi.calculate(h4Candles);
    const volSmaValues = this.volumeSma.calculate(h4Candles);

    // Get latest values
    const currFastEma = fastEmaValues.length > 0 ? fastEmaValues[fastEmaValues.length - 1]!.value : null;
    const currSlowEma = slowEmaValues.length > 0 ? slowEmaValues[slowEmaValues.length - 1]!.value : null;
    const prevFastEma = fastEmaValues.length > 1 ? fastEmaValues[fastEmaValues.length - 2]!.value : null;
    const prevSlowEma = slowEmaValues.length > 1 ? slowEmaValues[slowEmaValues.length - 2]!.value : null;
    const currAtr = atrValues.length > 0 ? atrValues[atrValues.length - 1]!.value : null;
    const currRsi = rsiValues.length > 0 ? rsiValues[rsiValues.length - 1]!.value : null;
    const currVolSma = volSmaValues.length > 0 ? volSmaValues[volSmaValues.length - 1]!.value : null;

    if (!currFastEma || !currSlowEma || !prevFastEma || !prevSlowEma || !currAtr || !currRsi || !currVolSma) {
      return [];
    }

    const lastCandle = h4Candles[h4Candles.length - 1]!;
    const currentPrice = lastCandle.close;
    const currentVolume = lastCandle.volume;

    // Check EMA crossovers
    const bullishCross = prevFastEma <= prevSlowEma && currFastEma > currSlowEma;
    const bearishCross = prevFastEma >= prevSlowEma && currFastEma < currSlowEma;
    const volumeOk = currentVolume > currVolSma * p.volumeMultiplier;

    // Process each symbol
    for (const symbol of this.config.symbols) {
      const symState = this.getSymbolState(symbol);

      // ── Exit checks (if in position) ──
      if (symState.inPosition) {
        let exitReason = '';

        // ADX weakening
        if (lastDailyAdx < p.adxExitThreshold) {
          exitReason = `ADX dropped to ${lastDailyAdx.toFixed(1)} (< ${p.adxExitThreshold})`;
        }

        // Opposing EMA cross
        if (symState.inPosition === 'long' && bearishCross) {
          exitReason = 'Bearish EMA cross while long';
        }
        if (symState.inPosition === 'short' && bullishCross) {
          exitReason = 'Bullish EMA cross while short';
        }

        // Trailing stop update (adjust signal)
        if (!exitReason && currAtr > 0) {
          const newTrail = symState.inPosition === 'long'
            ? currentPrice - currAtr * p.trailingAtrMultiplier
            : currentPrice + currAtr * p.trailingAtrMultiplier;

          const shouldUpdate = symState.inPosition === 'long'
            ? newTrail > symState.trailingStop
            : newTrail < symState.trailingStop;

          if (shouldUpdate && symState.trailingStop > 0) {
            symState.trailingStop = newTrail;
            signals.push({
              action: 'adjust',
              symbol,
              confidence: 1,
              newStopLoss: newTrail,
              reason: `Trailing stop updated to ${newTrail.toFixed(2)}`,
              indicators: { atr: currAtr, price: currentPrice },
            });
            this.metrics.signalsEmitted++;
          }
        }

        if (exitReason) {
          signals.push({
            action: 'exit',
            symbol,
            confidence: 1,
            reason: exitReason,
            indicators: { adx: lastDailyAdx, fastEma: currFastEma, slowEma: currSlowEma },
          });
          symState.inPosition = null;
          symState.entryPrice = 0;
          symState.trailingStop = 0;
          this.metrics.signalsEmitted++;
          this.metrics.tradesClosed++;
        }

        continue; // Don't look for entries while in position
      }

      // ── Entry checks ──

      // Entry Long
      if (
        currentPrice > lastDailyEma &&
        lastDailyAdx > p.adxThreshold &&
        bullishCross &&
        currRsi >= p.rsiLongMin && currRsi <= p.rsiLongMax &&
        volumeOk
      ) {
        const sl = currentPrice - currAtr * p.slAtrMultiplier;
        const tp = currentPrice + currAtr * p.tpAtrMultiplier;

        signals.push({
          action: 'entry_long',
          symbol,
          confidence: Math.min(1, (lastDailyAdx - p.adxThreshold) / 20), // Higher ADX = higher confidence
          stopLoss: sl,
          takeProfit: tp,
          reason: `Bullish EMA cross, ADX ${lastDailyAdx.toFixed(1)}, RSI ${currRsi.toFixed(1)}, Vol ${(currentVolume / currVolSma).toFixed(2)}x`,
          indicators: { adx: lastDailyAdx, rsi: currRsi, atr: currAtr, fastEma: currFastEma, slowEma: currSlowEma },
        });

        symState.inPosition = 'long';
        symState.entryPrice = currentPrice;
        symState.trailingStop = sl;
        this.metrics.signalsEmitted++;
        this.metrics.tradesOpened++;
      }

      // Entry Short
      if (
        currentPrice < lastDailyEma &&
        lastDailyAdx > p.adxThreshold &&
        bearishCross &&
        currRsi >= p.rsiShortMin && currRsi <= p.rsiShortMax &&
        volumeOk
      ) {
        const sl = currentPrice + currAtr * p.slAtrMultiplier;
        const tp = currentPrice - currAtr * p.tpAtrMultiplier;

        signals.push({
          action: 'entry_short',
          symbol,
          confidence: Math.min(1, (lastDailyAdx - p.adxThreshold) / 20),
          stopLoss: sl,
          takeProfit: tp,
          reason: `Bearish EMA cross, ADX ${lastDailyAdx.toFixed(1)}, RSI ${currRsi.toFixed(1)}, Vol ${(currentVolume / currVolSma).toFixed(2)}x`,
          indicators: { adx: lastDailyAdx, rsi: currRsi, atr: currAtr, fastEma: currFastEma, slowEma: currSlowEma },
        });

        symState.inPosition = 'short';
        symState.entryPrice = currentPrice;
        symState.trailingStop = sl;
        this.metrics.signalsEmitted++;
        this.metrics.tradesOpened++;
      }
    }

    // Update last signals
    for (const sig of signals) {
      this.signals[sig.symbol] = sig;
    }

    return signals;
  }

  getState(): StrategyState {
    return {
      status: this.status,
      activePositions: Array.from(this.state.entries())
        .filter(([, s]) => s.inPosition !== null)
        .map(([sym]) => sym),
      lastSignals: { ...this.signals },
      lastProcessedTime: {},
      metrics: { ...this.metrics },
    };
  }

  reset(): void {
    this.state.clear();
    this.signals = {};
    this.metrics = { signalsEmitted: 0, tradesOpened: 0, tradesClosed: 0, winRate: 0, totalPnl: 0 };
    this.status = 'idle';
  }

  private getSymbolState(symbol: string): SymbolState {
    if (!this.state.has(symbol)) {
      this.state.set(symbol, {
        prevFastEma: null,
        prevSlowEma: null,
        inPosition: null,
        entryPrice: 0,
        trailingStop: 0,
      });
    }
    return this.state.get(symbol)!;
  }
}
