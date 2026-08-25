import { clsx } from 'clsx';

type MetricSize = 'lg' | 'xl';

export interface MetricProps {
  value: string | number;
  unit?: string;
  label?: string;
  size?: MetricSize;
  className?: string;
}

/**
 * The mono-face display number used for every workout metric (weight, reps, rest time).
 * Nike's "billboard above, catalog below" contrast: the number is the loudest thing on
 * the screen, the label stays quiet. See DESIGN.md Section 4/9.
 */
export function Metric({ value, unit, label, size = 'lg', className }: MetricProps) {
  return (
    <div className={clsx('flex flex-col items-start', className)}>
      <div
        className={clsx(
          'font-mono font-bold leading-none tracking-tight text-text-primary tabular-nums',
          size === 'xl' ? 'text-6xl md:text-7xl' : 'text-4xl'
        )}
      >
        {value}
        {unit && <span className="ml-1.5 text-[0.4em] font-semibold text-text-tertiary">{unit}</span>}
      </div>
      {label && (
        <div className="mt-2 text-xs font-medium uppercase tracking-wide text-text-tertiary">
          {label}
        </div>
      )}
    </div>
  );
}
