/**
 * Backtest DB Service — CRUD for backtest_runs + backtest_trades.
 * Transplanted from V1 dbService.ts, adapted for V2 schema.
 */

import crypto from 'crypto';
import db from '../database/connection';
import type {
  BacktestParams,
  BacktestResult,
  BacktestRunRow,
  BacktestTradeRow,
} from './backtestTypes';

class BacktestDbService {

  /**
   * Save a completed backtest run + trades to DB.
   */
  async saveRun(
    userId: string,
    params: BacktestParams,
    result: BacktestResult,
  ): Promise<number> {
    const paramsHash = crypto
      .createHash('md5')
      .update(JSON.stringify({ ...params, paramOverrides: params.paramOverrides }))
      .digest('hex');

    const row = await db.insert(
      `INSERT INTO backtest_runs
        (user_id, strategy, parameters, params_hash, symbol, exchange, interval,
         start_time, end_time, initial_balance, final_balance, total_return,
         total_trades, win_rate, max_drawdown, total_fees,
         sharpe_ratio, sortino_ratio, profit_factor, expectancy,
         equity_curve, leverage)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING id`,
      [
        userId,
        params.strategyId,
        JSON.stringify(params.paramOverrides || {}),
        paramsHash,
        params.symbol,
        'bybit',
        params.interval,
        new Date(params.startTime).toISOString(),
        new Date(params.endTime).toISOString(),
        params.initialBalance,
        result.finalBalance,
        result.metrics.totalReturnPct,
        result.metrics.totalTrades,
        result.metrics.winRate,
        result.metrics.maxDrawdownPct,
        result.metrics.totalFees,
        result.metrics.sharpeRatio,
        result.metrics.sortinoRatio,
        result.metrics.profitFactor,
        result.metrics.expectancy,
        JSON.stringify(result.equityCurveSampled),
        params.leverage,
      ],
    );

    const runId = Number(row['id']);

    // Insert trades in batches of 100
    const trades = result.trades;
    for (let i = 0; i < trades.length; i += 100) {
      const batch = trades.slice(i, i + 100);
      const values: string[] = [];
      const batchParams: unknown[] = [];
      let paramIdx = 1;

      for (const t of batch) {
        values.push(
          `($${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++})`
        );
        batchParams.push(
          runId,
          t.side,
          new Date(t.entryTime).toISOString(),
          t.entryPrice,
          t.entryQty,
          t.exitTime ? new Date(t.exitTime).toISOString() : null,
          t.exitPrice ?? null,
          t.pnl ?? null,
          t.entrySignal ? JSON.stringify(t.entrySignal) : null,
          t.exitSignal ? JSON.stringify(t.exitSignal) : null,
          t.notes ?? null,
        );
      }

      if (values.length > 0) {
        await db.query(
          `INSERT INTO backtest_trades
            (run_id, side, entry_time, entry_price, entry_qty, exit_time, exit_price, pnl, entry_trigger, exit_trigger, notes)
           VALUES ${values.join(',')}`,
          batchParams,
        );
      }
    }

    return runId;
  }

  /**
   * List saved runs with optional filters.
   */
  async listRuns(filters?: {
    userId?: string;
    strategy?: string;
    symbol?: string;
    limit?: number;
    offset?: number;
  }): Promise<BacktestRunRow[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters?.userId) {
      conditions.push(`user_id = $${idx++}`);
      params.push(filters.userId);
    }
    if (filters?.strategy) {
      conditions.push(`strategy = $${idx++}`);
      params.push(filters.strategy);
    }
    if (filters?.symbol) {
      conditions.push(`symbol = $${idx++}`);
      params.push(filters.symbol);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    return db.getAll(
      `SELECT * FROM backtest_runs ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset],
    );
  }

  /**
   * Get a single run by ID with its trades.
   */
  async getRun(runId: number): Promise<{ run: BacktestRunRow; trades: BacktestTradeRow[] } | null> {
    const run = await db.getOne('SELECT * FROM backtest_runs WHERE id = $1', [runId]);
    if (!run) return null;

    const trades = await db.getAll(
      'SELECT * FROM backtest_trades WHERE run_id = $1 ORDER BY entry_time ASC',
      [runId],
    );

    return { run, trades };
  }

  /**
   * Delete a run and its trades (cascade).
   */
  async deleteRun(runId: number): Promise<boolean> {
    const count = await db.delete('DELETE FROM backtest_runs WHERE id = $1', [runId]);
    return count > 0;
  }
}

const backtestDbService = new BacktestDbService();
export default backtestDbService;
