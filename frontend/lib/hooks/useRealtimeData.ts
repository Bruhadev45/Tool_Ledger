import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';

interface UseRealtimeDataOptions {
  refreshInterval?: number; // Refresh interval in milliseconds (default: 30 seconds)
  refreshOnFocus?: boolean; // Refresh when window gains focus (default: true)
  refreshOnReconnect?: boolean; // Refresh when network reconnects (default: true)
}

interface UseRealtimeDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
}

/**
 * Custom hook for real-time data fetching with automatic refresh
 * 
 * Features:
 * - Periodic refresh (configurable interval)
 * - Refresh on window focus
 * - Refresh on network reconnect
 * - Manual refresh capability
 */
export function useRealtimeData<T>(
  endpoint: string,
  options: UseRealtimeDataOptions = {}
): UseRealtimeDataResult<T> {
  const {
    refreshInterval = 30000, // Default 30 seconds
    refreshOnFocus = true,
    refreshOnReconnect = true,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const isFirstMount = useRef(true);
  const isFetching = useRef(false);

  const fetchData = useCallback(async (showLoading = false) => {
    // Prevent concurrent fetches
    if (isFetching.current) return;
    
    isFetching.current = true;
    
    if (showLoading) {
      setLoading(true);
    }
    
    try {
      const response = await api.get(endpoint);
      setData(response.data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error(`Error fetching ${endpoint}:`, err);
      setError(err.response?.data?.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, [endpoint]);

  // Initial fetch
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      fetchData(true);
    }
  }, [fetchData]);

  // Periodic refresh
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(() => {
        fetchData(false);
      }, refreshInterval);
      
      return () => clearInterval(interval);
    }
  }, [refreshInterval, fetchData]);

  // Refresh on window focus
  useEffect(() => {
    if (!refreshOnFocus) return;

    const handleFocus = () => {
      fetchData(false);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refreshOnFocus, fetchData]);

  // Refresh on network reconnect
  useEffect(() => {
    if (!refreshOnReconnect) return;

    const handleOnline = () => {
      fetchData(false);
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [refreshOnReconnect, fetchData]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return { data, loading, error, refresh, lastUpdated };
}

/**
 * Hook for credentials with real-time sync
 */
export function useRealtimeCredentials(options?: UseRealtimeDataOptions) {
  return useRealtimeData<any[]>('/credentials', options);
}

/**
 * Hook for invoices with real-time sync
 */
export function useRealtimeInvoices(options?: UseRealtimeDataOptions) {
  return useRealtimeData<any[]>('/invoices', options);
}

/**
 * Hook for teams with real-time sync
 */
export function useRealtimeTeams(options?: UseRealtimeDataOptions) {
  return useRealtimeData<any[]>('/teams', options);
}

/**
 * Hook for users with real-time sync
 */
export function useRealtimeUsers(options?: UseRealtimeDataOptions) {
  return useRealtimeData<any[]>('/users', options);
}

/**
 * Hook for dashboard analytics with real-time sync
 */
export function useRealtimeDashboard(options?: UseRealtimeDataOptions) {
  return useRealtimeData<any>('/analytics/dashboard', {
    refreshInterval: 60000, // Dashboard updates every 60 seconds
    ...options,
  });
}

export default useRealtimeData;
