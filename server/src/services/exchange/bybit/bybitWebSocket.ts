import { WebsocketClient, DefaultLogger } from 'bybit-api';
import { ExchangeEvent, CandleUpdateEvent, TickerUpdateEvent, OrderUpdateEvent, PositionUpdateEvent, ExchangeEventHandler, ExchangeEventType } from '../exchangeEvents';
import { INTERVAL_MINUTES } from './bybitTypes';

interface BybitWsConfig {
  apiKey: string;
  apiSecret: string;
  testnet: boolean;
}

export class BybitWebSocketService {
  private ws: WebsocketClient | null = null;
  private config: BybitWsConfig;
  private handlers: Map<ExchangeEventType, Set<ExchangeEventHandler>> = new Map();
  private subscribedKlines: Set<string> = new Set();
  private subscribedTickers: Set<string> = new Set();
  private isConnected: boolean = false;

  constructor(cfg: BybitWsConfig) {
    this.config = cfg;
  }

  initialize(): void {
    // Suppress noisy bybit-api logs
    const silentLogger = {
      ...DefaultLogger,
      silly: (..._params: any) => {},
      debug: (..._params: any) => {},
      notice: (..._params: any) => {},
      info: (..._params: any) => {},
    } as any;

    this.ws = new WebsocketClient(
      {
        key: this.config.apiKey,
        secret: this.config.apiSecret,
        testnet: this.config.testnet,
        market: 'v5',
      },
      silentLogger
    );

    this.setupEventHandlers();
    console.log('[BybitWS] WebSocket client initialized');
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.on('update', (data: any) => {
      this.handleMessage(data);
    });

    this.ws.on('open', (data: any) => {
      this.isConnected = true;
      console.log(`[BybitWS] Connected: ${data?.wsKey || 'unknown'}`);
      this.emit({ type: 'connection_status', exchange: 'bybit', timestamp: Date.now(), data: { connected: true, channel: data?.wsKey || '' } });
    });

    this.ws.on('close', () => {
      this.isConnected = false;
      console.log('[BybitWS] Disconnected');
      this.emit({ type: 'connection_status', exchange: 'bybit', timestamp: Date.now(), data: { connected: false, channel: 'all' } });
    });

    this.ws.on('reconnect', () => {
      console.log('[BybitWS] Reconnecting...');
    });

    this.ws.on('reconnected', () => {
      this.isConnected = true;
      console.log('[BybitWS] Reconnected');
    });

    (this.ws as any).on('error', (error: any) => {
      console.error('[BybitWS] Error:', error?.message || error);
    });
  }

  private handleMessage(data: any): void {
    const topic = data?.topic || '';

    if (topic.startsWith('kline.')) {
      this.handleKlineUpdate(data);
    } else if (topic.startsWith('tickers.')) {
      this.handleTickerUpdate(data);
    } else if (topic === 'order') {
      this.handleOrderUpdate(data);
    } else if (topic === 'position') {
      this.handlePositionUpdate(data);
    }
  }

  private handleKlineUpdate(data: any): void {
    const parts = (data.topic || '').split('.');
    if (parts.length < 3) return;
    const interval = parts[1];
    const symbol = parts[2];

    for (const candle of data.data || []) {
      const intervalMs = (INTERVAL_MINUTES[interval] || 1) * 60 * 1000;
      const startTime = parseInt(candle.start);
      const event: ExchangeEvent<CandleUpdateEvent> = {
        type: 'candle_update',
        exchange: 'bybit',
        timestamp: Date.now(),
        data: {
          symbol,
          interval,
          candle: {
            timestamp: startTime,
            open: parseFloat(candle.open || '0'),
            high: parseFloat(candle.high || '0'),
            low: parseFloat(candle.low || '0'),
            close: parseFloat(candle.close || '0'),
            volume: parseFloat(candle.volume || '0'),
            turnover: parseFloat(candle.turnover || '0'),
            confirmed: candle.confirm || (startTime + intervalMs <= Date.now()),
          },
        },
      };
      this.emit(event);
    }
  }

  private handleTickerUpdate(data: any): void {
    for (const ticker of data.data ? [data.data] : []) {
      const event: ExchangeEvent<TickerUpdateEvent> = {
        type: 'ticker_update',
        exchange: 'bybit',
        timestamp: Date.now(),
        data: {
          symbol: ticker.symbol,
          lastPrice: parseFloat(ticker.lastPrice || '0'),
          bid: parseFloat(ticker.bid1Price || '0'),
          ask: parseFloat(ticker.ask1Price || '0'),
          volume24h: parseFloat(ticker.volume24h || '0'),
          priceChange24hPct: parseFloat(ticker.price24hPcnt || '0') * 100,
        },
      };
      this.emit(event);
    }
  }

  private handleOrderUpdate(data: any): void {
    for (const order of data.data || []) {
      const event: ExchangeEvent<OrderUpdateEvent> = {
        type: 'order_update',
        exchange: 'bybit',
        timestamp: Date.now(),
        data: {
          orderId: order.orderId,
          symbol: order.symbol,
          side: order.side === 'Buy' ? 'buy' : 'sell',
          orderType: order.orderType,
          quantity: parseFloat(order.qty || '0'),
          price: order.price ? parseFloat(order.price) : undefined,
          status: order.orderStatus,
          filledQuantity: parseFloat(order.cumExecQty || '0'),
          avgFillPrice: order.avgPrice ? parseFloat(order.avgPrice) : undefined,
          fees: parseFloat(order.cumExecFee || '0'),
          updatedAt: parseInt(order.updatedTime) || Date.now(),
        },
      };
      this.emit(event);
    }
  }

  private handlePositionUpdate(data: any): void {
    for (const pos of data.data || []) {
      if (parseFloat(pos.size || '0') === 0) continue;
      const event: ExchangeEvent<PositionUpdateEvent> = {
        type: 'position_update',
        exchange: 'bybit',
        timestamp: Date.now(),
        data: {
          symbol: pos.symbol,
          side: pos.side === 'Buy' ? 'long' : 'short',
          size: parseFloat(pos.size || '0'),
          entryPrice: parseFloat(pos.entryPrice || '0'),
          markPrice: parseFloat(pos.markPrice || '0'),
          unrealizedPnl: parseFloat(pos.unrealisedPnl || '0'),
          leverage: parseFloat(pos.leverage || '1'),
        },
      };
      this.emit(event);
    }
  }

  // Public subscription methods
  subscribeKline(symbol: string, interval: string): void {
    const topic = `kline.${interval}.${symbol}`;
    if (this.subscribedKlines.has(topic)) return;
    this.ws?.subscribeV5(topic as any, 'linear');
    this.subscribedKlines.add(topic);
    console.log(`[BybitWS] Subscribed: ${topic}`);
  }

  unsubscribeKline(symbol: string, interval: string): void {
    const topic = `kline.${interval}.${symbol}`;
    if (!this.subscribedKlines.has(topic)) return;
    this.ws?.unsubscribeV5(topic as any, 'linear');
    this.subscribedKlines.delete(topic);
  }

  subscribeTicker(symbol: string): void {
    const topic = `tickers.${symbol}`;
    if (this.subscribedTickers.has(topic)) return;
    this.ws?.subscribeV5(topic as any, 'linear');
    this.subscribedTickers.add(topic);
  }

  subscribePrivateChannels(): void {
    this.ws?.subscribeV5('order' as any, 'linear');
    this.ws?.subscribeV5('position' as any, 'linear');
    console.log('[BybitWS] Subscribed to private channels (order, position)');
  }

  // Event emitter
  on(type: ExchangeEventType, handler: ExchangeEventHandler): void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
  }

  off(type: ExchangeEventType, handler: ExchangeEventHandler): void {
    this.handlers.get(type)?.delete(handler);
  }

  private emit(event: ExchangeEvent): void {
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try { handler(event); } catch (e: any) { console.error('[BybitWS] Handler error:', e.message); }
      }
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  close(): void {
    this.ws?.closeAll();
    this.isConnected = false;
    this.subscribedKlines.clear();
    this.subscribedTickers.clear();
    console.log('[BybitWS] Closed all connections');
  }
}
