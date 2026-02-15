/**
 * Signal Processor — converts strategy signals to exchange orders.
 *
 * Responsibilities:
 *   1. Apply position sizing (based on allocation + risk rules)
 *   2. Set leverage before placing order
 *   3. Place order via exchange service
 *   4. Set SL/TP after fill (Bybit requirement)
 *   5. Record trade in database
 */

import tradeService from '../services/trading/tradeService';
import exchangeManager from '../services/exchange/exchangeManager';
import type { StrategySignal, StrategyConfig } from './types';

export interface ProcessedSignal {
  signal: StrategySignal;
  strategyId: string;
  success: boolean;
  tradeId?: number;
  error?: string;
}

class SignalProcessor {

  async process(
    signal: StrategySignal,
    strategyConfig: StrategyConfig,
    tradingAccountId: number
  ): Promise<ProcessedSignal> {
    try {
      switch (signal.action) {
        case 'entry_long':
        case 'entry_short':
          return await this.processEntry(signal, strategyConfig, tradingAccountId);

        case 'exit':
          return await this.processExit(signal, strategyConfig, tradingAccountId);

        case 'adjust':
          return await this.processAdjust(signal, strategyConfig, tradingAccountId);

        case 'hold':
          return { signal, strategyId: strategyConfig.id, success: true };

        default:
          return { signal, strategyId: strategyConfig.id, success: false, error: `Unknown action: ${signal.action}` };
      }
    } catch (error: any) {
      console.error(`[SignalProcessor] Error processing ${signal.action} for ${signal.symbol}:`, error.message);
      return { signal, strategyId: strategyConfig.id, success: false, error: error.message };
    }
  }

  private async processEntry(
    signal: StrategySignal,
    config: StrategyConfig,
    tradingAccountId: number
  ): Promise<ProcessedSignal> {
    const exchange = await exchangeManager.getForAccount(tradingAccountId);
    const side = signal.action === 'entry_long' ? 'long' : 'short';

    // 1. Get equity and compute position size
    const equity = await exchange.getTotalEquity();
    const allocatedCapital = equity * (config.capitalAllocationPercent / 100);
    const ticker = await exchange.getTicker(signal.symbol);
    const price = ticker.lastPrice;

    // Position size: allocated capital * confidence / price / max leverage
    // Confidence scales the position (0.5 confidence = half size)
    const leverage = Math.min(config.maxLeverage, 3);
    const notionalSize = allocatedCapital * signal.confidence;
    const quantity = (notionalSize * leverage) / price;

    // Round quantity to reasonable precision
    const roundedQty = Number(quantity.toFixed(6));
    if (roundedQty <= 0) {
      return { signal, strategyId: config.id, success: false, error: 'Computed quantity is zero' };
    }

    // 2. Create trade (this handles risk validation, balance check, leverage, order, SL/TP)
    const result = await tradeService.createTrade({
      tradingAccountId,
      symbol: signal.symbol,
      side,
      quantity: roundedQty,
      leverage,
      tradeType: 'strategy',
      strategyName: config.id,
      orderType: 'market',
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
    });

    console.log(`[SignalProcessor] ${config.id}: ${signal.action} ${signal.symbol} qty=${roundedQty} @ ~${price}`);

    return {
      signal,
      strategyId: config.id,
      success: true,
      tradeId: result.trade.id,
    };
  }

  private async processExit(
    signal: StrategySignal,
    config: StrategyConfig,
    tradingAccountId: number
  ): Promise<ProcessedSignal> {
    // Find active trade for this symbol + strategy
    const trades = await tradeService.getTrades({
      tradingAccountId,
      symbol: signal.symbol,
      strategyName: config.id,
      status: 'active',
    });

    if (trades.length === 0) {
      return { signal, strategyId: config.id, success: true }; // No position to exit
    }

    // Close all matching trades
    for (const trade of trades) {
      await tradeService.closeTrade(trade.id);
      console.log(`[SignalProcessor] ${config.id}: exit ${signal.symbol} trade #${trade.id} — ${signal.reason}`);
    }

    return { signal, strategyId: config.id, success: true };
  }

  private async processAdjust(
    signal: StrategySignal,
    config: StrategyConfig,
    tradingAccountId: number
  ): Promise<ProcessedSignal> {
    // Find active trade for this symbol + strategy
    const trades = await tradeService.getTrades({
      tradingAccountId,
      symbol: signal.symbol,
      strategyName: config.id,
      status: 'active',
    });

    if (trades.length === 0) {
      return { signal, strategyId: config.id, success: true };
    }

    // Update SL/TP on all matching trades
    for (const trade of trades) {
      await tradeService.updateTradeSLTP(trade.id, signal.newStopLoss, signal.newTakeProfit);
    }

    return { signal, strategyId: config.id, success: true };
  }
}

const signalProcessor = new SignalProcessor();
export default signalProcessor;
