'use client';

import { useAuthStore } from '@/store/auth';
import { clsx } from 'clsx';
import {
  AutoAwesome as AICoachIcon,
  FitnessCenter as WorkoutIcon,
  History as HistoryIcon,
  Home as HomeIcon,
  TrendingUp as ProgressIcon,
} from '@mui/icons-material';
import { usePathname, useRouter } from 'next/navigation';

// Mobile nav caps at 5 items (see DESIGN.md Section 7). Settings isn't a dedicated tab
// here - it's one tap away via the profile menu in AppHeader on every page - so Home and
// Workout (the two contexts the brief calls out explicitly) both get a slot instead.
const navigationItems = [
  { label: 'Home', path: '/dashboard', icon: HomeIcon },
  { label: 'Workout', path: '/workout', icon: WorkoutIcon },
  { label: 'Progress', path: '/progress', icon: ProgressIcon },
  { label: 'History', path: '/history', icon: HistoryIcon },
  { label: 'AI Coach', path: '/ai-coach', icon: AICoachIcon },
];

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated || pathname === '/login' || pathname === '/register' || pathname === '/') {
    return null;
  }

  return (
    <nav
      data-testid="bottom-navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border-default bg-surface-1/95 backdrop-blur md:hidden"
    >
      <div className="flex h-16 items-stretch justify-around px-1">
        {navigationItems.map(item => {
          const active = pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => router.push(item.path)}
              data-testid={`${item.label.toLowerCase().replace(' ', '-')}-nav`}
              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1"
            >
              <Icon
                fontSize="small"
                className={active ? 'text-accent' : 'text-text-tertiary'}
              />
              <span
                className={clsx(
                  'text-[11px] font-medium',
                  active ? 'text-accent' : 'text-text-tertiary'
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
