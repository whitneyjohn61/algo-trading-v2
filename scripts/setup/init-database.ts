/**
 * Initialize Database Schema
 *
 * Creates all required tables in the PostgreSQL database.
 * Safe to run multiple times — uses CREATE TABLE IF NOT EXISTS.
 *
 * Usage:
 *   cd server
 *   npx ts-node ../scripts/setup/init-database.ts
 */

import path from 'path';
import dotenv from 'dotenv';

// Load server .env
dotenv.config({ path: path.resolve(__dirname, '../../server/.env') });

async function main() {
  console.log('=== Database Schema Initialization ===\n');

  // Dynamic import to ensure env is loaded first
  const { default: databaseService } = await import('../../server/src/services/database/connection');
  const { initializeSchema } = await import('../../server/src/services/database/schema');

  try {
    // Test connection
    console.log('Testing database connection...');
    await databaseService.query('SELECT 1');
    console.log('Connected to database successfully.\n');

    // Initialize schema
    console.log('Creating tables...');
    await initializeSchema();
    console.log('Schema initialized successfully.\n');

    // List tables
    const result = await databaseService.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log(`Tables created (${result.rows.length}):`);
    for (const row of result.rows) {
      console.log(`  - ${row.table_name}`);
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
