'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, LineData, Time, AreaData } from 'lightweight-charts';
import { useThemeStore } from '@/store/themeStore';
import { usePortfolioStore, EquityCurvePoint } from '@/store/portfolioStore';
import api from '@/lib/api';

/**
 * Step 7.2 — Equity Curve Chart
 *
 * lightweight-charts area chart showing portfolio equity over time.
 * - Time range buttons: 1W, 1M, 3M, 6M, 1Y, ALL
 * - Drawdown area below peak line
 * - Auto-refreshes when portfolio store updates
 */

type RangeKey = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: '1W', label: '1W', days: 7 },
  { key: '1M', label: '1M', days: 30 },
  { key: '3M', label: '3M', days: 90 },
  { key: '6M', label: '6M', days: 180 },
  { key: '1Y', label: '1Y', days: 365 },
  { key: 'ALL', label: 'ALL', days: 0 },
];

export function EquityCurveChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const equitySeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const drawdownSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const [selectedRange, setSelectedRange] = useState<RangeKey>('1M');
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState<EquityCurvePoint[]>([]);

  const { getEffectiveTheme } = useThemeStore();
  const equityCurve = usePortfolioStore(s => s.equityCurve);
  const setEquityCurve = usePortfolioStore(s => s.setEquityCurve);

  const isDark = getEffectiveTheme() === 'dark';

  // ── Fetch equity curve data ──

  const fetchData = useCallback(async (range: RangeKey) => {
    setLoading(true);
    try {
      const rangeConf = RANGES.find(r => r.key === range)!;
      const from = rangeConf.days > 0
        ? Date.now() - rangeConf.days * 24 * 60 * 60 * 1000
        : undefined;
      const res = await api.portfolio.getEquityCurve(from, undefined, 1000);
      const points: EquityCurvePoint[] = (res?.curve || res?.data || []).map((p: any) => ({
        timestamp: Number(p.timestamp || p.time),
        equity: Number(p.equity || p.value || 0),
        drawdownPct: Number(p.drawdownPct || p.drawdown_pct || 0),
      }));
      setEquityCurve(points);
      setChartData(points);
    } catch {
      // Use whatever is in the store
      setChartData(equityCurve);
    } finally {
      setLoading(false);
    }
  }, [equityCurve, setEquityCurve]);

  useEffect(() => {
    fetchData(selectedRange);
  }, [selectedRange]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Chart creation / theme update ──

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 320,
      layout: {
        background: { color: isDark ? '#1e293b' : '#ffffff' },
        textColor: isDark ? '#94a3b8' : '#64748b',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: isDark ? '#334155' : '#f1f5f9' },
        horzLines: { color: isDark ? '#334155' : '#f1f5f9' },
      },
      crosshair: {
        mode: 0, // Normal
      },
      rightPriceScale: {
        borderColor: isDark ? '#334155' : '#e2e8f0',
      },
      timeScale: {
        borderColor: isDark ? '#334155' : '#e2e8f0',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const equitySeries = chart.addAreaSeries({
      lineColor: '#3b82f6',
      topColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.15)',
      bottomColor: isDark ? 'rgba(59, 130, 246, 0.02)' : 'rgba(59, 130, 246, 0.01)',
      lineWidth: 2,
      priceFormat: { type: 'custom', formatter: (p: number) => '$' + p.toLocaleString(undefined, { maximumFractionDigits: 0 }) },
    });

    const drawdownSeries = chart.addLineSeries({
      color: '#ef4444',
      lineWidth: 1,
      lineStyle: 2, // dashed
      priceScaleId: 'drawdown',
      priceFormat: { type: 'custom', formatter: (p: number) => p.toFixed(1) + '%' },
    });

    chart.priceScale('drawdown').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      borderVisible: false,
    });

    chartRef.current = chart;
    equitySeriesRef.current = equitySeries;
    drawdownSeriesRef.current = drawdownSeries;

    // Resize handler
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      equitySeriesRef.current = null;
      drawdownSeriesRef.current = null;
    };
  }, [isDark]);

  // ── Update chart data ──

  useEffect(() => {
    if (!equitySeriesRef.current || !drawdownSeriesRef.current || chartData.length === 0) return;

    const equityData: AreaData<Time>[] = chartData.map(p => ({
      time: (p.timestamp / 1000) as Time,
      value: p.equity,
    }));

    const ddData: LineData<Time>[] = chartData.map(p => ({
      time: (p.timestamp / 1000) as Time,
      value: -p.drawdownPct, // Negative so it hangs below
    }));

    equitySeriesRef.current.setData(equityData);
    drawdownSeriesRef.current.setData(ddData);

    chartRef.current?.timeScale().fitContent();
  }, [chartData]);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Equity Curve</h3>
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setSelectedRange(r.key)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                selectedRange === r.key
                  ? 'bg-primary-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-800/50 z-10">
            <div className="text-xs text-slate-400">Loading...</div>
          </div>
        )}
        {chartData.length === 0 && !loading ? (
          <div className="h-[320px] flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
            No equity data available yet. Data will appear after first portfolio snapshot.
          </div>
        ) : (
          <div ref={containerRef} className="h-[320px]" />
        )}
      </div>
    </div>
  );
}
