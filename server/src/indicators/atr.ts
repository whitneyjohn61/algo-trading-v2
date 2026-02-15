import { ATR } from 'technicalindicators';
import { Candle, Indicator, IndicatorValue, validateCandles } from './types';

export class AtrIndicator implements Indicator {
  readonly name = 'ATR';
  readonly period: number;

  constructor(period: number = 14) {
    this.period = period;
  }

  calculate(candles: Candle[]): IndicatorValue[] {
    if (!validateCandles(candles, this.period + 1)) return [];

    const values = new ATR({
      period: this.period,
      high: candles.map(c => c.high),
      low: candles.map(c => c.low),
      close: candles.map(c => c.close),
    }).getResult();

    const out: IndicatorValue[] = [];
    for (let i = 0; i < values.length; i++) {
      const idx = i + this.period - 1;
      if (idx >= candles.length) break;
      out.push({
        timestamp: candles[idx]!.timestamp,
        // ATR uses higher precision (prices can be fractional)
        value: Number(values[i]!.toFixed(4)),
      });
    }
    return out;
  }
}
