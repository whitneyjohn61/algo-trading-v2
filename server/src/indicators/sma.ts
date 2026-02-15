import { SMA } from 'technicalindicators';
import { Candle, Indicator, IndicatorValue, validateCandles } from './types';

export class SmaIndicator implements Indicator {
  readonly name = 'SMA';
  readonly period: number;

  constructor(period: number = 14) {
    this.period = period;
  }

  calculate(candles: Candle[]): IndicatorValue[] {
    if (!validateCandles(candles, this.period)) return [];

    const values = new SMA({
      period: this.period,
      values: candles.map(c => c.close),
    }).getResult();

    const out: IndicatorValue[] = [];
    for (let i = 0; i < values.length; i++) {
      out.push({
        timestamp: candles[i + this.period - 1]!.timestamp,
        value: Number(values[i]!.toFixed(2)),
      });
    }
    return out;
  }
}
