import { BollingerBands } from 'technicalindicators';
import { Candle, Indicator, BollingerValue, validateCandles } from './types';

export class BollingerIndicator implements Indicator<BollingerValue> {
  readonly name = 'BBANDS';
  readonly period: number;
  private readonly stdDev: number;

  constructor(period: number = 20, stdDev: number = 2) {
    this.period = period;
    this.stdDev = stdDev;
  }

  calculate(candles: Candle[]): BollingerValue[] {
    if (!validateCandles(candles, this.period)) return [];

    const values = new BollingerBands({
      period: this.period,
      stdDev: this.stdDev,
      values: candles.map(c => c.close),
    }).getResult();

    const out: BollingerValue[] = [];
    for (let i = 0; i < values.length; i++) {
      const idx = i + this.period - 1;
      if (idx >= candles.length) break;
      const r = values[i]!;
      out.push({
        timestamp: candles[idx]!.timestamp,
        upper: Number(r.upper.toFixed(2)),
        middle: Number(r.middle.toFixed(2)),
        lower: Number(r.lower.toFixed(2)),
      });
    }
    return out;
  }
}
