'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import api from '@/lib/api';
import { Users, Plus, Edit, Trash2, UserPlus, UserMinus, X, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TeamsPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const canManage = role === 'ADMIN' || role === 'ACCOUNTANT';
  const [rawTeams, setRawTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [teamUsers, setTeamUsers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadTeams = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setIsRefreshing(true);
      setError(null);
      const res = await api.get('/teams');
      setRawTeams(res.data || []);
      setLastUpdated(new Date());
    } catch (error: any) {
      console.error('Error loading teams:', error);
      setError(error.response?.data?.message || 'Failed to load teams');
      if (showLoading) toast.error('Failed to load teams');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Apply sorting using useMemo
  const teams = useMemo(() => {
    const data = [...rawTeams];
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
        case 'memberCount':
          aVal = a._count?.users || 0;
          bVal = b._count?.users || 0;
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
  }, [rawTeams, sortBy, sortOrder]);

  // Initial load
  useEffect(() => {
    loadTeams();
    if (canManage) {
      loadAllUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time refresh: every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadTeams(false);
    }, 30000);
    return () => clearInterval(interval);
  }, [loadTeams]);

  // Refresh on window focus
  useEffect(() => {
    const handleFocus = () => loadTeams(false);
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadTeams]);

  // Refresh on network reconnect
  useEffect(() => {
    const handleOnline = () => loadTeams(false);
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [loadTeams]);

  const loadAllUsers = async () => {
    try {
      const res = await api.get('/users');
      setAllUsers(res.data || []);
    } catch (error: any) {
      console.error('Error loading users:', error);
    }
  };

  const loadTeamUsers = async (teamId: string) => {
    try {
      const res = await api.get(`/teams/${teamId}`);
      setTeamUsers(res.data.users || []);
    } catch (error: any) {
      console.error('Error loading team users:', error);
      toast.error('Failed to load team members');
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Team name is required');
      return;
    }

    try {
      await api.post('/teams', {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      });
      toast.success('Team created successfully');
      setShowCreateModal(false);
      setFormData({ name: '', description: '' });
      loadTeams();
    } catch (error: any) {
      console.error('Create team failed:', error);
      toast.error(error.response?.data?.message || 'Failed to create team');
    }
  };

  const handleUpdate = async (teamId: string) => {
    if (!formData.name.trim()) {
      toast.error('Team name is required');
      return;
    }

    try {
      await api.patch(`/teams/${teamId}`, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      });
      toast.success('Team updated successfully');
      setEditingTeam(null);
      setFormData({ name: '', description: '' });
      loadTeams();
    } catch (error: any) {
      console.error('Update team failed:', error);
      toast.error(error.response?.data?.message || 'Failed to update team');
    }
  };

  const handleDelete = async (teamId: string, teamName: string) => {
    if (!confirm(`Are you sure you want to delete team "${teamName}"? All users in this team will be unassigned. This action cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/teams/${teamId}`);
      toast.success('Team deleted successfully');
      loadTeams();
      if (selectedTeam === teamId) {
        setSelectedTeam(null);
        setTeamUsers([]);
      }
    } catch (error: any) {
      console.error('Delete team failed:', error);
      toast.error(error.response?.data?.message || 'Failed to delete team');
    }
  };

  const handleAddUser = async (userId: string) => {
    if (!selectedTeam) return;

    try {
      await api.post(`/teams/${selectedTeam}/users/${userId}`);
      toast.success('User added to team successfully');
      loadTeamUsers(selectedTeam);
      loadTeams(); // Refresh to update member count
    } catch (error: any) {
      console.error('Add user failed:', error);
      toast.error(error.response?.data?.message || 'Failed to add user to team');
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!selectedTeam) return;

    try {
      await api.delete(`/teams/${selectedTeam}/users/${userId}`);
      toast.success('User removed from team successfully');
      loadTeamUsers(selectedTeam);
      loadTeams(); // Refresh to update member count
    } catch (error: any) {
      console.error('Remove user failed:', error);
      toast.error(error.response?.data?.message || 'Failed to remove user from team');
    }
  };

  const openEditModal = (team: any) => {
    setEditingTeam(team.id);
    setFormData({
      name: team.name,
      description: team.description || '',
    });
  };

  const openTeamDetails = (teamId: string) => {
    setSelectedTeam(teamId);
    loadTeamUsers(teamId);
  };

  const getAvailableUsers = () => {
    if (!selectedTeam) return [];
    const teamUserIds = teamUsers.map((u: any) => u.id);
    return allUsers.filter((u: any) => !teamUserIds.includes(u.id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading teams...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Teams</h1>
          <button
            onClick={() => { loadTeams(false); }}
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
          <div className="flex items-center gap-2 border border-gray-300 rounded-md bg-white">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-transparent border-0 focus:outline-none focus:ring-0 cursor-pointer"
            >
              <option value="createdAt">Date</option>
              <option value="name">Name</option>
              <option value="memberCount">Members</option>
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
          {canManage && (
            <button
              onClick={() => {
                setShowCreateModal(true);
                setFormData({ name: '', description: '' });
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Team
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-800">{error}</p>
        </div>
      )}

      {teams.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No teams</h3>
          <p className="mt-1 text-sm text-gray-500">
            {canManage
              ? 'Get started by creating a new team.'
              : 'No teams have been created yet.'}
          </p>
          {canManage && (
            <div className="mt-6">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Team
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <div
              key={team.id}
              className={`bg-white rounded-lg border-2 p-6 cursor-pointer transition-all ${
                selectedTeam === team.id
                  ? 'border-blue-500 shadow-lg'
                  : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
              }`}
              onClick={() => openTeamDetails(team.id)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{team.name}</h3>
                  {team.description && (
                    <p className="text-sm text-gray-500 mt-1">{team.description}</p>
                  )}
                  {team.organization && (
                    <p className="text-xs text-gray-400 mt-1">
                      {team.organization.name}
                    </p>
                  )}
                </div>
                {canManage && (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openEditModal(team)}
                      className="text-blue-600 hover:text-blue-700 p-1 rounded-md hover:bg-blue-50 transition-colors"
                      title="Edit team"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(team.id, team.name)}
                      className="text-blue-600 hover:text-blue-700 p-1 rounded-md hover:bg-blue-50 transition-colors"
                      title="Delete team"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="h-4 w-4" />
                  <span>{team._count?.users || 0} member{team._count?.users !== 1 ? 's' : ''}</span>
                </div>
                {canManage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openTeamDetails(team.id);
                      setTimeout(() => setShowAddUserModal(true), 100);
                    }}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                    title="Add user to team"
                  >
                    <UserPlus className="h-3 w-3 mr-1" />
                    Add User
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Team Details Sidebar */}
      {selectedTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-end">
          <div className="bg-white h-full w-full max-w-md shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                {teams.find((t) => t.id === selectedTeam)?.name || 'Team Details'}
              </h2>
              <button
                onClick={() => {
                  setSelectedTeam(null);
                  setTeamUsers([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              {canManage && (
                <div className="mb-6">
                  <button
                    onClick={() => setShowAddUserModal(true)}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User to Team
                  </button>
                </div>
              )}
              {teamUsers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No members</h3>
                  <p className="mt-1 text-sm text-gray-500">This team has no members yet.</p>
                  {canManage && (
                    <button
                      onClick={() => setShowAddUserModal(true)}
                      className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add First Member
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Team Members ({teamUsers.length})</h3>
                  {teamUsers.map((user: any) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                          {user.role}
                        </span>
                      </div>
                      {canManage && (
                        <button
                          onClick={() => handleRemoveUser(user.id)}
                          className="text-blue-600 hover:text-blue-700 p-1 rounded-md hover:bg-blue-50 transition-colors"
                          title="Remove from team"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Team Modal */}
      {(showCreateModal || editingTeam) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingTeam ? 'Edit Team' : 'Create New Team'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Team Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="e.g., Design Team, AI Team, Finance Team"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description <span className="text-gray-500 font-normal">(Optional)</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="Brief description of the team's purpose..."
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingTeam(null);
                  setFormData({ name: '', description: '' });
                }}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (editingTeam) {
                    handleUpdate(editingTeam);
                  } else {
                    handleCreate();
                  }
                }}
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                {editingTeam ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User to Team Modal */}
      {showAddUserModal && selectedTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Member to Team</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {getAvailableUsers().length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  All users are already in this team.
                </p>
              ) : (
                getAvailableUsers().map((user: any) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    onClick={() => {
                      handleAddUser(user.id);
                      setShowAddUserModal(false);
                    }}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                        {user.role}
                      </span>
                    </div>
                    <UserPlus className="h-4 w-4 text-blue-600" />
                  </div>
                ))
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowAddUserModal(false)}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
