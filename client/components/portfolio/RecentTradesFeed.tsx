'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, X, Clock, Trophy, Target } from 'lucide-react';
import { useTradeStore, Trade } from '@/store/tradeStore';
import api from '@/lib/api';

/**
 * Step 7.5 — Recent Trades Feed
 *
 * Scrollable feed of recent completed trades, newest first.
 * - Green/red arrows for profit/loss
 * - Strategy label per trade
 * - Time filter: 24h, 7d, 30d
 * - Summary at bottom: trade count, W/L, total P&L
 * - Click → trade detail dialog
 */

type TimeFilter = '24h' | '7d' | '30d';

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function pnlColor(n: number): string {
  if (n > 0) return 'text-green-500';
  if (n < 0) return 'text-red-500';
  return 'text-slate-400 dark:text-slate-500';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function RecentTradesFeed() {
  const trades = useTradeStore(s => s.trades);
  const setTrades = useTradeStore(s => s.setTrades);

  const [timeFilter, setTimeFilter] = useState<TimeFilter>('7d');
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch trades on mount and filter change
  const fetchTrades = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.trading.getTrades({ status: 'closed', limit: 100 });
      const fetched = res?.trades || res?.data || [];
      setTrades(fetched);
    } catch {
      // Keep existing store data
    } finally {
      setLoading(false);
    }
  }, [setTrades]);

  useEffect(() => {
    fetchTrades();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter by time
  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff: Record<TimeFilter, number> = {
      '24h': now - 24 * 60 * 60 * 1000,
      '7d': now - 7 * 24 * 60 * 60 * 1000,
      '30d': now - 30 * 24 * 60 * 60 * 1000,
    };
    return trades
      .filter(t => t.status === 'closed' && t.closedAt && new Date(t.closedAt).getTime() >= cutoff[timeFilter])
      .sort((a, b) => new Date(b.closedAt!).getTime() - new Date(a.closedAt!).getTime());
  }, [trades, timeFilter]);

  // Summary
  const summary = useMemo(() => {
    const wins = filtered.filter(t => t.realizedPnl > 0).length;
    const losses = filtered.filter(t => t.realizedPnl < 0).length;
    const totalPnl = filtered.reduce((sum, t) => sum + t.realizedPnl, 0);
    const winRate = filtered.length > 0 ? (wins / filtered.length) * 100 : 0;
    return { count: filtered.length, wins, losses, totalPnl, winRate };
  }, [filtered]);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Recent Trades
          <span className="ml-2 text-xs font-normal text-slate-400 dark:text-slate-500">
            ({summary.count})
          </span>
        </h3>
        <div className="flex gap-1">
          {(['24h', '7d', '30d'] as TimeFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setTimeFilter(f)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                timeFilter === f
                  ? 'bg-primary-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Trade list */}
      <div className="max-h-[400px] overflow-y-auto">
        {loading && filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">Loading trades...</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
            No closed trades in the last {timeFilter}.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {filtered.map(trade => (
              <TradeRow key={trade.id} trade={trade} onClick={() => setSelectedTrade(trade)} />
            ))}
          </div>
        )}
      </div>

      {/* Summary bar */}
      {summary.count > 0 && (
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-2.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex gap-4">
            <span>{summary.count} trades</span>
            <span className="text-green-500">{summary.wins}W</span>
            <span className="text-red-500">{summary.losses}L</span>
            <span>({fmt(summary.winRate, 0)}% WR)</span>
          </div>
          <span className={`font-medium ${pnlColor(summary.totalPnl)}`}>
            {summary.totalPnl >= 0 ? '+' : ''}${fmt(summary.totalPnl)}
          </span>
        </div>
      )}

      {/* Trade Detail Dialog */}
      {selectedTrade && (
        <TradeDetailDialog trade={selectedTrade} onClose={() => setSelectedTrade(null)} />
      )}
    </div>
  );
}

/** Single trade row in the feed */
function TradeRow({ trade, onClick }: { trade: Trade; onClick: () => void }) {
  const isWin = trade.realizedPnl > 0;

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      {/* Direction arrow */}
      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
        isWin ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
      }`}>
        {isWin
          ? <ArrowUpRight className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
          : <ArrowDownRight className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900 dark:text-white">{trade.symbol}</span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
            trade.side === 'long'
              ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
          }`}>
            {trade.side.toUpperCase()}
          </span>
          {trade.strategyName && (
            <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full">
              {trade.strategyName}
            </span>
          )}
        </div>
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          {trade.closedAt ? timeAgo(trade.closedAt) : ''}
          {trade.entryPrice ? ` · Entry $${fmt(trade.entryPrice)}` : ''}
        </div>
      </div>

      {/* P&L */}
      <div className="text-right flex-shrink-0">
        <div className={`text-sm font-medium ${pnlColor(trade.realizedPnl)}`}>
          {trade.realizedPnl >= 0 ? '+' : ''}${fmt(trade.realizedPnl)}
        </div>
      </div>
    </div>
  );
}

/** Trade detail dialog/modal */
function TradeDetailDialog({ trade, onClose }: { trade: Trade; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Dialog header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 dark:text-white">{trade.symbol}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              trade.side === 'long'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
            }`}>
              {trade.side.toUpperCase()}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dialog body */}
        <div className="p-4 space-y-3">
          {/* P&L highlight */}
          <div className={`text-center py-3 rounded-lg ${
            trade.realizedPnl >= 0
              ? 'bg-green-50 dark:bg-green-900/20'
              : 'bg-red-50 dark:bg-red-900/20'
          }`}>
            <div className={`text-2xl font-bold ${pnlColor(trade.realizedPnl)}`}>
              {trade.realizedPnl >= 0 ? '+' : ''}${fmt(trade.realizedPnl)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Realized P&L</div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <DetailItem icon={<Target className="w-3.5 h-3.5" />} label="Entry Price" value={trade.entryPrice ? `$${fmt(trade.entryPrice)}` : 'N/A'} />
            <DetailItem icon={<Trophy className="w-3.5 h-3.5" />} label="Quantity" value={fmt(trade.quantity, 4)} />
            <DetailItem icon={<Clock className="w-3.5 h-3.5" />} label="Opened" value={trade.createdAt ? new Date(trade.createdAt).toLocaleString() : 'N/A'} />
            <DetailItem icon={<Clock className="w-3.5 h-3.5" />} label="Closed" value={trade.closedAt ? new Date(trade.closedAt).toLocaleString() : 'N/A'} />
            {trade.strategyName && (
              <DetailItem label="Strategy" value={trade.strategyName} />
            )}
            <DetailItem label="Leverage" value={`${trade.leverage}x`} />
            <DetailItem label="Type" value={trade.tradeType} />
            <DetailItem label="Exchange" value={trade.exchange} />
          </div>

          {trade.notes && (
            <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/30 rounded-lg p-3">
              <span className="font-medium">Notes:</span> {trade.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailItem({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 mb-0.5">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{value}</div>
    </div>
  );
}
