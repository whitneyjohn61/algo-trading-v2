/**
 * Portfolio Manager — tracks capital allocation, equity, drawdown, and P&L.
 *
 * All methods are account-scoped via tradingAccountId.
 * Per-account state (peak equity, drawdown, daily P&L) stored in memory maps.
 * Background services call these with each active account ID.
 */

import db from '../database/connection';
import exchangeManager from '../exchange/exchangeManager';
import { getAllStrategies, getStrategy } from '../../strategies/registry';
import type { ExchangePosition } from '../exchange/exchangeService';

// ── Types ──────────────────────────────────────────────────

export interface PortfolioSummary {
  tradingAccountId: number;
  totalEquity: number;
  availableBalance: number;
  unrealizedPnl: number;
  realizedPnlToday: number;
  peakEquity: number;
  drawdownPct: number;
  positionCount: number;
  positions: ExchangePosition[];
  strategyAllocations: StrategyAllocationInfo[];
  lastUpdated: number;
}

export interface StrategyAllocationInfo {
  strategyId: string;
  strategyName: string;
  category: string;
  targetPct: number;
  currentEquity: number;
  currentPct: number;
  isActive: boolean;
  positionCount: number;
  unrealizedPnl: number;
}

export interface StrategyPerformanceMetrics {
  strategyId: string;
  totalPnl: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number | null;
  currentAllocationPct: number;
  isActive: boolean;
  lastUpdated: number;
}

export interface AggregatePerformance {
  totalPnl: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number | null;
  strategySummaries: StrategyPerformanceMetrics[];
}

// ── Per-account state ──────────────────────────────────────

interface AccountState {
  peakEquity: number;
  lastEquity: number;
  realizedPnlToday: number;
  todayDateStr: string;
}

// ── Service ──────────────────────────────────────────────────

class PortfolioManager {
  private accountStates: Map<number, AccountState> = new Map();

  private getState(tradingAccountId: number): AccountState {
    let state = this.accountStates.get(tradingAccountId);
    if (!state) {
      state = { peakEquity: 0, lastEquity: 0, realizedPnlToday: 0, todayDateStr: '' };
      this.accountStates.set(tradingAccountId, state);
    }
    return state;
  }

  /**
   * Get full portfolio summary for a specific trading account.
   */
  async getPortfolioSummary(tradingAccountId: number): Promise<PortfolioSummary> {
    const exchange = await exchangeManager.getForAccount(tradingAccountId);
    const state = this.getState(tradingAccountId);

    // Fetch equity + positions from exchange
    const [equity, balances, positions] = await Promise.all([
      exchange.getTotalEquity(),
      exchange.getBalances(),
      exchange.getPositions(),
    ]);

    // Update peak and drawdown
    if (equity > state.peakEquity) {
      state.peakEquity = equity;
    }
    state.lastEquity = equity;

    const drawdownPct = state.peakEquity > 0
      ? ((state.peakEquity - equity) / state.peakEquity) * 100
      : 0;

    // Calculate available balance (first USDT balance or total)
    const usdtBalance = balances.find(b => b.coin === 'USDT');
    const availableBalance = usdtBalance ? usdtBalance.available : 0;

    // Calculate unrealized P&L across all positions
    const unrealizedPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);

    // Reset daily P&L tracker at midnight
    const today = new Date().toISOString().slice(0, 10);
    if (today !== state.todayDateStr) {
      state.realizedPnlToday = 0;
      state.todayDateStr = today;
    }

    // Build per-strategy allocation info
    const strategyAllocations = this.buildAllocations(equity, positions);

    return {
      tradingAccountId,
      totalEquity: equity,
      availableBalance,
      unrealizedPnl,
      realizedPnlToday: state.realizedPnlToday,
      peakEquity: state.peakEquity,
      drawdownPct: Math.round(drawdownPct * 100) / 100,
      positionCount: positions.length,
      positions,
      strategyAllocations,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Get current equity from exchange for a specific account.
   */
  async getEquity(tradingAccountId: number): Promise<number> {
    const exchange = await exchangeManager.getForAccount(tradingAccountId);
    const equity = await exchange.getTotalEquity();
    const state = this.getState(tradingAccountId);
    state.lastEquity = equity;
    if (equity > state.peakEquity) state.peakEquity = equity;
    return equity;
  }

  /**
   * Get current drawdown percentage for an account.
   */
  getDrawdownPct(tradingAccountId: number): number {
    const state = this.getState(tradingAccountId);
    if (state.peakEquity <= 0) return 0;
    return ((state.peakEquity - state.lastEquity) / state.peakEquity) * 100;
  }

  /**
   * Get peak equity value for an account.
   */
  getPeakEquity(tradingAccountId: number): number {
    return this.getState(tradingAccountId).peakEquity;
  }

  /**
   * Get last known equity for an account (without fetching from exchange).
   */
  getLastEquity(tradingAccountId: number): number {
    return this.getState(tradingAccountId).lastEquity;
  }

  /**
   * Record realized P&L from a closed trade.
   */
  recordTradePnl(tradingAccountId: number, strategyId: string, pnl: number): void {
    const state = this.getState(tradingAccountId);
    state.realizedPnlToday += pnl;
    // Fire-and-forget DB update
    void this.updateStrategyPerformanceRecord(tradingAccountId, strategyId, pnl);
  }

  /**
   * Get the capital allocated to a specific strategy for an account (in USD).
   */
  getAllocatedCapital(tradingAccountId: number, strategyId: string): number {
    const strategy = getStrategy(strategyId);
    if (!strategy) return 0;
    const state = this.getState(tradingAccountId);
    return (strategy.config.capitalAllocationPercent / 100) * state.lastEquity;
  }

  /**
   * Get aggregate performance metrics across all strategies for an account.
   */
  async getAggregatePerformance(tradingAccountId: number): Promise<AggregatePerformance> {
    const strategies = getAllStrategies();
    const summaries: StrategyPerformanceMetrics[] = [];
    let totalPnl = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let maxDrawdown = 0;

    for (const strategy of strategies) {
      const metrics = await this.getStrategyPerformance(tradingAccountId, strategy.config.id);
      summaries.push(metrics);
      totalPnl += metrics.totalPnl;
      totalWins += metrics.winCount;
      totalLosses += metrics.lossCount;
      if (metrics.maxDrawdown > maxDrawdown) maxDrawdown = metrics.maxDrawdown;
    }

    const totalTrades = totalWins + totalLosses;

    return {
      totalPnl,
      totalWins,
      totalLosses,
      winRate: totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0,
      maxDrawdown,
      sharpeRatio: null, // Calculated by equity tracker from time-series
      strategySummaries: summaries,
    };
  }

  /**
   * Get performance metrics for a specific strategy on a specific account.
   */
  async getStrategyPerformance(tradingAccountId: number, strategyId: string): Promise<StrategyPerformanceMetrics> {
    const row = await db.getOne(
      `SELECT * FROM strategy_performance
       WHERE trading_account_id = $1 AND strategy_id = $2
       ORDER BY snapshot_at DESC LIMIT 1`,
      [tradingAccountId, strategyId]
    );

    if (row) {
      const totalTrades = Number(row['win_count']) + Number(row['loss_count']);
      return {
        strategyId,
        totalPnl: Number(row['total_pnl']),
        winCount: Number(row['win_count']),
        lossCount: Number(row['loss_count']),
        winRate: totalTrades > 0 ? (Number(row['win_count']) / totalTrades) * 100 : 0,
        maxDrawdown: Number(row['max_drawdown']),
        sharpeRatio: row['sharpe_ratio'] !== null ? Number(row['sharpe_ratio']) : null,
        currentAllocationPct: Number(row['current_allocation_pct']),
        isActive: Boolean(row['is_active']),
        lastUpdated: new Date(row['snapshot_at'] as string).getTime(),
      };
    }

    // No record yet — return defaults from strategy config
    const strategy = getStrategy(strategyId);
    return {
      strategyId,
      totalPnl: 0,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
      maxDrawdown: 0,
      sharpeRatio: null,
      currentAllocationPct: strategy?.config.capitalAllocationPercent ?? 0,
      isActive: true,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Initialize peak equity from database for a specific account (called on startup).
   */
  async initializeFromDb(tradingAccountId: number): Promise<void> {
    try {
      const state = this.getState(tradingAccountId);

      // Restore peak equity from latest snapshot
      const row = await db.getOne(
        `SELECT peak_equity FROM portfolio_snapshots
         WHERE trading_account_id = $1
         ORDER BY snapshot_at DESC LIMIT 1`,
        [tradingAccountId]
      );
      if (row) {
        state.peakEquity = Number(row['peak_equity']);
        console.log(`[Portfolio] Account ${tradingAccountId}: restored peak equity $${state.peakEquity.toFixed(2)}`);
      }

      // Get current equity from exchange
      try {
        const equity = await this.getEquity(tradingAccountId);
        console.log(`[Portfolio] Account ${tradingAccountId}: current equity $${equity.toFixed(2)}`);
      } catch {
        console.warn(`[Portfolio] Account ${tradingAccountId}: could not fetch initial equity`);
      }
    } catch (err: any) {
      console.warn(`[Portfolio] Account ${tradingAccountId}: failed to restore from DB: ${err.message}`);
    }
  }

  // ── Private ──────────────────────────────────────────────

  private buildAllocations(totalEquity: number, positions: ExchangePosition[]): StrategyAllocationInfo[] {
    const strategies = getAllStrategies();
    const allocations: StrategyAllocationInfo[] = [];

    for (const strategy of strategies) {
      const cfg = strategy.config;
      const state = strategy.getState();

      // Count positions attributed to this strategy
      const strategyPositions = positions.filter(p =>
        cfg.symbols.includes(p.symbol) && state.activePositions.includes(p.symbol)
      );
      const unrealizedPnl = strategyPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
      const margin = strategyPositions.reduce((sum, p) => sum + p.margin, 0);

      // Current equity usage = margin + unrealized P&L
      const currentEquity = margin + unrealizedPnl;
      const currentPct = totalEquity > 0 ? (currentEquity / totalEquity) * 100 : 0;

      allocations.push({
        strategyId: cfg.id,
        strategyName: cfg.name,
        category: cfg.category,
        targetPct: cfg.capitalAllocationPercent,
        currentEquity,
        currentPct: Math.round(currentPct * 100) / 100,
        isActive: state.status === 'running',
        positionCount: strategyPositions.length,
        unrealizedPnl,
      });
    }

    return allocations;
  }

  private async updateStrategyPerformanceRecord(tradingAccountId: number, strategyId: string, pnl: number): Promise<void> {
    try {
      const isWin = pnl > 0;
      const strategy = getStrategy(strategyId);
      const allocationPct = strategy?.config.capitalAllocationPercent ?? 0;

      await db.insert(
        `INSERT INTO strategy_performance (trading_account_id, strategy_id, total_pnl, win_count, loss_count, current_allocation_pct, is_active)
         SELECT
           $1, $2,
           COALESCE((SELECT total_pnl FROM strategy_performance WHERE trading_account_id = $1 AND strategy_id = $2 ORDER BY snapshot_at DESC LIMIT 1), 0) + $3,
           COALESCE((SELECT win_count FROM strategy_performance WHERE trading_account_id = $1 AND strategy_id = $2 ORDER BY snapshot_at DESC LIMIT 1), 0) + $4,
           COALESCE((SELECT loss_count FROM strategy_performance WHERE trading_account_id = $1 AND strategy_id = $2 ORDER BY snapshot_at DESC LIMIT 1), 0) + $5,
           $6, true`,
        [tradingAccountId, strategyId, pnl, isWin ? 1 : 0, isWin ? 0 : 1, allocationPct]
      );
    } catch (err: any) {
      console.error(`[Portfolio] Failed to update performance for account ${tradingAccountId}, strategy ${strategyId}: ${err.message}`);
    }
  }
}

const portfolioManager = new PortfolioManager();
export default portfolioManager;
