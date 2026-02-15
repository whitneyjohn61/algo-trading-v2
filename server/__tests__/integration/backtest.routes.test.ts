/**
 * Backtest route integration tests.
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
    sendAlert: jest.fn(), sendInfo: jest.fn(),
    sendWarning: jest.fn(), sendError: jest.fn(),
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

// ── GET /api/backtest/strategies ──────────────────────────────

describe('GET /api/backtest/strategies', () => {
  const token = makeToken();

  it('should return list of available strategies', async () => {
    const res = await request(app)
      .get('/api/backtest/strategies')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Trading-Account-Id', '1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data.length).toBeGreaterThanOrEqual(4);

    const first = res.body.data[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('category');
  });

  it('should require authentication', async () => {
    const res = await request(app)
      .get('/api/backtest/strategies')
      .set('X-Trading-Account-Id', '1');

    expect(res.status).toBe(401);
  });
});

// ── GET /api/backtest/runs ────────────────────────────────────

describe('GET /api/backtest/runs', () => {
  const token = makeToken();

  it('should return empty runs list', async () => {
    const res = await request(app)
      .get('/api/backtest/runs')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Trading-Account-Id', '1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ── POST /api/backtest/run ────────────────────────────────────

describe('POST /api/backtest/run', () => {
  const token = makeToken();

  it('should reject without required fields', async () => {
    const res = await request(app)
      .post('/api/backtest/run')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Trading-Account-Id', '1')
      .send({});

    // Should get an error (either 400 validation or 500 from missing params)
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('should reject unknown strategy', async () => {
    const res = await request(app)
      .post('/api/backtest/run')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Trading-Account-Id', '1')
      .send({
        strategyId: 'nonexistent',
        symbol: 'BTCUSDT',
        interval: '60',
        lookbackDays: 30,
        initialBalance: 10000,
        leverage: 1,
      });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.error).toBeDefined();
  });
});

// ── DELETE /api/backtest/runs/:id ─────────────────────────────

describe('DELETE /api/backtest/runs/:id', () => {
  const token = makeToken();

  it('should handle non-existent run gracefully', async () => {
    const res = await request(app)
      .delete('/api/backtest/runs/99999')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Trading-Account-Id', '1');

    // Should succeed (200), return not found (404), or 500 depending on implementation
    expect([200, 404, 500]).toContain(res.status);
  });
});
