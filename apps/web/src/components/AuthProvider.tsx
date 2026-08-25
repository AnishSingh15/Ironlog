'use client';

import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth';
import { ReactNode, useEffect, useState } from 'react';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { checkAuth } = useAuth();
  const { isLoading } = useAuthStore();
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      if (authInitialized) return; // Prevent multiple initializations

      try {
        await checkAuth();
      } catch (error) {
        // checkAuth already clears auth state on failure; nothing else to do here.
      } finally {
        if (mounted) {
          setAuthInitialized(true);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, []); // Only run once

  // Show loading state during auth initialization
  if (!authInitialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-default border-t-accent" />
      </div>
    );
  }

  return <>{children}</>;
}
