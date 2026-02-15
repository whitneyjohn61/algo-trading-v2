# Algo Trading V2 — Implementation Plan

## Overview

Complete rebuild of the algorithmic crypto trading platform, shifting from a general-purpose single-strategy trading tool to a **portfolio-based multi-strategy system** targeting 100%+ annual returns via 4 uncorrelated strategies on Bybit perpetual futures.

### Key Decisions

- **Fresh repo** — not a refactor of the old codebase
- **Bybit only** (at launch) — exchange-agnostic architecture for future expansion
- **No candle database** — fetch from Bybit API on demand, cache in memory
- **4 focused strategies** — trend following, mean reversion, funding carry, cross-sectional momentum
- **Portfolio-first UI** — dashboard shows combined portfolio, not individual charts
- **Clean architecture** — no file over 500 lines, no component over 300 lines, no function over 50 lines

### Tech Stack (Same as V1)

- **Client**: Next.js 15 (App Router), TypeScript, Tailwind CSS, Zustand, lightweight-charts
- **Server**: Node.js 22, Express, TypeScript, PostgreSQL, WebSocket (`ws`)
- **Database**: Neon Serverless PostgreSQL (same instance, new database or clean schema)
- **Hosting**: Vercel (client), DigitalOcean App Platform (server)
- **Exchange**: Bybit V5 API + WebSocket (via `bybit-api` package)

---

## Phase 0: Project Scaffold & Infrastructure

### What gets built
- Project directory structure (server + client monorepo)
- `package.json` files with dependencies
- TypeScript configs
- ESLint configs
- `.gitignore` (no `.env` files committed — ever)
- `.env.example` template files
- Docker configs (`Dockerfile` for server and client, `docker-compose.yml`)
- DigitalOcean `.do/app.yaml`
- Basic `README.md`

### What you (the user) need to do
- Nothing — this is all generated code

### Server Directory Structure

```
server/
├── src/
│   ├── index.ts                          # ~100 lines — clean startup
│   ├── app.ts                            # Express app setup, middleware, routes
│   ├── config/
│   │   └── index.ts                      # Environment config, validation
│   ├── routes/
│   │   ├── auth.ts                       # Auth routes (thin controller)
│   │   ├── portfolio.ts                  # Portfolio routes
│   │   ├── strategies.ts                 # Strategy routes
│   │   ├── trading.ts                    # Trade routes
│   │   ├── market.ts                     # Market data routes
│   │   ├── backtest.ts                   # Backtest routes
│   │   └── system.ts                     # Health, monitoring routes
│   ├── services/
│   │   ├── exchange/
│   │   │   ├── exchangeService.ts        # Interface + unified types
│   │   │   ├── exchangeManager.ts        # Multi-exchange router
│   │   │   ├── exchangeEvents.ts         # Standardized WebSocket event types
│   │   │   └── bybit/
│   │   │       ├── bybitAdapter.ts       # Implements ExchangeService (~500 lines)
│   │   │       ├── bybitClient.ts        # Raw API client wrapper
│   │   │       ├── bybitMapper.ts        # Raw response → unified types (~300 lines)
│   │   │       ├── bybitTypes.ts         # Raw Bybit response shapes (~150 lines)
│   │   │       ├── bybitWebSocket.ts     # WebSocket + standardized events (~400 lines)
│   │   │       └── bybitErrors.ts        # Error translation (~50 lines)
│   │   ├── portfolio/
│   │   │   ├── portfolioManager.ts       # Capital allocation, equity tracking
│   │   │   ├── equityTracker.ts          # Equity curve snapshots
│   │   │   └── circuitBreaker.ts         # Drawdown rules, strategy pausing
│   │   ├── strategy/
│   │   │   ├── strategyExecutor.ts       # Orchestrates strategy execution
│   │   │   ├── signalProcessor.ts        # Signal → order conversion
│   │   │   └── universeScanner.ts        # Symbol scanning (volume, liquidity filters)
│   │   ├── market/
│   │   │   ├── candleService.ts          # API-only candle fetching + in-memory cache
│   │   │   ├── fundingRateService.ts     # Funding rate polling/streaming + Z-scores
│   │   │   └── openInterestService.ts    # OI tracking
│   │   ├── trade/
│   │   │   ├── tradeService.ts           # Trade CRUD (~300 lines)
│   │   │   ├── orderService.ts           # Order management
│   │   │   └── riskValidation.ts         # Per-trade + portfolio risk checks
│   │   ├── auth/
│   │   │   └── userService.ts            # Auth + user management
│   │   ├── database/
│   │   │   ├── connection.ts             # Pool management only
│   │   │   └── schema.ts                 # Schema creation only
│   │   └── monitoring/
│   │       ├── systemMonitor.ts          # Health checks
│   │       └── logger.ts                 # Structured logging
│   ├── strategies/
│   │   ├── types.ts                      # Strategy interfaces
│   │   ├── registry.ts                   # Strategy registry
│   │   ├── multiTfTrend.ts               # Strategy 1: Multi-TF Trend Following
│   │   ├── meanReversionScalp.ts         # Strategy 2: Mean Reversion Scalper
│   │   ├── fundingCarry.ts               # Strategy 3: Funding Rate Carry
│   │   └── crossSectionalMomentum.ts     # Strategy 4: Cross-Sectional Rotation
│   ├── indicators/
│   │   ├── types.ts                      # Indicator interfaces
│   │   ├── registry.ts                   # Indicator registry
│   │   ├── ema.ts                        # Exponential Moving Average
│   │   ├── sma.ts                        # Simple Moving Average
│   │   ├── rsi.ts                        # Relative Strength Index
│   │   ├── atr.ts                        # Average True Range
│   │   ├── bollinger.ts                  # Bollinger Bands
│   │   ├── adx.ts                        # Average Directional Index (NEW)
│   │   ├── stochRsi.ts                   # Stochastic RSI (NEW)
│   │   ├── roc.ts                        # Rate of Change (NEW)
│   │   ├── bbWidth.ts                    # Bollinger Band Width (NEW)
│   │   ├── realizedVol.ts               # Realized Volatility (NEW)
│   │   └── volumeSma.ts                  # Volume SMA
│   └── websocket/
│       ├── server.ts                     # WS server setup
│       ├── broadcaster.ts                # Client notification dispatch
│       └── handlers/
│           ├── marketHandler.ts          # Candle, ticker, funding events
│           ├── tradeHandler.ts           # Order, position events
│           └── portfolioHandler.ts       # Equity, drawdown, strategy events
├── package.json
├── tsconfig.json
├── jest.config.js
├── eslint.config.js
├── Dockerfile
├── .env.example
└── nodemon.json
```

### Client Directory Structure

```
client/
├── app/
│   ├── page.tsx                          # Auth check → Dashboard
│   ├── layout.tsx                        # Root layout
│   └── providers.tsx                     # React providers
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx                   # Navigation (8 tabs)
│   │   ├── Header.tsx                    # Top bar, health chip, user avatar
│   │   └── Dashboard.tsx                 # Tab router
│   ├── portfolio/
│   │   ├── PortfolioDashboard.tsx        # Main portfolio page
│   │   ├── SummaryCards.tsx              # Equity, P&L, positions, drawdown cards
│   │   ├── EquityCurveChart.tsx          # Portfolio equity chart
│   │   ├── AllocationPanel.tsx           # Strategy allocation bars
│   │   ├── PositionsTable.tsx            # Open positions across all strategies
│   │   └── RecentTradesFeed.tsx          # Scrollable trade feed
│   ├── strategies/
│   │   ├── StrategyMonitor.tsx           # Strategy tab page
│   │   ├── StrategyCard.tsx             # Per-strategy expandable card
│   │   ├── TrendStatusPanel.tsx          # Strategy 1 detail: trend per symbol
│   │   ├── ScalpMonitorPanel.tsx         # Strategy 2 detail: BB/RSI per symbol
│   │   ├── FundingRatePanel.tsx          # Strategy 3 detail: funding scanner
│   │   ├── MomentumRankingPanel.tsx      # Strategy 4 detail: ranking table
│   │   └── SignalLog.tsx                 # Strategy signal feed
│   ├── chart/
│   │   ├── ChartView.tsx                # Trading tab page (~200 lines)
│   │   ├── Chart.tsx                    # lightweight-charts wrapper (~300 lines)
│   │   ├── ChartController.ts           # Chart logic controller class (~400 lines)
│   │   ├── ChartDataManager.ts          # Data fetching, paging (~200 lines)
│   │   ├── ChartIndicators.ts           # Indicator series management (~200 lines)
│   │   ├── ChartMarkers.ts             # Strategy signal markers (~150 lines)
│   │   ├── ChartWebSocket.ts           # Real-time update handler (~150 lines)
│   │   ├── chartWorkarounds.ts          # lightweight-charts bug workarounds (~200 lines)
│   │   ├── chartConfig.ts              # Colors, themes, defaults (~100 lines)
│   │   └── types.ts                     # Chart-specific types (~50 lines)
│   ├── backtest/
│   │   ├── BacktestPage.tsx
│   │   ├── BacktestForm.tsx
│   │   ├── BacktestResults.tsx
│   │   └── BacktestEquityChart.tsx
│   ├── trading/
│   │   ├── TradeDrawer.tsx              # Manual trade creation
│   │   └── TradeDetailsDialog.tsx       # Trade detail view
│   ├── accounts/
│   │   └── TradingAccountsManager.tsx   # Bybit account management
│   ├── shared/
│   │   ├── SortableTable.tsx            # Reusable sortable table component
│   │   ├── DrawdownGauge.tsx            # Visual gauge
│   │   ├── SparklineChart.tsx           # Mini inline chart
│   │   ├── StatusBadge.tsx              # Active/paused/halted badges
│   │   └── LoadingSpinner.tsx           # Loading state
│   ├── auth/
│   │   └── LoginForm.tsx               # Login/register form
│   └── users/
│       └── UsersManager.tsx             # User management (admin)
├── store/
│   ├── authStore.ts                     # Auth state (persisted)
│   ├── portfolioStore.ts                # Portfolio equity, positions, drawdown
│   ├── strategyStore.ts                 # Per-strategy state, signals, config
│   ├── fundingStore.ts                  # Funding rate data
│   ├── momentumStore.ts                 # Cross-sectional rankings
│   ├── tradeStore.ts                    # Active trades, orders
│   ├── themeStore.ts                    # Theme preference (persisted)
│   └── timezoneStore.ts                 # Timezone preference (persisted)
├── lib/
│   ├── api.ts                           # Axios API client modules
│   ├── websocketService.ts              # WebSocket connection + subscriptions
│   ├── logger.ts                        # Client-side structured logger
│   └── dateFormatter.ts                 # Timezone-aware date formatting
├── types/
│   └── api.ts                           # Shared API response types
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── jest.config.js
├── eslint.config.js
├── Dockerfile
├── .env.example
└── .env.local
```

### Code Quality Rules (Enforced Throughout)

- No file over 500 lines
- No React component over 300 lines
- No function over 50 lines
- No more than 10 props per component (use stores/context)
- No `console.log` in production code — structured `logger` only
- No `.env` files committed — `.env.example` templates only
- All numeric types are `number` internally (string conversion only at exchange boundary)
- All timestamps are UTC milliseconds internally

---

## Database Management

### Strategy: Schema-first + Raw SQL Migrations

The project uses raw SQL for all database operations (via `pg` client). The migration system
follows the same philosophy — no ORM, no query builder, just numbered SQL files with a
lightweight runner.

### Two-Layer Approach

**Layer 1: Full Schema (`schema.ts`)**
- Contains the complete current schema as `CREATE TABLE IF NOT EXISTS` statements
- Used for fresh installs (new dev, Docker rebuild, CI test databases)
- Always represents the "latest" database state
- Run by: `initializeSchema()` during server startup

**Layer 2: Migrations (`server/migrations/`)**
- Numbered SQL files for incremental changes to existing databases
- Used when the schema evolves after initial deployment
- Each migration runs exactly once, tracked in a `_migrations` table
- Run by: `migrate.ts` script (before server start in prod, or manually in dev)

### Migration File Format

```
server/migrations/
├── 001_initial_baseline.sql        ← empty (marks schema.ts as the baseline)
├── 002_add_strategy_metrics.sql    ← ALTER TABLE strategy_performance ADD ...
├── 003_add_trade_tags.sql          ← ALTER TABLE trades ADD COLUMN tags jsonb
└── ...
```

Each file:
```sql
-- Migration: 002_add_strategy_metrics
-- Description: Add sharpe ratio and win rate columns to strategy_performance
-- Date: 2026-03-15

ALTER TABLE strategy_performance ADD COLUMN IF NOT EXISTS sharpe_ratio DECIMAL(10,4);
ALTER TABLE strategy_performance ADD COLUMN IF NOT EXISTS win_rate DECIMAL(5,4);
```

### Migration Tracking Table

```sql
CREATE TABLE IF NOT EXISTS _migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Migration Runner (`server/src/services/database/migrate.ts`)

```
1. Connect to database
2. Ensure _migrations table exists
3. Read all .sql files from server/migrations/ (sorted by number prefix)
4. Query _migrations for already-applied files
5. For each unapplied migration (in order):
   a. BEGIN transaction
   b. Execute SQL
   c. INSERT into _migrations
   d. COMMIT
   e. Log success
6. If any migration fails: ROLLBACK, log error, abort remaining
```

### Environment-Specific Workflows

**Local Development (Docker Compose PostgreSQL):**
```
First time:  docker compose up → schema.ts runs (CREATE TABLE IF NOT EXISTS) → done
Schema change: write migration .sql → run `npm run migrate` → update schema.ts to match
Fresh reset:  npm run db:reset (drops all tables, re-runs schema.ts)
```

**Production (Neon Serverless PostgreSQL):**
```
First deploy:  schema.ts runs on first server start → baseline migration recorded
Schema change: write migration .sql → deploy → migration runs before server accepts traffic
Rollback:      write a new "undo" migration (no automatic rollback — explicit is safer)
```

**CI/Test Databases:**
```
Each test run: create temp schema → run schema.ts → run tests → drop schema
No migrations needed in CI — always starts fresh from schema.ts
```

### Commands

```
npm run migrate          ← apply pending migrations
npm run migrate:status   ← show applied/pending migrations
npm run db:reset         ← drop all + re-run schema.ts (dev only, requires --confirm flag)
```

### Rules

- **schema.ts stays in sync**: after writing a migration, update schema.ts so it reflects the
  new state. Fresh installs use schema.ts; existing databases use migrations.
- **Migrations are append-only**: never edit an already-applied migration. Write a new one.
- **No down migrations**: if something goes wrong, write a new forward migration to fix it.
  Automatic rollbacks create false confidence.
- **Test migrations locally first**: run against Docker Compose DB before pushing to prod.
- **Keep migrations small**: one concern per file. Easier to review, easier to debug.

---

## Phase 1: Server Foundation

### Step 1.1: Database & Config
- Database connection pool (`connection.ts`)
- Schema creation (`schema.ts`) — new tables only:
  - `users` (from V1)
  - `trading_accounts` (from V1, minus Kraken fields)
  - `trades` (from V1)
  - `orders` (from V1)
  - `backtest_runs` (from V1)
  - `backtest_trades` (from V1)
  - `portfolio_snapshots` (NEW)
  - `funding_payments` (NEW)
  - `strategy_performance` (NEW)
- Database migration system (see "Database Management" section below)
- Environment config with validation

### Step 1.2: Auth & Users
- JWT auth middleware
- User service (transplant from V1 — clean, 477 lines)
- Auth routes (login, register, me, logout)
- User routes (CRUD, password change)

### Step 1.3: Exchange Abstraction
- `ExchangeService` interface + unified types
- `ExchangeManager` (multi-exchange router)
- Standardized event types

### Step 1.4: Bybit Adapter
- `bybitTypes.ts` — raw response shapes (documented field ambiguities)
- `bybitMapper.ts` — ALL parsing in one file (transplant proven logic from V1)
- `bybitErrors.ts` — error translation
- `bybitClient.ts` — thin wrapper around `bybit-api` library
- `bybitAdapter.ts` — implements `ExchangeService`
- Methods: getBalances, getTotalEquity, getPositions, placeOrder, cancelOrder, modifyOrder, setStopLossTakeProfit, getLeverage, setLeverage, getCandles, getTicker, getFundingRate, getFundingRateHistory, getOpenInterest, getActiveSymbols, getSymbolInfo, getServerTime

### Step 1.5: Bybit WebSocket
- Connection management (auto-reconnect, heartbeat)
- Public channel: kline subscriptions (candle updates)
- Public channel: ticker subscriptions
- Private channel: order updates, position updates, execution events
- Emit standardized `ExchangeEvents`

### Step 1.6: Market Data Service
- `candleService.ts` — fetch candles from exchange API, in-memory cache (60s TTL, 100 entries max)
- Multi-interval support (1m, 5m, 15m, 30m, 1h, 4h, 1D, 1W)
- Warmup data fetching (for indicator initialization)

### Step 1.7: Logging & Monitoring
- Structured logger (transplant from V1)
- System monitor (simplified — health checks for DB, exchange, WebSocket)
- Health endpoint (`GET /api/health`)

### Step 1.8: Express App & WebSocket Server
- Express app with middleware (helmet, cors, rate-limit, JWT)
- WebSocket server setup
- Route registration
- Startup sequence

### What you need to do for Phase 1
- Copy your Bybit API keys into `.env` (from old `.env.prod`)
- Copy your Neon DB credentials into `.env`
- Ensure local PostgreSQL is running (for dev)

---

## Phase 2: Indicators

### Step 2.1: Transplant Existing Indicators
- EMA (from V1 `server/indicators/ema.ts`)
- SMA (from V1 `server/indicators/sma.ts`)
- RSI (from V1 `server/indicators/rsi.ts`)
- ATR (from V1 `server/indicators/atr.ts`)
- Bollinger Bands (from V1 `server/indicators/bollinger.ts`)
- Volume SMA (from V1, modified for configurable period)

### Step 2.2: New Indicators
- **ADX** (Average Directional Index) — trend strength, period 14
- **Stochastic RSI** — momentum exhaustion, K:14, D:3, Smooth:3
- **ROC** (Rate of Change) — momentum measurement, periods 7/14/30
- **Bollinger Band Width** — regime filtering, period 20
- **Realized Volatility** — volatility-adjusted sizing, 14-day

### Step 2.3: Indicator Registry & Types
- Unified indicator interface
- Registry for lookup by name
- Streaming indicator support (incremental updates)

### What you need to do for Phase 2
- Nothing

---

## Phase 3: Trading Infrastructure

### Step 3.1: Risk Validation Service
- Per-trade max loss check (transplant from V1)
- Per-trade risk percentage check (transplant from V1)
- Portfolio-level total risk check (transplant from V1)
- **NEW**: Strategy allocation enforcement (each strategy capped at its % of capital)
- **NEW**: Cross-strategy conflict detection (same symbol, opposing sides)
- **NEW**: Portfolio drawdown circuit breaker (halt all if drawdown > threshold)
- **NEW**: Per-strategy drawdown tracking (pause individual strategy if its drawdown > threshold)

### Step 3.2: Trade Service
- Trade CRUD (create, read, update, close) — simplified from V1
- Order management (place, cancel, modify)
- SL/TP management (via exchange `setStopLossTakeProfit`)
- Trade status tracking
- Balance validation before trade

### Step 3.3: Trade Routes
- `POST /api/trading/trades` — create trade
- `GET /api/trading/trades` — list trades
- `PUT /api/trading/trades/:id` — update trade (SL/TP)
- `POST /api/trading/trades/:id/close` — close trade
- `DELETE /api/trading/orders/:id` — cancel order
- `GET /api/trading/positions` — get positions from exchange
- `GET /api/trading/balance` — get balance from exchange

### Step 3.4: Market Data Routes
- `GET /api/market/candles/:symbol` — candle data
- `GET /api/market/ticker/:symbol` — ticker data
- `GET /api/market/funding-rates` — all funding rates
- `GET /api/market/funding-history/:symbol` — funding history
- `GET /api/market/open-interest/:symbol` — OI data
- `GET /api/market/symbols` — active symbols
- `GET /api/market/intervals` — supported intervals

### What you need to do for Phase 3
- Nothing

---

## Phase 4: Strategies

### Step 4.1: Strategy Types & Registry
- Strategy interface (multi-timeframe, capabilities, symbol universe)
- Strategy registry
- Signal types (entry, exit, adjust)

### Step 4.2: Strategy 1 — Multi-Timeframe Trend Following
- **Timeframes**: Daily (1D) filter + 4-Hour (4H) entry
- **Indicators**: Daily EMA(50), Daily ADX(14), 4H EMA(9), 4H EMA(21), 4H ATR(14), 4H RSI(14), 4H Volume SMA(20)
- **Entry long**: Price > Daily 50 EMA + ADX > 25 + 4H 9-EMA crosses above 21-EMA + RSI 40-70 + Volume > 1.2x avg
- **Entry short**: Price < Daily 50 EMA + ADX > 25 + 4H 9-EMA crosses below 21-EMA + RSI 30-60 + Volume > 1.2x avg
- **Stop loss**: 2x ATR(14) from entry
- **Take profit**: 3x ATR with trailing stop at 1.5x ATR
- **Exit**: Trailing stop hit, OR ADX < 20, OR opposing EMA cross
- **Symbols**: 8-12 (BTC, ETH, SOL, AVAX, LINK, DOT, ADA, MATIC, NEAR, INJ, SUI, RENDER)
- **Leverage**: 2-3x
- **Capital allocation**: 30%

### Step 4.3: Strategy 2 — Mean Reversion Scalper
- **Timeframes**: 15-Minute (15m) primary + 1-Hour (1H) filter
- **Indicators**: 15m BB(20, 2.0), 15m RSI(7), 15m Volume SMA(20), 15m ATR(14), 15m Stochastic RSI(14, 3, 3), 15m BB Width(20), 1H EMA(50)
- **Entry long**: Price < lower BB + RSI(7) < 25 + StochRSI K crosses above D from below 20 + Volume > 2x avg + Price > 1H 50-EMA
- **Entry short**: Price > upper BB + RSI(7) > 75 + StochRSI K crosses below D from above 80 + Volume > 2x avg + Price < 1H 50-EMA
- **Stop loss**: 1.5x ATR from entry
- **Take profit**: Middle BB (partial at 50%, trail remainder at 0.5x ATR)
- **Exit**: Middle BB hit, OR RSI returns to 40-60, OR 12 candles elapsed (time stop)
- **Symbols**: 5-6 (BTC, ETH, SOL, XRP, AVAX, BNB)
- **Leverage**: 2x
- **Capital allocation**: 20%

### Step 4.4: Strategy 3 — Funding Rate Carry
- **Timeframes**: 1-Hour (1H) execution + 8-Hour funding settlements
- **Metrics**: Current funding rate, 7-day avg funding rate, Funding rate Z-score (30-day), OI change 24h, Basis (perp vs spot), 1H RSI(14), 1H ATR(14)
- **Entry short perps**: Funding Z-score > 1.5 + 7d avg > 0.01%/8h + OI rising + RSI > 60
- **Entry long perps**: Funding Z-score < -1.5 + 7d avg < -0.01%/8h + OI rising + RSI < 40
- **Stop loss**: 2.5x ATR
- **Take profit**: Funding Z-score returns to -0.5 to +0.5, OR after 3-5 funding periods
- **Position sizing**: 0.5-1% risk per position (many concurrent)
- **Symbols**: 15-20 scanned dynamically (top funding extremes)
- **Leverage**: 1-2x
- **Capital allocation**: 20%

### Step 4.5: Strategy 4 — Cross-Sectional Momentum (Rotation)
- **Timeframes**: Daily (1D), rebalanced weekly (Monday 00:00 UTC)
- **Metrics**: ROC(7, 14, 30), Composite momentum score (40% ROC7 + 35% ROC14 + 25% ROC30), Realized volatility (14d), Volume 14d avg, Correlation to BTC (30d rolling), ATR(14), Drawdown from 30d high
- **Universe**: Top 30 coins by 14d avg volume on Bybit perps, exclude < $10M daily volume
- **Long basket**: Top 5 ranked by volatility-adjusted momentum
- **Short basket**: Bottom 5 ranked (skip shorts if BTC > 50d EMA — bull market filter)
- **Position sizing**: Equal volatility-weighted (ATR-based)
- **Rebalance**: Weekly — sell positions that left top/bottom 5, buy new entries
- **Drawdown filter**: Exclude coins down > 60% from 30d high from long basket
- **Symbols**: 25-30 universe, 5-10 active positions at any time
- **Leverage**: 2x
- **Capital allocation**: 30%

### Step 4.6: Strategy Executor
- Multi-timeframe candle subscription management
- Warmup data fetching (indicator initialization)
- Signal generation on confirmed candles
- Signal → order routing (via signal processor)
- Strategy pause/resume
- Per-strategy logging

### Step 4.7: Signal Processor
- Convert strategy signals to order requests
- Apply position sizing (based on allocation + risk rules)
- Set leverage before placing order
- Place order via exchange service
- Set SL/TP after fill (Bybit requirement)
- Record trade in database

### Step 4.8: Funding Rate Service
- Poll funding rates for all tracked symbols (every 5 min)
- Calculate 7-day rolling average
- Calculate Z-score (30-day lookback)
- Track next settlement time
- Store funding payment history in database
- Emit events for Strategy 3

### Step 4.9: Universe Scanner
- Scan Bybit for all active USDT perp symbols
- Filter by 14-day average volume (> $10M)
- Filter out stablecoins
- Calculate momentum scores for Strategy 4
- Emit ranking updates

### Step 4.10: Strategy Routes
- `GET /api/strategies` — all strategies with status, config, metrics
- `GET /api/strategies/:id/state` — full state for one strategy
- `PUT /api/strategies/:id/config` — update strategy config
- `POST /api/strategies/:id/pause` — pause strategy
- `POST /api/strategies/:id/resume` — resume strategy
- `GET /api/strategies/:id/signals` — signal log

### What you need to do for Phase 4
- Nothing

---

## Phase 5: Portfolio Manager

### Step 5.1: Portfolio Manager Service
- Track capital allocation per strategy (30/20/20/30 split)
- Calculate total equity (from exchange balance + unrealized P&L)
- Track peak equity and current drawdown
- Enforce allocation limits (strategy can't use more than its share)
- Cross-strategy conflict detection
- Aggregate P&L across strategies

### Step 5.2: Equity Tracker
- Snapshot equity every 5 minutes (or on trade close)
- Store in `portfolio_snapshots` table
- Calculate daily/weekly/monthly returns
- Calculate Sharpe ratio, max drawdown, win rate per strategy and portfolio

### Step 5.3: Circuit Breaker
- Portfolio-level: halt all strategies if drawdown > 25%
- Per-strategy: pause strategy if its drawdown > 15%
- Auto-resume: resume when drawdown recovers to < 10%
- Manual override: user can force-resume
- Emit alerts via WebSocket

### Step 5.4: Portfolio Routes
- `GET /api/portfolio/summary` — equity, drawdown, allocation, position count
- `GET /api/portfolio/equity-curve` — historical equity data points
- `GET /api/portfolio/performance` — aggregate metrics (Sharpe, drawdown, returns)
- `GET /api/portfolio/performance/:strategyId` — per-strategy metrics

### Step 5.5: Portfolio WebSocket Events
- `portfolio:equity_update` — every 5 min or on trade close
- `portfolio:drawdown_alert` — when crossing thresholds
- `portfolio:circuit_breaker` — when circuit breaker triggers/releases
- `strategy:signal` — strategy generated entry/exit/skip
- `strategy:state_change` — active → paused → halted
- `strategy:position_opened` / `strategy:position_closed`
- `funding:rate_update` — funding rates changed
- `funding:settlement` — funding payment received/paid
- `ranking:update` — momentum rankings recalculated

### What you need to do for Phase 5
- Nothing

---

## Phase 6: Client Foundation

### Step 6.1: App Shell
- Next.js 15 App Router setup
- Root layout with theme support
- Providers (React context)
- Tailwind CSS config
- Login page / auth flow

### Step 6.2: Zustand Stores
- `authStore.ts` — transplant from V1 (persisted, localStorage)
- `themeStore.ts` — transplant from V1 (persisted)
- `timezoneStore.ts` — transplant from V1 (persisted)
- `portfolioStore.ts` — equity, drawdown, allocation, positions (non-persisted, API-fetched)
- `strategyStore.ts` — per-strategy state, signals, config (non-persisted)
- `fundingStore.ts` — funding rate data (non-persisted)
- `momentumStore.ts` — cross-sectional rankings (non-persisted)
- `tradeStore.ts` — active trades, orders (simplified from V1)

### Step 6.3: API Client
- Axios instance with auth interceptor
- API modules: auth, portfolio, strategies, trading, market, backtest, users, system
- Error handling with toast notifications

### Step 6.4: WebSocket Service
- Connection management (auto-reconnect)
- Event subscription system
- All new event types (portfolio, strategy, funding, ranking)
- Push updates to Zustand stores

### Step 6.5: Shared Components
- `SortableTable.tsx` — reusable sortable/filterable table
- `DrawdownGauge.tsx` — visual gauge component
- `SparklineChart.tsx` — mini inline chart (lightweight-charts)
- `StatusBadge.tsx` — active/paused/halted badges
- `LoadingSpinner.tsx` — loading state

### Step 6.6: Layout Components
- `Sidebar.tsx` — 8-tab navigation
- `Header.tsx` — health chip, user avatar
- `Dashboard.tsx` — tab router

### What you need to do for Phase 6
- Nothing

---

## Phase 7: Portfolio Dashboard (Tab 1)

### Step 7.1: Summary Cards
- Total Equity (live from exchange, shows all-time return from seed)
- Today's P&L (realized + unrealized since midnight UTC)
- Open Positions (count across all strategies, long/short breakdown)
- Portfolio Drawdown (current dd from peak, color-coded, circuit breaker threshold)

### Step 7.2: Equity Curve Chart
- lightweight-charts area chart
- Time range buttons: 1W, 1M, 3M, 6M, 1Y, ALL
- Toggle: portfolio total vs per-strategy equity lines
- Drawdown shading below peak line
- Updated on trade close or every 5 minutes

### Step 7.3: Strategy Allocation Panel
- Horizontal bars per strategy showing allocation %
- Each bar: name, %, dollar amount, cumulative P&L, Sharpe ratio
- Color-coded: green = profitable, red = in drawdown
- Click → navigates to Strategies tab filtered to that strategy

### Step 7.4: Open Positions Table
- Columns: Strategy, Symbol, Side, Entry Price, Size ($), Unrealized P&L, Leverage, Age
- Sortable by any column
- Filterable by strategy
- Expandable rows (SL, TP, orders, funding payments)
- Real-time P&L via WebSocket

### Step 7.5: Recent Trades Feed
- Scrollable feed, newest at top
- Green/red arrows for profit/loss
- Strategy label per trade
- Time filter: 24h, 7d, 30d
- Summary at bottom: trade count, W/L, total P&L
- Click → trade detail dialog

### What you need to do for Phase 7
- Nothing

---

## Phase 8: Strategies Monitor (Tab 2)

### Step 8.1: Strategy Card Component
- Status indicator (active/paused/halted)
- Pause/Resume button
- Config button (opens settings)
- Metrics row: allocation, leverage, symbol count, P&L, drawdown, Sharpe
- Mini equity curve sparkline
- Active positions list
- Signal log (real-time feed of strategy decisions)

### Step 8.2: Strategy-Specific Panels
- **Trend Status Table**: Symbol, Daily Trend, ADX, 4H EMA Cross, Status
- **Scalp Monitor Table**: Symbol, BB Position, RSI(7), StochRSI, Vol Spike, Ready
- **Funding Rate Scanner**: Symbol, Current Rate, 7d Avg, Z-Score, OI Δ, Position
- **Momentum Ranking Table**: Rank, Symbol, Score, ROC(7d/14d/30d), Position

### Step 8.3: Strategy Configuration Drawer
- Editable parameters per strategy (leverage, symbols, indicator periods)
- Save → sends `PUT /api/strategies/:id/config`

### What you need to do for Phase 8
- Nothing

---

## Phase 9: Chart View (Tab 3)

### Step 9.1: Chart Workarounds File
- Transplant from V1: dedupeByTime, forceVisibleRange, updateWithoutRescale, safeResize, normalizeTimestamp, isCalendarInterval
- Document each workaround with comments explaining the bug

### Step 9.2: Chart Controller
- Class-based controller (not React state)
- Methods: initialize, loadData, loadOlderPage, applyRealtimeUpdate, setIndicators, setMarkers, setTheme, destroy
- In-memory sliding window (max 5000 bars)

### Step 9.3: Chart Component (React wrapper)
- Thin React component using refs
- Symbol/interval selection controls
- Theme reactivity
- WebSocket subscription for real-time updates

### Step 9.4: Chart Indicators
- Series management (add/remove based on config)
- Separate panes for RSI/MFI
- Overlays for EMA/BB
- Prep bar filtering

### Step 9.5: Chart Markers
- Strategy signal markers (entry/exit)
- Simple — no P&L on hover, no flash markers, no Token Metrics
- Sorted by time (lightweight-charts requirement)

### Step 9.6: Chart Data Manager
- Bidirectional paging (scroll left loads older data)
- Viewport preservation after data load
- Sliding window (cap at 5000 bars)
- Throttled paging (250ms during drag, 500ms normal)

### What you need to do for Phase 9
- Nothing

---

## Phase 10: Backtest, Accounts, Admin Tabs

### Step 10.1: Backtest Service
- Single-strategy backtesting (fetch candles from API, run strategy, track results)
- Multi-timeframe backtest support
- Realistic execution simulation (slippage, fees, funding rates)
- Results storage in `backtest_runs` + `backtest_trades` tables

### Step 10.2: Portfolio Backtest (NEW)
- Run all 4 strategies simultaneously over a date range
- Shared capital allocation
- Correlated drawdown analysis
- Combined equity curve

### Step 10.3: Backtest UI
- Backtest form (strategy, symbol, date range, params)
- Results card (equity curve, metrics, trade list)
- Portfolio backtest mode toggle
- Saved runs table

### Step 10.4: Trading Accounts Manager
- Account CRUD (transplant pattern from V1)
- Balance display
- API key verification
- Risk limit configuration

### Step 10.5: Users Manager
- User CRUD (transplant from V1)
- Role management

### Step 10.6: System Monitor & Logs
- Health overview (DB, exchange, WebSocket status)
- Log viewer (simplified from V1)

### What you need to do for Phase 10
- Nothing

---

## Phase 11: Test Hardening & Coverage

Testing is **incremental** — unit tests ship with each phase, integration tests are added at
key milestones, and Phase 11 is a hardening pass that fills gaps and adds load/edge-case testing.

### Incremental Testing Schedule (built into each phase)

```
Phase   Test Type          What Gets Tested
─────   ─────────          ────────────────
1       Unit               DB connection, schema creation, auth middleware
2       Unit               All 11 indicator calculations, registry lookup
3       Unit               Risk validation (7 checks), trade param validation
4       Unit               Strategy signal logic (4 strategies), registry
5       Unit + Integration DB queries (real local DB), portfolio allocation,
                           REST endpoint round-trips (supertest), WebSocket events
6       Unit               Zustand stores, API client modules
7       Unit + E2E smoke   Component rendering, login → dashboard flow (Playwright)
8-10    Unit + Integration Per-feature tests as each UI tab is built
```

### Step 11.1: Server Unit Test Gaps
- Bybit mapper edge cases (raw → unified type conversion)
- Exchange error translation (rate limit, auth, network)
- Candle service cache hit/miss/expiry
- Funding service Z-score math validation
- Universe scanner filtering logic

### Step 11.2: Server Integration Tests (expand from Phase 5 baseline)
- Bybit API connectivity (testnet) — real exchange calls
- Full trade lifecycle: create → fill → SL/TP update → close → PnL check
- Strategy executor: warmup → candle feed → signal → order (mock exchange)
- Portfolio manager: equity snapshot → allocation check → drawdown trigger
- Backtest execution: run strategy over historical data, verify results match
- WebSocket: client connect → subscribe → receive broadcast → disconnect

### Step 11.3: Client Unit Test Gaps
- Zustand store edge cases (reconnection, stale data)
- Component rendering with various data states (loading, empty, error)
- Chart interactions (zoom, crosshair, indicator toggle)

### Step 11.4: End-to-End Tests (expand from Phase 7 baseline)
- Full auth flow: register → login → token refresh → protected route
- Trade flow: login → place trade → see position → update SL → close
- Strategy flow: view strategies → pause → resume → check state change
- Portfolio flow: view dashboard → check equity → view allocation breakdown
- WebSocket reconnection: disconnect → auto-reconnect → resume data

### Step 11.5: Edge Case & Load Testing
- Concurrent trade submissions (race conditions)
- Exchange API timeout handling
- Database connection pool exhaustion
- WebSocket with 50+ concurrent clients
- Large backtest (1000+ trades, 1 year of data)
- Strategy signal flood (all 4 strategies signaling simultaneously)

### What you need to do for Phase 11
- Nothing

---

## Phase 12: Documentation & Scripts

### Step 12.1: Documentation (10-12 files)
- `README.md` — project overview, quick start, architecture
- `docs/SETUP.md` — environment setup, API keys, database init
- `docs/DEPLOYMENT.md` — DigitalOcean/Docker/Vercel deployment
- `docs/STRATEGIES.md` — all 4 strategies: logic, indicators, parameters
- `docs/PORTFOLIO.md` — portfolio manager, allocation, circuit breakers
- `docs/BACKTESTING.md` — how to backtest, interpret results
- `docs/API-REFERENCE.md` — all endpoints, request/response formats
- `docs/ARCHITECTURE.md` — service diagram, data flow, WebSocket events
- `docs/RISK-MANAGEMENT.md` — risk rules, position sizing, drawdown limits
- `docs/TROUBLESHOOTING.md` — common issues, diagnosis

### Step 12.2: Scripts (10-15 files)
- `scripts/setup/init-database.ts` — create schema
- `scripts/setup/generate-jwt-secret.ps1` — JWT secret generation
- `scripts/dev/start-dev.ps1` — start dev server + client
- `scripts/dev/reset-database.ts` — drop all tables and recreate (dev only, requires --confirm)
- `scripts/dev/seed-test-data.ts` — test trades/accounts for UI dev
- `scripts/db/migrate.ts` — apply pending SQL migrations
- `scripts/db/migrate-status.ts` — show applied/pending migrations
- `scripts/backtest/run-backtest.ts` — CLI backtest runner
- `scripts/backtest/run-portfolio-backtest.ts` — CLI portfolio backtest
- `scripts/maintenance/check-exchange-connection.ts` — verify Bybit API
- `scripts/maintenance/portfolio-snapshot.ts` — manual equity snapshot
- `scripts/maintenance/check-funding-rates.ts` — view current rates
- `scripts/deploy/test-docker-build.ps1` — test Docker builds
- `scripts/test/run-all-tests.ps1` — full test suite

### What you need to do for Phase 12
- Nothing

---

## Phase 13: Deployment & Go-Live

### Step 13.1: Local Validation
- Run all tests
- Run all 4 strategies in paper/testnet mode locally
- Verify portfolio dashboard displays correctly
- Verify WebSocket events flow correctly
- Run a portfolio backtest over 3-6 months of data

### Step 13.2: Production Deployment

**What you need to do:**

1. **Neon Database**: Either create a new database in your existing Neon project, or drop the old tables and use the same database name
   - Go to Neon dashboard → your project → SQL Editor
   - Run: `CREATE DATABASE algo_trading_v2;` (or reuse `neondb` with clean schema)

2. **DigitalOcean**: Repoint existing DO app to the new repo
   - DO dashboard → Apps → your app → Settings → Source
   - Change GitHub repo to `algo-trading-v2`
   - Update environment variables:
     - Remove: `KRAKEN_API_KEY`, `KRAKEN_API_SECRET`
     - Update: `NEON_DB_NAME` (if using new database name)
     - Update: `CLIENT_URL` (if Vercel URL changed)
   - Save → triggers redeploy

3. **Vercel**: Repoint existing Vercel project to the new repo
   - Vercel dashboard → Project → Settings → Git
   - Disconnect old repo, connect `algo-trading-v2`
   - Set root directory: `client/`
   - Verify `NEXT_PUBLIC_API_URL` points to the DO server

4. **Bybit**: Rotate API keys (recommended since old keys are in git history)
   - Generate new API keys on Bybit
   - Update in DO dashboard secrets
   - Update in local `.env`

5. **GitHub**: Archive the old repo
   - Old repo → Settings → Danger Zone → Archive

### Step 13.3: Go-Live Sequence
1. Deploy server to DO (auto on push to main)
2. Deploy client to Vercel (auto on push to main)
3. Verify health endpoint: `GET /api/health`
4. Login to the app
5. Verify exchange connection (balance loads)
6. Start strategies in paper/testnet mode first
7. Monitor for 24-48 hours
8. Switch to live trading with small position sizes
9. Scale up position sizes over 1-2 weeks as confidence builds

### What you need to do for Phase 13
- All 5 items listed above (Neon, DO, Vercel, Bybit, GitHub)

---

## Transplant Reference

### Files to transplant from V1 (copy and clean up)

| Source (V1) | Destination (V2) | What to keep | What to change |
|---|---|---|---|
| `server/indicators/ema.ts` | `server/src/indicators/ema.ts` | Core calculation | Clean up, add types |
| `server/indicators/sma.ts` | `server/src/indicators/sma.ts` | Core calculation | Clean up |
| `server/indicators/rsi.ts` | `server/src/indicators/rsi.ts` | Core calculation | Clean up |
| `server/indicators/atr.ts` | `server/src/indicators/atr.ts` | Core calculation | Clean up |
| `server/indicators/bollinger.ts` | `server/src/indicators/bollinger.ts` | Core calculation | Clean up |
| `server/services/bybit.ts` | `server/src/services/exchange/bybit/bybitMapper.ts` | Field mappings, parsing logic, workarounds | Split into mapper + types + adapter |
| `server/services/riskValidationService.ts` | `server/src/services/trade/riskValidation.ts` | 3-layer validation | Add portfolio-level rules |
| `server/services/userService.ts` | `server/src/services/auth/userService.ts` | All of it | Minor cleanup |
| `client/store/authStore.ts` | `client/store/authStore.ts` | All of it | No changes |
| `client/store/themeStore.ts` | `client/store/themeStore.ts` | All of it | No changes |
| `client/store/timezoneStore.ts` | `client/store/timezoneStore.ts` | All of it | No changes |
| `client/lib/websocketService.ts` | `client/lib/websocketService.ts` | Connection pattern | Add new event types |
| `client/lib/logger.ts` | `client/lib/logger.ts` | All of it | No changes |
| ChartContainer.tsx | `client/components/chart/chartWorkarounds.ts` | dedupeByTime, forceVisibleRange, updateWithoutRescale, safeResize, normalizeTimestamp, calendar interval handling | Extract into utility functions |
| ChartContainer.tsx | `client/components/chart/chartConfig.ts` | Theme color maps, chart options | Extract into config |
| useAddIndicators.ts | `client/components/chart/ChartIndicators.ts` | Series config (price scale IDs, margins, line types) | Restructure as methods |

### Bybit-Specific Knowledge to Preserve

All of this goes into `bybitMapper.ts` and `bybitTypes.ts`:

1. UNIFIED account master + sub-account balance merging
2. `result.balance[]` vs `result.list[]` response structures
3. 10-coin limit per balance request
4. `transferBalance` fallback to `walletBalance`
5. Position: `positionBalance` (not `positionMargin`) → margin
6. Position: `unrealisedPnl` (British spelling) → pnl
7. Spot category doesn't support `getPositionInfo` (error 181001)
8. `settleCoin: 'USDT'` required for all-positions query
9. Market orders: must strip ALL price-related fields
10. TP/SL must be set after fill via `setTradingStop()`
11. Order field ambiguity: `orderId/orderLinkId`, `orderType/type`, `qty/quantity`, `createdTime/createTime/createdAt`, `orderStatus/status`
12. All numeric values are strings — parse with `parseFloat(x || '0')`
13. Subaccount ID: check both `uid` and `subUID`
14. Clock drift: `recv_window: 10000`, `enable_time_sync: true`
15. Kline data: reverse chronological order, timestamps in milliseconds
16. Interval mapping: `1440→'D'`, `10080→'W'`, `43200→'M'`
17. POL → MATIC coin mapping
18. Candle end time: calculate from `start + interval` (Bybit's `end` is 1ms short)

### lightweight-charts Knowledge to Preserve

All of this goes into `chartWorkarounds.ts`:

1. Deduplicate data before every `setData()` call (assertion errors)
2. Viewport restoration: hammer `setVisibleRange` up to 10 times with 10ms intervals
3. Unconfirmed candle: disable auto-scale before `update()`, re-enable via `requestAnimationFrame`
4. ResizeObserver: wrap resize in `requestAnimationFrame` to prevent loop errors
5. Timestamp normalization: detect seconds vs milliseconds (< 1e12 check)
6. Calendar intervals (D/W/M): update existing candle, don't add new
7. Markers must be sorted by time
8. `lockVisibleTimeRangeOnResize: true` prevents viewport jumps on resize

---

## Server Initialization Process

The server follows a strict ordered startup sequence. Each step depends on the previous ones.

### Startup Sequence

```
Phase    Step  Action                                          Depends On    Failure Mode
─────    ────  ──────                                          ──────────    ────────────
BOOT     1     Load environment variables (.env)               Nothing       FATAL — exit
BOOT     2     Initialize logger                               Nothing       FATAL — exit
BOOT     3     Initialize notification service (Slack)         Nothing       Non-blocking — continue without
CONNECT  4     Connect to PostgreSQL + run schema migration    Step 2        Warn + continue (limited mode)
CONNECT  5     Initialize Bybit REST adapter                   Step 4        Warn — exchange features disabled
CONNECT  6     Create HTTP server + Express app                Step 2        FATAL — exit
CONNECT  7     Initialize client WebSocket server (/ws)        Step 6        Warn — no real-time to clients
CONNECT  8     Initialize Bybit WebSocket (market data)        Step 5        Warn — no real-time market data
CONNECT  9     Subscribe Bybit private channels (per account)  Step 4, 8     Warn — no live trade updates
SERVICES 10    Start portfolio equity tracker (5-min snaps)    Step 4, 5     Warn — no equity tracking
SERVICES 11    Start funding rate poller (5-min cycle)         Step 5        Warn — no funding data
SERVICES 12    Start strategy executor (if strategies active)  Steps 4-11    Warn — strategies paused
MONITOR  13    Start system health monitoring                  All above     Non-blocking
FINAL    14    Generate initialization summary log             All above     Non-blocking
FINAL    15    Send Slack startup notification                 Step 3        Non-blocking
FINAL    16    Begin listening on PORT                         Step 6        FATAL — exit
```

### Error Handling (Process-Level)

```typescript
// EADDRINUSE — port conflict
//   Dev: auto-kill conflicting process + retry (max 2 attempts)
//   Prod: log critical error + exit (let container orchestrator restart)

// unhandledRejection — catch-all for unhandled promise rejections
//   Log error, do NOT crash (keep server running)

// uncaughtException — catch-all for uncaught errors
//   Log error + exit (state may be corrupt, restart is safer)
```

### Graceful Shutdown Sequence

```
Signal   Step  Action                                    Timeout
──────   ────  ──────                                    ───────
SIGTERM  1     Send Slack "shutting down" notification   Non-blocking
SIGTERM  2     Pause all active strategies               Immediate
SIGTERM  3     Close Bybit WebSocket connections         1s
SIGTERM  4     Close client WebSocket server             1s
SIGTERM  5     Close HTTP server (stop accepting)        5s
SIGTERM  6     Disconnect database pool                  2s
SIGTERM  7     Force exit if not done                    10s total
```

### DB Keepalive (Neon Cold-Start Prevention)

In production (Neon), the database connection pool sends a lightweight `SELECT 1` ping every 60 seconds to prevent cold-start latency on the serverless PostgreSQL instance. This runs as a background interval after successful database connection.

### Initialization Summary

After all services initialize, a structured summary is logged showing the status of every component:
- Server (port, environment, node version)
- Database (connected/failed, host, name)
- Exchange (configured/disabled, API key prefix)
- WebSocket (connected/disconnected)
- Strategies (active count, paused count)
- Notifications (Slack enabled/disabled)
- ML Service (future — connected/disabled)

---

## Future: ML Signal Service (FreqTrade-Based)

### Overview
A FreqTrade-based machine learning container that runs independently and provides trading signals to the main server. Trained models generate entry/exit signals with confidence scores that integrate with existing strategies.

### Architecture
- **Separate Docker container** running FreqTrade with custom ML strategies
- **HTTP API** for signal retrieval (GET /signals/:symbol, GET /models/status)
- **Integration modes**: Confirm, Veto, Boost, or Independent signals
- **Signal types**: Entry, Exit, Hold, Adjust — each with confidence score (0-1)

### Integration Points
- Strategy executor queries ML service for signals before/after its own logic
- ML confidence score adjusts position sizing (Boost mode)
- ML signals can independently trigger trades (future Strategy 5)
- Signal expiry prevents acting on stale predictions
- Model status monitoring via system health checks

### Files (future)
```
ml/
├── Dockerfile
├── freqtrade/
│   ├── config.json
│   ├── strategies/
│   │   ├── ml_trend_classifier.py
│   │   └── ml_regime_detector.py
│   └── user_data/
│       └── models/
├── api/
│   ├── server.py              # Flask/FastAPI signal endpoint
│   └── signal_types.py        # Signal schema
└── training/
    ├── train_model.py
    └── feature_engineering.py
```

### Server-side interface (already scaffolded)
- `server/src/services/strategy/mlSignalTypes.ts` — TypeScript types for ML signals
- Config: `ML_SERVICE_URL`, `ML_SERVICE_ENABLED` in .env

---

## Notification Service (Slack)

### Overview
Cross-cutting notification service integrated with monitoring, logging, trading, and portfolio systems. Initially uses Slack webhooks, extensible to other channels (Discord, email, SMS).

### Alert Sources
| Source | Events | Level |
|--------|--------|-------|
| **Trading** | Trade opened, closed, stopped out | info / warning |
| **Portfolio** | Circuit breaker triggered/released, drawdown alerts | critical / warning |
| **Monitoring** | Health status changes (DB, exchange, WS down) | warning / critical |
| **Logging** | Error escalation (repeated errors) | critical |
| **System** | Server startup, shutdown, deployment | info |
| **ML Service** (future) | Model status, signal summary | info |

### Setup
1. Create Slack app at https://api.slack.com/apps
2. Enable Incoming Webhooks
3. Add webhook to channel (e.g., #algo-trading)
4. Set `SLACK_WEBHOOK_URL` in .env

---

## Multi-User Account-Scoped Architecture (Completed with Phase 5)

### Architecture
- **Account-centric scoping**: `trading_account_id` is the universal scoping key
- Each user has TEST + LIVE trading accounts (separate Bybit testnet/mainnet API keys)
- Client sends `X-Trading-Account-Id` header; server validates ownership
- `admin` role bypasses ownership checks; can access all accounts
- Server background services operate across ALL active accounts

### Schema Changes
- `portfolio_snapshots` + `strategy_performance`: added `trading_account_id` FK
- New table: `account_strategy_configs` (per-account strategy overrides with params, enable/disable)
- Removed hardcoded admin user; first admin created via `scripts/create-admin.ts`

### Service Refactoring
- **Exchange Manager**: per-account adapter cache (lazy creation from DB credentials), `getForAccount(id)` + `getDefault()`
- **Portfolio Manager / Equity Tracker / Circuit Breaker**: all methods take `tradingAccountId`, per-account state maps
- **Strategy Executor**: per-account runner sets, account-scoped pause/resume
- **Trade Service**: all exchange calls use `getForAccount(trade.trading_account_id)`
- **Signal Processor**: uses account adapter for equity/ticker lookups
- **WebSocket**: `broadcastToAccount(tradingAccountId, ...)` + `switch_account` message type

### Middleware
- `resolveAccount`: validates account ownership + admin bypass, attaches `req.tradingAccountId`
- `optionalAccount`: extracts account ID without requiring it

### Routes Updated
- Portfolio, Strategy, Trading routes all require `resolveAccount` middleware
- Market data routes remain public (use system-level default adapter)

---

## Implementation Order Summary

| Phase | Description | Depends On | Estimated Effort |
|---|---|---|---|
| 0 | Project scaffold | Nothing | Low |
| 1 | Server foundation (DB, auth, exchange, WebSocket) | Phase 0 | High |
| 2 | Indicators | Phase 0 | Medium |
| 3 | Trading infrastructure (risk, trades, routes) | Phase 1 | Medium-High |
| 4 | Strategies (all 4 + executor + services) | Phase 1, 2, 3 | High |
| 5 | Portfolio manager | Phase 3, 4 | High |
| 6 | Client foundation (stores, API, WebSocket, layout) | Phase 1 | Medium |
| 7 | Portfolio dashboard (Tab 1) | Phase 5, 6 | Medium-High |
| 8 | Strategies monitor (Tab 2) | Phase 4, 6 | Medium |
| 9 | Chart view (Tab 3) | Phase 6 | Medium |
| 10 | Backtest, accounts, admin | Phase 4, 6 | Medium |
| 11 | Testing | All phases | Medium |
| 12 | Documentation & scripts | All phases | Low |
| 13 | Deployment & go-live | All phases | Low (mostly user actions) |
