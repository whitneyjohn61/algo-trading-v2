import exchangeManager from '../exchange/exchangeManager';
import { ExchangeCandle, ExchangeInterval } from '../exchange/exchangeService';

interface CacheEntry {
  candles: ExchangeCandle[];
  fetchedAt: number;
}

class CandleService {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly cacheTtlMs: number = 60 * 1000; // 60s TTL
  private readonly maxCacheEntries: number = 100;

  private cacheKey(symbol: string, interval: string, limit: number): string {
    return `${symbol}:${interval}:${limit}`;
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.fetchedAt > this.cacheTtlMs;
  }

  private evictIfNeeded(): void {
    if (this.cache.size <= this.maxCacheEntries) return;

    // Evict oldest entries
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].fetchedAt - b[1].fetchedAt);

    const toRemove = entries.slice(0, entries.length - this.maxCacheEntries);
    for (const [key] of toRemove) {
      this.cache.delete(key);
    }
  }

  async getCandles(
    symbol: string,
    interval: ExchangeInterval,
    limit: number = 200,
    startTime?: number,
    endTime?: number,
    _exchange?: string,
  ): Promise<ExchangeCandle[]> {
    // Only cache standard requests (no custom time range)
    const useCache = !startTime && !endTime;
    const key = this.cacheKey(symbol, interval, limit);

    if (useCache) {
      const cached = this.cache.get(key);
      if (cached && !this.isExpired(cached)) {
        return cached.candles;
      }
    }

    // Public market data uses system-level default adapter
    const service = exchangeManager.getDefault();
    const candles = await service.getCandles(symbol, interval, limit, startTime, endTime);

    if (useCache) {
      this.cache.set(key, { candles, fetchedAt: Date.now() });
      this.evictIfNeeded();
    }

    return candles;
  }

  /**
   * Fetch warmup candles for indicator initialization
   * Returns enough candles to cover the warmup period for indicators
   */
  async getWarmupCandles(
    symbol: string,
    interval: ExchangeInterval,
    warmupPeriod: number,
    _exchange?: string,
  ): Promise<ExchangeCandle[]> {
    // Fetch extra candles to ensure full warmup (indicators need N prior candles)
    const limit = warmupPeriod + 50;
    return this.getCandles(symbol, interval, limit);
  }

  /**
   * Get multi-interval candle data (for multi-timeframe strategies)
   */
  async getMultiIntervalCandles(
    symbol: string,
    intervals: ExchangeInterval[],
    limit: number = 200,
    _exchange?: string,
  ): Promise<Map<ExchangeInterval, ExchangeCandle[]>> {
    const results = new Map<ExchangeInterval, ExchangeCandle[]>();

    // Fetch all intervals in parallel
    const promises = intervals.map(async (interval) => {
      const candles = await this.getCandles(symbol, interval, limit);
      results.set(interval, candles);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Invalidate cache for a symbol (e.g., after real-time update)
   */
  invalidate(symbol: string, interval?: string): void {
    for (const [key] of this.cache) {
      if (key.startsWith(symbol) && (!interval || key.includes(`:${interval}:`))) {
        this.cache.delete(key);
      }
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): { size: number; maxSize: number; ttlMs: number } {
    return { size: this.cache.size, maxSize: this.maxCacheEntries, ttlMs: this.cacheTtlMs };
  }
}

const candleService = new CandleService();
export default candleService;
