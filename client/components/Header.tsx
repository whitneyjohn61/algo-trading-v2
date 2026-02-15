'use client';

import { useState } from 'react';
import { ModeToggle } from './ModeToggle';
import { SystemHealthChip } from './SystemHealthChip';
import { GeoLocationChip } from './GeoLocationChip';
import { UserAvatar } from './UserAvatar';
import { HelpPanel } from './HelpPanel';
import { Menu, HelpCircle } from 'lucide-react';
import type { TabId } from './Sidebar';

interface HeaderProps {
  onMobileMenuToggle?: () => void;
  wsConnected?: boolean;
  onNavigateToSystem?: () => void;
  onNavigateToUsers?: () => void;
  activeTab?: TabId;
}

export function Header({ onMobileMenuToggle, wsConnected = false, onNavigateToSystem, onNavigateToUsers, activeTab }: HeaderProps) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <>
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="px-3 sm:px-6 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Left: hamburger + title */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {onMobileMenuToggle && (
                <button
                  onClick={onMobileMenuToggle}
                  className="lg:hidden p-1.5 -ml-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  aria-label="Toggle menu"
                >
                  <Menu className="w-5 h-5" />
                </button>
              )}
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Algo Trading <span className="text-primary-500">V2</span>
              </h1>
            </div>

            {/* Right: health chip, geo chip, help, mode toggle, user avatar */}
            <div className="flex items-center gap-1 sm:gap-2">
              <SystemHealthChip wsConnected={wsConnected} onNavigateToSystem={onNavigateToSystem} />

              <GeoLocationChip />

              <button
                onClick={() => setHelpOpen(true)}
                className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                aria-label="Help & Documentation"
                title="Help & Documentation"
              >
                <HelpCircle className="w-4 h-4" />
              </button>

              <ModeToggle />

              <UserAvatar onNavigateToUsers={onNavigateToUsers} />
            </div>
          </div>
        </div>
      </header>

      <HelpPanel
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        activeTab={activeTab}
      />
    </>
  );
}
