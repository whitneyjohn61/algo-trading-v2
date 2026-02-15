/**
 * Check Funding Rates
 *
 * Displays current funding rates for top perpetual contracts on Bybit.
 * Useful for manual review of funding rate opportunities.
 *
 * Usage:
 *   cd server
 *   npx ts-node ../scripts/maintenance/check-funding-rates.ts
 */

import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../server/.env') });

async function main() {
  console.log('=== Current Funding Rates (Bybit) ===\n');

  const { RestClientV5 } = await import('bybit-api');

  const useTestnet = process.env.BYBIT_TESTNET === 'true';
  const client = new RestClientV5({
    key: process.env.BYBIT_API_KEY || '',
    secret: process.env.BYBIT_API_SECRET || '',
    testnet: useTestnet,
  });

  console.log(`Network: ${useTestnet ? 'TESTNET' : 'MAINNET'}\n`);

  try {
    // Get tickers with funding info
    const res = await client.getTickers({ category: 'linear' });

    if (res.retCode !== 0) {
      console.error('API Error:', res.retMsg);
      process.exit(1);
    }

    const tickers = (res.result?.list || [])
      .filter((t: any) => t.symbol.endsWith('USDT') && t.fundingRate)
      .map((t: any) => ({
        symbol: t.symbol,
        price: Number(t.lastPrice),
        fundingRate: Number(t.fundingRate),
        annualized: Number(t.fundingRate) * 3 * 365 * 100, // 3 settlements/day * 365 days
        volume24h: Number(t.volume24h),
        nextFunding: t.nextFundingTime,
      }))
      .sort((a: any, b: any) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate));

    // Print top 30 by absolute funding rate
    console.log('Top 30 by Funding Rate (absolute):\n');
    console.log(`${'Symbol'.padEnd(14)} ${'Price'.padStart(12)} ${'Rate'.padStart(10)} ${'Ann. %'.padStart(10)} ${'24h Vol'.padStart(14)}`);
    console.log('-'.repeat(64));

    for (const t of tickers.slice(0, 30)) {
      const rateStr = (t.fundingRate * 100).toFixed(4) + '%';
      const annStr = t.annualized.toFixed(1) + '%';
      const volStr = '$' + (t.volume24h / 1e6).toFixed(1) + 'M';

      const color = t.fundingRate > 0.001 ? '\x1b[32m' : t.fundingRate < -0.001 ? '\x1b[31m' : '\x1b[0m';

      console.log(`${color}${t.symbol.padEnd(14)} ${t.price.toFixed(2).padStart(12)} ${rateStr.padStart(10)} ${annStr.padStart(10)} ${volStr.padStart(14)}\x1b[0m`);
    }

    // Print extremes
    const positive = tickers.filter((t: any) => t.fundingRate > 0.001);
    const negative = tickers.filter((t: any) => t.fundingRate < -0.001);

    console.log(`\nSummary:`);
    console.log(`  Strongly positive (>0.1%): ${positive.length} symbols — short opportunity (collect funding)`);
    console.log(`  Strongly negative (<-0.1%): ${negative.length} symbols — long opportunity (collect funding)`);
    console.log(`  Total symbols checked: ${tickers.length}`);

  } catch (err: any) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
