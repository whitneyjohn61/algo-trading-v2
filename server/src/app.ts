import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import authRoutes from './routes/auth';
import systemRoutes from './routes/system';
import tradingRoutes from './routes/trading';
import marketRoutes from './routes/market';
import strategyRoutes from './routes/strategies';
import portfolioRoutes from './routes/portfolio';
import geoRoutes from './routes/geo';
import backtestRoutes from './routes/backtest';
import accountRoutes from './routes/accounts';
import userRoutes from './routes/users';
import docsRoutes from './routes/docs';
import { geoBlock } from './middleware/geoBlock';

const app = express();

// Security middleware
app.use(helmet());

// CORS
const corsOrigins = config.clientUrl.split(',').map(url => url.trim());
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Trading-Account-Id'],
}));

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check (public — used by DigitalOcean)
app.get('/api/health', async (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    version: '2.0.0',
  });
});

// Routes — non-exchange (always available)
app.use('/api/auth', authRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/geo', geoRoutes);         // Public — no auth, no geo-block
app.use('/api/users', userRoutes);
app.use('/api/docs', docsRoutes);      // Public — documentation

// Routes — exchange-facing (blocked when geo-restricted)
app.use('/api/trading', geoBlock, tradingRoutes);
app.use('/api/market', geoBlock, marketRoutes);
app.use('/api/strategies', geoBlock, strategyRoutes);
app.use('/api/portfolio', geoBlock, portfolioRoutes);
app.use('/api/backtest', geoBlock, backtestRoutes);
app.use('/api/accounts', accountRoutes);  // Auth required but no geo-block (account management is always available)

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({
    error: config.nodeEnv === 'production' ? 'Internal server error' : err.message,
  });
});

export default app;
