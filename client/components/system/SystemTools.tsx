'use client';

import { useState, useCallback } from 'react';
import {
  Activity, Database, Camera, Bell, TrendingUp, Trash2,
  Wifi, FileText, Shield, Heart, Play, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import api from '@/lib/api';

// ── Types ─────────────────────────────────────────────────

interface ToolResult {
  data: any;
  error?: string;
  ranAt: string;
}

type ToolId =
  | 'exchange' | 'database' | 'snapshot' | 'notification'
  | 'funding' | 'cache' | 'wsclients' | 'logs' | 'ratelimit' | 'strategy';

// ── Tool definitions ──────────────────────────────────────

interface ToolDef {
  id: ToolId;
  name: string;
  description: string;
  icon: typeof Activity;
  run: () => Promise<any>;
}

const TOOLS: ToolDef[] = [
  { id: 'exchange', name: 'Exchange Connectivity', description: 'Test API keys for all trading accounts', icon: Activity, run: () => api.system.checkExchange() },
  { id: 'database', name: 'Database Health', description: 'Test DB connection and show table counts', icon: Database, run: () => api.system.checkDatabase() },
  { id: 'snapshot', name: 'Force Snapshot', description: 'Trigger equity snapshot for all accounts', icon: Camera, run: () => api.system.forceSnapshot() },
  { id: 'notification', name: 'Test Notification', description: 'Send test Slack notification', icon: Bell, run: () => api.system.testNotification() },
  { id: 'funding', name: 'Funding Rates', description: 'Top 20 funding rates by magnitude', icon: TrendingUp, run: () => api.system.fundingRates() },
  { id: 'cache', name: 'Clear Candle Cache', description: 'Clear cache and show before/after stats', icon: Trash2, run: () => api.system.clearCache() },
  { id: 'wsclients', name: 'WebSocket Clients', description: 'Show connected clients and subscriptions', icon: Wifi, run: () => api.system.wsClients() },
  { id: 'logs', name: 'Recent Logs', description: 'Last 50 log entries with level filter', icon: FileText, run: () => api.system.logs(50) },
  { id: 'ratelimit', name: 'Rate Limit Status', description: 'Current request count vs limit', icon: Shield, run: () => api.system.rateLimit() },
  { id: 'strategy', name: 'Strategy Health', description: 'Per-account strategy status and warmup state', icon: Heart, run: () => api.system.strategyHealth() },
];

// ── Main component ────────────────────────────────────────

export function SystemTools() {
  const [results, setResults] = useState<Record<ToolId, ToolResult | null>>({} as any);
  const [loading, setLoading] = useState<Record<ToolId, boolean>>({} as any);
  const [expanded, setExpanded] = useState<Record<ToolId, boolean>>({} as any);
  const [logLevel, setLogLevel] = useState<string>('');

  const runTool = useCallback(async (tool: ToolDef) => {
    setLoading(prev => ({ ...prev, [tool.id]: true }));
    setExpanded(prev => ({ ...prev, [tool.id]: true }));
    try {
      const response = await tool.run();
      setResults(prev => ({
        ...prev,
        [tool.id]: { data: response?.data ?? response, ranAt: new Date().toLocaleTimeString() },
      }));
    } catch (err: any) {
      setResults(prev => ({
        ...prev,
        [tool.id]: { data: null, error: err?.response?.data?.error ?? err.message, ranAt: new Date().toLocaleTimeString() },
      }));
    } finally {
      setLoading(prev => ({ ...prev, [tool.id]: false }));
    }
  }, []);

  const runLogsTool = useCallback(async () => {
    setLoading(prev => ({ ...prev, logs: true }));
    setExpanded(prev => ({ ...prev, logs: true }));
    try {
      const response = await api.system.logs(50, logLevel || undefined);
      setResults(prev => ({
        ...prev,
        logs: { data: response?.data ?? response, ranAt: new Date().toLocaleTimeString() },
      }));
    } catch (err: any) {
      setResults(prev => ({
        ...prev,
        logs: { data: null, error: err?.response?.data?.error ?? err.message, ranAt: new Date().toLocaleTimeString() },
      }));
    } finally {
      setLoading(prev => ({ ...prev, logs: false }));
    }
  }, [logLevel]);

  const toggleExpand = (id: ToolId) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Operations Tools</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {TOOLS.map(tool => (
          <ToolCard
            key={tool.id}
            tool={tool}
            result={results[tool.id] ?? null}
            isLoading={loading[tool.id] ?? false}
            isExpanded={expanded[tool.id] ?? false}
            onRun={() => tool.id === 'logs' ? runLogsTool() : runTool(tool)}
            onToggle={() => toggleExpand(tool.id)}
            logLevel={tool.id === 'logs' ? logLevel : undefined}
            onLogLevelChange={tool.id === 'logs' ? setLogLevel : undefined}
          />
        ))}
      </div>
    </div>
  );
}

// ── Tool Card ─────────────────────────────────────────────

interface ToolCardProps {
  tool: ToolDef;
  result: ToolResult | null;
  isLoading: boolean;
  isExpanded: boolean;
  onRun: () => void;
  onToggle: () => void;
  logLevel?: string;
  onLogLevelChange?: (level: string) => void;
}

function ToolCard({ tool, result, isLoading, isExpanded, onRun, onToggle, logLevel, onLogLevelChange }: ToolCardProps) {
  const Icon = tool.icon;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="min-w-0">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{tool.name}</h4>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{tool.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {/* Log level filter for logs tool */}
          {tool.id === 'logs' && onLogLevelChange && (
            <select
              value={logLevel ?? ''}
              onChange={e => onLogLevelChange(e.target.value)}
              className="text-[11px] px-1.5 py-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            >
              <option value="">All</option>
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
            </select>
          )}
          <button
            onClick={onRun}
            disabled={isLoading}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Run
          </button>
        </div>
      </div>

      {/* Result area */}
      {result && (
        <div className="border-t border-slate-100 dark:border-slate-700">
          <button
            onClick={onToggle}
            className="w-full px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-750"
          >
            <span>
              {result.error
                ? <span className="text-red-500">Error</span>
                : <span className="text-emerald-500">Success</span>
              }
              {' · '}{result.ranAt}
            </span>
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {isExpanded && (
            <div className="px-3 pb-3">
              {result.error ? (
                <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded p-2">{result.error}</div>
              ) : (
                <ResultRenderer toolId={tool.id} data={result.data} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Result renderers ──────────────────────────────────────

function ResultRenderer({ toolId, data }: { toolId: ToolId; data: any }) {
  switch (toolId) {
    case 'exchange':    return <ExchangeResult data={data} />;
    case 'database':    return <DatabaseResult data={data} />;
    case 'snapshot':    return <SnapshotResult data={data} />;
    case 'notification':return <NotificationResult data={data} />;
    case 'funding':     return <FundingResult data={data} />;
    case 'cache':       return <CacheResult data={data} />;
    case 'wsclients':   return <WsClientsResult data={data} />;
    case 'logs':        return <LogsResult data={data} />;
    case 'ratelimit':   return <RateLimitResult data={data} />;
    case 'strategy':    return <StrategyResult data={data} />;
    default:            return <JsonResult data={data} />;
  }
}

// ── Exchange ──
function ExchangeResult({ data }: { data: any }) {
  const accounts = data?.accounts ?? [];
  return (
    <div className="space-y-1">
      {accounts.map((a: any) => (
        <div key={a.accountId} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 dark:border-slate-700 last:border-0">
          <span className="text-slate-600 dark:text-slate-300">Account #{a.accountId}</span>
          <span className={a.status === 'ok' ? 'text-emerald-500' : 'text-red-500'}>
            {a.status === 'ok' ? `Connected · ${new Date(a.serverTime).toLocaleTimeString()}` : a.error}
          </span>
        </div>
      ))}
      {accounts.length === 0 && <p className="text-xs text-slate-400">No active accounts found</p>}
    </div>
  );
}

// ── Database ──
function DatabaseResult({ data }: { data: any }) {
  const tables = data?.tables ?? {};
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-emerald-500 font-medium">{data?.status}</span>
        <span className="text-slate-400">·</span>
        <span className="text-slate-500">{data?.latencyMs}ms latency</span>
      </div>
      <div className="space-y-0.5">
        {Object.entries(tables).map(([table, count]) => (
          <div key={table} className="flex justify-between text-xs py-0.5">
            <span className="text-slate-500 font-mono">{table}</span>
            <span className="text-slate-700 dark:text-slate-300">{count === -1 ? 'N/A' : String(count)} rows</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Snapshot ──
function SnapshotResult({ data }: { data: any }) {
  const snapshots = data?.snapshots ?? [];
  return (
    <div className="space-y-1">
      {snapshots.map((s: any) => (
        <div key={s.accountId} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 dark:border-slate-700 last:border-0">
          <span className="text-slate-600 dark:text-slate-300">Account #{s.accountId}</span>
          <span className={s.status === 'ok' ? 'text-emerald-500' : s.status === 'no_data' ? 'text-amber-500' : 'text-red-500'}>
            {s.status === 'ok' ? `$${s.equity?.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : s.status === 'no_data' ? 'No data' : s.error}
          </span>
        </div>
      ))}
      {snapshots.length === 0 && <p className="text-xs text-slate-400">No active accounts</p>}
    </div>
  );
}

// ── Notification ──
function NotificationResult({ data }: { data: any }) {
  return (
    <div className="text-xs">
      {data?.success !== false ? (
        <span className="text-emerald-500">{data?.message ?? 'Notification sent'}</span>
      ) : (
        <span className="text-red-500">{data?.error ?? 'Failed to send'}</span>
      )}
    </div>
  );
}

// ── Funding ──
function FundingResult({ data }: { data: any }) {
  const rates = data?.rates ?? [];
  return (
    <div className="space-y-0.5 max-h-60 overflow-y-auto">
      {rates.map((r: any) => {
        const pct = (r.fundingRate * 100).toFixed(4);
        const isPositive = r.fundingRate > 0;
        return (
          <div key={r.symbol} className="flex items-center justify-between text-xs py-0.5">
            <span className="text-slate-600 dark:text-slate-300 font-mono text-[11px]">{r.symbol}</span>
            <span className={isPositive ? 'text-emerald-500' : 'text-red-500'}>
              {isPositive ? '+' : ''}{pct}%
            </span>
          </div>
        );
      })}
      {rates.length === 0 && <p className="text-xs text-slate-400">No funding rates available</p>}
    </div>
  );
}

// ── Cache ──
function CacheResult({ data }: { data: any }) {
  return (
    <div className="space-y-1 text-xs">
      <div className="flex justify-between">
        <span className="text-slate-500">Before</span>
        <span className="text-slate-700 dark:text-slate-300">{data?.before?.size ?? 0} entries</span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-500">After</span>
        <span className="text-emerald-500">{data?.after?.size ?? 0} entries</span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-500">Max Size</span>
        <span className="text-slate-700 dark:text-slate-300">{data?.before?.maxSize ?? 'N/A'}</span>
      </div>
    </div>
  );
}

// ── WS Clients ──
function WsClientsResult({ data }: { data: any }) {
  const clients = data?.clients ?? [];
  return (
    <div className="space-y-1">
      <div className="text-xs text-slate-500 mb-1">Total: {data?.total ?? 0}</div>
      {clients.map((c: any, i: number) => (
        <div key={i} className="text-[11px] py-1 border-b border-slate-50 dark:border-slate-700 last:border-0">
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <span>User: {c.userId ?? 'N/A'} · Account: {c.tradingAccountId ?? 'N/A'}</span>
            <span className={c.isAlive ? 'text-emerald-500' : 'text-amber-500'}>{c.isAlive ? 'Alive' : 'Stale'}</span>
          </div>
          {c.subscriptions?.length > 0 && (
            <div className="text-slate-400 mt-0.5">Subs: {c.subscriptions.join(', ')}</div>
          )}
        </div>
      ))}
      {clients.length === 0 && <p className="text-xs text-slate-400">No clients connected</p>}
    </div>
  );
}

// ── Logs ──
function LogsResult({ data }: { data: any }) {
  const logs = data?.logs ?? [];
  const levelColors: Record<string, string> = {
    debug: 'text-slate-400',
    info: 'text-blue-500',
    warn: 'text-amber-500',
    error: 'text-red-500',
  };

  return (
    <div className="space-y-0 max-h-72 overflow-y-auto font-mono text-[11px]">
      {logs.map((log: any, i: number) => (
        <div key={i} className="py-0.5 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
          <span className={levelColors[log.level] ?? 'text-slate-500'}>[{log.level?.toUpperCase()}]</span>
          {' '}
          <span className="text-slate-400">{log.source ? `[${log.source}] ` : ''}</span>
          <span className="text-slate-600 dark:text-slate-300">{log.message}</span>
        </div>
      ))}
      {logs.length === 0 && <p className="text-xs text-slate-400 font-sans">No logs found</p>}
    </div>
  );
}

// ── Rate Limit ──
function RateLimitResult({ data }: { data: any }) {
  return (
    <div className="space-y-1 text-xs">
      <div className="flex justify-between">
        <span className="text-slate-500">Window</span>
        <span className="text-slate-700 dark:text-slate-300">{data?.windowMinutes ?? 15} minutes</span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-500">Max Requests</span>
        <span className="text-slate-700 dark:text-slate-300">{data?.maxRequests ?? 200}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-500">Remaining</span>
        <span className="text-slate-700 dark:text-slate-300">{data?.remaining ?? 'N/A'}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-500">Resets At</span>
        <span className="text-slate-700 dark:text-slate-300">{data?.resetAt && data.resetAt !== 'N/A' ? new Date(data.resetAt).toLocaleTimeString() : 'N/A'}</span>
      </div>
    </div>
  );
}

// ── Strategy ──
function StrategyResult({ data }: { data: any }) {
  const accounts = data?.accounts ?? [];
  return (
    <div className="space-y-2">
      {accounts.map((a: any) => (
        <div key={a.accountId} className="text-xs">
          <div className="font-medium text-slate-600 dark:text-slate-300 mb-1">Account #{a.accountId}</div>
          {Object.keys(a.strategies).length > 0 ? (
            Object.entries(a.strategies).map(([id, s]: [string, any]) => (
              <div key={id} className="flex items-center justify-between py-0.5 pl-2 border-l-2 border-slate-200 dark:border-slate-600 ml-1">
                <span className="text-slate-500">{id}</span>
                <span className={s.paused ? 'text-amber-500' : 'text-emerald-500'}>
                  {s.paused ? 'Paused' : 'Active'}
                </span>
              </div>
            ))
          ) : (
            <p className="text-slate-400 pl-2">No strategies initialized</p>
          )}
        </div>
      ))}
      {accounts.length === 0 && <p className="text-xs text-slate-400">No accounts with strategies</p>}
    </div>
  );
}

// ── Fallback JSON ──
function JsonResult({ data }: { data: any }) {
  return (
    <pre className="text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-900 rounded p-2 overflow-x-auto max-h-48">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
