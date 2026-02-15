/**
 * Step 9.5 — Chart Markers
 *
 * Strategy signal markers (entry/exit) on the chart.
 *  - Simple markers — no P&L on hover, no flash markers
 *  - Sorted by time (required by lightweight-charts)
 *  - Applied to an invisible overlay series (renders on top of indicators)
 */

import type { IChartApi, ISeriesApi, CandlestickData, Time, SeriesMarker, UTCTimestamp } from 'lightweight-charts';

// ── Types ──

export interface TradeMarker {
  time: number;           // UTC seconds
  type: 'entry' | 'exit';
  side: 'long' | 'short';
  symbol: string;
  strategy?: string;
  price?: number;
  text?: string;
}

// ── Marker Manager ──

export class MarkerManager {
  private chart: IChartApi | null = null;
  private overlaySeries: ISeriesApi<'Line'> | null = null;
  private markers: TradeMarker[] = [];

  attach(chart: IChartApi): void {
    this.chart = chart;
  }

  detach(): void {
    if (this.chart && this.overlaySeries) {
      try { this.chart.removeSeries(this.overlaySeries); } catch { /* ok */ }
    }
    this.overlaySeries = null;
    this.chart = null;
    this.markers = [];
  }

  /**
   * Set the full list of trade markers. Call after data loads or markers change.
   */
  setMarkers(markers: TradeMarker[]): void {
    this.markers = markers;
  }

  /**
   * Render markers on the chart. Must be called after candle data is set
   * so the overlay series can be sized correctly.
   */
  render(bars: CandlestickData<Time>[]): void {
    if (!this.chart || bars.length === 0) return;

    // Ensure overlay series exists
    if (!this.overlaySeries) {
      this.overlaySeries = this.chart.addLineSeries({
        color: 'transparent',
        lineVisible: false,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
      });
    }

    // Set overlay data (close prices so markers scale with candles)
    const overlayData = bars.map(b => ({ time: b.time, value: b.close }));
    this.overlaySeries.setData(overlayData);

    if (this.markers.length === 0) {
      this.overlaySeries.setMarkers([]);
      return;
    }

    // Filter markers to visible data range
    const firstTime = Number(bars[0]!.time);
    const lastTime = Number(bars[bars.length - 1]!.time);

    const chartMarkers: SeriesMarker<Time>[] = this.markers
      .filter(m => m.time >= firstTime && m.time <= lastTime)
      .map(m => this.toChartMarker(m))
      .sort((a, b) => Number(a.time) - Number(b.time));

    this.overlaySeries.setMarkers(chartMarkers);
  }

  // ── Private ──

  private toChartMarker(m: TradeMarker): SeriesMarker<Time> {
    const isEntry = m.type === 'entry';
    const isLong = m.side === 'long';

    let shape: 'arrowUp' | 'arrowDown' | 'circle';
    let position: 'belowBar' | 'aboveBar';
    let color: string;

    if (isEntry) {
      shape = isLong ? 'arrowUp' : 'arrowDown';
      position = isLong ? 'belowBar' : 'aboveBar';
      color = isLong ? '#22c55e' : '#ef4444';
    } else {
      // Exit — opposite direction
      shape = isLong ? 'arrowDown' : 'arrowUp';
      position = isLong ? 'aboveBar' : 'belowBar';
      color = '#3b82f6';
    }

    const text = m.text || `${m.type.toUpperCase()} ${m.side.toUpperCase()}${m.strategy ? ` (${m.strategy})` : ''}`;

    return {
      time: m.time as UTCTimestamp as Time,
      position,
      color,
      shape,
      text,
    };
  }
}
