'use client';

import { useState, useRef, useEffect } from 'react';
import { LogOut, Clock, Sun, Moon, Monitor, ShieldCheck, Users } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useTimezoneStore } from '@/store/timezoneStore';
import { useThemeStore, Theme } from '@/store/themeStore';
import { COMMON_TIMEZONES, getAllTimezones } from '@/lib/timezoneUtils';
import toast from 'react-hot-toast';

interface UserAvatarProps {
  onNavigateToUsers?: () => void;
}

export function UserAvatar({ onNavigateToUsers }: UserAvatarProps) {
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const { selectedTimezone, setTimezone } = useTimezoneStore();
  const theme = useThemeStore(s => s.theme);
  const setTheme = useThemeStore(s => s.setTheme);
  const isHydrated = useThemeStore(s => s.isHydrated);

  const [isOpen, setIsOpen] = useState(false);
  const [showTimezoneDropdown, setShowTimezoneDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllTimezones, setShowAllTimezones] = useState(false);
  const [allTimezones, setAllTimezones] = useState(COMMON_TIMEZONES);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === 'admin';

  // Load all timezones when toggled
  useEffect(() => {
    if (showAllTimezones) {
      if (allTimezones.length === COMMON_TIMEZONES.length) {
        setAllTimezones(getAllTimezones());
      }
    } else {
      setAllTimezones(COMMON_TIMEZONES);
    }
  }, [showAllTimezones, allTimezones.length]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowTimezoneDropdown(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    toast.success('Logged out successfully');
  };

  const handleNavigateToUsers = () => {
    setIsOpen(false);
    onNavigateToUsers?.();
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    toast.success(`Theme changed to ${newTheme}`);
  };

  const handleTimezoneChange = (timezone: string) => {
    setTimezone(timezone);
    setShowTimezoneDropdown(false);
    setSearchTerm('');
    toast.success(`Timezone changed to ${timezone}`);
  };

  const getCurrentTimezoneLabel = () => {
    const tz = allTimezones.find(t => t.value === selectedTimezone);
    return tz ? tz.label : selectedTimezone;
  };

  const filteredTimezones = allTimezones.filter(
    tz =>
      tz.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tz.value.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const getInitials = (name: string | undefined) =>
    (name || '?')
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const getThemeIcon = (t: string) => {
    if (t === 'dark') return <Moon className="w-4 h-4" />;
    if (t === 'system') return <Monitor className="w-4 h-4" />;
    return <Sun className="w-4 h-4" />;
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-white font-semibold hover:from-primary-600 hover:to-primary-700 transition-all shadow-md hover:shadow-lg overflow-hidden"
        title="User menu"
      >
        {user.avatar_path ? (
          <img
            src={user.avatar_path}
            alt={user.username}
            className="w-full h-full object-cover"
            onError={e => {
              (e.target as HTMLImageElement).style.display = 'none';
              const next = (e.target as HTMLImageElement).nextElementSibling;
              if (next) (next as HTMLElement).style.display = 'flex';
            }}
          />
        ) : null}
        <span className={user.avatar_path ? 'hidden' : ''}>{getInitials(user.username)}</span>
      </button>

      {/* Dropdown Popup */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50">
          <div className="p-4">
            {/* Header: Avatar + name + logout */}
            <div className="flex items-start justify-between mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-white font-semibold flex items-center justify-center overflow-hidden">
                  {user.avatar_path ? (
                    <img
                      src={user.avatar_path}
                      alt={user.username}
                      className="w-full h-full object-cover"
                      onError={e => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const next = (e.target as HTMLImageElement).nextElementSibling;
                        if (next) (next as HTMLElement).style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <span className={user.avatar_path ? 'hidden' : ''}>{getInitials(user.username)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
                    {user.username}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex-shrink-0 ml-2 p-2 text-slate-500 dark:text-slate-400 hover:text-danger-500 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>

            {/* Role */}
            <div className="mb-4 flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-300">
              <ShieldCheck className="w-4 h-4" />
              <span className="font-medium">Role:</span>
              <span className="capitalize">{user.role || 'User'}</span>
            </div>

            {/* Admin: Manage Users */}
            {isAdmin && onNavigateToUsers && (
              <button
                onClick={handleNavigateToUsers}
                className="w-full mb-4 flex items-center space-x-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 rounded-lg transition-colors"
              >
                <Users className="w-4 h-4" />
                <span>Manage Users</span>
              </button>
            )}

            {/* Theme Selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Theme
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['light', 'dark', 'system'] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => handleThemeChange(opt)}
                    disabled={!isHydrated}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-colors ${
                      theme === opt
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
                    } ${!isHydrated ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {getThemeIcon(opt)}
                    <span className="text-xs mt-1 capitalize">{opt}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Timezone Selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Timezone
              </label>
              <button
                onClick={() => setShowTimezoneDropdown(!showTimezoneDropdown)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 rounded-lg transition-colors"
              >
                <div className="flex items-center space-x-2 min-w-0">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{getCurrentTimezoneLabel()}</span>
                </div>
                <svg
                  className={`w-4 h-4 flex-shrink-0 transition-transform ${showTimezoneDropdown ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showTimezoneDropdown && (
                <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Select Timezone
                    </span>
                    <button
                      onClick={() => setShowAllTimezones(!showAllTimezones)}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      {showAllTimezones ? 'Show Common' : 'Show All'}
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Search timezones..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-2"
                  />

                  <div className="max-h-48 overflow-y-auto">
                    {filteredTimezones.length === 0 ? (
                      <div className="text-xs text-slate-500 dark:text-slate-400 text-center py-2">
                        No timezones found
                      </div>
                    ) : (
                      filteredTimezones.map(tz => (
                        <button
                          key={tz.value}
                          onClick={() => handleTimezoneChange(tz.value)}
                          className={`w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors ${
                            selectedTimezone === tz.value
                              ? 'bg-primary-100 dark:bg-primary-900 text-primary-900 dark:text-primary-100'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-medium truncate">{tz.label}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono ml-2 flex-shrink-0">
                              {tz.offset}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
