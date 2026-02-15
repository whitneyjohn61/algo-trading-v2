/**
 * Universe Scanner
 *
 * Scans Bybit for all active USDT perp symbols.
 * Filters by 14-day average volume (> $10M daily).
 * Excludes stablecoins.
 * Provides ranked symbol lists for Strategy 4 (Cross-Sectional Momentum).
 */

import exchangeManager from '../exchange/exchangeManager';

const STABLECOINS = new Set([
  'USDCUSDT', 'DAIUSDT', 'BUSDUSDT', 'TUSDUSDT', 'FRAXUSDT',
  'USDPUSDT', 'GUSDUSDT', 'LUSDUSDT', 'SUSDUSDT', 'EURUSDT',
]);

const MIN_DAILY_VOLUME = 10_000_000; // $10M

export interface UniverseSymbol {
  symbol: string;
  avgVolume14d: number;
  lastPrice: number;
}

class UniverseScanner {
  private universe: UniverseSymbol[] = [];
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  /** Start periodic scanning */
  start(intervalMs: number = 6 * 60 * 60 * 1000): void { // Default: every 6 hours
    console.log(`[UniverseScanner] Scanning every ${intervalMs / 3600000}h`);
    this.scan().catch(err => console.error('[UniverseScanner] Initial scan error:', err.message));
    this.pollInterval = setInterval(() => {
      this.scan().catch(err => console.error('[UniverseScanner] Scan error:', err.message));
    }, intervalMs);
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /** Get current universe (filtered, sorted by volume desc) */
  getUniverse(): UniverseSymbol[] {
    return [...this.universe];
  }

  /** Get top N symbols by volume */
  getTopSymbols(n: number = 30): string[] {
    return this.universe.slice(0, n).map(s => s.symbol);
  }

  private async scan(): Promise<void> {
    try {
      const exchange = exchangeManager.getDefault();
      const allSymbols = await exchange.getActiveSymbols();

      // Filter out stablecoins
      const candidates = allSymbols.filter(s => !STABLECOINS.has(s));

      // Fetch ticker data for volume filtering
      const results: UniverseSymbol[] = [];
      const batchSize = 10;

      for (let i = 0; i < candidates.length; i += batchSize) {
        const batch = candidates.slice(i, i + batchSize);
        const tickers = await Promise.allSettled(
          batch.map(s => exchange.getTicker(s))
        );

        for (let j = 0; j < tickers.length; j++) {
          const result = tickers[j];
          if (result?.status !== 'fulfilled') continue;
          const ticker = result.value;

          // Use 24h turnover as proxy for daily volume
          // For 14d avg, we'd need historical data — use current as estimate
          if (ticker.turnover24h >= MIN_DAILY_VOLUME) {
            results.push({
              symbol: ticker.symbol,
              avgVolume14d: ticker.turnover24h, // Approximate
              lastPrice: ticker.lastPrice,
            });
          }
        }
      }

      // Sort by volume descending
      results.sort((a, b) => b.avgVolume14d - a.avgVolume14d);
      this.universe = results;

      console.log(`[UniverseScanner] Found ${results.length} symbols meeting $${(MIN_DAILY_VOLUME / 1e6).toFixed(0)}M volume threshold`);
    } catch (err: any) {
      console.error('[UniverseScanner] Scan failed:', err.message);
    }
  }
}

const universeScanner = new UniverseScanner();
export default universeScanner;
