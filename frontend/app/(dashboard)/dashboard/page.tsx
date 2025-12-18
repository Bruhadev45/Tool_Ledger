'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import UserDashboard from '@/components/dashboards/UserDashboard';
import AdminDashboard from '@/components/dashboards/AdminDashboard';
import AccountantDashboard from '@/components/dashboards/AccountantDashboard';
import { User, UserCog, Shield } from 'lucide-react';

type UserRole = 'USER' | 'ACCOUNTANT' | 'ADMIN';

export default function DashboardPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  // Get actual user role from session
  const actualRole = (session?.user as any)?.role as UserRole;

  // Initialize selected role with actual role, or default to USER
  useEffect(() => {
    if (actualRole && !selectedRole) {
      setSelectedRole(actualRole);
    } else if (!selectedRole) {
      setSelectedRole('USER');
    }
  }, [actualRole, selectedRole]);

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

  // Use selected role for display, or fallback to actual role
  const displayRole = selectedRole || actualRole || 'USER';

  // Role selector component
  const RoleSelector = () => (
    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label htmlFor="role-select" className="text-sm font-medium text-gray-700">
            View Dashboard As:
          </label>
          <div className="relative">
            <select
              id="role-select"
              value={displayRole}
              onChange={(e) => setSelectedRole(e.target.value as UserRole)}
              className="appearance-none bg-white border border-gray-300 rounded-md px-4 py-2 pr-10 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
            >
              <option value="USER">User</option>
              <option value="ACCOUNTANT">Accountant</option>
              <option value="ADMIN">Admin</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              {displayRole === 'ADMIN' && <Shield className="h-4 w-4 text-blue-600" />}
              {displayRole === 'ACCOUNTANT' && <UserCog className="h-4 w-4 text-blue-600" />}
              {displayRole === 'USER' && <User className="h-4 w-4 text-blue-600" />}
            </div>
          </div>
        </div>
        {actualRole && displayRole !== actualRole && (
          <div className="text-xs text-gray-500 bg-white px-3 py-1 rounded-md border border-gray-200">
            Your actual role: <span className="font-semibold">{actualRole}</span>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-600 mt-2">
        💡 Switch between roles to view different dashboard perspectives. This only changes the view, not your actual permissions.
      </p>
    </div>
  );

  // Render dashboard based on selected role
  const renderDashboard = () => {
    if (displayRole === 'ADMIN') {
      return <AdminDashboard data={data} />;
    } else if (displayRole === 'ACCOUNTANT') {
      return <AccountantDashboard data={data} />;
    } else {
      return <UserDashboard data={data} />;
    }
  };

  return (
    <div className="space-y-6">
      <RoleSelector />
      {renderDashboard()}
    </div>
  );
}
