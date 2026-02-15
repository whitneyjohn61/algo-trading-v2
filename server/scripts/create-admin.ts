/**
 * Admin User Setup Script
 *
 * Creates the first admin user via CLI. Run once during initial setup.
 *
 * Usage:
 *   npx ts-node scripts/create-admin.ts
 *
 * Prompts for username, email, and password interactively.
 * If already run before, will fail on unique constraint (safe to re-run).
 */

import * as readline from 'readline';
import * as bcrypt from 'bcryptjs';

// Load env before anything else
import 'dotenv/config';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main(): Promise<void> {
  console.log('='.repeat(50));
  console.log('  Algo Trading V2 — Admin Setup');
  console.log('='.repeat(50));
  console.log('');

  const username = await ask('Admin username: ');
  const email = await ask('Admin email: ');
  const password = await ask('Admin password: ');

  if (!username || !email || !password) {
    console.error('All fields are required.');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  console.log('\nCreating admin user...');

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Dynamic import to ensure env is loaded first
  const { default: db } = await import('../src/services/database/connection');

  try {
    await db.connect();

    const result = await db.query(
      `INSERT INTO users (username, email, role, password_hash, email_verified, is_active, timezone)
       VALUES ($1, $2, 'admin', $3, true, true, 'UTC')
       RETURNING id, username, email, role`,
      [username, email, passwordHash]
    );

    const user = result.rows[0];
    console.log(`\nAdmin user created successfully:`);
    console.log(`  ID: ${user['id']}`);
    console.log(`  Username: ${user['username']}`);
    console.log(`  Email: ${user['email']}`);
    console.log(`  Role: ${user['role']}`);

    // Create default TEST and LIVE trading accounts
    const testAccount = await db.query(
      `INSERT INTO trading_accounts (user_id, exchange, is_test, is_active)
       VALUES ($1, 'bybit', true, true) RETURNING id`,
      [user['id']]
    );

    const liveAccount = await db.query(
      `INSERT INTO trading_accounts (user_id, exchange, is_test, is_active)
       VALUES ($1, 'bybit', false, true) RETURNING id`,
      [user['id']]
    );

    console.log(`\nTrading accounts created:`);
    console.log(`  TEST account ID: ${testAccount.rows[0]['id']}`);
    console.log(`  LIVE account ID: ${liveAccount.rows[0]['id']}`);
    console.log(`\nYou can add API keys later via the UI or directly in the database.`);

    await db.disconnect();
  } catch (err: any) {
    if (err.message?.includes('unique')) {
      console.error(`\nUser with that username or email already exists.`);
    } else {
      console.error(`\nFailed to create admin user: ${err.message}`);
    }
    process.exit(1);
  }

  rl.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
