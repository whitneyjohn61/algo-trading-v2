/**
 * Strategy 3 — Funding Rate Carry
 *
 * Timeframes: 1-Hour (1H) execution + 8-Hour funding settlements
 *
 * Metrics:
 *   Current funding rate, 7-day avg funding rate,
 *   Funding rate Z-score (30-day), OI change 24h,
 *   1H RSI(14), 1H ATR(14)
 *
 * Entry Short Perps:
 *   - Funding Z-score > 1.5
 *   - 7d avg > 0.01%/8h
 *   - OI rising
 *   - RSI > 60
 *
 * Entry Long Perps:
 *   - Funding Z-score < -1.5
 *   - 7d avg < -0.01%/8h
 *   - OI rising
 *   - RSI < 40
 *
 * Stop Loss: 2.5x ATR
 * Take Profit: Funding Z-score returns to -0.5 to +0.5, OR 3-5 funding periods
 *
 * NOTE: This strategy depends on FundingRateService (Step 4.8) for live data.
 * The onCandle method receives funding metrics via the MultiTimeframeData structure
 * with a special '_funding' key containing pre-computed funding data.
 */

import { RsiIndicator } from '../indicators/rsi';
import { AtrIndicator } from '../indicators/atr';
import type {
  Strategy, StrategyConfig, StrategyState, StrategySignal,
  MultiTimeframeData, StrategyStatus,
} from './types';

const DEFAULT_PARAMS = {
  rsiPeriod: 14,
  atrPeriod: 14,
  zScoreEntryThreshold: 1.5,
  zScoreExitMin: -0.5,
  zScoreExitMax: 0.5,
  avgFundingThreshold: 0.0001, // 0.01% per 8h
  rsiLongMax: 40,
  rsiShortMin: 60,
  slAtrMultiplier: 2.5,
  maxFundingPeriods: 5, // Exit after N funding periods (40 hours)
};

const CONFIG: StrategyConfig = {
  id: 'funding_carry',
  name: 'Funding Rate Carry',
  category: 'carry',
  timeframes: ['60'],
  primaryTimeframe: '60', // 1H
  symbols: [], // Dynamic — set by universe scanner (top funding extremes)
  maxLeverage: 2,
  capitalAllocationPercent: 20,
  warmupCandles: 30,
  params: DEFAULT_PARAMS,
};

/** Funding metrics provided by FundingRateService */
export interface FundingMetrics {
  symbol: string;
  currentRate: number;
  avg7d: number;
  zScore30d: number;
  oiChange24hPct: number;
  nextSettlementTime: number;
}

interface SymbolState {
  inPosition: 'long' | 'short' | null;
  entryPrice: number;
  fundingPeriodsElapsed: number;
  entryZScore: number;
}

export class FundingCarryStrategy implements Strategy {
  readonly config: StrategyConfig;
  private readonly p: typeof DEFAULT_PARAMS;
  private state: Map<string, SymbolState> = new Map();
  private status: StrategyStatus = 'idle';
  private signals: Record<string, StrategySignal> = {};
  private metrics = { signalsEmitted: 0, tradesOpened: 0, tradesClosed: 0, winRate: 0, totalPnl: 0 };
  private fundingData: Map<string, FundingMetrics> = new Map();

  private rsi: RsiIndicator;
  private atr: AtrIndicator;

  constructor(params?: Record<string, number>) {
    const p = { ...DEFAULT_PARAMS, ...params };
    this.p = p;
    this.config = { ...CONFIG, params: p };
    this.rsi = new RsiIndicator(p.rsiPeriod);
    this.atr = new AtrIndicator(p.atrPeriod);
  }

  /** Call externally to update funding metrics from FundingRateService */
  updateFundingData(metrics: FundingMetrics[]): void {
    for (const m of metrics) {
      this.fundingData.set(m.symbol, m);
    }
    // Update dynamic symbol list (top funding extremes)
    this.config.symbols = metrics.map(m => m.symbol);
  }

  initialize(_data: MultiTimeframeData): void {
    this.status = 'running';
  }

  onCandle(data: MultiTimeframeData): StrategySignal[] {
    if (this.status !== 'running') return [];

    const h1 = data['60'] || [];
    if (h1.length < this.config.warmupCandles) return [];

    const p = this.p;
    const signals: StrategySignal[] = [];

    // Compute 1H indicators
    const rsiValues = this.rsi.calculate(h1);
    const atrValues = this.atr.calculate(h1);
    const lastRsi = rsiValues.length > 0 ? rsiValues[rsiValues.length - 1]!.value : null;
    const lastAtr = atrValues.length > 0 ? atrValues[atrValues.length - 1]!.value : null;
    if (lastRsi === null || !lastAtr) return [];

    const price = h1[h1.length - 1]!.close;

    for (const symbol of this.config.symbols) {
      const funding = this.fundingData.get(symbol);
      if (!funding) continue;

      const sym = this.getSymbolState(symbol);

      // ── Exit checks ──
      if (sym.inPosition) {
        let exitReason = '';

        // Z-score normalized
        if (funding.zScore30d >= p.zScoreExitMin && funding.zScore30d <= p.zScoreExitMax) {
          exitReason = `Funding Z-score normalized to ${funding.zScore30d.toFixed(2)}`;
        }

        // Max funding periods elapsed
        // Approximate: 1H candles / 8 hours per funding period
        sym.fundingPeriodsElapsed = Math.floor(sym.fundingPeriodsElapsed + (1 / 8));
        if (sym.fundingPeriodsElapsed >= p.maxFundingPeriods) {
          exitReason = `Max funding periods (${p.maxFundingPeriods}) elapsed`;
        }

        if (exitReason) {
          signals.push({
            action: 'exit', symbol, confidence: 1, reason: exitReason,
            indicators: { zScore: funding.zScore30d, fundingPeriods: sym.fundingPeriodsElapsed },
          });
          sym.inPosition = null;
          sym.entryPrice = 0;
          sym.fundingPeriodsElapsed = 0;
          this.metrics.signalsEmitted++;
          this.metrics.tradesClosed++;
        }
        continue;
      }

      // ── Entry Short (high positive funding → short to collect) ──
      if (
        funding.zScore30d > p.zScoreEntryThreshold &&
        funding.avg7d > p.avgFundingThreshold &&
        funding.oiChange24hPct > 0 &&
        lastRsi > p.rsiShortMin
      ) {
        const sl = price + lastAtr * p.slAtrMultiplier;
        signals.push({
          action: 'entry_short', symbol, confidence: Math.min(1, funding.zScore30d / 3),
          stopLoss: sl,
          reason: `Funding carry short: Z=${funding.zScore30d.toFixed(2)}, 7dAvg=${(funding.avg7d * 100).toFixed(4)}%, RSI ${lastRsi.toFixed(1)}`,
          indicators: { zScore: funding.zScore30d, avg7d: funding.avg7d, rsi: lastRsi, oiChange: funding.oiChange24hPct },
        });
        sym.inPosition = 'short';
        sym.entryPrice = price;
        sym.entryZScore = funding.zScore30d;
        sym.fundingPeriodsElapsed = 0;
        this.metrics.signalsEmitted++;
        this.metrics.tradesOpened++;
      }

      // ── Entry Long (high negative funding → long to collect) ──
      if (
        funding.zScore30d < -p.zScoreEntryThreshold &&
        funding.avg7d < -p.avgFundingThreshold &&
        funding.oiChange24hPct > 0 &&
        lastRsi < p.rsiLongMax
      ) {
        const sl = price - lastAtr * p.slAtrMultiplier;
        signals.push({
          action: 'entry_long', symbol, confidence: Math.min(1, Math.abs(funding.zScore30d) / 3),
          stopLoss: sl,
          reason: `Funding carry long: Z=${funding.zScore30d.toFixed(2)}, 7dAvg=${(funding.avg7d * 100).toFixed(4)}%, RSI ${lastRsi.toFixed(1)}`,
          indicators: { zScore: funding.zScore30d, avg7d: funding.avg7d, rsi: lastRsi, oiChange: funding.oiChange24hPct },
        });
        sym.inPosition = 'long';
        sym.entryPrice = price;
        sym.entryZScore = funding.zScore30d;
        sym.fundingPeriodsElapsed = 0;
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
    this.fundingData.clear();
    this.signals = {};
    this.metrics = { signalsEmitted: 0, tradesOpened: 0, tradesClosed: 0, winRate: 0, totalPnl: 0 };
    this.status = 'idle';
  }

  private getSymbolState(symbol: string): SymbolState {
    if (!this.state.has(symbol)) {
      this.state.set(symbol, { inPosition: null, entryPrice: 0, fundingPeriodsElapsed: 0, entryZScore: 0 });
    }
    return this.state.get(symbol)!;
  }
}
