/**
 * Circuit Breaker — portfolio and per-strategy drawdown protection.
 *
 * Account-scoped: monitors all active trading accounts.
 * Each account has independent circuit breaker state.
 *
 * Thresholds:
 *   - Portfolio: halt ALL strategies if account drawdown > 25%
 *   - Per-strategy: pause individual strategy if its drawdown > 15%
 *   - Auto-resume: when drawdown recovers to < 10%
 *   - Manual override: user/admin can force-resume
 */

import portfolioManager from './portfolioManager';
import exchangeManager from '../exchange/exchangeManager';
import strategyExecutor from '../../strategies/executor';
import wsBroadcaster from '../../websocket/server';
import notificationService from '../monitoring/notificationService';

// ── Types ──────────────────────────────────────────────────

export interface CircuitBreakerConfig {
  portfolioDrawdownThreshold: number;
  strategyDrawdownThreshold: number;
  autoResumeThreshold: number;
}

export interface CircuitBreakerStatus {
  tradingAccountId: number;
  portfolioTriggered: boolean;
  portfolioDrawdownPct: number;
  portfolioThreshold: number;
  triggeredAt: number | null;
  haltedStrategies: HaltedStrategyInfo[];
  config: CircuitBreakerConfig;
}

interface HaltedStrategyInfo {
  strategyId: string;
  drawdownPct: number;
  haltedAt: number;
  reason: 'portfolio' | 'strategy';
}

// ── Per-account state ──────────────────────────────────────

interface AccountCircuitState {
  portfolioTriggered: boolean;
  triggeredAt: number | null;
  haltedStrategies: Map<string, HaltedStrategyInfo>;
}

// ── Default config ──────────────────────────────────────────

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  portfolioDrawdownThreshold: 25,
  strategyDrawdownThreshold: 15,
  autoResumeThreshold: 10,
};

// ── Service ──────────────────────────────────────────────────

class CircuitBreaker {
  private config: CircuitBreakerConfig = { ...DEFAULT_CONFIG };
  private accountStates: Map<number, AccountCircuitState> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private running = false;

  private getAccountState(tradingAccountId: number): AccountCircuitState {
    let state = this.accountStates.get(tradingAccountId);
    if (!state) {
      state = { portfolioTriggered: false, triggeredAt: null, haltedStrategies: new Map() };
      this.accountStates.set(tradingAccountId, state);
    }
    return state;
  }

  /**
   * Start periodic circuit breaker checks for all active accounts.
   */
  start(config?: Partial<CircuitBreakerConfig>): void {
    if (this.running) {
      console.warn('[CircuitBreaker] Already running');
      return;
    }

    if (config) {
      this.config = { ...DEFAULT_CONFIG, ...config };
    }

    this.running = true;
    this.checkInterval = setInterval(() => {
      void this.evaluateAllAccounts();
    }, 30 * 1000);

    console.log(
      `[CircuitBreaker] Started (portfolio: ${this.config.portfolioDrawdownThreshold}%, ` +
      `strategy: ${this.config.strategyDrawdownThreshold}%, ` +
      `auto-resume: ${this.config.autoResumeThreshold}%)`
    );
  }

  /**
   * Stop circuit breaker monitoring.
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.running = false;
    console.log('[CircuitBreaker] Stopped');
  }

  /**
   * Evaluate all active accounts.
   */
  private async evaluateAllAccounts(): Promise<void> {
    try {
      const accountIds = await exchangeManager.getActiveAccountIds();
      for (const accountId of accountIds) {
        await this.evaluate(accountId);
      }
    } catch (err: any) {
      console.error(`[CircuitBreaker] Evaluation loop error: ${err.message}`);
    }
  }

  /**
   * Evaluate drawdown for a specific account.
   */
  async evaluate(tradingAccountId: number): Promise<void> {
    try {
      const drawdownPct = portfolioManager.getDrawdownPct(tradingAccountId);
      const acctState = this.getAccountState(tradingAccountId);

      // ── Portfolio-level check ──
      if (!acctState.portfolioTriggered && drawdownPct >= this.config.portfolioDrawdownThreshold) {
        await this.triggerPortfolioHalt(tradingAccountId, drawdownPct);
      } else if (acctState.portfolioTriggered && drawdownPct < this.config.autoResumeThreshold) {
        await this.releasePortfolioHalt(tradingAccountId, drawdownPct);
      }

      // ── Per-strategy checks (only if portfolio isn't halted) ──
      if (!acctState.portfolioTriggered) {
        await this.evaluateStrategies(tradingAccountId);
      }
    } catch (err: any) {
      console.error(`[CircuitBreaker] Evaluation error for account ${tradingAccountId}: ${err.message}`);
    }
  }

  /**
   * Manual override — force resume for a specific account.
   */
  async forceResume(tradingAccountId: number, strategyId?: string): Promise<boolean> {
    const acctState = this.getAccountState(tradingAccountId);

    if (strategyId) {
      const halted = acctState.haltedStrategies.get(strategyId);
      if (!halted) return false;

      strategyExecutor.resume(tradingAccountId, strategyId);
      acctState.haltedStrategies.delete(strategyId);

      console.log(`[CircuitBreaker] Force-resumed strategy ${strategyId} on account ${tradingAccountId}`);
      this.broadcastStateChange(tradingAccountId, strategyId, 'released', 0);
      return true;
    }

    // Resume portfolio
    if (!acctState.portfolioTriggered) return false;

    acctState.portfolioTriggered = false;
    acctState.triggeredAt = null;

    for (const [id, info] of acctState.haltedStrategies) {
      if (info.reason === 'portfolio') {
        strategyExecutor.resume(tradingAccountId, id);
        acctState.haltedStrategies.delete(id);
      }
    }

    console.log(`[CircuitBreaker] Force-resumed portfolio on account ${tradingAccountId}`);

    wsBroadcaster.broadcastToAccount(tradingAccountId, 'portfolio:circuit_breaker', {
      type: 'portfolio',
      tradingAccountId,
      action: 'force_resumed',
      drawdownPct: portfolioManager.getDrawdownPct(tradingAccountId),
      timestamp: Date.now(),
    });

    await notificationService.sendCircuitBreakerAlert({
      type: 'portfolio',
      drawdownPct: portfolioManager.getDrawdownPct(tradingAccountId),
      threshold: this.config.portfolioDrawdownThreshold,
      action: 'released',
    });

    return true;
  }

  /**
   * Check if portfolio-level circuit breaker is triggered for an account.
   */
  isPortfolioTriggered(tradingAccountId: number): boolean {
    return this.getAccountState(tradingAccountId).portfolioTriggered;
  }

  /**
   * Check if a specific strategy is halted for an account.
   */
  isStrategyHalted(tradingAccountId: number, strategyId: string): boolean {
    return this.getAccountState(tradingAccountId).haltedStrategies.has(strategyId);
  }

  /**
   * Get full circuit breaker status for an account.
   */
  getStatus(tradingAccountId: number): CircuitBreakerStatus {
    const acctState = this.getAccountState(tradingAccountId);
    return {
      tradingAccountId,
      portfolioTriggered: acctState.portfolioTriggered,
      portfolioDrawdownPct: portfolioManager.getDrawdownPct(tradingAccountId),
      portfolioThreshold: this.config.portfolioDrawdownThreshold,
      triggeredAt: acctState.triggeredAt,
      haltedStrategies: Array.from(acctState.haltedStrategies.values()),
      config: { ...this.config },
    };
  }

  /**
   * Update circuit breaker thresholds (global, applies to all accounts).
   */
  updateConfig(config: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...config };
    console.log(`[CircuitBreaker] Config updated:`, this.config);
  }

  isRunning(): boolean {
    return this.running;
  }

  // ── Private ──────────────────────────────────────────────

  private async triggerPortfolioHalt(tradingAccountId: number, drawdownPct: number): Promise<void> {
    const acctState = this.getAccountState(tradingAccountId);
    acctState.portfolioTriggered = true;
    acctState.triggeredAt = Date.now();

    console.error(`[CircuitBreaker] PORTFOLIO HALT — account ${tradingAccountId}, drawdown ${drawdownPct.toFixed(1)}% >= ${this.config.portfolioDrawdownThreshold}%`);

    // Pause all strategies for this account
    const status = strategyExecutor.getStatus(tradingAccountId);
    for (const strategyId of Object.keys(status)) {
      if (!acctState.haltedStrategies.has(strategyId)) {
        strategyExecutor.pause(tradingAccountId, strategyId);
        acctState.haltedStrategies.set(strategyId, {
          strategyId,
          drawdownPct,
          haltedAt: Date.now(),
          reason: 'portfolio',
        });
      }
    }

    wsBroadcaster.broadcastToAccount(tradingAccountId, 'portfolio:circuit_breaker', {
      type: 'portfolio',
      tradingAccountId,
      action: 'triggered',
      drawdownPct,
      threshold: this.config.portfolioDrawdownThreshold,
      timestamp: Date.now(),
    });

    wsBroadcaster.broadcastToAccount(tradingAccountId, 'portfolio:drawdown_alert', {
      level: 'critical',
      tradingAccountId,
      drawdownPct,
      threshold: this.config.portfolioDrawdownThreshold,
      message: `Portfolio drawdown ${drawdownPct.toFixed(1)}% exceeded ${this.config.portfolioDrawdownThreshold}% threshold — all strategies halted`,
    });

    await notificationService.sendCircuitBreakerAlert({
      type: 'portfolio',
      drawdownPct,
      threshold: this.config.portfolioDrawdownThreshold,
      action: 'triggered',
    });
  }

  private async releasePortfolioHalt(tradingAccountId: number, drawdownPct: number): Promise<void> {
    const acctState = this.getAccountState(tradingAccountId);
    acctState.portfolioTriggered = false;
    acctState.triggeredAt = null;

    console.log(`[CircuitBreaker] Portfolio recovered — account ${tradingAccountId}, drawdown ${drawdownPct.toFixed(1)}% < ${this.config.autoResumeThreshold}%`);

    for (const [id, info] of acctState.haltedStrategies) {
      if (info.reason === 'portfolio') {
        strategyExecutor.resume(tradingAccountId, id);
        acctState.haltedStrategies.delete(id);
      }
    }

    wsBroadcaster.broadcastToAccount(tradingAccountId, 'portfolio:circuit_breaker', {
      type: 'portfolio',
      tradingAccountId,
      action: 'released',
      drawdownPct,
      threshold: this.config.autoResumeThreshold,
      timestamp: Date.now(),
    });

    await notificationService.sendCircuitBreakerAlert({
      type: 'portfolio',
      drawdownPct,
      threshold: this.config.portfolioDrawdownThreshold,
      action: 'released',
    });
  }

  private async evaluateStrategies(tradingAccountId: number): Promise<void> {
    const acctState = this.getAccountState(tradingAccountId);
    const status = strategyExecutor.getStatus(tradingAccountId);

    for (const [strategyId] of Object.entries(status)) {
      const perf = await portfolioManager.getStrategyPerformance(tradingAccountId, strategyId);
      const strategyDrawdown = perf.maxDrawdown;

      // Check if strategy should be halted
      if (!acctState.haltedStrategies.has(strategyId) && strategyDrawdown >= this.config.strategyDrawdownThreshold) {
        strategyExecutor.pause(tradingAccountId, strategyId);
        acctState.haltedStrategies.set(strategyId, {
          strategyId,
          drawdownPct: strategyDrawdown,
          haltedAt: Date.now(),
          reason: 'strategy',
        });

        console.warn(`[CircuitBreaker] Strategy halted: ${strategyId} on account ${tradingAccountId} — drawdown ${strategyDrawdown.toFixed(1)}%`);
        this.broadcastStateChange(tradingAccountId, strategyId, 'triggered', strategyDrawdown);

        await notificationService.sendCircuitBreakerAlert({
          type: 'strategy',
          strategyId,
          drawdownPct: strategyDrawdown,
          threshold: this.config.strategyDrawdownThreshold,
          action: 'triggered',
        });
      }

      // Check if strategy should auto-resume
      const halted = acctState.haltedStrategies.get(strategyId);
      if (halted && halted.reason === 'strategy' && strategyDrawdown < this.config.autoResumeThreshold) {
        strategyExecutor.resume(tradingAccountId, strategyId);
        acctState.haltedStrategies.delete(strategyId);

        console.log(`[CircuitBreaker] Strategy auto-resumed: ${strategyId} on account ${tradingAccountId}`);
        this.broadcastStateChange(tradingAccountId, strategyId, 'released', strategyDrawdown);

        await notificationService.sendCircuitBreakerAlert({
          type: 'strategy',
          strategyId,
          drawdownPct: strategyDrawdown,
          threshold: this.config.strategyDrawdownThreshold,
          action: 'released',
        });
      }
    }
  }

  private broadcastStateChange(tradingAccountId: number, strategyId: string, action: string, drawdownPct: number): void {
    wsBroadcaster.broadcastToAccount(tradingAccountId, 'portfolio:circuit_breaker', {
      type: 'strategy',
      tradingAccountId,
      strategyId,
      action,
      drawdownPct,
      timestamp: Date.now(),
    });

    wsBroadcaster.broadcastToAccount(tradingAccountId, 'strategy:state_change', {
      strategyId,
      tradingAccountId,
      newStatus: action === 'triggered' ? 'paused' : 'running',
      reason: action === 'triggered' ? 'circuit_breaker' : 'auto_resume',
      timestamp: Date.now(),
    });
  }
}

const circuitBreaker = new CircuitBreaker();
export default circuitBreaker;
