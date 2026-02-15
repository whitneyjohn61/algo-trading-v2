'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useAccountStore } from '@/store/accountStore';
import { usePortfolioStore } from '@/store/portfolioStore';

/**
 * WebSocket hook — manages connection, auto-reconnect, and account-scoped subscriptions.
 *
 * On connect: sends auth message with userId + tradingAccountId.
 * On account switch: sends switch_account message.
 * Routes incoming messages to the appropriate Zustand stores.
 */

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000';

interface UseWebSocketOptions {
  /** Additional channels to subscribe to */
  channels?: string[];
  /** Custom message handler */
  onMessage?: (msg: any) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);

  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const userId = useAuthStore(s => s.user?.id);
  const activeAccountId = useAccountStore(s => s.activeAccountId);
  const prevAccountIdRef = useRef<number | null>(null);

  // Store setters for routing messages
  const setSummary = usePortfolioStore(s => s.setSummary);
  const setCircuitBreaker = usePortfolioStore(s => s.setCircuitBreaker);

  const MAX_RECONNECT_ATTEMPTS = 10;
  const BASE_RECONNECT_MS = 2000;

  // ── Send helper ──

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  // ── Route incoming messages to stores ──

  const handleMessage = useCallback((msg: any) => {
    const { type, data } = msg;

    switch (type) {
      case 'portfolio:equity_update':
        setSummary({
          totalEquity: data.equity,
          drawdownPct: data.drawdownPct,
          peakEquity: data.peakEquity,
          positionCount: data.positionCount,
          unrealizedPnl: data.unrealizedPnl,
        });
        break;

      case 'portfolio:circuit_breaker':
        // Refetch full status after circuit breaker event
        break;

      case 'portfolio:drawdown_alert':
        // Could show a toast or notification
        break;

      case 'strategy:state_change':
        // Strategy state changed — could update strategyStore
        break;

      default:
        break;
    }

    // Forward to custom handler
    options.onMessage?.(msg);
  }, [setSummary, setCircuitBreaker, options.onMessage]);

  // ── Connect ──

  const connect = useCallback(() => {
    if (!isAuthenticated || wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      setConnectionState('connecting');
      const ws = new WebSocket(`${WS_URL}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setIsConnected(true);
        setConnectionState('connected');
        reconnectAttemptsRef.current = 0;

        // Send auth message
        send({ type: 'auth', userId, tradingAccountId: activeAccountId });

        // Subscribe to channels
        for (const ch of options.channels || []) {
          send({ type: 'subscribe', channel: ch });
        }
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const msg = JSON.parse(event.data);
          handleMessage(msg);
        } catch { /* ignore invalid JSON */ }
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setIsConnected(false);
        setConnectionState('disconnected');

        // Reconnect with exponential backoff
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = BASE_RECONNECT_MS * Math.pow(1.5, reconnectAttemptsRef.current);
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        if (!isMountedRef.current) return;
        setConnectionState('error');
      };
    } catch {
      setConnectionState('error');
    }
  }, [isAuthenticated, userId, activeAccountId, send, handleMessage, options.channels]);

  // ── Connect on mount / auth change ──

  useEffect(() => {
    isMountedRef.current = true;

    if (isAuthenticated) {
      connect();
    }

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [isAuthenticated, connect]);

  // ── Handle account switch ──

  useEffect(() => {
    if (activeAccountId && activeAccountId !== prevAccountIdRef.current && isConnected) {
      send({ type: 'switch_account', tradingAccountId: activeAccountId });
      prevAccountIdRef.current = activeAccountId;
    }
  }, [activeAccountId, isConnected, send]);

  return {
    isConnected,
    connectionState,
    send,
  };
}
