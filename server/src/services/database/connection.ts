import { Pool, PoolClient, QueryResult } from 'pg';
import { config } from '../../config';

interface HealthCheckResult {
  status: string;
  message: string;
}

class DatabaseConnection {
  private pool: Pool | null = null;
  private isConnected: boolean = false;
  private isReconnecting: boolean = false;
  private reconnectDelayMs: number = config.nodeEnv === 'development' ? 5000 : 15000;
  private lastHealthCheckAt: number = 0;
  private healthMinIntervalMs: number = 5 * 60 * 1000; // 5 minutes

  async testConnection(): Promise<boolean> {
    try {
      if (!this.pool) return false;

      const now = Date.now();
      if (this.isConnected && (now - this.lastHealthCheckAt) < this.healthMinIntervalMs) {
        return true;
      }

      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      this.lastHealthCheckAt = now;
      this.isConnected = true;
      return true;
    } catch (_error) {
      this.lastHealthCheckAt = Date.now();
      this.isConnected = false;
      return false;
    }
  }

  async connect(retryCount: number = 0): Promise<void> {
    const isDev = config.nodeEnv === 'development';
    const maxRetries = isDev ? 1 : 5;
    const retryDelay = isDev ? 5000 : 15000;

    try {
      if (this.pool && this.isConnected) return;

      const { db } = config;
      const shouldEnableSSL = db.ssl || /neon/i.test(db.host);

      const poolConfig = {
        host: db.host,
        port: db.port,
        database: db.name,
        user: db.user,
        password: db.password,
        ssl: shouldEnableSSL ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: isDev ? 10000 : 60000,
        query_timeout: 120000,
        statement_timeout: 120000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      };

      console.log(`[Database] Connecting to ${db.environment} database (attempt ${retryCount + 1}/${maxRetries + 1})`);
      console.log(`[Database] Host: ${db.host}:${db.port}, DB: ${db.name}`);

      this.pool = new Pool(poolConfig);

      // Prevent process crash on idle client errors
      this.pool.on('error', (err: Error) => {
        console.error('[Database] Pool client error:', (err as any)?.message || String(err));
        this.isConnected = false;
        this.lastHealthCheckAt = 0;
        void this.reconnectWithBackoff();
      });

      // Test the connection
      const client = await this.pool.connect();
      await client.query('SET search_path TO public');
      await client.query("SET timezone = 'UTC'");
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      this.lastHealthCheckAt = Date.now();
      console.log(`[Database] Connected successfully (${db.environment})`);

      // Warm up pool
      await this.warmUpPool();

      // Reset backoff
      this.isReconnecting = false;
      this.reconnectDelayMs = isDev ? 5000 : 15000;

    } catch (error: any) {
      console.error(`[Database] Connection failed (attempt ${retryCount + 1}/${maxRetries + 1}):`, error.message);

      if (retryCount < maxRetries) {
        console.log(`[Database] Retrying in ${retryDelay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.connect(retryCount + 1);
      }

      throw error;
    }
  }

  private async warmUpPool(): Promise<void> {
    if (!this.pool) return;
    try {
      const warmupCount = 3;
      const clients: PoolClient[] = [];
      for (let i = 0; i < warmupCount; i++) {
        const client = await this.pool.connect();
        await client.query("SET timezone = 'UTC'");
        await client.query('SELECT 1');
        clients.push(client);
      }
      clients.forEach(client => client.release());
      console.log('[Database] Pool warmed up');
    } catch (error: any) {
      console.warn('[Database] Pool warmup failed:', error.message);
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      console.log('[Database] Disconnected');
    }
  }

  async query(text: string, params: any[] = []): Promise<QueryResult> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    const client = await this.pool!.connect();
    try {
      await client.query('SET statement_timeout = 60000');
      await client.query("SET timezone = 'UTC'");
      return await client.query(text, params);
    } finally {
      client.release();
    }
  }

  async getClient(): Promise<PoolClient> {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    return await this.pool!.connect();
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      if (!this.isConnected || !this.pool) {
        return { status: 'disconnected', message: 'Database not connected' };
      }
      const client = await this.pool.connect();
      try {
        await client.query('SELECT 1');
        return { status: 'healthy', message: 'Database connection is healthy' };
      } finally {
        client.release();
      }
    } catch (error: any) {
      this.isConnected = false;
      return { status: 'unhealthy', message: error.message };
    }
  }

  async reconnect(): Promise<void> {
    try {
      if (this.pool) await this.pool.end();
      this.isConnected = false;
      await this.connect();
    } catch (error: any) {
      console.error('[Database] Reconnect failed:', error.message);
      throw error;
    }
  }

  private async reconnectWithBackoff(): Promise<void> {
    if (this.isReconnecting) return;
    this.isReconnecting = true;
    try {
      await this.reconnect();
    } catch (_e) {
      const nextDelay = Math.min(this.reconnectDelayMs * 2, 60000);
      const scheduledDelay = this.reconnectDelayMs;
      this.reconnectDelayMs = nextDelay;
      console.warn(`[Database] Scheduling reconnect in ${scheduledDelay}ms`);
      setTimeout(() => {
        this.isReconnecting = false;
        void this.reconnectWithBackoff();
      }, scheduledDelay);
      return;
    }
    this.isReconnecting = false;
  }

  // Convenience methods
  async getOne(query: string, params: any[] = []): Promise<any> {
    const result = await this.query(query, params);
    return result.rows[0] || null;
  }

  async getAll(query: string, params: any[] = []): Promise<any[]> {
    const result = await this.query(query, params);
    return result.rows;
  }

  async insert(query: string, params: any[] = []): Promise<any> {
    const result = await this.query(query, params);
    return result.rows[0];
  }

  async update(query: string, params: any[] = []): Promise<number> {
    const result = await this.query(query, params);
    return result.rowCount || 0;
  }

  async delete(query: string, params: any[] = []): Promise<number> {
    const result = await this.query(query, params);
    return result.rowCount || 0;
  }
}

const databaseService = new DatabaseConnection();
export default databaseService;
