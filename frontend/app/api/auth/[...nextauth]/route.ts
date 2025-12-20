import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import axios from 'axios';

// IMPORTANT: Backend has global prefix '/api', so ensure URL includes /api
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const API_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;

async function refreshAccessToken(token: any) {
  try {
    // Refresh the access token
    const response = await axios.post(`${API_URL}/auth/refresh`, {
      refreshToken: token.refreshToken,
    });

    const refreshedTokens = response.data;

    // Also fetch the latest user profile to get updated role and other data
    let updatedRole = token.role;
    let updatedOrganizationId = token.organizationId;
    
    try {
      const profileResponse = await axios.get(`${API_URL}/auth/profile`, {
        headers: {
          Authorization: `Bearer ${refreshedTokens.access_token}`,
        },
      });
      
      if (profileResponse.data) {
        updatedRole = profileResponse.data.role;
        updatedOrganizationId = profileResponse.data.organizationId;
      }
    } catch (profileError) {
      // If profile fetch fails, continue with existing role data
      console.warn('Failed to refresh user profile:', profileError);
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + (5 * 60 * 1000), // 5 minutes (refresh more often for real-time sync)
      refreshToken: token.refreshToken,
      role: updatedRole,
      organizationId: updatedOrganizationId,
    };
  } catch (error) {
    console.error('Error refreshing access token', error);
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}

const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        mfaToken: { label: 'MFA Token', type: 'text', required: false },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // First attempt login
          const loginResponse = await axios.post(`${API_URL}/auth/login`, {
            email: credentials.email,
            password: credentials.password,
          });

          // If MFA required
          if (loginResponse.data.requiresMFA) {
            if (!credentials.mfaToken) {
              // Throw a custom error that NextAuth will pass through
              const error: any = new Error('MFA_REQUIRED');
              error.name = 'MFA_REQUIRED';
              error.code = 'MFA_REQUIRED';
              throw error;
            }

            // Verify MFA and login
            // Clean token before sending
            const cleanToken = credentials.mfaToken.trim().replace(/\s/g, '');
            
            if (!cleanToken || cleanToken.length < 6) {
              throw new Error('MFA token must be 6 digits');
            }

            try {
              const mfaResponse = await axios.post(`${API_URL}/auth/login/mfa`, {
                userId: loginResponse.data.userId,
                token: cleanToken,
              });

              // Check if response has access_token (successful login)
              if (!mfaResponse.data || !mfaResponse.data.access_token || !mfaResponse.data.user) {
                throw new Error('Invalid MFA token or login failed');
              }

              // Return user data
              return {
                id: mfaResponse.data.user.id,
                email: mfaResponse.data.user.email,
                name: `${mfaResponse.data.user.firstName || ''} ${mfaResponse.data.user.lastName || ''}`.trim() || mfaResponse.data.user.email,
                role: mfaResponse.data.user.role,
                organizationId: mfaResponse.data.user.organizationId,
                accessToken: mfaResponse.data.access_token,
                refreshToken: mfaResponse.data.refresh_token,
                accessTokenExpires: Date.now() + (5 * 60 * 1000), // 5 minutes from now (for real-time sync)
              };
            } catch (mfaError: any) {
              // Handle MFA verification errors
              if (mfaError.response?.status === 401) {
                throw new Error('Invalid MFA code. Please check your authenticator app and try again.');
              }
              if (mfaError.response?.data?.message) {
                throw new Error(mfaError.response.data.message);
              }
              throw mfaError;
            }
          }

          // Ensure we have the required user data
          if (!loginResponse.data.user || !loginResponse.data.access_token) {
            console.error('Invalid login response:', loginResponse.data);
            throw new Error('Invalid response from server. Missing user data or access token.');
          }

          const userData = {
            id: loginResponse.data.user.id,
            email: loginResponse.data.user.email,
            name: `${loginResponse.data.user.firstName || ''} ${loginResponse.data.user.lastName || ''}`.trim() || loginResponse.data.user.email,
            role: loginResponse.data.user.role,
            organizationId: loginResponse.data.user.organizationId,
            accessToken: loginResponse.data.access_token,
            refreshToken: loginResponse.data.refresh_token,
            accessTokenExpires: Date.now() + (5 * 60 * 1000), // 5 minutes from now (for real-time sync)
          };

          return userData;
        } catch (error: any) {
          
          // Check for MFA_REQUIRED in multiple places
          if (error.message === 'MFA_REQUIRED' || 
              error.name === 'MFA_REQUIRED' || 
              error.code === 'MFA_REQUIRED') {
            // Re-throw with a specific format that NextAuth will pass through
            const mfaError: any = new Error('MFA_REQUIRED');
            mfaError.name = 'MFA_REQUIRED';
            mfaError.code = 'MFA_REQUIRED';
            throw mfaError;
          }
          
          // Check if backend is not running
          if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
            throw new Error('Backend server is not running. Please start it with: cd backend && npm run start:dev');
          }
          
          // Check for network errors
          if (error.message?.includes('Network Error') || error.code === 'ERR_NETWORK') {
            throw new Error('Cannot connect to backend. Make sure it\'s running on http://localhost:3001');
          }
          
          // Return specific error messages from backend
          if (error.response?.data?.message) {
            const backendMessage = error.response.data.message;
            if (backendMessage.includes('Invalid credentials') || backendMessage.includes('Invalid email') || backendMessage.includes('Invalid password')) {
              throw new Error('Invalid email or password');
            }
            throw new Error(backendMessage);
          }
          
          if (error.response?.status === 401) {
            throw new Error('Invalid email or password');
          }
          
          if (error.response?.status === 404) {
            throw new Error('Authentication endpoint not found. Please check backend configuration.');
          }
          
          // For unknown errors, throw a descriptive error message
          throw new Error(error.message || 'Authentication failed. Please check your credentials and ensure the backend is running.');
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign in
      if (user) {
        token.accessToken = (user as any).accessToken;
        token.refreshToken = (user as any).refreshToken;
        token.accessTokenExpires = (user as any).accessTokenExpires;
        token.role = (user as any).role;
        token.organizationId = (user as any).organizationId;
        return token;
      }

      // Return previous token if the access token has not expired yet
      if (token.accessTokenExpires && Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // Access token has expired, try to update it
      return await refreshAccessToken(token);
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).organizationId = token.organizationId;
        (session as any).accessToken = token.accessToken;
        (session as any).error = token.error;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
