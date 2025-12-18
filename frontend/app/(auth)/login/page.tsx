'use client';

import { useState, useEffect, useRef } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Lock, Mail, Shield, Loader2, Eye, EyeOff, ChevronDown, Users, FileText } from 'lucide-react';
import api from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [requiresMFA, setRequiresMFA] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAccountDropdown(false);
      }
    };

    if (showAccountDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAccountDropdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Reset MFA state if email/password changes
    if (requiresMFA && (!email || !password)) {
      setRequiresMFA(false);
      setMfaToken('');
    }

    try {
      // If we already have MFA token, proceed with NextAuth signIn
      if (requiresMFA && mfaToken) {
        const result = await signIn('credentials', {
          email: email.trim(),
          password,
          mfaToken: mfaToken,
          redirect: false,
        });

        if (result?.error) {
          toast.error('Invalid MFA code. Please try again.');
          setMfaToken('');
        } else if (result?.ok) {
          toast.success('Logged in successfully!');
          router.push('/dashboard');
        }
        setLoading(false);
        return;
      }

      // First, check if MFA is required by calling the login endpoint directly
      try {
        const loginResponse = await api.post('/auth/login', {
          email: email.trim(),
          password,
        });

        // Check if MFA is required
        if (loginResponse.data.requiresMFA) {
          setRequiresMFA(true);
          setLoading(false);
          toast.success('Please enter your MFA code');
          return;
        }

        // If no MFA required, proceed with NextAuth signIn
        const result = await signIn('credentials', {
          email: email.trim(),
          password,
          redirect: false,
        });

        if (result?.error) {
          let errorMessage = 'Login failed';
          
          if (result.error === 'CredentialsSignin') {
            errorMessage = 'Invalid email or password. Please check your credentials and ensure the backend is running.';
          } else if (result.error.includes('Backend server is not running') || result.error.includes('ECONNREFUSED')) {
            errorMessage = 'Backend server is not running. Please start it with: cd backend && npm run start:dev';
          } else if (result.error.includes('Cannot connect') || result.error.includes('Network Error')) {
            errorMessage = 'Cannot connect to backend. Make sure it\'s running on http://localhost:3001';
          } else if (result.error.includes('Invalid credentials') || result.error.includes('Invalid email') || result.error.includes('Invalid password')) {
            errorMessage = 'Invalid email or password. Please check your credentials.';
          } else {
            errorMessage = result.error;
          }
          
          toast.error(errorMessage);
        } else if (result?.ok) {
          toast.success('Logged in successfully!');
          router.push('/dashboard');
        } else {
          toast.error('Login failed. Please try again.');
        }
      } catch (apiError: any) {
        // If the API call fails, it might be because credentials are wrong
        // Let NextAuth handle it
        const result = await signIn('credentials', {
          email: email.trim(),
          password,
          redirect: false,
        });

        if (result?.error) {
          let errorMessage = 'Login failed';
          
          if (result.error === 'CredentialsSignin') {
            errorMessage = 'Invalid email or password. Please check your credentials.';
          } else {
            errorMessage = result.error;
          }
          
          toast.error(errorMessage);
        } else if (result?.ok) {
          toast.success('Logged in successfully!');
          router.push('/dashboard');
        }
      }
    } catch (error: any) {
      console.error('Login exception:', error);
      toast.error(error?.message || 'An error occurred. Make sure the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  const defaultCredentials = [
    { email: 'admin@toolledger.com', password: 'password123', role: 'Admin', icon: Shield },
    { email: 'user1@toolledger.com', password: 'password123', role: 'User 1', icon: Users },
    { email: 'user2@toolledger.com', password: 'password123', role: 'User 2', icon: Users },
    { email: 'user3@toolledger.com', password: 'password123', role: 'User 3', icon: Users },
    { email: 'accountant1@toolledger.com', password: 'password123', role: 'Accountant 1', icon: FileText },
    { email: 'accountant2@toolledger.com', password: 'password123', role: 'Accountant 2', icon: FileText },
  ];

  const fillCredentials = (credEmail: string, credPassword: string, role: string) => {
    setEmail(credEmail);
    setPassword(credPassword);
    setSelectedAccount(role);
    setShowCredentials(false);
    setShowAccountDropdown(false);
  };

  const handleAccountSelect = (account: typeof defaultCredentials[0]) => {
    fillCredentials(account.email, account.password, account.role);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 px-4 py-8">
      <div className="max-w-md w-full">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-lg mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">ToolLedger</h1>
          <p className="text-gray-600">Credential Management Platform</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-gray-100">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
            Sign in to your account
          </h2>

          {/* Demo Account Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Demo Accounts
            </label>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg bg-white hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {selectedAccount ? (
                    <>
                      {defaultCredentials.find(c => c.role === selectedAccount)?.icon && (
                        <div className="flex items-center gap-2">
                          {(() => {
                            const Icon = defaultCredentials.find(c => c.role === selectedAccount)!.icon;
                            return <Icon className="w-4 h-4 text-blue-600" />;
                          })()}
                          <span className="text-sm font-medium text-gray-900">
                            {selectedAccount} - {email}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-gray-500">Choose a demo account...</span>
                  )}
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showAccountDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showAccountDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                  {defaultCredentials.map((account, idx) => {
                    const Icon = account.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleAccountSelect(account)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-blue-50"
                      >
                        <div className="flex-shrink-0 text-gray-600">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {account.role}
                          </p>
                          <p className="text-xs text-gray-500">{account.email}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                  placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
              <input
                id="password"
                name="password"
                  type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                  className="block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                  placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* MFA Field */}
            {requiresMFA && (
              <div className="animate-in slide-in-from-top-2">
                <label htmlFor="mfaToken" className="block text-sm font-medium text-gray-700 mb-2">
                  MFA Code
                </label>
                <input
                  id="mfaToken"
                  name="mfaToken"
                  type="text"
                  required
                  maxLength={6}
                  className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm text-center text-2xl tracking-widest"
                  placeholder="000000"
                  value={mfaToken}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setMfaToken(value);
                  }}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                />
                <p className="mt-2 text-xs text-gray-500 text-center">
                  Enter the 6-digit code from your authenticator app
                  <br />
                  <span className="text-gray-400">(For testing: use 000000)</span>
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  Sign in
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center space-y-2">
            <p className="text-xs">
              <Link href="/reset-password" className="font-medium text-blue-600 hover:text-blue-500">
                Forgot your password?
              </Link>
            </p>
            <p className="text-xs text-gray-500">
              Don't have an account?{' '}
              <Link href="/signup" className="font-medium text-blue-600 hover:text-blue-500">
                Sign up
              </Link>
            </p>
            <p className="text-xs text-gray-500">
              Secure credential management with enterprise-grade security
            </p>
            {process.env.NODE_ENV === 'development' && (
              <p className="text-xs text-blue-600 font-medium">
                💡 Make sure backend is running on http://localhost:3001
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
