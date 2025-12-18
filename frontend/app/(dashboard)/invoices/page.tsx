'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import api from '@/lib/api';
import { FileText, Plus, Download, Check, X, Filter, Eye, Tag, MessageSquare, ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function InvoicesPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const isAdmin = role === 'ADMIN';
  const isAccountant = role === 'ACCOUNTANT';
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    provider: '',
    startDate: '',
    endDate: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('billingDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [showCommentModal, setShowCommentModal] = useState(false);

  useEffect(() => {
    loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.provider) params.append('provider', filters.provider);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      
      const res = await api.get(`/invoices${params.toString() ? `?${params.toString()}` : ''}`);
      let data = res.data || [];
      
      // Client-side search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        data = data.filter((invoice: any) => {
          return (
            invoice.invoiceNumber?.toLowerCase().includes(query) ||
            invoice.provider?.toLowerCase().includes(query) ||
            invoice.amount?.toString().includes(query) ||
            invoice.category?.toLowerCase().includes(query) ||
            invoice.status?.toLowerCase().includes(query)
          );
        });
      }
      
      // Client-side sorting
      data = [...data].sort((a, b) => {
        let aVal: any, bVal: any;
        switch (sortBy) {
          case 'billingDate':
            aVal = new Date(a.billingDate).getTime();
            bVal = new Date(b.billingDate).getTime();
            break;
          case 'amount':
            aVal = Number(a.amount);
            bVal = Number(b.amount);
            break;
          case 'provider':
            aVal = a.provider?.toLowerCase() || '';
            bVal = b.provider?.toLowerCase() || '';
            break;
          case 'status':
            aVal = a.status || '';
            bVal = b.status || '';
            break;
          case 'invoiceNumber':
            aVal = a.invoiceNumber?.toLowerCase() || '';
            bVal = b.invoiceNumber?.toLowerCase() || '';
            break;
          default:
            aVal = new Date(a.createdAt).getTime();
            bVal = new Date(b.createdAt).getTime();
        }
        
        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
      
      setInvoices(data);
    } catch (error: any) {
      console.error('Error loading invoices:', error);
      setError(error.response?.data?.message || 'Failed to load invoices');
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.provider, filters.startDate, filters.endDate, sortBy, sortOrder, searchQuery]);

  const handleDownload = async (invoiceId: string) => {
    try {
      const res = await api.get(`/invoices/${invoiceId}/download`);
      if (res.data) {
        window.open(res.data, '_blank');
        toast.success('Opening invoice file...');
      } else {
        toast.error('No file available for this invoice');
      }
    } catch (error: any) {
      console.error('Download failed:', error);
      toast.error(error.response?.data?.message || 'Failed to download invoice');
    }
  };

  const handleApprove = async (invoiceId: string) => {
    try {
      await api.post(`/invoices/${invoiceId}/approve`, {});
      toast.success('Invoice approved successfully');
      loadInvoices();
    } catch (error: any) {
      console.error('Approve failed:', error);
      toast.error(error.response?.data?.message || 'Failed to approve invoice');
    }
  };

  const handleReject = async (invoiceId: string) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    try {
      await api.post(`/invoices/${invoiceId}/reject`, { reason });
      toast.success('Invoice rejected');
      loadInvoices();
    } catch (error: any) {
      console.error('Reject failed:', error);
      toast.error(error.response?.data?.message || 'Failed to reject invoice');
    }
  };

  const handleAddComment = async () => {
    if (!selectedInvoice || !commentText.trim()) return;

    try {
      await api.post('/comments', {
        invoiceId: selectedInvoice,
        content: commentText,
      });
      toast.success('Note added successfully');
      setShowCommentModal(false);
      setCommentText('');
      setSelectedInvoice(null);
      loadInvoices();
    } catch (error: any) {
      console.error('Add comment failed:', error);
      toast.error(error.response?.data?.message || 'Failed to add note');
    }
  };

  const openCommentModal = (invoiceId: string) => {
    setSelectedInvoice(invoiceId);
    setShowCommentModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading invoices...</p>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Invoices</h3>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <button
              onClick={loadInvoices}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-blue-100 text-blue-800';
      case 'PENDING':
        return 'bg-blue-50 text-blue-700';
      case 'REJECTED':
        return 'bg-gray-100 text-gray-600'; // Keep neutral for rejected
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 sticky top-16 bg-white z-20 pb-4 pt-2 border-b border-gray-200 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Invoices</h1>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search Input */}
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search invoices..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <div className="flex items-center gap-2 border border-gray-300 rounded-md bg-white">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-transparent border-0 focus:outline-none focus:ring-0 cursor-pointer"
            >
              <option value="billingDate">Date</option>
              <option value="amount">Amount</option>
              <option value="provider">Provider</option>
              <option value="status">Status</option>
              <option value="invoiceNumber">Invoice #</option>
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
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center justify-center px-3 sm:px-4 py-2 border text-sm font-medium rounded-md transition-colors ${
              showFilters
                ? 'border-blue-500 text-blue-700 bg-blue-50'
                : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
          >
            <Filter className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Filters</span>
          </button>
          <Link
            href="/invoices/new"
            className="inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Upload Invoice</span>
            <span className="sm:hidden">Upload</span>
          </Link>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="">All</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
              <input
                type="text"
                value={filters.provider}
                onChange={(e) => setFilters({ ...filters, provider: e.target.value })}
                placeholder="Filter by provider"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow-sm border border-gray-200 overflow-hidden sm:rounded-lg">
        <ul className="divide-y divide-gray-200">
          {invoices.map((invoice) => (
            <li key={invoice.id} className={`hover:bg-gray-50 transition-colors ${invoice.status === 'PENDING' && invoice.fileUrl ? 'bg-blue-50/50 border-l-4 border-blue-400' : ''}`}>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center min-w-0 flex-1">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="ml-4 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                          {invoice.invoiceNumber}
                        </h3>
                        {invoice.status === 'PENDING' && invoice.fileUrl && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200 whitespace-nowrap flex-shrink-0">
                            File Ready for Review
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-gray-500 truncate">
                        {invoice.provider} • {formatDate(invoice.billingDate)}
                      </p>
                      {invoice.fileUrl && (
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                          <Download className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                          <span className="text-xs text-blue-600 font-medium truncate max-w-[200px]">
                            {invoice.fileName || 'Invoice file attached'}
                          </span>
                          {invoice.fileSize && (
                            <span className="text-xs text-gray-400 whitespace-nowrap">
                              ({(invoice.fileSize / 1024).toFixed(1)} KB)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between sm:justify-end gap-3 flex-shrink-0">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                      <span className="text-base sm:text-lg font-semibold text-gray-900 whitespace-nowrap">
                        {formatCurrency(Number(invoice.amount))}
                      </span>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(
                          invoice.status,
                        )}`}
                      >
                        {invoice.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                      {invoice.fileUrl && (
                        <button
                          onClick={() => handleDownload(invoice.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors shadow-sm ${
                            invoice.status === 'PENDING'
                              ? 'text-yellow-900 bg-yellow-100 border border-yellow-400 hover:bg-yellow-200'
                              : 'text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100'
                          }`}
                          title={invoice.status === 'PENDING' 
                            ? (isAdmin 
                              ? 'Review uploaded PDF file before approval' 
                              : 'Review uploaded invoice file before approval')
                            : 'View uploaded invoice file'}
                        >
                          <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          <span className="hidden sm:inline">
                            {invoice.status === 'PENDING' 
                              ? (isAdmin ? 'Review PDF' : 'Review File')
                              : 'View File'}
                          </span>
                          <span className="sm:hidden">File</span>
                        </button>
                      )}
                      {isAdmin && invoice.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleApprove(invoice.id)}
                            className="text-green-600 hover:text-green-700 p-1.5 sm:p-1 rounded-md hover:bg-green-50 transition-colors"
                            title="Approve invoice"
                          >
                            <Check className="h-4 w-4 sm:h-5 sm:w-5" />
                          </button>
                          <button
                            onClick={() => handleReject(invoice.id)}
                            className="text-red-600 hover:text-red-700 p-1.5 sm:p-1 rounded-md hover:bg-red-50 transition-colors"
                            title="Reject invoice"
                          >
                            <X className="h-4 w-4 sm:h-5 sm:w-5" />
                          </button>
                        </>
                      )}
                      {isAccountant && (
                        <button
                          onClick={() => openCommentModal(invoice.id)}
                          className="text-purple-600 hover:text-purple-700 p-1.5 sm:p-1 rounded-md hover:bg-purple-50 transition-colors"
                          title="Add note/tag for follow-up"
                        >
                          <Tag className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                      )}
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="text-blue-600 hover:text-blue-700 p-1.5 sm:p-1 rounded-md hover:bg-blue-50 transition-colors"
                        title="View invoice details"
                      >
                        <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {invoices.length === 0 && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No invoices</h3>
          <p className="mt-1 text-sm text-gray-500 mb-4">
            {isAccountant ? 'No approved invoices available.' : 'Get started by uploading an invoice.'}
          </p>
          {!isAccountant && (
            <Link
              href="/invoices/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Upload Your First Invoice
            </Link>
          )}
        </div>
      )}

      {showCommentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Note/Tag for Invoice</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Note (for follow-up or budget review)
                </label>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={4}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="Add a note for this invoice (e.g., 'Follow up on budget', 'Review for next quarter', etc.)"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCommentModal(false);
                  setCommentText('');
                  setSelectedInvoice(null);
                }}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddComment}
                disabled={!commentText.trim()}
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
