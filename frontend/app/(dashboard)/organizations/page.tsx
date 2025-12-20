'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import api from '@/lib/api';
import { Building2, Users, FileText, Key, ArrowUp, ArrowDown, X, Plus, Edit2, Trash2, Eye, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate, formatCurrency } from '@/lib/utils';
import Link from 'next/link';

export default function OrganizationsPage() {
  const { data: session } = useSession();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [orgDetails, setOrgDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', domain: '' });
  const [submitting, setSubmitting] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showAddCredentialModal, setShowAddCredentialModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [availableCredentials, setAvailableCredentials] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedCredentialId, setSelectedCredentialId] = useState('');

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
      // Get all data and filter by organization
      const [usersRes, credentialsRes, invoicesRes] = await Promise.all([
        api.get('/users'),
        api.get('/credentials'),
        api.get('/invoices'),
      ]);

      // Filter by organization ID
      const orgUsers = (usersRes.data || []).filter((user: any) => user.organizationId === orgId);
      const orgCredentials = (credentialsRes.data || []).filter(
        (cred: any) => cred.organizationId === orgId,
      );
      const orgInvoices = (invoicesRes.data || []).filter(
        (invoice: any) => invoice.organizationId === orgId,
      );

      // Store all users and credentials for adding to organization
      setAvailableUsers(usersRes.data || []);
      setAvailableCredentials(credentialsRes.data || []);

      setOrgDetails({
        users: orgUsers,
        credentials: orgCredentials,
        invoices: orgInvoices,
      });
    } catch (error: any) {
      console.error('Error loading organization details:', error);
      toast.error('Failed to load organization details');
    }
  };

  const handleAddUser = async () => {
    if (!selectedUserId || !selectedOrg) return;
    setSubmitting(true);
    try {
      await api.post(`/organizations/${selectedOrg}/users/${selectedUserId}`);
      toast.success('User added to organization successfully');
      setShowAddUserModal(false);
      setSelectedUserId('');
      // Refresh both organization details and the main list
      await Promise.all([
        loadOrganizationDetails(selectedOrg),
        loadOrganizations(), // Refresh organization stats
      ]);
    } catch (error: any) {
      console.error('Error adding user:', error);
      toast.error(error.response?.data?.message || 'Failed to add user to organization');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveUser = async (userId: string, userName: string) => {
    if (!selectedOrg) return;
    if (!confirm(`Are you sure you want to remove "${userName}" from this organization?`)) {
      return;
    }
    try {
      await api.delete(`/organizations/${selectedOrg}/users/${userId}`);
      toast.success('User removed from organization successfully');
      // Refresh both organization details and the main list
      await Promise.all([
        loadOrganizationDetails(selectedOrg),
        loadOrganizations(), // Refresh organization stats
      ]);
    } catch (error: any) {
      console.error('Error removing user:', error);
      toast.error(error.response?.data?.message || 'Failed to remove user from organization');
    }
  };

  const handleAddCredential = async () => {
    if (!selectedCredentialId || !selectedOrg) return;
    setSubmitting(true);
    try {
      await api.post(`/organizations/${selectedOrg}/credentials/${selectedCredentialId}`);
      toast.success('Credential added to organization successfully');
      setShowAddCredentialModal(false);
      setSelectedCredentialId('');
      // Refresh both organization details and the main list
      await Promise.all([
        loadOrganizationDetails(selectedOrg),
        loadOrganizations(), // Refresh organization stats
      ]);
    } catch (error: any) {
      console.error('Error adding credential:', error);
      toast.error(error.response?.data?.message || 'Failed to add credential to organization');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveCredential = async (credentialId: string, credentialName: string) => {
    if (!selectedOrg) return;
    if (!confirm(`Are you sure you want to remove "${credentialName}" from this organization?`)) {
      return;
    }
    try {
      await api.delete(`/organizations/${selectedOrg}/credentials/${credentialId}`);
      toast.success('Credential removed from organization successfully');
      loadOrganizationDetails(selectedOrg);
      loadOrganizations(); // Refresh organization stats
    } catch (error: any) {
      console.error('Error removing credential:', error);
      const errorMsg = error.response?.data?.message || 'Failed to remove credential from organization';
      toast.error(errorMsg);
      // If it's the "must belong to organization" error, suggest moving instead
      if (errorMsg.includes('must belong to an organization')) {
        toast('Tip: Move the credential to another organization instead', { icon: 'ℹ️', duration: 5000 });
      }
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/organizations', formData);
      toast.success('Organization created successfully');
      setShowCreateModal(false);
      setFormData({ name: '', domain: '' });
      loadOrganizations();
    } catch (error: any) {
      console.error('Error creating organization:', error);
      toast.error(error.response?.data?.message || 'Failed to create organization');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (org: any) => {
    setEditingOrg(org);
    setFormData({ name: org.name, domain: org.domain });
    setShowEditModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrg) return;
    setSubmitting(true);
    try {
      await api.put(`/organizations/${editingOrg.id}`, formData);
      toast.success('Organization updated successfully');
      setShowEditModal(false);
      setEditingOrg(null);
      setFormData({ name: '', domain: '' });
      loadOrganizations();
    } catch (error: any) {
      console.error('Error updating organization:', error);
      toast.error(error.response?.data?.message || 'Failed to update organization');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (orgId: string, orgName: string) => {
    if (!confirm(`Are you sure you want to delete "${orgName}"? This will also delete all associated users, credentials, and invoices. This action cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/organizations/${orgId}`);
      toast.success('Organization deleted successfully');
      if (selectedOrg === orgId) {
        setSelectedOrg(null);
        setOrgDetails(null);
      }
      loadOrganizations();
    } catch (error: any) {
      console.error('Error deleting organization:', error);
      toast.error(error.response?.data?.message || 'Failed to delete organization');
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setFormData({ name: '', domain: '' });
              setShowCreateModal(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Organization
          </button>
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
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleEdit(org)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="Edit organization"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(org.id, org.name)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Delete organization"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
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
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Users ({orgDetails.users.length})
                  </h3>
                  <button
                    onClick={() => {
                      setSelectedUserId('');
                      setShowAddUserModal(true);
                    }}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add User
                  </button>
                </div>
                {orgDetails.users.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No users found for this organization</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {orgDetails.users.map((user: any) => (
                      <div
                        key={user.id}
                        className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-2">
                              {user.role}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveUser(user.id, `${user.firstName} ${user.lastName}`);
                            }}
                            className="ml-2 p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors flex-shrink-0"
                            title="Remove user from organization"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Credentials Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Credentials ({orgDetails.credentials.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedCredentialId('');
                        setShowAddCredentialModal(true);
                      }}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Existing
                    </button>
                    <Link
                      href="/credentials/new"
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Create New
                    </Link>
                  </div>
                </div>
                {orgDetails.credentials.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <Key className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No credentials found for this organization</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {orgDetails.credentials.map((cred: any) => (
                      <div
                        key={cred.id}
                        className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-all group"
                      >
                        <div className="flex items-start justify-between">
                          <Link
                            href={`/credentials/${cred.id}`}
                            className="flex-1 min-w-0"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Key className="h-4 w-4 text-blue-600 flex-shrink-0" />
                              <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600">
                                {cred.name}
                              </p>
                            </div>
                            <p className="text-xs text-gray-500 mb-2">
                              Owner: {cred.owner?.firstName} {cred.owner?.lastName}
                            </p>
                            {cred.tags && cred.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {cred.tags.slice(0, 3).map((tag: string) => (
                                  <span
                                    key={tag}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                                  >
                                    {tag}
                                  </span>
                                ))}
                                {cred.tags.length > 3 && (
                                  <span className="text-xs text-gray-500">+{cred.tags.length - 3}</span>
                                )}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              {cred.isPaid !== undefined && (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    cred.isPaid
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-green-100 text-green-800'
                                  }`}
                                >
                                  {cred.isPaid ? 'Paid' : 'Free'}
                                </span>
                              )}
                              {cred.hasAutopay && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                  Autopay
                                </span>
                              )}
                            </div>
                          </Link>
                          <div className="flex items-center gap-1 ml-2">
                            <Link
                              href={`/credentials/${cred.id}`}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors flex-shrink-0"
                              title="View credential"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveCredential(cred.id, cred.name);
                              }}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors flex-shrink-0"
                              title="Remove credential from organization"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Invoices Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Invoices ({orgDetails.invoices.length})
                  </h3>
                  <Link
                    href="/invoices/new"
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Invoice
                  </Link>
                </div>
                {orgDetails.invoices.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No invoices found for this organization</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {orgDetails.invoices.map((invoice: any) => {
                      const getStatusColor = (status: string) => {
                        switch (status) {
                          case 'APPROVED':
                            return 'bg-blue-100 text-blue-800';
                          case 'PENDING':
                            return 'bg-blue-50 text-blue-700';
                          case 'REJECTED':
                            return 'bg-gray-100 text-gray-600';
                          default:
                            return 'bg-gray-100 text-gray-800';
                        }
                      };

                      return (
                        <Link
                          key={invoice.id}
                          href={`/invoices/${invoice.id}`}
                          className="p-4 bg-gray-50 rounded-lg hover:bg-blue-50 border border-gray-200 hover:border-blue-300 transition-all group"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600">
                                  {invoice.invoiceNumber || 'N/A'}
                                </p>
                              </div>
                              <p className="text-xs text-gray-500 mb-2">{invoice.provider}</p>
                              <div className="flex items-center gap-2 mb-2">
                                <p className="text-sm font-semibold text-gray-900">
                                  {formatCurrency(invoice.amount || 0)}
                                </p>
                                {invoice.billingDate && (
                                  <p className="text-xs text-gray-500">
                                    • {formatDate(invoice.billingDate)}
                                  </p>
                                )}
                              </div>
                              {invoice.category && (
                                <p className="text-xs text-gray-500 mb-2">Category: {invoice.category}</p>
                              )}
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                                    invoice.status || 'PENDING',
                                  )}`}
                                >
                                  {invoice.status || 'PENDING'}
                                </span>
                              </div>
                            </div>
                            <Eye className="h-4 w-4 text-gray-400 group-hover:text-blue-600 flex-shrink-0 ml-2" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Organization Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Create Organization</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ name: '', domain: '' });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Organization Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="e.g., Acme Corporation"
                />
              </div>
              <div>
                <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-2">
                  Domain <span className="text-red-500">*</span>
                </label>
                <input
                  id="domain"
                  type="text"
                  required
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="e.g., acme.com"
                />
                <p className="mt-1 text-xs text-gray-500">Must be a valid domain name</p>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({ name: '', domain: '' });
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Organization Modal */}
      {showEditModal && editingOrg && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Edit Organization</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingOrg(null);
                  setFormData({ name: '', domain: '' });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div>
                <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-2">
                  Organization Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="e.g., Acme Corporation"
                />
              </div>
              <div>
                <label htmlFor="edit-domain" className="block text-sm font-medium text-gray-700 mb-2">
                  Domain <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-domain"
                  type="text"
                  required
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="e.g., acme.com"
                />
                <p className="mt-1 text-xs text-gray-500">Must be a valid domain name</p>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingOrg(null);
                    setFormData({ name: '', domain: '' });
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Updating...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && selectedOrg && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Add User to Organization</h2>
              <button
                onClick={() => {
                  setShowAddUserModal(false);
                  setSelectedUserId('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label htmlFor="user-select" className="block text-sm font-medium text-gray-700 mb-2">
                  Select User <span className="text-red-500">*</span>
                </label>
                <select
                  id="user-select"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">Choose a user...</option>
                  {availableUsers
                    .filter((user: any) => user.organizationId !== selectedOrg)
                    .map((user: any) => (
                      <option key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.email}) - Current Org: {organizations.find((o: any) => o.id === user.organizationId)?.name || 'None'}
                      </option>
                    ))}
                </select>
                {availableUsers.filter((user: any) => user.organizationId !== selectedOrg).length === 0 && (
                  <p className="mt-2 text-xs text-gray-500">All users are already in this organization</p>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddUserModal(false);
                    setSelectedUserId('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddUser}
                  disabled={submitting || !selectedUserId}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Adding...' : 'Add User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Credential Modal */}
      {showAddCredentialModal && selectedOrg && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Add Credential to Organization</h2>
              <button
                onClick={() => {
                  setShowAddCredentialModal(false);
                  setSelectedCredentialId('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label htmlFor="credential-select" className="block text-sm font-medium text-gray-700 mb-2">
                  Select Credential <span className="text-red-500">*</span>
                </label>
                <select
                  id="credential-select"
                  value={selectedCredentialId}
                  onChange={(e) => setSelectedCredentialId(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">Choose a credential...</option>
                  {availableCredentials
                    .filter((cred: any) => cred.organizationId !== selectedOrg)
                    .map((cred: any) => (
                      <option key={cred.id} value={cred.id}>
                        {cred.name} - Current Org: {organizations.find((o: any) => o.id === cred.organizationId)?.name || 'None'}
                      </option>
                    ))}
                </select>
                {availableCredentials.filter((cred: any) => cred.organizationId !== selectedOrg).length === 0 && (
                  <p className="mt-2 text-xs text-gray-500">All credentials are already in this organization</p>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCredentialModal(false);
                    setSelectedCredentialId('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCredential}
                  disabled={submitting || !selectedCredentialId}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Adding...' : 'Add Credential'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
