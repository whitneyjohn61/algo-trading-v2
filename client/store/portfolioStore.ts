import { create } from 'zustand';

/**
 * Portfolio Store — equity, drawdown, allocation, positions.
 * Non-persisted — fetched from API and updated via WebSocket.
 */

export interface Position {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  leverage: number;
  margin: number;
  liquidationPrice: number;
}

export interface StrategyAllocation {
  strategyId: string;
  strategyName: string;
  category: string;
  targetPct: number;
  currentPct: number;
  currentEquity: number;
  isActive: boolean;
  positionCount: number;
  unrealizedPnl: number;
}

export interface EquityCurvePoint {
  timestamp: number;
  equity: number;
  drawdownPct: number;
}

export interface PerformanceMetrics {
  returnPct: number;
  sharpeRatio: number | null;
  maxDrawdown: number;
  totalPnl: number;
  dataPoints: number;
  periodStart: number;
  periodEnd: number;
}

export interface CircuitBreakerStatus {
  tradingAccountId: number;
  portfolioTriggered: boolean;
  portfolioDrawdownPct: number;
  portfolioThreshold: number;
  triggeredAt: number | null;
  haltedStrategies: Array<{
    strategyId: string;
    drawdownPct: number;
    haltedAt: number;
    reason: 'portfolio' | 'strategy';
  }>;
}

interface PortfolioState {
  totalEquity: number;
  availableBalance: number;
  unrealizedPnl: number;
  realizedPnlToday: number;
  peakEquity: number;
  drawdownPct: number;
  positionCount: number;
  positions: Position[];
  strategyAllocations: StrategyAllocation[];
  equityCurve: EquityCurvePoint[];
  performance: PerformanceMetrics | null;
  circuitBreaker: CircuitBreakerStatus | null;
  lastUpdated: number;
  loading: boolean;
  error: string | null;

  setSummary: (summary: Partial<PortfolioState>) => void;
  setEquityCurve: (curve: EquityCurvePoint[]) => void;
  setPerformance: (metrics: PerformanceMetrics) => void;
  setCircuitBreaker: (status: CircuitBreakerStatus) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

const initialState = {
  totalEquity: 0,
  availableBalance: 0,
  unrealizedPnl: 0,
  realizedPnlToday: 0,
  peakEquity: 0,
  drawdownPct: 0,
  positionCount: 0,
  positions: [],
  strategyAllocations: [],
  equityCurve: [],
  performance: null,
  circuitBreaker: null,
  lastUpdated: 0,
  loading: false,
  error: null,
};

export const usePortfolioStore = create<PortfolioState>()(set => ({
  ...initialState,

  setSummary: (summary) => set(state => ({ ...state, ...summary, lastUpdated: Date.now() })),

  setEquityCurve: (curve) => set({ equityCurve: curve }),

  setPerformance: (metrics) => set({ performance: metrics }),

  setCircuitBreaker: (status) => set({ circuitBreaker: status }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),

  clear: () => set(initialState),
}));
