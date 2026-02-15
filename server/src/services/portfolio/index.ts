// Portfolio services — barrel export

export { default as portfolioManager } from './portfolioManager';
export { default as equityTracker } from './equityTracker';
export { default as circuitBreaker } from './circuitBreaker';

export type {
  PortfolioSummary,
  StrategyAllocationInfo,
  StrategyPerformanceMetrics,
  AggregatePerformance,
} from './portfolioManager';

export type {
  EquitySnapshot,
  EquityCurvePoint,
  PerformanceMetrics,
} from './equityTracker';

export type {
  CircuitBreakerConfig,
  CircuitBreakerStatus,
} from './circuitBreaker';
