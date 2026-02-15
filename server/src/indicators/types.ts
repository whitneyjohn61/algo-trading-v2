/**
 * Indicator types — pure calculation interfaces.
 * Chart rendering adapters belong in the client (Phase 9).
 *
 * V2 simplification vs V1:
 *   - Always use number (UTC ms) for timestamps — no TTime generic
 *   - Separate value types for multi-output indicators (Bollinger, StochRSI)
 *   - Interface-based, not abstract class — easier to test/mock
 */

// ── Input ──────────────────────────────────────────────────

export interface Candle {
  timestamp: number; // UTC ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── Output ─────────────────────────────────────────────────

/** Standard single-value indicator output (SMA, EMA, RSI, ATR, etc.) */
export interface IndicatorValue {
  timestamp: number;
  value: number;
}

/** Bollinger Bands output (3 bands per timestamp) */
export interface BollingerValue {
  timestamp: number;
  upper: number;
  middle: number;
  lower: number;
}

/** Stochastic RSI output (K + D lines) */
export interface StochRsiValue {
  timestamp: number;
  k: number;
  d: number;
}

// ── Config ─────────────────────────────────────────────────

export interface IndicatorConfig {
  name: string;
  period: number;
  params?: Record<string, number>;
}

// ── Indicator interface ────────────────────────────────────

/**
 * All indicators implement this interface.
 * Input: array of Candle objects (sorted ascending by timestamp).
 * Output: array of computed values aligned to candle timestamps.
 *
 * For multi-output indicators (Bollinger, StochRSI), use the
 * typed calculate method and cast as needed. The registry uses
 * the generic IndicatorValue[] return type for uniform handling.
 */
export interface Indicator<T = IndicatorValue> {
  readonly name: string;
  readonly period: number;
  calculate(candles: Candle[]): T[];
}

// ── Validation helper ──────────────────────────────────────

/**
 * Validates candle array for indicator calculation.
 * Returns true if the data is usable.
 */
export function validateCandles(candles: Candle[], minLength: number): boolean {
  if (!candles || !Array.isArray(candles) || candles.length < minLength) {
    return false;
  }

  for (const c of candles) {
    if (
      !c ||
      typeof c.timestamp !== 'number' ||
      typeof c.open !== 'number' || isNaN(c.open) ||
      typeof c.high !== 'number' || isNaN(c.high) ||
      typeof c.low !== 'number' || isNaN(c.low) ||
      typeof c.close !== 'number' || isNaN(c.close)
    ) {
      return false;
    }
  }

  // Check timestamps are ascending (gaps OK, backwards not OK)
  for (let i = 1; i < candles.length; i++) {
    if (candles[i]!.timestamp <= candles[i - 1]!.timestamp) {
      return false;
    }
  }

  return true;
}
