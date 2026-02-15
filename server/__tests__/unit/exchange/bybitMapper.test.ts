/**
 * BybitMapper unit tests — pure data transformation functions.
 * No mocks needed — these are stateless mappers.
 */

import {
  mapBalance, mapPosition, mapOrder,
  mapCandle, mapTicker, mapFundingRate, mapSymbolInfo,
} from '../../../src/services/exchange/bybit/bybitMapper';
import {
  RAW_BALANCE, RAW_POSITION, RAW_POSITION_ZERO, RAW_ORDER,
  RAW_CANDLE, RAW_TICKER, RAW_FUNDING_RATE, RAW_SYMBOL_INFO,
} from '../../mocks/testData';

// ── mapBalance ──────────────────────────────────────────────────

describe('mapBalance', () => {
  it('should map all fields correctly', () => {
    const result = mapBalance(RAW_BALANCE);
    expect(result.coin).toBe('USDT');
    expect(result.available).toBe(8500.25);
    expect(result.total).toBe(10500.75);
    expect(result.unrealizedPnl).toBe(500.25);
  });

  it('should fallback to walletBalance when other fields missing', () => {
    const result = mapBalance({
      coin: 'BTC',
      walletBalance: '1.5',
    });
    expect(result.coin).toBe('BTC');
    expect(result.available).toBe(1.5); // falls back to walletBalance
    expect(result.total).toBe(1.5);     // falls back to walletBalance
    expect(result.unrealizedPnl).toBe(0);
  });

  it('should handle empty/undefined fields gracefully', () => {
    const result = mapBalance({ coin: 'ETH' });
    expect(result.coin).toBe('ETH');
    expect(result.available).toBe(0);
    expect(result.total).toBe(0);
    expect(result.unrealizedPnl).toBe(0);
  });
});

// ── mapPosition ─────────────────────────────────────────────────

describe('mapPosition', () => {
  it('should map Buy side to long', () => {
    const result = mapPosition(RAW_POSITION);
    expect(result).not.toBeNull();
    expect(result!.symbol).toBe('BTCUSDT');
    expect(result!.side).toBe('long');
    expect(result!.size).toBe(0.1);
    expect(result!.entryPrice).toBe(50000);
    expect(result!.markPrice).toBe(52000);
    expect(result!.unrealizedPnl).toBe(200);
    expect(result!.leverage).toBe(3);
    expect(result!.margin).toBe(1666.67);
    expect(result!.liquidationPrice).toBe(45000);
    expect(result!.stopLoss).toBe(49000);
    expect(result!.takeProfit).toBe(55000);
  });

  it('should map Sell side to short', () => {
    const result = mapPosition({
      ...RAW_POSITION,
      side: 'Sell',
    });
    expect(result).not.toBeNull();
    expect(result!.side).toBe('short');
  });

  it('should return null for zero-size position', () => {
    const result = mapPosition(RAW_POSITION_ZERO);
    expect(result).toBeNull();
  });

  it('should handle missing SL/TP gracefully', () => {
    const result = mapPosition({
      ...RAW_POSITION,
      stopLoss: undefined,
      takeProfit: undefined,
    });
    expect(result).not.toBeNull();
    expect(result!.stopLoss).toBeUndefined();
    expect(result!.takeProfit).toBeUndefined();
  });
});

// ── mapOrder ────────────────────────────────────────────────────

describe('mapOrder', () => {
  it('should map all fields correctly', () => {
    const result = mapOrder(RAW_ORDER);
    expect(result.orderId).toBe('order-123-abc');
    expect(result.symbol).toBe('BTCUSDT');
    expect(result.side).toBe('buy');
    expect(result.orderType).toBe('market');
    expect(result.quantity).toBe(0.1);
    expect(result.status).toBe('filled');
    expect(result.filledQuantity).toBe(0.1);
    expect(result.avgFillPrice).toBe(50050);
    expect(result.fees).toBe(3.003);
    expect(result.timeInForce).toBe('GTC');
    expect(result.reduceOnly).toBe(false);
    expect(result.createdAt).toBe(1700000000000);
    expect(result.updatedAt).toBe(1700000001000);
  });

  it('should map Sell side to sell', () => {
    const result = mapOrder({ ...RAW_ORDER, side: 'Sell' });
    expect(result.side).toBe('sell');
  });

  it('should map status correctly', () => {
    expect(mapOrder({ ...RAW_ORDER, orderStatus: 'New' }).status).toBe('open');
    expect(mapOrder({ ...RAW_ORDER, orderStatus: 'PartiallyFilled' }).status).toBe('partially_filled');
    expect(mapOrder({ ...RAW_ORDER, orderStatus: 'Cancelled' }).status).toBe('cancelled');
    expect(mapOrder({ ...RAW_ORDER, orderStatus: 'Rejected' }).status).toBe('rejected');
    expect(mapOrder({ ...RAW_ORDER, orderStatus: 'Untriggered' }).status).toBe('pending');
    expect(mapOrder({ ...RAW_ORDER, orderStatus: 'Triggered' }).status).toBe('open');
  });

  it('should use fallback fields for ambiguous names', () => {
    const result = mapOrder({
      symbol: 'ETHUSDT',
      side: 'Buy',
      type: 'Limit',        // fallback for orderType
      quantity: '2.5',       // fallback for qty
      status: 'New',         // fallback for orderStatus
      createTime: '1700000000000', // fallback for createdTime
    });
    expect(result.orderType).toBe('limit');
    expect(result.quantity).toBe(2.5);
    expect(result.status).toBe('open');
  });

  it('should handle orderLinkId when orderId missing', () => {
    const result = mapOrder({
      ...RAW_ORDER,
      orderId: undefined,
      orderLinkId: 'link-456',
    });
    expect(result.orderId).toBe('link-456');
  });
});

// ── mapCandle ───────────────────────────────────────────────────

describe('mapCandle', () => {
  it('should map array-like raw candle to object', () => {
    const result = mapCandle(RAW_CANDLE, '60');
    expect(result.timestamp).toBe(1700000000000);
    expect(result.open).toBe(50000);
    expect(result.high).toBe(50500);
    expect(result.low).toBe(49800);
    expect(result.close).toBe(50200);
    expect(result.volume).toBe(150.5);
    expect(result.turnover).toBe(7575050);
  });

  it('should set confirmed based on interval and current time', () => {
    // Candle from 2023 should be confirmed
    const result = mapCandle(RAW_CANDLE, '60');
    expect(result.confirmed).toBe(true);
  });

  it('should mark future candle as not confirmed', () => {
    const futureCandle = {
      0: String(Date.now() + 3600000), // 1h in the future
      1: '50000', 2: '50500', 3: '49800', 4: '50200', 5: '150', 6: '7500000',
    } as any;
    const result = mapCandle(futureCandle, '60');
    expect(result.confirmed).toBe(false);
  });
});

// ── mapTicker ───────────────────────────────────────────────────

describe('mapTicker', () => {
  it('should map all fields and convert price24hPcnt to percentage', () => {
    const result = mapTicker(RAW_TICKER);
    expect(result.symbol).toBe('BTCUSDT');
    expect(result.lastPrice).toBe(50200);
    expect(result.bid).toBe(50190);
    expect(result.ask).toBe(50210);
    expect(result.volume24h).toBe(25000);
    expect(result.turnover24h).toBe(1250000000);
    expect(result.priceChange24hPct).toBe(2.5); // 0.025 * 100
    expect(result.highPrice24h).toBe(51000);
    expect(result.lowPrice24h).toBe(49000);
  });
});

// ── mapFundingRate ──────────────────────────────────────────────

describe('mapFundingRate', () => {
  it('should map funding rate and next funding time', () => {
    const result = mapFundingRate(RAW_FUNDING_RATE);
    expect(result.symbol).toBe('BTCUSDT');
    expect(result.fundingRate).toBe(0.0001);
    expect(result.nextFundingTime).toBe(1700006400000);
  });
});

// ── mapSymbolInfo ───────────────────────────────────────────────

describe('mapSymbolInfo', () => {
  it('should map all filter fields to numbers', () => {
    const result = mapSymbolInfo(RAW_SYMBOL_INFO);
    expect(result.symbol).toBe('BTCUSDT');
    expect(result.baseCoin).toBe('BTC');
    expect(result.quoteCoin).toBe('USDT');
    expect(result.minOrderQty).toBe(0.001);
    expect(result.maxOrderQty).toBe(100);
    expect(result.qtyStep).toBe(0.001);
    expect(result.minPrice).toBe(0.5);
    expect(result.maxPrice).toBe(999999);
    expect(result.priceStep).toBe(0.1);
    expect(result.minLeverage).toBe(1);
    expect(result.maxLeverage).toBe(100);
  });
});
