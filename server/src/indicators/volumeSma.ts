import { SMA } from 'technicalindicators';
import { Candle, Indicator, IndicatorValue, validateCandles } from './types';

/**
 * Simple moving average of volume.
 * Useful for volume breakout detection in strategies.
 */
export class VolumeSmaIndicator implements Indicator {
  readonly name = 'VOLUME_SMA';
  readonly period: number;

  constructor(period: number = 20) {
    this.period = period;
  }

  calculate(candles: Candle[]): IndicatorValue[] {
    if (!validateCandles(candles, this.period)) return [];

    const values = new SMA({
      period: this.period,
      values: candles.map(c => c.volume),
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
