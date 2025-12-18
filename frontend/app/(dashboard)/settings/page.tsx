'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Lock, Eye, EyeOff, Users, UserCheck } from 'lucide-react';
import Image from 'next/image';
import type { MFASetup, SessionUser } from '@/lib/types';

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface ShowPasswords {
  current: boolean;
  new: boolean;
  confirm: boolean;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [mfaSetup, setMfaSetup] = useState<MFASetup | null>(null);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState<ShowPasswords>({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Teams and Users info (read-only)
  const [teams, setTeams] = useState<any[]>([]);
  const [organizationUsers, setOrganizationUsers] = useState<any[]>([]);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [userTeam, setUserTeam] = useState<any>(null);

  // Load MFA status from session
  useEffect(() => {
    if (session?.user) {
      const user = session.user as SessionUser;
      setMfaEnabled(user.mfaEnabled || false);
    }
  }, [session]);

  // Load teams and users info
  useEffect(() => {
    loadTeamsAndUsersInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const loadTeamsAndUsersInfo = async () => {
    try {
      setLoadingInfo(true);
      
      // Load teams (all users can view teams)
      const teamsRes = await api.get('/teams');
      setTeams(teamsRes.data || []);

      // Load organization members (accessible to all users)
      const membersRes = await api.get('/users/members');
      setOrganizationUsers(membersRes.data || []);
      
      // Find user's team by checking team details
      if (session?.user && teamsRes.data?.length > 0) {
        const user = session.user as SessionUser;
        // Try to find user's team by checking each team's members
        for (const team of teamsRes.data) {
          try {
            const teamDetails = await api.get(`/teams/${team.id}`);
            const isMember = teamDetails.data?.users?.some((u: any) => u.id === user.id);
            if (isMember) {
              setUserTeam(team);
              break;
            }
          } catch (error) {
            // Continue to next team if error
            continue;
          }
        }
      }
    } catch (error: unknown) {
      console.error('Error loading teams and users info:', error);
      toast.error('Failed to load teams and users information');
    } finally {
      setLoadingInfo(false);
    }
  };

  const handleSetupMFA = async () => {
    try {
      const res = await api.post<MFASetup>('/auth/mfa/setup');
      setMfaSetup(res.data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to setup MFA';
      toast.error(message);
    }
  };

  const handleEnableMFA = async () => {
    try {
      setLoading(true);
      await api.post('/auth/mfa/enable', { token: mfaToken });
      toast.success('MFA enabled successfully');
      setMfaEnabled(true);
      setMfaSetup(null);
      setMfaToken('');
      // Refresh session to get updated MFA status
      window.location.reload();
    } catch (error: unknown) {
      const message = error instanceof Error 
        ? error.message 
        : (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Invalid MFA token';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (passwordData.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(passwordData.newPassword)) {
      toast.error('Password must contain at least one uppercase letter, one lowercase letter, and one number');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.currentPassword === passwordData.newPassword) {
      toast.error('New password must be different from current password');
      return;
    }

    try {
      setPasswordLoading(true);
      await api.post('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      toast.success('Password changed successfully');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setShowPasswordChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error 
        ? error.message 
        : (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to change password';
      toast.error(message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const role = (session?.user as SessionUser)?.role;

  return (
    <div className="space-y-4 sm:space-y-6 w-full">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Settings</h1>

      {/* Account Settings */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Change Password</h3>
            <p className="text-sm text-gray-500 mb-4">
              Update your account password. Make sure it&apos;s strong and unique.
            </p>
            
            {!showPasswordChange ? (
              <button
                onClick={() => setShowPasswordChange(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <Lock className="h-4 w-4 mr-2" />
                Change Password
              </button>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.current ? 'text' : 'password'}
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.current ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.new ? 'text' : 'password'}
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm pr-10"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.new ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Must be at least 8 characters with uppercase, lowercase, and number
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm pr-10"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.confirm ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {passwordLoading ? 'Changing...' : 'Change Password'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordChange(false);
                      setPasswordData({
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: '',
                      });
                    }}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Security Settings */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Security</h2>

        {role === 'ADMIN' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700">Multi-Factor Authentication</h3>
              <p className="text-sm text-gray-500">
                MFA is required for Admin accounts. Set up TOTP authentication using an authenticator app.
              </p>
            </div>

            {mfaEnabled ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-blue-800">MFA is currently enabled</span>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm('Are you sure you want to reset MFA? This will clear all MFA settings and you will need to set it up again.')) {
                      return;
                    }
                    try {
                      setLoading(true);
                      await api.post('/auth/mfa/reset');
                      toast.success('MFA reset successfully');
                      setMfaEnabled(false);
                      setMfaSetup(null);
                      setMfaToken('');
                      window.location.reload();
                    } catch (error: unknown) {
                      const message = error instanceof Error 
                        ? error.message 
                        : (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to reset MFA';
                      toast.error(message);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Resetting...' : 'Reset MFA'}
                </button>
              </div>
            ) : (
              <>
                {!mfaSetup ? (
                  <button
                    onClick={handleSetupMFA}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Setting up...' : 'Setup MFA'}
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-700 mb-2">
                        Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):
                      </p>
                      <Image src={mfaSetup.qrCodeUrl} alt="MFA QR Code" width={192} height={192} className="border border-gray-200 rounded-lg" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-700 mb-2">Or enter this secret manually:</p>
                      <code className="text-xs bg-gray-100 p-2 rounded block w-full max-w-md break-all">{mfaSetup.secret}</code>
                    </div>
                    <div>
                      <p className="text-sm text-gray-700 mb-2 font-semibold">Backup codes (save these securely):</p>
                      <div className="grid grid-cols-2 gap-2 max-w-md">
                        {mfaSetup.backupCodes?.map((code: string) => (
                          <code key={code} className="text-xs bg-gray-100 p-2 rounded text-center font-mono">
                            {code}
                          </code>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">These codes can be used to access your account if you lose your authenticator device.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Enter 6-digit code from your authenticator app:
                        <span className="text-xs text-gray-400 ml-2">(For testing: use 000000)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="000000"
                        maxLength={6}
                        value={mfaToken}
                        onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, ''))}
                        className="block w-full max-w-md rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      />
                      <button
                        onClick={handleEnableMFA}
                        disabled={loading || mfaToken.length !== 6}
                        className="mt-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Enabling...' : 'Enable MFA'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Teams Information (Read-only) */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Teams Information
        </h2>
        
        {loadingInfo ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* User's Current Team */}
            {userTeam ? (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-sm font-medium text-blue-900 mb-2">Your Team</h3>
                <p className="text-sm text-blue-800 font-semibold">{userTeam.name}</p>
                {userTeam.description && (
                  <p className="text-xs text-blue-700 mt-1">{userTeam.description}</p>
                )}
              </div>
            ) : (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600">You are not assigned to any team.</p>
              </div>
            )}

            {/* All Teams in Organization */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">All Teams ({teams.length})</h3>
              {teams.length === 0 ? (
                <p className="text-sm text-gray-500">No teams in your organization.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {teams.map((team: any) => (
                    <div
                      key={team.id}
                      className={`p-3 border rounded-lg ${
                        userTeam?.id === team.id
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {team.name}
                            {userTeam?.id === team.id && (
                              <span className="ml-2 text-xs text-blue-600 font-medium">(Your Team)</span>
                            )}
                          </p>
                          {team.description && (
                            <p className="text-xs text-gray-600 mt-1">{team.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <UserCheck className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-500">
                              {team._count?.users || 0} member{team._count?.users !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Users Information (Read-only) */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Organization Users
        </h2>
        
        {loadingInfo ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                All Users ({organizationUsers.length})
              </h3>
              {organizationUsers.length === 0 ? (
                <p className="text-sm text-gray-500">No users in your organization.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {organizationUsers.map((user: any) => {
                    const isCurrentUser = (session?.user as SessionUser)?.id === user.id;
                    return (
                      <div
                        key={user.id}
                        className={`p-3 border rounded-lg ${
                          isCurrentUser
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {user.firstName} {user.lastName}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs text-blue-600">(You)</span>
                              )}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">{user.email}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  user.role === 'ADMIN'
                                    ? 'bg-blue-100 text-blue-800'
                                    : user.role === 'ACCOUNTANT'
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {user.role}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
