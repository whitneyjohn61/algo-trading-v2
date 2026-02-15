/**
 * Manual Portfolio Snapshot
 *
 * Captures a portfolio equity snapshot for all active trading accounts.
 * Useful for manual snapshots outside the automatic 5-minute cycle.
 *
 * Usage:
 *   cd server
 *   npx ts-node ../scripts/maintenance/portfolio-snapshot.ts
 */

import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../server/.env') });

async function main() {
  console.log('=== Manual Portfolio Snapshot ===\n');

  const { default: databaseService } = await import('../../server/src/services/database/connection');

  try {
    // Get active accounts
    const accounts = await databaseService.query(`
      SELECT ta.id, ta.exchange, ta.is_test, ta.api_key, ta.api_secret,
             u.username
      FROM trading_accounts ta
      JOIN users u ON u.id = ta.user_id
      WHERE ta.is_active = true
      ORDER BY ta.id
    `);

    if (accounts.rows.length === 0) {
      console.log('No active trading accounts found.');
      return;
    }

    const { RestClientV5 } = await import('bybit-api');

    for (const account of accounts.rows) {
      const mode = account.is_test ? 'TESTNET' : 'MAINNET';
      console.log(`Account #${account.id} (${account.username}) — ${mode}`);

      try {
        const client = new RestClientV5({
          key: account.api_key,
          secret: account.api_secret,
          testnet: account.is_test,
        });

        const balanceRes = await client.getWalletBalance({ accountType: 'UNIFIED' });

        if (balanceRes.retCode === 0) {
          const wallet = balanceRes.result?.list?.[0];
          const totalEquity = Number(wallet?.totalEquity || 0);
          const unrealizedPnl = Number(wallet?.totalPerpUPL || 0);

          // Get peak equity from last snapshot
          const lastSnapshot = await databaseService.query(`
            SELECT peak_equity FROM portfolio_snapshots
            WHERE trading_account_id = $1
            ORDER BY snapshot_at DESC LIMIT 1
          `, [account.id]);

          const previousPeak = lastSnapshot.rows.length > 0 ? Number(lastSnapshot.rows[0].peak_equity) : totalEquity;
          const peakEquity = Math.max(previousPeak, totalEquity);
          const drawdownPct = peakEquity > 0 ? ((peakEquity - totalEquity) / peakEquity) * 100 : 0;

          // Get position count
          const posRes = await client.getPositionInfo({ category: 'linear', settleCoin: 'USDT' });
          const positionCount = (posRes.result?.list || []).filter((p: any) => Number(p.size) > 0).length;

          // Insert snapshot
          await databaseService.query(`
            INSERT INTO portfolio_snapshots
              (trading_account_id, total_equity, unrealized_pnl, realized_pnl_today,
               peak_equity, drawdown_pct, position_count, strategy_allocations, snapshot_at)
            VALUES ($1, $2, $3, 0, $4, $5, $6, $7, NOW())
          `, [
            account.id, totalEquity.toFixed(2), unrealizedPnl.toFixed(2),
            peakEquity.toFixed(2), drawdownPct.toFixed(4), positionCount,
            JSON.stringify({}),
          ]);

          console.log(`  Equity: $${totalEquity.toFixed(2)}, Peak: $${peakEquity.toFixed(2)}, Drawdown: ${drawdownPct.toFixed(2)}%, Positions: ${positionCount}`);
          console.log(`  Snapshot saved.`);
        } else {
          console.log(`  Error: ${balanceRes.retMsg}`);
        }
      } catch (err: any) {
        console.log(`  Failed: ${err.message}`);
      }

      console.log('');
    }

    console.log('Done!');
  } catch (err: any) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await databaseService.close();
  }
}

main();
