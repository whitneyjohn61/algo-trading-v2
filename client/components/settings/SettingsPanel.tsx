'use client';

import { useThemeStore } from '@/store/themeStore';
import { useTimezoneStore } from '@/store/timezoneStore';
import { Sun, Moon, Monitor, Globe, Bell } from 'lucide-react';

const THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Rome',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
];

export function SettingsPanel() {
  const { theme, setTheme } = useThemeStore();
  const selectedTimezone = useTimezoneStore(s => s.selectedTimezone);
  const setTimezone = useTimezoneStore(s => s.setTimezone);

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h2>

      {/* Theme */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <Sun className="w-4 h-4 text-slate-400" />
          Theme
        </h3>
        <div className="flex gap-2">
          {THEMES.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.value}
                onClick={() => setTheme(t.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  theme === t.value
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 border border-primary-300 dark:border-primary-700'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Timezone */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4 text-slate-400" />
          Timezone
        </h3>
        <select
          value={selectedTimezone}
          onChange={e => setTimezone(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white"
        >
          {COMMON_TIMEZONES.map(tz => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Used for displaying dates and times throughout the app.
        </p>
      </div>

      {/* Notifications (placeholder) */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-400" />
          Notifications
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Notification preferences (Slack integration) will be available after notification service setup.
        </p>
        <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
          <p className="text-xs text-slate-400 text-center">Coming soon</p>
        </div>
      </div>
    </div>
  );
}
