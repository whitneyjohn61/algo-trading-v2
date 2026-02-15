import { ROC } from 'technicalindicators';
import { Candle, Indicator, IndicatorValue, validateCandles } from './types';

/**
 * Rate of Change — percentage change over N periods.
 * Used for cross-sectional momentum (ranking symbols by recent returns).
 *   ROC = ((close - close_n) / close_n) * 100
 */
export class RocIndicator implements Indicator {
  readonly name = 'ROC';
  readonly period: number;

  constructor(period: number = 14) {
    this.period = period;
  }

  calculate(candles: Candle[]): IndicatorValue[] {
    if (!validateCandles(candles, this.period + 1)) return [];

    const values = new ROC({
      period: this.period,
      values: candles.map(c => c.close),
    }).getResult();

    const out: IndicatorValue[] = [];
    for (let i = 0; i < values.length; i++) {
      const idx = i + this.period;
      if (idx >= candles.length) break;
      out.push({
        timestamp: candles[idx]!.timestamp,
        value: Number(values[i]!.toFixed(4)),
      });
    }
    return out;
  }
}
