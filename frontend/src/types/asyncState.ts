// Centralized AsyncState type definition for consistent state management across all contexts

/**
 * Generic async state wrapper for better UX and consistent state management
 * Used across all contexts to handle loading, error, and staleness states
 */
export interface AsyncState<T> {
  /** The actual data being managed */
  data: T;
  /** Whether the data is currently being loaded */
  loading: boolean;
  /** Error message if the last operation failed */
  error: string | null;
  /** Timestamp of the last successful fetch */
  lastFetch: number | null;
  /** Whether the data is considered stale and needs refresh */
  stale: boolean;
  /** Optional staleness reason for debugging */
  staleness?: 'expired' | 'invalidated' | 'user-requested' | null;
}

/**
 * Helper functions for creating AsyncState instances
 */
export const AsyncStateHelpers = {
  /**
   * Create an initial empty async state
   */
  createEmpty: <T>(initialData: T): AsyncState<T> => ({
    data: initialData,
    loading: false,
    error: null,
    lastFetch: null,
    stale: false,
    staleness: null,
  }),

  /**
   * Create a loading state while preserving current data
   */
  createLoading: <T>(currentData: T): AsyncState<T> => ({
    data: currentData,
    loading: true,
    error: null,
    lastFetch: null,
    stale: false,
    staleness: null,
  }),

  /**
   * Create a success state with new data
   */
  createSuccess: <T>(data: T, previousLastFetch?: number | null): AsyncState<T> => ({
    data,
    loading: false,
    error: null,
    lastFetch: Date.now(),
    stale: false,
    staleness: null,
  }),

  /**
   * Create an error state while preserving current data
   */
  createError: <T>(currentData: T, error: string): AsyncState<T> => ({
    data: currentData,
    loading: false,
    error,
    lastFetch: null,
    stale: true,
    staleness: 'invalidated',
  }),

  /**
   * Mark state as stale
   */
  markStale: <T>(state: AsyncState<T>, reason?: AsyncState<T>['staleness']): AsyncState<T> => ({
    ...state,
    stale: true,
    staleness: reason || 'expired',
  }),

  /**
   * Check if data needs refresh based on age
   */
  needsRefresh: <T>(state: AsyncState<T>, maxAgeMs: number = 5 * 60 * 1000): boolean => {
    if (state.stale || state.error) return true;
    if (!state.lastFetch) return true;
    return Date.now() - state.lastFetch > maxAgeMs;
  },
};

export default AsyncState;