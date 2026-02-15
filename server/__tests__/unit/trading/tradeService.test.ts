/**
 * TradeService unit tests — CRUD, balance validation, order flow.
 * Mocks: database, exchange manager, risk service.
 */

import { createMockExchange } from '../../mocks/testData';

const mockExchange = createMockExchange();

// ── Mock database ──
jest.mock('../../../src/services/database/connection', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
    getOne: jest.fn(),
    getAll: jest.fn(),
    insert: jest.fn(),
  },
}));

// ── Mock exchange manager ──
jest.mock('../../../src/services/exchange/exchangeManager', () => ({
  __esModule: true,
  default: {
    getForAccount: jest.fn().mockResolvedValue(mockExchange),
  },
}));

// ── Mock risk service ──
jest.mock('../../../src/services/trading/riskService', () => ({
  __esModule: true,
  default: {
    validateTrade: jest.fn().mockResolvedValue({ passed: true }),
  },
}));

import tradeService from '../../../src/services/trading/tradeService';
import db from '../../../src/services/database/connection';
import riskService from '../../../src/services/trading/riskService';

const mockDb = db as jest.Mocked<typeof db>;

// ── Helpers ──────────────────────────────────────────────────

const TRADE_ROW = {
  id: 1,
  user_id: 'user-1',
  trading_account_id: 1,
  symbol: 'BTCUSDT',
  exchange: 'bybit',
  is_test: false,
  trade_type: 'manual',
  side: 'long',
  entry_price: 50000,
  quantity: 0.1,
  remaining_quantity: 0.1,
  leverage: 3,
  status: 'active',
  realized_pnl: 0,
  unrealized_pnl: 0,
  additional_info: { stop_loss: 49000, take_profit: 55000 },
  created_at: new Date(),
  updated_at: new Date(),
};

// ── createTrade ──────────────────────────────────────────────

describe('TradeService — createTrade', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // DB returns newly created trade row
    (mockDb.query as jest.Mock).mockResolvedValue({ rows: [TRADE_ROW] });
  });

  it('should create a trade with market order', async () => {
    const { trade, order } = await tradeService.createTrade({
      tradingAccountId: 1,
      symbol: 'BTCUSDT',
      side: 'long',
      quantity: 0.1,
      leverage: 3,
      orderType: 'market',
      stopLoss: 49000,
      takeProfit: 55000,
    });

    expect(trade.id).toBe(1);
    expect(order.orderId).toBe('mock-order-1');
    expect(riskService.validateTrade).toHaveBeenCalledTimes(1);
    expect(mockExchange.placeOrder).toHaveBeenCalledTimes(1);
    expect(mockExchange.setLeverage).toHaveBeenCalledWith('BTCUSDT', 3);
    // DB query called twice: insert trade + insert order
    expect(mockDb.query).toHaveBeenCalledTimes(2);
  });

  it('should reject trade when risk check fails', async () => {
    (riskService.validateTrade as jest.Mock).mockResolvedValueOnce({ passed: false, error: 'Max loss exceeded' });

    await expect(
      tradeService.createTrade({
        tradingAccountId: 1,
        symbol: 'BTCUSDT',
        side: 'long',
        quantity: 1,
        orderType: 'market',
      })
    ).rejects.toThrow('Risk check failed: Max loss exceeded');

    expect(mockExchange.placeOrder).not.toHaveBeenCalled();
  });

  it('should reject trade when balance insufficient', async () => {
    // Make balance check return insufficient
    mockExchange.getBalances.mockResolvedValueOnce([
      { coin: 'USDT', available: 10, total: 10, unrealizedPnl: 0 },
    ]);

    await expect(
      tradeService.createTrade({
        tradingAccountId: 1,
        symbol: 'BTCUSDT',
        side: 'long',
        quantity: 1,
        orderType: 'market',
        leverage: 1,
      })
    ).rejects.toThrow('Insufficient margin');

    expect(mockExchange.placeOrder).not.toHaveBeenCalled();
  });

  it('should fetch ticker price when no price provided (market order)', async () => {
    await tradeService.createTrade({
      tradingAccountId: 1,
      symbol: 'BTCUSDT',
      side: 'long',
      quantity: 0.1,
      orderType: 'market',
    });

    expect(mockExchange.getTicker).toHaveBeenCalledWith('BTCUSDT');
  });
});

// ── getTradeById ─────────────────────────────────────────────

describe('TradeService — getTradeById', () => {
  it('should return trade when found', async () => {
    (mockDb.query as jest.Mock).mockResolvedValueOnce({ rows: [TRADE_ROW] });
    const trade = await tradeService.getTradeById(1);
    expect(trade).not.toBeNull();
    expect(trade!.id).toBe(1);
    expect(trade!.symbol).toBe('BTCUSDT');
  });

  it('should return null when not found', async () => {
    (mockDb.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    const trade = await tradeService.getTradeById(999);
    expect(trade).toBeNull();
  });
});

// ── getTrades with filters ───────────────────────────────────

describe('TradeService — getTrades', () => {
  beforeEach(() => {
    (mockDb.query as jest.Mock).mockResolvedValue({ rows: [TRADE_ROW] });
  });

  it('should build query with no filters', async () => {
    await tradeService.getTrades();
    const call = (mockDb.query as jest.Mock).mock.calls[0];
    expect(call[0]).toContain('SELECT * FROM trades');
    expect(call[0]).not.toContain('WHERE');
  });

  it('should build query with all filters', async () => {
    await tradeService.getTrades({
      tradingAccountId: 1,
      userId: 'user-1',
      status: 'active',
      symbol: 'BTCUSDT',
      strategyName: 'trend_following',
      limit: 10,
      offset: 5,
    });
    const call = (mockDb.query as jest.Mock).mock.calls[0];
    expect(call[0]).toContain('WHERE');
    expect(call[0]).toContain('trading_account_id');
    expect(call[0]).toContain('user_id');
    expect(call[0]).toContain('status');
    expect(call[0]).toContain('symbol');
    expect(call[0]).toContain('strategy_name');
    expect(call[1]).toEqual([1, 'user-1', 'active', 'BTCUSDT', 'trend_following', 10, 5]);
  });
});

// ── closeTrade ───────────────────────────────────────────────

describe('TradeService — closeTrade', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should close an active trade', async () => {
    // First query: getTradeById
    (mockDb.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [TRADE_ROW] })
      // Second: insert close order
      .mockResolvedValueOnce({ rows: [] })
      // Third: update trade
      .mockResolvedValueOnce({ rows: [{ ...TRADE_ROW, status: 'closed', remaining_quantity: 0 }] });

    mockExchange.placeOrder.mockResolvedValueOnce({
      orderId: 'close-order-1', symbol: 'BTCUSDT', side: 'sell', orderType: 'market',
      quantity: 0.1, status: 'filled', filledQuantity: 0.1, avgFillPrice: 52000,
      fees: 3.12, timeInForce: 'GTC', reduceOnly: true,
      createdAt: Date.now(), updatedAt: Date.now(),
    });

    const { trade, order } = await tradeService.closeTrade(1);
    expect(trade.status).toBe('closed');
    expect(order.side).toBe('sell'); // Opposite of long
    expect(order.reduceOnly).toBe(true);
  });

  it('should reject closing a non-active trade', async () => {
    (mockDb.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ ...TRADE_ROW, status: 'closed' }],
    });

    await expect(tradeService.closeTrade(1)).rejects.toThrow('not active');
  });

  it('should reject closing a non-existent trade', async () => {
    (mockDb.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    await expect(tradeService.closeTrade(999)).rejects.toThrow('not found');
  });
});

// ── validateBalance ──────────────────────────────────────────

describe('TradeService — validateBalance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should pass when balance sufficient', async () => {
    const result = await tradeService.validateBalance(1, 0.1, 50000, 10);
    // Required margin = (0.1 * 50000) / 10 = 500
    expect(result.valid).toBe(true);
    expect(result.required).toBe(500);
    expect(result.available).toBe(8000);
  });

  it('should fail when balance insufficient', async () => {
    mockExchange.getBalances.mockResolvedValueOnce([
      { coin: 'USDT', available: 100, total: 100, unrealizedPnl: 0 },
    ]);

    const result = await tradeService.validateBalance(1, 1, 50000, 1);
    // Required margin = (1 * 50000) / 1 = 50000
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Insufficient margin');
  });

  it('should handle exchange errors gracefully', async () => {
    mockExchange.getBalances.mockRejectedValueOnce(new Error('Exchange timeout'));

    const result = await tradeService.validateBalance(1, 0.1, 50000, 10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Balance check failed');
  });
});

// ── cancelOrder ──────────────────────────────────────────────

describe('TradeService — cancelOrder', () => {
  it('should cancel on exchange and update DB', async () => {
    (mockDb.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    await tradeService.cancelOrder(1, 'BTCUSDT', 'order-abc');
    expect(mockExchange.cancelOrder).toHaveBeenCalledWith('BTCUSDT', 'order-abc');
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE orders SET status'),
      ['order-abc']
    );
  });
});
