/**
 * Trade Manager — Position tracking and simulated order execution for backtesting.
 * Transplanted from V1's tradeManager.ts, adapted for V2 types.
 */

import type { Candle } from '../../indicators/types';
import type { BacktestTrade, EquityPoint } from './backtestTypes';
import type { StrategySignal } from '../../strategies/types';

export interface TradeManagerConfig {
  initialBalance: number;
  leverage: number;
  takerFeeRate: number;
  slippageRate: number;
}

export class TradeManager {
  private balance: number;
  private readonly leverage: number;
  private readonly takerFeeRate: number;
  private readonly slippageRate: number;

  // Position state
  private positionSide: 'long' | 'short' | null = null;
  private positionQty: number = 0;
  private entryPrice: number = 0;
  private marginUsed: number = 0;
  private stopLoss: number | undefined;
  private takeProfit: number | undefined;

  // Tracking
  private trades: BacktestTrade[] = [];
  private equityCurve: EquityPoint[] = [];
  private tradeIdCounter: number = 0;
  private maxEquity: number;
  private maxDrawdown: number = 0;
  private totalFees: number = 0;

  constructor(cfg: TradeManagerConfig) {
    this.balance = cfg.initialBalance;
    this.leverage = cfg.leverage;
    this.takerFeeRate = cfg.takerFeeRate;
    this.slippageRate = cfg.slippageRate;
    this.maxEquity = cfg.initialBalance;
  }

  // ── Position queries ────────────────────────────────────────

  hasPosition(): boolean {
    return this.positionSide !== null && this.positionQty > 0;
  }

  getPositionSide(): 'long' | 'short' | null {
    return this.positionSide;
  }

  getBalance(): number {
    return this.balance;
  }

  getEquity(currentPrice: number): number {
    if (!this.hasPosition()) return this.balance;
    const unrealized = this.unrealizedPnl(currentPrice);
    return this.balance + this.marginUsed + unrealized;
  }

  getTrades(): BacktestTrade[] {
    return this.trades;
  }

  getEquityCurve(): EquityPoint[] {
    return this.equityCurve;
  }

  getMaxDrawdown(): number {
    return this.maxDrawdown;
  }

  getTotalFees(): number {
    return this.totalFees;
  }

  // ── Execution helpers ───────────────────────────────────────

  private execPrice(refPrice: number, side: 'buy' | 'sell'): number {
    // Slippage: buys get a worse (higher) price, sells get worse (lower) price
    const slippage = refPrice * this.slippageRate;
    return side === 'buy' ? refPrice + slippage : refPrice - slippage;
  }

  private unrealizedPnl(currentPrice: number): number {
    if (!this.hasPosition()) return 0;
    if (this.positionSide === 'long') {
      return (currentPrice - this.entryPrice) * this.positionQty;
    }
    return (this.entryPrice - currentPrice) * this.positionQty;
  }

  // ── Entry ───────────────────────────────────────────────────

  handleEntry(candle: Candle, signal: StrategySignal): void {
    if (this.hasPosition()) return; // Already in a position

    const side: 'long' | 'short' = signal.action === 'entry_long' ? 'long' : 'short';
    const execSide = side === 'long' ? 'buy' : 'sell';
    const price = this.execPrice(candle.close, execSide);

    // Position sizing: use full available balance with leverage
    const availableCapital = this.balance;
    const notional = availableCapital * this.leverage;
    const qty = notional / price;

    // Entry fee
    const entryFee = qty * price * this.takerFeeRate;
    const margin = notional / this.leverage; // == availableCapital

    // Deduct margin + fees from balance
    this.balance -= (margin + entryFee);
    this.totalFees += entryFee;

    // Set position
    this.positionSide = side;
    this.positionQty = qty;
    this.entryPrice = price;
    this.marginUsed = margin;
    this.stopLoss = signal.stopLoss;
    this.takeProfit = signal.takeProfit;

    // Record open trade
    this.trades.push({
      id: ++this.tradeIdCounter,
      side,
      entryTime: candle.timestamp,
      entryPrice: price,
      entryQty: qty,
      fees: entryFee,
      entrySignal: signal,
    });
  }

  // ── Exit ────────────────────────────────────────────────────

  handleExit(candle: Candle, signal?: StrategySignal, exitPrice?: number): void {
    if (!this.hasPosition()) return;

    const execSide = this.positionSide === 'long' ? 'sell' : 'buy';
    const price = exitPrice ?? this.execPrice(candle.close, execSide);

    // PNL
    const pnl = this.positionSide === 'long'
      ? (price - this.entryPrice) * this.positionQty
      : (this.entryPrice - price) * this.positionQty;

    // Exit fee
    const exitFee = this.positionQty * price * this.takerFeeRate;
    this.totalFees += exitFee;

    // Return margin + PNL - fees to balance
    this.balance += (this.marginUsed + pnl - exitFee);

    // Update last trade record
    const lastTrade = this.trades[this.trades.length - 1];
    if (lastTrade && lastTrade.exitTime === undefined) {
      lastTrade.exitTime = candle.timestamp;
      lastTrade.exitPrice = price;
      lastTrade.pnl = pnl - exitFee - lastTrade.fees; // Net PNL after all fees
      lastTrade.exitSignal = signal;
      lastTrade.fees += exitFee;
    }

    // Reset position
    this.positionSide = null;
    this.positionQty = 0;
    this.entryPrice = 0;
    this.marginUsed = 0;
    this.stopLoss = undefined;
    this.takeProfit = undefined;
  }

  // ── Per-candle update (equity + SL/TP checks) ──────────────

  updateOnCandle(candle: Candle): void {
    // Check stop loss / take profit
    if (this.hasPosition()) {
      if (this.stopLoss !== undefined) {
        const hitSL = this.positionSide === 'long'
          ? candle.low <= this.stopLoss
          : candle.high >= this.stopLoss;

        if (hitSL) {
          this.handleExit(candle, undefined, this.stopLoss);
          return;
        }
      }

      if (this.takeProfit !== undefined) {
        const hitTP = this.positionSide === 'long'
          ? candle.high >= this.takeProfit
          : candle.low <= this.takeProfit;

        if (hitTP) {
          this.handleExit(candle, undefined, this.takeProfit);
          return;
        }
      }
    }

    // Track equity
    const equity = this.getEquity(candle.close);
    this.equityCurve.push({ time: candle.timestamp, equity });

    // Update max equity and drawdown
    if (equity > this.maxEquity) {
      this.maxEquity = equity;
    }
    const dd = this.maxEquity > 0 ? (this.maxEquity - equity) / this.maxEquity : 0;
    if (dd > this.maxDrawdown) {
      this.maxDrawdown = dd;
    }
  }

  // ── Signal adjustment (SL/TP modification) ──────────────────

  handleAdjust(signal: StrategySignal): void {
    if (!this.hasPosition()) return;
    if (signal.newStopLoss !== undefined) this.stopLoss = signal.newStopLoss;
    if (signal.newTakeProfit !== undefined) this.takeProfit = signal.newTakeProfit;
  }
}
