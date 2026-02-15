import { Router, Request, Response } from 'express';
import exchangeManager from '../services/exchange/exchangeManager';
import type { ExchangeInterval } from '../services/exchange/exchangeService';

const router = Router();

// Market routes are public (no auth required) — same as V1

// ── Candle data ──────────────────────────────────────────

router.get('/candles/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params['symbol'] as string;
    const interval = (req.query['interval'] as string) || '15';
    const limit = (req.query['limit'] as string) || '200';
    const startTime = req.query['startTime'] as string | undefined;
    const endTime = req.query['endTime'] as string | undefined;

    const exchange = exchangeManager.getDefault();
    const candles = await exchange.getCandles(
      symbol,
      interval as ExchangeInterval,
      Number(limit),
      startTime ? Number(startTime) : undefined,
      endTime ? Number(endTime) : undefined
    );

    res.json({ symbol, interval, candles });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to fetch candles: ${error.message}` });
  }
});

// ── Ticker ───────────────────────────────────────────────

router.get('/ticker/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params['symbol'] as string;
    const exchange = exchangeManager.getDefault();
    const ticker = await exchange.getTicker(symbol);
    res.json(ticker);
  } catch (error: any) {
    res.status(500).json({ error: `Failed to fetch ticker: ${error.message}` });
  }
});

// ── Funding rates (all symbols) ──────────────────────────

router.get('/funding-rates', async (_req: Request, res: Response) => {
  try {
    const exchange = exchangeManager.getDefault();
    const symbols = await exchange.getActiveSymbols();

    // Fetch funding rates for top symbols (limit to avoid rate limits)
    const top = symbols.slice(0, 50);
    const rates = await Promise.allSettled(
      top.map(s => exchange.getFundingRate(s))
    );

    const result = rates
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map(r => r.value);

    res.json({ fundingRates: result });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to fetch funding rates: ${error.message}` });
  }
});

// ── Funding rate history ─────────────────────────────────

router.get('/funding-history/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params['symbol'] as string;
    const limit = (req.query['limit'] as string) || '50';
    const exchange = exchangeManager.getDefault();
    const history = await exchange.getFundingRateHistory(symbol, Number(limit));
    res.json({ symbol, history });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to fetch funding history: ${error.message}` });
  }
});

// ── Open interest ────────────────────────────────────────

router.get('/open-interest/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params['symbol'] as string;
    const exchange = exchangeManager.getDefault();
    const oi = await exchange.getOpenInterest(symbol);
    res.json(oi);
  } catch (error: any) {
    res.status(500).json({ error: `Failed to fetch open interest: ${error.message}` });
  }
});

// ── Active symbols ───────────────────────────────────────

router.get('/symbols', async (_req: Request, res: Response) => {
  try {
    const exchange = exchangeManager.getDefault();
    const symbols = await exchange.getActiveSymbols();
    res.json({ symbols });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to fetch symbols: ${error.message}` });
  }
});

// ── Symbol info ──────────────────────────────────────────

router.get('/symbols/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params['symbol'] as string;
    const exchange = exchangeManager.getDefault();
    const info = await exchange.getSymbolInfo(symbol);
    res.json(info);
  } catch (error: any) {
    res.status(500).json({ error: `Failed to fetch symbol info: ${error.message}` });
  }
});

// ── Supported intervals ──────────────────────────────────

router.get('/intervals', async (_req: Request, res: Response) => {
  try {
    const intervals = [
      { value: '1', label: '1 minute' },
      { value: '3', label: '3 minutes' },
      { value: '5', label: '5 minutes' },
      { value: '15', label: '15 minutes' },
      { value: '30', label: '30 minutes' },
      { value: '60', label: '1 hour' },
      { value: '120', label: '2 hours' },
      { value: '240', label: '4 hours' },
      { value: '360', label: '6 hours' },
      { value: '720', label: '12 hours' },
      { value: 'D', label: '1 day' },
      { value: 'W', label: '1 week' },
      { value: 'M', label: '1 month' },
    ];
    res.json({ intervals });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
