'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useAccountStore } from '@/store/accountStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Header } from './Header';
import { Sidebar, TabId } from './Sidebar';
import { PortfolioDashboard } from './portfolio';
import { StrategiesMonitor } from './strategies';
import { ChartView } from './chart';
import { BacktestDashboard } from './backtest';
import { AccountsManager } from './accounts';
import { UsersManager } from './users';
import { SystemMonitor } from './system';
import { SettingsPanel } from './settings';
import api from '@/lib/api';

/**
 * Dashboard — main app shell after login.
 * Manages tab routing, sidebar, header, and WebSocket connection.
 */
export function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('portfolio');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const user = useAuthStore(s => s.user);
  const setAccounts = useAccountStore(s => s.setAccounts);

  const { isConnected } = useWebSocket({ channels: ['portfolio', 'strategies', 'trades'] });

  // Load user's trading accounts on mount
  useEffect(() => {
    async function loadAccounts() {
      try {
        const res = await api.accounts.list();
        const mapped = (res.data || []).map((a: any) => ({
          id: a.id,
          userId: a.user_id,
          exchange: a.exchange,
          isTest: a.is_test,
          isActive: a.is_active,
          currentBalance: Number(a.current_balance || 0),
          hasApiKeys: !!(a.api_key),
        }));
        setAccounts(mapped);
      } catch {
        // Silently fail — user may not have accounts yet
      }
    }

    loadAccounts();
  }, [setAccounts]);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileMenuOpen={isMobileMenuOpen}
        onMobileMenuClose={() => setIsMobileMenuOpen(false)}
        isAdmin={user?.role === 'admin'}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onMobileMenuToggle={() => setIsMobileMenuOpen(v => !v)}
          wsConnected={isConnected}
          onNavigateToSystem={() => setActiveTab('system')}
          onNavigateToUsers={() => setActiveTab('users')}
          activeTab={activeTab}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <TabContent tab={activeTab} setActiveTab={setActiveTab} />
        </main>
      </div>
    </div>
  );
}

/**
 * Tab content router — renders real components or placeholder panels.
 */
function TabContent({ tab, setActiveTab }: { tab: TabId; setActiveTab: (tab: TabId) => void }) {
  // Portfolio tab — Phase 7 (implemented)
  if (tab === 'portfolio') {
    return (
      <PortfolioDashboard
        onNavigateToStrategies={() => setActiveTab('strategies')}
      />
    );
  }

  // Strategies tab — Phase 8 (implemented)
  if (tab === 'strategies') {
    return <StrategiesMonitor />;
  }

  // Chart tab — Phase 9 (implemented)
  if (tab === 'chart') {
    return <ChartView />;
  }

  // Backtest tab — Phase 10
  if (tab === 'backtest') {
    return <BacktestDashboard />;
  }

  // Accounts tab — Phase 10
  if (tab === 'accounts') {
    return <AccountsManager />;
  }

  // Users tab — Phase 10
  if (tab === 'users') {
    return <UsersManager />;
  }

  // System tab — Phase 10
  if (tab === 'system') {
    return <SystemMonitor />;
  }

  // Settings tab — Phase 10
  if (tab === 'settings') {
    return <SettingsPanel />;
  }

  // Fallback for unknown tabs
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{tab}</h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm">This tab is not yet implemented.</p>
      </div>
    </div>
  );
}
