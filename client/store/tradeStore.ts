import { create } from 'zustand';

/**
 * Trade Store — active trades, orders, trade history.
 * Non-persisted — fetched from API.
 */

export interface Trade {
  id: number;
  tradingAccountId: number;
  symbol: string;
  exchange: string;
  isTest: boolean;
  tradeType: 'manual' | 'strategy';
  strategyName?: string;
  side: 'long' | 'short';
  entryPrice?: number;
  quantity: number;
  remainingQuantity: number;
  leverage: number;
  status: 'pending' | 'active' | 'closed' | 'cancelled' | 'error';
  realizedPnl: number;
  unrealizedPnl: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface Balance {
  coin: string;
  available: number;
  total: number;
  unrealizedPnl: number;
}

interface TradeState {
  trades: Trade[];
  balances: Balance[];
  loading: boolean;
  error: string | null;

  setTrades: (trades: Trade[]) => void;
  addTrade: (trade: Trade) => void;
  updateTrade: (id: number, partial: Partial<Trade>) => void;
  removeTrade: (id: number) => void;
  setBalances: (balances: Balance[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const useTradeStore = create<TradeState>()(set => ({
  trades: [],
  balances: [],
  loading: false,
  error: null,

  setTrades: (trades) => set({ trades, loading: false }),

  addTrade: (trade) =>
    set(state => ({ trades: [trade, ...state.trades] })),

  updateTrade: (id, partial) =>
    set(state => ({
      trades: state.trades.map(t =>
        t.id === id ? { ...t, ...partial } : t
      ),
    })),

  removeTrade: (id) =>
    set(state => ({
      trades: state.trades.filter(t => t.id !== id),
    })),

  setBalances: (balances) => set({ balances }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),

  clear: () => set({ trades: [], balances: [], loading: false, error: null }),
}));
