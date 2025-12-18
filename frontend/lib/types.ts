/**
 * TypeScript Type Definitions
 * 
 * Centralized type definitions for the frontend application.
 * Provides type safety and consistency across components and API calls.
 * Extends Prisma-generated types with additional frontend-specific interfaces.
 * 
 * @module types
 */

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'USER' | 'ADMIN' | 'ACCOUNTANT';
  organizationId: string;
  mfaEnabled?: boolean;
  isActive?: boolean;
  teamId?: string | null;
  team?: Team;
  createdAt?: string;
  updatedAt?: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string | null;
  organizationId: string;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    users?: number;
  };
}

export interface Credential {
  id: string;
  name: string;
  username: string;
  password: string;
  apiKey?: string | null;
  notes?: string | null;
  tags: string[];
  organizationId: string;
  ownerId: string;
  owner?: User;
  createdAt: string;
  updatedAt: string;
  shares?: CredentialShare[];
  teamShares?: CredentialTeamShare[];
  invoiceLinks?: InvoiceCredentialLink[];
}

export interface CredentialShare {
  id: string;
  credentialId: string;
  userId: string;
  permission: 'VIEW_ONLY' | 'EDIT' | 'NO_ACCESS';
  sharedAt: string;
  revokedAt?: string | null;
  user?: User;
}

export interface CredentialTeamShare {
  id: string;
  credentialId: string;
  teamId: string;
  permission: 'VIEW_ONLY' | 'EDIT' | 'NO_ACCESS';
  sharedAt: string;
  revokedAt?: string | null;
  team?: Team;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number | string;
  currency: string;
  provider: string;
  billingDate: string;
  dueDate?: string | null;
  category?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  organizationId: string;
  uploadedById: string;
  approvedById?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  uploadedBy?: User;
  approvedBy?: User;
  credentialLinks?: InvoiceCredentialLink[];
}

export interface InvoiceCredentialLink {
  id: string;
  invoiceId: string;
  credentialId: string;
  createdAt: string;
  invoice?: Invoice;
  credential?: Credential;
}

export interface Comment {
  id: string;
  content: string;
  credentialId?: string | null;
  invoiceId?: string | null;
  userId: string;
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: User;
  replies?: Comment[];
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  metadata?: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  userId: string;
  organizationId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: string | null;
  createdAt: string;
  user?: User;
}

export interface MFASetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface SessionUser extends User {
  accessToken?: string;
}
