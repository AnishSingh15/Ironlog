'use client';

import { ThemeToggle } from '@/components/theme-toggle';
import { useWeightUnit } from '@/contexts/WeightUnitContext';
import { useAuthStore } from '@/store/auth';
import { Scale as ScaleIcon } from '@mui/icons-material';
import { Avatar, IconButton, Menu, MenuItem, Toolbar } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface AppHeaderProps {
  title?: string;
  showWeightToggle?: boolean;
}

/**
 * Slim utility bar shown above page content. Primary navigation lives in Sidebar
 * (desktop) and BottomNav (mobile) - this only carries page-local utilities and the
 * account menu, so it never duplicates the nav.
 */
export function AppHeader({ title, showWeightToggle = true }: AppHeaderProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { useMetricSystem, toggleWeightUnit } = useWeightUnit();
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null);

  const handleLogout = () => {
    setProfileMenuAnchor(null);
    logout();
    router.push('/login');
  };

  return (
    <Toolbar
      disableGutters
      className="!min-h-14 border-b border-border-default px-4 md:px-6"
    >
      {title && <h1 className="flex-1 text-lg font-semibold text-text-primary">{title}</h1>}
      {!title && <div className="flex-1" />}

      <div className="flex items-center gap-1">
        {showWeightToggle && (
          <IconButton
            onClick={toggleWeightUnit}
            size="small"
            title={`Switch to ${useMetricSystem ? 'pounds' : 'kilograms'}`}
          >
            <ScaleIcon fontSize="small" className="text-text-secondary" />
          </IconButton>
        )}
        <ThemeToggle />
        <IconButton onClick={e => setProfileMenuAnchor(e.currentTarget)} size="small">
          <Avatar className="!h-8 !w-8 !bg-accent !text-accent-foreground !text-sm !font-semibold">
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </Avatar>
        </IconButton>
        <Menu
          anchorEl={profileMenuAnchor}
          open={Boolean(profileMenuAnchor)}
          onClose={() => setProfileMenuAnchor(null)}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <MenuItem onClick={() => router.push('/profile')}>Profile</MenuItem>
          <MenuItem onClick={handleLogout} data-testid="logout-button">
            Log out
          </MenuItem>
        </Menu>
      </div>
    </Toolbar>
  );
}
