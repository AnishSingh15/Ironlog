/**
 * API client for IronLog application with authentication handling
 */
// Base configuration - require environment variable in production
const getApiBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;

  // In production, the environment variable must be set
  if (process.env.NODE_ENV === 'production' && !envUrl) {
    throw new Error(
      'NEXT_PUBLIC_API_URL environment variable is required in production. ' +
        'Please set it in your Vercel deployment settings.'
    );
  }

  // In development, fallback to localhost
  return envUrl || 'http://localhost:3001';
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

// AI Coach types - mirror apps/server/src/ai/schemas/workoutAnalysis.ts
export interface ProgressionRecommendation {
  type: 'progression_recommendation';
  exercise: string;
  action: 'increase_weight' | 'maintain' | 'deload' | 'insufficient_data';
  recommendedWeightKg: number;
  targetSets: number;
  targetReps: string;
  confidence: number;
  evidence: string[];
  reasoning: string;
}

export interface WorkoutAnalysis {
  summary: string;
  recommendations: ProgressionRecommendation[];
  plateauedExercises: string[];
  overallTrend: 'improving' | 'steady' | 'declining' | 'insufficient_data';
}

// Shape returned by the deterministic progression.ts service (exercise-recommendation,
// exercise detail, adapt-today) - distinct from the AI-generated ProgressionRecommendation
// above (no `exercise`/`type`/`targetSets`, and targetReps is a plain number here).
export interface DeterministicRecommendation {
  action: 'increase_weight' | 'maintain' | 'deload' | 'insufficient_data';
  recommendedWeightKg: number;
  targetReps: number;
  confidence: number;
  evidence: string[];
  reasoning: string;
}

export interface FitnessStateSnapshot {
  trainingFrequency: {
    totalSessions: number;
    weeksSpanned: number;
    sessionsPerWeek: number;
  };
  weeklyVolume: { weekStart: string; totalVolume: number; sessionCount: number }[];
  muscleGroupVolume: { muscleGroup: string; totalVolume: number }[];
  consistencyScore: number;
  plateauAlert: { exercise: string; durationSessions: number; trend: 'flat' | 'upward' | 'downward' } | null;
}

export type MuscleTimeRange = '7D' | '4W' | '8W' | '12W' | '6M';

export interface MuscleVolumeEntry {
  volumeKg: number;
  sets: number;
  intensity: number;
  trendPct: number | null;
  topExercises: string[];
  trendSeries: { bucketStart: string; volumeKg: number }[];
}

export interface MuscleVolumeBreakdown {
  period: { start: string; end: string; rangeDays: number };
  muscles: Record<string, MuscleVolumeEntry>;
}

export type WorkoutDayCalendarStatus = 'completed' | 'planned' | 'missed' | 'rest';

export interface WeekCalendarDay {
  date: string;
  status: WorkoutDayCalendarStatus;
}

export interface PersonalRecord {
  exercise: string;
  weightKg: number;
  reps: number;
  achievedAt: string;
}

export interface PerformedSet {
  date: string;
  actualWeight: number;
  actualReps: number;
  plannedWeight: number | null;
  plannedReps: number | null;
  setIndex: number;
}

export interface ExerciseDetail {
  exercise: { id: string; name: string; muscleGroup: string; defaultSets: number; defaultReps: number };
  history: PerformedSet[];
  personalBest: PerformedSet | null;
  recommendation: DeterministicRecommendation | null;
  plateau: { status: 'plateau' | 'progressing' | 'insufficient_data'; confidence: number; durationSessions: number; trend: 'flat' | 'upward' | 'downward' } | null;
}

export interface PlateauScanEntry {
  exercise: string;
  durationSessions: number;
  trend: 'flat' | 'upward' | 'downward';
  confidence: number;
  reasoning: string;
}

export interface WeekReview {
  sessionsThisWeek: number;
  volumeThisWeek: number;
  volumeLastWeek: number;
  volumeChangePct: number | null;
  personalRecordsThisWeek: PersonalRecord[];
  plateauedExercises: string[];
}

export interface TodayAdaptation {
  exercise: string;
  setIds: string[];
  recommendation: DeterministicRecommendation;
}

export interface KnowledgeMatch {
  id: string;
  source: string;
  title: string;
  content: string;
  chunkIndex: number;
  score: number;
}

// Weekly planner types - mirror apps/server/src/ai/schemas/weeklyPlan.ts
export type DayOfWeek =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export interface PlannedExercise {
  name: string;
  targetSets: number;
  targetReps: string;
}

export interface PlannedSession {
  day: DayOfWeek;
  focus: string;
  isRestDay: boolean;
  exercises: PlannedExercise[];
  reasoning: string;
}

export interface WeeklyPlan {
  goal: string;
  summary: string;
  sessions: PlannedSession[];
}

export interface PlanWeekRequest {
  goal?: string;
  availableDays?: DayOfWeek[];
  sessionDurationMinutes?: number;
  equipment?: string[];
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
    return this.getTokens()?.accessToken || null;
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

    return this.baseURL;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.resolveBaseURL()}${endpoint}`;

      // Add authorization header if token exists
      const accessToken = TokenManager.getAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((options.headers as Record<string, string>) || {}),
      };

      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(url, {
        ...options,
        headers,
        // The refresh-token cookie is httpOnly and set by a different origin/port than the
        // frontend in most deployments - without this, the browser never attaches it, and
        // /auth/refresh (which checkAuth() calls on every hard page load) always 401s.
        credentials: 'include',
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
    const response = await this.makeRequest<{ user: User; tokens: AuthTokens }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    // Store tokens on successful login
    if (response.success && response.data?.tokens) {
      TokenManager.setTokens(response.data.tokens);
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

  // AI Coach endpoints
  async analyzeWorkout(): Promise<ApiResponse<{ analysis: WorkoutAnalysis }>> {
    return this.post('/ai/analyze-workout');
  }

  async getExerciseRecommendation(
    exerciseName: string
  ): Promise<ApiResponse<{ recommendation: DeterministicRecommendation }>> {
    return this.get(`/ai/exercise-recommendation?exercise=${encodeURIComponent(exerciseName)}`);
  }

  async getWhyStuck(): Promise<ApiResponse<{ plateaus: PlateauScanEntry[] }>> {
    return this.get('/ai/why-stuck');
  }

  async getWeekReview(): Promise<ApiResponse<{ review: WeekReview }>> {
    return this.get('/ai/week-review');
  }

  async getTodayAdaptation(): Promise<ApiResponse<{ adaptations: TodayAdaptation[] }>> {
    return this.get('/ai/adapt-today');
  }

  async getFitnessState(): Promise<ApiResponse<FitnessStateSnapshot>> {
    return this.get('/ai/fitness-state');
  }

  async getMuscleVolume(range: MuscleTimeRange): Promise<ApiResponse<MuscleVolumeBreakdown>> {
    return this.get(`/analytics/muscle-volume?range=${range}`);
  }

  async getWeekCalendar(): Promise<ApiResponse<{ days: WeekCalendarDay[] }>> {
    return this.get('/ai/week-calendar');
  }

  async forgotPassword(email: string): Promise<ApiResponse<{ message: string }>> {
    return this.post('/auth/forgot-password', { email });
  }

  async resetPassword(token: string, newPassword: string): Promise<ApiResponse<{ message: string }>> {
    return this.post('/auth/reset-password', { token, newPassword });
  }

  async searchKnowledge(query: string, limit = 3): Promise<ApiResponse<{ results: KnowledgeMatch[] }>> {
    return this.get(`/ai/knowledge-search?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  async planWeek(request: PlanWeekRequest): Promise<ApiResponse<{ plan: WeeklyPlan }>> {
    return this.post('/ai/plan-week', request);
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

  async getExercise(id: string): Promise<ApiResponse<ExerciseDetail>> {
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
