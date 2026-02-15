'use client';

import { Toaster } from 'react-hot-toast';

/**
 * Client-side providers wrapper.
 * Wraps the entire app with context providers and global UI elements.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--toast-bg, #fff)',
            color: 'var(--toast-color, #1e293b)',
            border: '1px solid var(--toast-border, #e2e8f0)',
          },
          success: {
            iconTheme: { primary: '#22c55e', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
            duration: 6000,
          },
        }}
      />
    </>
  );
}
