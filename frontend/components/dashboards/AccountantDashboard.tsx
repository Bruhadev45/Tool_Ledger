'use client';

import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { Download, TrendingUp, DollarSign, Users } from 'lucide-react';

// Blue and white theme - various shades of blue
const COLORS = ['#2563EB', '#1D4ED8', '#3B82F6', '#60A5FA', '#93C5FD', '#DBEAFE'];

export default function AccountantDashboard({ data }: { data: any }) {
  const [exporting, setExporting] = useState(false);

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(true);
    try {
      const exportData = {
        totalSpend: data.totalSpend || 0,
        monthlyTrends: data.monthlyTrends || [],
        departmentSpend: data.departmentSpend || [],
        adminComparison: data.adminComparison || [],
        exportDate: new Date().toISOString(),
      };

      if (format === 'csv') {
        let csv = 'Metric,Value\n';
        csv += `Total Organization Spend,${data.totalSpend || 0}\n\n`;
        csv += 'Month,Amount\n';
        (data.monthlyTrends || []).forEach((item: any) => {
          csv += `${item.month},${item.amount}\n`;
        });
        csv += '\nDepartment,Amount,Count\n';
        (data.departmentSpend || []).forEach((item: any) => {
          csv += `${item.category || 'Uncategorized'},${item._sum?.amount || 0},${item._count?.id || 0}\n`;
        });
        csv += '\nAdmin,Total Spend\n';
        (data.adminComparison || []).forEach((item: any) => {
          csv += `${item.adminName},${item.totalSpend || 0}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `accounting-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `accounting-report-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  // Transform admin comparison data for multi-line chart
  const adminComparisonData = () => {
    if (!data.adminComparison || data.adminComparison.length === 0) return [];
    
    const allMonths = new Set<string>();
    data.adminComparison.forEach((admin: any) => {
      admin.monthlySpend.forEach((item: any) => allMonths.add(item.month));
    });
    
    const sortedMonths = Array.from(allMonths).sort();
    return sortedMonths.map((month) => {
      const result: any = { month };
      data.adminComparison.forEach((admin: any, index: number) => {
        const monthData = admin.monthlySpend.find((m: any) => m.month === month);
        result[`admin_${index}`] = monthData ? monthData.amount : 0;
      });
      return result;
    });
  };

  return (
    <div className="w-full p-4 sm:p-6 bg-gray-50 min-h-screen">
      {/* Header Frame */}
      <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Financial Analytics Dashboard</h1>
            <p className="text-sm text-gray-600">Comprehensive financial insights and reporting</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('csv')}
              disabled={exporting}
              className="inline-flex items-center justify-center px-4 py-2 border-2 border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </button>
            <button
              onClick={() => handleExport('json')}
              disabled={exporting}
              className="inline-flex items-center justify-center px-4 py-2 border-2 border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards Frame */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
        <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-6 hover:border-blue-500 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-16 h-16 bg-blue-100 border-2 border-blue-300 rounded-lg flex items-center justify-center">
                <DollarSign className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Total Organization Spend</dt>
                <dd className="text-3xl font-bold text-gray-900 mt-1">
                  {formatCurrency(data.totalSpend || 0)}
                </dd>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-6 hover:border-blue-500 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-16 h-16 bg-blue-100 border-2 border-blue-300 rounded-lg flex items-center justify-center">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Active Admins</dt>
                <dd className="text-3xl font-bold text-gray-900 mt-1">
                  {data.adminComparison?.length || 0}
                </dd>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-6 hover:border-purple-500 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-16 h-16 bg-purple-100 border-2 border-purple-300 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Departments</dt>
                <dd className="text-3xl font-bold text-gray-900 mt-1">
                  {data.departmentSpend?.length || 0}
                </dd>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chart Frame */}
      <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-6 mb-6">
        <div className="border-b-2 border-gray-200 pb-4 mb-4">
          <h2 className="text-lg font-bold text-gray-900">Admin Spending Comparison (Month-over-Month)</h2>
        </div>
        {data.adminComparison && data.adminComparison.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={adminComparisonData()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip 
                formatter={(value: any) => formatCurrency(Number(value))}
                contentStyle={{ border: '2px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Legend />
              {data.adminComparison.map((admin: any, index: number) => (
                <Line
                  key={admin.adminId}
                  type="monotone"
                  dataKey={`admin_${index}`}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={3}
                  name={admin.adminName}
                  dot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[400px] text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
            <p className="text-sm">No admin spending data available</p>
          </div>
        )}
      </div>

      {/* Secondary Charts Frame */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-6">
          <div className="border-b-2 border-gray-200 pb-4 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Organization-Wide Month-over-Month Trends</h2>
          </div>
          {data.monthlyTrends && data.monthlyTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip 
                  formatter={(value: any) => formatCurrency(Number(value))}
                  contentStyle={{ border: '2px solid #e5e7eb', borderRadius: '8px' }}
                />
                <Line type="monotone" dataKey="amount" stroke="#2563EB" strokeWidth={3} dot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
              <p className="text-sm">No monthly trend data available</p>
            </div>
          )}
        </div>

        <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-6">
          <div className="border-b-2 border-gray-200 pb-4 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Department/Team Spend Breakdown</h2>
          </div>
          {data.departmentSpend && data.departmentSpend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.departmentSpend.map((item: any) => ({
                    name: item.category || 'Uncategorized',
                    value: Number(item._sum?.amount || 0),
                    count: item._count?.id || 0,
                  }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.departmentSpend.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => formatCurrency(Number(value))}
                  contentStyle={{ border: '2px solid #e5e7eb', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
              <p className="text-sm">No department spend data available</p>
            </div>
          )}
        </div>
      </div>

      {data.adminComparison && data.adminComparison.length > 0 && (
        <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-6">
          <div className="border-b-2 border-gray-200 pb-4 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Admin Spending Summary</h2>
          </div>
          <div className="space-y-3">
            {data.adminComparison.map((admin: any) => (
              <div
                key={admin.adminId}
                className="flex items-center justify-between p-4 bg-gray-50 border-2 border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">{admin.adminName}</p>
                  <p className="text-xs text-gray-500 mt-1">{admin.adminEmail}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">
                    {formatCurrency(admin.totalSpend || 0)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {admin.monthlySpend?.length || 0} months of data
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
