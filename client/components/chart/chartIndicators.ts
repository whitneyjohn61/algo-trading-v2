/**
 * Step 9.4 — Chart Indicators
 *
 * Series management for overlay and pane indicators:
 *  - Overlays: EMA, Bollinger Bands (on main price scale)
 *  - Panes: RSI (separate price scale)
 *  - Add/remove based on config
 */

import type { IChartApi, ISeriesApi, LineData, Time, UTCTimestamp, CandlestickData } from 'lightweight-charts';
import { dedupeByTime } from './chartWorkarounds';

// ── Types ──

export type IndicatorType = 'ema' | 'bb' | 'rsi';

export interface IndicatorConfig {
  type: IndicatorType;
  period: number;
  color?: string;
  enabled: boolean;
}

interface IndicatorSeries {
  config: IndicatorConfig;
  series: ISeriesApi<'Line'>[];
}

const DEFAULT_COLORS: Record<IndicatorType, string[]> = {
  ema: ['#3b82f6'],
  bb: ['#f59e0b', '#f59e0b80', '#f59e0b'], // upper, middle (dimmed), lower
  rsi: ['#a855f7'],
};

// ── Indicator Manager ──

export class IndicatorManager {
  private chart: IChartApi | null = null;
  private indicators: Map<string, IndicatorSeries> = new Map();

  attach(chart: IChartApi): void {
    this.chart = chart;
  }

  detach(): void {
    this.removeAll();
    this.chart = null;
  }

  /**
   * Apply a set of indicator configs. Adds new, removes old, updates changed.
   */
  applyConfigs(configs: IndicatorConfig[], bars: CandlestickData<Time>[]): void {
    if (!this.chart) return;

    // Remove indicators no longer in configs
    const configKeys = new Set(configs.filter(c => c.enabled).map(c => this.key(c)));
    const keysToRemove: string[] = [];
    this.indicators.forEach((ind, key) => {
      if (!configKeys.has(key)) {
        this.removeSeries(ind);
        keysToRemove.push(key);
      }
    });
    keysToRemove.forEach(k => this.indicators.delete(k));

    // Add or update
    for (const cfg of configs) {
      if (!cfg.enabled) continue;
      const k = this.key(cfg);
      if (!this.indicators.has(k)) {
        this.addIndicator(cfg, bars);
      } else {
        this.updateData(k, bars);
      }
    }
  }

  /**
   * Update all indicator data (e.g., after new candles loaded).
   */
  updateAll(bars: CandlestickData<Time>[]): void {
    this.indicators.forEach((_ind, key) => {
      this.updateData(key, bars);
    });
  }

  removeAll(): void {
    this.indicators.forEach(ind => {
      this.removeSeries(ind);
    });
    this.indicators.clear();
  }

  // ── Private ──

  private key(cfg: IndicatorConfig): string {
    return `${cfg.type}_${cfg.period}`;
  }

  private addIndicator(cfg: IndicatorConfig, bars: CandlestickData<Time>[]): void {
    if (!this.chart) return;
    const k = this.key(cfg);
    const colors = cfg.color ? [cfg.color] : DEFAULT_COLORS[cfg.type];

    switch (cfg.type) {
      case 'ema': {
        const series = this.chart.addLineSeries({
          color: colors[0],
          lineWidth: 1,
          title: `EMA ${cfg.period}`,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        const data = calculateEMA(bars, cfg.period);
        series.setData(data);
        this.indicators.set(k, { config: cfg, series: [series] });
        break;
      }

      case 'bb': {
        const upper = this.chart.addLineSeries({
          color: colors[0] || '#f59e0b',
          lineWidth: 1,
          title: `BB ${cfg.period} Upper`,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        const middle = this.chart.addLineSeries({
          color: colors[1] || '#f59e0b80',
          lineWidth: 1,
          lineStyle: 2,
          title: `BB ${cfg.period} Mid`,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        const lower = this.chart.addLineSeries({
          color: colors[2] || colors[0] || '#f59e0b',
          lineWidth: 1,
          title: `BB ${cfg.period} Lower`,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        const bb = calculateBB(bars, cfg.period);
        upper.setData(bb.upper);
        middle.setData(bb.middle);
        lower.setData(bb.lower);
        this.indicators.set(k, { config: cfg, series: [upper, middle, lower] });
        break;
      }

      case 'rsi': {
        const series = this.chart.addLineSeries({
          color: colors[0] || '#a855f7',
          lineWidth: 1,
          title: `RSI ${cfg.period}`,
          priceScaleId: 'rsi',
          priceLineVisible: false,
          lastValueVisible: true,
        });
        this.chart.priceScale('rsi').applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
          borderVisible: false,
        });
        const data = calculateRSI(bars, cfg.period);
        series.setData(data);
        this.indicators.set(k, { config: cfg, series: [series] });
        break;
      }
    }
  }

  private updateData(key: string, bars: CandlestickData<Time>[]): void {
    const ind = this.indicators.get(key);
    if (!ind) return;

    switch (ind.config.type) {
      case 'ema': {
        const data = calculateEMA(bars, ind.config.period);
        ind.series[0]?.setData(data);
        break;
      }
      case 'bb': {
        const bb = calculateBB(bars, ind.config.period);
        ind.series[0]?.setData(bb.upper);
        ind.series[1]?.setData(bb.middle);
        ind.series[2]?.setData(bb.lower);
        break;
      }
      case 'rsi': {
        const data = calculateRSI(bars, ind.config.period);
        ind.series[0]?.setData(data);
        break;
      }
    }
  }

  private removeSeries(ind: IndicatorSeries): void {
    if (!this.chart) return;
    for (const s of ind.series) {
      try { this.chart.removeSeries(s); } catch { /* already removed */ }
    }
  }
}

// ── Pure indicator calculations ──
// Client-side calculations for chart display. These use closing prices from the
// already-loaded candle buffer — no server round-trip needed.

function calculateEMA(bars: CandlestickData<Time>[], period: number): LineData<Time>[] {
  if (bars.length < period) return [];
  const k = 2 / (period + 1);
  const result: LineData<Time>[] = [];

  // Seed with SMA of first `period` bars
  let sum = 0;
  for (let i = 0; i < period; i++) sum += bars[i]!.close;
  let ema = sum / period;
  result.push({ time: bars[period - 1]!.time, value: ema });

  for (let i = period; i < bars.length; i++) {
    ema = bars[i]!.close * k + ema * (1 - k);
    result.push({ time: bars[i]!.time, value: ema });
  }
  return result;
}

function calculateBB(bars: CandlestickData<Time>[], period: number, mult = 2): { upper: LineData<Time>[]; middle: LineData<Time>[]; lower: LineData<Time>[] } {
  const upper: LineData<Time>[] = [];
  const middle: LineData<Time>[] = [];
  const lower: LineData<Time>[] = [];

  for (let i = period - 1; i < bars.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += bars[j]!.close;
    const sma = sum / period;

    let sqSum = 0;
    for (let j = i - period + 1; j <= i; j++) sqSum += (bars[j]!.close - sma) ** 2;
    const std = Math.sqrt(sqSum / period);

    const t = bars[i]!.time;
    upper.push({ time: t, value: sma + mult * std });
    middle.push({ time: t, value: sma });
    lower.push({ time: t, value: sma - mult * std });
  }
  return { upper, middle, lower };
}

function calculateRSI(bars: CandlestickData<Time>[], period: number): LineData<Time>[] {
  if (bars.length < period + 1) return [];

  const result: LineData<Time>[] = [];
  let gainSum = 0;
  let lossSum = 0;

  // Initial avg gain/loss
  for (let i = 1; i <= period; i++) {
    const delta = bars[i]!.close - bars[i - 1]!.close;
    if (delta > 0) gainSum += delta;
    else lossSum += Math.abs(delta);
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  let rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  result.push({ time: bars[period]!.time, value: rsi });

  // Smoothed subsequent values
  for (let i = period + 1; i < bars.length; i++) {
    const delta = bars[i]!.close - bars[i - 1]!.close;
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? Math.abs(delta) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    result.push({ time: bars[i]!.time, value: rsi });
  }
  return result;
}
