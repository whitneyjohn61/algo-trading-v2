import type { Strategy, StrategyConfig } from './types';

// ── Registry ───────────────────────────────────────────────

const strategies: Map<string, Strategy> = new Map();

export function registerStrategy(strategy: Strategy): void {
  const id = strategy.config.id;
  if (strategies.has(id)) {
    console.warn(`[StrategyRegistry] Overwriting existing strategy: ${id}`);
  }
  strategies.set(id, strategy);
  console.log(`[StrategyRegistry] Registered: ${strategy.config.name} (${id})`);
}

export function getStrategy(id: string): Strategy | undefined {
  return strategies.get(id);
}

export function getAllStrategies(): Strategy[] {
  return Array.from(strategies.values());
}

export function getStrategyConfigs(): StrategyConfig[] {
  return Array.from(strategies.values()).map(s => s.config);
}

export function hasStrategy(id: string): boolean {
  return strategies.has(id);
}
