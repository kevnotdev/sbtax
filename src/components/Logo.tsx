import React from 'react';
import { cx } from './ui';

/**
 * The TaxPilot mark: a paper plane, because a tax return is paper and a pilot gets it where
 * it's going. The fold of the plane doubles as a tick. `animate` plays the launch: the trail
 * draws, then the plane flies up it.
 *
 * `tone` picks colours for the background it sits on.
 */
export function Logo({
  className, tone = 'light', animate,
}: { className?: string; tone?: 'light' | 'dark'; animate?: boolean }) {
  const badge = tone === 'dark' ? '#e9f2ed' : '#0d3329';
  const plane = tone === 'dark' ? '#0d3329' : '#ffffff';
  const trail = tone === 'dark' ? '#2c8f72' : '#a8c6b8';
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="TaxPilot">
      <rect width="48" height="48" rx="12" fill={badge} />
      <path
        d="M9.5 39.5c2.5-5.5 6-8.5 11-10"
        fill="none"
        stroke={trail}
        strokeWidth="2.4"
        strokeLinecap="round"
        pathLength={1}
        className={animate ? 'logo-trail' : undefined}
      />
      <g className={cx(animate && 'logo-plane')}>
        <path d="M39 9 9.5 20.5l11.5 6z" fill={plane} />
        <path d="M39 9 21 26.5l5 12.5z" fill={plane} opacity="0.72" />
      </g>
    </svg>
  );
}
