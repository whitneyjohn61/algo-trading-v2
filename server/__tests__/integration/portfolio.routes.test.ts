/**
 * Portfolio route integration tests.
 * Uses supertest against the Express app with mocked services.
 */

import jwt from 'jsonwebtoken';
import { config } from '../../src/config';

// ── Mock geo service (named + default export) ──
const mockGeo = {
  isRestricted: jest.fn().mockReturnValue(false),
  getLocation: jest.fn().mockReturnValue({ country: 'US', city: 'Test', isRestricted: false }),
  detect: jest.fn().mockResolvedValue({ country: 'US', city: 'Test', isRestricted: false }),
};
jest.mock('../../src/services/geo/geoLocationService', () => ({
  __esModule: true,
  default: mockGeo,
  geoLocationService: mockGeo,
}));

// ── Mock database ──
jest.mock('../../src/services/database/connection', () => ({
  __esModule: true,
  default: {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    getOne: jest.fn().mockResolvedValue({
      id: 1, user_id: 1, exchange: 'bybit', is_test: true, is_active: true,
    }),
    getAll: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockResolvedValue({ id: 1 }),
  },
}));

// ── Mock exchange manager ──
const mockExchange = {
  name: 'bybit',
  getTotalEquity: jest.fn().mockResolvedValue(10000),
  getBalances: jest.fn().mockResolvedValue([
    { coin: 'USDT', available: 8000, total: 10000, unrealizedPnl: 200 },
  ]),
  getPositions: jest.fn().mockResolvedValue([]),
};
jest.mock('../../src/services/exchange/exchangeManager', () => ({
  __esModule: true,
  default: {
    getForAccount: jest.fn().mockResolvedValue(mockExchange),
    getDefault: () => mockExchange,
    getActiveAccountIds: jest.fn().mockResolvedValue([1]),
    initializeAllActive: jest.fn().mockResolvedValue([1]),
  },
}));

// ── Mock WebSocket broadcaster ──
jest.mock('../../src/websocket/server', () => ({
  __esModule: true,
  default: {
    broadcast: jest.fn(),
    broadcastToChannel: jest.fn(),
    broadcastToAccount: jest.fn(),
    broadcastToUser: jest.fn(),
  },
}));

// ── Mock notification service ──
jest.mock('../../src/services/monitoring/notificationService', () => ({
  __esModule: true,
  default: {
    sendAlert: jest.fn(), sendInfo: jest.fn(),
    sendWarning: jest.fn(), sendError: jest.fn(),
  },
}));

import request from 'supertest';
import app from '../../src/app';

function makeToken(): string {
  return jwt.sign(
    { id: 1, username: 'testuser', email: 'test@test.com', role: 'admin' },
    config.jwtSecret,
    { expiresIn: '1h' }
  );
}

// ── GET /api/portfolio/summary ───────────────────────────────

describe('GET /api/portfolio/summary', () => {
  const token = makeToken();

  it('should return portfolio summary with correct shape', async () => {
    const res = await request(app)
      .get('/api/portfolio/summary')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Trading-Account-Id', '1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalEquity');
    expect(res.body).toHaveProperty('positions');
    expect(typeof res.body.totalEquity).toBe('number');
  });

  it('should require authentication', async () => {
    const res = await request(app)
      .get('/api/portfolio/summary')
      .set('X-Trading-Account-Id', '1');

    expect(res.status).toBe(401);
  });
});

// ── GET /api/portfolio/equity-curve ──────────────────────────

describe('GET /api/portfolio/equity-curve', () => {
  const token = makeToken();

  it('should return equity curve data', async () => {
    const res = await request(app)
      .get('/api/portfolio/equity-curve?period=1M')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Trading-Account-Id', '1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ── GET /api/portfolio/circuit-breaker ────────────────────────

describe('GET /api/portfolio/circuit-breaker', () => {
  const token = makeToken();

  it('should return circuit breaker status', async () => {
    const res = await request(app)
      .get('/api/portfolio/circuit-breaker')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Trading-Account-Id', '1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tradingAccountId');
    expect(res.body).toHaveProperty('portfolioTriggered');
    expect(res.body).toHaveProperty('portfolioThreshold');
  });
});
