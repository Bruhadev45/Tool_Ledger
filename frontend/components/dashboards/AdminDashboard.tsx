'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { Download } from 'lucide-react';
import { useState } from 'react';

// Blue and white theme - various shades of blue
const COLORS = ['#2563EB', '#1D4ED8', '#3B82F6', '#60A5FA', '#93C5FD', '#DBEAFE'];

export default function AdminDashboard({ data }: { data: any }) {
  const [exporting, setExporting] = useState(false);

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  // Transform vendorSpend data for the chart
  const vendorSpendData = (data.vendorSpend || []).map((item: any) => ({
    provider: item.provider,
    amount: Number(item._sum?.amount || 0),
  }));

  // Transform teamSpend data
  const teamSpendData = (data.teamSpend || []).map((item: any) => ({
    category: item.category || 'Uncategorized',
    amount: Number(item._sum?.amount || 0),
  }));

  // Calculate approved/rejected counts
  const approvedCount = data.approvedInvoices || 0;
  const rejectedCount = data.rejectedInvoices || 0;

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(true);
    try {
      const exportData = {
        totalSpend: data.totalSpend,
        credentialCount: data.credentialCount,
        pendingInvoices: data.pendingInvoices,
        approvedInvoices: approvedCount,
        rejectedInvoices: rejectedCount,
        vendorSpend: vendorSpendData,
        teamSpend: teamSpendData,
        userSpend: data.userSpend,
        monthlySpend: data.monthlySpend,
        exportDate: new Date().toISOString(),
      };

      if (format === 'csv') {
        // Convert to CSV
        let csv = 'Metric,Value\n';
        csv += `Total Spend,${data.totalSpend}\n`;
        csv += `Total Credentials,${data.credentialCount}\n`;
        csv += `Pending Invoices,${data.pendingInvoices}\n`;
        csv += `Approved Invoices,${approvedCount}\n`;
        csv += `Rejected Invoices,${rejectedCount}\n\n`;
        csv += 'Vendor,Amount\n';
        vendorSpendData.forEach((item: any) => {
          csv += `${item.provider},${item.amount}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `toolledger-analytics-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        // Export as JSON
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `toolledger-analytics-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="w-full p-4 sm:p-6 bg-gray-50 min-h-screen">
      {/* Header Frame */}
      <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              {data.isGlobalAdmin ? 'Global Admin Dashboard' : 'Admin Dashboard'}
            </h1>
            <p className="text-sm text-gray-600">
              {data.isGlobalAdmin 
                ? 'All organizations analytics and insights' 
                : 'Organization-wide analytics and insights'}
            </p>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
        <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-6 hover:border-blue-500 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-16 h-16 bg-blue-100 border-2 border-blue-300 rounded-lg flex items-center justify-center">
                <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Total Credentials</dt>
                <dd className="text-3xl font-bold text-gray-900 mt-1">{data.credentialCount || 0}</dd>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-6 hover:border-blue-500 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-16 h-16 bg-green-100 border-2 border-green-300 rounded-lg flex items-center justify-center">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Total Spend</dt>
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
                <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Pending Invoices</dt>
                <dd className="text-3xl font-bold text-gray-900 mt-1">{data.pendingInvoices || 0}</dd>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-6 hover:border-blue-500 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-16 h-16 bg-green-100 border-2 border-green-300 rounded-lg flex items-center justify-center">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Approved Invoices</dt>
                <dd className="text-3xl font-bold text-gray-900 mt-1">{approvedCount}</dd>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global Admin Stats (shown when viewing all orgs) */}
      {data.isGlobalAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6">
          <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-6 hover:border-purple-500 transition-colors">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-14 h-14 bg-purple-100 border-2 border-purple-300 rounded-lg flex items-center justify-center">
                <svg className="h-7 w-7 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Total Users</dt>
                <dd className="text-2xl font-bold text-gray-900 mt-1">{data.totalUsers || 0}</dd>
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-6 hover:border-indigo-500 transition-colors">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-14 h-14 bg-indigo-100 border-2 border-indigo-300 rounded-lg flex items-center justify-center">
                <svg className="h-7 w-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Total Teams</dt>
                <dd className="text-2xl font-bold text-gray-900 mt-1">{data.totalTeams || 0}</dd>
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-6 hover:border-teal-500 transition-colors">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-14 h-14 bg-teal-100 border-2 border-teal-300 rounded-lg flex items-center justify-center">
                <svg className="h-7 w-7 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Organizations</dt>
                <dd className="text-2xl font-bold text-gray-900 mt-1">{data.totalOrganizations || 0}</dd>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Frame */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-6">
          <div className="border-b-2 border-gray-200 pb-4 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Vendor Spend</h2>
          </div>
          {vendorSpendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={vendorSpendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="provider" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip 
                  formatter={(value: any) => formatCurrency(Number(value))}
                  contentStyle={{ border: '2px solid #e5e7eb', borderRadius: '8px' }}
                />
                <Bar dataKey="amount" fill="#2563EB" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
              <p className="text-sm">No vendor spend data available</p>
            </div>
          )}
        </div>

        <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-6">
          <div className="border-b-2 border-gray-200 pb-4 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Department/Team Spend</h2>
          </div>
          {teamSpendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={teamSpendData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {teamSpendData.map((entry: any, index: number) => (
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
              <p className="text-sm">No team spend data available</p>
            </div>
          )}
        </div>
      </div>

      {data.monthlySpend && data.monthlySpend.length > 0 && (
        <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-6">
          <div className="border-b-2 border-gray-200 pb-4 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Monthly Spend Trends</h2>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.monthlySpend}>
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
        </div>
      )}
    </div>
  );
}
