'use client';

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Download } from 'lucide-react';

// Blue and white theme - various shades of blue
const COLORS = ['#2563EB', '#1D4ED8', '#3B82F6', '#60A5FA', '#93C5FD', '#DBEAFE'];

export default function UserDashboard({ data }: { data: any }) {
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
      const totalSpend = data.monthlySpend?.reduce((sum: number, item: any) => sum + item.amount, 0) || 0;
      const exportData = {
        credentialCount: data.credentialCount || 0,
        totalSpend,
        monthlySpend: data.monthlySpend || [],
        vendorSpend: data.vendorSpend || [],
        invoices: data.invoices || [],
        exportDate: new Date().toISOString(),
      };

      if (format === 'csv') {
        // Convert to CSV
        let csv = 'Metric,Value\n';
        csv += `Total Credentials,${data.credentialCount || 0}\n`;
        csv += `Total Spend,${totalSpend}\n\n`;
        csv += 'Month,Amount\n';
        (data.monthlySpend || []).forEach((item: any) => {
          csv += `${item.month},${item.amount}\n`;
        });
        csv += '\nVendor,Amount\n';
        (data.vendorSpend || []).forEach((item: any) => {
          csv += `${item.vendor},${item.amount}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `personal-billing-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        // Export as JSON
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `personal-billing-report-${new Date().toISOString().split('T')[0]}.json`;
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Personal Dashboard</h1>
            <p className="text-sm text-gray-600">Overview of your credentials and spending</p>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
        <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-6 hover:border-blue-500 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-16 h-16 bg-blue-100 border-2 border-blue-300 rounded-lg flex items-center justify-center">
                <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Credentials</dt>
                <dd className="text-3xl font-bold text-gray-900 mt-1">{data.credentialCount || 0}</dd>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-6 hover:border-blue-500 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-16 h-16 bg-blue-100 border-2 border-blue-300 rounded-lg flex items-center justify-center">
                <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Total Spend</dt>
                <dd className="text-3xl font-bold text-gray-900 mt-1">
                  {formatCurrency(
                    data.monthlySpend?.reduce((sum: number, item: any) => sum + item.amount, 0) || 0
                  )}
                </dd>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Frame */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-6">
          <div className="border-b-2 border-gray-200 pb-4 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Monthly Spend</h2>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.monthlySpend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip 
                formatter={(value: any) => formatCurrency(value)}
                contentStyle={{ border: '2px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Bar dataKey="amount" fill="#2563EB" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-6">
          <div className="border-b-2 border-gray-200 pb-4 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Vendor Breakdown</h2>
          </div>
          {data.vendorSpend && data.vendorSpend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.vendorSpend}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ vendor, percent }) => `${vendor} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {data.vendorSpend.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => formatCurrency(value)}
                  contentStyle={{ border: '2px solid #e5e7eb', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
              <p className="text-sm">No vendor spend data available</p>
            </div>
          )}
        </div>
      </div>

      {data.monthlySpend && data.monthlySpend.length > 0 && (
        <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-6 mb-6">
          <div className="border-b-2 border-gray-200 pb-4 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Monthly Spend Trend</h2>
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

      {data.invoices && data.invoices.length > 0 && (
        <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-6">
          <div className="border-b-2 border-gray-200 pb-4 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Recent Invoices</h2>
          </div>
          <div className="space-y-3">
            {data.invoices.slice(0, 5).map((invoice: any) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between p-4 bg-gray-50 border-2 border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">{invoice.invoiceNumber}</p>
                  <p className="text-xs text-gray-500 mt-1">{invoice.provider}</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-gray-900">
                    {formatCurrency(Number(invoice.amount))}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{formatDate(invoice.billingDate)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
