'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import UserDashboard from '@/components/dashboards/UserDashboard';
import AdminDashboard from '@/components/dashboards/AdminDashboard';
import AccountantDashboard from '@/components/dashboards/AccountantDashboard';
import { RefreshCw } from 'lucide-react';

export default function DashboardPage() {
  const { data: session, update: updateSession } = useSession();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDashboard = useCallback(async (showLoading = true) => {
    if (!session) return;
    
    try {
      if (showLoading) setLoading(true);
      setIsRefreshing(true);
      setError(null);
      const res = await api.get('/analytics/dashboard');
      setData(res.data);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Dashboard data fetch error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [session]);

  // Initial load
  useEffect(() => {
    if (session) {
      loadDashboard();
    }
  }, [session, loadDashboard]);

  // Real-time refresh: every 60 seconds for dashboard
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      loadDashboard(false);
    }, 60000);
    return () => clearInterval(interval);
  }, [session, loadDashboard]);

  // Refresh on window focus
  useEffect(() => {
    const handleFocus = async () => {
      if (session) {
        // Also update session to get latest role
        await updateSession();
        loadDashboard(false);
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [session, loadDashboard, updateSession]);

  // Refresh on network reconnect
  useEffect(() => {
    const handleOnline = () => {
      if (session) loadDashboard(false);
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [session, loadDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Dashboard</h3>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => { loadDashboard(); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const role = (session?.user as any)?.role;
  
  // Determine which dashboard to show based on role
  // The data.isGlobalAdmin flag indicates if the backend returned global admin data
  const isAdminData = data?.isGlobalAdmin !== undefined;
  
  // Header with refresh button
  const DashboardHeader = () => (
    <div className="flex items-center gap-3 mb-6">
      <h1 className="text-2xl font-bold text-gray-900">
        {role === 'ADMIN' ? 'Admin Dashboard' : role === 'ACCOUNTANT' ? 'Accountant Dashboard' : 'Dashboard'}
      </h1>
      <button
        onClick={() => { loadDashboard(false); }}
        disabled={isRefreshing}
        className={`p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
        title="Refresh dashboard"
      >
        <RefreshCw className="h-4 w-4" />
      </button>
      {lastUpdated && (
        <span className="text-xs text-gray-400">
          Updated {lastUpdated.toLocaleTimeString()}
        </span>
      )}
    </div>
  );

  if (role === 'ADMIN' || isAdminData) {
    return (
      <div>
        <DashboardHeader />
        <AdminDashboard data={data} />
      </div>
    );
  } else if (role === 'ACCOUNTANT') {
    return (
      <div>
        <DashboardHeader />
        <AccountantDashboard data={data} />
      </div>
    );
  } else {
    return (
      <div>
        <DashboardHeader />
        <UserDashboard data={data} />
      </div>
    );
  }
}
