'use client';

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
  const { isAuthenticated } = useAuthStore();
  const { logout } = useAuth();

  if (!isAuthenticated || pathname === '/login' || pathname === '/register' || pathname === '/') {
    return null;
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border-default bg-surface-1 md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-border-default px-5">
        <span className="font-mono text-lg font-bold tracking-tight text-text-primary">IRONLOG</span>
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
                    'flex h-10 items-center gap-3 rounded-lg border-l-2 px-3 text-sm font-medium transition-colors',
                    active
                      ? 'border-l-accent bg-accent/10 text-accent'
                      : 'border-l-transparent text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                  )}
                >
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
          onClick={() => logout()}
          data-testid="logout-button"
          className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-danger"
        >
          <LogoutIcon fontSize="small" />
          Log out
        </button>
      </div>
    </aside>
  );
}
