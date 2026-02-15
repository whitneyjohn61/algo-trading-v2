/**
 * API client integration tests — interceptors, headers, error handling.
 * Tests the actual api.ts module with a mocked axios instance.
 */

// ── Mock react-hot-toast (must be before api import) ──
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
    dismiss: jest.fn(),
  },
}));

// Build the mock instance that axios.create will return
const mockGet = jest.fn().mockResolvedValue({ data: {} });
const mockPost = jest.fn().mockResolvedValue({ data: {} });
const mockPut = jest.fn().mockResolvedValue({ data: {} });
const mockDelete = jest.fn().mockResolvedValue({ data: {} });

let capturedRequestInterceptor: ((config: any) => any) | null = null;
let capturedResponseSuccessHandler: ((response: any) => any) | null = null;
let capturedResponseErrorHandler: ((error: any) => any) | null = null;

jest.mock('axios', () => {
  const mockInstance = {
    get: mockGet,
    post: mockPost,
    put: mockPut,
    delete: mockDelete,
    interceptors: {
      request: {
        use: jest.fn((fn: any) => {
          capturedRequestInterceptor = fn;
        }),
        eject: jest.fn(),
      },
      response: {
        use: jest.fn((successFn: any, errorFn: any) => {
          capturedResponseSuccessHandler = successFn;
          capturedResponseErrorHandler = errorFn;
        }),
        eject: jest.fn(),
      },
    },
    defaults: { headers: { common: {} } },
  };
  return {
    __esModule: true,
    default: {
      create: jest.fn().mockReturnValue(mockInstance),
    },
    isAxiosError: jest.fn(),
  };
});

// ── localStorage mock ──
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((key: string) => store[key] || null),
  setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: jest.fn((key: string) => { delete store[key]; }),
  clear: jest.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Now import the API module — this triggers axios.create() with our mock
import api from '@/lib/api';

describe('API Client — endpoint methods', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  it('should call POST /auth/login with credentials', async () => {
    mockPost.mockResolvedValueOnce({
      data: { token: 'jwt-123', user: { id: 1, username: 'test' } },
    });

    const result = await api.auth.login('test', 'password');

    expect(mockPost).toHaveBeenCalledWith('/auth/login', { username: 'test', password: 'password' });
    expect(result.token).toBe('jwt-123');
  });

  it('should call GET /auth/me', async () => {
    mockGet.mockResolvedValueOnce({ data: { user: { id: 1, username: 'test' } } });

    const result = await api.auth.me();

    expect(mockGet).toHaveBeenCalledWith('/auth/me');
    expect(result.user.username).toBe('test');
  });

  it('should call GET /portfolio/summary', async () => {
    mockGet.mockResolvedValueOnce({ data: { totalEquity: 10000 } });

    const result = await api.portfolio.getSummary();

    expect(mockGet).toHaveBeenCalledWith('/portfolio/summary');
    expect(result.totalEquity).toBe(10000);
  });

  it('should call GET /strategies', async () => {
    mockGet.mockResolvedValueOnce({ data: { strategies: [{ id: 'trend_following' }] } });

    const result = await api.strategies.list();

    expect(mockGet).toHaveBeenCalledWith('/strategies');
    expect(result.strategies).toHaveLength(1);
  });

  it('should call POST /trading/trades', async () => {
    const params = { symbol: 'BTCUSDT', side: 'long' as const, quantity: 0.1, orderType: 'market' as const };
    mockPost.mockResolvedValueOnce({ data: { trade: { id: 1 } } });

    const result = await api.trading.createTrade(params);

    expect(mockPost).toHaveBeenCalledWith('/trading/trades', params);
    expect(result.trade.id).toBe(1);
  });

  it('should call POST /backtest/run', async () => {
    const params = {
      strategyId: 'trend_following', symbol: 'BTCUSDT', interval: '60',
      startTime: 1000, endTime: 2000, initialBalance: 10000, leverage: 1,
    };
    mockPost.mockResolvedValueOnce({ data: { success: true, data: { metrics: {} } } });

    const result = await api.backtest.run(params);

    expect(mockPost).toHaveBeenCalledWith('/backtest/run', params);
    expect(result.success).toBe(true);
  });

  it('should call GET /backtest/strategies', async () => {
    mockGet.mockResolvedValueOnce({
      data: { success: true, data: [{ id: 'trend_following', name: 'Trend' }] },
    });

    const result = await api.backtest.getStrategies();

    expect(mockGet).toHaveBeenCalledWith('/backtest/strategies');
    expect(result.data).toHaveLength(1);
  });

  it('should call GET /market/candles/:symbol with params', async () => {
    mockGet.mockResolvedValueOnce({ data: { candles: [] } });

    await api.market.getCandles('BTCUSDT', '60', 100);

    expect(mockGet).toHaveBeenCalledWith(
      '/market/candles/BTCUSDT',
      { params: { interval: '60', limit: 100 } }
    );
  });
});

// ── Request interceptor tests ──

describe('API Client — request interceptor', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should have captured the request interceptor', () => {
    expect(capturedRequestInterceptor).not.toBeNull();
  });

  it('should inject auth token from localStorage', () => {
    localStorageMock.setItem('auth-storage', JSON.stringify({ state: { token: 'test-jwt-token' } }));

    const config = { headers: {} as any };
    const result = capturedRequestInterceptor!(config);

    expect(result.headers.Authorization).toBe('Bearer test-jwt-token');
  });

  it('should inject trading account ID from localStorage', () => {
    localStorageMock.setItem('account-storage', JSON.stringify({ state: { activeAccountId: 42 } }));

    const config = { headers: {} as any };
    const result = capturedRequestInterceptor!(config);

    expect(result.headers['X-Trading-Account-Id']).toBe('42');
  });

  it('should not inject headers when localStorage empty', () => {
    const config = { headers: {} as any };
    const result = capturedRequestInterceptor!(config);

    expect(result.headers.Authorization).toBeUndefined();
    expect(result.headers['X-Trading-Account-Id']).toBeUndefined();
  });
});

// ── Response interceptor tests ──

describe('API Client — response interceptor', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should have captured the response interceptor', () => {
    expect(capturedResponseSuccessHandler).not.toBeNull();
    expect(capturedResponseErrorHandler).not.toBeNull();
  });

  it('should pass through successful responses', () => {
    const response = { data: { ok: true }, status: 200 };
    expect(capturedResponseSuccessHandler!(response)).toBe(response);
  });

  it('should clear auth storage on 401', async () => {
    // jsdom doesn't allow redefining window.location, so delete + reassign
    const origLocation = window.location;
    // @ts-ignore — need to delete before reassigning in jsdom
    delete (window as any).location;
    window.location = { pathname: '/dashboard', href: '' } as any;

    localStorageMock.setItem('auth-storage', '{"state":{"token":"old"}}');
    localStorageMock.setItem('account-storage', '{"state":{}}');

    try {
      await capturedResponseErrorHandler!({ response: { status: 401 } });
    } catch { /* expected rejection */ }

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth-storage');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('account-storage');

    // Restore
    window.location = origLocation;
  });
});
