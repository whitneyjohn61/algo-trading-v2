/**
 * CLI Portfolio Backtest Runner
 *
 * Run a multi-strategy portfolio backtest from the command line.
 *
 * Usage:
 *   cd server
 *   npx ts-node ../scripts/backtest/run-portfolio-backtest.ts --symbol BTCUSDT --interval 240 --start 2024-01-01 --end 2024-12-31 --balance 50000
 *
 * Options:
 *   --symbol      Trading pair (e.g., BTCUSDT)
 *   --interval    Candle interval (e.g., 240)
 *   --start       Start date (YYYY-MM-DD)
 *   --end         End date (YYYY-MM-DD)
 *   --balance     Initial balance in USDT (default: 50000)
 *   --leverage    Max leverage (default: 3)
 *   --strategies  Comma-separated strategy IDs (default: all)
 *   --save        Save results to database
 */

import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../server/.env') });

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    args[key] = argv[i + 1] || '';
  }
  return args;
}

async function main() {
  const args = parseArgs();

  const symbol = (args.symbol || 'BTCUSDT').toUpperCase();
  const interval = args.interval || '240';
  const startTime = args.start ? new Date(args.start).getTime() : Date.now() - 180 * 86400000;
  const endTime = args.end ? new Date(args.end).getTime() : Date.now();
  const initialBalance = Number(args.balance) || 50000;
  const leverage = Number(args.leverage) || 3;
  const saveToDb = args.save === 'true';
  const strategyIds = args.strategies
    ? args.strategies.split(',').map(s => s.trim())
    : undefined; // undefined = all strategies

  console.log('=== CLI Portfolio Backtest ===\n');
  console.log(`Strategies: ${strategyIds?.join(', ') || 'All'}`);
  console.log(`Symbol:     ${symbol}`);
  console.log(`Interval:   ${interval}`);
  console.log(`Period:     ${new Date(startTime).toISOString().split('T')[0]} → ${new Date(endTime).toISOString().split('T')[0]}`);
  console.log(`Balance:    $${initialBalance.toLocaleString()}`);
  console.log(`Leverage:   ${leverage}x`);
  console.log(`Save:       ${saveToDb}\n`);

  // Import strategy registrations
  await import('../../server/src/strategies');
  const { backtestEngine } = await import('../../server/src/services/backtest/backtestEngine');

  try {
    console.log('Running portfolio backtest...\n');

    const result = await backtestEngine.runPortfolioBacktest({
      strategyIds,
      symbol,
      interval,
      startTime,
      endTime,
      initialBalance,
      leverage,
      saveToDb,
    });

    console.log('=== Portfolio Results ===\n');
    console.log(`Total Trades:    ${result.totalTrades}`);
    console.log(`Win Rate:        ${(result.winRate * 100).toFixed(1)}%`);
    console.log(`Net Profit:      $${result.netProfit?.toFixed(2) ?? 'N/A'}`);
    console.log(`Total Return:    ${result.totalReturnPct?.toFixed(2) ?? 'N/A'}%`);
    console.log(`Max Drawdown:    ${result.maxDrawdown?.toFixed(2) ?? 'N/A'}%`);

    if (result.strategyResults) {
      console.log('\n--- Per-Strategy Breakdown ---');
      for (const [id, strat] of Object.entries(result.strategyResults) as [string, any][]) {
        console.log(`\n  ${id}:`);
        console.log(`    Trades: ${strat.totalTrades}, Win Rate: ${(strat.winRate * 100).toFixed(1)}%`);
        console.log(`    P&L: $${strat.netProfit?.toFixed(2) ?? 'N/A'}`);
      }
    }

    console.log('\nDone!');
  } catch (err: any) {
    console.error('Portfolio backtest failed:', err.message);
    process.exit(1);
  }
}

main();
