import { StochasticRSI } from 'technicalindicators';
import { Candle, Indicator, StochRsiValue, validateCandles } from './types';

/**
 * Stochastic RSI — momentum oscillator of RSI itself.
 * More sensitive than plain RSI for mean-reversion signals.
 *   K < 20: oversold    K > 80: overbought
 *   K crosses above D: bullish   K crosses below D: bearish
 */
export class StochRsiIndicator implements Indicator<StochRsiValue> {
  readonly name = 'STOCH_RSI';
  readonly period: number;
  private readonly kPeriod: number;
  private readonly dPeriod: number;

  constructor(period: number = 14, kPeriod: number = 3, dPeriod: number = 3) {
    this.period = period;
    this.kPeriod = kPeriod;
    this.dPeriod = dPeriod;
  }

  calculate(candles: Candle[]): StochRsiValue[] {
    // Needs RSI warmup + stochastic smoothing
    const minLen = this.period + this.kPeriod + this.dPeriod;
    if (!validateCandles(candles, minLen)) return [];

    const values = new StochasticRSI({
      rsiPeriod: this.period,
      stochasticPeriod: this.period,
      kPeriod: this.kPeriod,
      dPeriod: this.dPeriod,
      values: candles.map(c => c.close),
    }).getResult();

    const out: StochRsiValue[] = [];
    for (let i = 0; i < values.length; i++) {
      const idx = candles.length - values.length + i;
      if (idx < 0) continue;
      const r = values[i]!;
      out.push({
        timestamp: candles[idx]!.timestamp,
        k: Number(r.k.toFixed(2)),
        d: Number(r.d.toFixed(2)),
      });
    }
    return out;
  }
}
