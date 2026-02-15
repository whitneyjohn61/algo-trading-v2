<!-- title: Troubleshooting | category: User Guide -->

# Troubleshooting

Common issues, their causes, and solutions for Algo Trading V2.

## Connection Issues

### Server Won't Start

**Symptom**: `Error: listen EADDRINUSE :::5000`

**Cause**: Another process is using port 5000.

**Fix**:
```powershell
# Find the process
netstat -ano | Select-String ":5000"

# Kill it
Stop-Process -Id <PID> -Force

# Restart server
npm run dev:server
```

### Client Won't Start on Port 3000

**Symptom**: Next.js auto-increments to port 3001 or 3002.

**Cause**: Port 3000 is occupied by another process.

**Fix**:
```powershell
# Find and kill the process on port 3000
netstat -ano | Select-String ":3000"
Stop-Process -Id <PID> -Force

# Start client explicitly on port 3000
npx next dev -p 3000
```

**Important**: Always use `-p 3000` to ensure the client starts on the correct port. The server's CORS configuration expects the client on port 3000.

### WebSocket Connection Failed

**Symptom**: "Disconnected" status in the header chip.

**Causes**:
- Server is not running
- Server crashed and needs restart
- Network interruption

**Fix**:
1. Check server is running on port 5000
2. Check browser console for WebSocket errors
3. The client auto-reconnects — wait 5-10 seconds
4. If persistent, restart the server

### CORS Errors

**Symptom**: `Access-Control-Allow-Origin` errors in browser console.

**Cause**: Client URL not in the server's allowed origins.

**Fix**: Update `CLIENT_URL` in `server/.env`:
```
CLIENT_URL=http://localhost:3000,http://localhost:3001
```

Restart the server after changing this value.

## Authentication Issues

### "Invalid Credentials" on Login

**Causes**:
- Wrong username or password
- User account is deactivated

**Fix**:
1. Verify credentials are correct
2. Check if the user exists in the database
3. An admin can reset the password from the Users tab

### "Session Expired" Redirect

**Symptom**: Suddenly redirected to login page with "Session expired" toast.

**Cause**: JWT token has expired (tokens last 7 days) or was invalidated.

**Fix**: Simply log in again. If happening frequently, check:
- Server clock is correct
- `JWT_SECRET` hasn't changed between server restarts

## Database Issues

### "Password Authentication Failed"

**Symptom**: Server crashes with database connection error.

**Cause**: Wrong database password in `.env`.

**Fix**: Check `LOCAL_DB_PASSWORD` in `server/.env` matches your PostgreSQL password:
```
LOCAL_DB_PASSWORD=your-actual-password
```

### "Database Does Not Exist"

**Symptom**: `error: database "algo_trading_v2" does not exist`

**Fix**: Create the database:
```sql
psql -U postgres -c "CREATE DATABASE algo_trading_v2;"
```

### Tables Not Created

**Symptom**: Queries fail with "relation does not exist".

**Cause**: Schema initialization didn't run.

**Fix**: The server auto-creates tables on startup. Restart the server, or run:
```bash
npx ts-node scripts/setup/init-database.ts
```

## Exchange Issues

### Bybit API Key Errors

**Symptom**: "Invalid API key" or "Permission denied" errors.

**Causes**:
- API key is invalid or expired
- API key lacks required permissions
- Using testnet keys on mainnet (or vice versa)

**Fix**:
1. Verify the API key in Bybit dashboard
2. Ensure key has **Unified Trading** permissions
3. Check `is_test` flag matches the key type (testnet vs mainnet)
4. Generate a new key if the old one is compromised

### Balance Shows 0

**Symptom**: Portfolio equity shows $0 despite having funds.

**Causes**:
- No trading account selected
- API key doesn't have read permissions
- Wrong account type (testnet vs mainnet)

**Fix**:
1. Select a trading account from the Accounts tab
2. Verify the account's API key is valid (use the Verify button)
3. Ensure the account type matches where your funds are

### Geo-Location Block

**Symptom**: "Trading restricted in your region" error.

**Cause**: The server detected it's running in a jurisdiction where Bybit is restricted.

**Fix**:
- Check the Geo-Location chip in the header for current status
- If using a VPN, ensure it's connected to an allowed region
- The geo-check runs on the server, not the client

## Chart Issues

### Chart Shows No Data

**Symptom**: Blank chart area with no candles.

**Causes**:
- No symbol selected
- Bybit API rate limit hit
- Network connectivity issue

**Fix**:
1. Select a symbol from the chart controls
2. Wait a moment and retry — rate limits reset quickly
3. Check browser console for API errors

### Chart Crashes with TypeError

**Symptom**: Chart area shows error overlay.

**Cause**: Race condition during rapid symbol/interval switching.

**Fix**: This is handled internally with null checks. If it persists:
1. Switch to a different tab and back
2. Refresh the page

## Strategy Issues

### Strategy Stuck in "Paused"

**Causes**:
- Circuit breaker triggered
- Manually paused by user
- Strategy error during execution

**Fix**:
1. Check circuit breaker status on the Portfolio dashboard
2. If CB triggered, wait for auto-resume or force-resume
3. If manually paused, resume from the Strategies tab
4. Check server logs for strategy execution errors

### No Trades Being Placed

**Causes**:
- All strategies paused
- No trading account selected
- Market conditions don't match entry criteria
- Insufficient balance

**Fix**:
1. Verify at least one strategy is in "Running" state
2. Confirm a trading account is selected and active
3. Check strategy logs for signal generation
4. Verify account balance covers the intended position size

## Backtest Issues

### Backtest Returns No Results

**Cause**: Insufficient candle data for the selected date range.

**Fix**: Ensure the date range has at least 100 candles of data available on Bybit for the selected symbol and interval.

### Backtest Takes Too Long

**Cause**: Very long date range or short interval (e.g., 1-minute candles over 1 year).

**Fix**: Use a longer interval (4H, 1D) for extended backtests, or reduce the date range.

## Performance Issues

### Server Memory Usage High

**Cause**: Large in-memory candle cache.

**Fix**: Restart the server to clear the cache. The candle service fetches data on demand and caches it in memory.

### Client Slow / Laggy

**Causes**:
- Too many open positions being polled
- Chart with many indicators
- Browser dev tools open with verbose logging

**Fix**:
1. Close browser dev tools
2. Reduce the number of displayed indicators
3. Clear browser cache and reload

## Getting Help

If none of the above solutions work:

1. Check the server logs (terminal output) for error details
2. Check the browser console for client-side errors
3. Verify all environment variables are correctly set
4. Ensure PostgreSQL is running and accessible
5. Try a clean restart: stop server, stop client, restart both
