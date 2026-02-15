<!-- title: Architecture | category: Developer -->

# Architecture

System architecture, data flow, and design decisions for Algo Trading V2.

## Overview

Algo Trading V2 is a portfolio-based multi-strategy algorithmic trading platform for Bybit perpetual futures. The system runs 4 uncorrelated strategies with a shared capital pool, targeting 100%+ annual returns.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Client | Next.js 15, React 18, TypeScript | Web UI |
| State | Zustand 5 | Client state management |
| Charts | lightweight-charts, Recharts | Candlestick + line charts |
| Server | Express.js 4, Node.js 22, TypeScript | REST API + WebSocket |
| Database | PostgreSQL 16 (Neon in production) | Persistent storage |
| Exchange | Bybit V5 API + WebSocket | Order execution, market data |
| Hosting | Vercel (client), DigitalOcean (server) | Deployment |

## Project Structure

```
algo-trading-v2/
├── server/                     # Express API server
│   ├── src/
│   │   ├── index.ts            # Server entry point
│   │   ├── app.ts              # Express app setup, route registration
│   │   ├── config/             # Environment configuration
│   │   ├── middleware/         # Auth, geo-block, account resolver
│   │   ├── routes/             # REST API routes (10 modules)
│   │   ├── services/           # Business logic layer
│   │   │   ├── database/       # PostgreSQL connection + schema
│   │   │   ├── exchange/       # Bybit adapter (REST + WebSocket)
│   │   │   ├── portfolio/      # Portfolio manager, circuit breaker, equity tracker
│   │   │   ├── trading/        # Trade service, risk service
│   │   │   ├── backtest/       # Backtesting engine
│   │   │   ├── candles/        # Candle fetching + caching
│   │   │   ├── notification/   # Slack notifications
│   │   │   └── geo/            # Geo-location detection
│   │   ├── strategies/         # Strategy definitions + execution engine
│   │   ├── indicators/         # Technical indicator wrappers
│   │   └── websocket/          # WebSocket server
│   └── __tests__/              # Server tests (unit + integration)
│
├── client/                     # Next.js frontend
│   ├── app/                    # Next.js App Router pages
│   ├── components/             # React components (by feature)
│   │   ├── portfolio/          # Portfolio dashboard
│   │   ├── strategies/         # Strategy monitor
│   │   ├── chart/              # Candlestick chart
│   │   ├── backtest/           # Backtesting interface
│   │   ├── accounts/           # Account management
│   │   ├── users/              # User management (admin)
│   │   ├── system/             # System monitor
│   │   └── settings/           # Settings panel
│   ├── store/                  # Zustand stores
│   ├── lib/                    # API client, utilities
│   ├── hooks/                  # Custom React hooks
│   └── __tests__/              # Client tests (unit + integration)
│
├── docs/                       # Documentation (single source of truth)
├── scripts/                    # Utility scripts (setup, dev, maintenance)
└── .do/                        # DigitalOcean deployment config
```

## Data Flow

### Request Flow

```
Client (Next.js)
  → Axios API Client (lib/api.ts)
    → Express Server
      → Middleware (auth → geoBlock → resolveAccount)
        → Route Handler
          → Service Layer
            → Exchange API (Bybit) / Database (PostgreSQL)
```

### Real-Time Flow (WebSocket)

```
Bybit WebSocket
  → Exchange Service (candle/trade events)
    → Strategy Executor (signal generation)
      → Signal Processor (order placement)
        → WebSocket Server
          → Client (state updates)
```

### Authentication Flow

1. User submits credentials to `POST /api/auth/login`
2. Server validates against database, returns JWT (7-day expiry)
3. Client stores JWT in localStorage via Zustand `authStore`
4. Axios interceptor attaches `Authorization: Bearer <token>` to all requests
5. Server middleware `authenticateToken` validates JWT on protected routes
6. Trading account ID sent via `X-Trading-Account-Id` header

### Strategy Execution Flow

1. Strategy Executor subscribes to candle data (multi-timeframe)
2. Exchange WebSocket delivers confirmed candles
3. Candles routed to registered strategies via `strategy.onCandle()`
4. Strategy generates signals: `entry_long`, `entry_short`, `exit`, `hold`
5. Signal Processor applies position sizing and risk rules
6. Orders placed via Exchange Service (Bybit V5 API)
7. SL/TP set after fill confirmation
8. Trade recorded in database

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts with roles (admin/user) |
| `trading_accounts` | Exchange API key configs per user |
| `trades` | Trade records with strategy attribution |
| `orders` | Individual orders within trades |
| `backtest_runs` | Saved backtest execution results |
| `backtest_trades` | Individual trades within backtests |
| `portfolio_snapshots` | Equity snapshots (every 5 minutes) |
| `funding_payments` | Funding rate payment records |
| `strategy_performance` | Per-strategy performance metrics |
| `account_strategy_configs` | Per-account strategy parameter overrides |

### Key Relationships

- `users` → `trading_accounts` (1:many)
- `trading_accounts` → `trades` (1:many)
- `trades` → `orders` (1:many)
- `trading_accounts` → `portfolio_snapshots` (1:many)
- `trading_accounts` → `strategy_performance` (1:many)

## WebSocket Events

### Server → Client

| Event | Channel | Description |
|-------|---------|-------------|
| `connected` | — | Welcome message on connection |
| `portfolio:circuit_breaker` | `portfolio` | Circuit breaker triggered/released |
| `portfolio:drawdown_alert` | `portfolio` | Critical drawdown warning |
| `portfolio:equity_update` | `portfolio` | Equity snapshot (every 5 min) |
| `strategy:state_change` | `strategies` | Strategy paused/resumed/started |

### Client → Server

| Message | Description |
|---------|-------------|
| `auth` | Authenticate with userId + tradingAccountId |
| `subscribe` | Subscribe to channel (portfolio, strategies, trades) |
| `unsubscribe` | Unsubscribe from channel |
| `switch_account` | Switch between test/live mode |

## Key Design Decisions

### Portfolio-First Architecture

All strategies share a capital pool with fixed allocations (30/20/20/30%). The portfolio manager tracks aggregate equity, drawdown, and enforces circuit breakers across all strategies.

### No Candle Database

Candle data is fetched on demand from Bybit API and cached in memory. This eliminates the complexity of maintaining a historical candle database and ensures data is always fresh.

### Account-Scoped Everything

All services operate per-trading-account. Each account has independent:
- Strategy runners and configurations
- Portfolio state (equity, drawdown, peak)
- Circuit breaker monitoring
- Equity snapshots

### Exchange-Agnostic Adapter

The `ExchangeService` interface abstracts exchange specifics. Currently only Bybit is implemented, but the adapter pattern allows future exchanges.

## Middleware Stack

| Middleware | Purpose | Applied To |
|-----------|---------|------------|
| `helmet` | Security headers | All routes |
| `cors` | Cross-origin support | All routes |
| `rateLimit` | 200 req/15min | All routes |
| `authenticateToken` | JWT validation | Protected routes |
| `geoBlock` | Geographic restrictions | Exchange-facing routes |
| `resolveAccount` | Extract trading account | Account-scoped routes |
