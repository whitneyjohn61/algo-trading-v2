import riskService, { DEFAULT_RISK_LIMITS } from '../../../src/services/trading/riskService';

// ── Stop loss direction validation (pure logic, no DB/exchange) ──

describe('RiskService — validateStopLossDirection', () => {
  it('should pass when no stop loss provided', () => {
    const result = riskService.validateStopLossDirection({
      tradingAccountId: 1, symbol: 'BTCUSDT', side: 'long',
      quantity: 1, entryPrice: 50000,
    });
    expect(result.passed).toBe(true);
  });

  it('should pass for valid long SL (below entry)', () => {
    const result = riskService.validateStopLossDirection({
      tradingAccountId: 1, symbol: 'BTCUSDT', side: 'long',
      quantity: 1, entryPrice: 50000, stopLossPrice: 49000,
    });
    expect(result.passed).toBe(true);
  });

  it('should fail for long SL above entry', () => {
    const result = riskService.validateStopLossDirection({
      tradingAccountId: 1, symbol: 'BTCUSDT', side: 'long',
      quantity: 1, entryPrice: 50000, stopLossPrice: 51000,
    });
    expect(result.passed).toBe(false);
    expect(result.error).toContain('LONG');
  });

  it('should pass for valid short SL (above entry)', () => {
    const result = riskService.validateStopLossDirection({
      tradingAccountId: 1, symbol: 'BTCUSDT', side: 'short',
      quantity: 1, entryPrice: 50000, stopLossPrice: 51000,
    });
    expect(result.passed).toBe(true);
  });

  it('should fail for short SL below entry', () => {
    const result = riskService.validateStopLossDirection({
      tradingAccountId: 1, symbol: 'BTCUSDT', side: 'short',
      quantity: 1, entryPrice: 50000, stopLossPrice: 49000,
    });
    expect(result.passed).toBe(false);
    expect(result.error).toContain('SHORT');
  });
});

// ── Max loss validation (pure logic) ──

describe('RiskService — validateMaxLoss', () => {
  const params = {
    tradingAccountId: 1, symbol: 'BTCUSDT', side: 'long' as const,
    quantity: 0.1, entryPrice: 50000, stopLossPrice: 49000,
  };

  it('should pass when loss is within limits', () => {
    const result = riskService.validateMaxLoss(params, 10000, DEFAULT_RISK_LIMITS);
    // Loss = 0.1 * 1000 = $100 — well within $500 max and $10000 equity
    expect(result.passed).toBe(true);
  });

  it('should fail when loss exceeds equity', () => {
    const result = riskService.validateMaxLoss(params, 50, DEFAULT_RISK_LIMITS);
    // Loss = $100 > $50 equity
    expect(result.passed).toBe(false);
    expect(result.error).toContain('exceeds account equity');
  });

  it('should fail when loss exceeds per-trade max', () => {
    const limits = { ...DEFAULT_RISK_LIMITS, maxLossPerTradeUsd: 50 };
    const result = riskService.validateMaxLoss(params, 10000, limits);
    // Loss = $100 > $50 per-trade max
    expect(result.passed).toBe(false);
    expect(result.error).toContain('exceeds max per trade');
  });

  it('should pass when no stop loss provided', () => {
    const noSl = { ...params, stopLossPrice: undefined };
    const result = riskService.validateMaxLoss(noSl, 10000, DEFAULT_RISK_LIMITS);
    expect(result.passed).toBe(true);
  });
});

// ── Risk percent validation (pure logic) ──

describe('RiskService — validateRiskPercent', () => {
  it('should pass when risk % is within limit', () => {
    const params = {
      tradingAccountId: 1, symbol: 'BTCUSDT', side: 'long' as const,
      quantity: 0.01, entryPrice: 50000, stopLossPrice: 49000,
    };
    // Loss = 0.01 * 1000 = $10. Equity = $10000. Risk = 0.1%
    const result = riskService.validateRiskPercent(params, 10000, DEFAULT_RISK_LIMITS);
    expect(result.passed).toBe(true);
  });

  it('should fail when risk % exceeds limit', () => {
    const params = {
      tradingAccountId: 1, symbol: 'BTCUSDT', side: 'long' as const,
      quantity: 1, entryPrice: 50000, stopLossPrice: 48000,
    };
    // Loss = 1 * 2000 = $2000. Equity = $10000. Risk = 20% > 2% limit
    const result = riskService.validateRiskPercent(params, 10000, DEFAULT_RISK_LIMITS);
    expect(result.passed).toBe(false);
    expect(result.error).toContain('risks');
  });
});
