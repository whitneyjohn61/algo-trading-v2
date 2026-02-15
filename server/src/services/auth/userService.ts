import bcrypt from 'bcryptjs';
import databaseService from '../database/connection';

const SALT_ROUNDS = 10;

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  password_hash?: string;
  email_verified: boolean;
  last_login?: Date;
  first_name?: string;
  last_name?: string;
  phone?: string;
  timezone: string;
  preferences?: any;
  is_active: boolean;
  avatar_path?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  role?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  timezone?: string;
}

export interface UpdateUserData {
  username?: string;
  email?: string;
  role?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  timezone?: string;
  avatar_path?: string | null;
}

const USER_SELECT_FIELDS = `id, username, email, role, email_verified, last_login,
  first_name, last_name, phone, timezone, preferences, is_active,
  avatar_path, created_at, updated_at`;

class UserService {
  async getAllUsers(options?: { includeInactive?: boolean; limit?: number; offset?: number }): Promise<{ users: User[]; total: number }> {
    const { includeInactive = false, limit = 100, offset = 0 } = options || {};
    const whereClause = includeInactive ? '' : 'WHERE is_active = true';

    const countResult = await databaseService.query(`SELECT COUNT(*) as count FROM users ${whereClause}`);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await databaseService.query(
      `SELECT ${USER_SELECT_FIELDS} FROM users ${whereClause} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return { users: result.rows, total };
  }

  async getUserById(id: number): Promise<User | null> {
    const result = await databaseService.query(
      `SELECT ${USER_SELECT_FIELDS} FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async getUserByUsername(username: string): Promise<(User & { password_hash: string }) | null> {
    const result = await databaseService.query(
      `SELECT ${USER_SELECT_FIELDS}, password_hash FROM users WHERE LOWER(username) = LOWER($1)`,
      [username]
    );
    return result.rows[0] || null;
  }

  async createUser(userData: CreateUserData): Promise<User> {
    try {
      const passwordHash = await bcrypt.hash(userData.password, SALT_ROUNDS);

      const result = await databaseService.query(
        `INSERT INTO users (username, email, password_hash, role, first_name, last_name, phone, timezone, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
         RETURNING ${USER_SELECT_FIELDS}`,
        [
          userData.username, userData.email, passwordHash,
          userData.role || 'user', userData.first_name || null,
          userData.last_name || null, userData.phone || null,
          userData.timezone || 'UTC',
        ]
      );

      return result.rows[0];
    } catch (error: any) {
      if (error.code === '23505') {
        if (error.constraint === 'users_username_key') throw new Error('Username already exists');
        if (error.constraint === 'users_email_key') throw new Error('Email already exists');
      }
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  async updateUser(id: number, userData: UpdateUserData): Promise<User> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fields: (keyof UpdateUserData)[] = ['username', 'email', 'role', 'first_name', 'last_name', 'phone', 'timezone', 'avatar_path'];
    for (const field of fields) {
      if (userData[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        values.push(userData[field]);
      }
    }

    if (updates.length === 0) throw new Error('No fields to update');

    values.push(id);
    const result = await databaseService.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING ${USER_SELECT_FIELDS}`,
      values
    );

    if (result.rows.length === 0) throw new Error('User not found');
    return result.rows[0];
  }

  async changePassword(id: number, currentPassword: string | null, newPassword: string, bypassCheck: boolean = false): Promise<void> {
    const result = await databaseService.query('SELECT id, password_hash FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) throw new Error('User not found');

    if (!bypassCheck && currentPassword) {
      const isValid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
      if (!isValid) throw new Error('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await databaseService.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, id]);
  }

  async deactivateUser(id: number): Promise<void> {
    const result = await databaseService.query(
      'UPDATE users SET is_active = false WHERE id = $1 RETURNING id', [id]
    );
    if (result.rows.length === 0) throw new Error('User not found');
  }

  async deleteUser(id: number): Promise<void> {
    const result = await databaseService.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) throw new Error('User not found');
  }

  async updateLastLogin(id: number): Promise<void> {
    await databaseService.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [id]);
  }

  async verifyPassword(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (!user) return null;
    if (!user.is_active) throw new Error('Account is deactivated');

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return null;

    await this.updateLastLogin(user.id);
    const { password_hash: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }
}

export const userService = new UserService();
export default userService;
