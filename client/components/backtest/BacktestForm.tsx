'use client';

import { useState, useEffect } from 'react';
import { Play, Settings, Calendar } from 'lucide-react';
import api from '@/lib/api';

export interface BacktestFormData {
  strategyId: string;
  symbol: string;
  interval: string;
  startTime: number;
  endTime: number;
  initialBalance: number;
  leverage: number;
  saveToDb: boolean;
}

interface StrategyOption {
  id: string;
  name: string;
  category: string;
}

interface Props {
  onSubmit: (data: BacktestFormData) => void;
  isRunning: boolean;
}

const INTERVALS = [
  { value: '15', label: '15m' },
  { value: '60', label: '1h' },
  { value: '240', label: '4h' },
  { value: 'D', label: '1D' },
];

export function BacktestForm({ onSubmit, isRunning }: Props) {
  const [strategies, setStrategies] = useState<StrategyOption[]>([]);
  const [strategyId, setStrategyId] = useState('');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState('60');
  const [days, setDays] = useState(90);
  const [initialBalance, setInitialBalance] = useState(10000);
  const [leverage, setLeverage] = useState(1);
  const [saveToDb, setSaveToDb] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    async function loadStrategies() {
      try {
        const res = await api.backtest.getStrategies();
        if (res.data) {
          setStrategies(res.data);
          if (res.data.length > 0 && !strategyId) {
            setStrategyId(res.data[0].id);
          }
        }
      } catch {
        // Strategies may not be loaded yet
      }
    }
    loadStrategies();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    const startTime = now - (days * 24 * 60 * 60 * 1000);
    onSubmit({
      strategyId,
      symbol: symbol.toUpperCase(),
      interval,
      startTime,
      endTime: now,
      initialBalance,
      leverage,
      saveToDb,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
        Run Backtest
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Strategy */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Strategy</label>
          <select
            value={strategyId}
            onChange={e => setStrategyId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
          >
            {strategies.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
            {strategies.length === 0 && <option value="">No strategies</option>}
          </select>
        </div>

        {/* Symbol */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Symbol</label>
          <input
            type="text"
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
            placeholder="BTCUSDT"
          />
        </div>

        {/* Interval */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Interval</label>
          <select
            value={interval}
            onChange={e => setInterval(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
          >
            {INTERVALS.map(i => (
              <option key={i.value} value={i.value}>{i.label}</option>
            ))}
          </select>
        </div>

        {/* Period */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            <Calendar className="inline w-3 h-3 mr-1" />
            Lookback (days)
          </label>
          <input
            type="number"
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            min={7}
            max={365}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
          />
        </div>

        {/* Initial Balance */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Initial Balance ($)</label>
          <input
            type="number"
            value={initialBalance}
            onChange={e => setInitialBalance(Number(e.target.value))}
            min={100}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
          />
        </div>

        {/* Leverage */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Leverage</label>
          <input
            type="number"
            value={leverage}
            onChange={e => setLeverage(Number(e.target.value))}
            min={1}
            max={100}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Advanced Settings */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="mt-3 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
      >
        <Settings className="w-3 h-3" />
        {showAdvanced ? 'Hide' : 'Show'} advanced
      </button>

      {showAdvanced && (
        <div className="mt-3 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={saveToDb}
              onChange={e => setSaveToDb(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600"
            />
            Save results to database
          </label>
        </div>
      )}

      {/* Submit */}
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={isRunning || !strategyId}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Play className="w-4 h-4" />
          {isRunning ? 'Running...' : 'Run Backtest'}
        </button>
      </div>
    </form>
  );
}
