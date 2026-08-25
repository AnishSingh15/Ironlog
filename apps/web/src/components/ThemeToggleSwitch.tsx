'use client';

import { DarkMode, LightMode } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

// 6. Dark/Light Toggle - an animated switch (not a 3-state icon-cycle button) so the
// thumb visibly slides between states, matching the reference's own toggle treatment.
export function ThemeToggleSwitch() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="relative flex h-8 w-14 shrink-0 items-center rounded-full bg-surface-3 px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-1 text-text-primary shadow-[var(--il-shadow-float)]"
        style={{ marginLeft: isDark ? 'auto' : 0 }}
      >
        {isDark ? <DarkMode sx={{ fontSize: 14 }} /> : <LightMode sx={{ fontSize: 14 }} />}
      </motion.span>
    </button>
  );
}
