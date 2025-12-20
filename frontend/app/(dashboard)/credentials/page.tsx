'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import api from '@/lib/api';
import { Key, Plus, Filter, Trash2, Download, FileText, Share2, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/utils';

export default function CredentialsPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const isAdmin = role === 'ADMIN';
  const [rawCredentials, setRawCredentials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOwner, setFilterOwner] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadCredentials = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setIsRefreshing(true);
      setError(null);
      const res = await api.get('/credentials');
      setRawCredentials(res.data);
      setLastUpdated(new Date());
    } catch (error: any) {
      console.error('Error loading credentials:', error);
      setError(error.response?.data?.message || 'Failed to load credentials');
      if (showLoading) toast.error('Failed to load credentials');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Apply filtering and sorting using useMemo for performance
  const credentials = useMemo(() => {
    let data = [...rawCredentials];
    
    // Filter by owner if filter is set
    if (filterOwner && isAdmin) {
      data = data.filter((cred: any) => 
        cred.owner?.email?.toLowerCase().includes(filterOwner.toLowerCase()) ||
        cred.owner?.firstName?.toLowerCase().includes(filterOwner.toLowerCase()) ||
        cred.owner?.lastName?.toLowerCase().includes(filterOwner.toLowerCase())
      );
    }
    
    // Client-side sorting
    data.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortBy) {
        case 'name':
          aVal = a.name?.toLowerCase() || '';
          bVal = b.name?.toLowerCase() || '';
          break;
        case 'createdAt':
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        case 'owner':
          aVal = `${a.owner?.firstName || ''} ${a.owner?.lastName || ''}`.toLowerCase();
          bVal = `${b.owner?.firstName || ''} ${b.owner?.lastName || ''}`.toLowerCase();
          break;
        case 'isPaid':
          aVal = a.isPaid ? 1 : 0;
          bVal = b.isPaid ? 1 : 0;
          break;
        case 'hasAutopay':
          aVal = a.hasAutopay ? 1 : 0;
          bVal = b.hasAutopay ? 1 : 0;
          break;
        default:
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
      }
      
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    return data;
  }, [rawCredentials, filterOwner, isAdmin, sortBy, sortOrder]);

  // Initial load
  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  // Real-time refresh: every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadCredentials(false);
    }, 30000);
    return () => clearInterval(interval);
  }, [loadCredentials]);

  // Refresh on window focus
  useEffect(() => {
    const handleFocus = () => loadCredentials(false);
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadCredentials]);

  // Refresh on network reconnect
  useEffect(() => {
    const handleOnline = () => loadCredentials(false);
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [loadCredentials]);

  const handleDelete = async (credentialId: string) => {
    if (!confirm('Are you sure you want to delete this credential? This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/credentials/${credentialId}`);
      toast.success('Credential deleted successfully');
      await loadCredentials();
    } catch (error: any) {
      console.error('Delete failed:', error);
      toast.error(error.response?.data?.message || 'Failed to delete credential');
    }
  };

  const handleExport = () => {
    // Export credentials to CSV
    const csvData = credentials.map((cred) => ({
      Name: cred.name,
      Owner: `${cred.owner?.firstName} ${cred.owner?.lastName}`,
      Tags: cred.tags?.join(', ') || '',
      Created: new Date(cred.createdAt).toLocaleDateString(),
    }));

    const headers = Object.keys(csvData[0] || {});
    const csv = [
      headers.join(','),
      ...csvData.map((row) => headers.map((header) => `"${row[header as keyof typeof row]}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credentials-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Credentials exported successfully');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading credentials...</p>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Credentials</h3>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => { loadCredentials(); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Credentials</h1>
          <button
            onClick={() => { loadCredentials(false); }}
            disabled={isRefreshing}
            className={`p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
            title="Refresh data"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          {lastUpdated && (
            <span className="text-xs text-gray-400 hidden sm:inline">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 border border-gray-300 rounded-md bg-white">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-transparent border-0 focus:outline-none focus:ring-0 cursor-pointer"
              >
                <option value="createdAt">Date</option>
                <option value="name">Name</option>
                <option value="owner">Owner</option>
                <option value="isPaid">Free/Paid</option>
                <option value="hasAutopay">Autopay</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-2 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors border-l border-gray-300"
                title={`Sort ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
              >
                {sortOrder === 'asc' ? (
                  <ArrowUp className="h-4 w-4" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}
              </button>
            </div>
            {isAdmin && (
              <div className="relative">
                <input
                  type="text"
                  value={filterOwner}
                  onChange={(e) => setFilterOwner(e.target.value)}
                  placeholder="Filter by owner..."
                  className="block w-full sm:w-64 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm pl-10"
                />
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {credentials.length > 0 && (
              <button
                onClick={handleExport}
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors flex-1 sm:flex-initial"
                title="Export credentials to CSV"
              >
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Export</span>
              </button>
            )}
            <Link
              href="/credentials/new"
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors flex-1 sm:flex-initial"
            >
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Credential</span>
              <span className="sm:hidden">Add</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {credentials.map((cred) => (
          <div
            key={cred.id}
            className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Key className="h-5 w-5 text-blue-600" />
                </div>
                <div className="ml-4 flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">{cred.name}</h3>
                  <p className="text-sm text-gray-500 truncate">
                    Owner: {cred.owner?.firstName} {cred.owner?.lastName} ({cred.owner?.email})
                  </p>
                  {isAdmin && cred.createdAt && (
                    <p className="text-xs text-gray-400 mt-1">
                      Created: {formatDate(cred.createdAt)}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 items-center">
                {cred.isPaid !== undefined && (
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      cred.isPaid
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {cred.isPaid ? 'Paid' : 'Free'}
                  </span>
                )}
                {cred.hasAutopay && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    Autopay
                  </span>
                )}
                {cred.tags && cred.tags.length > 0 && (
                  <>
                    {cred.tags.map((tag: string) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Link
                  href={`/credentials/${cred.id}`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  View Details →
                </Link>
                <div className="flex items-center gap-2">
                  {cred.shares && cred.shares.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-gray-500" title={`Shared with ${cred.shares.filter((s: any) => !s.revokedAt).length} user(s)`}>
                      <Share2 className="h-3 w-3" />
                      <span>{cred.shares.filter((s: any) => !s.revokedAt).length}</span>
                    </div>
                  )}
                  {(isAdmin || cred.ownerId === (session?.user as any)?.id) && (
                    <button
                      onClick={() => handleDelete(cred.id)}
                      className="text-red-600 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-colors"
                      title="Delete credential"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {credentials.length === 0 && (
        <div className="text-center py-12">
          <Key className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No credentials</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new credential.</p>
        </div>
      )}
    </div>
  );
}
