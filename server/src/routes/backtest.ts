/**
 * Backtest routes — run simulations, list/get/delete saved runs.
 * Transplanted from V1, adapted for V2 strategy interface.
 */

import express, { Request, Response } from 'express';
import { authenticateToken } from './auth';
import { getStrategyConfigs, hasStrategy } from '../strategies/registry';
import { runBacktest, runPortfolioBacktest } from '../services/backtest/backtestEngine';
import backtestDbService from '../services/backtest/backtestDbService';
import type { BacktestParams, PortfolioBacktestParams } from '../services/backtest/backtestTypes';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ── POST /api/backtest/run — Run single-strategy backtest ─────

router.post('/run', async (req: Request, res: Response) => {
  try {
    const {
      strategyId,
      symbol,
      interval,
      startTime,
      endTime,
      initialBalance,
      leverage = 1,
      takerFeeRate,
      slippageRate,
      paramOverrides,
      saveToDb = false,
    } = req.body;

    // Validation
    if (!strategyId || !symbol || !interval || !startTime || !endTime) {
      res.status(400).json({ error: 'Missing required fields: strategyId, symbol, interval, startTime, endTime' });
      return;
    }

    if (!hasStrategy(strategyId)) {
      res.status(404).json({ error: `Strategy not found: ${strategyId}` });
      return;
    }

    if (endTime <= startTime) {
      res.status(400).json({ error: 'endTime must be after startTime' });
      return;
    }

    const params: BacktestParams = {
      strategyId,
      symbol: symbol.toUpperCase(),
      interval,
      startTime: Number(startTime),
      endTime: Number(endTime),
      initialBalance: Number(initialBalance) || 10000,
      leverage: Number(leverage),
      takerFeeRate: takerFeeRate ? Number(takerFeeRate) : undefined,
      slippageRate: slippageRate ? Number(slippageRate) : undefined,
      paramOverrides,
      saveToDb,
    };

    const result = await runBacktest(params);

    // Optionally save to DB
    let runId: number | null = null;
    if (saveToDb) {
      try {
        const userId = String((req as any).user.id);
        runId = await backtestDbService.saveRun(userId, params, result);
      } catch (dbErr: any) {
        console.error('[Backtest] DB save failed:', dbErr.message);
      }
    }

    res.json({
      success: true,
      data: {
        ...result,
        runId,
        // Exclude full equity curve from API (use sampled)
        equityCurve: undefined,
      },
    });
  } catch (error: any) {
    console.error('[Backtest] Run error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── POST /api/backtest/portfolio-run — Run multi-strategy backtest ─

router.post('/portfolio-run', async (req: Request, res: Response) => {
  try {
    const {
      strategyIds,
      symbol,
      interval,
      startTime,
      endTime,
      initialBalance,
      leverage = 1,
      takerFeeRate,
      slippageRate,
      saveToDb = false,
    } = req.body;

    if (!symbol || !interval || !startTime || !endTime) {
      res.status(400).json({ error: 'Missing required fields: symbol, interval, startTime, endTime' });
      return;
    }

    const params: PortfolioBacktestParams = {
      strategyIds,
      symbol: symbol.toUpperCase(),
      interval,
      startTime: Number(startTime),
      endTime: Number(endTime),
      initialBalance: Number(initialBalance) || 10000,
      leverage: Number(leverage),
      takerFeeRate: takerFeeRate ? Number(takerFeeRate) : undefined,
      slippageRate: slippageRate ? Number(slippageRate) : undefined,
      saveToDb,
    };

    const result = await runPortfolioBacktest(params);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[Backtest] Portfolio run error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/backtest/strategies — List available strategies ──

router.get('/strategies', (_req: Request, res: Response) => {
  try {
    const configs = getStrategyConfigs();
    res.json({ success: true, data: configs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/backtest/runs — List saved runs ──────────────────

router.get('/runs', async (req: Request, res: Response) => {
  try {
    const userId = String((req as any).user.id);
    const isAdmin = (req as any).user.role === 'admin';

    const runs = await backtestDbService.listRuns({
      userId: isAdmin ? undefined : userId,
      strategy: req.query['strategy'] as string | undefined,
      symbol: req.query['symbol'] as string | undefined,
      limit: Number(req.query['limit']) || 50,
      offset: Number(req.query['offset']) || 0,
    });

    res.json({ success: true, data: runs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/backtest/runs/:id — Get run detail + trades ─────

router.get('/runs/:id', async (req: Request, res: Response) => {
  try {
    const runId = Number(req.params['id']);
    const result = await backtestDbService.getRun(runId);
    if (!result) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── DELETE /api/backtest/runs/:id — Delete run ────────────────

router.delete('/runs/:id', async (req: Request, res: Response) => {
  try {
    const runId = Number(req.params['id']);
    const deleted = await backtestDbService.deleteRun(runId);
    if (!deleted) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }
    res.json({ success: true, message: 'Run deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
