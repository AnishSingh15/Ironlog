/**
 * API client for IronLog application with authentication handling
 */
//new deploy
// Base configuration - require environment variable in production
const getApiBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;

  console.log('🔍 getApiBaseUrl called:', {
    nodeEnv: process.env.NODE_ENV,
    envUrl,
    envUrlType: typeof envUrl,
    envUrlLength: envUrl?.length,
    isProduction: process.env.NODE_ENV === 'production',
  });

  // In production, the environment variable must be set
  if (process.env.NODE_ENV === 'production' && !envUrl) {
    const error = new Error(
      'NEXT_PUBLIC_API_URL environment variable is required in production. ' +
        'Please set it in your Vercel deployment settings.'
    );
    console.error('🚨 Production API URL Error:', error.message);
    throw error;
  }

  // In development, fallback to localhost
  const result = envUrl || 'http://localhost:3001';
  console.log('🔍 getApiBaseUrl result:', result);
  return result;
};

// Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

// Token management utilities
class TokenManager {
  private static readonly ACCESS_TOKEN_KEY = 'accessToken';
  private static readonly REFRESH_TOKEN_KEY = 'refreshToken';
  private static readonly EXPIRES_AT_KEY = 'expiresAt';

  static setTokens(tokens: AuthTokens): void {
    if (typeof window === 'undefined') return;

    // Set tokens in localStorage with 7-day expiry
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    console.log('🔐 Setting tokens:', {
      accessToken: tokens.accessToken?.substring(0, 20) + '...',
      refreshToken: tokens.refreshToken?.substring(0, 20) + '...',
      expiresAt,
    });

    localStorage.setItem(this.ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, tokens.refreshToken);
    localStorage.setItem(this.EXPIRES_AT_KEY, expiresAt.toString());
  }

  static getTokens(): AuthTokens | null {
    if (typeof window === 'undefined') return null;

    const accessToken = localStorage.getItem(this.ACCESS_TOKEN_KEY);
    const refreshToken = localStorage.getItem(this.REFRESH_TOKEN_KEY);
    const expiresAt = localStorage.getItem(this.EXPIRES_AT_KEY);

    if (!accessToken || !refreshToken || !expiresAt) {
      return null;
    }

    // Check if tokens have expired
    if (Date.now() > parseInt(expiresAt)) {
      this.clearTokens();
      return null;
    }

    return {
      accessToken,
      refreshToken,
      expiresAt: parseInt(expiresAt),
    };
  }

  static clearTokens(): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.EXPIRES_AT_KEY);
  }

  static getAccessToken(): string | null {
    const tokens = this.getTokens();
    const accessToken = tokens?.accessToken || null;

    console.log('🔐 Getting access token:', {
      hasToken: !!accessToken,
      tokenPreview: accessToken?.substring(0, 20) + '...',
    });

    return accessToken;
  }
}

// API client class
export class ApiClient {
  private baseURL: string | null = null;

  constructor(private readonly explicitBaseURL?: string) {}

  // Resolved lazily on first real request instead of at construction time. This class is
  // instantiated at module load (`export const api = new ApiClient()` below), which during
  // `next build` runs for every page — including auto-generated ones like /_not-found — so
  // resolving (and validating) the base URL here would fail the entire production build
  // whenever NEXT_PUBLIC_API_URL is unset, regardless of whether that page ever calls the API.
  private resolveBaseURL(): string {
    if (this.baseURL) {
      return this.baseURL;
    }

    const rawBaseURL = this.explicitBaseURL ?? getApiBaseUrl();
    const cleanBaseURL = rawBaseURL.replace(/\/+$/, ''); // Remove trailing slashes
    this.baseURL = `${cleanBaseURL}/api/v1`;

    // Always log for debugging with environment info
    console.log('🔍 API Client Initialized:', {
      nodeEnv: process.env.NODE_ENV,
      envVar: process.env.NEXT_PUBLIC_API_URL,
      isProduction: process.env.NODE_ENV === 'production',
      usingFallback: !process.env.NEXT_PUBLIC_API_URL && process.env.NODE_ENV !== 'production',
      inputBaseURL: rawBaseURL,
      cleanBaseURL,
      finalBaseURL: this.baseURL,
      // Additional debug info
      allEnvVars: Object.keys(process.env).filter(key => key.startsWith('NEXT_PUBLIC_')),
      envVarValue: process.env.NEXT_PUBLIC_API_URL,
      envVarType: typeof process.env.NEXT_PUBLIC_API_URL,
      envVarLength: process.env.NEXT_PUBLIC_API_URL?.length,
    });

    return this.baseURL;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.resolveBaseURL()}${endpoint}`;

      // Debug logging - ALWAYS log to catch the issue
      console.log('🔍 API Request Debug:', {
        endpoint,
        baseURL: this.baseURL,
        finalURL: url,
      });

      // Add authorization header if token exists
      const accessToken = TokenManager.getAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((options.headers as Record<string, string>) || {}),
      };

      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
        console.log('🔐 Adding auth header:', {
          hasToken: true,
          tokenPreview: accessToken.substring(0, 20) + '...',
        });
      } else {
        console.log('🔐 No access token available for request');
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle 401 unauthorized - token might be expired
      if (response.status === 401 && accessToken) {
        // Clear invalid tokens
        TokenManager.clearTokens();

        // Redirect to login if in browser
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }

        return {
          success: false,
          error: { message: 'Authentication required' },
        };
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: {
            message: data.error?.message || 'Request failed',
            code: data.error?.code,
          },
        };
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Network error',
        },
      };
    }
  }

  // Auth endpoints
  async login(credentials: LoginRequest): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> {
    console.log('🔐 Attempting login for:', credentials.email);

    const response = await this.makeRequest<{ user: User; tokens: AuthTokens }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    console.log('🔐 Full login response:', JSON.stringify(response, null, 2));

    // Store tokens on successful login
    if (response.success && response.data?.tokens) {
      TokenManager.setTokens(response.data.tokens);
      console.log('🔐 Tokens stored successfully');
    } else {
      console.error('🔐 Failed to store tokens - no tokens in response');
      console.error('🔐 Response structure:', {
        success: response.success,
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : 'no data',
        hasTokens: !!response.data?.tokens,
      });
    }

    return response;
  }

  async register(
    userData: RegisterRequest
  ): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> {
    const response = await this.makeRequest<{ user: User; tokens: AuthTokens }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    // Store tokens on successful registration
    if (response.success && response.data?.tokens) {
      TokenManager.setTokens(response.data.tokens);
    }

    return response;
  }

  async refreshToken(): Promise<ApiResponse<{ tokens: AuthTokens }>> {
    const refreshToken = TokenManager.getTokens()?.refreshToken;
    if (!refreshToken) {
      return {
        success: false,
        error: { message: 'No refresh token available' },
      };
    }

    const response = await this.makeRequest<{ tokens: AuthTokens }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    // Store new tokens on successful refresh
    if (response.success && response.data?.tokens) {
      TokenManager.setTokens(response.data.tokens);
    }

    return response;
  }

  async logout(): Promise<void> {
    try {
      // Call logout endpoint to invalidate tokens on server
      await this.makeRequest('/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      // Always clear local tokens
      TokenManager.clearTokens();
    }
  }

  // Token management
  getStoredTokens(): AuthTokens | null {
    return TokenManager.getTokens();
  }

  async getCurrentUser(): Promise<ApiResponse<{ user: User }>> {
    return this.makeRequest<{ user: User }>('/auth/me');
  }

  // Workout-specific endpoints
  async getTodayWorkout(): Promise<ApiResponse<any>> {
    return this.get('/workouts/today');
  }

  async createRestDay(): Promise<ApiResponse<any>> {
    return this.post('/workouts/rest-day');
  }

  // Exercise management endpoints
  async getExercises(params?: {
    muscleGroup?: string;
    search?: string;
  }): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params?.muscleGroup) searchParams.append('muscleGroup', params.muscleGroup);
    if (params?.search) searchParams.append('search', params.search);

    const endpoint = `/exercises${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    return this.get(endpoint);
  }

  async getPopularExercises(limit: number = 10): Promise<ApiResponse<any>> {
    return this.get(`/exercises/popular?limit=${limit}`);
  }

  async getExercise(id: string): Promise<ApiResponse<any>> {
    return this.get(`/exercises/${id}`);
  }

  async createExercise(exercise: {
    name: string;
    muscleGroup: string;
    defaultSets?: number;
    defaultReps?: number;
  }): Promise<ApiResponse<any>> {
    return this.post('/exercises', exercise);
  }

  async updateExercise(
    id: string,
    exercise: {
      name?: string;
      muscleGroup?: string;
      defaultSets?: number;
      defaultReps?: number;
    }
  ): Promise<ApiResponse<any>> {
    return this.put(`/exercises/${id}`, exercise);
  }

  async deleteExercise(id: string): Promise<ApiResponse<any>> {
    return this.delete(`/exercises/${id}`);
  }

  // Generic GET request
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: 'GET' });
  }

  // Generic POST request
  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // Generic PUT request
  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // Generic PATCH request
  async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // Generic DELETE request
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: 'DELETE' });
  }
}

// Default API client instance
export const api = new ApiClient();

// Auth utility functions
export const isAuthenticated = (): boolean => {
  return TokenManager.getTokens() !== null;
};

export const getAuthTokens = (): AuthTokens | null => {
  return TokenManager.getTokens();
};

export const clearAuthTokens = (): void => {
  TokenManager.clearTokens();
};

// Export the token manager for direct access if needed
export { TokenManager };

// Legacy API client wrapper for backward compatibility
export const apiClient = {
  async login(credentials: LoginRequest) {
    return api.login(credentials);
  },

  async register(userData: RegisterRequest) {
    return api.register(userData);
  },

  async logout() {
    return api.logout();
  },

  async refreshToken() {
    return api.refreshToken();
  },

  getStoredTokens() {
    return api.getStoredTokens();
  },

  async getTodayWorkout() {
    return api.getTodayWorkout();
  },

  async createRestDay() {
    return api.createRestDay();
  },

  // Exercise management methods
  async getExercises(params?: { muscleGroup?: string; search?: string }) {
    return api.getExercises(params);
  },

  async getPopularExercises(limit?: number) {
    return api.getPopularExercises(limit);
  },

  async getExercise(id: string) {
    return api.getExercise(id);
  },

  async createExercise(exercise: {
    name: string;
    muscleGroup: string;
    defaultSets?: number;
    defaultReps?: number;
  }) {
    return api.createExercise(exercise);
  },

  async updateExercise(
    id: string,
    exercise: { name?: string; muscleGroup?: string; defaultSets?: number; defaultReps?: number }
  ) {
    return api.updateExercise(id, exercise);
  },

  async deleteExercise(id: string) {
    return api.deleteExercise(id);
  },
};

// Default export for backward compatibility
export default apiClient;
