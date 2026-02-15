'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { BacktestForm } from './BacktestForm';
import { BacktestResults } from './BacktestResults';
import { SavedRunsTable } from './SavedRunsTable';
import type { BacktestFormData } from './BacktestForm';

export function BacktestDashboard() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRunBacktest = async (data: BacktestFormData) => {
    setIsRunning(true);
    setResult(null);
    try {
      const res = await api.backtest.run(data);
      if (res.success && res.data) {
        setResult(res.data);
        if (data.saveToDb) {
          setRefreshTrigger(prev => prev + 1);
        }
        toast.success(`Backtest complete: ${res.data.metrics.totalTrades} trades in ${(res.data.durationMs / 1000).toFixed(1)}s`);
      } else {
        toast.error(res.error || 'Backtest failed');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || 'Backtest failed';
      toast.error(msg);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <BacktestForm onSubmit={handleRunBacktest} isRunning={isRunning} />

      {result && <BacktestResults result={result} />}

      <SavedRunsTable refreshTrigger={refreshTrigger} />
    </div>
  );
}
