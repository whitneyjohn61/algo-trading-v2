import { Indicator, IndicatorValue } from './types';
import { SmaIndicator } from './sma';
import { EmaIndicator } from './ema';
import { RsiIndicator } from './rsi';
import { AtrIndicator } from './atr';
import { BollingerIndicator } from './bollinger';
import { VolumeSmaIndicator } from './volumeSma';
import { AdxIndicator } from './adx';
import { StochRsiIndicator } from './stochRsi';
import { RocIndicator } from './roc';
import { BbWidthIndicator } from './bbWidth';
import { RealizedVolIndicator } from './realizedVol';

// ── Factory map ────────────────────────────────────────────

type IndicatorFactory = (period?: number, ...args: number[]) => Indicator<any>;

const factories: Record<string, IndicatorFactory> = {
  SMA:          (p) => new SmaIndicator(p),
  EMA:          (p) => new EmaIndicator(p),
  RSI:          (p) => new RsiIndicator(p),
  ATR:          (p) => new AtrIndicator(p),
  BBANDS:       (p, stdDev) => new BollingerIndicator(p, stdDev),
  VOLUME_SMA:   (p) => new VolumeSmaIndicator(p),
  ADX:          (p) => new AdxIndicator(p),
  STOCH_RSI:    (p, k, d) => new StochRsiIndicator(p, k, d),
  ROC:          (p) => new RocIndicator(p),
  BB_WIDTH:     (p, stdDev) => new BbWidthIndicator(p, stdDev),
  REALIZED_VOL: (p) => new RealizedVolIndicator(p),
};

// ── Public API ─────────────────────────────────────────────

/**
 * Create an indicator by name.
 * Throws if name is not registered.
 */
export function createIndicator(
  name: string,
  period?: number,
  ...params: number[]
): Indicator<any> {
  const factory = factories[name];
  if (!factory) {
    throw new Error(`Unknown indicator: ${name}. Available: ${getAvailableIndicators().join(', ')}`);
  }
  return factory(period, ...params);
}

/** List all registered indicator names. */
export function getAvailableIndicators(): string[] {
  return Object.keys(factories);
}

/** Check if an indicator name is registered. */
export function isIndicatorAvailable(name: string): boolean {
  return name in factories;
}

/**
 * Convenience: create an indicator and immediately calculate values.
 * Returns IndicatorValue[] (single-value indicators) or typed array for multi-output.
 */
export function computeIndicator(
  name: string,
  candles: import('./types').Candle[],
  period?: number,
  ...params: number[]
): IndicatorValue[] {
  const indicator = createIndicator(name, period, ...params);
  return indicator.calculate(candles) as IndicatorValue[];
}
