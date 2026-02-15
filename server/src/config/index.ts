import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface Config {
  nodeEnv: string;
  port: number;
  jwtSecret: string;
  clientUrl: string;
  logLevel: string;
  db: {
    environment: string;
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
  };
  bybit: {
    apiKey: string;
    apiSecret: string;
    testnet: boolean;
  };
  slack: {
    webhookUrl: string;
    channel: string;
  };
  ml: {
    serviceUrl: string;
    enabled: boolean;
  };
}

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number, got: ${value}`);
  }
  return parsed;
}

function getEnvBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
}

function buildDbConfig(): Config['db'] {
  const environment = getEnv('DB_ENVIRONMENT', 'local');
  const isNeon = environment === 'neon';
  const prefix = isNeon ? 'NEON_DB' : 'LOCAL_DB';

  return {
    environment,
    host: getEnv(`${prefix}_HOST`, 'localhost'),
    port: getEnvInt(`${prefix}_PORT`, 5432),
    name: getEnv(`${prefix}_NAME`, 'algo_trading_v2'),
    user: getEnv(`${prefix}_USER`, 'postgres'),
    password: getEnv(`${prefix}_PASSWORD`, 'postgres'),
    ssl: isNeon ? getEnvBool('NEON_DB_SSL', true) : false,
  };
}

export const config: Config = {
  nodeEnv: getEnv('NODE_ENV', 'development'),
  port: getEnvInt('PORT', 5000),
  jwtSecret: getEnv('JWT_SECRET', 'dev-secret-change-in-production'),
  clientUrl: getEnv('CLIENT_URL', 'http://localhost:3000'),
  logLevel: getEnv('LOG_LEVEL', 'debug'),
  db: buildDbConfig(),
  bybit: {
    apiKey: getEnv('BYBIT_API_KEY', ''),
    apiSecret: getEnv('BYBIT_API_SECRET', ''),
    testnet: getEnvBool('BYBIT_TESTNET', false),
  },
  slack: {
    webhookUrl: getEnv('SLACK_WEBHOOK_URL', ''),
    channel: getEnv('SLACK_CHANNEL', '#algo-trading'),
  },
  ml: {
    serviceUrl: getEnv('ML_SERVICE_URL', 'http://localhost:8080'),
    enabled: getEnvBool('ML_SERVICE_ENABLED', false),
  },
};

export default config;
