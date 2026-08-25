import apiClient, { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function useAuth() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, setUser, setLoading, logout } = useAuthStore();

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);

      const response = await apiClient.login({ email, password });

      if (response.success && response.data?.user) {
        setUser(response.data.user);
        router.push('/dashboard');
        return { success: true };
      } else {
        return {
          success: false,
          error: 'Login failed - invalid response',
        };
      }
    } catch (error: any) {
      // Handle different types of errors
      let errorMessage = 'Login failed';
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please try again.';
      } else if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      setLoading(true);

      const response = await apiClient.register({ name, email, password });

      setUser((response.data as any)?.user);
      router.push('/dashboard');
      return { success: true };
    } catch (error: any) {
      // Handle different types of errors
      let errorMessage = 'Registration failed';
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please try again.';
      } else if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  };

  const logoutUser = async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      // Ignore logout errors
    } finally {
      logout();
      router.push('/');
    }
  };

  const checkAuth = async () => {
    // Check if we have stored tokens in localStorage
    const tokens = apiClient.getStoredTokens();

    if (!tokens) {
      logout();
      return false;
    }

    try {
      // Try to refresh the token to verify it's still valid
      const refreshResponse = await apiClient.refreshToken();

      if (refreshResponse.success) {
        // Get user profile with the new token
        const profileResponse = await api.get('/auth/profile');

        if (profileResponse.success && profileResponse.data) {
          setUser(profileResponse.data as any);
          return true;
        } else {
          logout();
          return false;
        }
      } else {
        logout();
        return false;
      }
    } catch (error) {
      logout();
      return false;
    }
  };

  // Auto-check authentication on mount
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      if (!isAuthenticated && !isLoading && mounted) {
        await checkAuth();
      }
    };

    initAuth();

    return () => {
      mounted = false;
    };
  }, []); // Only run once on mount

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout: logoutUser,
    checkAuth,
  };
}

export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  return { isAuthenticated, isLoading };
}
