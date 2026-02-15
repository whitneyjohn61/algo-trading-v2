import {
  BybitRawBalance, BybitRawPosition, BybitRawOrder,
  BybitRawCandle, BybitRawTicker, BybitRawFundingRate,
  BybitRawSymbolInfo, INTERVAL_MINUTES,
} from './bybitTypes';
import {
  ExchangeBalance, ExchangePosition, ExchangeOrder,
  ExchangeCandle, ExchangeTicker, ExchangeFundingRate,
  ExchangeSymbolInfo,
} from '../exchangeService';

// All numeric values from Bybit are strings — parse with parseFloat(x || '0')
function num(value: string | undefined | null): number {
  return parseFloat(value || '0') || 0;
}

export function mapBalance(raw: BybitRawBalance): ExchangeBalance {
  return {
    coin: raw.coin,
    // transferBalance fallback to walletBalance
    available: num(raw.availableToWithdraw) || num(raw.transferBalance) || num(raw.walletBalance),
    total: num(raw.equity) || num(raw.walletBalance),
    unrealizedPnl: num(raw.unrealisedPnl), // British spelling
  };
}

export function mapPosition(raw: BybitRawPosition): ExchangePosition | null {
  const size = num(raw.size);
  if (size === 0) return null; // No position

  return {
    symbol: raw.symbol,
    side: raw.side === 'Buy' ? 'long' : 'short',
    size,
    entryPrice: num(raw.avgPrice) || num(raw.entryPrice),
    markPrice: num(raw.markPrice),
    unrealizedPnl: num(raw.unrealisedPnl), // British spelling
    leverage: num(raw.leverage),
    margin: num(raw.positionBalance), // positionBalance, NOT positionMargin
    liquidationPrice: num(raw.liqPrice),
    stopLoss: raw.stopLoss ? num(raw.stopLoss) : undefined,
    takeProfit: raw.takeProfit ? num(raw.takeProfit) : undefined,
  };
}

export function mapOrder(raw: BybitRawOrder): ExchangeOrder {
  // Handle field ambiguity
  const orderId = raw.orderId || raw.orderLinkId || '';
  const orderType = (raw.orderType || raw.type || 'market').toLowerCase();
  const quantity = num(raw.qty) || num(raw.quantity);
  const status = (raw.orderStatus || raw.status || 'pending').toLowerCase();
  const createdTime = raw.createdTime || raw.createTime || raw.createdAt || '0';
  const updatedTime = raw.updatedTime || createdTime;

  // Map Bybit statuses to unified
  const statusMap: Record<string, ExchangeOrder['status']> = {
    'new': 'open',
    'created': 'open',
    'partiallyFilled': 'partially_filled',
    'partiallyfilled': 'partially_filled',
    'filled': 'filled',
    'cancelled': 'cancelled',
    'canceled': 'cancelled',
    'rejected': 'rejected',
    'deactivated': 'cancelled',
    'untriggered': 'pending',
    'triggered': 'open',
  };

  return {
    orderId,
    symbol: raw.symbol,
    side: raw.side === 'Buy' ? 'buy' : 'sell',
    orderType: orderType === 'limit' ? 'limit' : 'market',
    quantity,
    price: raw.price ? num(raw.price) : undefined,
    stopPrice: raw.triggerPrice ? num(raw.triggerPrice) : undefined,
    status: statusMap[status] || 'pending',
    filledQuantity: num(raw.cumExecQty),
    avgFillPrice: raw.avgPrice ? num(raw.avgPrice) : undefined,
    fees: num(raw.cumExecFee),
    timeInForce: raw.timeInForce || 'GTC',
    reduceOnly: raw.reduceOnly || false,
    createdAt: parseInt(createdTime) || Date.now(),
    updatedAt: parseInt(updatedTime) || Date.now(),
  };
}

export function mapCandle(raw: BybitRawCandle, interval: string): ExchangeCandle {
  const startTime = parseInt(raw[0]);
  const intervalMs = (INTERVAL_MINUTES[interval] || 1) * 60 * 1000;

  return {
    // Bybit candle end time: calculate from start + interval (Bybit's end is 1ms short)
    timestamp: startTime,
    open: num(raw[1]),
    high: num(raw[2]),
    low: num(raw[3]),
    close: num(raw[4]),
    volume: num(raw[5]),
    turnover: num(raw[6]),
    // Mark as confirmed if candle end time is in the past
    confirmed: (startTime + intervalMs) <= Date.now(),
  };
}

export function mapTicker(raw: BybitRawTicker): ExchangeTicker {
  return {
    symbol: raw.symbol,
    lastPrice: num(raw.lastPrice),
    bid: num(raw.bid1Price),
    ask: num(raw.ask1Price),
    volume24h: num(raw.volume24h),
    turnover24h: num(raw.turnover24h),
    priceChange24hPct: num(raw.price24hPcnt) * 100,
    highPrice24h: num(raw.highPrice24h),
    lowPrice24h: num(raw.lowPrice24h),
  };
}

export function mapFundingRate(raw: BybitRawFundingRate): ExchangeFundingRate {
  return {
    symbol: raw.symbol,
    fundingRate: num(raw.fundingRate),
    nextFundingTime: parseInt(raw.nextFundingTime) || 0,
  };
}

export function mapSymbolInfo(raw: BybitRawSymbolInfo): ExchangeSymbolInfo {
  return {
    symbol: raw.symbol,
    baseCoin: raw.baseCoin,
    quoteCoin: raw.quoteCoin,
    minOrderQty: num(raw.lotSizeFilter.minOrderQty),
    maxOrderQty: num(raw.lotSizeFilter.maxOrderQty),
    qtyStep: num(raw.lotSizeFilter.qtyStep),
    minPrice: num(raw.priceFilter.minPrice),
    maxPrice: num(raw.priceFilter.maxPrice),
    priceStep: num(raw.priceFilter.tickSize),
    minLeverage: num(raw.leverageFilter.minLeverage),
    maxLeverage: num(raw.leverageFilter.maxLeverage),
  };
}
