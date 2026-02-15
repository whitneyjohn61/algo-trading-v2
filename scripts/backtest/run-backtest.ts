/**
 * CLI Backtest Runner — Single Strategy
 *
 * Run a single-strategy backtest from the command line.
 *
 * Usage:
 *   cd server
 *   npx ts-node ../scripts/backtest/run-backtest.ts --strategy trend_following --symbol BTCUSDT --interval 240 --start 2024-01-01 --end 2024-12-31 --balance 10000
 *
 * Options:
 *   --strategy    Strategy ID (trend_following, mean_reversion, funding_carry, cross_momentum)
 *   --symbol      Trading pair (e.g., BTCUSDT)
 *   --interval    Candle interval (e.g., 15, 60, 240, D)
 *   --start       Start date (YYYY-MM-DD)
 *   --end         End date (YYYY-MM-DD)
 *   --balance     Initial balance in USDT (default: 10000)
 *   --leverage    Max leverage (default: 3)
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

  if (!args.strategy || !args.symbol) {
    console.log('Usage: npx ts-node run-backtest.ts --strategy <id> --symbol <pair> --interval <int> --start <date> --end <date>');
    console.log('\nAvailable strategies: trend_following, mean_reversion, funding_carry, cross_momentum');
    process.exit(1);
  }

  const strategy = args.strategy;
  const symbol = args.symbol.toUpperCase();
  const interval = args.interval || '240';
  const startTime = args.start ? new Date(args.start).getTime() : Date.now() - 90 * 86400000;
  const endTime = args.end ? new Date(args.end).getTime() : Date.now();
  const initialBalance = Number(args.balance) || 10000;
  const leverage = Number(args.leverage) || 3;
  const saveToDb = args.save === 'true';

  console.log('=== CLI Backtest Runner ===\n');
  console.log(`Strategy:  ${strategy}`);
  console.log(`Symbol:    ${symbol}`);
  console.log(`Interval:  ${interval}`);
  console.log(`Period:    ${new Date(startTime).toISOString().split('T')[0]} → ${new Date(endTime).toISOString().split('T')[0]}`);
  console.log(`Balance:   $${initialBalance.toLocaleString()}`);
  console.log(`Leverage:  ${leverage}x`);
  console.log(`Save:      ${saveToDb}\n`);

  // Import strategy registrations first
  await import('../../server/src/strategies');
  const { backtestEngine } = await import('../../server/src/services/backtest/backtestEngine');

  try {
    console.log('Running backtest...\n');

    const result = await backtestEngine.runBacktest({
      strategyId: strategy,
      symbol,
      interval,
      startTime,
      endTime,
      initialBalance,
      leverage,
      saveToDb,
    });

    // Print results
    console.log('=== Results ===\n');
    console.log(`Total Trades:    ${result.totalTrades}`);
    console.log(`Win Rate:        ${(result.winRate * 100).toFixed(1)}%`);
    console.log(`Net Profit:      $${result.netProfit?.toFixed(2) ?? 'N/A'}`);
    console.log(`Total Return:    ${result.totalReturnPct?.toFixed(2) ?? 'N/A'}%`);
    console.log(`Profit Factor:   ${result.profitFactor?.toFixed(2) ?? 'N/A'}`);
    console.log(`Max Drawdown:    ${result.maxDrawdown?.toFixed(2) ?? 'N/A'}%`);
    console.log(`Sharpe Ratio:    ${result.sharpeRatio?.toFixed(2) ?? 'N/A'}`);

    if (result.trades && result.trades.length > 0) {
      console.log(`\nBest Trade:      $${Math.max(...result.trades.map((t: any) => t.pnl || 0)).toFixed(2)}`);
      console.log(`Worst Trade:     $${Math.min(...result.trades.map((t: any) => t.pnl || 0)).toFixed(2)}`);
    }

    console.log('\nDone!');
  } catch (err: any) {
    console.error('Backtest failed:', err.message);
    process.exit(1);
  }
}

main();
