/**
 * Trading Routes — REST API for trade management (account-scoped).
 *
 * All routes require authentication + valid trading account.
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from './auth';
import { resolveAccount } from '../middleware/accountContext';
import tradeService from '../services/trading/tradeService';

const router = Router();

// All trading routes require authentication + account context
router.use(authenticateToken);
router.use(resolveAccount);

// ── Create trade ─────────────────────────────────────────

router.post('/trades', async (req: Request, res: Response) => {
  try {
    const accountId = req.tradingAccountId!;
    const {
      symbol, side, quantity, leverage,
      tradeType, strategyName, strategyParams,
      orderType, price, stopLoss, takeProfit, timeInForce, notes,
    } = req.body;

    if (!symbol || !side || !quantity || !orderType) {
      res.status(400).json({ error: 'Missing required fields: symbol, side, quantity, orderType' });
      return;
    }

    const result = await tradeService.createTrade({
      tradingAccountId: accountId,
      userId: req.user?.id?.toString() || 'default',
      symbol,
      side,
      quantity: Number(quantity),
      leverage: leverage ? Number(leverage) : undefined,
      tradeType: tradeType || 'manual',
      strategyName,
      strategyParams,
      orderType,
      price: price ? Number(price) : undefined,
      stopLoss: stopLoss ? Number(stopLoss) : undefined,
      takeProfit: takeProfit ? Number(takeProfit) : undefined,
      timeInForce,
      notes,
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('[Trading] Create trade error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// ── List trades ──────────────────────────────────────────

router.get('/trades', async (req: Request, res: Response) => {
  try {
    const accountId = req.tradingAccountId!;
    const status = req.query['status'] as string | undefined;
    const symbol = req.query['symbol'] as string | undefined;
    const strategyName = req.query['strategyName'] as string | undefined;
    const limit = req.query['limit'] as string | undefined;
    const offset = req.query['offset'] as string | undefined;

    const trades = await tradeService.getTrades({
      tradingAccountId: accountId,
      userId: req.user?.id?.toString(),
      status,
      symbol,
      strategyName,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });

    res.json({ trades });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Get trade by ID ──────────────────────────────────────

router.get('/trades/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    const result = await tradeService.getTradeWithOrders(Number(id));
    if (!result) {
      res.status(404).json({ error: 'Trade not found' });
      return;
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Update trade SL/TP ──────────────────────────────────

router.put('/trades/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    const { stopLoss, takeProfit } = req.body;
    const trade = await tradeService.updateTradeSLTP(
      Number(id),
      stopLoss !== undefined ? Number(stopLoss) : undefined,
      takeProfit !== undefined ? Number(takeProfit) : undefined
    );
    res.json({ trade });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ── Close trade ──────────────────────────────────────────

router.post('/trades/:id/close', async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    const { quantity } = req.body;
    const result = await tradeService.closeTrade(
      Number(id),
      quantity ? Number(quantity) : undefined
    );
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ── Cancel order ─────────────────────────────────────────

router.delete('/orders/:id', async (req: Request, res: Response) => {
  try {
    const accountId = req.tradingAccountId!;
    const orderId = req.params['id'] as string;
    const symbol = req.query['symbol'] as string | undefined;
    if (!symbol) {
      res.status(400).json({ error: 'Missing required query parameter: symbol' });
      return;
    }
    await tradeService.cancelOrder(accountId, symbol, orderId);
    res.json({ message: 'Order cancelled' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ── Get positions from exchange ──────────────────────────

router.get('/positions', async (req: Request, res: Response) => {
  try {
    const accountId = req.tradingAccountId!;
    const symbol = req.query['symbol'] as string | undefined;
    const positions = await tradeService.getPositions(accountId, symbol);
    res.json({ positions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Get balance from exchange ────────────────────────────

router.get('/balance', async (req: Request, res: Response) => {
  try {
    const accountId = req.tradingAccountId!;
    const balances = await tradeService.getBalance(accountId);
    res.json({ balances });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
