/**
 * Strategy 2 — Mean Reversion Scalper
 *
 * Timeframes: 15-Minute (15m) primary + 1-Hour (1H) filter
 *
 * Indicators:
 *   15m: BB(20, 2.0), RSI(7), Volume SMA(20), ATR(14), StochRSI(14,3,3), BB Width(20)
 *   1H:  EMA(50)
 *
 * Entry Long:
 *   - Price < lower BB
 *   - RSI(7) < 25
 *   - StochRSI K crosses above D from below 20
 *   - Volume > 2x average
 *   - Price > 1H 50-EMA (trend filter)
 *
 * Entry Short: (mirror)
 *   - Price > upper BB
 *   - RSI(7) > 75
 *   - StochRSI K crosses below D from above 80
 *   - Volume > 2x average
 *   - Price < 1H 50-EMA
 *
 * Stop Loss: 1.5x ATR from entry
 * Take Profit: Middle BB (partial 50%, trail remainder at 0.5x ATR)
 * Exit: Middle BB hit, OR RSI returns to 40-60, OR 12 candles elapsed (time stop)
 */

import { BollingerIndicator } from '../indicators/bollinger';
import { RsiIndicator } from '../indicators/rsi';
import { VolumeSmaIndicator } from '../indicators/volumeSma';
import { AtrIndicator } from '../indicators/atr';
import { StochRsiIndicator } from '../indicators/stochRsi';
import { EmaIndicator } from '../indicators/ema';
import type {
  Strategy, StrategyConfig, StrategyState, StrategySignal,
  MultiTimeframeData, StrategyStatus,
} from './types';

const DEFAULT_PARAMS = {
  bbPeriod: 20,
  bbStdDev: 2,
  rsiPeriod: 7,
  volumeSmaPeriod: 20,
  atrPeriod: 14,
  stochRsiPeriod: 14,
  stochK: 3,
  stochD: 3,
  bbWidthPeriod: 20,
  hourlyEmaPeriod: 50,
  rsiOversold: 25,
  rsiOverbought: 75,
  stochOversold: 20,
  stochOverbought: 80,
  rsiExitMin: 40,
  rsiExitMax: 60,
  volumeMultiplier: 2,
  slAtrMultiplier: 1.5,
  trailingAtrMultiplier: 0.5,
  maxCandles: 12, // Time stop — exit after N candles
};

const CONFIG: StrategyConfig = {
  id: 'mean_reversion',
  name: 'Mean Reversion Scalper',
  category: 'mean_reversion',
  timeframes: ['15', '60'],
  primaryTimeframe: '15',
  symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'AVAXUSDT', 'BNBUSDT'],
  maxLeverage: 2,
  capitalAllocationPercent: 20,
  warmupCandles: 50,
  params: DEFAULT_PARAMS,
};

interface SymbolState {
  inPosition: 'long' | 'short' | null;
  entryPrice: number;
  candlesInPosition: number;
  prevStochK: number | null;
  prevStochD: number | null;
}

export class MeanReversionStrategy implements Strategy {
  readonly config: StrategyConfig;
  private readonly p: typeof DEFAULT_PARAMS;
  private state: Map<string, SymbolState> = new Map();
  private status: StrategyStatus = 'idle';
  private signals: Record<string, StrategySignal> = {};
  private metrics = { signalsEmitted: 0, tradesOpened: 0, tradesClosed: 0, winRate: 0, totalPnl: 0 };

  // Indicators
  private bb: BollingerIndicator;
  private rsi: RsiIndicator;
  private volumeSma: VolumeSmaIndicator;
  private atr: AtrIndicator;
  private stochRsi: StochRsiIndicator;
  private hourlyEma: EmaIndicator;

  constructor(params?: Record<string, number>) {
    const p = { ...DEFAULT_PARAMS, ...params };
    this.p = p;
    this.config = { ...CONFIG, params: p };

    this.bb = new BollingerIndicator(p.bbPeriod, p.bbStdDev);
    this.rsi = new RsiIndicator(p.rsiPeriod);
    this.volumeSma = new VolumeSmaIndicator(p.volumeSmaPeriod);
    this.atr = new AtrIndicator(p.atrPeriod);
    this.stochRsi = new StochRsiIndicator(p.stochRsiPeriod, p.stochK, p.stochD);
    this.hourlyEma = new EmaIndicator(p.hourlyEmaPeriod);
  }

  initialize(_data: MultiTimeframeData): void {
    this.status = 'running';
  }

  onCandle(data: MultiTimeframeData): StrategySignal[] {
    if (this.status !== 'running') return [];

    const m15 = data['15'] || [];
    const h1 = data['60'] || [];
    if (m15.length < this.config.warmupCandles || h1.length < this.config.warmupCandles) return [];

    const p = this.p;
    const signals: StrategySignal[] = [];

    // Compute 15m indicators
    const bbValues = this.bb.calculate(m15);
    const rsiValues = this.rsi.calculate(m15);
    const volSmaValues = this.volumeSma.calculate(m15);
    const atrValues = this.atr.calculate(m15);
    const stochValues = this.stochRsi.calculate(m15);

    // Compute 1H indicator
    const hourlyEmaValues = this.hourlyEma.calculate(h1);

    // Get latest values
    const lastBb = bbValues.length > 0 ? bbValues[bbValues.length - 1]! : null;
    const lastRsi = rsiValues.length > 0 ? rsiValues[rsiValues.length - 1]!.value : null;
    const lastVolSma = volSmaValues.length > 0 ? volSmaValues[volSmaValues.length - 1]!.value : null;
    const lastAtr = atrValues.length > 0 ? atrValues[atrValues.length - 1]!.value : null;
    const lastStoch = stochValues.length > 0 ? stochValues[stochValues.length - 1]! : null;
    const prevStoch = stochValues.length > 1 ? stochValues[stochValues.length - 2]! : null;
    const lastHourlyEma = hourlyEmaValues.length > 0 ? hourlyEmaValues[hourlyEmaValues.length - 1]!.value : null;

    if (!lastBb || lastRsi === null || !lastVolSma || !lastAtr || !lastStoch || !prevStoch || !lastHourlyEma) {
      return [];
    }

    const lastCandle = m15[m15.length - 1]!;
    const price = lastCandle.close;
    const volume = lastCandle.volume;
    const volumeOk = volume > lastVolSma * p.volumeMultiplier;

    // Stoch RSI crossovers
    const stochBullishCross = prevStoch.k < prevStoch.d && lastStoch.k > lastStoch.d && prevStoch.k < p.stochOversold;
    const stochBearishCross = prevStoch.k > prevStoch.d && lastStoch.k < lastStoch.d && prevStoch.k > p.stochOverbought;

    for (const symbol of this.config.symbols) {
      const sym = this.getSymbolState(symbol);

      // ── Exit checks ──
      if (sym.inPosition) {
        sym.candlesInPosition++;
        let exitReason = '';

        // Time stop
        if (sym.candlesInPosition >= p.maxCandles) {
          exitReason = `Time stop: ${sym.candlesInPosition} candles elapsed`;
        }

        // RSI normalized (returned to 40-60)
        if (lastRsi >= p.rsiExitMin && lastRsi <= p.rsiExitMax) {
          exitReason = `RSI normalized to ${lastRsi.toFixed(1)}`;
        }

        // Price hit middle BB
        if (sym.inPosition === 'long' && price >= lastBb.middle) {
          exitReason = `Price reached middle BB (${lastBb.middle.toFixed(2)})`;
        }
        if (sym.inPosition === 'short' && price <= lastBb.middle) {
          exitReason = `Price reached middle BB (${lastBb.middle.toFixed(2)})`;
        }

        if (exitReason) {
          signals.push({
            action: 'exit',
            symbol,
            confidence: 1,
            reason: exitReason,
            indicators: { rsi: lastRsi, price, middleBb: lastBb.middle },
          });
          sym.inPosition = null;
          sym.entryPrice = 0;
          sym.candlesInPosition = 0;
          this.metrics.signalsEmitted++;
          this.metrics.tradesClosed++;
        }

        continue;
      }

      // ── Entry Long ──
      if (
        price < lastBb.lower &&
        lastRsi < p.rsiOversold &&
        stochBullishCross &&
        volumeOk &&
        price > lastHourlyEma // Uptrend filter
      ) {
        const sl = price - lastAtr * p.slAtrMultiplier;
        signals.push({
          action: 'entry_long',
          symbol,
          confidence: 0.7,
          stopLoss: sl,
          takeProfit: lastBb.middle,
          reason: `Oversold bounce: RSI ${lastRsi.toFixed(1)}, price below lower BB, StochRSI bullish cross`,
          indicators: { rsi: lastRsi, stochK: lastStoch.k, stochD: lastStoch.d, lowerBb: lastBb.lower, atr: lastAtr },
        });
        sym.inPosition = 'long';
        sym.entryPrice = price;
        sym.candlesInPosition = 0;
        this.metrics.signalsEmitted++;
        this.metrics.tradesOpened++;
      }

      // ── Entry Short ──
      if (
        price > lastBb.upper &&
        lastRsi > p.rsiOverbought &&
        stochBearishCross &&
        volumeOk &&
        price < lastHourlyEma // Downtrend filter
      ) {
        const sl = price + lastAtr * p.slAtrMultiplier;
        signals.push({
          action: 'entry_short',
          symbol,
          confidence: 0.7,
          stopLoss: sl,
          takeProfit: lastBb.middle,
          reason: `Overbought reversal: RSI ${lastRsi.toFixed(1)}, price above upper BB, StochRSI bearish cross`,
          indicators: { rsi: lastRsi, stochK: lastStoch.k, stochD: lastStoch.d, upperBb: lastBb.upper, atr: lastAtr },
        });
        sym.inPosition = 'short';
        sym.entryPrice = price;
        sym.candlesInPosition = 0;
        this.metrics.signalsEmitted++;
        this.metrics.tradesOpened++;
      }
    }

    for (const sig of signals) this.signals[sig.symbol] = sig;
    return signals;
  }

  getState(): StrategyState {
    return {
      status: this.status,
      activePositions: Array.from(this.state.entries()).filter(([, s]) => s.inPosition).map(([sym]) => sym),
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
      this.state.set(symbol, { inPosition: null, entryPrice: 0, candlesInPosition: 0, prevStochK: null, prevStochD: null });
    }
    return this.state.get(symbol)!;
  }
}
