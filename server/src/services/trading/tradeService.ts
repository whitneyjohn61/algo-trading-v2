/**
 * Trade Service — CRUD, order management, SL/TP, balance validation.
 * Account-scoped: all exchange operations use the account's adapter.
 */

import db from '../database/connection';
import exchangeManager from '../exchange/exchangeManager';
import riskService from './riskService';
import type { ExchangeOrder } from '../exchange/exchangeService';

// ── Types ──────────────────────────────────────────────────

export interface Trade {
  id: number;
  user_id: string;
  trading_account_id: number;
  symbol: string;
  exchange: string;
  is_test: boolean;
  trade_type: 'manual' | 'strategy';
  strategy_name?: string;
  strategy_params?: Record<string, any>;
  side: 'long' | 'short';
  entry_price?: number;
  quantity: number;
  remaining_quantity: number;
  leverage: number;
  status: 'pending' | 'active' | 'closed' | 'cancelled' | 'error';
  realized_pnl: number;
  unrealized_pnl: number;
  notes?: string;
  additional_info: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  closed_at?: Date;
}

export interface CreateTradeParams {
  tradingAccountId: number;
  userId?: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  leverage?: number;
  tradeType?: 'manual' | 'strategy';
  strategyName?: string;
  strategyParams?: Record<string, any>;
  orderType: 'market' | 'limit';
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  timeInForce?: string;
  notes?: string;
}

export interface Order {
  id: number;
  trade_id: number;
  exchange_order_id?: string;
  order_type: string;
  side: string;
  quantity: number;
  price?: number;
  stop_price?: number;
  time_in_force: string;
  status: string;
  filled_quantity: number;
  avg_fill_price?: number;
  fees: number;
  take_profit?: number;
  stop_loss?: number;
  reduce_only: boolean;
  additional_info: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  filled_at?: Date;
}

// ── Service ────────────────────────────────────────────────

class TradeService {

  // ── Create ─────────────────────────────────────────────

  async createTrade(params: CreateTradeParams): Promise<{ trade: Trade; order: ExchangeOrder }> {
    const exchange = await exchangeManager.getForAccount(params.tradingAccountId);

    // 1. Determine entry price (for limit orders or current market price)
    let entryPrice = params.price;
    if (!entryPrice) {
      const ticker = await exchange.getTicker(params.symbol);
      entryPrice = ticker.lastPrice;
    }

    // 2. Run risk validation
    const riskResult = await riskService.validateTrade({
      tradingAccountId: params.tradingAccountId,
      symbol: params.symbol,
      side: params.side,
      quantity: params.quantity,
      entryPrice,
      stopLossPrice: params.stopLoss,
      leverage: params.leverage,
      strategyName: params.strategyName,
    });

    if (!riskResult.passed) {
      throw new Error(`Risk check failed: ${riskResult.error}`);
    }

    // 3. Validate balance
    const balanceCheck = await this.validateBalance(
      params.tradingAccountId,
      params.quantity,
      entryPrice,
      params.leverage || 1
    );
    if (!balanceCheck.valid) {
      throw new Error(balanceCheck.error || 'Insufficient balance');
    }

    // 4. Set leverage on exchange
    if (params.leverage && params.leverage > 1) {
      await exchange.setLeverage(params.symbol, params.leverage);
    }

    // 5. Place order on exchange
    const orderSide = params.side === 'long' ? 'buy' : 'sell';
    const exchangeOrder = await exchange.placeOrder({
      symbol: params.symbol,
      side: orderSide as 'buy' | 'sell',
      orderType: params.orderType,
      quantity: params.quantity,
      price: params.price,
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit,
      timeInForce: params.timeInForce,
    });

    // 6. Insert trade record
    const tradeResult = await db.query(
      `INSERT INTO trades (
        user_id, trading_account_id, symbol, exchange, is_test,
        trade_type, strategy_name, strategy_params, side,
        entry_price, quantity, remaining_quantity, leverage,
        status, notes, additional_info
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        params.userId || 'default',
        params.tradingAccountId,
        params.symbol,
        'bybit',
        false, // TODO: derive from account is_test flag
        params.tradeType || 'manual',
        params.strategyName || null,
        params.strategyParams ? JSON.stringify(params.strategyParams) : null,
        params.side,
        exchangeOrder.avgFillPrice || entryPrice,
        params.quantity,
        params.quantity,
        params.leverage || 1,
        exchangeOrder.status === 'filled' ? 'active' : 'pending',
        params.notes || null,
        JSON.stringify({ stop_loss: params.stopLoss, take_profit: params.takeProfit }),
      ]
    );

    const trade = tradeResult.rows[0] as Trade;

    // 7. Insert order record
    await db.query(
      `INSERT INTO orders (
        trade_id, exchange_order_id, order_type, side, quantity,
        price, time_in_force, status, filled_quantity, avg_fill_price,
        fees, take_profit, stop_loss, reduce_only, additional_info
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        trade.id,
        exchangeOrder.orderId,
        params.orderType,
        orderSide,
        params.quantity,
        params.price || null,
        params.timeInForce || 'GTC',
        exchangeOrder.status,
        exchangeOrder.filledQuantity,
        exchangeOrder.avgFillPrice || null,
        exchangeOrder.fees,
        params.takeProfit || null,
        params.stopLoss || null,
        false,
        JSON.stringify({}),
      ]
    );

    // 8. Set SL/TP on exchange after fill (for market orders)
    if (exchangeOrder.status === 'filled' && (params.stopLoss || params.takeProfit)) {
      try {
        await exchange.setStopLossTakeProfit({
          symbol: params.symbol,
          stopLoss: params.stopLoss,
          takeProfit: params.takeProfit,
        });
      } catch (err: any) {
        console.error(`[TradeService] Failed to set SL/TP post-fill: ${err.message}`);
      }
    }

    return { trade, order: exchangeOrder };
  }

  // ── Read ───────────────────────────────────────────────

  async getTradeById(tradeId: number): Promise<Trade | null> {
    const result = await db.query(`SELECT * FROM trades WHERE id = $1`, [tradeId]);
    return (result.rows[0] as Trade) || null;
  }

  async getTradeWithOrders(tradeId: number): Promise<{ trade: Trade; orders: Order[] } | null> {
    const trade = await this.getTradeById(tradeId);
    if (!trade) return null;

    const ordersResult = await db.query(
      `SELECT * FROM orders WHERE trade_id = $1 ORDER BY created_at ASC`,
      [tradeId]
    );
    return { trade, orders: ordersResult.rows as Order[] };
  }

  async getTrades(filters: {
    tradingAccountId?: number;
    userId?: string;
    status?: string;
    symbol?: string;
    strategyName?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<Trade[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filters.tradingAccountId) {
      conditions.push(`trading_account_id = $${idx++}`);
      values.push(filters.tradingAccountId);
    }
    if (filters.userId) {
      conditions.push(`user_id = $${idx++}`);
      values.push(filters.userId);
    }
    if (filters.status) {
      conditions.push(`status = $${idx++}`);
      values.push(filters.status);
    }
    if (filters.symbol) {
      conditions.push(`symbol = $${idx++}`);
      values.push(filters.symbol);
    }
    if (filters.strategyName) {
      conditions.push(`strategy_name = $${idx++}`);
      values.push(filters.strategyName);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const result = await db.query(
      `SELECT * FROM trades ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );
    return result.rows as Trade[];
  }

  // ── Update ─────────────────────────────────────────────

  async updateTradeSLTP(
    tradeId: number,
    stopLoss?: number,
    takeProfit?: number
  ): Promise<Trade> {
    const trade = await this.getTradeById(tradeId);
    if (!trade) throw new Error(`Trade ${tradeId} not found`);
    if (trade.status !== 'active') throw new Error(`Trade ${tradeId} is not active`);

    // Use the trade's account adapter
    const exchange = await exchangeManager.getForAccount(trade.trading_account_id);
    await exchange.setStopLossTakeProfit({
      symbol: trade.symbol,
      stopLoss,
      takeProfit,
    });

    // Update in DB
    const info = trade.additional_info || {};
    if (stopLoss !== undefined) info['stop_loss'] = stopLoss;
    if (takeProfit !== undefined) info['take_profit'] = takeProfit;

    const result = await db.query(
      `UPDATE trades SET additional_info = $1 WHERE id = $2 RETURNING *`,
      [JSON.stringify(info), tradeId]
    );
    return result.rows[0] as Trade;
  }

  // ── Close ──────────────────────────────────────────────

  async closeTrade(
    tradeId: number,
    quantity?: number
  ): Promise<{ trade: Trade; order: ExchangeOrder }> {
    const trade = await this.getTradeById(tradeId);
    if (!trade) throw new Error(`Trade ${tradeId} not found`);
    if (trade.status !== 'active') throw new Error(`Trade ${tradeId} is not active`);

    const closeQty = quantity || Number(trade.remaining_quantity);
    const closeSide = trade.side === 'long' ? 'sell' : 'buy';

    // Use the trade's account adapter
    const exchange = await exchangeManager.getForAccount(trade.trading_account_id);
    const exchangeOrder = await exchange.placeOrder({
      symbol: trade.symbol,
      side: closeSide as 'buy' | 'sell',
      orderType: 'market',
      quantity: closeQty,
      reduceOnly: true,
    });

    // Insert close order
    await db.query(
      `INSERT INTO orders (
        trade_id, exchange_order_id, order_type, side, quantity,
        time_in_force, status, filled_quantity, avg_fill_price,
        fees, reduce_only, additional_info
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        tradeId,
        exchangeOrder.orderId,
        'market',
        closeSide,
        closeQty,
        'GTC',
        exchangeOrder.status,
        exchangeOrder.filledQuantity,
        exchangeOrder.avgFillPrice || null,
        exchangeOrder.fees,
        true,
        JSON.stringify({}),
      ]
    );

    // Calculate PnL
    const fillPrice = exchangeOrder.avgFillPrice || 0;
    const entryPrice = Number(trade.entry_price) || 0;
    const pnlPerUnit = trade.side === 'long'
      ? fillPrice - entryPrice
      : entryPrice - fillPrice;
    const realizedPnl = pnlPerUnit * exchangeOrder.filledQuantity - exchangeOrder.fees;

    // Update trade
    const newRemaining = Number(trade.remaining_quantity) - exchangeOrder.filledQuantity;
    const newStatus = newRemaining <= 0 ? 'closed' : 'active';

    const result = await db.query(
      `UPDATE trades
       SET remaining_quantity = $1,
           status = $2,
           realized_pnl = realized_pnl + $3,
           closed_at = CASE WHEN $2 = 'closed' THEN CURRENT_TIMESTAMP ELSE closed_at END
       WHERE id = $4
       RETURNING *`,
      [Math.max(0, newRemaining), newStatus, realizedPnl, tradeId]
    );

    return { trade: result.rows[0] as Trade, order: exchangeOrder };
  }

  // ── Cancel ─────────────────────────────────────────────

  async cancelOrder(tradingAccountId: number, symbol: string, orderId: string): Promise<void> {
    const exchange = await exchangeManager.getForAccount(tradingAccountId);
    await exchange.cancelOrder(symbol, orderId);

    // Update order status in DB
    await db.query(
      `UPDATE orders SET status = 'cancelled' WHERE exchange_order_id = $1`,
      [orderId]
    );
  }

  // ── Balance validation ─────────────────────────────────

  async validateBalance(
    tradingAccountId: number,
    quantity: number,
    price: number,
    leverage: number
  ): Promise<{ valid: boolean; available: number; required: number; error?: string }> {
    const requiredMargin = (quantity * price) / leverage;

    try {
      const exchange = await exchangeManager.getForAccount(tradingAccountId);
      const balances = await exchange.getBalances();
      const usdt = balances.find(b => b.coin === 'USDT');
      const available = usdt?.available || 0;

      if (available < requiredMargin) {
        return {
          valid: false,
          available,
          required: requiredMargin,
          error: `Insufficient margin: need $${requiredMargin.toFixed(2)}, available $${available.toFixed(2)}`,
        };
      }

      return { valid: true, available, required: requiredMargin };
    } catch (err: any) {
      return { valid: false, available: 0, required: requiredMargin, error: `Balance check failed: ${err.message}` };
    }
  }

  // ── Exchange position helpers (account-scoped) ─────────

  async getPositions(tradingAccountId: number, symbol?: string) {
    const exchange = await exchangeManager.getForAccount(tradingAccountId);
    return exchange.getPositions(symbol);
  }

  async getBalance(tradingAccountId: number) {
    const exchange = await exchangeManager.getForAccount(tradingAccountId);
    return exchange.getBalances();
  }
}

const tradeService = new TradeService();
export default tradeService;
