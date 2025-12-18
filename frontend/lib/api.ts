/**
 * API Client Configuration
 * 
 * Axios instance configured with authentication interceptors and error handling.
 * Automatically adds JWT tokens to requests and handles token refresh on 401 errors.
 * 
 * @module api
 */

import axios from 'axios';
import { getSession } from 'next-auth/react';

// API base URL from environment variable or default to localhost
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Create axios instance with base URL
const api = axios.create({
  baseURL: API_URL,
});

/**
 * Request Interceptor
 * 
 * Automatically adds JWT access token to all API requests from the NextAuth session.
 * Token is added as Bearer token in Authorization header.
 */
api.interceptors.request.use(async (config) => {
  try {
    // Get current session from NextAuth
    const session = await getSession();
    
    // AccessToken is stored on the session object by NextAuth callback
    const accessToken = (session as { accessToken?: string })?.accessToken;
    
    // Add Authorization header if token exists
    if (session && accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
  } catch (error) {
    // Silently fail - will be handled by response interceptor if needed
  }
  return config;
});

/**
 * Response Interceptor
 * 
 * Handles 401 Unauthorized errors by attempting to refresh the access token.
 * If refresh succeeds, retries the original request. If refresh fails,
 * redirects user to login page.
 */
api.interceptors.response.use(
  (response) => {
    // Return successful responses as-is
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 (Unauthorized) and we haven't already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // Prevent infinite retry loop

      try {
        // Trigger NextAuth to refresh the token by getting a new session
        // This will trigger the JWT callback which handles token refresh
        const { getSession } = await import('next-auth/react');
        
        // Wait a bit for NextAuth to refresh the token via JWT callback
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Get refreshed session
        const session = await getSession();
        
        // Check if refresh was successful
        if (session && (session as { accessToken?: string; error?: string }).accessToken && !(session as { error?: string }).error) {
          // Update the authorization header with new token
          originalRequest.headers.Authorization = `Bearer ${(session as { accessToken?: string }).accessToken}`;
          // Retry the original request with new token
          return api(originalRequest);
        } else if ((session as { error?: string })?.error === 'RefreshAccessTokenError') {
          // Refresh failed, redirect to login
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
          return Promise.reject(new Error('Session expired. Please login again.'));
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    // For non-401 errors or if retry already attempted, reject with error
    return Promise.reject(error);
  }
);

export default api;
