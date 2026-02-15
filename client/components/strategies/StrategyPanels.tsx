'use client';

import { SortableTable, Column } from '../SortableTable';

/**
 * Step 8.2 — Strategy-Specific Panels
 *
 * Each strategy category has a dedicated data table showing
 * real-time indicator/signal state per symbol.
 *
 * Data comes from the strategy state endpoint, which returns per-symbol indicator snapshots.
 */

// ── Shared types ──

interface SymbolRow {
  symbol: string;
  [key: string]: any;
}

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function signalBadge(signal: string | undefined) {
  if (!signal) return <span className="text-slate-400">—</span>;
  const s = signal.toLowerCase();
  if (s.includes('long') || s.includes('bull') || s === 'buy') {
    return <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">{signal}</span>;
  }
  if (s.includes('short') || s.includes('bear') || s === 'sell') {
    return <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">{signal}</span>;
  }
  if (s.includes('neutral') || s === 'hold') {
    return <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">{signal}</span>;
  }
  return <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{signal}</span>;
}

function trendArrow(val: number | undefined) {
  if (val == null) return <span className="text-slate-400">—</span>;
  if (val > 0) return <span className="text-green-500">▲ {fmt(val, 1)}</span>;
  if (val < 0) return <span className="text-red-500">▼ {fmt(Math.abs(val), 1)}</span>;
  return <span className="text-slate-400">— 0</span>;
}

// ── Panel wrapper ──

function PanelWrapper({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="p-4 pb-2">
        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</h4>
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 1. Trend Following Status Table
// ─────────────────────────────────────────────────────────────

export interface TrendRow extends SymbolRow {
  dailyTrend?: string;
  adx?: number;
  ema4hCross?: string;
  status?: string;
}

export function TrendStatusTable({ data }: { data: TrendRow[] }) {
  const columns: Column<TrendRow>[] = [
    { key: 'symbol', label: 'Symbol', sortable: true, render: r => <span className="font-medium text-slate-900 dark:text-white">{r.symbol}</span> },
    { key: 'dailyTrend', label: 'Daily Trend', sortable: true, render: r => signalBadge(r.dailyTrend) },
    { key: 'adx', label: 'ADX', sortable: true, align: 'right', render: r => <span className={r.adx && r.adx > 25 ? 'text-green-500 font-medium' : 'text-slate-500'}>{fmt(r.adx, 1)}</span> },
    { key: 'ema4hCross', label: '4H EMA Cross', sortable: true, render: r => signalBadge(r.ema4hCross) },
    { key: 'status', label: 'Status', sortable: true, render: r => signalBadge(r.status) },
  ];

  return (
    <PanelWrapper title="Trend Following Status">
      <SortableTable columns={columns} data={data} keyField="symbol" compact emptyMessage="No trend data available" />
    </PanelWrapper>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. Mean Reversion / Scalp Monitor Table
// ─────────────────────────────────────────────────────────────

export interface ScalpRow extends SymbolRow {
  bbPosition?: number;
  rsi7?: number;
  stochRsi?: number;
  volSpike?: boolean;
  ready?: boolean;
}

export function ScalpMonitorTable({ data }: { data: ScalpRow[] }) {
  const columns: Column<ScalpRow>[] = [
    { key: 'symbol', label: 'Symbol', sortable: true, render: r => <span className="font-medium text-slate-900 dark:text-white">{r.symbol}</span> },
    { key: 'bbPosition', label: 'BB Position', sortable: true, align: 'right', render: r => {
      if (r.bbPosition == null) return <span className="text-slate-400">—</span>;
      const color = r.bbPosition > 0.8 ? 'text-red-500' : r.bbPosition < 0.2 ? 'text-green-500' : 'text-slate-500';
      return <span className={color}>{fmt(r.bbPosition, 2)}</span>;
    }},
    { key: 'rsi7', label: 'RSI(7)', sortable: true, align: 'right', render: r => {
      if (r.rsi7 == null) return <span className="text-slate-400">—</span>;
      const color = r.rsi7 > 70 ? 'text-red-500' : r.rsi7 < 30 ? 'text-green-500' : 'text-slate-500';
      return <span className={color}>{fmt(r.rsi7, 1)}</span>;
    }},
    { key: 'stochRsi', label: 'StochRSI', sortable: true, align: 'right', render: r => fmt(r.stochRsi, 2) },
    { key: 'volSpike', label: 'Vol Spike', sortable: true, align: 'center', render: r => r.volSpike ? <span className="text-amber-500 font-medium">YES</span> : <span className="text-slate-400">No</span> },
    { key: 'ready', label: 'Ready', sortable: true, align: 'center', render: r => r.ready ? <span className="text-green-500 font-bold">✓</span> : <span className="text-slate-400">—</span> },
  ];

  return (
    <PanelWrapper title="Mean Reversion / Scalp Monitor">
      <SortableTable columns={columns} data={data} keyField="symbol" compact emptyMessage="No scalp data available" />
    </PanelWrapper>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. Funding Rate Scanner
// ─────────────────────────────────────────────────────────────

export interface FundingRow extends SymbolRow {
  currentRate?: number;
  avg7d?: number;
  zScore?: number;
  oiDelta?: number;
  position?: string;
}

export function FundingRateScanner({ data }: { data: FundingRow[] }) {
  const columns: Column<FundingRow>[] = [
    { key: 'symbol', label: 'Symbol', sortable: true, render: r => <span className="font-medium text-slate-900 dark:text-white">{r.symbol}</span> },
    { key: 'currentRate', label: 'Current Rate', sortable: true, align: 'right', render: r => {
      if (r.currentRate == null) return <span className="text-slate-400">—</span>;
      const color = r.currentRate > 0 ? 'text-green-500' : r.currentRate < 0 ? 'text-red-500' : 'text-slate-500';
      return <span className={color}>{fmt(r.currentRate * 100, 4)}%</span>;
    }},
    { key: 'avg7d', label: '7d Avg', sortable: true, align: 'right', render: r => r.avg7d != null ? `${fmt(r.avg7d * 100, 4)}%` : '—' },
    { key: 'zScore', label: 'Z-Score', sortable: true, align: 'right', render: r => {
      if (r.zScore == null) return <span className="text-slate-400">—</span>;
      const color = Math.abs(r.zScore) > 2 ? 'text-amber-500 font-medium' : 'text-slate-500';
      return <span className={color}>{fmt(r.zScore, 2)}</span>;
    }},
    { key: 'oiDelta', label: 'OI Δ', sortable: true, align: 'right', render: r => trendArrow(r.oiDelta) },
    { key: 'position', label: 'Position', sortable: true, render: r => signalBadge(r.position) },
  ];

  return (
    <PanelWrapper title="Funding Rate Scanner">
      <SortableTable columns={columns} data={data} keyField="symbol" compact emptyMessage="No funding rate data available" />
    </PanelWrapper>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. Cross-Sectional Momentum Ranking Table
// ─────────────────────────────────────────────────────────────

export interface MomentumRow extends SymbolRow {
  rank?: number;
  score?: number;
  roc7d?: number;
  roc14d?: number;
  roc30d?: number;
  position?: string;
}

export function MomentumRankingTable({ data }: { data: MomentumRow[] }) {
  const columns: Column<MomentumRow>[] = [
    { key: 'rank', label: '#', sortable: true, align: 'center', className: 'w-10', render: r => <span className="font-medium text-slate-700 dark:text-slate-300">{r.rank ?? '—'}</span> },
    { key: 'symbol', label: 'Symbol', sortable: true, render: r => <span className="font-medium text-slate-900 dark:text-white">{r.symbol}</span> },
    { key: 'score', label: 'Score', sortable: true, align: 'right', render: r => {
      if (r.score == null) return <span className="text-slate-400">—</span>;
      const color = r.score > 0 ? 'text-green-500' : r.score < 0 ? 'text-red-500' : 'text-slate-500';
      return <span className={`font-medium ${color}`}>{fmt(r.score, 2)}</span>;
    }},
    { key: 'roc7d', label: 'ROC 7d', sortable: true, align: 'right', render: r => trendArrow(r.roc7d) },
    { key: 'roc14d', label: 'ROC 14d', sortable: true, align: 'right', render: r => trendArrow(r.roc14d) },
    { key: 'roc30d', label: 'ROC 30d', sortable: true, align: 'right', render: r => trendArrow(r.roc30d) },
    { key: 'position', label: 'Position', sortable: true, render: r => signalBadge(r.position) },
  ];

  return (
    <PanelWrapper title="Cross-Sectional Momentum Rankings">
      <SortableTable columns={columns} data={data} keyField="symbol" compact emptyMessage="No momentum data available" />
    </PanelWrapper>
  );
}
