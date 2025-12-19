'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import UserDashboard from '@/components/dashboards/UserDashboard';
import AdminDashboard from '@/components/dashboards/AdminDashboard';
import AccountantDashboard from '@/components/dashboards/AccountantDashboard';

export default function DashboardPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      setLoading(true);
      setError(null);
      api
        .get('/analytics/dashboard')
        .then((res) => {
          setData(res.data);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Dashboard data fetch error:', err);
          setError(err.response?.data?.message || err.message || 'Failed to load dashboard data');
          setLoading(false);
        });
    }
  }, [session]);

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
              onClick={() => {
                setLoading(true);
                setError(null);
                api
                  .get('/analytics/dashboard')
                  .then((res) => {
                    setData(res.data);
                    setLoading(false);
                  })
                  .catch((err) => {
                    setError(err.response?.data?.message || err.message || 'Failed to load dashboard data');
                    setLoading(false);
                  });
              }}
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

  if (role === 'ADMIN') {
    return <AdminDashboard data={data} />;
  } else if (role === 'ACCOUNTANT') {
    return <AccountantDashboard data={data} />;
  } else {
    return <UserDashboard data={data} />;
  }
}
