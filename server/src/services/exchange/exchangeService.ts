// Unified exchange types and interface

export interface ExchangeBalance {
  coin: string;
  available: number;
  total: number;
  unrealizedPnl: number;
}

export interface ExchangePosition {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  leverage: number;
  margin: number;
  liquidationPrice: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface ExchangeOrder {
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  quantity: number;
  price?: number;
  stopPrice?: number;
  status: 'pending' | 'open' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected';
  filledQuantity: number;
  avgFillPrice?: number;
  fees: number;
  timeInForce: string;
  reduceOnly: boolean;
  createdAt: number; // UTC ms
  updatedAt: number; // UTC ms
}

export interface ExchangeTicker {
  symbol: string;
  lastPrice: number;
  bid: number;
  ask: number;
  volume24h: number;
  turnover24h: number;
  priceChange24hPct: number;
  highPrice24h: number;
  lowPrice24h: number;
}

export interface ExchangeCandle {
  timestamp: number; // UTC ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
  confirmed: boolean;
}

export interface ExchangeFundingRate {
  symbol: string;
  fundingRate: number;
  nextFundingTime: number; // UTC ms
}

export interface ExchangeSymbolInfo {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
  minOrderQty: number;
  maxOrderQty: number;
  qtyStep: number;
  minPrice: number;
  maxPrice: number;
  priceStep: number;
  minLeverage: number;
  maxLeverage: number;
}

export interface PlaceOrderParams {
  symbol: string;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  quantity: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  timeInForce?: string;
  reduceOnly?: boolean;
}

export interface SetStopLossTakeProfitParams {
  symbol: string;
  stopLoss?: number;
  takeProfit?: number;
  positionIdx?: number;
}

export type ExchangeInterval = '1' | '3' | '5' | '15' | '30' | '60' | '120' | '240' | '360' | '720' | 'D' | 'W' | 'M';

export interface ExchangeService {
  readonly name: string;

  // Account
  getBalances(): Promise<ExchangeBalance[]>;
  getTotalEquity(): Promise<number>;
  getPositions(symbol?: string): Promise<ExchangePosition[]>;

  // Orders
  placeOrder(params: PlaceOrderParams): Promise<ExchangeOrder>;
  cancelOrder(symbol: string, orderId: string): Promise<void>;
  modifyOrder(symbol: string, orderId: string, params: { quantity?: number; price?: number }): Promise<ExchangeOrder>;
  setStopLossTakeProfit(params: SetStopLossTakeProfitParams): Promise<void>;

  // Leverage
  getLeverage(symbol: string): Promise<number>;
  setLeverage(symbol: string, leverage: number): Promise<void>;

  // Market data
  getCandles(symbol: string, interval: ExchangeInterval, limit?: number, startTime?: number, endTime?: number): Promise<ExchangeCandle[]>;
  getTicker(symbol: string): Promise<ExchangeTicker>;
  getFundingRate(symbol: string): Promise<ExchangeFundingRate>;
  getFundingRateHistory(symbol: string, limit?: number): Promise<ExchangeFundingRate[]>;
  getOpenInterest(symbol: string): Promise<{ symbol: string; openInterest: number; timestamp: number }>;

  // Symbol info
  getActiveSymbols(): Promise<string[]>;
  getSymbolInfo(symbol: string): Promise<ExchangeSymbolInfo>;
  getServerTime(): Promise<number>;
}
