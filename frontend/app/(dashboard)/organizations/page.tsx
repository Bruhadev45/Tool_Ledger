'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import api from '@/lib/api';
import { Building2, Users, FileText, Key, ArrowUp, ArrowDown, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/utils';

export default function OrganizationsPage() {
  const { data: session } = useSession();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [orgDetails, setOrgDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadOrganizations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortOrder]);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      // Get all organizations with stats
      const [orgsRes, usersRes, credentialsRes, invoicesRes] = await Promise.all([
        api.get('/organizations'),
        api.get('/users'),
        api.get('/credentials'),
        api.get('/invoices'),
      ]);

      // Group data by organization
      const orgsMap = new Map();
      
      // Process organizations
      if (Array.isArray(orgsRes.data)) {
        orgsRes.data.forEach((org: any) => {
          orgsMap.set(org.id, {
            ...org,
            userCount: 0,
            credentialCount: 0,
            invoiceCount: 0,
          });
        });
      }

      // Count users per organization
      if (Array.isArray(usersRes.data)) {
        usersRes.data.forEach((user: any) => {
          const org = orgsMap.get(user.organizationId);
          if (org) {
            org.userCount++;
          }
        });
      }

      // Count credentials per organization
      if (Array.isArray(credentialsRes.data)) {
        credentialsRes.data.forEach((cred: any) => {
          const org = orgsMap.get(cred.organizationId);
          if (org) {
            org.credentialCount++;
          }
        });
      }

      // Count invoices per organization
      if (Array.isArray(invoicesRes.data)) {
        invoicesRes.data.forEach((invoice: any) => {
          const org = orgsMap.get(invoice.organizationId);
          if (org) {
            org.invoiceCount++;
          }
        });
      }

      let data = Array.from(orgsMap.values());

      // Client-side sorting
      data = [...data].sort((a, b) => {
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
          case 'userCount':
            aVal = a.userCount || 0;
            bVal = b.userCount || 0;
            break;
          case 'credentialCount':
            aVal = a.credentialCount || 0;
            bVal = b.credentialCount || 0;
            break;
          case 'invoiceCount':
            aVal = a.invoiceCount || 0;
            bVal = b.invoiceCount || 0;
            break;
          default:
            aVal = new Date(a.createdAt).getTime();
            bVal = new Date(b.createdAt).getTime();
        }
        
        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });

      setOrganizations(data);
    } catch (error: any) {
      console.error('Error loading organizations:', error);
      toast.error('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizationDetails = async (orgId: string) => {
    try {
      const [usersRes, credentialsRes, invoicesRes] = await Promise.all([
        api.get(`/users?organizationId=${orgId}`),
        api.get(`/credentials?organizationId=${orgId}`),
        api.get(`/invoices?organizationId=${orgId}`),
      ]);

      setOrgDetails({
        users: usersRes.data || [],
        credentials: credentialsRes.data || [],
        invoices: invoicesRes.data || [],
      });
    } catch (error: any) {
      console.error('Error loading organization details:', error);
      toast.error('Failed to load organization details');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading organizations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
        <div className="flex items-center gap-2 border border-gray-300 rounded-md bg-white">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-transparent border-0 focus:outline-none focus:ring-0 cursor-pointer"
          >
            <option value="createdAt">Date</option>
            <option value="name">Name</option>
            <option value="userCount">Users</option>
            <option value="credentialCount">Credentials</option>
            <option value="invoiceCount">Invoices</option>
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {organizations.map((org) => (
          <div
            key={org.id}
            className={`bg-white rounded-lg border-2 p-6 cursor-pointer transition-all ${
              selectedOrg === org.id
                ? 'border-blue-500 shadow-lg'
                : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
            }`}
            onClick={() => {
              setSelectedOrg(org.id);
              loadOrganizationDetails(org.id);
            }}
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 truncate">{org.name}</h3>
                <p className="text-sm text-gray-500 truncate">{org.domain}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="flex items-center justify-center gap-1 text-gray-600 mb-1">
                  <Users className="h-4 w-4" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{org.userCount || 0}</p>
                <p className="text-xs text-gray-500">Users</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-gray-600 mb-1">
                  <Key className="h-4 w-4" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{org.credentialCount || 0}</p>
                <p className="text-xs text-gray-500">Credentials</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-gray-600 mb-1">
                  <FileText className="h-4 w-4" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{org.invoiceCount || 0}</p>
                <p className="text-xs text-gray-500">Invoices</p>
              </div>
            </div>
            {org.createdAt && (
              <p className="text-xs text-gray-400 mt-4 text-center">
                Created: {formatDate(org.createdAt)}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Organization Details Modal */}
      {selectedOrg && orgDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {organizations.find((o) => o.id === selectedOrg)?.name || 'Organization Details'}
              </h2>
              <button
                onClick={() => {
                  setSelectedOrg(null);
                  setOrgDetails(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Users Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Users ({orgDetails.users.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {orgDetails.users.map((user: any) => (
                    <div key={user.id} className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                        {user.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Credentials Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Credentials ({orgDetails.credentials.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {orgDetails.credentials.map((cred: any) => (
                    <div key={cred.id} className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-900">{cred.name}</p>
                      <p className="text-xs text-gray-500">Owner: {cred.owner?.email}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Invoices Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Invoices ({orgDetails.invoices.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {orgDetails.invoices.map((invoice: any) => (
                    <div key={invoice.id} className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-900">
                        {invoice.invoiceNumber || 'N/A'}
                      </p>
                      <p className="text-xs text-gray-500">{invoice.provider}</p>
                      <p className="text-xs font-medium text-gray-900 mt-1">
                        ${invoice.amount?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
