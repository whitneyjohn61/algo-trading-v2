'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trash2, Eye, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface RunRow {
  id: number;
  strategy: string;
  symbol: string;
  interval: string;
  initial_balance: number;
  final_balance: number;
  total_return: number;
  total_trades: number;
  win_rate: number;
  max_drawdown: number;
  sharpe_ratio: number;
  created_at: string;
}

interface Props {
  refreshTrigger?: number;
  onViewRun?: (runId: number) => void;
}

export function SavedRunsTable({ refreshTrigger, onViewRun }: Props) {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.backtest.listRuns();
      if (res.data) {
        setRuns(res.data);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRuns();
  }, [loadRuns, refreshTrigger]);

  const handleDelete = async (id: number) => {
    try {
      await api.backtest.deleteRun(id);
      setRuns(prev => prev.filter(r => r.id !== id));
      toast.success('Run deleted');
    } catch {
      toast.error('Failed to delete run');
    }
  };

  if (runs.length === 0 && !loading) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Saved Runs ({runs.length})
        </h3>
        <button onClick={loadRuns} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 px-2 font-medium text-slate-500 dark:text-slate-400">Strategy</th>
              <th className="text-left py-2 px-2 font-medium text-slate-500 dark:text-slate-400">Symbol</th>
              <th className="text-right py-2 px-2 font-medium text-slate-500 dark:text-slate-400">Return</th>
              <th className="text-right py-2 px-2 font-medium text-slate-500 dark:text-slate-400">Trades</th>
              <th className="text-right py-2 px-2 font-medium text-slate-500 dark:text-slate-400">Win Rate</th>
              <th className="text-right py-2 px-2 font-medium text-slate-500 dark:text-slate-400">Sharpe</th>
              <th className="text-right py-2 px-2 font-medium text-slate-500 dark:text-slate-400">Date</th>
              <th className="text-right py-2 px-2 font-medium text-slate-500 dark:text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {runs.map(r => (
              <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="py-1.5 px-2 text-slate-700 dark:text-slate-300">{r.strategy}</td>
                <td className="py-1.5 px-2 text-slate-700 dark:text-slate-300">{r.symbol}</td>
                <td className={`py-1.5 px-2 text-right font-medium ${r.total_return >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                  {r.total_return >= 0 ? '+' : ''}{Number(r.total_return).toFixed(1)}%
                </td>
                <td className="py-1.5 px-2 text-right text-slate-600 dark:text-slate-400">{r.total_trades}</td>
                <td className="py-1.5 px-2 text-right text-slate-600 dark:text-slate-400">{(Number(r.win_rate) * 100).toFixed(0)}%</td>
                <td className="py-1.5 px-2 text-right text-slate-600 dark:text-slate-400">{Number(r.sharpe_ratio).toFixed(2)}</td>
                <td className="py-1.5 px-2 text-right text-slate-500 dark:text-slate-500">
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
                <td className="py-1.5 px-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {onViewRun && (
                      <button
                        onClick={() => onViewRun(r.id)}
                        className="p-1 text-slate-400 hover:text-primary-500"
                        title="View details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="p-1 text-slate-400 hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
