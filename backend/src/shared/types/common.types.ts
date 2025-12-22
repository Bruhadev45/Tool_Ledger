/**
 * Common Type Definitions
 *
 * Shared types used across the application to avoid `any` types
 * and improve type safety.
 */

import { UserRole, UserApprovalStatus } from '@prisma/client';

/**
 * User payload extracted from JWT token
 */
export interface UserPayload {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  organizationId: string;
  mfaEnabled?: boolean;
  requiresMfaSetup?: boolean;
}

/**
 * Authenticated user object (from LocalStrategy)
 * Contains full user data after authentication
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  organizationId: string;
  mfaEnabled: boolean;
  requiresMfaSetup?: boolean;
}

/**
 * JWT token payload structure
 */
export interface JwtPayload {
  email: string;
  sub: string; // User ID
  role: UserRole;
  organizationId: string;
  iat?: number;
  exp?: number;
}

/**
 * Refresh token payload structure
 */
export interface RefreshTokenPayload extends JwtPayload {
  type: 'refresh';
}

/**
 * API response wrapper
 */
export interface ApiResponse<T = unknown> {
  data?: T;
  message?: string;
  error?: string;
  statusCode?: number;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  skip?: number;
  take?: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  message: string;
  error: string;
  statusCode: number;
  timestamp?: string;
  path?: string;
}

/**
 * Request context (for logging and audit)
 */
export interface RequestContext {
  userId?: string;
  organizationId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
}

/**
 * Service method result wrapper
 */
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

/**
 * File upload metadata
 */
export interface FileMetadata {
  filename: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * Database query options
 */
export interface QueryOptions {
  skip?: number;
  take?: number;
  orderBy?: Record<string, 'asc' | 'desc'>;
  where?: Record<string, unknown>;
}

/**
 * User creation data
 */
export interface UserCreationData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  teamId?: string;
}

/**
 * Credential share data
 */
export interface CredentialShareData {
  userId?: string;
  teamId?: string;
  permission: 'VIEW_ONLY' | 'EDIT' | 'NO_ACCESS';
}

/**
 * Invoice approval data
 */
export interface InvoiceApprovalData {
  notes?: string;
}
