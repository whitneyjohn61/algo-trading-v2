import { BybitClient } from './bybitClient';
import { BybitApiError } from './bybitErrors';
import { mapBalance, mapPosition, mapOrder, mapCandle, mapTicker, mapFundingRate, mapSymbolInfo } from './bybitMapper';
import {
  ExchangeService, ExchangeBalance, ExchangePosition, ExchangeOrder,
  ExchangeCandle, ExchangeTicker, ExchangeFundingRate, ExchangeSymbolInfo,
  ExchangeInterval, PlaceOrderParams, SetStopLossTakeProfitParams,
} from '../exchangeService';

export class BybitAdapter implements ExchangeService {
  readonly name = 'bybit';
  private client: BybitClient;

  constructor(apiKey: string, apiSecret: string, testnet: boolean = false) {
    this.client = new BybitClient({ apiKey, apiSecret, testnet });
  }

  private checkResponse(response: any, method: string): any {
    if (!response || response.retCode !== 0) {
      const code = response?.retCode?.toString() || 'UNKNOWN';
      const msg = response?.retMsg || 'Unknown Bybit API error';
      console.error(`[Bybit] ${method} failed: [${code}] ${msg}`);
      throw new BybitApiError(code, msg);
    }
    return response.result;
  }

  async getBalances(): Promise<ExchangeBalance[]> {
    const response = await this.client.retryOperation(() =>
      this.client.rest.getWalletBalance({ accountType: 'UNIFIED' })
    );
    const result = this.checkResponse(response, 'getBalances');
    const account = result.list?.[0];
    if (!account?.coin) return [];
    return account.coin.map((c: any) => mapBalance(c));
  }

  async getTotalEquity(): Promise<number> {
    const response = await this.client.retryOperation(() =>
      this.client.rest.getWalletBalance({ accountType: 'UNIFIED' })
    );
    const result = this.checkResponse(response, 'getTotalEquity');
    const account = result.list?.[0];
    return parseFloat(account?.totalEquity || '0') || 0;
  }

  async getPositions(symbol?: string): Promise<ExchangePosition[]> {
    const params: any = { category: 'linear', settleCoin: 'USDT' };
    if (symbol) params.symbol = symbol;

    const response = await this.client.retryOperation(() =>
      this.client.rest.getPositionInfo(params)
    );
    const result = this.checkResponse(response, 'getPositions');
    const positions = (result.list || [])
      .map((p: any) => mapPosition(p))
      .filter((p: ExchangePosition | null): p is ExchangePosition => p !== null);
    return positions;
  }

  async placeOrder(params: PlaceOrderParams): Promise<ExchangeOrder> {
    const orderParams: any = {
      category: 'linear',
      symbol: params.symbol,
      side: params.side === 'buy' ? 'Buy' : 'Sell',
      orderType: params.orderType === 'limit' ? 'Limit' : 'Market',
      qty: params.quantity.toString(),
      timeInForce: params.timeInForce || (params.orderType === 'limit' ? 'GTC' : 'IOC'),
    };

    // Market orders: strip ALL price-related fields
    if (params.orderType === 'limit' && params.price) {
      orderParams.price = params.price.toString();
    }

    if (params.reduceOnly) orderParams.reduceOnly = true;

    const response = await this.client.retryOperation(() =>
      this.client.rest.submitOrder(orderParams)
    );
    const result = this.checkResponse(response, 'placeOrder');

    // TP/SL must be set after fill via setTradingStop()
    if (params.stopLoss || params.takeProfit) {
      try {
        await this.setStopLossTakeProfit({
          symbol: params.symbol,
          stopLoss: params.stopLoss,
          takeProfit: params.takeProfit,
        });
      } catch (slTpError: any) {
        console.warn(`[Bybit] Failed to set SL/TP after order: ${slTpError.message}`);
      }
    }

    return mapOrder({ ...result, symbol: params.symbol, side: params.side === 'buy' ? 'Buy' : 'Sell' });
  }

  async cancelOrder(symbol: string, orderId: string): Promise<void> {
    const response = await this.client.retryOperation(() =>
      this.client.rest.cancelOrder({ category: 'linear', symbol, orderId })
    );
    this.checkResponse(response, 'cancelOrder');
  }

  async modifyOrder(symbol: string, orderId: string, params: { quantity?: number; price?: number }): Promise<ExchangeOrder> {
    const modifyParams: any = { category: 'linear', symbol, orderId };
    if (params.quantity) modifyParams.qty = params.quantity.toString();
    if (params.price) modifyParams.price = params.price.toString();

    const response = await this.client.retryOperation(() =>
      this.client.rest.amendOrder(modifyParams)
    );
    const result = this.checkResponse(response, 'modifyOrder');
    return mapOrder({ ...result, symbol });
  }

  async setStopLossTakeProfit(params: SetStopLossTakeProfitParams): Promise<void> {
    const slTpParams: any = {
      category: 'linear',
      symbol: params.symbol,
      positionIdx: params.positionIdx || 0,
    };
    if (params.stopLoss) slTpParams.stopLoss = params.stopLoss.toString();
    if (params.takeProfit) slTpParams.takeProfit = params.takeProfit.toString();

    const response = await this.client.retryOperation(() =>
      this.client.rest.setTradingStop(slTpParams)
    );
    this.checkResponse(response, 'setStopLossTakeProfit');
  }

  async getLeverage(symbol: string): Promise<number> {
    const positions = await this.getPositions(symbol);
    if (positions.length > 0 && positions[0]) return positions[0].leverage;
    return 1;
  }

  async setLeverage(symbol: string, leverage: number): Promise<void> {
    try {
      const response = await this.client.retryOperation(() =>
        this.client.rest.setLeverage({ category: 'linear', symbol, buyLeverage: leverage.toString(), sellLeverage: leverage.toString() })
      );
      this.checkResponse(response, 'setLeverage');
    } catch (error: any) {
      // Bybit returns error if leverage is already set — ignore
      if (error.rawMessage?.includes('leverage not modified')) return;
      throw error;
    }
  }

  async getCandles(symbol: string, interval: ExchangeInterval, limit: number = 200, startTime?: number, endTime?: number): Promise<ExchangeCandle[]> {
    const params: any = { category: 'linear', symbol, interval, limit };
    if (startTime) params.start = startTime;
    if (endTime) params.end = endTime;

    const response = await this.client.retryOperation(() =>
      this.client.rest.getKline(params)
    );
    const result = this.checkResponse(response, 'getCandles');
    const rawCandles = result.list || [];
    // Bybit returns reverse chronological — must reverse
    return rawCandles.reverse().map((c: any) => mapCandle(c, interval));
  }

  async getTicker(symbol: string): Promise<ExchangeTicker> {
    const response = await this.client.retryOperation(() =>
      this.client.rest.getTickers({ category: 'linear', symbol })
    );
    const result = this.checkResponse(response, 'getTicker');
    const raw = result.list?.[0];
    if (!raw) throw new Error(`No ticker data for ${symbol}`);
    return mapTicker(raw);
  }

  async getFundingRate(symbol: string): Promise<ExchangeFundingRate> {
    const response = await this.client.retryOperation(() =>
      this.client.rest.getTickers({ category: 'linear', symbol })
    );
    const result = this.checkResponse(response, 'getFundingRate');
    const raw = result.list?.[0];
    if (!raw) throw new Error(`No funding data for ${symbol}`);
    return mapFundingRate(raw);
  }

  async getFundingRateHistory(symbol: string, limit: number = 50): Promise<ExchangeFundingRate[]> {
    const response = await this.client.retryOperation(() =>
      this.client.rest.getFundingRateHistory({ category: 'linear', symbol, limit })
    );
    const result = this.checkResponse(response, 'getFundingRateHistory');
    return (result.list || []).map((r: any) => mapFundingRate(r));
  }

  async getOpenInterest(symbol: string): Promise<{ symbol: string; openInterest: number; timestamp: number }> {
    const response = await this.client.retryOperation(() =>
      this.client.rest.getOpenInterest({ category: 'linear', symbol, intervalTime: '5min', limit: 1 })
    );
    const result = this.checkResponse(response, 'getOpenInterest');
    const raw = result.list?.[0];
    return {
      symbol,
      openInterest: parseFloat(raw?.openInterest || '0'),
      timestamp: parseInt(raw?.timestamp || '0') || Date.now(),
    };
  }

  async getActiveSymbols(): Promise<string[]> {
    const response = await this.client.retryOperation(() =>
      this.client.rest.getInstrumentsInfo({ category: 'linear', limit: 1000 })
    );
    const result = this.checkResponse(response, 'getActiveSymbols');
    return (result.list || [])
      .filter((s: any) => s.status === 'Trading' && s.quoteCoin === 'USDT')
      .map((s: any) => s.symbol);
  }

  async getSymbolInfo(symbol: string): Promise<ExchangeSymbolInfo> {
    const response = await this.client.retryOperation(() =>
      this.client.rest.getInstrumentsInfo({ category: 'linear', symbol })
    );
    const result = this.checkResponse(response, 'getSymbolInfo');
    const raw = result.list?.[0];
    if (!raw) throw new Error(`No symbol info for ${symbol}`);
    return mapSymbolInfo(raw);
  }

  async getServerTime(): Promise<number> {
    const response = await this.client.retryOperation(() =>
      this.client.rest.getServerTime()
    );
    const result = this.checkResponse(response, 'getServerTime');
    return parseInt(result.timeSecond) * 1000 || Date.now();
  }
}
