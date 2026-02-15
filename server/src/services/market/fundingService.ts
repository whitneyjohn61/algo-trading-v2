/**
 * Funding Rate Service
 *
 * Polls funding rates for all tracked symbols (every 5 min).
 * Computes 7-day rolling average, 30-day Z-score, and OI change.
 * Feeds data to FundingCarryStrategy.
 */

import exchangeManager from '../exchange/exchangeManager';
import db from '../database/connection';

export interface FundingSnapshot {
  symbol: string;
  currentRate: number;
  avg7d: number;
  zScore30d: number;
  oiChange24hPct: number;
  nextSettlementTime: number;
  updatedAt: number;
}

class FundingService {
  private snapshots: Map<string, FundingSnapshot> = new Map();
  private history: Map<string, number[]> = new Map(); // symbol → last 90 funding rates (~30 days of 3/day)
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private trackedSymbols: string[] = [];

  /** Start polling funding rates */
  start(symbols: string[], intervalMs: number = 5 * 60 * 1000): void {
    this.trackedSymbols = symbols;
    console.log(`[FundingService] Tracking ${symbols.length} symbols, polling every ${intervalMs / 1000}s`);

    // Initial poll
    this.poll().catch(err => console.error('[FundingService] Initial poll error:', err.message));

    this.pollInterval = setInterval(() => {
      this.poll().catch(err => console.error('[FundingService] Poll error:', err.message));
    }, intervalMs);
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  updateSymbols(symbols: string[]): void {
    this.trackedSymbols = symbols;
  }

  getSnapshot(symbol: string): FundingSnapshot | undefined {
    return this.snapshots.get(symbol);
  }

  getAllSnapshots(): FundingSnapshot[] {
    return Array.from(this.snapshots.values());
  }

  /** Get top N symbols by absolute funding rate (extreme funding) */
  getTopFundingExtremes(n: number = 20): FundingSnapshot[] {
    return Array.from(this.snapshots.values())
      .sort((a, b) => Math.abs(b.zScore30d) - Math.abs(a.zScore30d))
      .slice(0, n);
  }

  private async poll(): Promise<void> {
    const exchange = exchangeManager.getDefault();

    for (const symbol of this.trackedSymbols) {
      try {
        // Fetch current funding rate
        const funding = await exchange.getFundingRate(symbol);

        // Update history
        const hist = this.history.get(symbol) || [];
        hist.push(funding.fundingRate);
        if (hist.length > 90) hist.splice(0, hist.length - 90); // Keep ~30 days
        this.history.set(symbol, hist);

        // Compute 7-day average (last 21 entries at 3/day)
        const recent21 = hist.slice(-21);
        const avg7d = recent21.length > 0
          ? recent21.reduce((s, r) => s + r, 0) / recent21.length
          : funding.fundingRate;

        // Compute 30-day Z-score
        const mean = hist.reduce((s, r) => s + r, 0) / hist.length;
        let variance = 0;
        for (const r of hist) variance += (r - mean) ** 2;
        const stdDev = hist.length > 1 ? Math.sqrt(variance / (hist.length - 1)) : 1;
        const zScore = stdDev > 0 ? (funding.fundingRate - mean) / stdDev : 0;

        // Fetch OI change (compare current to ~24h ago via stored snapshots)
        let oiChange = 0;
        try {
          await exchange.getOpenInterest(symbol);
          oiChange = 0; // TODO: compare to 24h stored value
        } catch {
          // OI data not critical
        }

        const snapshot: FundingSnapshot = {
          symbol,
          currentRate: funding.fundingRate,
          avg7d,
          zScore30d: zScore,
          oiChange24hPct: oiChange,
          nextSettlementTime: funding.nextFundingTime,
          updatedAt: Date.now(),
        };

        this.snapshots.set(symbol, snapshot);

        // Store funding payment in DB
        try {
          await db.query(
            `INSERT INTO funding_payments (trading_account_id, symbol, funding_rate, payment_amount, payment_time)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT DO NOTHING`,
            [1, symbol, funding.fundingRate, 0, new Date(funding.nextFundingTime)]
          );
        } catch {
          // Non-critical
        }
      } catch (err: any) {
        // Skip symbol on error, continue with others
      }
    }
  }
}

const fundingService = new FundingService();
export default fundingService;
