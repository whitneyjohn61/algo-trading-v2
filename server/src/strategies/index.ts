// ── Types ──────────────────────────────────────────────────
export type {
  Strategy,
  StrategyConfig,
  StrategyState,
  StrategySignal,
  SignalAction,
  MultiTimeframeData,
  StrategyStatus,
} from './types';

// ── Strategies ─────────────────────────────────────────────
export { TrendFollowingStrategy } from './trendFollowing';
export { MeanReversionStrategy } from './meanReversion';
export { FundingCarryStrategy } from './fundingCarry';
export { CrossMomentumStrategy } from './crossMomentum';

// ── Registry ───────────────────────────────────────────────
export {
  registerStrategy,
  getStrategy,
  getAllStrategies,
  getStrategyConfigs,
  hasStrategy,
} from './registry';

// ── Executor + Signal Processor ────────────────────────────
export { default as strategyExecutor } from './executor';
export { default as signalProcessor } from './signalProcessor';

// ── Auto-register all strategies ───────────────────────────
import { registerStrategy } from './registry';
import { TrendFollowingStrategy } from './trendFollowing';
import { MeanReversionStrategy } from './meanReversion';
import { FundingCarryStrategy } from './fundingCarry';
import { CrossMomentumStrategy } from './crossMomentum';

registerStrategy(new TrendFollowingStrategy());
registerStrategy(new MeanReversionStrategy());
registerStrategy(new FundingCarryStrategy());
registerStrategy(new CrossMomentumStrategy());
