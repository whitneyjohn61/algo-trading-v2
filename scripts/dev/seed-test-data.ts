/**
 * Seed Test Data
 *
 * Inserts sample trades, accounts, and portfolio data for UI development.
 * Safe to run multiple times — skips existing records.
 *
 * Usage:
 *   cd server
 *   npx ts-node ../scripts/dev/seed-test-data.ts
 */

import path from 'path';
import dotenv from 'dotenv';

// Load server .env
dotenv.config({ path: path.resolve(__dirname, '../../server/.env') });

async function main() {
  console.log('=== Seed Test Data ===\n');

  const { default: databaseService } = await import('../../server/src/services/database/connection');

  try {
    // Check for existing data
    const users = await databaseService.query('SELECT COUNT(*) FROM users');
    const accounts = await databaseService.query('SELECT COUNT(*) FROM trading_accounts');
    const trades = await databaseService.query('SELECT COUNT(*) FROM trades');

    console.log(`Current data: ${users.rows[0].count} users, ${accounts.rows[0].count} accounts, ${trades.rows[0].count} trades\n`);

    // Seed sample trades (if a trading account exists)
    if (Number(accounts.rows[0].count) > 0) {
      const account = await databaseService.query('SELECT id, user_id FROM trading_accounts WHERE is_active = true LIMIT 1');

      if (account.rows.length > 0) {
        const { id: accountId, user_id: userId } = account.rows[0];

        const strategies = ['trend_following', 'mean_reversion', 'funding_carry', 'cross_momentum'];
        const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'AVAXUSDT'];
        const sides = ['long', 'short'];
        let inserted = 0;

        for (let i = 0; i < 20; i++) {
          const strategy = strategies[i % strategies.length];
          const symbol = symbols[i % symbols.length];
          const side = sides[i % sides.length];
          const entryPrice = symbol === 'BTCUSDT' ? 45000 + Math.random() * 10000
            : symbol === 'ETHUSDT' ? 2500 + Math.random() * 500
            : symbol === 'SOLUSDT' ? 100 + Math.random() * 50
            : 30 + Math.random() * 15;
          const quantity = symbol === 'BTCUSDT' ? 0.01 + Math.random() * 0.05
            : symbol === 'ETHUSDT' ? 0.1 + Math.random() * 0.5
            : 1 + Math.random() * 10;
          const pnl = (Math.random() - 0.4) * 500; // Slight positive bias
          const status = i < 5 ? 'active' : 'closed';
          const daysAgo = Math.floor(Math.random() * 30);
          const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString();

          try {
            await databaseService.query(`
              INSERT INTO trades (user_id, trading_account_id, symbol, exchange, is_test, trade_type, strategy_name,
                side, entry_price, quantity, remaining_quantity, leverage, status, realized_pnl, created_at)
              VALUES ($1, $2, $3, 'bybit', true, 'strategy', $4, $5, $6, $7, $8, 2, $9, $10, $11)
            `, [
              userId, accountId, symbol, strategy, side,
              entryPrice.toFixed(2), quantity.toFixed(6),
              status === 'active' ? quantity.toFixed(6) : '0',
              status, status === 'closed' ? pnl.toFixed(2) : '0',
              createdAt,
            ]);
            inserted++;
          } catch {
            // Skip duplicates or constraint violations
          }
        }

        console.log(`Inserted ${inserted} sample trades.`);
      } else {
        console.log('No active trading account found. Create one in the app first.');
      }
    } else {
      console.log('No trading accounts found. Create one in the app first.');
      console.log('Sample trades require an existing trading account.');
    }

    // Seed portfolio snapshots
    if (Number(accounts.rows[0].count) > 0) {
      const account = await databaseService.query('SELECT id FROM trading_accounts WHERE is_active = true LIMIT 1');
      if (account.rows.length > 0) {
        const accountId = account.rows[0].id;
        let snapshots = 0;

        // Create 7 days of 5-minute snapshots
        const baseEquity = 10000;
        for (let i = 0; i < 7 * 288; i++) { // 288 snapshots per day (every 5 min)
          const timestamp = new Date(Date.now() - (7 * 288 - i) * 5 * 60000).toISOString();
          const drift = i * 0.5; // Gradual upward drift
          const noise = (Math.random() - 0.5) * 200;
          const equity = baseEquity + drift + noise;

          try {
            await databaseService.query(`
              INSERT INTO portfolio_snapshots (trading_account_id, total_equity, unrealized_pnl, realized_pnl_today,
                peak_equity, drawdown_pct, position_count, strategy_allocations, snapshot_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT DO NOTHING
            `, [
              accountId, equity.toFixed(2),
              (noise * 0.3).toFixed(2), (drift * 0.1).toFixed(2),
              (baseEquity + drift + 100).toFixed(2),
              Math.max(0, ((100 - noise) / (baseEquity + drift + 100)) * 100).toFixed(2),
              Math.floor(Math.random() * 8),
              JSON.stringify({}),
              timestamp,
            ]);
            snapshots++;
          } catch {
            // Skip
          }
        }
        console.log(`Inserted ${snapshots} portfolio snapshots.`);
      }
    }

    console.log('\nDone!');
  } catch (err: any) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await databaseService.close();
  }
}

main();
