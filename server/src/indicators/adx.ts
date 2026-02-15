import { ADX } from 'technicalindicators';
import { Candle, Indicator, IndicatorValue, validateCandles } from './types';

/**
 * Average Directional Index — measures trend strength (0-100).
 *   > 25: trending market (good for trend-following strategies)
 *   < 20: ranging market (good for mean-reversion strategies)
 * Used by strategy selector to route to trend vs mean-reversion.
 */
export class AdxIndicator implements Indicator {
  readonly name = 'ADX';
  readonly period: number;

  constructor(period: number = 14) {
    this.period = period;
  }

  calculate(candles: Candle[]): IndicatorValue[] {
    // ADX needs 2 * period candles to stabilize
    if (!validateCandles(candles, this.period * 2)) return [];

    const values = new ADX({
      period: this.period,
      high: candles.map(c => c.high),
      low: candles.map(c => c.low),
      close: candles.map(c => c.close),
    }).getResult();

    const out: IndicatorValue[] = [];
    for (let i = 0; i < values.length; i++) {
      const idx = candles.length - values.length + i;
      if (idx < 0) continue;
      out.push({
        timestamp: candles[idx]!.timestamp,
        value: Number(values[i]!.adx.toFixed(2)),
      });
    }
    return out;
  }
}
