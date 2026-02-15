import { RSI } from 'technicalindicators';
import { Candle, Indicator, IndicatorValue, validateCandles } from './types';

export class RsiIndicator implements Indicator {
  readonly name = 'RSI';
  readonly period: number;

  constructor(period: number = 14) {
    this.period = period;
  }

  calculate(candles: Candle[]): IndicatorValue[] {
    // RSI needs period + 1 candles minimum
    if (!validateCandles(candles, this.period + 1)) return [];

    // Handle no price change — RSI is 50 (neutral)
    const allSamePrice = candles.every(
      (c, i) => i === 0 || c.close === candles[i - 1]!.close
    );
    if (allSamePrice) {
      return candles.slice(this.period).map(c => ({
        timestamp: c.timestamp,
        value: 50,
      }));
    }

    const values = new RSI({
      period: this.period,
      values: candles.map(c => c.close),
    }).getResult();

    const out: IndicatorValue[] = [];
    for (let i = 0; i < values.length; i++) {
      const idx = i + this.period;
      if (idx >= candles.length) break;
      out.push({
        timestamp: candles[idx]!.timestamp,
        value: Number(values[i]!.toFixed(2)),
      });
    }
    return out;
  }
}
