'use client';

/**
 * Step 9.3 — Chart Component (React wrapper)
 *
 * Thin wrapper around ChartController. Owns:
 *  - Symbol / interval selection
 *  - Theme reactivity
 *  - WebSocket subscription for real-time kline updates
 *  - Indicator toggle controls
 *  - Chart container ref lifecycle
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ChartController } from './chartController';
import { IndicatorConfig, IndicatorType } from './chartIndicators';
import { TradeMarker } from './chartMarkers';
import { useThemeStore } from '@/store/themeStore';
import { useAccountStore } from '@/store/accountStore';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import api from '@/lib/api';
import {
  LineChart, Settings2, TrendingUp, Maximize2, Minimize2,
  ChevronDown, Activity, BarChart2,
} from 'lucide-react';

// ── Default config ──

const DEFAULT_SYMBOL = 'BTCUSDT';
const DEFAULT_INTERVAL = '15';

const INTERVALS = [
  { value: '1', label: '1m' },
  { value: '3', label: '3m' },
  { value: '5', label: '5m' },
  { value: '15', label: '15m' },
  { value: '30', label: '30m' },
  { value: '60', label: '1H' },
  { value: '120', label: '2H' },
  { value: '240', label: '4H' },
  { value: 'D', label: '1D' },
  { value: 'W', label: '1W' },
];

const DEFAULT_INDICATORS: IndicatorConfig[] = [
  { type: 'ema', period: 20, color: '#3b82f6', enabled: false },
  { type: 'ema', period: 50, color: '#f59e0b', enabled: false },
  { type: 'ema', period: 200, color: '#ef4444', enabled: false },
  { type: 'bb', period: 20, enabled: false },
  { type: 'rsi', period: 14, enabled: false },
];

// ── Component ──

export function ChartView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<ChartController | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const { getEffectiveTheme } = useThemeStore();
  const isDark = getEffectiveTheme() === 'dark';

  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [interval, setInterval] = useState(DEFAULT_INTERVAL);
  const [loading, setLoading] = useState(true);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [symbolSearch, setSymbolSearch] = useState('');
  const [showSymbolDropdown, setShowSymbolDropdown] = useState(false);
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(DEFAULT_INDICATORS);
  const [showIndicatorPanel, setShowIndicatorPanel] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Fetch symbol list ──

  useEffect(() => {
    let mounted = true;
    api.market.getSymbols()
      .then((res: any) => {
        if (mounted && Array.isArray(res?.symbols || res)) {
          setSymbols(res?.symbols || res);
        }
      })
      .catch(() => {
        // Fallback symbols
        if (mounted) setSymbols(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT']);
      });
    return () => { mounted = false; };
  }, []);

  // ── Initialize chart controller ──

  useEffect(() => {
    if (!containerRef.current) return;

    const ctrl = new ChartController();
    ctrl.initialize(containerRef.current, isDark);
    controllerRef.current = ctrl;

    return () => {
      ctrl.destroy();
      controllerRef.current = null;
    };
    // Only create/destroy on mount — theme changes use setTheme()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load data on symbol/interval change ──

  useEffect(() => {
    const ctrl = controllerRef.current;
    if (!ctrl?.isInitialized()) return;

    let mounted = true;
    setLoading(true);

    ctrl.loadData(symbol, interval).then(() => {
      if (mounted) {
        setLoading(false);
        ctrl.setIndicators(indicators.filter(i => i.enabled));
      }
    });

    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, interval]);

  // ── Theme reactivity ──

  useEffect(() => {
    controllerRef.current?.setTheme(isDark);
  }, [isDark]);

  // ── Indicator changes ──

  useEffect(() => {
    controllerRef.current?.setIndicators(indicators.filter(i => i.enabled));
  }, [indicators]);

  // ── WebSocket for real-time kline updates ──

  useEffect(() => {
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000';

    try {
      const ws = new WebSocket(`${WS_URL}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'subscribe',
          channel: `kline:${symbol}:${interval}`,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'kline' && msg.data) {
            controllerRef.current?.applyRealtimeUpdate(msg.data);
          }
        } catch { /* ignore */ }
      };

      ws.onerror = () => { /* will auto-close */ };
    } catch { /* WebSocket not available */ }

    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [symbol, interval]);

  // ── Filtered symbols for dropdown ──

  const filteredSymbols = useMemo(() => {
    if (!symbolSearch) return symbols.slice(0, 20);
    const q = symbolSearch.toUpperCase();
    return symbols.filter(s => s.toUpperCase().includes(q)).slice(0, 20);
  }, [symbols, symbolSearch]);

  // ── Indicator toggle ──

  const toggleIndicator = useCallback((type: IndicatorType, period: number) => {
    setIndicators(prev =>
      prev.map(ind =>
        ind.type === type && ind.period === period
          ? { ...ind, enabled: !ind.enabled }
          : ind
      )
    );
  }, []);

  // ── Fullscreen ──

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(v => !v);
    // Give the chart time to resize
    setTimeout(() => {
      const chart = controllerRef.current?.getChart();
      if (chart && containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    }, 50);
  }, []);

  // ── Render ──

  return (
    <div className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-slate-900' : ''}`}>
      {/* Toolbar */}
      <div className="flex items-center flex-wrap gap-2 p-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        {/* Symbol selector */}
        <div className="relative">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
            onClick={() => setShowSymbolDropdown(v => !v)}
          >
            <TrendingUp className="w-4 h-4 text-blue-500" />
            {symbol}
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showSymbolDropdown && (
            <div className="absolute top-full left-0 mt-1 w-52 max-h-64 overflow-y-auto z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl">
              <div className="p-2 border-b border-slate-200 dark:border-slate-700">
                <input
                  type="text"
                  placeholder="Search symbol..."
                  value={symbolSearch}
                  onChange={e => setSymbolSearch(e.target.value)}
                  className="w-full px-2 py-1 text-sm rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              {filteredSymbols.map(s => (
                <button
                  key={s}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors ${
                    s === symbol ? 'bg-blue-50 dark:bg-slate-700 font-semibold text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'
                  }`}
                  onClick={() => {
                    setSymbol(s);
                    setShowSymbolDropdown(false);
                    setSymbolSearch('');
                  }}
                >
                  {s}
                </button>
              ))}
              {filteredSymbols.length === 0 && (
                <div className="px-3 py-2 text-xs text-slate-400">No symbols found</div>
              )}
            </div>
          )}
        </div>

        {/* Interval buttons */}
        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
          {INTERVALS.map(iv => (
            <button
              key={iv.value}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                iv.value === interval
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'
              }`}
              onClick={() => setInterval(iv.value)}
            >
              {iv.label}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Indicator toggle */}
        <button
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            showIndicatorPanel
              ? 'bg-blue-500 text-white border-blue-500'
              : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
          }`}
          onClick={() => setShowIndicatorPanel(v => !v)}
        >
          <Activity className="w-3.5 h-3.5" />
          Indicators
        </button>

        {/* Fullscreen toggle */}
        <button
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Indicator panel */}
      {showIndicatorPanel && (
        <div className="flex items-center flex-wrap gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">Overlays:</span>
          {indicators.filter(i => i.type !== 'rsi').map(ind => (
            <button
              key={`${ind.type}_${ind.period}`}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full border transition-colors ${
                ind.enabled
                  ? 'border-transparent text-white'
                  : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-700'
              }`}
              style={ind.enabled ? { backgroundColor: ind.color || '#3b82f6' } : undefined}
              onClick={() => toggleIndicator(ind.type, ind.period)}
            >
              {ind.type.toUpperCase()} {ind.period}
            </button>
          ))}

          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-2 mr-1">Panes:</span>
          {indicators.filter(i => i.type === 'rsi').map(ind => (
            <button
              key={`${ind.type}_${ind.period}`}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full border transition-colors ${
                ind.enabled
                  ? 'border-transparent text-white'
                  : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-700'
              }`}
              style={ind.enabled ? { backgroundColor: ind.color || '#a855f7' } : undefined}
              onClick={() => toggleIndicator(ind.type, ind.period)}
            >
              {ind.type.toUpperCase()} {ind.period}
            </button>
          ))}
        </div>
      )}

      {/* Chart container */}
      <div className={`relative flex-1 ${isFullscreen ? '' : 'min-h-[500px]'}`}>
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-slate-900/70">
            <LoadingSpinner size="lg" />
          </div>
        )}
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{ minHeight: isFullscreen ? '100%' : '500px' }}
        />
      </div>

      {/* Close symbol dropdown when clicking outside */}
      {showSymbolDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowSymbolDropdown(false);
            setSymbolSearch('');
          }}
        />
      )}
    </div>
  );
}
