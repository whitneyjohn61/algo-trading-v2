'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Server, Database, Globe, Wifi, Shield, Activity, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import { SystemTools } from './SystemTools';

interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
}

interface SystemHealthData {
  server: { status: string; uptime: number; memory: { rss: number; heapUsed: number; heapTotal: number } };
  database: { status: string; message: string };
  exchange: { status: string; adapters: number; defaultAvailable: boolean };
  websocket: { clients: number };
  strategies: { registered: number; active: string[] };
}

interface GeoData {
  location: {
    country: string;
    countryCode: string;
    region: string;
    city: string;
    timezone: string;
    ip: string;
    source: string;
  };
  isRestricted: boolean;
  detectedAt: string;
}

function StatusBadge({ status }: { status: string }) {
  const isGood = status === 'ok' || status === 'healthy' || status === 'connected';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
      isGood
        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
    }`}>
      {isGood ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
      {status}
    </span>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export function SystemMonitor() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealthData | null>(null);
  const [geo, setGeo] = useState<GeoData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [h, sh, g] = await Promise.allSettled([
        api.system.health(),
        api.system.systemHealth(),
        api.geo.getStatus(),
      ]);
      if (h.status === 'fulfilled') setHealth(h.value);
      if (sh.status === 'fulfilled') setSystemHealth(sh.value);
      if (g.status === 'fulfilled') setGeo(g.value);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">System Monitor</h2>
        <button onClick={loadAll} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Server */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Server</h3>
            </div>
            {health && <StatusBadge status={health.status} />}
          </div>
          {health && (
            <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex justify-between"><span>Version</span><span className="text-slate-700 dark:text-slate-300">{health.version}</span></div>
              <div className="flex justify-between"><span>Environment</span><span className="text-slate-700 dark:text-slate-300">{health.environment}</span></div>
              <div className="flex justify-between">
                <span>Uptime</span>
                <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1"><Clock className="w-3 h-3" />{formatUptime(health.uptime)}</span>
              </div>
            </div>
          )}
          {systemHealth?.server && (
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 space-y-1 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex justify-between"><span>Heap Used</span><span>{formatBytes(systemHealth.server.memory.heapUsed)}</span></div>
              <div className="flex justify-between"><span>RSS</span><span>{formatBytes(systemHealth.server.memory.rss)}</span></div>
            </div>
          )}
        </div>

        {/* Database */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Database</h3>
            </div>
            {systemHealth?.database && <StatusBadge status={systemHealth.database.status} />}
          </div>
          {systemHealth?.database && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{systemHealth.database.message}</p>
          )}
        </div>

        {/* Exchange */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Exchange</h3>
            </div>
            {systemHealth?.exchange && <StatusBadge status={systemHealth.exchange.status} />}
          </div>
          {systemHealth?.exchange && (
            <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex justify-between"><span>Adapters</span><span>{systemHealth.exchange.adapters}</span></div>
              <div className="flex justify-between"><span>Default</span><span>{systemHealth.exchange.defaultAvailable ? 'Yes' : 'No'}</span></div>
            </div>
          )}
        </div>

        {/* WebSocket */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">WebSocket</h3>
            </div>
          </div>
          {systemHealth?.websocket && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              <div className="flex justify-between"><span>Connected Clients</span><span className="text-slate-700 dark:text-slate-300">{systemHealth.websocket.clients}</span></div>
            </div>
          )}
        </div>

        {/* Geo-Location */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Geo-Location</h3>
            </div>
            {geo && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                geo.isRestricted
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
              }`}>
                {geo.isRestricted ? <Shield className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                {geo.isRestricted ? 'RESTRICTED' : 'Unrestricted'}
              </span>
            )}
          </div>
          {geo?.location && (
            <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex justify-between"><span>Location</span><span className="text-slate-700 dark:text-slate-300">{geo.location.city}, {geo.location.country}</span></div>
              <div className="flex justify-between"><span>IP</span><span className="font-mono">{geo.location.ip}</span></div>
              <div className="flex justify-between"><span>Timezone</span><span>{geo.location.timezone}</span></div>
            </div>
          )}
        </div>

        {/* Strategies */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Strategies</h3>
            </div>
          </div>
          {systemHealth?.strategies && (
            <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex justify-between"><span>Registered</span><span className="text-slate-700 dark:text-slate-300">{systemHealth.strategies.registered}</span></div>
              {systemHealth.strategies.active.length > 0 && (
                <div className="mt-2">
                  <span className="text-slate-500">Active:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {systemHealth.strategies.active.map(s => (
                      <span key={s} className="px-1.5 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded text-[10px]">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Operations Tools */}
      <SystemTools />
    </div>
  );
}
