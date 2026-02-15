'use client';

import { useEffect, useState, useCallback } from 'react';
import { useStrategyStore, StrategyInfo } from '@/store/strategyStore';
import api from '@/lib/api';
import { StrategyCard } from './StrategyCard';
import { StrategyConfigDrawer } from './StrategyConfigDrawer';
import { TrendStatusTable, ScalpMonitorTable, FundingRateScanner, MomentumRankingTable } from './StrategyPanels';
import type { TrendRow, ScalpRow, FundingRow, MomentumRow } from './StrategyPanels';

/**
 * StrategiesMonitor — Phase 8 main component.
 *
 * Composes:
 *  - Strategy cards for each registered strategy
 *  - Strategy-specific data panels based on category
 *  - Configuration drawer for editing strategy params
 *
 * Fetches strategy list and state from API.
 */

export function StrategiesMonitor() {
  const strategies = useStrategyStore(s => s.strategies);
  const performances = useStrategyStore(s => s.performances);
  const setStrategies = useStrategyStore(s => s.setStrategies);
  const setPerformance = useStrategyStore(s => s.setPerformance);
  const setLoading = useStrategyStore(s => s.setLoading);
  const loading = useStrategyStore(s => s.loading);

  const [configStrategy, setConfigStrategy] = useState<StrategyInfo | null>(null);

  // Strategy-specific panel data
  const [trendData, setTrendData] = useState<TrendRow[]>([]);
  const [scalpData, setScalpData] = useState<ScalpRow[]>([]);
  const [fundingData, setFundingData] = useState<FundingRow[]>([]);
  const [momentumData, setMomentumData] = useState<MomentumRow[]>([]);

  // ── Fetch strategies ──

  const fetchStrategies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.strategies.list();
      const rawList = res?.strategies || res?.data || [];

      const mapped: StrategyInfo[] = rawList.map((s: any) => ({
        id: s.config?.id || s.id,
        name: s.config?.name || s.name,
        category: s.config?.category || s.category || 'trend_following',
        timeframes: s.config?.timeframes || s.timeframes || [],
        symbols: s.config?.symbols || s.symbols || [],
        capitalAllocationPercent: Number(s.config?.capitalAllocationPercent || s.capitalAllocationPercent || 0),
        maxLeverage: Number(s.config?.maxLeverage || s.maxLeverage || 1),
        paused: s.paused ?? false,
        state: {
          status: s.state?.status || 'idle',
          activePositions: s.state?.activePositions || [],
          metrics: {
            signalsEmitted: s.state?.metrics?.signalsEmitted || 0,
            tradesOpened: s.state?.metrics?.tradesOpened || 0,
            tradesClosed: s.state?.metrics?.tradesClosed || 0,
            winRate: s.state?.metrics?.winRate || 0,
            totalPnl: s.state?.metrics?.totalPnl || 0,
          },
        },
      }));

      setStrategies(mapped);

      // Fetch per-strategy performance
      for (const s of mapped) {
        try {
          const perfRes = await api.portfolio.getStrategyPerformance(s.id);
          const p = perfRes?.data || perfRes;
          if (p) {
            setPerformance(s.id, {
              strategyId: s.id,
              totalPnl: Number(p.totalPnl || p.total_pnl || 0),
              winCount: Number(p.winCount || p.win_count || 0),
              lossCount: Number(p.lossCount || p.loss_count || 0),
              winRate: Number(p.winRate || p.win_rate || 0),
              maxDrawdown: Number(p.maxDrawdown || p.max_drawdown || 0),
              sharpeRatio: p.sharpeRatio != null ? Number(p.sharpeRatio) : (p.sharpe_ratio != null ? Number(p.sharpe_ratio) : null),
              currentAllocationPct: Number(p.currentAllocationPct || p.current_allocation_pct || 0),
              isActive: p.isActive ?? p.is_active ?? true,
              lastUpdated: Date.now(),
            });
          }
        } catch {
          // Strategy performance endpoint may not be available yet
        }
      }

      // Extract strategy-specific panel data from state
      extractPanelData(mapped);
    } catch {
      // Keep existing store data
    } finally {
      setLoading(false);
    }
  }, [setStrategies, setPerformance, setLoading]);

  function extractPanelData(strategyList: StrategyInfo[]) {
    // Each strategy's state may contain indicator snapshots per symbol.
    // For now, derive panel data from known strategy categories.
    // When the server sends richer state, this will populate automatically.

    for (const s of strategyList) {
      if (s.category === 'trend_following') {
        setTrendData(s.symbols.map(sym => ({
          symbol: sym,
          dailyTrend: s.state.activePositions.includes(sym) ? 'Bullish' : 'Neutral',
          adx: undefined,
          ema4hCross: undefined,
          status: s.state.activePositions.includes(sym) ? 'Active' : 'Watching',
        })));
      } else if (s.category === 'mean_reversion') {
        setScalpData(s.symbols.map(sym => ({
          symbol: sym,
          bbPosition: undefined,
          rsi7: undefined,
          stochRsi: undefined,
          volSpike: false,
          ready: false,
        })));
      } else if (s.category === 'carry') {
        setFundingData(s.symbols.map(sym => ({
          symbol: sym,
          currentRate: undefined,
          avg7d: undefined,
          zScore: undefined,
          oiDelta: undefined,
          position: s.state.activePositions.includes(sym) ? 'Long' : undefined,
        })));
      } else if (s.category === 'momentum') {
        setMomentumData(s.symbols.map((sym, i) => ({
          symbol: sym,
          rank: i + 1,
          score: undefined,
          roc7d: undefined,
          roc14d: undefined,
          roc30d: undefined,
          position: s.state.activePositions.includes(sym) ? 'Long' : undefined,
        })));
      }
    }
  }

  useEffect(() => {
    fetchStrategies();
  }, [fetchStrategies]);

  // Categorize strategies for display
  const hasCategory = (cat: string) => strategies.some(s => s.category === cat);

  return (
    <div className="space-y-4">
      {/* Strategy cards */}
      {loading && strategies.length === 0 ? (
        <div className="text-center py-12 text-sm text-slate-400 dark:text-slate-500">Loading strategies...</div>
      ) : strategies.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No strategies registered. Strategies will appear here once the server is running with active trading accounts.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {strategies.map(s => (
              <StrategyCard
                key={s.id}
                strategy={s}
                performance={performances[s.id]}
                onConfigClick={id => {
                  const strat = strategies.find(st => st.id === id);
                  if (strat) setConfigStrategy(strat);
                }}
              />
            ))}
          </div>

          {/* Strategy-specific panels */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {hasCategory('trend_following') && <TrendStatusTable data={trendData} />}
            {hasCategory('mean_reversion') && <ScalpMonitorTable data={scalpData} />}
            {hasCategory('carry') && <FundingRateScanner data={fundingData} />}
            {hasCategory('momentum') && <MomentumRankingTable data={momentumData} />}
          </div>
        </>
      )}

      {/* Config drawer */}
      {configStrategy && (
        <StrategyConfigDrawer
          strategy={configStrategy}
          onClose={() => setConfigStrategy(null)}
          onSaved={() => { setConfigStrategy(null); fetchStrategies(); }}
        />
      )}
    </div>
  );
}
