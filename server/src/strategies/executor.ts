/**
 * Strategy Executor — manages strategy lifecycle and candle subscription.
 *
 * Account-scoped: each trading account has its own set of strategy runners.
 * Multiple accounts can run concurrently.
 *
 * Responsibilities:
 *   1. Subscribe to multi-timeframe candle data for each strategy
 *   2. Fetch warmup candles on initialization
 *   3. Route confirmed candles to strategy.onCandle()
 *   4. Forward signals to SignalProcessor
 *   5. Strategy pause/resume (per account + strategy)
 *   6. Per-strategy logging
 */

import { getAllStrategies } from './registry';
import signalProcessor from './signalProcessor';
import exchangeManager from '../services/exchange/exchangeManager';
import type { Strategy, MultiTimeframeData, StrategySignal } from './types';
import type { Candle } from '../indicators/types';
import type { ExchangeInterval, ExchangeCandle } from '../services/exchange/exchangeService';

interface StrategyRunner {
  strategy: Strategy;
  tradingAccountId: number;
  paused: boolean;
  /** Cached candle data per timeframe */
  candleBuffers: Map<string, Candle[]>;
  /** Max candles to keep per timeframe */
  maxBufferSize: number;
}

/** All runners for a single trading account */
interface AccountRunners {
  runners: Map<string, StrategyRunner>;
  initialized: boolean;
}

class StrategyExecutor {
  /** Per-account runner maps: accountId → { runners, initialized } */
  private accounts: Map<number, AccountRunners> = new Map();

  /**
   * Initialize all registered strategies for a specific trading account.
   * Fetches warmup candles and starts listening.
   */
  async initialize(tradingAccountId: number): Promise<void> {
    const existing = this.accounts.get(tradingAccountId);
    if (existing?.initialized) {
      console.warn(`[Executor] Account ${tradingAccountId} already initialized`);
      return;
    }

    const strategies = getAllStrategies();
    if (strategies.length === 0) {
      console.log('[Executor] No strategies registered');
      return;
    }

    const accountRunners: AccountRunners = {
      runners: new Map(),
      initialized: false,
    };

    console.log(`[Executor] Initializing ${strategies.length} strategies for account ${tradingAccountId}...`);

    for (const strategy of strategies) {
      try {
        const runner: StrategyRunner = {
          strategy,
          tradingAccountId,
          paused: false,
          candleBuffers: new Map(),
          maxBufferSize: strategy.config.warmupCandles + 50,
        };

        // Fetch warmup candles for each timeframe
        const warmupData: MultiTimeframeData = {};
        const exchange = await exchangeManager.getForAccount(tradingAccountId);

        for (const tf of strategy.config.timeframes) {
          const primarySymbol = strategy.config.symbols[0] || 'BTCUSDT';
          try {
            const exchangeCandles = await exchange.getCandles(
              primarySymbol,
              tf as ExchangeInterval,
              strategy.config.warmupCandles
            );
            const candles = exchangeCandles.map(this.toCandle);
            warmupData[tf] = candles;
            runner.candleBuffers.set(tf, candles);
          } catch (err: any) {
            console.error(`[Executor] Failed to fetch ${tf} warmup for ${strategy.config.id} on account ${tradingAccountId}: ${err.message}`);
            warmupData[tf] = [];
          }
        }

        strategy.initialize(warmupData);
        accountRunners.runners.set(strategy.config.id, runner);
        console.log(`[Executor] Account ${tradingAccountId}: initialized ${strategy.config.name} (${strategy.config.id})`);
      } catch (err: any) {
        console.error(`[Executor] Failed to initialize ${strategy.config.id} for account ${tradingAccountId}: ${err.message}`);
      }
    }

    accountRunners.initialized = true;
    this.accounts.set(tradingAccountId, accountRunners);
    console.log(`[Executor] Account ${tradingAccountId}: ${accountRunners.runners.size} strategies running`);
  }

  /**
   * Feed a new confirmed candle to all strategies across all accounts that use this timeframe.
   * Called by WebSocket candle handler or polling loop.
   */
  async onCandle(_symbol: string, interval: string, candle: Candle): Promise<void> {
    for (const [, accountRunners] of this.accounts) {
      if (!accountRunners.initialized) continue;

      for (const [id, runner] of accountRunners.runners) {
        if (runner.paused) continue;
        if (!runner.strategy.config.timeframes.includes(interval as ExchangeInterval)) continue;

        // Update candle buffer
        const buffer = runner.candleBuffers.get(interval) || [];
        buffer.push(candle);
        if (buffer.length > runner.maxBufferSize) {
          buffer.splice(0, buffer.length - runner.maxBufferSize);
        }
        runner.candleBuffers.set(interval, buffer);

        // Only run strategy on primary timeframe candle
        if (interval !== runner.strategy.config.primaryTimeframe) continue;

        // Build multi-timeframe data from buffers
        const data: MultiTimeframeData = {};
        for (const tf of runner.strategy.config.timeframes) {
          data[tf] = runner.candleBuffers.get(tf) || [];
        }

        try {
          const signals = runner.strategy.onCandle(data);
          await this.processSignals(signals, runner);
        } catch (err: any) {
          console.error(`[Executor] ${id} error on candle (account ${runner.tradingAccountId}): ${err.message}`);
        }
      }
    }
  }

  /**
   * Pause a strategy for a specific account.
   */
  pause(tradingAccountId: number, strategyId: string): boolean {
    const runner = this.getRunner(tradingAccountId, strategyId);
    if (!runner) return false;
    runner.paused = true;
    console.log(`[Executor] Paused: ${strategyId} on account ${tradingAccountId}`);
    return true;
  }

  /**
   * Resume a paused strategy for a specific account.
   */
  resume(tradingAccountId: number, strategyId: string): boolean {
    const runner = this.getRunner(tradingAccountId, strategyId);
    if (!runner) return false;
    runner.paused = false;
    console.log(`[Executor] Resumed: ${strategyId} on account ${tradingAccountId}`);
    return true;
  }

  /**
   * Get status of all runners for a specific account.
   */
  getStatus(tradingAccountId: number): Record<string, { config: any; state: any; paused: boolean }> {
    const accountRunners = this.accounts.get(tradingAccountId);
    if (!accountRunners) return {};

    const status: Record<string, any> = {};
    for (const [id, runner] of accountRunners.runners) {
      status[id] = {
        config: runner.strategy.config,
        state: runner.strategy.getState(),
        paused: runner.paused,
      };
    }
    return status;
  }

  /**
   * Get all initialized account IDs.
   */
  getInitializedAccountIds(): number[] {
    const ids: number[] = [];
    for (const [accountId, accountRunners] of this.accounts) {
      if (accountRunners.initialized) ids.push(accountId);
    }
    return ids;
  }

  // ── Private ──

  private getRunner(tradingAccountId: number, strategyId: string): StrategyRunner | undefined {
    return this.accounts.get(tradingAccountId)?.runners.get(strategyId);
  }

  private async processSignals(signals: StrategySignal[], runner: StrategyRunner): Promise<void> {
    for (const signal of signals) {
      if (signal.action === 'hold') continue;

      console.log(`[Executor] ${runner.strategy.config.id} (account ${runner.tradingAccountId}) → ${signal.action} ${signal.symbol}: ${signal.reason}`);

      const result = await signalProcessor.process(
        signal,
        runner.strategy.config,
        runner.tradingAccountId
      );

      if (!result.success) {
        console.error(`[Executor] Signal failed: ${result.error}`);
      }
    }
  }

  private toCandle(ec: ExchangeCandle): Candle {
    return {
      timestamp: ec.timestamp,
      open: ec.open,
      high: ec.high,
      low: ec.low,
      close: ec.close,
      volume: ec.volume,
    };
  }
}

const strategyExecutor = new StrategyExecutor();
export default strategyExecutor;
