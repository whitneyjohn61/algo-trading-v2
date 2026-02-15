'use client';

import { useState } from 'react';
import {
  BarChart3, TrendingUp, LineChart, History,
  Users, Wallet, Settings, Monitor,
  ChevronLeft, ChevronRight, X,
} from 'lucide-react';

export type TabId =
  | 'portfolio'
  | 'strategies'
  | 'chart'
  | 'backtest'
  | 'accounts'
  | 'users'
  | 'system'
  | 'settings';

interface SidebarProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  isMobileMenuOpen?: boolean;
  onMobileMenuClose?: () => void;
  isAdmin?: boolean;
}

const menuItems: { id: TabId; label: string; icon: React.ComponentType<any>; adminOnly?: boolean }[] = [
  { id: 'portfolio', label: 'Portfolio', icon: BarChart3 },
  { id: 'strategies', label: 'Strategies', icon: TrendingUp },
  { id: 'chart', label: 'Chart', icon: LineChart },
  { id: 'backtest', label: 'Backtest', icon: History },
  { id: 'accounts', label: 'Accounts', icon: Wallet },
  { id: 'users', label: 'Users', icon: Users, adminOnly: true },
  { id: 'system', label: 'System', icon: Monitor },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({
  activeTab,
  setActiveTab,
  isMobileMenuOpen = false,
  onMobileMenuClose,
  isAdmin = false,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const visibleItems = menuItems.filter(item => !item.adminOnly || isAdmin);

  function handleTabClick(tab: TabId) {
    setActiveTab(tab);
    onMobileMenuClose?.();
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[100] lg:hidden"
          onClick={onMobileMenuClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          ${isCollapsed ? 'w-16' : 'w-56'}
          bg-white dark:bg-slate-800 shadow-sm border-r border-slate-200 dark:border-slate-700
          min-h-screen transition-all duration-300 relative flex-shrink-0
          ${isMobileMenuOpen ? 'fixed inset-y-0 left-0 z-[110] w-56' : 'hidden lg:block'}
        `}
      >
        {/* Mobile close button */}
        {isMobileMenuOpen && (
          <button
            onClick={onMobileMenuClose}
            className="absolute top-3 right-3 p-1 rounded-md text-slate-400 hover:text-slate-600 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={() => setIsCollapsed(c => !c)}
          className="hidden lg:flex absolute -right-3 top-6 w-6 h-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full items-center justify-center shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors z-10"
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Navigation items */}
        <nav className="mt-4 px-2 space-y-0.5">
          {visibleItems.map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-200'
                  }
                `}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-primary-500' : ''}`} />
                {!isCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
