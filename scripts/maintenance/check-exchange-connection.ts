/**
 * Check Exchange Connection
 *
 * Verifies Bybit API key connectivity and permissions.
 * Tests both REST API and account access.
 *
 * Usage:
 *   cd server
 *   npx ts-node ../scripts/maintenance/check-exchange-connection.ts
 */

import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../server/.env') });

async function main() {
  console.log('=== Exchange Connection Check ===\n');

  const { default: databaseService } = await import('../../server/src/services/database/connection');

  try {
    // Get all active trading accounts
    const result = await databaseService.query(`
      SELECT ta.id, ta.exchange, ta.is_test, ta.api_key, ta.api_secret,
             u.username
      FROM trading_accounts ta
      JOIN users u ON u.id = ta.user_id
      WHERE ta.is_active = true
      ORDER BY ta.id
    `);

    if (result.rows.length === 0) {
      console.log('No active trading accounts found.');
      console.log('Create a trading account in the app first.');
      return;
    }

    console.log(`Found ${result.rows.length} active trading account(s):\n`);

    const { RestClientV5 } = await import('bybit-api');

    for (const account of result.rows) {
      const mode = account.is_test ? 'TESTNET' : 'MAINNET';
      const maskedKey = account.api_key.slice(0, 6) + '***' + account.api_key.slice(-4);

      console.log(`Account #${account.id} (${account.username}) — ${account.exchange} ${mode}`);
      console.log(`  API Key: ${maskedKey}`);

      try {
        const client = new RestClientV5({
          key: account.api_key,
          secret: account.api_secret,
          testnet: account.is_test,
        });

        // Test balance query
        const balanceRes = await client.getWalletBalance({ accountType: 'UNIFIED' });

        if (balanceRes.retCode === 0) {
          const coins = balanceRes.result?.list?.[0]?.coin || [];
          const usdtCoin = coins.find((c: any) => c.coin === 'USDT');
          const totalEquity = balanceRes.result?.list?.[0]?.totalEquity || '0';

          console.log(`  Status: CONNECTED`);
          console.log(`  Total Equity: $${Number(totalEquity).toFixed(2)}`);
          console.log(`  USDT Balance: $${Number(usdtCoin?.walletBalance || 0).toFixed(2)}`);
        } else {
          console.log(`  Status: ERROR — ${balanceRes.retMsg}`);
        }
      } catch (err: any) {
        console.log(`  Status: FAILED — ${err.message}`);
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
