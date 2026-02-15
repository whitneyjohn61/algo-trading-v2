'use client';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const sizes = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-3',
  lg: 'w-12 h-12 border-4',
};

export function LoadingSpinner({ size = 'md', className = '', label }: LoadingSpinnerProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 ${className}`}>
      <div
        className={`${sizes[size]} border-slate-200 dark:border-slate-700 border-t-primary-500 rounded-full animate-spin`}
      />
      {label && (
        <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      )}
    </div>
  );
}
