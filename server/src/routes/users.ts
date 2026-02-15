/**
 * Users CRUD routes — admin and self-service management.
 * Transplanted from V1's users.ts, adapted for V2.
 */

import express, { Request, Response } from 'express';
import { authenticateToken } from './auth';
import userService from '../services/auth/userService';
import type { CreateUserData, UpdateUserData } from '../services/auth/userService';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ── Helpers ───────────────────────────────────────────────────

function isAdmin(req: Request): boolean {
  return (req as any).user?.role === 'admin';
}

function getUserId(req: Request): number {
  return Number((req as any).user?.id);
}

function canEditUser(req: Request, targetId: number): boolean {
  return isAdmin(req) || getUserId(req) === targetId;
}

// ── GET /api/users — List users ──────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query['limit']) || 100;
    const offset = Number(req.query['offset']) || 0;
    const includeInactive = isAdmin(req) && req.query['includeInactive'] === 'true';

    const result = await userService.getAllUsers({ includeInactive, limit, offset });

    // Strip password hashes
    const users = result.users.map(u => {
      const { password_hash: _, ...safe } = u as any;
      return safe;
    });

    res.json({ success: true, data: { users, total: result.total } });
  } catch (error: any) {
    console.error('[Users] List error:', error.message);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// ── GET /api/users/:id — Get user detail ─────────────────────

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const targetId = Number(req.params['id']);
    const user = await userService.getUserById(targetId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const { password_hash: _, ...safe } = user as any;
    res.json({ success: true, data: safe });
  } catch (error: any) {
    console.error('[Users] Get error:', error.message);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ── POST /api/users — Create user (admin only) ──────────────

router.post('/', async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { username, email, password, role, first_name, last_name, phone, timezone } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ error: 'username, email, and password are required' });
      return;
    }

    const data: CreateUserData = {
      username, email, password,
      role: role || 'user',
      first_name, last_name, phone, timezone,
    };

    const user = await userService.createUser(data);
    res.status(201).json({ success: true, data: user });
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      res.status(409).json({ error: error.message });
      return;
    }
    console.error('[Users] Create error:', error.message);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// ── PUT /api/users/:id — Update user ─────────────────────────

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const targetId = Number(req.params['id']);

    if (!canEditUser(req, targetId)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { username, email, role, first_name, last_name, phone, timezone, avatar_path } = req.body;

    const updateData: UpdateUserData = {};
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (phone !== undefined) updateData.phone = phone;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (avatar_path !== undefined) updateData.avatar_path = avatar_path;

    // Only admins can change roles
    if (role !== undefined && isAdmin(req)) {
      updateData.role = role;
    }

    const user = await userService.updateUser(targetId, updateData);
    res.json({ success: true, data: user });
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      res.status(409).json({ error: error.message });
      return;
    }
    console.error('[Users] Update error:', error.message);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ── POST /api/users/:id/change-password ──────────────────────

router.post('/:id/change-password', async (req: Request, res: Response) => {
  try {
    const targetId = Number(req.params['id']);

    if (!canEditUser(req, targetId)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters' });
      return;
    }

    // Admin changing another user's password bypasses current password check
    const bypassCheck = isAdmin(req) && getUserId(req) !== targetId;
    await userService.changePassword(targetId, currentPassword || null, newPassword, bypassCheck);

    res.json({ success: true, message: 'Password changed' });
  } catch (error: any) {
    if (error.message === 'Current password is incorrect') {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error('[Users] Change password error:', error.message);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ── POST /api/users/:id/deactivate — Soft delete ────────────

router.post('/:id/deactivate', async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const targetId = Number(req.params['id']);
    if (targetId === getUserId(req)) {
      res.status(400).json({ error: 'Cannot deactivate yourself' });
      return;
    }

    await userService.deactivateUser(targetId);
    res.json({ success: true, message: 'User deactivated' });
  } catch (error: any) {
    console.error('[Users] Deactivate error:', error.message);
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

// ── DELETE /api/users/:id — Hard delete (admin only) ─────────

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const targetId = Number(req.params['id']);
    if (targetId === getUserId(req)) {
      res.status(400).json({ error: 'Cannot delete yourself' });
      return;
    }

    await userService.deleteUser(targetId);
    res.json({ success: true, message: 'User deleted' });
  } catch (error: any) {
    console.error('[Users] Delete error:', error.message);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
