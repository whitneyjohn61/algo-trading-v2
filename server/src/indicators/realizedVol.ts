import { Candle, Indicator, IndicatorValue, validateCandles } from './types';

/**
 * Realized Volatility — annualized standard deviation of log returns.
 * No external library needed — pure math.
 *
 * Used for:
 *   - Position sizing (Kelly criterion / volatility targeting)
 *   - Risk management (dynamic stop-loss)
 *   - Strategy regime filtering (high vs low vol)
 *
 * Annualization assumes 365 trading days (crypto markets are 24/7).
 */
export class RealizedVolIndicator implements Indicator {
  readonly name = 'REALIZED_VOL';
  readonly period: number;

  constructor(period: number = 20) {
    this.period = period;
  }

  calculate(candles: Candle[]): IndicatorValue[] {
    // Need period + 1 candles (period returns from period+1 prices)
    if (!validateCandles(candles, this.period + 1)) return [];

    // Pre-compute log returns
    const logReturns: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1]!.close;
      const curr = candles[i]!.close;
      if (prev <= 0 || curr <= 0) {
        logReturns.push(0);
      } else {
        logReturns.push(Math.log(curr / prev));
      }
    }

    const out: IndicatorValue[] = [];
    const annualizationFactor = Math.sqrt(365);

    for (let i = this.period - 1; i < logReturns.length; i++) {
      // Window of `period` log returns
      const window = logReturns.slice(i - this.period + 1, i + 1);

      // Mean
      let sum = 0;
      for (const r of window) sum += r;
      const mean = sum / window.length;

      // Variance (sample)
      let variance = 0;
      for (const r of window) variance += (r - mean) ** 2;
      variance /= window.length - 1;

      // Annualized realized vol
      const vol = Math.sqrt(variance) * annualizationFactor;

      out.push({
        // logReturns[i] corresponds to candles[i+1]
        timestamp: candles[i + 1]!.timestamp,
        value: Number(vol.toFixed(6)),
      });
    }

    return out;
  }
}
