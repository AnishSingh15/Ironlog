'use client';

import { celebrationBurst } from '@/lib/motion';
import { CheckCircle } from '@mui/icons-material';
import { AnimatePresence, motion } from 'framer-motion';

interface SetCompleteCelebrationProps {
  show: boolean;
  weightDeltaKg?: number;
}

// 1. Workout Set Complete - the icon-burst + "Great Set!" moment shown briefly after
// handleSetSubmit succeeds. Purely presentational; the caller owns the show/hide timing.
export function SetCompleteCelebration({ show, weightDeltaKg }: SetCompleteCelebrationProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          variants={celebrationBurst}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="pointer-events-none fixed inset-x-0 top-1/3 z-[60] flex flex-col items-center gap-2"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[var(--il-shadow-float)]">
            <CheckCircle fontSize="large" />
          </div>
          <p className="font-semibold text-text-primary">Great Set!</p>
          {typeof weightDeltaKg === 'number' && weightDeltaKg !== 0 && (
            <p className="font-mono text-sm text-accent">
              {weightDeltaKg > 0 ? '+' : ''}
              {weightDeltaKg}kg vs. last time
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
