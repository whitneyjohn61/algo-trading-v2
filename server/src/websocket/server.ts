import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

interface WsClient {
  ws: WebSocket;
  userId?: number;
  tradingAccountId?: number;
  subscriptions: Set<string>;
  isAlive: boolean;
}

class WsBroadcaster {
  private wss: WebSocketServer | null = null;
  private clients: Set<WsClient> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  initialize(server: HttpServer): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      const client: WsClient = { ws, subscriptions: new Set(), isAlive: true };
      this.clients.add(client);
      console.log(`[WS] Client connected (total: ${this.clients.size})`);

      ws.on('pong', () => { client.isAlive = true; });

      ws.on('message', (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          this.handleMessage(client, msg);
        } catch (_e) { /* ignore invalid JSON */ }
      });

      ws.on('close', () => {
        this.clients.delete(client);
        console.log(`[WS] Client disconnected (total: ${this.clients.size})`);
      });

      ws.on('error', (err) => {
        console.error('[WS] Client error:', err.message);
      });

      // Send welcome
      ws.send(JSON.stringify({ type: 'connected', timestamp: Date.now() }));
    });

    // Heartbeat every 30s
    this.heartbeatInterval = setInterval(() => {
      for (const client of this.clients) {
        if (!client.isAlive) {
          client.ws.terminate();
          this.clients.delete(client);
          continue;
        }
        client.isAlive = false;
        client.ws.ping();
      }
    }, 30000);

    console.log('[WS] WebSocket server initialized on /ws');
  }

  private handleMessage(client: WsClient, msg: any): void {
    switch (msg.type) {
      case 'subscribe':
        if (msg.channel) client.subscriptions.add(msg.channel);
        break;
      case 'unsubscribe':
        if (msg.channel) client.subscriptions.delete(msg.channel);
        break;
      case 'auth':
        client.userId = msg.userId;
        if (msg.tradingAccountId) {
          client.tradingAccountId = msg.tradingAccountId;
        }
        break;
      case 'switch_account':
        // Client switched TEST/LIVE mode — update their account binding
        if (msg.tradingAccountId) {
          client.tradingAccountId = msg.tradingAccountId;
        }
        break;
    }
  }

  /** Broadcast to all connected clients */
  broadcast(type: string, data: any): void {
    const message = JSON.stringify({ type, data, timestamp: Date.now() });
    for (const client of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  }

  /** Broadcast to clients subscribed to a channel */
  broadcastToChannel(channel: string, type: string, data: any): void {
    const message = JSON.stringify({ type, channel, data, timestamp: Date.now() });
    for (const client of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN && client.subscriptions.has(channel)) {
        client.ws.send(message);
      }
    }
  }

  /** Broadcast to clients bound to a specific trading account */
  broadcastToAccount(tradingAccountId: number, type: string, data: any): void {
    const message = JSON.stringify({ type, tradingAccountId, data, timestamp: Date.now() });
    for (const client of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN && client.tradingAccountId === tradingAccountId) {
        client.ws.send(message);
      }
    }
  }

  /** Broadcast to a specific user (all their connected clients) */
  broadcastToUser(userId: number, type: string, data: any): void {
    const message = JSON.stringify({ type, data, timestamp: Date.now() });
    for (const client of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN && client.userId === userId) {
        client.ws.send(message);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getClientDetails(): { total: number; clients: { userId?: number; tradingAccountId?: number; subscriptions: string[]; isAlive: boolean }[] } {
    const clients: { userId?: number; tradingAccountId?: number; subscriptions: string[]; isAlive: boolean }[] = [];
    for (const client of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        clients.push({
          userId: client.userId,
          tradingAccountId: client.tradingAccountId,
          subscriptions: Array.from(client.subscriptions),
          isAlive: client.isAlive,
        });
      }
    }
    return { total: this.clients.size, clients };
  }

  close(): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    for (const client of this.clients) client.ws.terminate();
    this.clients.clear();
    this.wss?.close();
    console.log('[WS] Server closed');
  }
}

const wsBroadcaster = new WsBroadcaster();
export default wsBroadcaster;
