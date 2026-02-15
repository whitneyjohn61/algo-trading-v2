/**
 * Reset Database (DEVELOPMENT ONLY)
 *
 * Drops all tables and recreates the schema from scratch.
 * WARNING: This destroys all data. Only use in development.
 *
 * Usage:
 *   cd server
 *   npx ts-node ../scripts/dev/reset-database.ts
 */

import path from 'path';
import dotenv from 'dotenv';
import readline from 'readline';

// Load server .env
dotenv.config({ path: path.resolve(__dirname, '../../server/.env') });

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(`${message} (y/N): `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

async function main() {
  console.log('=== Database Reset (DEVELOPMENT ONLY) ===\n');

  const env = process.env.DB_ENVIRONMENT || 'local';
  if (env === 'neon') {
    console.error('ABORTED: Cannot reset production (Neon) database.');
    console.error('Set DB_ENVIRONMENT=local in server/.env for local development.');
    process.exit(1);
  }

  const confirmed = await confirm('This will DELETE ALL DATA. Are you sure?');
  if (!confirmed) {
    console.log('Aborted.');
    process.exit(0);
  }

  const { default: databaseService } = await import('../../server/src/services/database/connection');
  const { initializeSchema } = await import('../../server/src/services/database/schema');

  try {
    console.log('\nDropping all tables...');

    // Get all tables
    const tables = await databaseService.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `);

    if (tables.rows.length > 0) {
      const tableNames = tables.rows.map((r: any) => `"${r.table_name}"`).join(', ');
      await databaseService.query(`DROP TABLE IF EXISTS ${tableNames} CASCADE;`);
      console.log(`Dropped ${tables.rows.length} tables.`);
    } else {
      console.log('No tables to drop.');
    }

    // Drop trigger function
    await databaseService.query('DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;');

    // Recreate schema
    console.log('Recreating schema...');
    await initializeSchema();
    console.log('Schema recreated successfully.\n');

    console.log('Done! Database has been reset.');
  } catch (err: any) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await databaseService.close();
  }
}

main();
