import { create } from 'zustand';

/**
 * Strategy Store — per-strategy state, signals, configs.
 * Non-persisted — fetched from API and updated via WebSocket.
 */

export interface StrategyInfo {
  id: string;
  name: string;
  category: string;
  timeframes: string[];
  symbols: string[];
  capitalAllocationPercent: number;
  maxLeverage: number;
  paused: boolean;
  state: {
    status: 'idle' | 'running' | 'paused' | 'error';
    activePositions: string[];
    metrics: {
      signalsEmitted: number;
      tradesOpened: number;
      tradesClosed: number;
      winRate: number;
      totalPnl: number;
    };
  };
}

export interface StrategyPerformance {
  strategyId: string;
  totalPnl: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number | null;
  currentAllocationPct: number;
  isActive: boolean;
  lastUpdated: number;
}

interface StrategyState {
  strategies: StrategyInfo[];
  performances: Record<string, StrategyPerformance>;
  loading: boolean;
  error: string | null;

  setStrategies: (strategies: StrategyInfo[]) => void;
  updateStrategy: (id: string, partial: Partial<StrategyInfo>) => void;
  setPerformance: (id: string, perf: StrategyPerformance) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const useStrategyStore = create<StrategyState>()(set => ({
  strategies: [],
  performances: {},
  loading: false,
  error: null,

  setStrategies: (strategies) => set({ strategies, loading: false }),

  updateStrategy: (id, partial) =>
    set(state => ({
      strategies: state.strategies.map(s =>
        s.id === id ? { ...s, ...partial } : s
      ),
    })),

  setPerformance: (id, perf) =>
    set(state => ({
      performances: { ...state.performances, [id]: perf },
    })),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),

  clear: () => set({ strategies: [], performances: {}, loading: false, error: null }),
}));
