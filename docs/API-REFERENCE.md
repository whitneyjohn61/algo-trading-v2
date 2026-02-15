<!-- title: API Reference | category: Developer -->

# API Reference

Complete reference for all REST API endpoints in Algo Trading V2.

## Base URL

- **Local**: `http://localhost:5000/api`
- **Production**: `https://your-do-app.ondigitalocean.app/api`

## Authentication

Most endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Account-scoped endpoints also require the trading account ID:

```
X-Trading-Account-Id: <account_id>
```

### Middleware Applied

| Middleware | Description |
|-----------|-------------|
| `authenticateToken` | Validates JWT, attaches `req.user` |
| `geoBlock` | Blocks requests from restricted jurisdictions |
| `resolveAccount` | Extracts trading account from header |

---

## Health Check

### `GET /api/health`

Public endpoint for monitoring. Used by DigitalOcean health checks.

**Auth**: None

**Response** `200`:
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "uptime": 86400,
  "environment": "production",
  "version": "2.0.0"
}
```

---

## Auth Routes (`/api/auth`)

### `POST /api/auth/login`

Authenticate user and receive JWT token.

**Auth**: None

**Body**:
```json
{
  "username": "string",
  "password": "string"
}
```

**Response** `200`:
```json
{
  "token": "eyJhbGciOiJ...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "timezone": "UTC",
    "avatar_path": null
  }
}
```

**Errors**: `401` Invalid credentials, `400` Missing fields

### `POST /api/auth/register`

Register a new user account.

**Auth**: None

**Body**:
```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

### `GET /api/auth/me`

Get the current authenticated user.

**Auth**: Required

**Response** `200`: User object

### `POST /api/auth/logout`

Logout (client-side token removal).

**Auth**: None

---

## User Routes (`/api/users`)

All require authentication.

### `GET /api/users`

List users. Non-admin users see limited results.

**Query**: `?limit=20&offset=0&includeInactive=false`

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "users": [...],
    "total": 5
  }
}
```

### `GET /api/users/:id`

Get user details.

### `POST /api/users`

Create user (admin only).

**Body**:
```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "role": "user|admin",
  "first_name": "string",
  "last_name": "string",
  "phone": "string",
  "timezone": "UTC"
}
```

### `PUT /api/users/:id`

Update user. Users can edit themselves; admins can edit anyone.

### `POST /api/users/:id/change-password`

**Body**:
```json
{
  "currentPassword": "string",
  "newPassword": "string"
}
```

### `POST /api/users/:id/deactivate`

Soft-delete user (admin only).

### `DELETE /api/users/:id`

Hard-delete user (admin only).

---

## Account Routes (`/api/accounts`)

All require authentication.

### `GET /api/accounts`

List trading accounts. Admin sees all; users see their own.

**Query**: `?includeInactive=false`

**Response** `200`:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "exchange": "bybit",
      "api_key": "****xxxx",
      "is_test": true,
      "is_active": true,
      "current_balance": 10000,
      "created_at": "..."
    }
  ],
  "total": 1
}
```

API keys are masked in list view for security.

### `GET /api/accounts/:id`

Get full account details (includes unmasked keys for editing).

### `POST /api/accounts`

Create trading account.

**Body**:
```json
{
  "exchange": "bybit",
  "api_key": "string",
  "api_secret": "string",
  "is_test": true,
  "user_id": 1
}
```

### `PUT /api/accounts/:id`

Update account. Updatable fields: `exchange`, `api_key`, `api_secret`, `is_test`, `is_active`, `params`, `current_balance`.

### `DELETE /api/accounts/:id`

Soft-delete (deactivate) account.

### `POST /api/accounts/verify`

Verify API key credentials against Bybit.

**Body**:
```json
{
  "exchange": "bybit",
  "api_key": "string",
  "api_secret": "string",
  "is_test": true
}
```

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "totalBalance": 10000.50
  }
}
```

### `GET /api/accounts/:id/balance`

Get live balance from exchange.

---

## Trading Routes (`/api/trading`)

All require authentication + account context. Geo-blocked.

### `POST /api/trading/trades`

Create a new trade.

**Body**:
```json
{
  "symbol": "BTCUSDT",
  "side": "long|short",
  "quantity": 0.01,
  "orderType": "market|limit",
  "leverage": 3,
  "price": 50000,
  "stopLoss": 48000,
  "takeProfit": 55000,
  "notes": "string"
}
```

### `GET /api/trading/trades`

List trades.

**Query**: `?status=active&symbol=BTCUSDT&strategyName=trend_following&limit=50&offset=0`

### `GET /api/trading/trades/:id`

Get trade details with orders.

### `PUT /api/trading/trades/:id`

Update trade SL/TP.

**Body**:
```json
{
  "stopLoss": 47000,
  "takeProfit": 56000
}
```

### `POST /api/trading/trades/:id/close`

Close trade (full or partial).

**Body** (optional):
```json
{
  "quantity": 0.005
}
```

### `DELETE /api/trading/orders/:id`

Cancel an order.

**Query**: `?symbol=BTCUSDT` (required)

### `GET /api/trading/positions`

Get open positions from exchange.

**Query**: `?symbol=BTCUSDT` (optional)

### `GET /api/trading/balance`

Get account balance from exchange.

---

## Strategy Routes (`/api/strategies`)

All require authentication + account context. Geo-blocked.

### `GET /api/strategies`

List all strategies with their current status.

**Response** `200`:
```json
{
  "success": true,
  "data": [
    {
      "id": "trend_following",
      "name": "Multi-Timeframe Trend Following",
      "category": "trend_following",
      "capitalAllocationPercent": 30,
      "maxLeverage": 3,
      "status": "running",
      "symbols": ["BTCUSDT", "ETHUSDT", "..."]
    }
  ]
}
```

### `GET /api/strategies/:id/state`

Get detailed state for a single strategy.

### `PUT /api/strategies/:id/config`

Update strategy configuration.

**Body**:
```json
{
  "params": { "emaPeriodFast": 9, "emaPeriodSlow": 21 },
  "symbols": ["BTCUSDT", "ETHUSDT"],
  "capitalAllocationPercent": 30,
  "maxLeverage": 3
}
```

### `POST /api/strategies/:id/pause`

Pause a strategy.

### `POST /api/strategies/:id/resume`

Resume a paused strategy.

---

## Portfolio Routes (`/api/portfolio`)

All require authentication + account context. Geo-blocked.

### `GET /api/portfolio/summary`

Full portfolio summary.

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "totalEquity": 52340.50,
    "availableBalance": 35000.00,
    "unrealizedPnl": 1240.50,
    "realizedPnlToday": 340.00,
    "peakEquity": 53000.00,
    "drawdownPct": 1.24,
    "positionCount": 3,
    "positions": [...],
    "strategyAllocations": [...]
  }
}
```

### `GET /api/portfolio/equity-curve`

Historical equity data points.

**Query**: `?from=1704067200000&to=1706745600000&limit=500`

### `GET /api/portfolio/performance`

Aggregate performance metrics.

**Query**: `?period=month&from=...&to=...`

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "returnPct": 8.5,
    "sharpeRatio": 1.8,
    "maxDrawdown": 5.2,
    "totalPnl": 4250.00,
    "dataPoints": 8640
  }
}
```

### `GET /api/portfolio/performance/:strategyId`

Per-strategy performance metrics.

### `GET /api/portfolio/circuit-breaker`

Circuit breaker status.

### `POST /api/portfolio/circuit-breaker/resume`

Force-resume circuit breaker.

**Body** (optional):
```json
{
  "strategyId": "trend_following"
}
```

---

## Backtest Routes (`/api/backtest`)

All require authentication. Geo-blocked.

### `GET /api/backtest/strategies`

List strategies available for backtesting.

### `POST /api/backtest/run`

Run a single-strategy backtest.

**Body**:
```json
{
  "strategyId": "trend_following",
  "symbol": "BTCUSDT",
  "interval": "240",
  "startTime": 1704067200000,
  "endTime": 1735689600000,
  "initialBalance": 10000,
  "leverage": 3,
  "takerFeeRate": 0.0006,
  "slippageRate": 0.0005,
  "paramOverrides": {},
  "saveToDb": true
}
```

### `POST /api/backtest/portfolio-run`

Run a multi-strategy portfolio backtest.

**Body**:
```json
{
  "strategyIds": ["trend_following", "mean_reversion"],
  "symbol": "BTCUSDT",
  "interval": "240",
  "startTime": 1704067200000,
  "endTime": 1735689600000,
  "initialBalance": 50000,
  "leverage": 3,
  "saveToDb": true
}
```

### `GET /api/backtest/runs`

List saved backtest runs.

**Query**: `?strategy=trend_following&symbol=BTCUSDT&limit=20&offset=0`

### `GET /api/backtest/runs/:id`

Get run details including all trades.

### `DELETE /api/backtest/runs/:id`

Delete a saved run.

---

## Market Routes (`/api/market`)

All public (no auth required). Geo-blocked.

### `GET /api/market/candles/:symbol`

Get candle data.

**Query**: `?interval=240&limit=200&startTime=...&endTime=...`

### `GET /api/market/ticker/:symbol`

Get current ticker data.

### `GET /api/market/funding-rates`

Get funding rates for top 50 symbols.

### `GET /api/market/funding-history/:symbol`

Get funding rate history.

**Query**: `?limit=50`

### `GET /api/market/open-interest/:symbol`

Get open interest data.

### `GET /api/market/symbols`

Get all active symbols.

### `GET /api/market/symbols/:symbol`

Get info for a specific symbol.

### `GET /api/market/intervals`

Get supported candle intervals.

---

## Geo Routes (`/api/geo`)

Public (no auth, no geo-block).

### `GET /api/geo/status`

Get server geo-location and restriction status.

**Response** `200`:
```json
{
  "location": {
    "country": "United States",
    "countryCode": "US",
    "region": "CA",
    "city": "San Francisco",
    "timezone": "America/Los_Angeles",
    "ip": "1.2.3.4",
    "source": "ipapi"
  },
  "isRestricted": false,
  "detectedAt": "2025-01-15T10:00:00.000Z"
}
```

### `POST /api/geo/refresh`

Force a fresh geo-location detection.

---

## System Routes (`/api/system`)

### `GET /api/system/health`

Detailed system health (auth required).

### `GET /api/system/notifications/status`

Check Slack notification configuration (auth required).

### `POST /api/system/notifications/test`

Send a test Slack notification (auth required).

### `POST /api/system/check-exchange`

Test exchange API connectivity for all active trading accounts (auth required).

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "accounts": [
      { "accountId": 1, "status": "ok", "serverTime": 1707900000000 },
      { "accountId": 2, "status": "error", "error": "Invalid API key" }
    ],
    "total": 2
  }
}
```

### `GET /api/system/check-database`

Test database connection and return table row counts (auth required).

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "status": "connected",
    "latencyMs": 12,
    "tables": {
      "users": 5,
      "trading_accounts": 3,
      "trades": 142,
      "portfolio_snapshots": 500,
      "backtest_runs": 20
    }
  }
}
```

### `POST /api/system/force-snapshot`

Trigger equity snapshots for all active accounts (auth required).

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "snapshots": [
      { "accountId": 1, "status": "ok", "equity": 10500.50 }
    ],
    "total": 1
  }
}
```

### `GET /api/system/funding-rates`

Get top 20 funding rates sorted by absolute magnitude (auth required).

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "rates": [
      { "symbol": "BTCUSDT", "fundingRate": 0.0001, "nextFundingTime": 1707900000000 }
    ],
    "fetched": 20
  }
}
```

### `POST /api/system/clear-cache`

Clear the candle data cache (auth required).

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "before": { "size": 45, "maxSize": 500, "ttlMs": 60000 },
    "after": { "size": 0, "maxSize": 500, "ttlMs": 60000 }
  }
}
```

### `GET /api/system/ws-clients`

Get WebSocket client connection details (auth required).

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "total": 2,
    "clients": [
      { "userId": 1, "tradingAccountId": 1, "subscriptions": ["trades", "portfolio"], "isAlive": true }
    ]
  }
}
```

### `GET /api/system/logs`

Get recent server log entries (auth required).

**Query params**: `limit` (number, default 50, max 200), `level` (string: debug|info|warn|error).

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "logs": [
      { "level": "info", "message": "Server started", "timestamp": "2025-02-14T10:00:00.000Z", "source": "App" }
    ],
    "total": 50
  }
}
```

### `GET /api/system/rate-limit`

Get rate limit configuration and current status (auth required).

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "windowMs": 900000,
    "maxRequests": 200,
    "windowMinutes": 15,
    "remaining": 180,
    "limit": 200,
    "resetAt": "2025-02-14T10:15:00.000Z"
  }
}
```

### `GET /api/system/strategy-health`

Get per-account strategy initialization status (auth required).

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "accounts": [
      {
        "accountId": 1,
        "strategies": {
          "sma-crossover": { "config": {}, "state": {}, "paused": false }
        }
      }
    ],
    "totalAccounts": 1
  }
}
```

---

## Docs Routes (`/api/docs`)

Public (no auth required).

### `GET /api/docs`

List available documentation topics.

**Response** `200`:
```json
{
  "success": true,
  "data": [
    {
      "slug": "SETUP",
      "title": "Setup Guide",
      "category": "Developer"
    }
  ]
}
```

### `GET /api/docs/:slug`

Get documentation content by slug.

**Response** `200`:
```json
{
  "success": true,
  "data": {
    "slug": "SETUP",
    "title": "Setup Guide",
    "category": "Developer",
    "content": "# Setup Guide\n\n..."
  }
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message description"
}
```

### Common Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `400` | Bad request (missing or invalid parameters) |
| `401` | Unauthorized (missing or invalid token) |
| `403` | Forbidden (insufficient permissions or geo-blocked) |
| `404` | Not found |
| `429` | Rate limited (200 requests per 15 minutes) |
| `500` | Internal server error |

## WebSocket API

See [Architecture](./ARCHITECTURE.md#websocket-events) for WebSocket event documentation.
