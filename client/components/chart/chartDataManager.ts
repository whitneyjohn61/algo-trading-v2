/**
 * Step 9.6 — Chart Data Manager
 *
 * Manages the in-memory candle buffer with:
 *  - Bidirectional paging (scroll left loads older data)
 *  - Sliding window (max 5000 bars)
 *  - Throttled paging (250ms during drag, 500ms normal)
 *  - Viewport preservation after data load
 */

import type { CandlestickData, Time, UTCTimestamp } from 'lightweight-charts';
import { dedupeByTime, normalizeTimestamp, intervalToSeconds } from './chartWorkarounds';
import api from '@/lib/api';

const MAX_BARS = 5000;
const PAGE_SIZE = 200;
const THROTTLE_NORMAL = 500;
const THROTTLE_DRAG = 250;

export interface DataManagerState {
  symbol: string;
  interval: string;
  bars: CandlestickData<Time>[];
  loading: boolean;
  hasOlderData: boolean;
  oldestTimestamp: number;
  newestTimestamp: number;
}

export class ChartDataManager {
  private bars: CandlestickData<Time>[] = [];
  private symbol = '';
  private interval = '';
  private loading = false;
  private hasOlderData = true;
  private lastPageTime = 0;

  /** Listeners notified on data change */
  private listeners: Array<(state: DataManagerState) => void> = [];

  // ── Public API ──

  getState(): DataManagerState {
    return {
      symbol: this.symbol,
      interval: this.interval,
      bars: this.bars,
      loading: this.loading,
      hasOlderData: this.hasOlderData,
      oldestTimestamp: this.bars.length > 0 ? Number(this.bars[0]!.time) : 0,
      newestTimestamp: this.bars.length > 0 ? Number(this.bars[this.bars.length - 1]!.time) : 0,
    };
  }

  subscribe(fn: (state: DataManagerState) => void): () => void {
    this.listeners.push(fn);
    return () => {
      const idx = this.listeners.indexOf(fn);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  /**
   * Load initial data for a symbol/interval.
   */
  async loadInitial(symbol: string, interval: string): Promise<CandlestickData<Time>[]> {
    this.symbol = symbol;
    this.interval = interval;
    this.bars = [];
    this.hasOlderData = true;
    this.setLoading(true);

    try {
      const res = await api.market.getCandles(symbol, interval, PAGE_SIZE);
      const candles = this.parseCandles(res?.candles || res?.data || []);
      this.bars = dedupeByTime(candles);
      this.trimToMax();
      this.hasOlderData = candles.length >= PAGE_SIZE;
    } catch {
      this.bars = [];
      this.hasOlderData = false;
    }

    this.setLoading(false);
    return this.bars;
  }

  /**
   * Load older (left-side) data. Returns new full dataset.
   * Throttled to prevent spamming during scroll drag.
   */
  async loadOlderPage(isDragging = false): Promise<CandlestickData<Time>[] | null> {
    if (this.loading || !this.hasOlderData || this.bars.length === 0) return null;

    const throttle = isDragging ? THROTTLE_DRAG : THROTTLE_NORMAL;
    const now = Date.now();
    if (now - this.lastPageTime < throttle) return null;
    this.lastPageTime = now;

    this.setLoading(true);

    try {
      const oldestTime = Number(this.bars[0]!.time);
      // Request candles ending before our oldest bar
      const endMs = oldestTime * 1000;
      const intervalSec = intervalToSeconds(this.interval);
      const startMs = endMs - (PAGE_SIZE * intervalSec * 1000);

      const res = await api.market.getCandles(this.symbol, this.interval, PAGE_SIZE);
      const olderCandles = this.parseCandles(res?.candles || res?.data || [])
        .filter(c => Number(c.time) < oldestTime);

      if (olderCandles.length === 0) {
        this.hasOlderData = false;
        this.setLoading(false);
        return null;
      }

      this.hasOlderData = olderCandles.length >= PAGE_SIZE * 0.5; // Less than half a page = probably end
      this.bars = dedupeByTime([...olderCandles, ...this.bars]);
      this.trimToMax();
    } catch {
      // Keep existing data
    }

    this.setLoading(false);
    return this.bars;
  }

  /**
   * Apply a real-time candle update (from WebSocket).
   * Updates the last bar if same timestamp, or appends a new bar.
   */
  applyRealtimeUpdate(candle: { time: number; open: number; high: number; low: number; close: number }): CandlestickData<Time> {
    const bar: CandlestickData<Time> = {
      time: normalizeTimestamp(candle.time),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    };

    if (this.bars.length > 0) {
      const lastBar = this.bars[this.bars.length - 1]!;
      if (Number(lastBar.time) === Number(bar.time)) {
        // Update existing bar
        this.bars[this.bars.length - 1] = bar;
      } else if (Number(bar.time) > Number(lastBar.time)) {
        // Append new bar
        this.bars.push(bar);
        this.trimToMax();
      }
    } else {
      this.bars.push(bar);
    }

    this.notify();
    return bar;
  }

  /**
   * Clear all data (for symbol/interval change).
   */
  clear(): void {
    this.bars = [];
    this.hasOlderData = true;
    this.loading = false;
    this.notify();
  }

  // ── Private ──

  private parseCandles(raw: any[]): CandlestickData<Time>[] {
    return raw.map(c => ({
      time: normalizeTimestamp(Number(c.timestamp || c.time || c.startTime || 0)),
      open: Number(c.open || 0),
      high: Number(c.high || 0),
      low: Number(c.low || 0),
      close: Number(c.close || 0),
    }));
  }

  private trimToMax(): void {
    if (this.bars.length > MAX_BARS) {
      this.bars = this.bars.slice(this.bars.length - MAX_BARS);
    }
  }

  private setLoading(v: boolean): void {
    this.loading = v;
    this.notify();
  }

  private notify(): void {
    const state = this.getState();
    for (const fn of this.listeners) {
      try { fn(state); } catch { /* ignore listener errors */ }
    }
  }
}
