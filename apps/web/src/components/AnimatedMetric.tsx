'use client';

import { animate, useMotionValue, useTransform } from 'framer-motion';
import { useEffect, useRef } from 'react';

interface AnimatedMetricProps {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}

// 2. Progress Update - a metric count-up animation used wherever a number changes in
// place (dashboard stats, exercise PRs) rather than just snapping to the new value.
export function AnimatedMetric({ value, decimals = 0, suffix = '', className }: AnimatedMetricProps) {
  const motionValue = useMotionValue(value);
  const rounded = useTransform(motionValue, latest => latest.toFixed(decimals));
  const spanRef = useRef<HTMLSpanElement>(null);
  const previousValue = useRef(value);

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: previousValue.current === value ? 0 : 0.6,
      ease: 'easeOut',
    });
    previousValue.current = value;
    return controls.stop;
  }, [value, motionValue]);

  useEffect(() => {
    return rounded.on('change', latest => {
      if (spanRef.current) spanRef.current.textContent = `${latest}${suffix}`;
    });
  }, [rounded, suffix]);

  return (
    <span ref={spanRef} className={className}>
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
