/**
 * Portfolio Routes — REST API for portfolio management (account-scoped).
 *
 * All routes require authentication + valid trading account.
 *
 * Endpoints:
 *   GET /api/portfolio/summary                 — equity, drawdown, allocation, positions
 *   GET /api/portfolio/equity-curve            — historical equity data points
 *   GET /api/portfolio/performance             — aggregate metrics (Sharpe, drawdown, returns)
 *   GET /api/portfolio/performance/:strategyId — per-strategy metrics
 *   GET /api/portfolio/circuit-breaker         — circuit breaker status
 *   POST /api/portfolio/circuit-breaker/resume — force-resume (manual override)
 */

import { Router } from 'express';
import { authenticateToken } from './auth';
import { resolveAccount } from '../middleware/accountContext';
import portfolioManager from '../services/portfolio/portfolioManager';
import equityTracker from '../services/portfolio/equityTracker';
import circuitBreaker from '../services/portfolio/circuitBreaker';

const router = Router();
router.use(authenticateToken);
router.use(resolveAccount);

// ── GET /summary ────────────────────────────────────────────

router.get('/summary', async (req, res) => {
  try {
    const summary = await portfolioManager.getPortfolioSummary(req.tradingAccountId!);
    res.json(summary);
  } catch (err: any) {
    console.error('[Route] Portfolio summary error:', err.message);
    res.status(500).json({ error: 'Failed to fetch portfolio summary' });
  }
});

// ── GET /equity-curve ───────────────────────────────────────

router.get('/equity-curve', async (req, res) => {
  try {
    const from = req.query['from'] ? Number(req.query['from'] as string) : undefined;
    const to = req.query['to'] ? Number(req.query['to'] as string) : undefined;
    const limit = req.query['limit'] ? Number(req.query['limit'] as string) : undefined;

    const curve = await equityTracker.getEquityCurve(req.tradingAccountId!, from, to, limit);
    res.json({ data: curve, count: curve.length });
  } catch (err: any) {
    console.error('[Route] Equity curve error:', err.message);
    res.status(500).json({ error: 'Failed to fetch equity curve' });
  }
});

// ── GET /performance ────────────────────────────────────────

router.get('/performance', async (req, res) => {
  try {
    const period = (req.query['period'] as string) || 'month';
    const from = req.query['from'] ? Number(req.query['from'] as string) : undefined;
    const to = req.query['to'] ? Number(req.query['to'] as string) : undefined;

    const metrics = await equityTracker.getPerformanceMetrics(req.tradingAccountId!, period, from, to);
    res.json(metrics);
  } catch (err: any) {
    console.error('[Route] Performance error:', err.message);
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

// ── GET /performance/:strategyId ────────────────────────────

router.get('/performance/:strategyId', async (req, res) => {
  try {
    const strategyId = req.params['strategyId'] as string;
    const metrics = await portfolioManager.getStrategyPerformance(req.tradingAccountId!, strategyId);
    res.json(metrics);
  } catch (err: any) {
    console.error('[Route] Strategy performance error:', err.message);
    res.status(500).json({ error: 'Failed to fetch strategy performance' });
  }
});

// ── GET /circuit-breaker ────────────────────────────────────

router.get('/circuit-breaker', (req, res) => {
  try {
    const status = circuitBreaker.getStatus(req.tradingAccountId!);
    res.json(status);
  } catch (err: any) {
    console.error('[Route] Circuit breaker status error:', err.message);
    res.status(500).json({ error: 'Failed to fetch circuit breaker status' });
  }
});

// ── POST /circuit-breaker/resume ────────────────────────────

router.post('/circuit-breaker/resume', async (req, res) => {
  try {
    const strategyId = req.body?.strategyId as string | undefined;
    const success = await circuitBreaker.forceResume(req.tradingAccountId!, strategyId);

    if (success) {
      const target = strategyId ? `strategy ${strategyId}` : 'portfolio';
      res.json({ success: true, message: `Force-resumed ${target}` });
    } else {
      res.status(400).json({ error: 'Nothing to resume — circuit breaker not triggered' });
    }
  } catch (err: any) {
    console.error('[Route] Circuit breaker resume error:', err.message);
    res.status(500).json({ error: 'Failed to resume' });
  }
});

export default router;
