/**
 * Strategy Routes — REST API for managing and monitoring strategies (account-scoped).
 *
 * All routes require authentication + valid trading account.
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from './auth';
import { resolveAccount } from '../middleware/accountContext';
import { getAllStrategies, getStrategy } from '../strategies/registry';
import strategyExecutor from '../strategies/executor';

const router = Router();
router.use(authenticateToken);
router.use(resolveAccount);

// ── List all strategies with status ──────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const accountId = req.tradingAccountId!;
    const strategies = getAllStrategies();
    const executorStatus = strategyExecutor.getStatus(accountId);

    const result = strategies.map(s => ({
      id: s.config.id,
      name: s.config.name,
      category: s.config.category,
      timeframes: s.config.timeframes,
      symbols: s.config.symbols,
      capitalAllocationPercent: s.config.capitalAllocationPercent,
      maxLeverage: s.config.maxLeverage,
      state: s.getState(),
      paused: executorStatus[s.config.id]?.paused || false,
    }));

    res.json({ strategies: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Get single strategy state ────────────────────────────

router.get('/:id/state', async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    const strategy = getStrategy(id);
    if (!strategy) {
      res.status(404).json({ error: `Strategy not found: ${id}` });
      return;
    }

    res.json({
      id: strategy.config.id,
      name: strategy.config.name,
      config: strategy.config,
      state: strategy.getState(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Update strategy config ───────────────────────────────

router.put('/:id/config', async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    const strategy = getStrategy(id);
    if (!strategy) {
      res.status(404).json({ error: `Strategy not found: ${id}` });
      return;
    }

    // Update mutable params
    const { params, symbols, capitalAllocationPercent, maxLeverage } = req.body;
    if (params) Object.assign(strategy.config.params, params);
    if (symbols) strategy.config.symbols = symbols;
    if (capitalAllocationPercent !== undefined) strategy.config.capitalAllocationPercent = Number(capitalAllocationPercent);
    if (maxLeverage !== undefined) strategy.config.maxLeverage = Number(maxLeverage);

    res.json({ message: `Strategy ${id} config updated`, config: strategy.config });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ── Pause strategy ───────────────────────────────────────

router.post('/:id/pause', async (req: Request, res: Response) => {
  try {
    const accountId = req.tradingAccountId!;
    const id = req.params['id'] as string;
    const success = strategyExecutor.pause(accountId, id);
    if (!success) {
      res.status(404).json({ error: `Strategy not found or not running: ${id}` });
      return;
    }
    res.json({ message: `Strategy ${id} paused` });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ── Resume strategy ──────────────────────────────────────

router.post('/:id/resume', async (req: Request, res: Response) => {
  try {
    const accountId = req.tradingAccountId!;
    const id = req.params['id'] as string;
    const success = strategyExecutor.resume(accountId, id);
    if (!success) {
      res.status(404).json({ error: `Strategy not found: ${id}` });
      return;
    }
    res.json({ message: `Strategy ${id} resumed` });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
