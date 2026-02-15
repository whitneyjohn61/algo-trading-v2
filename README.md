# Algo Trading V2

Portfolio-based multi-strategy algorithmic crypto trading platform targeting 100%+ annual returns via 4 uncorrelated strategies on Bybit perpetual futures.

## Strategies

1. **Multi-Timeframe Trend Following** (30% allocation) — Daily + 4H EMA/ADX trend confirmation
2. **Mean Reversion Scalper** (20% allocation) — 15m Bollinger Band + RSI/StochRSI reversals
3. **Funding Rate Carry** (20% allocation) — Funding rate Z-score extremes
4. **Cross-Sectional Momentum** (30% allocation) — Weekly rotation of top/bottom momentum coins

## Tech Stack

- **Client**: Next.js 15, TypeScript, Tailwind CSS, Zustand, lightweight-charts
- **Server**: Node.js 22, Express, TypeScript, PostgreSQL, WebSocket (`ws`)
- **Database**: Neon Serverless PostgreSQL
- **Hosting**: Vercel (client), DigitalOcean App Platform (server)
- **Exchange**: Bybit V5 API + WebSocket

## Quick Start

### Prerequisites

- Node.js 22+
- npm 10+
- PostgreSQL 16+ (local dev) or Neon account (production)
- Bybit API keys

### Setup

```bash
# Install all dependencies
npm run install:all

# Copy environment templates
cp server/.env.example server/.env
cp client/.env.example client/.env.local

# Edit .env files with your credentials
# Then start development
npm run dev
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both server and client in dev mode |
| `npm run dev:server` | Start server only |
| `npm run dev:client` | Start client only |
| `npm run build` | Build both server and client |
| `npm run build:server` | Build server only |
| `npm run build:client` | Build client only |
| `npm test` | Run all tests |
| `npm run type-check` | TypeScript type checking |
| `npm run lint` | Run linting |

## Project Structure

```
algo-trading-v2/
├── server/                  # Express API server
│   ├── src/
│   │   ├── index.ts         # Server entry point
│   │   ├── app.ts           # Express app setup
│   │   ├── config/          # Environment config
│   │   ├── routes/          # API routes (10 modules)
│   │   ├── services/        # Business logic
│   │   ├── strategies/      # Trading strategies (4)
│   │   ├── indicators/      # Technical indicators
│   │   └── websocket/       # WebSocket server
│   └── __tests__/           # Server tests
│
├── client/                  # Next.js frontend
│   ├── app/                 # Next.js pages
│   ├── components/          # React components
│   ├── store/               # Zustand stores
│   ├── lib/                 # Utilities, API client
│   └── __tests__/           # Client tests
│
├── docs/                    # Documentation
├── scripts/                 # Utility scripts
├── .do/                     # DigitalOcean deployment
└── .cursor/                 # Cursor IDE rules
```

## Documentation

### User Guide
- [Strategies](./docs/STRATEGIES.md) — All 4 strategies: logic, indicators, parameters, entry/exit rules
- [Portfolio](./docs/PORTFOLIO.md) — Portfolio manager, allocation, equity tracking, performance metrics
- [Backtesting](./docs/BACKTESTING.md) — How to run backtests, interpret results, parameter tuning
- [Risk Management](./docs/RISK-MANAGEMENT.md) — Circuit breakers, position sizing, drawdown limits
- [Troubleshooting](./docs/TROUBLESHOOTING.md) — Common issues, diagnosis, FAQ

### Developer Reference
- [Setup Guide](./docs/SETUP.md) — Environment setup, API keys, database init
- [Architecture](./docs/ARCHITECTURE.md) — Service diagram, data flow, WebSocket events
- [API Reference](./docs/API-REFERENCE.md) — All endpoints, request/response formats
- [Deployment](./docs/DEPLOYMENT.md) — DigitalOcean, Vercel, Neon deployment

## Architecture

- **Portfolio-first**: All strategies share a capital pool with fixed allocations
- **Circuit breakers**: Auto-halt at 25% portfolio drawdown, 15% per-strategy
- **No candle database**: Fetch from Bybit API on demand, cache in memory
- **Exchange-agnostic**: Bybit adapter pattern allows future exchange additions
- **Account-scoped**: All services operate per-trading-account for multi-user support