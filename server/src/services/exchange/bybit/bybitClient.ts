import { RestClientV5, RestClientOptions } from 'bybit-api';

export interface BybitClientConfig {
  apiKey: string;
  apiSecret: string;
  testnet: boolean;
}

export class BybitClient {
  public readonly rest: RestClientV5;
  public readonly testnet: boolean;

  constructor(cfg: BybitClientConfig) {
    this.testnet = cfg.testnet;

    const options: RestClientOptions = {
      key: cfg.apiKey,
      secret: cfg.apiSecret,
      testnet: cfg.testnet,
      recv_window: 10000, // Handle clock drift
      enable_time_sync: true,
      sync_interval_ms: 3600000, // Sync every hour
      strict_param_validation: false, // Avoid issues with optional market order params
    };

    this.rest = new RestClientV5(options);
  }

  // Rate limiting state
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private readonly maxRequestsPerWindow: number = 600;
  private readonly windowMs: number = 5000;

  async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    const minWait = 100;

    if (elapsed < minWait) {
      await new Promise(resolve => setTimeout(resolve, minWait - elapsed));
    }

    if (elapsed >= this.windowMs) {
      this.requestCount = 0;
      this.lastRequestTime = Date.now();
      return;
    }

    if (this.requestCount >= this.maxRequestsPerWindow) {
      const waitTime = Math.max(this.windowMs - elapsed, minWait);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.lastRequestTime = Date.now();
      return;
    }

    this.requestCount++;
    this.lastRequestTime = Date.now();
  }

  async retryOperation<T>(operation: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    let lastError: any;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.waitForRateLimit();
        return await operation();
      } catch (error: any) {
        lastError = error;
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }
}
