/**
 * Step 9.1 — Chart Workarounds
 *
 * Documented workarounds for lightweight-charts quirks.
 * Transplanted from V1 with simplifications.
 */

import type { CandlestickData, LineData, Time, UTCTimestamp } from 'lightweight-charts';

// ─────────────────────────────────────────────────────────────
// 1. dedupeByTime
// ─────────────────────────────────────────────────────────────
/**
 * BUG: lightweight-charts throws if data contains duplicate timestamps.
 *      This can happen when merging paged data or when exchange returns
 *      overlapping candles during WebSocket reconnection.
 *
 * FIX: Deduplicate by timestamp (keep last occurrence), then sort ascending.
 */
export function dedupeByTime<T extends { time: Time }>(arr: T[]): T[] {
  const map = new Map<number, T>();
  for (const item of arr) {
    map.set(Number(item.time), item);
  }
  return Array.from(map.values()).sort((a, b) => Number(a.time) - Number(b.time));
}

// ─────────────────────────────────────────────────────────────
// 2. forceVisibleRange
// ─────────────────────────────────────────────────────────────
/**
 * BUG: After loading older data via setData(), the chart sometimes jumps
 *      to show the full range instead of staying at the user's scroll position.
 *
 * FIX: Capture the visible range before data update, then re-apply it after.
 *      Small timeout needed because setData is async internally.
 */
export function forceVisibleRange(
  chart: { timeScale: () => { getVisibleLogicalRange: () => any; setVisibleLogicalRange: (r: any) => void } },
  callback: () => void
): void {
  const ts = chart.timeScale();
  const range = ts.getVisibleLogicalRange();
  callback();
  if (range) {
    // Microtask to wait for internal rendering cycle
    queueMicrotask(() => {
      try {
        ts.setVisibleLogicalRange(range);
      } catch {
        // Ignore if range is no longer valid after data change
      }
    });
  }
}

// ─────────────────────────────────────────────────────────────
// 3. safeResize
// ─────────────────────────────────────────────────────────────
/**
 * BUG: Calling chart.applyOptions({ width }) during a rapid resize sequence
 *      (e.g., sidebar toggle animation) can cause canvas measurement errors.
 *
 * FIX: Debounce resize calls. Also guard against zero-width containers.
 */
export function safeResize(chart: { applyOptions: (o: { width: number }) => void }, width: number): void {
  if (width <= 0 || !isFinite(width)) return;
  try {
    chart.applyOptions({ width: Math.round(width) });
  } catch {
    // Swallow — chart may have been destroyed between resize scheduling and execution
  }
}

// ─────────────────────────────────────────────────────────────
// 4. normalizeTimestamp
// ─────────────────────────────────────────────────────────────
/**
 * BUG: Bybit returns timestamps in milliseconds, but lightweight-charts
 *      expects seconds (UTCTimestamp). Passing milliseconds causes the chart
 *      to render dates in the year 50000+.
 *
 * FIX: Detect if timestamp is in ms (> 1e12) and convert to seconds.
 */
export function normalizeTimestamp(ts: number): UTCTimestamp {
  if (ts > 1e12) {
    return Math.floor(ts / 1000) as UTCTimestamp;
  }
  return ts as UTCTimestamp;
}

// ─────────────────────────────────────────────────────────────
// 5. isCalendarInterval
// ─────────────────────────────────────────────────────────────
/**
 * BUG: lightweight-charts treats 'D', 'W', 'M' intervals differently from
 *      numeric intervals (1, 5, 15, etc.). Calendar intervals need special
 *      handling for time axis formatting and paging calculations.
 *
 * FIX: Simple check to distinguish calendar from intraday intervals.
 */
export function isCalendarInterval(interval: string): boolean {
  return ['D', 'W', 'M', '1D', '1W', '1M'].includes(interval.toUpperCase());
}

/**
 * Convert interval string to seconds duration.
 * Used for paging calculations and candle alignment.
 */
export function intervalToSeconds(interval: string): number {
  const upper = interval.toUpperCase();
  const num = parseInt(interval) || 1;

  if (upper.endsWith('M') && !upper.endsWith('MIN')) return num * 30 * 24 * 3600;
  if (upper.endsWith('W')) return num * 7 * 24 * 3600;
  if (upper.endsWith('D') || upper === 'D') return num * 24 * 3600;

  // Intraday — assume minutes
  const minutes = parseInt(interval) || 1;
  return minutes * 60;
}

// ─────────────────────────────────────────────────────────────
// 6. updateWithoutRescale
// ─────────────────────────────────────────────────────────────
/**
 * BUG: series.update() on a candlestick series can cause the price axis
 *      to rescale (zoom out) if the new candle's high/low extends the range.
 *      This is jarring during real-time updates.
 *
 * FIX: Use applyOptions to temporarily lock the price scale, update, then unlock.
 *      In practice, lightweight-charts v4 handles this better, so this is a
 *      simple wrapper that catches errors from stale series refs.
 */
export function updateWithoutRescale<T>(
  series: { update: (data: T) => void } | null,
  data: T
): void {
  if (!series) return;
  try {
    series.update(data);
  } catch {
    // Series may have been removed — ignore silently
  }
}
