import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

/**
 * API Client — centralized axios instance with auth + account interceptors.
 *
 * Auth: reads token from localStorage (auth-storage) and sets Authorization header.
 * Account: reads activeAccountId from localStorage (account-storage) and sets X-Trading-Account-Id header.
 * Error: intercepts 401 to clear auth and redirect to login.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const instance: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach auth + account headers ──

instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    // Auth token
    try {
      const authRaw = localStorage.getItem('auth-storage');
      if (authRaw) {
        const parsed = JSON.parse(authRaw);
        const token = parsed?.state?.token;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch { /* ignore parse errors */ }

    // Trading account ID
    try {
      const acctRaw = localStorage.getItem('account-storage');
      if (acctRaw) {
        const parsed = JSON.parse(acctRaw);
        const accountId = parsed?.state?.activeAccountId;
        if (accountId) {
          config.headers['X-Trading-Account-Id'] = String(accountId);
        }
      }
    } catch { /* ignore parse errors */ }
  }
  return config;
});

// ── Response interceptor: handle 401 ──

instance.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Clear auth state and redirect
      try {
        localStorage.removeItem('auth-storage');
        localStorage.removeItem('account-storage');
      } catch { /* ignore */ }

      if (window.location.pathname !== '/login') {
        toast.error('Session expired — please log in again');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ── API Modules ──────────────────────────────────────────

const api = {
  // ── Auth ──
  auth: {
    login: async (username: string, password: string) => {
      const res = await instance.post('/auth/login', { username, password });
      return res.data as { token: string; user: { id: number; username: string; email: string; role: string; timezone?: string; avatar_path?: string } };
    },
    register: async (username: string, email: string, password: string) => {
      const res = await instance.post('/auth/register', { username, email, password });
      return res.data;
    },
    me: async () => {
      const res = await instance.get('/auth/me');
      return res.data;
    },
  },

  // ── Trading Accounts ──
  accounts: {
    list: async () => {
      const res = await instance.get('/accounts');
      return res.data as { success: boolean; data: any[]; total: number };
    },
    get: async (id: number) => {
      const res = await instance.get(`/accounts/${id}`);
      return res.data as { success: boolean; data: any };
    },
    create: async (data: { exchange: string; api_key: string; api_secret: string; is_test: boolean; user_id?: number }) => {
      const res = await instance.post('/accounts', data);
      return res.data;
    },
    update: async (id: number, data: Record<string, unknown>) => {
      const res = await instance.put(`/accounts/${id}`, data);
      return res.data;
    },
    delete: async (id: number) => {
      const res = await instance.delete(`/accounts/${id}`);
      return res.data;
    },
    verify: async (data: { exchange: string; api_key: string; api_secret: string; is_test: boolean }) => {
      const res = await instance.post('/accounts/verify', data);
      return res.data as { success: boolean; data: { valid: boolean; totalBalance?: number; error?: string } };
    },
    getBalance: async (id: number) => {
      const res = await instance.get(`/accounts/${id}/balance`);
      return res.data as { success: boolean; data: { balances: any[]; totalBalance: number } };
    },
  },

  // ── Portfolio ──
  portfolio: {
    getSummary: async () => {
      const res = await instance.get('/portfolio/summary');
      return res.data;
    },
    getEquityCurve: async (from?: number, to?: number, limit?: number) => {
      const params: Record<string, string> = {};
      if (from) params.from = String(from);
      if (to) params.to = String(to);
      if (limit) params.limit = String(limit);
      const res = await instance.get('/portfolio/equity-curve', { params });
      return res.data;
    },
    getPerformance: async (period = 'month', from?: number, to?: number) => {
      const params: Record<string, string> = { period };
      if (from) params.from = String(from);
      if (to) params.to = String(to);
      const res = await instance.get('/portfolio/performance', { params });
      return res.data;
    },
    getStrategyPerformance: async (strategyId: string) => {
      const res = await instance.get(`/portfolio/performance/${strategyId}`);
      return res.data;
    },
    getCircuitBreaker: async () => {
      const res = await instance.get('/portfolio/circuit-breaker');
      return res.data;
    },
    forceResume: async (strategyId?: string) => {
      const res = await instance.post('/portfolio/circuit-breaker/resume', { strategyId });
      return res.data;
    },
  },

  // ── Strategies ──
  strategies: {
    list: async () => {
      const res = await instance.get('/strategies');
      return res.data;
    },
    getState: async (id: string) => {
      const res = await instance.get(`/strategies/${id}/state`);
      return res.data;
    },
    updateConfig: async (id: string, config: any) => {
      const res = await instance.put(`/strategies/${id}/config`, config);
      return res.data;
    },
    pause: async (id: string) => {
      const res = await instance.post(`/strategies/${id}/pause`);
      return res.data;
    },
    resume: async (id: string) => {
      const res = await instance.post(`/strategies/${id}/resume`);
      return res.data;
    },
  },

  // ── Trading ──
  trading: {
    createTrade: async (params: {
      symbol: string;
      side: 'long' | 'short';
      quantity: number;
      orderType: 'market' | 'limit';
      leverage?: number;
      price?: number;
      stopLoss?: number;
      takeProfit?: number;
      notes?: string;
    }) => {
      const res = await instance.post('/trading/trades', params);
      return res.data;
    },
    getTrades: async (filters?: {
      status?: string;
      symbol?: string;
      strategyName?: string;
      limit?: number;
      offset?: number;
    }) => {
      const res = await instance.get('/trading/trades', { params: filters });
      return res.data;
    },
    getTrade: async (id: number) => {
      const res = await instance.get(`/trading/trades/${id}`);
      return res.data;
    },
    updateTradeSLTP: async (id: number, stopLoss?: number, takeProfit?: number) => {
      const res = await instance.put(`/trading/trades/${id}`, { stopLoss, takeProfit });
      return res.data;
    },
    closeTrade: async (id: number, quantity?: number) => {
      const res = await instance.post(`/trading/trades/${id}/close`, { quantity });
      return res.data;
    },
    cancelOrder: async (orderId: string, symbol: string) => {
      const res = await instance.delete(`/trading/orders/${orderId}`, { params: { symbol } });
      return res.data;
    },
    getPositions: async (symbol?: string) => {
      const res = await instance.get('/trading/positions', { params: symbol ? { symbol } : {} });
      return res.data;
    },
    getBalance: async () => {
      const res = await instance.get('/trading/balance');
      return res.data;
    },
  },

  // ── Market Data (public, no account needed) ──
  market: {
    getCandles: async (symbol: string, interval: string, limit = 200) => {
      const res = await instance.get(`/market/candles/${symbol}`, { params: { interval, limit } });
      return res.data;
    },
    getTicker: async (symbol: string) => {
      const res = await instance.get(`/market/ticker/${symbol}`);
      return res.data;
    },
    getFundingRate: async (symbol: string) => {
      const res = await instance.get(`/market/funding/${symbol}`);
      return res.data;
    },
    getOpenInterest: async (symbol: string) => {
      const res = await instance.get(`/market/open-interest/${symbol}`);
      return res.data;
    },
    getSymbols: async () => {
      const res = await instance.get('/market/symbols');
      return res.data;
    },
    getIntervals: async () => {
      const res = await instance.get('/market/intervals');
      return res.data;
    },
  },

  // ── Backtest ──
  backtest: {
    run: async (params: {
      strategyId: string; symbol: string; interval: string;
      startTime: number; endTime: number; initialBalance: number;
      leverage: number; saveToDb?: boolean;
    }) => {
      const res = await instance.post('/backtest/run', params);
      return res.data as { success: boolean; data: any; error?: string };
    },
    portfolioRun: async (params: {
      strategyIds?: string[]; symbol: string; interval: string;
      startTime: number; endTime: number; initialBalance: number;
      leverage: number; saveToDb?: boolean;
    }) => {
      const res = await instance.post('/backtest/portfolio-run', params);
      return res.data as { success: boolean; data: any };
    },
    getStrategies: async () => {
      const res = await instance.get('/backtest/strategies');
      return res.data as { success: boolean; data: { id: string; name: string; category: string }[] };
    },
    listRuns: async (filters?: { strategy?: string; symbol?: string; limit?: number; offset?: number }) => {
      const res = await instance.get('/backtest/runs', { params: filters });
      return res.data as { success: boolean; data: any[] };
    },
    getRun: async (id: number) => {
      const res = await instance.get(`/backtest/runs/${id}`);
      return res.data as { success: boolean; data: any };
    },
    deleteRun: async (id: number) => {
      const res = await instance.delete(`/backtest/runs/${id}`);
      return res.data;
    },
  },

  // ── Users ──
  users: {
    list: async (params?: { limit?: number; offset?: number; includeInactive?: boolean }) => {
      const res = await instance.get('/users', { params });
      return res.data as { success: boolean; data: { users: any[]; total: number } };
    },
    get: async (id: number) => {
      const res = await instance.get(`/users/${id}`);
      return res.data as { success: boolean; data: any };
    },
    create: async (data: {
      username: string; email: string; password: string; role?: string;
      first_name?: string; last_name?: string; phone?: string; timezone?: string;
    }) => {
      const res = await instance.post('/users', data);
      return res.data;
    },
    update: async (id: number, data: Record<string, unknown>) => {
      const res = await instance.put(`/users/${id}`, data);
      return res.data;
    },
    changePassword: async (id: number, data: { currentPassword?: string; newPassword: string }) => {
      const res = await instance.post(`/users/${id}/change-password`, data);
      return res.data;
    },
    deactivate: async (id: number) => {
      const res = await instance.post(`/users/${id}/deactivate`);
      return res.data;
    },
    delete: async (id: number) => {
      const res = await instance.delete(`/users/${id}`);
      return res.data;
    },
  },

  // ── Geo-Location ──
  geo: {
    getStatus: async () => {
      const res = await instance.get('/geo/status');
      return res.data as {
        location: {
          country: string;
          countryCode: string;
          region: string;
          city: string;
          timezone: string;
          ip: string;
          source: string;
        };
        isRestricted: boolean;
        detectedAt: string;
      };
    },
    refresh: async () => {
      const res = await instance.post('/geo/refresh');
      return res.data;
    },
  },

  // ── Docs ──
  docs: {
    list: async () => {
      const res = await instance.get('/docs');
      return res.data as { success: boolean; data: { slug: string; title: string; category: string }[] };
    },
    get: async (slug: string) => {
      const res = await instance.get(`/docs/${slug}`);
      return res.data as { success: boolean; data: { slug: string; title: string; category: string; content: string } };
    },
  },

  // ── System ──
  system: {
    health: async () => {
      const res = await instance.get('/health');
      return res.data;
    },
    systemHealth: async () => {
      const res = await instance.get('/system/health');
      return res.data;
    },
    checkExchange: async () => {
      const res = await instance.post('/system/check-exchange');
      return res.data as { success: boolean; data: { accounts: { accountId: number; status: string; serverTime?: number; error?: string }[]; total: number } };
    },
    checkDatabase: async () => {
      const res = await instance.get('/system/check-database');
      return res.data as { success: boolean; data: { status: string; latencyMs: number; tables: Record<string, number> } };
    },
    forceSnapshot: async () => {
      const res = await instance.post('/system/force-snapshot');
      return res.data as { success: boolean; data: { snapshots: { accountId: number; status: string; equity?: number; error?: string }[]; total: number } };
    },
    fundingRates: async () => {
      const res = await instance.get('/system/funding-rates');
      return res.data as { success: boolean; data: { rates: { symbol: string; fundingRate: number; nextFundingTime: number }[]; fetched: number } };
    },
    clearCache: async () => {
      const res = await instance.post('/system/clear-cache');
      return res.data as { success: boolean; data: { before: { size: number; maxSize: number; ttlMs: number }; after: { size: number; maxSize: number; ttlMs: number } } };
    },
    wsClients: async () => {
      const res = await instance.get('/system/ws-clients');
      return res.data as { success: boolean; data: { total: number; clients: { userId?: number; tradingAccountId?: number; subscriptions: string[]; isAlive: boolean }[] } };
    },
    logs: async (limit?: number, level?: string) => {
      const params: Record<string, string> = {};
      if (limit) params.limit = String(limit);
      if (level) params.level = level;
      const res = await instance.get('/system/logs', { params });
      return res.data as { success: boolean; data: { logs: { level: string; message: string; timestamp: string; source?: string; data?: any }[]; total: number } };
    },
    rateLimit: async () => {
      const res = await instance.get('/system/rate-limit');
      return res.data as { success: boolean; data: { windowMs: number; maxRequests: number; windowMinutes: number; remaining: string | number; limit: number; resetAt: string } };
    },
    strategyHealth: async () => {
      const res = await instance.get('/system/strategy-health');
      return res.data as { success: boolean; data: { accounts: { accountId: number; strategies: Record<string, any> }[]; totalAccounts: number } };
    },
    testNotification: async () => {
      const res = await instance.post('/system/notifications/test');
      return res.data as { success: boolean; message?: string; error?: string };
    },
  },
};

export default api;
export { instance as axiosInstance };
