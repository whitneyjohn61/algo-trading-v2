/**
 * Strategies route integration tests.
 * Uses supertest against the Express app.
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

// ── Mock database (for account resolution) ──
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
jest.mock('../../src/services/exchange/exchangeManager', () => ({
  __esModule: true,
  default: {
    getForAccount: jest.fn().mockResolvedValue({ name: 'bybit' }),
    getDefault: jest.fn().mockReturnValue({ name: 'bybit' }),
    getActiveAccountIds: jest.fn().mockResolvedValue([1]),
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
    sendAlert: jest.fn(),
    sendInfo: jest.fn(),
    sendWarning: jest.fn(),
    sendError: jest.fn(),
  },
}));

// Register strategies
import '../../src/strategies';

import request from 'supertest';
import app from '../../src/app';

function makeToken(): string {
  return jwt.sign(
    { id: 1, username: 'testuser', email: 'test@test.com', role: 'admin' },
    config.jwtSecret,
    { expiresIn: '1h' }
  );
}

// ── GET /api/strategies ──────────────────────────────────────

describe('GET /api/strategies', () => {
  const token = makeToken();

  it('should return all 4 strategies', async () => {
    const res = await request(app)
      .get('/api/strategies')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Trading-Account-Id', '1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('strategies');
    expect(res.body.strategies).toHaveLength(4);

    const ids = res.body.strategies.map((s: any) => s.id);
    expect(ids).toContain('trend_following');
    expect(ids).toContain('mean_reversion');
    expect(ids).toContain('funding_carry');
    expect(ids).toContain('cross_momentum');
  });

  it('should include strategy config fields', async () => {
    const res = await request(app)
      .get('/api/strategies')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Trading-Account-Id', '1');

    const strategy = res.body.strategies[0];
    expect(strategy).toHaveProperty('id');
    expect(strategy).toHaveProperty('name');
    expect(strategy).toHaveProperty('category');
    expect(strategy).toHaveProperty('timeframes');
    expect(strategy).toHaveProperty('capitalAllocationPercent');
    expect(strategy).toHaveProperty('state');
  });

  it('should require authentication', async () => {
    const res = await request(app)
      .get('/api/strategies')
      .set('X-Trading-Account-Id', '1');

    expect(res.status).toBe(401);
  });

  it('should require trading account ID', async () => {
    const res = await request(app)
      .get('/api/strategies')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

// ── GET /api/strategies/:id/state ─────────────────────────────

describe('GET /api/strategies/:id/state', () => {
  const token = makeToken();

  it('should return state for valid strategy', async () => {
    const res = await request(app)
      .get('/api/strategies/trend_following/state')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Trading-Account-Id', '1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('state');
    expect(res.body.state).toHaveProperty('status');
  });

  it('should return 404 for unknown strategy', async () => {
    const res = await request(app)
      .get('/api/strategies/nonexistent/state')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Trading-Account-Id', '1');

    expect(res.status).toBe(404);
  });
});
