'use client';

import { useThemeStore } from '@/store/themeStore';
import { Sun, Moon, Monitor } from 'lucide-react';

export function ThemeToggle() {
  const theme = useThemeStore(s => s.theme);
  const setTheme = useThemeStore(s => s.setTheme);

  function cycle() {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(next);
  }

  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <button
      onClick={cycle}
      className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      title={`Theme: ${theme}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
