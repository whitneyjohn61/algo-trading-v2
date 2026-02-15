/**
 * Risk Validation Service
 *
 * V1 transplants:
 *   - Per-trade max loss check
 *   - Per-trade risk percentage check
 *   - Portfolio-level total risk check
 *
 * V2 additions:
 *   - Strategy allocation enforcement (each strategy capped at its % of capital)
 *   - Cross-strategy conflict detection (same symbol, opposing sides)
 *   - Portfolio drawdown circuit breaker (halt all if drawdown > threshold)
 *   - Per-strategy drawdown tracking (pause individual strategy if its drawdown > threshold)
 */

import db from '../database/connection';
import exchangeManager from '../exchange/exchangeManager';

// ── Types ──────────────────────────────────────────────────

export interface RiskLimits {
  maxLossPerTradeUsd: number;           // Max $ loss per single trade (stop loss risk)
  maxRiskPercentPerTrade: number;       // Max % of equity to risk per trade
  maxTotalPortfolioRiskPercent: number; // Max aggregate risk across all open positions
  maxPortfolioDrawdownPercent: number;  // Circuit breaker: halt all if drawdown exceeds
  maxStrategyDrawdownPercent: number;   // Pause individual strategy if its drawdown exceeds
}

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxLossPerTradeUsd: 500,
  maxRiskPercentPerTrade: 2,
  maxTotalPortfolioRiskPercent: 20,
  maxPortfolioDrawdownPercent: 15,
  maxStrategyDrawdownPercent: 10,
};

export interface TradeRiskParams {
  tradingAccountId: number;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  stopLossPrice?: number;
  leverage?: number;
  strategyName?: string;
}

export interface StrategyAllocation {
  strategyName: string;
  maxCapitalPercent: number; // e.g. 25 = 25% of total equity
}

export interface RiskCheckResult {
  passed: boolean;
  error?: string;
  details?: Record<string, any>;
}

// ── Service ────────────────────────────────────────────────

class RiskService {
  // ── Get risk limits from trading account params ──

  async getRiskLimits(tradingAccountId: number): Promise<RiskLimits> {
    try {
      const result = await db.query(
        `SELECT params FROM trading_accounts WHERE id = $1 AND is_active = true`,
        [tradingAccountId]
      );
      if (result.rows.length === 0) return { ...DEFAULT_RISK_LIMITS };

      const params = result.rows[0]?.params || {};
      return {
        maxLossPerTradeUsd: params.maxLossPerTradeUsd ?? DEFAULT_RISK_LIMITS.maxLossPerTradeUsd,
        maxRiskPercentPerTrade: params.maxRiskPercentPerTrade ?? DEFAULT_RISK_LIMITS.maxRiskPercentPerTrade,
        maxTotalPortfolioRiskPercent: params.maxTotalPortfolioRiskPercent ?? DEFAULT_RISK_LIMITS.maxTotalPortfolioRiskPercent,
        maxPortfolioDrawdownPercent: params.maxPortfolioDrawdownPercent ?? DEFAULT_RISK_LIMITS.maxPortfolioDrawdownPercent,
        maxStrategyDrawdownPercent: params.maxStrategyDrawdownPercent ?? DEFAULT_RISK_LIMITS.maxStrategyDrawdownPercent,
      };
    } catch {
      return { ...DEFAULT_RISK_LIMITS };
    }
  }

  // ── Full trade validation pipeline ──

  async validateTrade(params: TradeRiskParams): Promise<RiskCheckResult> {
    const limits = await this.getRiskLimits(params.tradingAccountId);

    let equity: number;
    try {
      const exchange = exchangeManager.getDefault();
      equity = await exchange.getTotalEquity();
    } catch {
      return { passed: false, error: 'Failed to fetch account equity from exchange' };
    }

    if (equity <= 0) {
      return { passed: false, error: 'Account equity is zero or negative' };
    }

    // 1. Stop loss direction check
    const dirCheck = this.validateStopLossDirection(params);
    if (!dirCheck.passed) return dirCheck;

    // 2. Max loss per trade
    const maxLossCheck = this.validateMaxLoss(params, equity, limits);
    if (!maxLossCheck.passed) return maxLossCheck;

    // 3. Risk percentage per trade
    const riskPctCheck = this.validateRiskPercent(params, equity, limits);
    if (!riskPctCheck.passed) return riskPctCheck;

    // 4. Total portfolio risk
    const portfolioCheck = await this.validateTotalPortfolioRisk(params, equity, limits);
    if (!portfolioCheck.passed) return portfolioCheck;

    // 5. Strategy allocation enforcement (if strategy trade)
    if (params.strategyName) {
      const allocCheck = await this.validateStrategyAllocation(params, equity);
      if (!allocCheck.passed) return allocCheck;
    }

    // 6. Cross-strategy conflict detection
    if (params.strategyName) {
      const conflictCheck = await this.validateNoConflict(params);
      if (!conflictCheck.passed) return conflictCheck;
    }

    // 7. Portfolio drawdown circuit breaker
    const drawdownCheck = await this.validatePortfolioDrawdown(params.tradingAccountId, equity, limits);
    if (!drawdownCheck.passed) return drawdownCheck;

    return {
      passed: true,
      details: {
        equity,
        potentialLoss: this.calcPotentialLoss(params),
        riskPercent: this.calcPotentialLoss(params) / equity * 100,
        limits,
      },
    };
  }

  // ── Individual checks ──

  /** Validate stop loss is on the correct side of entry price */
  validateStopLossDirection(params: TradeRiskParams): RiskCheckResult {
    if (!params.stopLossPrice) return { passed: true };

    if (params.side === 'long' && params.stopLossPrice >= params.entryPrice) {
      return {
        passed: false,
        error: `Invalid stop loss for LONG: SL ($${params.stopLossPrice}) must be below entry ($${params.entryPrice})`,
      };
    }
    if (params.side === 'short' && params.stopLossPrice <= params.entryPrice) {
      return {
        passed: false,
        error: `Invalid stop loss for SHORT: SL ($${params.stopLossPrice}) must be above entry ($${params.entryPrice})`,
      };
    }
    return { passed: true };
  }

  /** V1 transplant: max loss per trade check */
  validateMaxLoss(
    params: TradeRiskParams,
    equity: number,
    limits: RiskLimits
  ): RiskCheckResult {
    if (!params.stopLossPrice) return { passed: true };

    const loss = this.calcPotentialLoss(params);

    // Would overdraw account
    if (loss > equity) {
      return {
        passed: false,
        error: `Stop loss risk ($${loss.toFixed(2)}) exceeds account equity ($${equity.toFixed(2)})`,
        details: { loss, equity },
      };
    }

    // Exceeds per-trade max
    if (limits.maxLossPerTradeUsd > 0 && loss > limits.maxLossPerTradeUsd) {
      return {
        passed: false,
        error: `Stop loss risk ($${loss.toFixed(2)}) exceeds max per trade ($${limits.maxLossPerTradeUsd})`,
        details: { loss, max: limits.maxLossPerTradeUsd },
      };
    }

    return { passed: true, details: { loss } };
  }

  /** V1 transplant: risk % per trade check */
  validateRiskPercent(
    params: TradeRiskParams,
    equity: number,
    limits: RiskLimits
  ): RiskCheckResult {
    if (!params.stopLossPrice) return { passed: true };

    const loss = this.calcPotentialLoss(params);
    const riskPct = (loss / equity) * 100;

    if (limits.maxRiskPercentPerTrade > 0 && riskPct > limits.maxRiskPercentPerTrade) {
      return {
        passed: false,
        error: `Trade risks ${riskPct.toFixed(2)}% of equity, max allowed is ${limits.maxRiskPercentPerTrade}%`,
        details: { riskPct, max: limits.maxRiskPercentPerTrade },
      };
    }

    return { passed: true, details: { riskPct } };
  }

  /** V1 transplant: total portfolio risk (aggregate of all active positions + this trade) */
  async validateTotalPortfolioRisk(
    params: TradeRiskParams,
    equity: number,
    limits: RiskLimits
  ): Promise<RiskCheckResult> {
    try {
      // Sum risk of all active trades with stop losses
      const result = await db.query(
        `SELECT side, entry_price, quantity, additional_info
         FROM trades
         WHERE trading_account_id = $1 AND status = 'active' AND entry_price IS NOT NULL`,
        [params.tradingAccountId]
      );

      let existingRisk = 0;
      for (const row of result.rows) {
        const sl = row.additional_info?.['stop_loss'];
        if (!sl || !row.entry_price) continue;
        const move = Math.abs(row.entry_price - sl);
        existingRisk += Number(row.quantity) * move;
      }

      const newRisk = this.calcPotentialLoss(params);
      const totalRisk = existingRisk + newRisk;
      const totalRiskPct = (totalRisk / equity) * 100;

      if (limits.maxTotalPortfolioRiskPercent > 0 && totalRiskPct > limits.maxTotalPortfolioRiskPercent) {
        return {
          passed: false,
          error: `Total portfolio risk would be ${totalRiskPct.toFixed(2)}%, max allowed is ${limits.maxTotalPortfolioRiskPercent}%`,
          details: { existingRisk, newRisk, totalRisk, totalRiskPct },
        };
      }

      return { passed: true, details: { totalRiskPct } };
    } catch (err: any) {
      return { passed: false, error: `Portfolio risk check failed: ${err.message}` };
    }
  }

  // ── V2 New: Strategy allocation enforcement ──

  /** Ensures strategy doesn't exceed its allocated capital % */
  async validateStrategyAllocation(
    params: TradeRiskParams,
    equity: number
  ): Promise<RiskCheckResult> {
    try {
      // Get strategy allocation from trading account params
      const acctResult = await db.query(
        `SELECT params FROM trading_accounts WHERE id = $1`,
        [params.tradingAccountId]
      );
      const acctParams = acctResult.rows[0]?.params || {};
      const allocations: StrategyAllocation[] = acctParams.strategyAllocations || [];

      const alloc = allocations.find(a => a.strategyName === params.strategyName);
      if (!alloc) return { passed: true }; // No allocation cap configured

      // Sum existing exposure for this strategy
      const result = await db.query(
        `SELECT COALESCE(SUM(quantity * COALESCE(entry_price, 0)), 0) as total_exposure
         FROM trades
         WHERE trading_account_id = $1 AND strategy_name = $2 AND status IN ('pending', 'active')`,
        [params.tradingAccountId, params.strategyName]
      );

      const existingExposure = Number(result.rows[0]?.total_exposure || 0);
      const newExposure = params.quantity * params.entryPrice;
      const totalExposure = existingExposure + newExposure;
      const maxExposure = equity * (alloc.maxCapitalPercent / 100);

      if (totalExposure > maxExposure) {
        return {
          passed: false,
          error: `Strategy "${params.strategyName}" would use $${totalExposure.toFixed(2)} (${((totalExposure / equity) * 100).toFixed(1)}%), max allowed is ${alloc.maxCapitalPercent}% ($${maxExposure.toFixed(2)})`,
          details: { existingExposure, newExposure, totalExposure, maxExposure },
        };
      }

      return { passed: true };
    } catch (err: any) {
      return { passed: false, error: `Strategy allocation check failed: ${err.message}` };
    }
  }

  // ── V2 New: Cross-strategy conflict detection ──

  /** Detects if another strategy has an opposing position on the same symbol */
  async validateNoConflict(params: TradeRiskParams): Promise<RiskCheckResult> {
    try {
      const result = await db.query(
        `SELECT strategy_name, side
         FROM trades
         WHERE trading_account_id = $1
           AND symbol = $2
           AND status = 'active'
           AND strategy_name IS NOT NULL
           AND strategy_name != $3`,
        [params.tradingAccountId, params.symbol, params.strategyName]
      );

      const opposing = result.rows.find(r => r.side !== params.side);
      if (opposing) {
        return {
          passed: false,
          error: `Conflict: strategy "${opposing.strategy_name}" has an active ${opposing.side} on ${params.symbol}. Cannot open ${params.side} from "${params.strategyName}".`,
          details: { conflictingStrategy: opposing.strategy_name, conflictingSide: opposing.side },
        };
      }

      return { passed: true };
    } catch (err: any) {
      return { passed: false, error: `Conflict check failed: ${err.message}` };
    }
  }

  // ── V2 New: Portfolio drawdown circuit breaker ──

  /** Halt all trading if portfolio has drawn down beyond threshold from peak */
  async validatePortfolioDrawdown(
    tradingAccountId: number,
    currentEquity: number,
    limits: RiskLimits
  ): Promise<RiskCheckResult> {
    try {
      // Get peak equity from portfolio snapshots
      const result = await db.query(
        `SELECT MAX(equity) as peak_equity
         FROM portfolio_snapshots
         WHERE trading_account_id = $1`,
        [tradingAccountId]
      );

      const peakEquity = Number(result.rows[0]?.peak_equity || currentEquity);
      if (peakEquity <= 0) return { passed: true };

      const drawdownPct = ((peakEquity - currentEquity) / peakEquity) * 100;

      if (limits.maxPortfolioDrawdownPercent > 0 && drawdownPct > limits.maxPortfolioDrawdownPercent) {
        return {
          passed: false,
          error: `CIRCUIT BREAKER: Portfolio drawdown is ${drawdownPct.toFixed(2)}% (peak: $${peakEquity.toFixed(2)}, current: $${currentEquity.toFixed(2)}). Max allowed: ${limits.maxPortfolioDrawdownPercent}%. All trading halted.`,
          details: { peakEquity, currentEquity, drawdownPct },
        };
      }

      return { passed: true, details: { drawdownPct, peakEquity } };
    } catch (err: any) {
      // If no snapshots exist yet, allow trading
      return { passed: true };
    }
  }

  // ── V2 New: Per-strategy drawdown check ──

  /** Check if a specific strategy has exceeded its individual drawdown threshold */
  async checkStrategyDrawdown(
    tradingAccountId: number,
    strategyName: string,
    limits: RiskLimits
  ): Promise<RiskCheckResult> {
    try {
      const result = await db.query(
        `SELECT peak_equity, current_equity
         FROM strategy_performance
         WHERE trading_account_id = $1 AND strategy_name = $2
         ORDER BY updated_at DESC LIMIT 1`,
        [tradingAccountId, strategyName]
      );

      if (result.rows.length === 0) return { passed: true };

      const peak = Number(result.rows[0]?.peak_equity || 0);
      const current = Number(result.rows[0]?.current_equity || 0);
      if (peak <= 0) return { passed: true };

      const drawdownPct = ((peak - current) / peak) * 100;

      if (limits.maxStrategyDrawdownPercent > 0 && drawdownPct > limits.maxStrategyDrawdownPercent) {
        return {
          passed: false,
          error: `Strategy "${strategyName}" drawdown is ${drawdownPct.toFixed(2)}%, exceeding ${limits.maxStrategyDrawdownPercent}% threshold. Strategy paused.`,
          details: { strategyName, peak, current, drawdownPct },
        };
      }

      return { passed: true, details: { drawdownPct } };
    } catch {
      return { passed: true };
    }
  }

  // ── Helpers ──

  private calcPotentialLoss(params: TradeRiskParams): number {
    if (!params.stopLossPrice) return 0;
    const priceMove = Math.abs(params.entryPrice - params.stopLossPrice);
    return params.quantity * priceMove;
  }
}

const riskService = new RiskService();
export default riskService;
