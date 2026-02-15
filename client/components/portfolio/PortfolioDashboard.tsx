'use client';

import { useEffect, useCallback } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import api from '@/lib/api';
import { SummaryCards } from './SummaryCards';
import { EquityCurveChart } from './EquityCurveChart';
import { StrategyAllocationPanel } from './StrategyAllocationPanel';
import { OpenPositionsTable } from './OpenPositionsTable';
import { RecentTradesFeed } from './RecentTradesFeed';

/**
 * PortfolioDashboard — Phase 7 main component.
 *
 * Composes all portfolio sub-components:
 *  - Summary Cards (equity, P&L, positions, drawdown)
 *  - Equity Curve Chart (lightweight-charts)
 *  - Strategy Allocations (horizontal bars)
 *  - Open Positions Table (sortable/filterable)
 *  - Recent Trades Feed (scrollable + dialog)
 *
 * Fetches initial data from API and subscribes to WebSocket updates via stores.
 */

interface PortfolioDashboardProps {
  onNavigateToStrategies?: (strategyId?: string) => void;
}

export function PortfolioDashboard({ onNavigateToStrategies }: PortfolioDashboardProps) {
  const setSummary = usePortfolioStore(s => s.setSummary);
  const setCircuitBreaker = usePortfolioStore(s => s.setCircuitBreaker);
  const setLoading = usePortfolioStore(s => s.setLoading);
  const setError = usePortfolioStore(s => s.setError);

  // ── Initial data fetch ──
  const fetchPortfolioData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, cbRes] = await Promise.allSettled([
        api.portfolio.getSummary(),
        api.portfolio.getCircuitBreaker(),
      ]);

      if (summaryRes.status === 'fulfilled' && summaryRes.value) {
        const s = summaryRes.value.data || summaryRes.value;
        setSummary({
          totalEquity: Number(s.totalEquity || s.total_equity || 0),
          availableBalance: Number(s.availableBalance || s.available_balance || 0),
          unrealizedPnl: Number(s.unrealizedPnl || s.unrealized_pnl || 0),
          realizedPnlToday: Number(s.realizedPnlToday || s.realized_pnl_today || 0),
          peakEquity: Number(s.peakEquity || s.peak_equity || 0),
          drawdownPct: Number(s.drawdownPct || s.drawdown_pct || 0),
          positionCount: Number(s.positionCount || s.position_count || 0),
          positions: s.positions || [],
          strategyAllocations: (s.strategyAllocations || s.strategy_allocations || []).map((a: any) => ({
            strategyId: a.strategyId || a.strategy_id,
            strategyName: a.strategyName || a.strategy_name || a.name,
            category: a.category || '',
            targetPct: Number(a.targetPct || a.target_pct || 0),
            currentPct: Number(a.currentPct || a.current_pct || 0),
            currentEquity: Number(a.currentEquity || a.current_equity || 0),
            isActive: a.isActive ?? a.is_active ?? true,
            positionCount: Number(a.positionCount || a.position_count || 0),
            unrealizedPnl: Number(a.unrealizedPnl || a.unrealized_pnl || 0),
          })),
        });
      }

      if (cbRes.status === 'fulfilled' && cbRes.value) {
        const cb = cbRes.value.data || cbRes.value;
        setCircuitBreaker({
          tradingAccountId: cb.tradingAccountId || cb.trading_account_id || 0,
          portfolioTriggered: cb.portfolioTriggered ?? cb.portfolio_triggered ?? false,
          portfolioDrawdownPct: Number(cb.portfolioDrawdownPct || cb.portfolio_drawdown_pct || 0),
          portfolioThreshold: Number(cb.portfolioThreshold || cb.portfolio_threshold || 25),
          triggeredAt: cb.triggeredAt || cb.triggered_at || null,
          haltedStrategies: cb.haltedStrategies || cb.halted_strategies || [],
        });
      }

      setLoading(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to load portfolio data');
    }
  }, [setSummary, setCircuitBreaker, setLoading, setError]);

  useEffect(() => {
    fetchPortfolioData();
  }, [fetchPortfolioData]);

  return (
    <div className="space-y-4">
      {/* Row 1: Summary Cards */}
      <SummaryCards />

      {/* Row 2: Equity Chart + Strategy Allocations */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <EquityCurveChart />
        </div>
        <div>
          <StrategyAllocationPanel onStrategyClick={onNavigateToStrategies} />
        </div>
      </div>

      {/* Row 3: Positions + Trades */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <OpenPositionsTable />
        <RecentTradesFeed />
      </div>
    </div>
  );
}
