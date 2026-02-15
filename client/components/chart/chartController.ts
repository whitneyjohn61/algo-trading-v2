/**
 * Step 9.2 — Chart Controller
 *
 * Class-based controller (NOT React state) that owns the lightweight-charts instance.
 *
 * Methods:
 *   initialize(container) — create chart + candlestick series
 *   loadData(symbol, interval) — fetch and render initial candles
 *   loadOlderPage() — bidirectional paging
 *   applyRealtimeUpdate(candle) — update last bar or append
 *   setIndicators(configs) — add/remove indicator overlays
 *   setMarkers(markers) — strategy entry/exit markers
 *   setTheme(isDark) — update chart colors
 *   destroy() — clean up
 */

import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  UTCTimestamp,
  CrosshairMode,
  ColorType,
} from 'lightweight-charts';
import { ChartDataManager } from './chartDataManager';
import { IndicatorManager, IndicatorConfig } from './chartIndicators';
import { MarkerManager, TradeMarker } from './chartMarkers';
import { forceVisibleRange, safeResize, updateWithoutRescale } from './chartWorkarounds';

// ── Theme palettes ──

function getChartColors(isDark: boolean) {
  return {
    background: isDark ? '#1e293b' : '#ffffff',
    text: isDark ? '#94a3b8' : '#64748b',
    grid: isDark ? '#334155' : '#f1f5f9',
    border: isDark ? '#334155' : '#e2e8f0',
    upColor: isDark ? '#22c55e' : '#16a34a',
    downColor: isDark ? '#ef4444' : '#dc2626',
    crosshair: isDark ? '#64748b' : '#94a3b8',
  };
}

// ── Controller ──

export class ChartController {
  private chart: IChartApi | null = null;
  private candleSeries: ISeriesApi<'Candlestick'> | null = null;
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private isDark = true;

  readonly dataManager = new ChartDataManager();
  readonly indicatorManager = new IndicatorManager();
  readonly markerManager = new MarkerManager();

  // ── Lifecycle ──

  initialize(container: HTMLElement, isDark: boolean): void {
    this.container = container;
    this.isDark = isDark;
    const c = getChartColors(isDark);

    this.chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight || 500,
      layout: {
        background: { type: ColorType.Solid, color: c.background },
        textColor: c.text,
        fontSize: 12,
      },
      grid: {
        vertLines: { color: c.grid },
        horzLines: { color: c.grid },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: c.border,
        minimumWidth: 80,
      },
      timeScale: {
        borderColor: c.border,
        timeVisible: true,
        secondsVisible: false,
      },
      watermark: { visible: false },
    });

    this.candleSeries = this.chart.addCandlestickSeries({
      upColor: c.upColor,
      downColor: c.downColor,
      borderVisible: false,
      wickUpColor: c.upColor,
      wickDownColor: c.downColor,
    });

    this.indicatorManager.attach(this.chart);
    this.markerManager.attach(this.chart);

    // Resize observer
    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        safeResize(this.chart!, entry.contentRect.width);
      }
    });
    this.resizeObserver.observe(container);
  }

  destroy(): void {
    this.indicatorManager.detach();
    this.markerManager.detach();
    this.dataManager.clear();

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.chart) {
      this.chart.remove();
      this.chart = null;
    }

    this.candleSeries = null;
    this.container = null;
  }

  // ── Data ──

  async loadData(symbol: string, interval: string): Promise<void> {
    if (!this.candleSeries || !this.chart) return;

    const bars = await this.dataManager.loadInitial(symbol, interval);
    // Re-check after async — component may have been destroyed while awaiting
    if (!this.candleSeries || !this.chart) return;
    if (bars.length > 0) {
      this.candleSeries.setData(bars);
      this.indicatorManager.updateAll(bars);
      this.markerManager.render(bars);
      this.chart.timeScale().fitContent();
    }
  }

  async loadOlderPage(): Promise<void> {
    if (!this.candleSeries || !this.chart) return;

    forceVisibleRange(this.chart, async () => {
      const bars = await this.dataManager.loadOlderPage();
      if (bars && bars.length > 0 && this.candleSeries) {
        this.candleSeries.setData(bars);
        this.indicatorManager.updateAll(bars);
        this.markerManager.render(bars);
      }
    });
  }

  applyRealtimeUpdate(candle: { time: number; open: number; high: number; low: number; close: number }): void {
    const bar = this.dataManager.applyRealtimeUpdate(candle);
    updateWithoutRescale(this.candleSeries, bar);
    // Indicators don't need per-tick updates — recalculate on confirmed candle only
  }

  // ── Indicators ──

  setIndicators(configs: IndicatorConfig[]): void {
    const state = this.dataManager.getState();
    this.indicatorManager.applyConfigs(configs, state.bars);
  }

  // ── Markers ──

  setMarkers(markers: TradeMarker[]): void {
    this.markerManager.setMarkers(markers);
    const state = this.dataManager.getState();
    this.markerManager.render(state.bars);
  }

  // ── Theme ──

  setTheme(isDark: boolean): void {
    this.isDark = isDark;
    if (!this.chart || !this.candleSeries) return;

    const c = getChartColors(isDark);

    this.chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: c.background },
        textColor: c.text,
      },
      grid: {
        vertLines: { color: c.grid },
        horzLines: { color: c.grid },
      },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border },
    });

    this.candleSeries.applyOptions({
      upColor: c.upColor,
      downColor: c.downColor,
      wickUpColor: c.upColor,
      wickDownColor: c.downColor,
    });
  }

  // ── Getters ──

  getChart(): IChartApi | null {
    return this.chart;
  }

  isInitialized(): boolean {
    return this.chart !== null;
  }
}
