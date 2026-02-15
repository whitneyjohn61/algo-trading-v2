'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity, CheckCircle, AlertTriangle, XCircle, RefreshCw,
  Server, Database, ArrowLeftRight, Wifi, Monitor, Clock, Bell, Wallet,
  BarChart3,
} from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';
import api from '@/lib/api';

/**
 * System Health Chip — compact status indicator with hover/click popup.
 *
 * Polls /api/health and /api/system/health to determine overall status.
 * Shows: server, database, exchange, WebSocket, accounts, portfolio, monitoring.
 *
 * Transplanted from V1 with V2 simplifications (no VPN, mock data, geolocation).
 */

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'error' | 'unknown';
  server: string;
  database: string;
  exchange: string;
  websocket: string;
  accounts: number;
  portfolio: string;
  monitoring: string;
  notifications: string;
  lastCheck: string;
  wsClients: number;
  alerts: number;
}

interface SystemHealthChipProps {
  wsConnected: boolean;
  onNavigateToSystem?: () => void;
}

const DEFAULT_HEALTH: SystemHealth = {
  overall: 'unknown',
  server: 'unknown',
  database: 'unknown',
  exchange: 'unknown',
  websocket: 'unknown',
  accounts: 0,
  portfolio: 'unknown',
  monitoring: 'unknown',
  notifications: 'unknown',
  lastCheck: new Date().toISOString(),
  wsClients: 0,
  alerts: 0,
};

export function SystemHealthChip({ wsConnected, onNavigateToSystem }: SystemHealthChipProps) {
  const [health, setHealth] = useState<SystemHealth>(DEFAULT_HEALTH);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const { getEffectiveTheme } = useThemeStore();
  const isMountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch health from server ──

  const fetchHealth = useCallback(async () => {
    try {
      // Try basic health first
      let serverStatus = 'down';
      try {
        const healthRes = await api.system.health();
        serverStatus = (healthRes?.status === 'OK' || healthRes?.status === 'ok') ? 'active' : 'down';
      } catch {
        serverStatus = 'down';
      }

      // If server is up, get detailed system health
      let detailed: any = null;
      if (serverStatus === 'active') {
        try {
          detailed = await api.system.systemHealth();
        } catch {
          // System health endpoint may not exist yet
        }
      }

      if (!isMountedRef.current) return;

      const newHealth: SystemHealth = {
        overall: 'healthy',
        server: serverStatus,
        database: detailed?.database?.status || (serverStatus === 'active' ? 'connected' : 'unknown'),
        exchange: detailed?.exchange?.status || (detailed?.exchange?.configured ? 'configured' : 'unknown'),
        websocket: wsConnected ? 'connected' : 'disconnected',
        accounts: detailed?.accounts?.active || 0,
        portfolio: detailed?.portfolio?.status || 'unknown',
        monitoring: detailed?.monitoring?.status || 'unknown',
        notifications: detailed?.notifications?.status || 'unknown',
        lastCheck: new Date().toISOString(),
        wsClients: detailed?.websocket?.clients || 0,
        alerts: detailed?.alerts?.count || 0,
      };

      // Calculate overall status
      if (serverStatus === 'down') {
        newHealth.overall = 'error';
      } else if (newHealth.database === 'disconnected' || newHealth.exchange === 'error') {
        newHealth.overall = 'error';
      } else if (!wsConnected || newHealth.database === 'unknown' || newHealth.exchange === 'unknown') {
        newHealth.overall = 'warning';
      } else {
        newHealth.overall = 'healthy';
      }

      setHealth(newHealth);
      setLoading(false);
    } catch {
      if (!isMountedRef.current) return;
      setHealth(prev => ({ ...prev, overall: 'error', server: 'down', lastCheck: new Date().toISOString() }));
      setLoading(false);
    }
  }, [wsConnected]);

  // ── Initial fetch + polling ──

  useEffect(() => {
    isMountedRef.current = true;
    fetchHealth();

    // Poll every 15 seconds
    intervalRef.current = setInterval(fetchHealth, 15000);

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchHealth]);

  // ── Update WS status reactively ──

  useEffect(() => {
    setHealth(prev => {
      const wsStatus = wsConnected ? 'connected' : 'disconnected';
      if (prev.websocket === wsStatus) return prev;

      const updated = { ...prev, websocket: wsStatus };
      // Recalculate overall
      if (prev.server === 'down') {
        updated.overall = 'error';
      } else if (prev.database === 'disconnected') {
        updated.overall = 'error';
      } else if (!wsConnected || prev.database === 'unknown') {
        updated.overall = 'warning';
      } else {
        updated.overall = 'healthy';
      }
      return updated;
    });
  }, [wsConnected]);

  // ── Helpers ──

  const isDark = getEffectiveTheme() === 'dark';

  function statusColor(status: string): string {
    const s = status.toLowerCase();
    if (['healthy', 'connected', 'active', 'configured', 'enabled'].includes(s)) {
      return isDark ? 'text-green-400' : 'text-green-700';
    }
    if (['warning', 'partial', 'unknown'].includes(s)) {
      return isDark ? 'text-yellow-400' : 'text-yellow-700';
    }
    if (['error', 'disconnected', 'down', 'disabled'].includes(s)) {
      return isDark ? 'text-red-400' : 'text-red-700';
    }
    return isDark ? 'text-slate-300' : 'text-slate-600';
  }

  function chipBg(overall: string): string {
    switch (overall) {
      case 'healthy':
        return isDark
          ? 'bg-green-900/20 text-green-400 border-green-800'
          : 'bg-green-100 text-green-800 border-green-200';
      case 'warning':
        return isDark
          ? 'bg-yellow-900/20 text-yellow-400 border-yellow-800'
          : 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error':
        return isDark
          ? 'bg-red-900/20 text-red-400 border-red-800'
          : 'bg-red-100 text-red-800 border-red-200';
      default:
        return isDark
          ? 'bg-slate-800 text-slate-300 border-slate-700'
          : 'bg-slate-100 text-slate-600 border-slate-200';
    }
  }

  function OverallIcon({ status }: { status: string }) {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Activity className="w-4 h-4 text-slate-400" />;
    }
  }

  function formatTime(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return 'Unknown';
    }
  }

  // ── Render ──

  if (loading) {
    return (
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs ${isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        <span className="hidden sm:inline">Checking...</span>
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-1.5" onMouseLeave={() => setShowDetails(false)}>
      {/* Chip */}
      <button
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium cursor-pointer hover:shadow-md transition-shadow ${chipBg(health.overall)}`}
        onClick={() => setShowDetails(prev => !prev)}
        onMouseEnter={() => setShowDetails(true)}
      >
        <OverallIcon status={health.overall} />
        <span className="hidden sm:inline">{health.overall.toUpperCase()}</span>
        {health.overall === 'healthy' && (
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        )}
      </button>

      {/* Popup details */}
      {showDetails && (
        <div
          className={`absolute top-full left-0 mt-2 min-w-[300px] z-[60] border rounded-lg shadow-xl ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
          }`}
          onMouseEnter={() => setShowDetails(true)}
        >
          <div className="p-3">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <h4 className={`font-semibold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                System Health
              </h4>
              <button
                onClick={fetchHealth}
                className="text-xs text-primary-600 hover:text-primary-800 font-medium"
              >
                Refresh
              </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <Row icon={<Activity className="w-3.5 h-3.5 text-sky-500" />} label="Overall" value={health.overall} color={statusColor(health.overall)} />
              <Row icon={<Server className="w-3.5 h-3.5 text-blue-500" />} label="Server" value={health.server} color={statusColor(health.server)} />
              <Row icon={<Database className="w-3.5 h-3.5 text-emerald-500" />} label="Database" value={health.database} color={statusColor(health.database)} />
              <Row icon={<ArrowLeftRight className="w-3.5 h-3.5 text-orange-500" />} label="Exchange" value={health.exchange} color={statusColor(health.exchange)} />
              <Row icon={<Wifi className="w-3.5 h-3.5 text-cyan-500" />} label="WebSocket" value={wsConnected ? `Connected (${health.wsClients})` : 'Disconnected'} color={statusColor(wsConnected ? 'connected' : 'disconnected')} />
              <Row icon={<Wallet className="w-3.5 h-3.5 text-purple-500" />} label="Accounts" value={`${health.accounts} active`} color={statusColor(health.accounts > 0 ? 'connected' : 'unknown')} />
              <Row icon={<BarChart3 className="w-3.5 h-3.5 text-teal-500" />} label="Portfolio" value={health.portfolio} color={statusColor(health.portfolio)} />
              <Row icon={<Monitor className="w-3.5 h-3.5 text-indigo-500" />} label="Monitoring" value={health.monitoring} color={statusColor(health.monitoring)} />
              <Row icon={<Bell className="w-3.5 h-3.5 text-rose-500" />} label="Notifications" value={health.notifications} color={statusColor(health.notifications)} />
              <Row icon={<Clock className="w-3.5 h-3.5 text-amber-500" />} label="Last Check" value={formatTime(health.lastCheck)} color={isDark ? 'text-slate-300' : 'text-slate-600'} />
              {health.alerts > 0 && (
                <Row icon={<Bell className="w-3.5 h-3.5 text-red-500" />} label="Alerts" value={String(health.alerts)} color={isDark ? 'text-red-400' : 'text-red-700'} />
              )}
            </div>

            {/* Footer */}
            {onNavigateToSystem && (
              <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                <button
                  onClick={() => { setShowDetails(false); onNavigateToSystem(); }}
                  className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                >
                  Open System Monitor
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Row helper for popup grid */
function Row({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <>
      <div className="text-slate-500 flex items-center gap-1.5">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`font-medium ${color}`}>{value}</div>
    </>
  );
}
