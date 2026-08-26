'use client';

import { motion } from 'framer-motion';

interface AiLoadingIndicatorProps {
  label?: string;
  className?: string;
}

// Branded loading state for anywhere content is coming from the AI coach (analysis,
// weekly plans, why-stuck, etc.) - the app's own logo mark (see Sidebar's "I IRONLOG"),
// breathing with an orbiting ring, instead of a generic skeleton/spinner.
export function AiLoadingIndicator({ label = 'Your coach is thinking...', className }: AiLoadingIndicatorProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 py-10 ${className ?? ''}`}>
      <div className="relative flex h-14 w-14 items-center justify-center">
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-accent/30 border-t-accent"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
        />
        <motion.span
          className="flex h-9 w-9 items-center justify-center rounded-md bg-accent font-mono text-base font-bold text-accent-foreground"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
        >
          I
        </motion.span>
      </div>
      <motion.p
        className="text-sm text-text-secondary"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
      >
        {label}
      </motion.p>
    </div>
  );
}
