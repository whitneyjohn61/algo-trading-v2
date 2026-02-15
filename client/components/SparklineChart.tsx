'use client';

import { useRef, useEffect } from 'react';

interface SparklineChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
  className?: string;
}

/**
 * Lightweight sparkline chart rendered via canvas.
 * No dependencies — pure HTML canvas for minimal overhead.
 */
export function SparklineChart({
  data,
  width = 120,
  height = 32,
  color,
  fillOpacity = 0.1,
  className = '',
}: SparklineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Auto-detect color: green if last > first, red otherwise
  const autoColor = data.length >= 2
    ? (data[data.length - 1]! >= data[0]! ? '#22c55e' : '#ef4444')
    : '#3b82f6';

  const lineColor = color || autoColor;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 2;

    const stepX = (width - padding * 2) / (data.length - 1);
    const scaleY = (v: number) =>
      height - padding - ((v - min) / range) * (height - padding * 2);

    // Fill area
    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();
    ctx.moveTo(padding, scaleY(data[0]!));
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(padding + i * stepX, scaleY(data[i]!));
    }
    ctx.lineTo(padding + (data.length - 1) * stepX, height);
    ctx.lineTo(padding, height);
    ctx.closePath();
    ctx.fillStyle = lineColor + Math.round(fillOpacity * 255).toString(16).padStart(2, '0');
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(padding, scaleY(data[0]!));
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(padding + i * stepX, scaleY(data[i]!));
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [data, width, height, lineColor, fillOpacity]);

  if (data.length < 2) {
    return <div className={`${className}`} style={{ width, height }} />;
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className={className}
    />
  );
}
