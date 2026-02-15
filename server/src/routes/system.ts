import express, { Request, Response } from 'express';
import systemMonitor from '../services/monitoring/systemMonitor';
import notificationService from '../services/monitoring/notificationService';
import logger from '../services/monitoring/logger';
import candleService from '../services/market/candleService';
import exchangeManager from '../services/exchange/exchangeManager';
import equityTracker from '../services/portfolio/equityTracker';
import strategyExecutor from '../strategies/executor';
import databaseService from '../services/database/connection';
import wsBroadcaster from '../websocket/server';
import { authenticateToken } from './auth';

const router = express.Router();

// GET /api/system/health — public (no auth, used by DO health checks)
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const health = await systemMonitor.getHealth();
    const statusCode = health.overall === 'healthy' ? 200 : health.overall === 'degraded' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error: any) {
    res.status(503).json({ overall: 'unhealthy', error: error.message });
  }
});

// GET /api/system/notifications/status — check Slack status
router.get('/notifications/status', authenticateToken, (_req: Request, res: Response) => {
  res.json({ enabled: notificationService.isEnabled() });
});

// POST /api/system/notifications/test — send test notification
router.post('/notifications/test', authenticateToken, async (_req: Request, res: Response) => {
  try {
    await notificationService.sendSystemAlert('Test notification from Algo Trading V2');
    res.json({ success: true, message: 'Test notification sent' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Operations Tools ─────────────────────────────────────────

// POST /api/system/check-exchange — test exchange connectivity per account
router.post('/check-exchange', authenticateToken, async (_req: Request, res: Response): Promise<void> => {
  try {
    const accountIds = await exchangeManager.getActiveAccountIds();
    const results: { accountId: number; status: string; serverTime?: number; error?: string }[] = [];

    for (const accountId of accountIds) {
      try {
        const adapter = await exchangeManager.getForAccount(accountId);
        const serverTime = await adapter.getServerTime();
        results.push({ accountId, status: 'ok', serverTime });
      } catch (err: any) {
        results.push({ accountId, status: 'error', error: err.message });
      }
    }

    res.json({ success: true, data: { accounts: results, total: accountIds.length } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/system/check-database — test DB connection + table counts
router.get('/check-database', authenticateToken, async (_req: Request, res: Response): Promise<void> => {
  try {
    const start = Date.now();
    await databaseService.query('SELECT 1');
    const latencyMs = Date.now() - start;

    const tables = ['users', 'trading_accounts', 'trades', 'portfolio_snapshots', 'backtest_runs'];
    const counts: Record<string, number> = {};
    for (const table of tables) {
      try {
        const result = await databaseService.query(`SELECT COUNT(*) as count FROM ${table}`);
        counts[table] = parseInt(result.rows[0]?.['count'] ?? '0');
      } catch {
        counts[table] = -1; // table doesn't exist
      }
    }

    res.json({ success: true, data: { status: 'connected', latencyMs, tables: counts } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/system/force-snapshot — trigger equity snapshot for all accounts
router.post('/force-snapshot', authenticateToken, async (_req: Request, res: Response): Promise<void> => {
  try {
    const accountIds = await exchangeManager.getActiveAccountIds();
    const results: { accountId: number; status: string; equity?: number; error?: string }[] = [];

    for (const accountId of accountIds) {
      try {
        const snapshot = await equityTracker.takeSnapshot(accountId);
        results.push({
          accountId,
          status: snapshot ? 'ok' : 'no_data',
          equity: snapshot?.totalEquity,
        });
      } catch (err: any) {
        results.push({ accountId, status: 'error', error: err.message });
      }
    }

    res.json({ success: true, data: { snapshots: results, total: accountIds.length } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/system/funding-rates — get top funding rates from Bybit
router.get('/funding-rates', authenticateToken, async (_req: Request, res: Response): Promise<void> => {
  try {
    const adapter = exchangeManager.getDefault();
    const symbols = await adapter.getActiveSymbols();

    // Fetch funding rates for top symbols (limit to avoid rate limits)
    const topSymbols = symbols.slice(0, 30);
    const rates: { symbol: string; fundingRate: number; nextFundingTime: number }[] = [];

    for (const symbol of topSymbols) {
      try {
        const rate = await adapter.getFundingRate(symbol);
        rates.push(rate);
      } catch {
        // Skip symbols that fail
      }
    }

    // Sort by absolute funding rate descending
    rates.sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate));

    res.json({ success: true, data: { rates: rates.slice(0, 20), fetched: rates.length } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/system/clear-cache — clear candle cache
router.post('/clear-cache', authenticateToken, async (_req: Request, res: Response): Promise<void> => {
  try {
    const before = candleService.getCacheStats();
    candleService.clearCache();
    const after = candleService.getCacheStats();

    res.json({ success: true, data: { before, after } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/system/ws-clients — get WebSocket client details
router.get('/ws-clients', authenticateToken, async (_req: Request, res: Response): Promise<void> => {
  try {
    const details = wsBroadcaster.getClientDetails();
    res.json({ success: true, data: details });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/system/logs — get recent log entries
router.get('/logs', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query['limit'] as string) || 50, 200);
    const level = req.query['level'] as string | undefined;

    const validLevels = ['debug', 'info', 'warn', 'error'];
    const logs = logger.getRecentLogs(
      limit,
      level && validLevels.includes(level) ? level as any : undefined
    );

    res.json({ success: true, data: { logs, total: logs.length } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/system/rate-limit — get rate limit info
router.get('/rate-limit', authenticateToken, async (_req: Request, res: Response): Promise<void> => {
  try {
    // Read rate-limit headers that express-rate-limit sets on this very response
    // Since we can't inspect other requests' state, report the config and current response headers
    const windowMs = 15 * 60 * 1000;
    const maxRequests = 200;

    res.json({
      success: true,
      data: {
        windowMs,
        maxRequests,
        windowMinutes: windowMs / 60000,
        remaining: res.getHeader('RateLimit-Remaining') ?? 'N/A',
        limit: res.getHeader('RateLimit-Limit') ?? maxRequests,
        resetAt: res.getHeader('RateLimit-Reset') ? new Date(Number(res.getHeader('RateLimit-Reset')) * 1000).toISOString() : 'N/A',
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/system/strategy-health — get per-account strategy status
router.get('/strategy-health', authenticateToken, async (_req: Request, res: Response): Promise<void> => {
  try {
    const accountIds = strategyExecutor.getInitializedAccountIds();
    const health: { accountId: number; strategies: Record<string, any> }[] = [];

    for (const accountId of accountIds) {
      const status = strategyExecutor.getStatus(accountId);
      health.push({ accountId, strategies: status });
    }

    res.json({ success: true, data: { accounts: health, totalAccounts: accountIds.length } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
