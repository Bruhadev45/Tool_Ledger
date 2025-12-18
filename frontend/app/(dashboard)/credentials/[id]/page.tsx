'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import api from '@/lib/api';
import { Key, ArrowLeft, Edit, Trash2, Eye, EyeOff, Share2, UserX, Users, FileText, UserCog } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function CredentialDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const credentialId = params.id as string;
  const [credential, setCredential] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [shareType, setShareType] = useState<'user' | 'team'>('user');
  const [selectedPermission, setSelectedPermission] = useState('VIEW_ONLY');
  const userRole = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;
  const isOwner = credential?.ownerId === userId;
  const isAdmin = userRole === 'ADMIN';
  const canShare = isOwner || isAdmin;

  useEffect(() => {
    if (credentialId) {
      loadCredential();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentialId]);

  useEffect(() => {
    if (showShareModal && canShare) {
      loadUsers();
      loadTeams();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showShareModal, canShare]);

  const loadTeams = async () => {
    try {
      const res = await api.get('/teams');
      setTeams(res.data || []);
    } catch (error: any) {
      console.error('Error loading teams:', error);
      toast.error('Failed to load teams');
    }
  };

  const loadCredential = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/credentials/${credentialId}?decrypt=true`);
      setCredential(res.data);
    } catch (error: any) {
      console.error('Error loading credential:', error);
      toast.error(error.response?.data?.message || 'Failed to load credential');
      router.push('/credentials');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await api.get('/users/members');
      // Filter out current user
      const currentUserId = (session?.user as any)?.id;
      setUsers(res.data.filter((u: any) => u.id !== currentUserId));
    } catch (error: any) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    }
  };

  const handleShare = async () => {
    if (shareType === 'user' && !selectedUserId) {
      toast.error('Please select a user');
      return;
    }
    if (shareType === 'team' && !selectedTeamId) {
      toast.error('Please select a team');
      return;
    }

    try {
      await api.post(`/credentials/${credentialId}/share`, {
        ...(shareType === 'user' ? { userId: selectedUserId } : { teamId: selectedTeamId }),
        permission: selectedPermission,
      });
      toast.success(`Credential shared successfully with ${shareType === 'user' ? 'user' : 'team'}`);
      setShowShareModal(false);
      setSelectedUserId('');
      setSelectedTeamId('');
      setShareType('user');
      setSelectedPermission('VIEW_ONLY');
      loadCredential();
    } catch (error: any) {
      console.error('Error sharing credential:', error);
      toast.error(error.response?.data?.message || 'Failed to share credential');
    }
  };

  const handleRevokeAccess = async (userId: string) => {
    if (!confirm('Are you sure you want to revoke access for this user?')) {
      return;
    }

    try {
      await api.post(`/credentials/${credentialId}/revoke/user/${userId}`);
      toast.success('Access revoked successfully');
      loadCredential();
    } catch (error: any) {
      console.error('Error revoking access:', error);
      toast.error(error.response?.data?.message || 'Failed to revoke access');
    }
  };

  const handleRevokeTeamAccess = async (teamId: string) => {
    if (!confirm('Are you sure you want to revoke access for this team?')) {
      return;
    }

    try {
      await api.post(`/credentials/${credentialId}/revoke/team/${teamId}`);
      toast.success('Team access revoked successfully');
      loadCredential();
    } catch (error: any) {
      console.error('Error revoking team access:', error);
      toast.error(error.response?.data?.message || 'Failed to revoke team access');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this credential? This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/credentials/${credentialId}`);
      toast.success('Credential deleted successfully');
      router.push('/credentials');
    } catch (error: any) {
      console.error('Error deleting credential:', error);
      toast.error(error.response?.data?.message || 'Failed to delete credential');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading credential...</p>
        </div>
      </div>
    );
  }

  if (!credential) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Credential not found</h3>
          <Link href="/credentials" className="text-blue-600 hover:text-blue-700">
            Back to Credentials
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/credentials"
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{credential.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          {canShare && (
            <button
              onClick={() => setShowShareModal(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </button>
          )}
          {(isOwner || isAdmin) && (
            <button
              onClick={handleDelete}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6 max-w-3xl">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
            <p className="text-sm text-gray-900">{credential.name}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-900 font-mono">{credential.username || 'N/A'}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-900 font-mono">
                {showPassword ? (credential.password || 'N/A') : '••••••••'}
              </p>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {credential.apiKey && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-900 font-mono">
                  {showApiKey ? credential.apiKey : '••••••••'}
                </p>
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {credential.tags && credential.tags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
              <div className="flex flex-wrap gap-2">
                {credential.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {credential.notes && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{credential.notes}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Owner</label>
            <p className="text-sm text-gray-900">
              {credential.owner?.firstName} {credential.owner?.lastName} ({credential.owner?.email})
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Created</label>
            <p className="text-sm text-gray-900">
              {new Date(credential.createdAt).toLocaleDateString()}
            </p>
          </div>

          {credential.invoiceLinks && credential.invoiceLinks.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Linked Invoices ({credential.invoiceLinks.length})
              </label>
              <div className="space-y-2">
                {credential.invoiceLinks.map((link: any) => (
                  <Link
                    key={link.id}
                    href={`/invoices/${link.invoice.id}`}
                    className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors group"
                  >
                    <FileText className="h-4 w-4 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
                        {link.invoice.invoiceNumber}
                      </p>
                      <p className="text-xs text-gray-500">
                        {link.invoice.provider} • ${Number(link.invoice.amount).toFixed(2)} • {link.invoice.status}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 group-hover:text-blue-600">View →</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {canShare && credential.teamShares && credential.teamShares.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <UserCog className="h-4 w-4" />
                Shared With Teams
              </label>
              <div className="space-y-2">
                {credential.teamShares
                  .filter((share: any) => !share.revokedAt)
                  .map((share: any) => (
                    <div
                      key={share.id}
                      className="flex items-center justify-between p-3 bg-blue-50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {share.team?.name}
                        </p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                          {share.permission}
                        </span>
                      </div>
                      {canShare && (
                        <button
                          onClick={() => handleRevokeTeamAccess(share.teamId)}
                          className="text-red-600 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-colors"
                          title="Revoke team access"
                        >
                          <UserX className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {canShare && credential.shares && credential.shares.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Shared With Users
              </label>
              <div className="space-y-2">
                {credential.shares
                  .filter((share: any) => !share.revokedAt)
                  .map((share: any) => (
                    <div
                      key={share.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {share.user?.firstName} {share.user?.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{share.user?.email}</p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                          {share.permission}
                        </span>
                      </div>
                      {canShare && (
                        <button
                          onClick={() => handleRevokeAccess(share.userId)}
                          className="text-red-600 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-colors"
                          title="Revoke access"
                        >
                          <UserX className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Share Credential</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Share With</label>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShareType('user');
                      setSelectedTeamId('');
                    }}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      shareType === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    User
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShareType('team');
                      setSelectedUserId('');
                    }}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      shareType === 'team'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Team
                  </button>
                </div>
                {shareType === 'user' ? (
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    <option value="">Choose a user...</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.email})
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    <option value="">Choose a team...</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name} ({team._count?.users || 0} members)
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permission Level</label>
                <select
                  value={selectedPermission}
                  onChange={(e) => setSelectedPermission(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="VIEW_ONLY">View Only</option>
                  <option value="EDIT">Edit</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {selectedPermission === 'VIEW_ONLY'
                    ? 'User can only view the credential'
                    : 'User can view and edit the credential'}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowShareModal(false);
                  setSelectedUserId('');
                  setSelectedTeamId('');
                  setShareType('user');
                  setSelectedPermission('VIEW_ONLY');
                }}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleShare}
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
