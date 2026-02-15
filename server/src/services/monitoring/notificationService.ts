import https from 'https';
import http from 'http';

type AlertLevel = 'info' | 'warning' | 'critical';

interface TradeAlertData {
  symbol: string;
  side: 'long' | 'short';
  strategy: string;
  action: 'opened' | 'closed' | 'stopped_out';
  entryPrice?: number;
  exitPrice?: number;
  pnl?: number;
  pnlPct?: number;
}

interface CircuitBreakerAlertData {
  type: 'portfolio' | 'strategy';
  strategyId?: string;
  drawdownPct: number;
  threshold: number;
  action: 'triggered' | 'released';
}

const COLORS: Record<AlertLevel, string> = {
  info: '#36a64f', warning: '#ff9900', critical: '#ff0000',
};
const EMOJI: Record<AlertLevel, string> = {
  info: ':white_check_mark:', warning: ':warning:', critical: ':rotating_light:',
};

class NotificationService {
  private webhookUrl: string | null = null;
  private enabled: boolean = false;
  private botName: string = 'AlgoTrader V2';
  private queue: Array<{ payload: any; retries: number }> = [];
  private processing: boolean = false;

  initialize(): void {
    this.webhookUrl = process.env['SLACK_WEBHOOK_URL'] || null;
    this.enabled = !!this.webhookUrl;
    if (this.enabled) {
      console.log(`[Notify] Slack enabled`);
    } else {
      console.log('[Notify] Slack not configured (set SLACK_WEBHOOK_URL)');
    }
  }

  /** Generic alert — used by monitoring, logging, and portfolio */
  async send(message: string, level: AlertLevel = 'info'): Promise<void> {
    if (!this.enabled) return;
    this.enqueue({
      username: this.botName,
      icon_emoji: ':chart_with_upwards_trend:',
      attachments: [{
        color: COLORS[level],
        text: `${EMOJI[level]} ${message}`,
        ts: Math.floor(Date.now() / 1000),
      }],
    });
  }

  /** Trading system — trade open/close/stop-out */
  async sendTradeAlert(data: TradeAlertData): Promise<void> {
    if (!this.enabled) return;
    const fields = [
      { title: 'Symbol', value: data.symbol, short: true },
      { title: 'Side', value: data.side.toUpperCase(), short: true },
      { title: 'Strategy', value: data.strategy, short: true },
      { title: 'Action', value: data.action, short: true },
    ];
    if (data.entryPrice) fields.push({ title: 'Entry', value: `$${data.entryPrice.toFixed(2)}`, short: true });
    if (data.exitPrice) fields.push({ title: 'Exit', value: `$${data.exitPrice.toFixed(2)}`, short: true });
    if (data.pnl !== undefined) {
      const s = data.pnl >= 0 ? '+' : '';
      fields.push({ title: 'P&L', value: `${s}$${data.pnl.toFixed(2)}`, short: true });
    }
    const lvl: AlertLevel = data.action === 'stopped_out' ? 'warning' : 'info';
    this.enqueue({
      username: this.botName, icon_emoji: ':chart_with_upwards_trend:',
      attachments: [{ color: COLORS[lvl], title: `Trade ${data.action}: ${data.symbol}`, fields, ts: Math.floor(Date.now() / 1000) }],
    });
  }

  /** Portfolio system — circuit breaker alerts */
  async sendCircuitBreakerAlert(data: CircuitBreakerAlertData): Promise<void> {
    const lvl: AlertLevel = data.action === 'triggered' ? 'critical' : 'info';
    const scope = data.type === 'portfolio' ? 'PORTFOLIO' : `Strategy ${data.strategyId}`;
    await this.send(`*Circuit Breaker ${data.action.toUpperCase()}*\nScope: ${scope} | DD: ${data.drawdownPct.toFixed(1)}% | Threshold: ${data.threshold.toFixed(1)}%`, lvl);
  }

  /** Monitoring system — health status changes */
  async sendHealthAlert(component: string, status: string, msg: string): Promise<void> {
    const lvl: AlertLevel = status === 'unhealthy' ? 'critical' : status === 'disconnected' ? 'warning' : 'info';
    await this.send(`*[Health]* ${component}: ${status} — ${msg}`, lvl);
  }

  /** Logging system — error escalation */
  async sendErrorAlert(source: string, error: string): Promise<void> {
    await this.send(`*[Error]* ${source}: ${error}`, 'critical');
  }

  /** System lifecycle */
  async sendSystemAlert(message: string, level: AlertLevel = 'info'): Promise<void> {
    await this.send(`*[System]* ${message}`, level);
  }

  // ---- Queue + HTTP ----
  private enqueue(payload: any): void {
    this.queue.push({ payload, retries: 0 });
    if (!this.processing) void this.processQueue();
  }

  private async processQueue(): Promise<void> {
    this.processing = true;
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;
      try {
        await this.postToSlack(item.payload);
      } catch (err: any) {
        if (item.retries < 3) { item.retries++; this.queue.push(item); await new Promise(r => setTimeout(r, 1000 * Math.pow(2, item.retries))); }
        else console.error('[Notify] Failed:', err.message);
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    this.processing = false;
  }

  private postToSlack(payload: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.webhookUrl) { resolve(); return; }
      const body = JSON.stringify(payload);
      const u = new URL(this.webhookUrl);
      const t = u.protocol === 'https:' ? https : http;
      const req = t.request({ hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => (res.statusCode && res.statusCode < 300) ? resolve() : reject(new Error(`Slack ${res.statusCode}: ${d}`)));
      });
      req.on('error', reject);
      req.setTimeout(10000, () => req.destroy(new Error('Timeout')));
      req.write(body); req.end();
    });
  }

  isEnabled(): boolean { return this.enabled; }
}

const notificationService = new NotificationService();
export default notificationService;
