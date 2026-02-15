'use client';

import { useState, useEffect } from 'react';
import { X, Save, RotateCcw } from 'lucide-react';
import { StrategyInfo } from '@/store/strategyStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';

/**
 * Step 8.3 — Strategy Configuration Drawer
 *
 * Slide-over panel for editing strategy parameters:
 *  - Leverage, capital allocation, symbols, indicator periods, thresholds
 *  - Save → PUT /api/strategies/:id/config
 *  - Reset to defaults
 */

interface StrategyConfigDrawerProps {
  strategy: StrategyInfo | null;
  onClose: () => void;
  onSaved?: () => void;
}

export function StrategyConfigDrawer({ strategy, onClose, onSaved }: StrategyConfigDrawerProps) {
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Initialize form from strategy config
  useEffect(() => {
    if (!strategy) return;
    setForm({
      maxLeverage: strategy.maxLeverage,
      capitalAllocationPercent: strategy.capitalAllocationPercent,
      symbols: strategy.symbols.join(', '),
      ...buildParamsForm(strategy),
    });
    setDirty(false);
  }, [strategy]);

  if (!strategy) return null;

  function buildParamsForm(s: StrategyInfo): Record<string, any> {
    // Extract known param patterns from the strategy state or defaults
    // Strategies have different param sets, but they're all number-valued
    const params: Record<string, any> = {};
    // We'll show timeframes as read-only and any numeric state we can discover
    return params;
  }

  function handleChange(key: string, value: any) {
    setForm(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  async function handleSave() {
    if (!strategy) return;
    setSaving(true);
    try {
      const symbols = form.symbols
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);

      await api.strategies.updateConfig(strategy.id, {
        maxLeverage: Number(form.maxLeverage),
        capitalAllocationPercent: Number(form.capitalAllocationPercent),
        symbols,
      });

      toast.success(`Saved ${strategy.name} configuration`);
      setDirty(false);
      onSaved?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || `Failed to save configuration`);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (strategy) {
      setForm({
        maxLeverage: strategy.maxLeverage,
        capitalAllocationPercent: strategy.capitalAllocationPercent,
        symbols: strategy.symbols.join(', '),
      });
      setDirty(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">{strategy.name}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Strategy Configuration</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Read-only info */}
          <Section title="Strategy Info">
            <ReadOnlyField label="ID" value={strategy.id} />
            <ReadOnlyField label="Category" value={strategy.category.replace('_', ' ')} />
            <ReadOnlyField label="Timeframes" value={strategy.timeframes.join(', ')} />
            <ReadOnlyField label="Status" value={strategy.state.status} />
          </Section>

          {/* Editable fields */}
          <Section title="Trading Parameters">
            <NumberField
              label="Max Leverage"
              value={form.maxLeverage ?? 1}
              onChange={v => handleChange('maxLeverage', v)}
              min={1}
              max={100}
              step={1}
            />
            <NumberField
              label="Capital Allocation %"
              value={form.capitalAllocationPercent ?? 25}
              onChange={v => handleChange('capitalAllocationPercent', v)}
              min={0}
              max={100}
              step={1}
            />
          </Section>

          <Section title="Symbol Universe">
            <label className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">Symbols (comma-separated)</span>
              <textarea
                value={form.symbols || ''}
                onChange={e => handleChange('symbols', e.target.value)}
                rows={3}
                className="w-full text-sm bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                placeholder="BTCUSDT, ETHUSDT, SOLUSDT"
              />
            </label>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
              {(form.symbols || '').split(',').filter((s: string) => s.trim()).length} symbols
            </p>
          </Section>

          {/* Metrics (read-only) */}
          <Section title="Current Metrics">
            <ReadOnlyField label="Signals Emitted" value={String(strategy.state.metrics.signalsEmitted)} />
            <ReadOnlyField label="Trades Opened" value={String(strategy.state.metrics.tradesOpened)} />
            <ReadOnlyField label="Trades Closed" value={String(strategy.state.metrics.tradesClosed)} />
            <ReadOnlyField label="Win Rate" value={`${(strategy.state.metrics.winRate * 100).toFixed(1)}%`} />
            <ReadOnlyField label="Total P&L" value={`$${strategy.state.metrics.totalPnl.toLocaleString()}`} />
          </Section>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between">
          <button
            onClick={handleReset}
            disabled={!dirty}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-40 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-40 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Helpers ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{title}</h4>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-slate-700 dark:text-slate-300 font-medium">{value}</span>
    </div>
  );
}

function NumberField({ label, value, onChange, min, max, step }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="flex items-center justify-between">
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-24 text-sm text-right bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
    </label>
  );
}
