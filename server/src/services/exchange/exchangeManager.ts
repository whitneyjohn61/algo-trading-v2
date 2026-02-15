/**
 * Exchange Manager — per-account adapter management.
 *
 * Two access patterns:
 *   1. Per-account (API requests): getForAccount(tradingAccountId) — reads credentials from DB, caches adapter
 *   2. System-level (market data): getDefault() — uses env-var config for public market data endpoints
 *
 * Adapters are lazily created on first access and cached in memory.
 * Cache is evicted when account credentials change.
 */

import db from '../database/connection';
import { BybitAdapter } from './bybit/bybitAdapter';
import { config } from '../../config';
import type { ExchangeService } from './exchangeService';

interface CachedAdapter {
  service: ExchangeService;
  createdAt: number;
}

class ExchangeManager {
  /** Per-account adapter cache, keyed by trading_account_id */
  private accountAdapters: Map<number, CachedAdapter> = new Map();

  /** System-level default adapter (for public market data) */
  private defaultAdapter: ExchangeService | null = null;

  // ── Per-account access ──────────────────────────────────

  /**
   * Get exchange adapter for a specific trading account.
   * Lazily creates and caches the adapter from DB credentials.
   */
  async getForAccount(tradingAccountId: number): Promise<ExchangeService> {
    // Check cache
    const cached = this.accountAdapters.get(tradingAccountId);
    if (cached) return cached.service;

    // Load account from DB
    const account = await db.getOne(
      `SELECT id, exchange, api_key, api_secret, is_test, is_active
       FROM trading_accounts WHERE id = $1`,
      [tradingAccountId]
    );

    if (!account) {
      throw new Error(`Trading account not found: ${tradingAccountId}`);
    }
    if (!account['is_active']) {
      throw new Error(`Trading account is inactive: ${tradingAccountId}`);
    }
    if (!account['api_key'] || !account['api_secret']) {
      throw new Error(`Trading account ${tradingAccountId} has no API credentials configured`);
    }

    const service = this.createAdapter(
      account['exchange'] as string,
      account['api_key'] as string,
      account['api_secret'] as string,
      account['is_test'] as boolean
    );

    this.accountAdapters.set(tradingAccountId, {
      service,
      createdAt: Date.now(),
    });

    console.log(`[ExchangeManager] Created adapter for account ${tradingAccountId} (${account['exchange']}, ${account['is_test'] ? 'testnet' : 'mainnet'})`);
    return service;
  }

  // ── System-level access ─────────────────────────────────

  /**
   * Get system-level default adapter for public market data.
   * Uses env-var config (BYBIT_API_KEY/SECRET) or falls back to any cached mainnet adapter.
   */
  getDefault(): ExchangeService {
    if (this.defaultAdapter) return this.defaultAdapter;

    // Try env-var config first
    if (config.bybit.apiKey && config.bybit.apiSecret) {
      this.defaultAdapter = new BybitAdapter(
        config.bybit.apiKey,
        config.bybit.apiSecret,
        config.bybit.testnet
      );
      console.log('[ExchangeManager] Default adapter created from env config');
      return this.defaultAdapter;
    }

    // Fall back to first cached mainnet adapter
    for (const [, cached] of this.accountAdapters) {
      return cached.service;
    }

    throw new Error('No exchange adapter available — configure BYBIT_API_KEY/SECRET or add a trading account');
  }

  /**
   * Set a specific adapter as the system default (e.g., after loading accounts on startup).
   */
  setDefaultAdapter(service: ExchangeService): void {
    this.defaultAdapter = service;
  }

  // ── Startup / bulk operations ───────────────────────────

  /**
   * Pre-warm adapters for all active trading accounts.
   * Called on server startup so background services can immediately access them.
   */
  async initializeAllActive(): Promise<number[]> {
    const accounts = await db.getAll(
      `SELECT id FROM trading_accounts WHERE is_active = true AND api_key IS NOT NULL AND api_secret IS NOT NULL`
    );

    const initialized: number[] = [];
    for (const account of accounts) {
      try {
        await this.getForAccount(Number(account['id']));
        initialized.push(Number(account['id']));
      } catch (err: any) {
        console.error(`[ExchangeManager] Failed to initialize account ${account['id']}: ${err.message}`);
      }
    }

    console.log(`[ExchangeManager] Initialized ${initialized.length}/${accounts.length} active accounts`);
    return initialized;
  }

  /**
   * Get all active trading account IDs (from DB).
   */
  async getActiveAccountIds(): Promise<number[]> {
    const accounts = await db.getAll(
      `SELECT id FROM trading_accounts WHERE is_active = true AND api_key IS NOT NULL AND api_secret IS NOT NULL`
    );
    return accounts.map(a => Number(a['id']));
  }

  // ── Cache management ────────────────────────────────────

  /**
   * Evict cached adapter for an account (e.g., after credentials change).
   */
  evictAccount(tradingAccountId: number): void {
    this.accountAdapters.delete(tradingAccountId);
    console.log(`[ExchangeManager] Evicted adapter cache for account ${tradingAccountId}`);
  }

  /**
   * Check if an adapter is cached for an account.
   */
  hasAccount(tradingAccountId: number): boolean {
    return this.accountAdapters.has(tradingAccountId);
  }

  /**
   * Get all cached account IDs.
   */
  getCachedAccountIds(): number[] {
    return Array.from(this.accountAdapters.keys());
  }

  // ── Private ─────────────────────────────────────────────

  createAdapter(exchange: string, apiKey: string, apiSecret: string, testnet: boolean): ExchangeService {
    switch (exchange.toLowerCase()) {
      case 'bybit':
        return new BybitAdapter(apiKey, apiSecret, testnet);
      default:
        throw new Error(`Unsupported exchange: ${exchange}. Available: bybit`);
    }
  }
}

const exchangeManager = new ExchangeManager();
export default exchangeManager;
