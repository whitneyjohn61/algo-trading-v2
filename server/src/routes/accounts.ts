/**
 * Trading accounts CRUD routes.
 * Transplanted from V1's tradingAccounts.ts, adapted for V2 schema.
 */

import express, { Request, Response } from 'express';
import { authenticateToken } from './auth';
import db from '../services/database/connection';
import exchangeManager from '../services/exchange/exchangeManager';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ── Helpers ───────────────────────────────────────────────────

function maskApiKey(key: string | null): string | null {
  if (!key || key.length < 8) return key;
  return '****' + key.slice(-4);
}

function isAdmin(req: Request): boolean {
  return (req as any).user?.role === 'admin';
}

function getUserId(req: Request): number {
  return Number((req as any).user?.id);
}

// ── GET /api/accounts — List trading accounts ─────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const admin = isAdmin(req);
    const includeInactive = req.query['includeInactive'] === 'true';

    let query: string;
    const params: unknown[] = [];

    if (admin) {
      query = `SELECT ta.*, u.username
               FROM trading_accounts ta
               LEFT JOIN users u ON u.id = ta.user_id
               ${includeInactive ? '' : 'WHERE ta.is_active = true'}
               ORDER BY ta.created_at DESC`;
    } else {
      query = `SELECT ta.*, u.username
               FROM trading_accounts ta
               LEFT JOIN users u ON u.id = ta.user_id
               WHERE ta.user_id = $1 ${includeInactive ? '' : 'AND ta.is_active = true'}
               ORDER BY ta.created_at DESC`;
      params.push(userId);
    }

    const rows = await db.getAll(query, params);

    // Mask API keys in list view
    const masked = rows.map((r: Record<string, unknown>) => ({
      ...r,
      api_key: maskApiKey(r['api_key'] as string | null),
      api_secret: maskApiKey(r['api_secret'] as string | null),
    }));

    res.json({ success: true, data: masked, total: masked.length });
  } catch (error: any) {
    console.error('[Accounts] List error:', error.message);
    res.status(500).json({ error: 'Failed to list accounts' });
  }
});

// ── GET /api/accounts/:id — Get account detail (full keys for editing) ─

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const accountId = Number(req.params['id']);
    const userId = getUserId(req);
    const admin = isAdmin(req);

    const account = await db.getOne('SELECT * FROM trading_accounts WHERE id = $1', [accountId]);
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    // Permission: admin or owner
    if (!admin && Number(account['user_id']) !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({ success: true, data: account });
  } catch (error: any) {
    console.error('[Accounts] Get error:', error.message);
    res.status(500).json({ error: 'Failed to get account' });
  }
});

// ── POST /api/accounts — Create trading account ──────────────

router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const admin = isAdmin(req);
    const {
      user_id,
      exchange = 'bybit',
      api_key,
      api_secret,
      is_test = true,
      params: accountParams,
    } = req.body;

    // Admin can create for another user; regular users only for themselves
    const targetUserId = (admin && user_id) ? Number(user_id) : userId;

    if (!api_key || !api_secret) {
      res.status(400).json({ error: 'api_key and api_secret are required' });
      return;
    }

    const row = await db.insert(
      `INSERT INTO trading_accounts (user_id, exchange, api_key, api_secret, is_test, params)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [targetUserId, exchange, api_key, api_secret, is_test, JSON.stringify(accountParams || {})],
    );

    res.status(201).json({ success: true, data: row });
  } catch (error: any) {
    console.error('[Accounts] Create error:', error.message);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// ── PUT /api/accounts/:id — Update trading account ────────────

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const accountId = Number(req.params['id']);
    const userId = getUserId(req);
    const admin = isAdmin(req);

    const existing = await db.getOne('SELECT * FROM trading_accounts WHERE id = $1', [accountId]);
    if (!existing) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    if (!admin && Number(existing['user_id']) !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const updatableFields = ['exchange', 'api_key', 'api_secret', 'is_test', 'is_active', 'params', 'current_balance'];
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const field of updatableFields) {
      if (req.body[field] !== undefined) {
        const val = field === 'params' ? JSON.stringify(req.body[field]) : req.body[field];
        updates.push(`${field} = $${idx++}`);
        values.push(val);
      }
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    values.push(accountId);
    const row = await db.insert(
      `UPDATE trading_accounts SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );

    // Evict cached exchange adapter if credentials changed
    if (req.body['api_key'] || req.body['api_secret'] || req.body['is_test'] !== undefined) {
      exchangeManager.evictAccount(accountId);
    }

    res.json({ success: true, data: row });
  } catch (error: any) {
    console.error('[Accounts] Update error:', error.message);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// ── DELETE /api/accounts/:id — Soft-delete (deactivate) ───────

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const accountId = Number(req.params['id']);
    const userId = getUserId(req);
    const admin = isAdmin(req);

    const existing = await db.getOne('SELECT * FROM trading_accounts WHERE id = $1', [accountId]);
    if (!existing) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    if (!admin && Number(existing['user_id']) !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    await db.update('UPDATE trading_accounts SET is_active = false WHERE id = $1', [accountId]);
    exchangeManager.evictAccount(accountId);

    res.json({ success: true, message: 'Account deactivated' });
  } catch (error: any) {
    console.error('[Accounts] Delete error:', error.message);
    res.status(500).json({ error: 'Failed to deactivate account' });
  }
});

// ── POST /api/accounts/verify — Verify API key credentials ───

router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { exchange = 'bybit', api_key, api_secret, is_test = true } = req.body;

    if (!api_key || !api_secret) {
      res.status(400).json({ error: 'api_key and api_secret are required' });
      return;
    }

    // Create a temporary adapter to test credentials
    const service = exchangeManager.createAdapter(exchange, api_key, api_secret, is_test);
    const balances = await service.getBalances();

    let totalBalance = 0;
    for (const b of balances) {
      totalBalance += b.total;
    }

    res.json({
      success: true,
      data: {
        valid: true,
        balances,
        totalBalance,
      },
    });
  } catch (error: any) {
    console.error('[Accounts] Verify error:', error.message);
    res.json({
      success: false,
      data: { valid: false, error: error.message },
    });
  }
});

// ── GET /api/accounts/:id/balance — Live balance from exchange ─

router.get('/:id/balance', async (req: Request, res: Response) => {
  try {
    const accountId = Number(req.params['id']);
    const userId = getUserId(req);
    const admin = isAdmin(req);

    const account = await db.getOne('SELECT * FROM trading_accounts WHERE id = $1', [accountId]);
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    if (!admin && Number(account['user_id']) !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const service = await exchangeManager.getForAccount(accountId);
    const balances = await service.getBalances();

    let totalBalance = 0;
    for (const b of balances) {
      totalBalance += b.total;
    }

    // Update cached balance in DB
    await db.update(
      'UPDATE trading_accounts SET current_balance = $1 WHERE id = $2',
      [totalBalance, accountId],
    );

    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: { balances, totalBalance } });
  } catch (error: any) {
    console.error('[Accounts] Balance error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
