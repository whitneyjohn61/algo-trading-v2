/**
 * Auth route integration tests — login, token validation, protected routes.
 * Uses supertest against the Express app with mocked userService.
 */

import jwt from 'jsonwebtoken';
import { config } from '../../src/config';

// ── Mock userService ──
const mockUser = {
  id: 1, username: 'testuser', email: 'test@example.com',
  role: 'admin', timezone: 'UTC', is_active: true,
  avatar_path: null, created_at: new Date(), updated_at: new Date(),
  email_verified: false,
};

jest.mock('../../src/services/auth/userService', () => ({
  __esModule: true,
  default: {
    verifyPassword: jest.fn(),
    getUserById: jest.fn(),
    createUser: jest.fn(),
    updateLastLogin: jest.fn(),
  },
}));

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

// ── Mock database (system routes use it) ──
jest.mock('../../src/services/database/connection', () => ({
  __esModule: true,
  default: {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    getOne: jest.fn().mockResolvedValue(null),
    getAll: jest.fn().mockResolvedValue([]),
  },
}));

import request from 'supertest';
import app from '../../src/app';
import userService from '../../src/services/auth/userService';

const mockUserService = userService as jest.Mocked<typeof userService>;

// Helper: generate a valid token
function makeToken(payload: Record<string, any> = {}, expiresIn: string = '1h'): string {
  return jwt.sign(
    { id: 1, username: 'testuser', email: 'test@example.com', role: 'admin', ...payload },
    config.jwtSecret,
    { expiresIn }
  );
}

// ── POST /api/auth/login ──────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('should return 200 with token for valid credentials', async () => {
    mockUserService.verifyPassword.mockResolvedValueOnce(mockUser as any);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'correct' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.username).toBe('testuser');
  });

  it('should return 401 for invalid credentials', async () => {
    mockUserService.verifyPassword.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('should return 400 when username/password missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('required');
  });

  it('should return 400 when credentials in query params', async () => {
    const res = await request(app)
      .post('/api/auth/login?username=test&password=test')
      .send({ username: 'test', password: 'test' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('query parameters');
  });

  it('should return 403 for deactivated account', async () => {
    mockUserService.verifyPassword.mockRejectedValueOnce(new Error('Account is deactivated'));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'inactive', password: 'test' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('deactivated');
  });
});

// ── GET /api/auth/me ──────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('should return user for valid token', async () => {
    mockUserService.getUserById.mockResolvedValueOnce(mockUser as any);
    const token = makeToken();

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user');
  });

  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('should return 403 for expired token', async () => {
    const expiredToken = jwt.sign(
      { id: 1, username: 'test', email: 'test@test.com', role: 'user' },
      config.jwtSecret,
      { expiresIn: '0s' }
    );

    // Small delay to ensure expiration
    await new Promise(r => setTimeout(r, 100));

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(403);
  });

  it('should return 403 for malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');

    expect(res.status).toBe(403);
  });
});

// ── POST /api/auth/logout ─────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('should return success message', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Logged out');
  });
});

// ── GET /api/health ───────────────────────────────────────────

describe('GET /api/health', () => {
  it('should return health status (public, no auth)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('timestamp');
  });
});
