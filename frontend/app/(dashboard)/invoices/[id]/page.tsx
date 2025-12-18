'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import api from '@/lib/api';
import { FileText, Download, ArrowLeft, Check, X, Calendar, DollarSign, Building2, MessageSquare, Tag, Key } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const isAdmin = role === 'ADMIN';
  const isAccountant = role === 'ACCOUNTANT';
  const invoiceId = params.id as string;
  const [invoice, setInvoice] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    if (invoiceId) {
      loadInvoice();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const loadInvoice = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/invoices/${invoiceId}`);
      setInvoice(res.data);
      // Load comments for this invoice
      if (isAccountant || isAdmin) {
        loadComments();
      }
    } catch (error: any) {
      console.error('Error loading invoice:', error);
      setError(error.response?.data?.message || 'Failed to load invoice');
      toast.error('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async () => {
    try {
      const res = await api.get(`/comments?invoiceId=${invoiceId}`);
      setComments(res.data);
    } catch (error: any) {
      console.error('Error loading comments:', error);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;

    try {
      await api.post('/comments', {
        invoiceId: invoiceId,
        content: commentText,
      });
      toast.success('Note added successfully');
      setShowCommentModal(false);
      setCommentText('');
      loadComments();
    } catch (error: any) {
      console.error('Add comment failed:', error);
      toast.error(error.response?.data?.message || 'Failed to add note');
    }
  };

  const handleDownload = async () => {
    try {
      const res = await api.get(`/invoices/${invoiceId}/download`);
      if (res.data) {
        // If the URL is a relative path (local storage), construct full URL
        let fileUrl = res.data;
        
        // Handle different URL formats
        if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
          // Already a full URL (S3 signed URL) - use as-is
        } else if (fileUrl.startsWith('/api/api/')) {
          // Fix double /api/ prefix (old format in database)
          fileUrl = fileUrl.replace('/api/api/', '/api/');
          const apiBaseUrl = api.defaults.baseURL || '';
          fileUrl = `${apiBaseUrl}${fileUrl.replace('/api', '')}`;
        } else if (fileUrl.startsWith('/api/files/')) {
          // Old format: /api/files/... - remove /api since baseURL has it
          const apiBaseUrl = api.defaults.baseURL || '';
          fileUrl = `${apiBaseUrl}${fileUrl.replace('/api', '')}`;
        } else if (fileUrl.startsWith('/files/')) {
          // New format: /files/... - baseURL already has /api
          const apiBaseUrl = api.defaults.baseURL || '';
          fileUrl = `${apiBaseUrl}${fileUrl}`;
        } else {
          // Fallback: assume it's a relative path
          const apiBaseUrl = api.defaults.baseURL || '';
          fileUrl = `${apiBaseUrl}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;
        }
        
        console.log('Opening file URL:', fileUrl);
        window.open(fileUrl, '_blank');
        toast.success('Opening invoice file...');
      } else {
        toast.error('No file available for this invoice');
      }
    } catch (error: any) {
      console.error('Download failed:', error);
      toast.error(error.response?.data?.message || 'Failed to download invoice');
    }
  };

  const handleApprove = async () => {
    try {
      await api.post(`/invoices/${invoiceId}/approve`, {});
      toast.success('Invoice approved successfully');
      loadInvoice();
    } catch (error: any) {
      console.error('Approve failed:', error);
      toast.error(error.response?.data?.message || 'Failed to approve invoice');
    }
  };

  const handleReject = async () => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    try {
      await api.post(`/invoices/${invoiceId}/reject`, { reason });
      toast.success('Invoice rejected');
      loadInvoice();
    } catch (error: any) {
      console.error('Reject failed:', error);
      toast.error(error.response?.data?.message || 'Failed to reject invoice');
    }
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Invoice</h3>
            <p className="text-sm text-gray-600 mb-4">{error || 'Invoice not found'}</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={loadInvoice}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Retry
              </button>
              <Link
                href="/invoices"
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Back to Invoices
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/invoices"
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Invoice Details</h1>
        </div>
        <div className="flex items-center gap-2">
          {isAccountant && (
            <button
              onClick={() => setShowCommentModal(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <Tag className="h-4 w-4 mr-2" />
              Add Note
            </button>
          )}
          {isAdmin && invoice.status === 'PENDING' && (
            <>
              <button
                onClick={handleApprove}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
              >
                <Check className="h-4 w-4 mr-2" />
                Approve
              </button>
              <button
                onClick={handleReject}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
              >
                <X className="h-4 w-4 mr-2" />
                Reject
              </button>
            </>
          )}
          {invoice.fileUrl && (
            <button
              onClick={handleDownload}
              className={`inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md transition-colors ${
                invoice.status === 'PENDING' && isAdmin
                  ? 'border-blue-400 text-blue-900 bg-blue-50 hover:bg-blue-100 focus:ring-blue-500'
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-blue-500'
              } focus:outline-none focus:ring-2 focus:ring-offset-2`}
              title={invoice.status === 'PENDING' && isAdmin ? 'Review PDF before approval' : 'Download invoice file'}
            >
              <Download className="h-4 w-4 mr-2" />
              {invoice.status === 'PENDING' && isAdmin ? 'Review PDF' : 'Download'}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
        <div className={`px-6 py-5 border-b ${invoice.status === 'PENDING' && invoice.fileUrl ? 'bg-blue-50 border-blue-200' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                invoice.status === 'PENDING' && invoice.fileUrl 
                  ? 'bg-blue-100' 
                  : 'bg-blue-100'
              }`}>
                <FileText className={`h-6 w-6 ${
                  invoice.status === 'PENDING' && invoice.fileUrl 
                    ? 'text-blue-600' 
                    : 'text-blue-600'
                }`} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{invoice.invoiceNumber}</h2>
                <p className="text-sm text-gray-500">{invoice.provider}</p>
                {invoice.status === 'PENDING' && invoice.fileUrl && (
                  <p className={`text-xs mt-1 font-semibold ${
                    isAdmin ? 'text-blue-800' : 'text-blue-700'
                  }`}>
                    {isAdmin 
                      ? '⚠️ PDF uploaded - Admin review required before approval'
                      : '⚠️ File uploaded - Review before approval'}
                  </p>
                )}
              </div>
            </div>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                invoice.status,
              )}`}
            >
              {invoice.status}
            </span>
          </div>
        </div>

        <div className="px-6 py-5">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <dt className="text-sm font-medium text-gray-500 flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4" />
                Amount
              </dt>
              <dd className="text-lg font-semibold text-gray-900">
                {formatCurrency(Number(invoice.amount))}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500 flex items-center gap-2 mb-1">
                <Building2 className="h-4 w-4" />
                Provider
              </dt>
              <dd className="text-lg font-semibold text-gray-900">{invoice.provider}</dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500 flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4" />
                Billing Date
              </dt>
              <dd className="text-lg font-semibold text-gray-900">
                {formatDate(invoice.billingDate)}
              </dd>
            </div>

            {invoice.dueDate && (
              <div>
                <dt className="text-sm font-medium text-gray-500 flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4" />
                  Due Date
                </dt>
                <dd className="text-lg font-semibold text-gray-900">
                  {formatDate(invoice.dueDate)}
                </dd>
              </div>
            )}

            {invoice.category && (
              <div>
                <dt className="text-sm font-medium text-gray-500 mb-1">Category</dt>
                <dd className="text-lg font-semibold text-gray-900">{invoice.category}</dd>
              </div>
            )}

            {invoice.approvedBy && (
              <div>
                <dt className="text-sm font-medium text-gray-500 mb-1">Approved By</dt>
                <dd className="text-lg font-semibold text-gray-900">
                  {invoice.approvedBy?.firstName} {invoice.approvedBy?.lastName}
                </dd>
              </div>
            )}

            {invoice.approvedAt && (
              <div>
                <dt className="text-sm font-medium text-gray-500 mb-1">Approved At</dt>
                <dd className="text-lg font-semibold text-gray-900">
                  {formatDate(invoice.approvedAt)}
                </dd>
              </div>
            )}
          </dl>

          {/* Show file section if fileUrl exists, or show message for pending invoices */}
          {invoice.fileUrl ? (
            <div className={`mt-6 pt-6 border-t ${
              invoice.status === 'PENDING' 
                ? 'bg-blue-50 border-blue-200 rounded-lg p-4 border-l-4 border-l-blue-400' 
                : 'border-gray-200'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className={`text-base font-semibold ${
                      invoice.status === 'PENDING' ? 'text-blue-900' : 'text-gray-900'
                    }`}>
                      {invoice.status === 'PENDING' 
                        ? (isAdmin 
                          ? '📄 Invoice PDF - Review Required for Approval' 
                          : '📄 Uploaded Invoice Document - Review Required')
                        : 'Uploaded Invoice Document'}
                    </h3>
                    {invoice.status === 'PENDING' && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-blue-200 text-blue-900 border border-blue-300 whitespace-nowrap">
                        {isAdmin ? 'Admin Review Required' : 'Action Required'}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <FileText className={`h-5 w-5 flex-shrink-0 ${
                        invoice.status === 'PENDING' ? 'text-blue-600' : 'text-blue-600'
                      }`} />
                      <span className="font-semibold truncate">{invoice.fileName || 'Invoice PDF file'}</span>
                    </div>
                    {invoice.fileSize && (
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        ({(invoice.fileSize / 1024).toFixed(1)} KB)
                      </span>
                    )}
                  </div>
                  <p className={`text-sm mt-3 ${
                    invoice.status === 'PENDING' 
                      ? (isAdmin 
                        ? 'text-blue-800 font-semibold' 
                        : 'text-blue-700 font-medium')
                      : 'text-gray-500'
                  }`}>
                    {invoice.status === 'PENDING' 
                      ? (isAdmin
                        ? '⚠️ As an admin, please review the uploaded PDF file before approving this invoice. Click "Review PDF" to open and verify the document.'
                        : '⚠️ Please review the uploaded file before approving this invoice. Click "Review File" to open the document.')
                      : 'View or download the invoice file'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={handleDownload}
                    disabled={!invoice.fileUrl}
                    className={`inline-flex items-center px-5 py-2.5 border text-sm font-semibold rounded-md transition-colors whitespace-nowrap shadow-sm ${
                      invoice.status === 'PENDING'
                        ? 'border-blue-600 text-blue-900 bg-blue-100 hover:bg-blue-200 focus:ring-blue-500'
                        : 'border-blue-600 text-blue-700 bg-blue-50 hover:bg-blue-100 focus:ring-blue-500'
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {invoice.status === 'PENDING' 
                      ? (isAdmin ? 'Review PDF' : 'Review File')
                      : 'View Document'}
                  </button>
                </div>
              </div>
            </div>
          ) : invoice.status === 'PENDING' && isAdmin ? (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-blue-900 mb-1">
                      PDF File Not Available
                    </h3>
                    <p className="text-xs text-blue-700">
                      This invoice was created without an uploaded PDF file. You can still approve or reject based on the invoice details shown above.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {invoice.credentialLinks && invoice.credentialLinks.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
                <Key className="h-4 w-4" />
                Linked Credentials ({invoice.credentialLinks.length})
              </h3>
              <div className="space-y-2">
                {invoice.credentialLinks.map((link: any) => (
                  <Link
                    key={link.id}
                    href={`/credentials/${link.credential.id}`}
                    className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors group"
                  >
                    <Key className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
                      {link.credential.name}
                    </span>
                    <span className="ml-auto text-xs text-gray-500 group-hover:text-blue-600">View →</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {comments.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Notes & Tags ({comments.length})
              </h3>
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">{comment.content}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {comment.user?.firstName} {comment.user?.lastName} • {new Date(comment.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showCommentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
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
                }}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddComment}
                disabled={!commentText.trim()}
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

