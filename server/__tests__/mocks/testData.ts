/**
 * Shared test data — reusable across server unit and integration tests.
 */

import type { Candle } from '../../src/indicators/types';
import type {
  BybitRawBalance, BybitRawPosition, BybitRawOrder,
  BybitRawCandle, BybitRawTicker, BybitRawFundingRate,
  BybitRawSymbolInfo,
} from '../../src/services/exchange/bybit/bybitTypes';

// ── Candle generators ─────────────────────────────────────────

/** Deterministic candle generator with realistic BTC-like price movement */
export function makeCandles(count: number, basePrice: number = 50000): Candle[] {
  const candles: Candle[] = [];
  const startTs = 1700000000000; // 2023-11-14 arbitrary UTC ms

  for (let i = 0; i < count; i++) {
    const offset = Math.sin(i * 0.5) * 500 + i * 10;
    const close = basePrice + offset;
    const high = close + 100 + (i % 3) * 50;
    const low = close - 100 - (i % 4) * 40;
    const open = close - 50 + (i % 2) * 100;
    candles.push({
      timestamp: startTs + i * 60000, // 1-minute candles
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: 100 + i * 10,
    });
  }
  return candles;
}

// ── Raw Bybit fixtures ────────────────────────────────────────

export const RAW_BALANCE: BybitRawBalance = {
  coin: 'USDT',
  walletBalance: '10000.50',
  transferBalance: '9500.00',
  availableToWithdraw: '8500.25',
  equity: '10500.75',
  unrealisedPnl: '500.25',
  totalOrderIM: '200.00',
  totalPositionIM: '1500.00',
};

export const RAW_POSITION: BybitRawPosition = {
  symbol: 'BTCUSDT',
  side: 'Buy',
  size: '0.1',
  avgPrice: '50000',
  entryPrice: '50000',
  markPrice: '52000',
  unrealisedPnl: '200',
  positionBalance: '1666.67',
  leverage: '3',
  liqPrice: '45000',
  stopLoss: '49000',
  takeProfit: '55000',
};

export const RAW_POSITION_ZERO: BybitRawPosition = {
  symbol: 'ETHUSDT',
  side: 'None',
  size: '0',
  markPrice: '3000',
  unrealisedPnl: '0',
  leverage: '1',
  liqPrice: '0',
};

export const RAW_ORDER: BybitRawOrder = {
  orderId: 'order-123-abc',
  symbol: 'BTCUSDT',
  side: 'Buy',
  orderType: 'Market',
  qty: '0.1',
  price: '50000',
  triggerPrice: '',
  orderStatus: 'Filled',
  cumExecQty: '0.1',
  avgPrice: '50050',
  cumExecFee: '3.003',
  timeInForce: 'GTC',
  reduceOnly: false,
  createdTime: '1700000000000',
  updatedTime: '1700000001000',
};

export const RAW_CANDLE: BybitRawCandle = {
  0: '1700000000000',
  1: '50000',
  2: '50500',
  3: '49800',
  4: '50200',
  5: '150.5',
  6: '7575050',
} as unknown as BybitRawCandle;

export const RAW_TICKER: BybitRawTicker = {
  symbol: 'BTCUSDT',
  lastPrice: '50200',
  bid1Price: '50190',
  ask1Price: '50210',
  volume24h: '25000',
  turnover24h: '1250000000',
  price24hPcnt: '0.025',
  highPrice24h: '51000',
  lowPrice24h: '49000',
};

export const RAW_FUNDING_RATE: BybitRawFundingRate = {
  symbol: 'BTCUSDT',
  fundingRate: '0.0001',
  nextFundingTime: '1700006400000',
};

export const RAW_SYMBOL_INFO: BybitRawSymbolInfo = {
  symbol: 'BTCUSDT',
  baseCoin: 'BTC',
  quoteCoin: 'USDT',
  lotSizeFilter: {
    minOrderQty: '0.001',
    maxOrderQty: '100',
    qtyStep: '0.001',
  },
  priceFilter: {
    minPrice: '0.5',
    maxPrice: '999999',
    tickSize: '0.1',
  },
  leverageFilter: {
    minLeverage: '1',
    maxLeverage: '100',
  },
};

// ── Mock exchange adapter ─────────────────────────────────────

export function createMockExchange() {
  return {
    name: 'bybit',
    getTotalEquity: jest.fn().mockResolvedValue(10000),
    getBalances: jest.fn().mockResolvedValue([
      { coin: 'USDT', available: 8000, total: 10000, unrealizedPnl: 200 },
    ]),
    getPositions: jest.fn().mockResolvedValue([
      {
        symbol: 'BTCUSDT', side: 'long', size: 0.1, entryPrice: 50000,
        markPrice: 52000, unrealizedPnl: 200, leverage: 3, margin: 1667,
        liquidationPrice: 45000,
      },
    ]),
    getTicker: jest.fn().mockResolvedValue({
      symbol: 'BTCUSDT', lastPrice: 50000, bid: 49990, ask: 50010,
      volume24h: 25000, turnover24h: 1250000000, priceChange24hPct: 2.5,
      highPrice24h: 51000, lowPrice24h: 49000,
    }),
    placeOrder: jest.fn().mockResolvedValue({
      orderId: 'mock-order-1', symbol: 'BTCUSDT', side: 'buy', orderType: 'market',
      quantity: 0.1, status: 'filled', filledQuantity: 0.1, avgFillPrice: 50000,
      fees: 3, timeInForce: 'GTC', reduceOnly: false,
      createdAt: Date.now(), updatedAt: Date.now(),
    }),
    cancelOrder: jest.fn().mockResolvedValue(undefined),
    modifyOrder: jest.fn().mockResolvedValue({}),
    setStopLossTakeProfit: jest.fn().mockResolvedValue(undefined),
    setLeverage: jest.fn().mockResolvedValue(undefined),
    getLeverage: jest.fn().mockResolvedValue(3),
    getCandles: jest.fn().mockResolvedValue([]),
    getFundingRate: jest.fn().mockResolvedValue({ symbol: 'BTCUSDT', fundingRate: 0.0001, nextFundingTime: 0 }),
    getFundingRateHistory: jest.fn().mockResolvedValue([]),
    getOpenInterest: jest.fn().mockResolvedValue({ symbol: 'BTCUSDT', openInterest: 0, timestamp: 0 }),
    getActiveSymbols: jest.fn().mockResolvedValue(['BTCUSDT', 'ETHUSDT']),
    getSymbolInfo: jest.fn().mockResolvedValue({}),
    getServerTime: jest.fn().mockResolvedValue(Date.now()),
  };
}
