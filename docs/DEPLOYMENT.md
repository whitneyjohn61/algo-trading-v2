<!-- title: Deployment | category: Developer -->

# Deployment

Guide for deploying Algo Trading V2 to production using DigitalOcean (server), Vercel (client), and Neon (database).

## Architecture

```
[Vercel] ← Client (Next.js)
    ↓ API calls
[DigitalOcean App Platform] ← Server (Express + WebSocket)
    ↓ SQL queries
[Neon] ← PostgreSQL database
    ↓ REST + WebSocket
[Bybit] ← Exchange API
```

## Prerequisites

- GitHub repository with the codebase
- DigitalOcean account
- Vercel account
- Neon account (or existing Neon project)
- Bybit API keys (mainnet)

## 1. Database (Neon)

### Option A: New Database in Existing Project

1. Go to Neon dashboard → your project → SQL Editor
2. Run: `CREATE DATABASE algo_trading_v2;`
3. The server will auto-create tables on first startup

### Option B: Reuse Existing Database

1. Drop old tables if migrating from V1
2. The server creates all tables on startup via `schema.ts`

### Connection Details

Copy from Neon dashboard:
- Host: `ep-xxxxx.us-east-2.aws.neon.tech`
- Database name: `algo_trading_v2`
- User: your Neon username
- Password: your Neon password
- SSL: Required (`true`)

## 2. Server (DigitalOcean App Platform)

### Create or Update App

1. Go to DigitalOcean dashboard → Apps
2. Create new app (or update existing)
3. Connect GitHub repository: `algo-trading-v2`
4. Set source directory: `/server`

### Build Settings

| Setting | Value |
|---------|-------|
| Build Command | `npm install && npm run build` |
| Run Command | `node dist/index.js` |
| HTTP Port | `5000` |
| Node.js Version | `22` |

### Environment Variables

Set these in the DO app settings:

```
NODE_ENV=production
PORT=5000
JWT_SECRET=<generate-a-strong-random-string>
DB_ENVIRONMENT=neon
NEON_DB_HOST=<your-neon-host>
NEON_DB_PORT=5432
NEON_DB_NAME=algo_trading_v2
NEON_DB_USER=<your-neon-user>
NEON_DB_PASSWORD=<your-neon-password>
NEON_DB_SSL=true
CLIENT_URL=https://your-app.vercel.app
LOG_LEVEL=info
```

Optional:
```
SLACK_WEBHOOK_URL=<your-slack-webhook>
SLACK_CHANNEL=#algo-trading
```

### Health Check

Configure DO health check to ping: `GET /api/health`

This endpoint returns:
```json
{
  "status": "ok",
  "timestamp": "...",
  "uptime": 12345,
  "environment": "production",
  "version": "2.0.0"
}
```

## 3. Client (Vercel)

### Create or Update Project

1. Go to Vercel dashboard → Projects
2. Import or reconnect GitHub repository: `algo-trading-v2`
3. Set root directory: `client/`

### Build Settings

| Setting | Value |
|---------|-------|
| Framework | Next.js |
| Root Directory | `client` |
| Build Command | `npm run build` |
| Output Directory | `.next` |

### Environment Variables

```
NEXT_PUBLIC_API_URL=https://your-do-app.ondigitalocean.app/api
```

### Deploy

Vercel auto-deploys on push to `main`. Verify the deployment URL matches the `CLIENT_URL` set in the DO server.

## 4. Bybit API Keys

### Rotate Keys (Recommended)

After deployment, generate fresh API keys:

1. Log in to [Bybit](https://www.bybit.com)
2. Navigate to API Management
3. Create new API key with **Unified Trading** permissions
4. **Restrict IP access** to your DigitalOcean server IP
5. Update keys in DO environment variables
6. Delete old keys

### Key Requirements

- **Unified Trading** permission (required for perpetual futures)
- **Read** permission (for balance and position queries)
- **Trade** permission (for order placement)
- IP restriction recommended for production

## 5. Go-Live Sequence

### Pre-Launch Checklist

- [ ] Database created and accessible from DO
- [ ] Server deployed and health check passing
- [ ] Client deployed and loading correctly
- [ ] API URL correctly configured in client env
- [ ] CORS origin correctly configured in server env
- [ ] JWT secret set (not the default)
- [ ] Bybit API keys configured and tested
- [ ] Login works end-to-end

### Launch Steps

1. Deploy server to DO (auto on push to `main`)
2. Deploy client to Vercel (auto on push to `main`)
3. Verify health endpoint: `GET /api/health`
4. Log in to the app
5. Verify exchange connection (balance loads)
6. Start strategies in **testnet mode first**
7. Monitor for 24–48 hours
8. Switch to live trading with small position sizes
9. Scale up over 1–2 weeks as confidence builds

### Post-Launch Monitoring

- Check DO app logs for server errors
- Monitor portfolio dashboard for expected behavior
- Verify WebSocket connection is stable
- Confirm equity snapshots are being recorded
- Watch for circuit breaker triggers

## Updating

### Server Update

Push to `main` → DO auto-redeploys → zero-downtime deployment.

### Client Update

Push to `main` → Vercel auto-redeploys → instant global CDN update.

### Database Migration

If schema changes are needed:
1. Update `schema.ts` with new table definitions
2. The server's `ensureSchema()` creates missing tables on startup
3. For column changes, add migration logic in `schema.ts` or run SQL manually in Neon dashboard

## Rollback

### Server

DO App Platform keeps previous builds. To rollback:
1. Go to DO dashboard → Apps → your app → Activity
2. Click on a previous deployment
3. Click "Rollback to this deployment"

### Client

Vercel keeps previous deployments:
1. Go to Vercel dashboard → Project → Deployments
2. Find the previous working deployment
3. Click "..." → "Promote to Production"
