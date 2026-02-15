'use client';

interface DrawdownGaugeProps {
  drawdownPct: number;
  threshold?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: { width: 80, height: 44, stroke: 6, fontSize: 'text-xs' },
  md: { width: 120, height: 66, stroke: 8, fontSize: 'text-sm' },
  lg: { width: 160, height: 88, stroke: 10, fontSize: 'text-base' },
};

export function DrawdownGauge({
  drawdownPct,
  threshold = 25,
  size = 'md',
  showLabel = true,
  className = '',
}: DrawdownGaugeProps) {
  const cfg = sizeConfig[size];
  const radius = (cfg.width - cfg.stroke) / 2;
  const circumference = Math.PI * radius; // Half circle
  const normalizedPct = Math.min(drawdownPct, 50); // Cap at 50% for visual
  const progress = (normalizedPct / 50) * circumference;
  const thresholdPos = (threshold / 50) * circumference;

  // Color: green < 10%, yellow 10-20%, red > 20%
  let color = '#22c55e';
  if (drawdownPct >= 20) color = '#ef4444';
  else if (drawdownPct >= 10) color = '#f59e0b';

  const cx = cfg.width / 2;
  const cy = cfg.height;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg width={cfg.width} height={cfg.height + 4} viewBox={`0 0 ${cfg.width} ${cfg.height + 4}`}>
        {/* Background arc */}
        <path
          d={`M ${cfg.stroke / 2} ${cy} A ${radius} ${radius} 0 0 1 ${cfg.width - cfg.stroke / 2} ${cy}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={cfg.stroke}
          className="text-slate-200 dark:text-slate-700"
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <path
          d={`M ${cfg.stroke / 2} ${cy} A ${radius} ${radius} 0 0 1 ${cfg.width - cfg.stroke / 2} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth={cfg.stroke}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
        {/* Threshold marker */}
        {threshold < 50 && (
          <path
            d={`M ${cfg.stroke / 2} ${cy} A ${radius} ${radius} 0 0 1 ${cfg.width - cfg.stroke / 2} ${cy}`}
            fill="none"
            stroke="#ef4444"
            strokeWidth={1}
            strokeOpacity={0.4}
            strokeDasharray={`0 ${thresholdPos - 1} 2 ${circumference}`}
          />
        )}
        {/* Center text */}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          className={`${cfg.fontSize} font-bold fill-slate-900 dark:fill-white`}
        >
          {drawdownPct.toFixed(1)}%
        </text>
      </svg>
      {showLabel && (
        <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">Drawdown</span>
      )}
    </div>
  );
}
