'use client';

import { navIndicatorTransition } from '@/lib/motion';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth';
import { clsx } from 'clsx';
import {
  AutoAwesome as AICoachIcon,
  CalendarMonth as PlanIcon,
  FitnessCenter as WorkoutIcon,
  FitnessCenterOutlined as ExercisesIcon,
  History as HistoryIcon,
  Home as HomeIcon,
  Logout as LogoutIcon,
  Settings as SettingsIcon,
  TrendingUp as ProgressIcon,
} from '@mui/icons-material';
import { Avatar } from '@mui/material';
import { motion } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';

const navSections = [
  {
    items: [
      { label: 'Home', path: '/dashboard', icon: HomeIcon },
      { label: 'Workout', path: '/workout', icon: WorkoutIcon },
      { label: 'Plan', path: '/plan', icon: PlanIcon },
      { label: 'Progress', path: '/progress', icon: ProgressIcon },
      { label: 'History', path: '/history', icon: HistoryIcon },
      { label: 'AI Coach', path: '/ai-coach', icon: AICoachIcon },
    ],
  },
  {
    items: [
      { label: 'Exercises', path: '/exercises', icon: ExercisesIcon },
      { label: 'Settings', path: '/profile', icon: SettingsIcon },
    ],
  },
];

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuthStore();
  const { logout } = useAuth();

  if (!isAuthenticated || pathname === '/login' || pathname === '/register' || pathname === '/') {
    return null;
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border-default bg-surface-1 md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-border-default px-5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent font-mono text-sm font-bold text-accent-foreground">
          I
        </span>
        <span className="font-mono text-lg font-bold tracking-tight text-text-primary">
          IRONLOG
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
        {navSections.map((section, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            {section.items.map(item => {
              const active = pathname === item.path;
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => router.push(item.path)}
                  className={clsx(
                    'relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                    active
                      ? 'bg-accent/10 text-accent'
                      : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-nav-indicator"
                      transition={navIndicatorTransition}
                      className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-accent"
                    />
                  )}
                  <Icon fontSize="small" />
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-border-default p-3">
        <button
          type="button"
          onClick={() => router.push('/profile')}
          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2"
        >
          <Avatar className="!h-9 !w-9 !bg-accent !text-accent-foreground !text-sm !font-semibold">
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-primary">
              {user?.name || 'Athlete'}
            </p>
            <p className="truncate text-xs text-text-tertiary">{user?.email}</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => logout()}
          data-testid="logout-button"
          className="mt-1 flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-danger"
        >
          <LogoutIcon fontSize="small" />
          Log out
        </button>
      </div>
    </aside>
  );
}
