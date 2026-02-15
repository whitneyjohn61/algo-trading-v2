<!-- title: Setup Guide | category: Developer -->

# Setup Guide

Complete guide for setting up the Algo Trading V2 development environment.

## Prerequisites

- **Node.js** 22+ (check: `node -v`)
- **npm** 10+ (check: `npm -v`)
- **PostgreSQL** 16+ (local development)
- **Bybit account** with API keys (testnet and/or mainnet)
- **Git** (for cloning the repository)

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/algo-trading-v2.git
cd algo-trading-v2

# Install all dependencies (root, server, client)
npm run install:all

# Copy environment templates
cp server/.env.example server/.env
cp client/.env.example client/.env.local

# Edit .env files with your credentials (see below)
# Then start development
npm run dev
```

## Environment Configuration

### Server Environment (`server/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `5000` | Server port |
| `JWT_SECRET` | — | JWT signing secret (generate a strong random string) |
| `DB_ENVIRONMENT` | `local` | Database mode: `local` or `neon` |
| `LOCAL_DB_HOST` | `localhost` | Local PostgreSQL host |
| `LOCAL_DB_PORT` | `5432` | Local PostgreSQL port |
| `LOCAL_DB_NAME` | `algo_trading_v2` | Local database name |
| `LOCAL_DB_USER` | `postgres` | Local database user |
| `LOCAL_DB_PASSWORD` | `postgres` | Local database password |
| `NEON_DB_HOST` | — | Neon serverless PostgreSQL host |
| `NEON_DB_PORT` | `5432` | Neon port |
| `NEON_DB_NAME` | — | Neon database name |
| `NEON_DB_USER` | — | Neon username |
| `NEON_DB_PASSWORD` | — | Neon password |
| `NEON_DB_SSL` | `true` | Enable SSL for Neon |
| `BYBIT_API_KEY` | — | Default Bybit API key (fallback) |
| `BYBIT_API_SECRET` | — | Default Bybit API secret (fallback) |
| `BYBIT_TESTNET` | `false` | Use Bybit testnet |
| `CLIENT_URL` | `http://localhost:3000` | Allowed CORS origins (comma-separated) |
| `LOG_LEVEL` | `debug` | Logging level |
| `SLACK_WEBHOOK_URL` | — | Slack notification webhook (optional) |
| `SLACK_CHANNEL` | `#algo-trading` | Slack channel (optional) |

### Client Environment (`client/.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5000/api` | Server API base URL |

## Database Setup

### Local PostgreSQL

1. Install PostgreSQL 16+ on your machine
2. Create the database:

```sql
CREATE DATABASE algo_trading_v2;
```

3. The server auto-creates tables on first startup via `schema.ts`

### Neon (Production)

1. Create a Neon account at [neon.tech](https://neon.tech)
2. Create a new project and database
3. Copy connection details to `server/.env` with `DB_ENVIRONMENT=neon`

## Bybit API Keys

### Testnet Keys (Recommended for Development)

1. Go to [Bybit Testnet](https://testnet.bybit.com)
2. Create an account and navigate to API Management
3. Generate a new API key pair with **Unified Trading** permissions
4. Add the keys to your `server/.env` or create a trading account in the app

### Mainnet Keys (Live Trading)

1. Go to [Bybit](https://www.bybit.com)
2. Navigate to API Management
3. Generate keys with **Unified Trading** permissions
4. **Important**: Restrict IP access to your server's IP for security

### Per-Account API Keys

API keys are stored per trading account in the database. Each user can have multiple accounts:

- **Testnet accounts** (`is_test = true`): Use Bybit testnet API keys
- **Mainnet accounts** (`is_test = false`): Use Bybit mainnet API keys
- System-level keys in `.env` are optional fallbacks

## Running the Application

### Development Mode

```bash
# Start both server and client
npm run dev

# Or start individually
npm run dev:server    # Server on port 5000
npm run dev:client    # Client on port 3000
```

### Fixed Ports

| Service | Port | URL |
|---------|------|-----|
| Express Server | 5000 | `http://localhost:5000` |
| Next.js Client | 3000 | `http://localhost:3000` |
| WebSocket | 5000 | `ws://localhost:5000/ws` |
| PostgreSQL | 5432 | `localhost:5432` |

**Important**: Always start the client on port 3000 explicitly. Do not let Next.js auto-increment to 3001.

### Production Build

```bash
# Build both
npm run build

# Build individually
npm run build:server
npm run build:client

# Start server in production
npm start
```

## CORS Configuration

The `CLIENT_URL` environment variable controls allowed CORS origins. For local development:

```
CLIENT_URL=http://localhost:3000,http://localhost:3001
```

For production, set this to your Vercel deployment URL.

## Available NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both server and client in dev mode |
| `npm run dev:server` | Start server only |
| `npm run dev:client` | Start client only |
| `npm run build` | Build both server and client |
| `npm run build:server` | Build server only |
| `npm run build:client` | Build client only |
| `npm start` | Start server in production mode |
| `npm run install:all` | Install all dependencies |
| `npm test` | Run all tests |
| `npm run test:server` | Run server tests only |
| `npm run test:client` | Run client tests only |
| `npm run type-check` | TypeScript type checking |
| `npm run lint` | Run linting |
| `npm run clean` | Clean build artifacts |

## Common Issues

See [Troubleshooting](./TROUBLESHOOTING.md) for solutions to common setup problems.
