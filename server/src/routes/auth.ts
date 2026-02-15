import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import userService from '../services/auth/userService';
import { config } from '../config';

const router = express.Router();

interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: string;
  timezone?: string;
  avatar_path?: string;
}

// JWT authentication middleware
export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthUser;
    (req as any).user = {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
      timezone: decoded.timezone,
      avatar_path: decoded.avatar_path,
    };
    next();
  } catch (_error) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  if (req.query['username'] || req.query['password']) {
    res.status(400).json({ error: 'Credentials must not be sent as query parameters' });
    return;
  }

  const { username, password } = req.body;

  try {
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const user = await userService.verifyPassword(username, password);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role, timezone: user.timezone, avatar_path: user.avatar_path },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role, timezone: user.timezone, avatar_path: user.avatar_path },
    });
  } catch (error: any) {
    if (error.message === 'Account is deactivated') {
      res.status(403).json({ error: 'Account is deactivated' });
      return;
    }
    console.error('[Auth] Login error:', error.message);
    res.status(500).json({ error: 'An error occurred during login' });
  }
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    res.status(400).json({ error: 'Username, email, and password are required' });
    return;
  }

  try {
    const user = await userService.createUser({ username, email, password });
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role, timezone: user.timezone },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
    });
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      res.status(409).json({ error: error.message });
      return;
    }
    console.error('[Auth] Register error:', error.message);
    res.status(500).json({ error: 'An error occurred during registration' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = await userService.getUserById((req as any).user.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully' });
});

export default router;
