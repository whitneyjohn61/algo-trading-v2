import databaseService from '../database/connection';

interface ComponentHealth {
  status: 'healthy' | 'unhealthy' | 'disconnected';
  message: string;
  lastChecked: number;
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  timestamp: string;
  components: {
    database: ComponentHealth;
    exchange: ComponentHealth;
    websocket: ComponentHealth;
  };
}

class SystemMonitor {
  private startTime: number = Date.now();
  private exchangeHealthy: boolean = false;
  private websocketHealthy: boolean = false;

  setExchangeHealth(healthy: boolean): void {
    this.exchangeHealthy = healthy;
  }

  setWebSocketHealth(healthy: boolean): void {
    this.websocketHealthy = healthy;
  }

  async getHealth(): Promise<SystemHealth> {
    const now = Date.now();
    const dbHealth = await databaseService.healthCheck();

    const dbComponent: ComponentHealth = {
      status: dbHealth.status as ComponentHealth['status'],
      message: dbHealth.message,
      lastChecked: now,
    };

    const exchangeComponent: ComponentHealth = {
      status: this.exchangeHealthy ? 'healthy' : 'disconnected',
      message: this.exchangeHealthy ? 'Exchange connection active' : 'Exchange not connected',
      lastChecked: now,
    };

    const wsComponent: ComponentHealth = {
      status: this.websocketHealthy ? 'healthy' : 'disconnected',
      message: this.websocketHealthy ? 'WebSocket connected' : 'WebSocket not connected',
      lastChecked: now,
    };

    const components = [dbComponent, exchangeComponent, wsComponent];
    const unhealthyCount = components.filter(c => c.status === 'unhealthy').length;
    const disconnectedCount = components.filter(c => c.status === 'disconnected').length;

    let overall: SystemHealth['overall'] = 'healthy';
    if (unhealthyCount > 0) overall = 'unhealthy';
    else if (disconnectedCount > 0) overall = 'degraded';

    return {
      overall,
      uptime: (now - this.startTime) / 1000,
      timestamp: new Date(now).toISOString(),
      components: { database: dbComponent, exchange: exchangeComponent, websocket: wsComponent },
    };
  }

  getUptime(): number {
    return (Date.now() - this.startTime) / 1000;
  }
}

const systemMonitor = new SystemMonitor();
export default systemMonitor;
