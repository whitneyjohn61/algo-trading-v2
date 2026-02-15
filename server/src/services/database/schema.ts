import databaseService from './connection';

export async function initializeSchema(): Promise<void> {
  const client = await databaseService.getClient();

  try {
    await client.query('SET search_path TO public;');

    // Updated_at trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // ===== Users table =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        password_hash TEXT,
        email_verified BOOLEAN DEFAULT false,
        last_login TIMESTAMPTZ,
        first_name TEXT,
        last_name TEXT,
        phone TEXT,
        timezone TEXT DEFAULT 'UTC',
        preferences JSONB DEFAULT '{}'::jsonb,
        is_active BOOLEAN DEFAULT true,
        avatar_path TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);

    await client.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // ===== Trading accounts table =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS trading_accounts (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        exchange TEXT NOT NULL DEFAULT 'bybit',
        api_key TEXT,
        api_secret TEXT,
        current_balance DECIMAL(20, 8) DEFAULT 0,
        is_test BOOLEAN DEFAULT true,
        is_active BOOLEAN DEFAULT true,
        params JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_trading_accounts_user_id ON trading_accounts(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trading_accounts_exchange ON trading_accounts(exchange)`);

    await client.query(`
      DROP TRIGGER IF EXISTS update_trading_accounts_updated_at ON trading_accounts;
      CREATE TRIGGER update_trading_accounts_updated_at
        BEFORE UPDATE ON trading_accounts FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // ===== Trades table =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS trades (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'default',
        trading_account_id BIGINT REFERENCES trading_accounts(id) ON DELETE SET NULL,
        symbol TEXT NOT NULL,
        exchange TEXT NOT NULL DEFAULT 'bybit',
        is_test BOOLEAN NOT NULL DEFAULT true,
        trade_type TEXT NOT NULL,
        strategy_name TEXT,
        strategy_params JSONB,
        side TEXT NOT NULL,
        entry_price DECIMAL(20, 8),
        quantity DECIMAL(20, 8) NOT NULL,
        remaining_quantity DECIMAL(20, 8) NOT NULL,
        leverage DECIMAL(10, 2) NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'pending',
        realized_pnl DECIMAL(20, 8) DEFAULT 0,
        unrealized_pnl DECIMAL(20, 8) DEFAULT 0,
        notes TEXT,
        additional_info JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMPTZ
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trades_user_status ON trades(user_id, status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at DESC)`);

    await client.query(`
      DROP TRIGGER IF EXISTS update_trades_updated_at ON trades;
      CREATE TRIGGER update_trades_updated_at
        BEFORE UPDATE ON trades FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // ===== Orders table =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id BIGSERIAL PRIMARY KEY,
        trade_id BIGINT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
        exchange_order_id TEXT,
        order_type TEXT NOT NULL,
        side TEXT NOT NULL,
        quantity DECIMAL(20, 8) NOT NULL,
        price DECIMAL(20, 8),
        stop_price DECIMAL(20, 8),
        time_in_force TEXT DEFAULT 'GTC',
        status TEXT NOT NULL DEFAULT 'pending',
        filled_quantity DECIMAL(20, 8) DEFAULT 0,
        avg_fill_price DECIMAL(20, 8),
        fees DECIMAL(20, 8) DEFAULT 0,
        take_profit DECIMAL(20, 8),
        stop_loss DECIMAL(20, 8),
        reduce_only BOOLEAN DEFAULT false,
        additional_info JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        filled_at TIMESTAMPTZ
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_trade_id ON orders(trade_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_exchange_order_id ON orders(exchange_order_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);

    await client.query(`
      DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
      CREATE TRIGGER update_orders_updated_at
        BEFORE UPDATE ON orders FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // ===== Backtest runs table =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS backtest_runs (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT,
        strategy TEXT NOT NULL,
        parameters JSONB,
        params_hash TEXT,
        symbol TEXT NOT NULL,
        exchange TEXT NOT NULL DEFAULT 'bybit',
        interval TEXT NOT NULL,
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ NOT NULL,
        initial_balance DOUBLE PRECISION NOT NULL,
        final_balance DOUBLE PRECISION NOT NULL,
        total_return DOUBLE PRECISION NOT NULL,
        total_trades INTEGER,
        win_rate DOUBLE PRECISION,
        max_drawdown DOUBLE PRECISION,
        total_fees DOUBLE PRECISION,
        sharpe_ratio DOUBLE PRECISION,
        sortino_ratio DOUBLE PRECISION,
        profit_factor DOUBLE PRECISION,
        expectancy DOUBLE PRECISION,
        equity_curve JSONB NOT NULL DEFAULT '[]'::jsonb,
        leverage DOUBLE PRECISION NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_backtest_runs_symbol_strategy ON backtest_runs(symbol, strategy, created_at DESC)`);

    // ===== Backtest trades table =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS backtest_trades (
        id BIGSERIAL PRIMARY KEY,
        run_id BIGINT NOT NULL REFERENCES backtest_runs(id) ON DELETE CASCADE,
        side TEXT NOT NULL,
        entry_time TIMESTAMPTZ NOT NULL,
        entry_price DOUBLE PRECISION NOT NULL,
        entry_qty DOUBLE PRECISION NOT NULL,
        exit_time TIMESTAMPTZ,
        exit_price DOUBLE PRECISION,
        pnl DOUBLE PRECISION,
        entry_trigger JSONB,
        exit_trigger JSONB,
        notes TEXT
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_backtest_trades_run ON backtest_trades(run_id)`);

    // ===== Portfolio snapshots table (account-scoped) =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS portfolio_snapshots (
        id BIGSERIAL PRIMARY KEY,
        trading_account_id BIGINT NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
        total_equity DOUBLE PRECISION NOT NULL,
        unrealized_pnl DOUBLE PRECISION NOT NULL DEFAULT 0,
        realized_pnl_today DOUBLE PRECISION NOT NULL DEFAULT 0,
        peak_equity DOUBLE PRECISION NOT NULL,
        drawdown_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
        position_count INTEGER NOT NULL DEFAULT 0,
        strategy_allocations JSONB DEFAULT '{}'::jsonb,
        snapshot_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_at ON portfolio_snapshots(snapshot_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_account ON portfolio_snapshots(trading_account_id, snapshot_at DESC)`);

    // ===== NEW: Funding payments table =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS funding_payments (
        id BIGSERIAL PRIMARY KEY,
        symbol TEXT NOT NULL,
        funding_rate DOUBLE PRECISION NOT NULL,
        payment_amount DOUBLE PRECISION NOT NULL,
        position_size DOUBLE PRECISION NOT NULL,
        side TEXT NOT NULL,
        settlement_time TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_funding_payments_symbol ON funding_payments(symbol, settlement_time DESC)`);

    // ===== Strategy performance table (account-scoped) =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS strategy_performance (
        id BIGSERIAL PRIMARY KEY,
        trading_account_id BIGINT NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
        strategy_id TEXT NOT NULL,
        total_pnl DOUBLE PRECISION NOT NULL DEFAULT 0,
        win_count INTEGER NOT NULL DEFAULT 0,
        loss_count INTEGER NOT NULL DEFAULT 0,
        max_drawdown DOUBLE PRECISION NOT NULL DEFAULT 0,
        sharpe_ratio DOUBLE PRECISION,
        current_allocation_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        snapshot_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_strategy_performance_id ON strategy_performance(strategy_id, snapshot_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_strategy_performance_account ON strategy_performance(trading_account_id, strategy_id, snapshot_at DESC)`);

    // ===== Account strategy configs (per-account strategy overrides) =====
    await client.query(`
      CREATE TABLE IF NOT EXISTS account_strategy_configs (
        id BIGSERIAL PRIMARY KEY,
        trading_account_id BIGINT NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
        strategy_id TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT true,
        capital_allocation_pct DOUBLE PRECISION,
        max_leverage DOUBLE PRECISION,
        params_override JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(trading_account_id, strategy_id)
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_account_strategy_configs_account ON account_strategy_configs(trading_account_id)`);

    await client.query(`
      DROP TRIGGER IF EXISTS update_account_strategy_configs_updated_at ON account_strategy_configs;
      CREATE TRIGGER update_account_strategy_configs_updated_at
        BEFORE UPDATE ON account_strategy_configs FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // ===== Seed initial users (from V1 migration) =====
    await client.query(`
      INSERT INTO users (id, username, email, role, password_hash, email_verified, last_login, first_name, last_name, phone, timezone, is_active, avatar_path)
      VALUES 
        (1, 'admin', 'admin@trading.com', 'admin', '$2a$10$VxFz6QrcDk1XkcCtrWBmp..JG5zpooSZ25PFKaD6Gyf1K7v5EFEe2', true, CURRENT_TIMESTAMP, 'admin', NULL, NULL, 'UTC', true, NULL),
        (2, 'whitneyjohn61', 'whitneyjohn61@gmail.com', 'admin', '$2a$10$sMVCpR/36sAh.3jRJHogX.AwmZpiNYcGGsEOK6tKWnl2IMKep7V8S', true, CURRENT_TIMESTAMP, 'John', 'Whitney', '+14049879052', 'America/New_York', true, '/avatars/whitneyjohn61.jpg'),
        (3, 'matt', 'matt@bedda.tech', 'admin', '$2a$10$zvLDgpYtdhBKNOKeOvf1Wu1AusQG5dwrbQvwIihQZPzhbLXiLYyoO', true, CURRENT_TIMESTAMP, 'Matt', 'Whitney', NULL, 'Europe/Rome', true, '/avatars/matt.jpg'),
        (4, 'jeff', 'jtscwhitney@gmail.com', 'admin', '$2a$10$zvLDgpYtdhBKNOKeOvf1Wu1AusQG5dwrbQvwIihQZPzhbLXiLYyoO', true, CURRENT_TIMESTAMP, 'Jeff', 'Whitney', NULL, 'Europe/Rome', true, '/avatars/jeff.jpg'),
        (5, 'butch', 'rkwhit4@cox.net', 'admin', '$2a$10$Xaxh55EfZvetuMrp46vrxu/z9mNqLhbODzYEJMOm8gV3q881tqtoG', true, CURRENT_TIMESTAMP, 'Ralph', 'Whitney', '+14804406326', 'America/Denver', true, '/avatars/butch.jpg')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Reset sequence to ensure next user gets id > max seeded
    await client.query(`
      SELECT setval('users_id_seq', (SELECT GREATEST(MAX(id), 5) FROM users), true);
    `);

    // ===== Seed trading accounts (from V1 migration) =====
    // whitneyjohn61: LIVE + TEST, matt: TEST, jeff: TEST
    // Note: API keys are shared placeholders — must be updated before live trading
    await client.query(`
      INSERT INTO trading_accounts (id, user_id, exchange, api_key, api_secret, is_test, is_active)
      VALUES
        (1, 2, 'bybit', 'auNWAAXqGEBw7IvluD', 'A88AJEF1OwwsObxPEbvwZgct5u6yaTDbk9qT', false, true),
        (2, 2, 'bybit', 'NdtL8a4UELBvEN8CGi', 'qkoOXSKRKyEEwDfYgjXPYlsQ0FUfjEBj6Mbr', true, true),
        (3, 3, 'bybit', 'NdtL8a4UELBvEN8CGi', 'qkoOXSKRKyEEwDfYgjXPYlsQ0FUfjEBj6Mbr', true, true),
        (4, 4, 'bybit', 'NdtL8a4UELBvEN8CGi', 'qkoOXSKRKyEEwDfYgjXPYlsQ0FUfjEBj6Mbr', true, true)
      ON CONFLICT (id) DO NOTHING;
    `);

    // Reset trading_accounts sequence
    await client.query(`
      SELECT setval('trading_accounts_id_seq', (SELECT GREATEST(MAX(id), 4) FROM trading_accounts), true);
    `);

    console.log('[Database] Schema initialized successfully (5 users, 4 trading accounts seeded)');
  } catch (error: any) {
    console.error('[Database] Schema initialization failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}
