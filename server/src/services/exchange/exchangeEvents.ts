// Standardized exchange WebSocket event types

export type ExchangeEventType =
  | 'candle_update'
  | 'ticker_update'
  | 'order_update'
  | 'position_update'
  | 'execution'
  | 'funding_update'
  | 'connection_status';

export interface ExchangeEvent<T = any> {
  type: ExchangeEventType;
  exchange: string;
  timestamp: number; // UTC ms
  data: T;
}

export interface CandleUpdateEvent {
  symbol: string;
  interval: string;
  candle: {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    turnover: number;
    confirmed: boolean;
  };
}

export interface TickerUpdateEvent {
  symbol: string;
  lastPrice: number;
  bid: number;
  ask: number;
  volume24h: number;
  priceChange24hPct: number;
}

export interface OrderUpdateEvent {
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  orderType: string;
  quantity: number;
  price?: number;
  status: string;
  filledQuantity: number;
  avgFillPrice?: number;
  fees: number;
  updatedAt: number;
}

export interface PositionUpdateEvent {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  leverage: number;
}

export interface ExecutionEvent {
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  executionPrice: number;
  executionQty: number;
  fees: number;
  timestamp: number;
}

export interface ConnectionStatusEvent {
  connected: boolean;
  channel: string;
  message?: string;
}

export type ExchangeEventHandler = (event: ExchangeEvent) => void;

export interface ExchangeEventEmitter {
  on(type: ExchangeEventType, handler: ExchangeEventHandler): void;
  off(type: ExchangeEventType, handler: ExchangeEventHandler): void;
  emit(event: ExchangeEvent): void;
}
