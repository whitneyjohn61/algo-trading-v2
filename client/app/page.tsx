'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { Dashboard } from '@/components/Dashboard';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function Home() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);

  // Wait for Zustand hydration from localStorage
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace('/login');
    }
  }, [hydrated, isAuthenticated, router]);

  if (!hydrated) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <LoadingSpinner size="lg" label="Loading..." />
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <LoadingSpinner size="lg" label="Redirecting to login..." />
      </main>
    );
  }

  return <Dashboard />;
}
