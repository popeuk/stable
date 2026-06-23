"use client";

import { useId } from "react";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /** Draw a soft area fill under the line. */
  area?: boolean;
  /** Override the auto sign-based colour. */
  color?: string;
  strokeWidth?: number;
  className?: string;
}

/**
 * Tiny custom SVG sparkline (section 7.7). Auto-scales to its data, with an
 * optional area fill. Colour defaults to success/danger based on the last
 * value's sign. A zero baseline is drawn when the range crosses zero.
 */
export function Sparkline({
  data,
  width = 120,
  height = 40,
  area = false,
  color,
  strokeWidth = 1.5,
  className,
}: SparklineProps) {
  const gradientId = useId();
  if (data.length === 0) return null;

  const min = Math.min(...data, 0);
  const max = Math.max(...data, 0);
  const range = max - min || 1;
  const pad = strokeWidth + 1;

  const x = (i: number) =>
    data.length === 1 ? width / 2 : (i / (data.length - 1)) * (width - pad * 2) + pad;
  const y = (v: number) =>
    height - pad - ((v - min) / range) * (height - pad * 2);

  const line = data.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = data[data.length - 1];
  const stroke = color ?? (last >= 0 ? "var(--c-success)" : "var(--c-danger)");

  const zeroY = y(0);
  const areaPath = `${line} L${x(data.length - 1).toFixed(1)},${(height - pad).toFixed(1)} L${x(0).toFixed(1)},${(height - pad).toFixed(1)} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {min < 0 && max > 0 && (
        <line
          x1={0}
          x2={width}
          y1={zeroY}
          y2={zeroY}
          stroke="var(--border-default)"
          strokeWidth={0.5}
          strokeDasharray="2 3"
        />
      )}
      {area && <path d={areaPath} fill={`url(#${gradientId})`} />}
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
