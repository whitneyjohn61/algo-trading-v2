'use client';

type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  pulse?: boolean;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  success: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400',
  danger: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  info: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
  neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

const dotVariants: Record<BadgeVariant, string> = {
  success: 'bg-success-500',
  danger: 'bg-danger-500',
  warning: 'bg-amber-500',
  info: 'bg-primary-500',
  neutral: 'bg-slate-400',
};

export function StatusBadge({ label, variant = 'neutral', pulse = false, className = '' }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotVariants[variant]} ${pulse ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  );
}

/** Helper: map common status strings to badge props */
export function getStatusBadgeProps(status: string): { label: string; variant: BadgeVariant; pulse?: boolean } {
  switch (status) {
    case 'running': return { label: 'Running', variant: 'success', pulse: true };
    case 'active': return { label: 'Active', variant: 'success' };
    case 'paused': return { label: 'Paused', variant: 'warning' };
    case 'halted': return { label: 'Halted', variant: 'danger', pulse: true };
    case 'idle': return { label: 'Idle', variant: 'neutral' };
    case 'error': return { label: 'Error', variant: 'danger' };
    case 'pending': return { label: 'Pending', variant: 'info' };
    case 'closed': return { label: 'Closed', variant: 'neutral' };
    case 'cancelled': return { label: 'Cancelled', variant: 'neutral' };
    case 'connected': return { label: 'Connected', variant: 'success', pulse: true };
    case 'disconnected': return { label: 'Disconnected', variant: 'danger' };
    default: return { label: status, variant: 'neutral' };
  }
}
