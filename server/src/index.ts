import http from 'http';
import app from './app';
import { config } from './config';
import databaseService from './services/database/connection';
import { initializeSchema } from './services/database/schema';
import notificationService from './services/monitoring/notificationService';
import systemMonitor from './services/monitoring/systemMonitor';
import wsBroadcaster from './websocket/server';
import exchangeManager from './services/exchange/exchangeManager';
import portfolioManager from './services/portfolio/portfolioManager';
import equityTracker from './services/portfolio/equityTracker';
import circuitBreaker from './services/portfolio/circuitBreaker';
import geoLocationService from './services/geo/geoLocationService';

// ============================================================
// Process-level error handlers (must be registered first)
// ============================================================

process.on('unhandledRejection', (reason: unknown) => {
  try {
    console.error('[Process] Unhandled promise rejection:', reason);
  } catch (_) { /* no-op */ }
  // Do NOT crash — keep server running
});

process.on('uncaughtException', (error: Error) => {
  try {
    console.error('[Process] Uncaught exception:', error.message);
    console.error('[Process] Stack:', error.stack);
    notificationService.sendErrorAlert('Process', `Uncaught exception: ${error.message}`);
  } catch (_) {
    console.error('[Process] Uncaught exception (logger failed):', error);
  }
  // Exit — state may be corrupt, let orchestrator restart
  process.exit(1);
});

// ============================================================
// Server startup
// ============================================================

const isDev = config.nodeEnv === 'development';
let portRetryAttempt = 0;
const MAX_PORT_RETRIES = 2;

async function start(): Promise<void> {
  try {
    console.log('='.repeat(60));
    console.log('[Server] Algo Trading V2 starting...');
    console.log(`[Server] Environment: ${config.nodeEnv}`);
    console.log(`[Server] Node: ${process.version} | Platform: ${process.platform}`);
    console.log('='.repeat(60));

    // ── Step 1-2: Logger already initialized via import ──

    // ── Step 3: Initialize notifications (non-blocking) ──
    notificationService.initialize();

    // ── Step 4: Connect database + schema ──
    let dbConnected = false;
    try {
      await databaseService.connect();
      await initializeSchema();
      dbConnected = true;
    } catch (dbError: any) {
      console.error('[Server] Database connection failed:', dbError.message);
      console.log('[Server] Continuing without database (limited functionality)');
    }

    // ── Step 5: Geo-location detection (critical — blocks exchange if restricted) ──
    let geoRestricted = false;
    try {
      const location = await geoLocationService.detectLocation();
      geoRestricted = location.isRestricted;
      console.log(`[Server] Geo-location: ${location.city}, ${location.region}, ${location.country} (${location.countryCode})`);
      console.log(`[Server] Geo source: ${location.source} | IP: ${location.ip}`);
      if (geoRestricted) {
        console.warn('─'.repeat(60));
        console.warn(`[Server] *** RESTRICTED REGION DETECTED: ${location.country} (${location.countryCode}) ***`);
        console.warn('[Server] *** All exchange API calls will be BLOCKED ***');
        console.warn('─'.repeat(60));
      } else {
        console.log('[Server] Geo-location: region is NOT restricted — exchange access allowed');
      }
    } catch (geoErr: any) {
      console.warn('[Server] Geo-location detection failed:', geoErr.message);
      console.warn('[Server] Defaulting to unrestricted — exchange access allowed');
    }

    // ── Step 6: Bybit REST adapter (deferred — initialized on first use) ──
    const bybitConfigured = !!(config.bybit.apiKey && config.bybit.apiSecret);
    if (geoRestricted) {
      console.warn('[Server] Exchange features DISABLED due to geo-restriction');
    } else if (bybitConfigured) {
      console.log('[Server] Bybit API keys configured');
      systemMonitor.setExchangeHealth(true);
    } else {
      console.log('[Server] Bybit API keys not configured — exchange features disabled');
    }

    // ── Step 6: Create HTTP server ──
    const server = http.createServer(app);

    // EADDRINUSE handling
    server.on('error', async (err: any) => {
      if (err?.code === 'EADDRINUSE') {
        console.error(`[Server] Port ${config.port} is already in use`);

        if (isDev && portRetryAttempt < MAX_PORT_RETRIES) {
          portRetryAttempt++;
          console.log(`[Server] Dev mode: attempting to free port (attempt ${portRetryAttempt}/${MAX_PORT_RETRIES})...`);
          try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);

            if (process.platform === 'win32') {
              const { stdout } = await execAsync(`netstat -ano | findstr :${config.port}`);
              const pids = new Set<string>();
              for (const line of stdout.trim().split('\n')) {
                const match = line.match(/LISTENING\s+(\d+)/);
                if (match?.[1]) pids.add(match[1]);
              }
              for (const pid of pids) {
                await execAsync(`taskkill /F /PID ${pid}`);
              }
            } else {
              await execAsync(`fuser -k ${config.port}/tcp`).catch(() => {});
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log('[Server] Retrying...');
            server.listen(config.port);
            return;
          } catch (_e) {
            console.error('[Server] Failed to free port');
          }
        } else if (!isDev) {
          console.error('[Server] CRITICAL: Port conflict in production — exiting');
        }
        process.exit(1);
      } else {
        console.error('[Server] Server error:', err);
        process.exit(1);
      }
    });

    // ── Step 7: Initialize client WebSocket ──
    wsBroadcaster.initialize(server);
    systemMonitor.setWebSocketHealth(true);

    // ── Steps 8-9: Bybit WebSocket (placeholder — fully wired in Phase 4) ──
    // TODO: Initialize bybitWebSocket.initialize() + subscribePrivateChannels()

    // ── Steps 10-12: Exchange adapters + Portfolio services ──
    let activeAccountCount = 0;
    if (dbConnected && !geoRestricted) {
      try {
        // Pre-warm exchange adapters for all active trading accounts
        const activeIds = await exchangeManager.initializeAllActive();
        activeAccountCount = activeIds.length;

        // Initialize portfolio state for each active account
        for (const accountId of activeIds) {
          await portfolioManager.initializeFromDb(accountId);
        }

        // Start background monitoring (operates across all active accounts)
        if (activeAccountCount > 0) {
          equityTracker.start();
          circuitBreaker.start();
        }

        console.log(`[Server] Portfolio services started for ${activeAccountCount} accounts`);
      } catch (err: any) {
        console.error(`[Server] Portfolio services failed to start: ${err.message}`);
      }
    } else if (geoRestricted && dbConnected) {
      console.warn('[Server] Exchange + Portfolio services skipped (geo-restricted region)');
    }

    // ── Step 13: System monitoring is passive (always running via systemMonitor) ──

    // ── Step 16: Start listening ──
    server.listen(config.port, () => {
      console.log('─'.repeat(60));
      console.log(`[Server] Listening on port ${config.port}`);
      console.log(`[Server] Health:    http://localhost:${config.port}/api/health`);
      console.log(`[Server] System:    http://localhost:${config.port}/api/system/health`);
      console.log(`[Server] WebSocket: ws://localhost:${config.port}/ws`);
      console.log('─'.repeat(60));

      // ── Step 14: Initialization summary ──
      logInitSummary(dbConnected, bybitConfigured, activeAccountCount, geoRestricted);

      // ── Step 15: Slack startup notification ──
      notificationService.sendSystemAlert(
        `Server started (${config.nodeEnv}, port ${config.port})`
      );

      // ── DB Keepalive (Neon cold-start prevention) ──
      if (dbConnected) {
        const keepaliveMs = Math.max(30000, parseInt(process.env['DB_KEEPALIVE_MS'] || '60000'));
        setInterval(async () => {
          try { await databaseService.testConnection(); } catch (_) { /* silent */ }
        }, keepaliveMs);
        console.log(`[Server] DB keepalive started (${keepaliveMs / 1000}s interval)`);
      }
    });

    // ── Graceful shutdown ──
    const shutdown = async (signal: string): Promise<void> => {
      console.log(`\n[Server] ${signal} received — shutting down gracefully...`);

      // Step 1: Notify
      notificationService.sendSystemAlert(`Server shutting down (${signal})`, 'warning');

      // Step 2: Stop portfolio services
      circuitBreaker.stop();
      equityTracker.stop();

      // Step 3-4: Close WebSockets
      wsBroadcaster.close();
      // TODO: bybitWebSocket.close();

      // Step 5: Stop accepting connections
      server.close(() => {
        console.log('[Server] HTTP server closed');
      });

      // Step 6: Disconnect database
      try { await databaseService.disconnect(); } catch (_) { /* ignore */ }

      // Step 7: Force exit after 10s
      setTimeout(() => {
        console.error('[Server] Forced shutdown after 10s timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

function logInitSummary(dbConnected: boolean, bybitConfigured: boolean, activeAccounts: number, geoRestricted: boolean): void {
  const acctStr = `${activeAccounts} account${activeAccounts !== 1 ? 's' : ''}`;
  const geoLocation = geoLocationService.getLocation();
  const geoRegion = geoLocation ? `${geoLocation.country} (${geoLocation.countryCode})` : 'Unknown';
  console.log('');
  console.log('┌─────────────────────────────────────────────┐');
  console.log('│          INITIALIZATION SUMMARY              │');
  console.log('├─────────────────────────────────────────────┤');
  console.log(`│  Database:      ${dbConnected ? 'Connected' : 'Disconnected'}${' '.repeat(dbConnected ? 20 : 17)}│`);
  console.log(`│  Geo Region:    ${geoRegion}${' '.repeat(Math.max(1, 28 - geoRegion.length))}│`);
  console.log(`│  Exchange:      ${geoRestricted ? 'BLOCKED (geo)' : bybitConfigured ? 'System adapter ready' : 'No system adapter'}${' '.repeat(geoRestricted ? 15 : bybitConfigured ? 8 : 11)}│`);
  console.log(`│  Accounts:      ${acctStr}${' '.repeat(Math.max(1, 28 - acctStr.length))}│`);
  console.log(`│  WebSocket:     ${'Connected'}${' '.repeat(20)}│`);
  console.log(`│  Portfolio:     ${activeAccounts > 0 ? 'Active' : 'No accounts'}${' '.repeat(activeAccounts > 0 ? 22 : 17)}│`);
  console.log(`│  Notifications: ${notificationService.isEnabled() ? 'Slack enabled' : 'Disabled'}${' '.repeat(notificationService.isEnabled() ? 15 : 20)}│`);
  console.log(`│  ML Service:    ${'Not configured'}${' '.repeat(14)}│`);
  const overall = geoRestricted ? 'GEO-BLOCKED' : dbConnected ? 'READY' : 'LIMITED';
  console.log('├─────────────────────────────────────────────┤');
  console.log(`│  Status: ${overall}${' '.repeat(Math.max(1, 33 - (overall.length - 5)))}│`);
  console.log('└─────────────────────────────────────────────┘');
  console.log('');
}

start();
