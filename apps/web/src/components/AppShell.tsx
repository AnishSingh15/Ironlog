'use client';

import { useAuthStore } from '@/store/auth';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated } = useAuthStore();
  const showChrome =
    isAuthenticated && pathname !== '/login' && pathname !== '/register' && pathname !== '/';

  return (
    <>
      <Sidebar />
      <div className={showChrome ? 'md:pl-60' : undefined}>{children}</div>
    </>
  );
}
