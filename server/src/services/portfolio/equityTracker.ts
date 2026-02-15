/**
 * Equity Tracker — periodic equity snapshots and performance metrics.
 *
 * Account-scoped: tracks all active trading accounts.
 * Takes snapshots every 5 minutes for each account, stores in portfolio_snapshots,
 * and computes time-series metrics like Sharpe ratio, max drawdown, and period returns.
 */

import db from '../database/connection';
import portfolioManager from './portfolioManager';
import exchangeManager from '../exchange/exchangeManager';
import wsBroadcaster from '../../websocket/server';

// ── Types ──────────────────────────────────────────────────

export interface EquitySnapshot {
  tradingAccountId: number;
  totalEquity: number;
  unrealizedPnl: number;
  realizedPnlToday: number;
  peakEquity: number;
  drawdownPct: number;
  positionCount: number;
  strategyAllocations: Record<string, number>;
  snapshotAt: number; // UTC ms
}

export interface EquityCurvePoint {
  timestamp: number;
  equity: number;
  drawdownPct: number;
}

export interface PerformanceMetrics {
  /** Period return as percentage */
  returnPct: number;
  /** Annualized Sharpe ratio (using snapshot returns) */
  sharpeRatio: number | null;
  /** Maximum drawdown during period as percentage */
  maxDrawdown: number;
  /** Total realized P&L */
  totalPnl: number;
  /** Number of snapshots in period */
  dataPoints: number;
  /** Period start timestamp */
  periodStart: number;
  /** Period end timestamp */
  periodEnd: number;
}

// ── Service ──────────────────────────────────────────────────

const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

class EquityTracker {
  private intervalHandle: NodeJS.Timeout | null = null;
  private running = false;

  /**
   * Start periodic equity snapshots for all active accounts.
   */
  start(): void {
    if (this.running) {
      console.warn('[EquityTracker] Already running');
      return;
    }

    this.running = true;
    this.intervalHandle = setInterval(() => {
      void this.snapshotAllAccounts();
    }, SNAPSHOT_INTERVAL_MS);

    // Take initial snapshot for all accounts
    void this.snapshotAllAccounts();
    console.log('[EquityTracker] Started (interval: 5 min)');
  }

  /**
   * Stop periodic snapshots.
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.running = false;
    console.log('[EquityTracker] Stopped');
  }

  /**
   * Snapshot all active trading accounts.
   */
  private async snapshotAllAccounts(): Promise<void> {
    try {
      const accountIds = await exchangeManager.getActiveAccountIds();
      for (const accountId of accountIds) {
        await this.takeSnapshot(accountId);
      }
    } catch (err: any) {
      console.error(`[EquityTracker] Failed to snapshot all accounts: ${err.message}`);
    }
  }

  /**
   * Capture current equity state for a specific account and store to database.
   * Also called externally on trade close events.
   */
  async takeSnapshot(tradingAccountId: number): Promise<EquitySnapshot | null> {
    try {
      const summary = await portfolioManager.getPortfolioSummary(tradingAccountId);

      // Build strategy allocation map for JSON storage
      const allocations: Record<string, number> = {};
      for (const a of summary.strategyAllocations) {
        allocations[a.strategyId] = a.currentPct;
      }

      const snapshot: EquitySnapshot = {
        tradingAccountId,
        totalEquity: summary.totalEquity,
        unrealizedPnl: summary.unrealizedPnl,
        realizedPnlToday: summary.realizedPnlToday,
        peakEquity: summary.peakEquity,
        drawdownPct: summary.drawdownPct,
        positionCount: summary.positionCount,
        strategyAllocations: allocations,
        snapshotAt: Date.now(),
      };

      // Store in database
      await db.insert(
        `INSERT INTO portfolio_snapshots
         (trading_account_id, total_equity, unrealized_pnl, realized_pnl_today, peak_equity, drawdown_pct, position_count, strategy_allocations)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          tradingAccountId,
          snapshot.totalEquity,
          snapshot.unrealizedPnl,
          snapshot.realizedPnlToday,
          snapshot.peakEquity,
          snapshot.drawdownPct,
          snapshot.positionCount,
          JSON.stringify(snapshot.strategyAllocations),
        ]
      );

      // Broadcast equity update via WebSocket (account-scoped)
      wsBroadcaster.broadcastToAccount(tradingAccountId, 'portfolio:equity_update', {
        tradingAccountId,
        equity: snapshot.totalEquity,
        drawdownPct: snapshot.drawdownPct,
        peakEquity: snapshot.peakEquity,
        positionCount: snapshot.positionCount,
        unrealizedPnl: snapshot.unrealizedPnl,
        timestamp: snapshot.snapshotAt,
      });

      return snapshot;
    } catch (err: any) {
      console.error(`[EquityTracker] Snapshot failed for account ${tradingAccountId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Query historical equity data points for charting (account-scoped).
   */
  async getEquityCurve(tradingAccountId: number, fromMs?: number, toMs?: number, limit?: number): Promise<EquityCurvePoint[]> {
    let query = `SELECT total_equity, drawdown_pct, snapshot_at FROM portfolio_snapshots WHERE trading_account_id = $1`;
    const params: any[] = [tradingAccountId];

    if (fromMs) {
      params.push(new Date(fromMs).toISOString());
      query += ` AND snapshot_at >= $${params.length}`;
    }
    if (toMs) {
      params.push(new Date(toMs).toISOString());
      query += ` AND snapshot_at <= $${params.length}`;
    }

    query += ` ORDER BY snapshot_at ASC`;

    if (limit) {
      params.push(limit);
      query += ` LIMIT $${params.length}`;
    }

    const rows = await db.getAll(query, params);

    return rows.map(row => ({
      timestamp: new Date(row['snapshot_at'] as string).getTime(),
      equity: Number(row['total_equity']),
      drawdownPct: Number(row['drawdown_pct']),
    }));
  }

  /**
   * Calculate performance metrics for a given time period (account-scoped).
   */
  async getPerformanceMetrics(tradingAccountId: number, period: string, fromMs?: number, toMs?: number): Promise<PerformanceMetrics> {
    const now = Date.now();
    const to = toMs ?? now;
    let from = fromMs ?? 0;

    if (!fromMs) {
      switch (period) {
        case 'day':
          from = now - 24 * 60 * 60 * 1000;
          break;
        case 'week':
          from = now - 7 * 24 * 60 * 60 * 1000;
          break;
        case 'month':
          from = now - 30 * 24 * 60 * 60 * 1000;
          break;
        default: // 'all'
          from = 0;
      }
    }

    const curve = await this.getEquityCurve(tradingAccountId, from > 0 ? from : undefined, to);

    if (curve.length < 2) {
      return {
        returnPct: 0,
        sharpeRatio: null,
        maxDrawdown: 0,
        totalPnl: 0,
        dataPoints: curve.length,
        periodStart: from,
        periodEnd: to,
      };
    }

    const firstEquity = curve[0]!.equity;
    const lastEquity = curve[curve.length - 1]!.equity;

    // Period return
    const returnPct = firstEquity > 0
      ? ((lastEquity - firstEquity) / firstEquity) * 100
      : 0;

    // Max drawdown during period
    let maxDrawdown = 0;
    for (const point of curve) {
      if (point.drawdownPct > maxDrawdown) maxDrawdown = point.drawdownPct;
    }

    // Sharpe ratio from snapshot-to-snapshot returns
    const sharpeRatio = this.calculateSharpe(curve);

    // Total P&L
    const totalPnl = lastEquity - firstEquity;

    return {
      returnPct: Math.round(returnPct * 100) / 100,
      sharpeRatio,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      totalPnl: Math.round(totalPnl * 100) / 100,
      dataPoints: curve.length,
      periodStart: from,
      periodEnd: to,
    };
  }

  /**
   * Check if tracker is running.
   */
  isRunning(): boolean {
    return this.running;
  }

  // ── Private ──────────────────────────────────────────────

  private calculateSharpe(curve: EquityCurvePoint[]): number | null {
    if (curve.length < 10) return null;

    const returns: number[] = [];
    for (let i = 1; i < curve.length; i++) {
      const prev = curve[i - 1]!.equity;
      const curr = curve[i]!.equity;
      if (prev > 0) {
        returns.push((curr - prev) / prev);
      }
    }

    if (returns.length < 5) return null;

    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return null;

    // Annualize: ~288 snapshots per day (5-min intervals), ~365 days
    const periodsPerYear = 288 * 365;
    const annualizedSharpe = (mean / stdDev) * Math.sqrt(periodsPerYear);

    return Math.round(annualizedSharpe * 100) / 100;
  }
}

const equityTracker = new EquityTracker();
export default equityTracker;
