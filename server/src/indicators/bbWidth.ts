import { BollingerBands } from 'technicalindicators';
import { Candle, Indicator, IndicatorValue, validateCandles } from './types';

/**
 * Bollinger Band Width — (upper - lower) / middle.
 * Measures volatility expansion/contraction (squeeze detection).
 *   Low BBWidth = squeeze (expect breakout)
 *   High BBWidth = expanded volatility
 * Used by mean-reversion to detect squeeze setups.
 */
export class BbWidthIndicator implements Indicator {
  readonly name = 'BB_WIDTH';
  readonly period: number;
  private readonly stdDev: number;

  constructor(period: number = 20, stdDev: number = 2) {
    this.period = period;
    this.stdDev = stdDev;
  }

  calculate(candles: Candle[]): IndicatorValue[] {
    if (!validateCandles(candles, this.period)) return [];

    const values = new BollingerBands({
      period: this.period,
      stdDev: this.stdDev,
      values: candles.map(c => c.close),
    }).getResult();

    const out: IndicatorValue[] = [];
    for (let i = 0; i < values.length; i++) {
      const idx = i + this.period - 1;
      if (idx >= candles.length) break;
      const r = values[i]!;
      const width = r.middle !== 0 ? (r.upper - r.lower) / r.middle : 0;
      out.push({
        timestamp: candles[idx]!.timestamp,
        value: Number(width.toFixed(6)),
      });
    }
    return out;
  }
}
