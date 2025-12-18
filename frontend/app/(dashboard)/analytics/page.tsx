'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import UserDashboard from '@/components/dashboards/UserDashboard';
import AdminDashboard from '@/components/dashboards/AdminDashboard';
import AccountantDashboard from '@/components/dashboards/AccountantDashboard';

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      api
        .get('/analytics/dashboard')
        .then((res) => {
          setData(res.data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [session]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading analytics...</p>
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
