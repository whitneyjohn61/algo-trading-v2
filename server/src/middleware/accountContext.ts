/**
 * Account Context Middleware — resolves tradingAccountId and validates ownership.
 *
 * Extracts tradingAccountId from:
 *   1. X-Trading-Account-Id header (preferred — set once per mode switch)
 *   2. req.body.tradingAccountId (for POST/PUT)
 *   3. req.query.tradingAccountId (for GET)
 *
 * Validates:
 *   - Account exists and is active
 *   - Account belongs to the authenticated user, OR user has admin role
 *
 * Attaches to req:
 *   - req.tradingAccountId (number)
 *   - req.tradingAccount (full account row)
 */

import { Request, Response, NextFunction } from 'express';
import db from '../services/database/connection';

export interface TradingAccountRow {
  id: number;
  user_id: number;
  exchange: string;
  is_test: boolean;
  is_active: boolean;
}

// Extend Express Request to include our custom fields
declare global {
  namespace Express {
    interface Request {
      user?: { id: number; username: string; email: string; role: string; timezone?: string };
      tradingAccountId?: number;
      tradingAccount?: TradingAccountRow;
    }
  }
}

/**
 * Middleware that requires a valid tradingAccountId and validates ownership.
 * Must be used AFTER authenticateToken middleware.
 */
export const resolveAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Extract tradingAccountId from multiple sources
    const rawId =
      (req.headers['x-trading-account-id'] as string) ||
      req.body?.tradingAccountId?.toString() ||
      (req.query['tradingAccountId'] as string | undefined);

    if (!rawId) {
      res.status(400).json({ error: 'Trading account ID is required (X-Trading-Account-Id header, body, or query param)' });
      return;
    }

    const tradingAccountId = Number(rawId);
    if (isNaN(tradingAccountId) || tradingAccountId <= 0) {
      res.status(400).json({ error: 'Invalid trading account ID' });
      return;
    }

    // Fetch account from DB
    const account = await db.getOne(
      `SELECT id, user_id, exchange, is_test, is_active FROM trading_accounts WHERE id = $1`,
      [tradingAccountId]
    );

    if (!account) {
      res.status(404).json({ error: `Trading account not found: ${tradingAccountId}` });
      return;
    }

    if (!account['is_active']) {
      res.status(403).json({ error: `Trading account is inactive: ${tradingAccountId}` });
      return;
    }

    // Ownership check: user owns the account OR user is admin
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;
    const accountUserId = Number(account['user_id']);

    if (accountUserId !== userId && userRole !== 'admin') {
      res.status(403).json({ error: 'Access denied — you do not own this trading account' });
      return;
    }

    // Attach to request
    req.tradingAccountId = tradingAccountId;
    req.tradingAccount = {
      id: Number(account['id']),
      user_id: accountUserId,
      exchange: account['exchange'] as string,
      is_test: account['is_test'] as boolean,
      is_active: account['is_active'] as boolean,
    };

    next();
  } catch (err: any) {
    console.error('[AccountContext] Error resolving account:', err.message);
    res.status(500).json({ error: 'Failed to resolve trading account' });
  }
};

/**
 * Optional middleware that extracts tradingAccountId if provided, but doesn't require it.
 * Useful for routes that can work with or without account scoping.
 */
export const optionalAccount = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const rawId =
    (req.headers['x-trading-account-id'] as string) ||
    req.body?.tradingAccountId?.toString() ||
    (req.query['tradingAccountId'] as string | undefined);

  if (rawId) {
    const tradingAccountId = Number(rawId);
    if (!isNaN(tradingAccountId) && tradingAccountId > 0) {
      req.tradingAccountId = tradingAccountId;
    }
  }

  next();
};
