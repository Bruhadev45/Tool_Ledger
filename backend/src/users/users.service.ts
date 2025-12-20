/**
 * Users Service
 *
 * Handles user management operations including CRUD operations, role management,
 * and user status updates. Enforces role-based access control (RBAC) and
 * multi-tenant isolation by organization.
 *
 * @module UsersService
 */

import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserApprovalStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all users in an organization
   *
   * Returns list of users with their basic information and team assignments.
   * Only accessible by Admins and Accountants for security.
   *
   * @param organizationId - ID of the organization (multi-tenant isolation)
   * @param requesterRole - Role of the user making the request
   * @returns Array of user objects without sensitive data
   * @throws ForbiddenException if requester is not Admin or Accountant
   */
  async findAll(organizationId: string, requesterRole: UserRole) {
    // Role-based access control: Only Admins and Accountants can list users
    if (requesterRole !== UserRole.ADMIN && requesterRole !== UserRole.ACCOUNTANT) {
      throw new ForbiddenException('Only admins and accountants can list users');
    }

    // Admins can see all users across all organizations
    // Accountants can only see users in their own organization
    const whereClause = requesterRole === UserRole.ADMIN ? {} : { organizationId };

    return this.prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        approvalStatus: true,
        assignedAdminId: true,
        createdAt: true,
        lastLoginAt: true,
        organizationId: true, // Include organizationId so frontend can show which org
        organization: {
          select: {
            id: true,
            name: true,
            domain: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        assignedAdmin: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create a new user in the organization
   *
   * Creates a new user account with hashed password. Optionally assigns user
   * to a team. Validates email uniqueness and team existence.
   *
   * @param organizationId - ID of the organization (multi-tenant isolation)
   * @param data - User creation data (email, password, name, role, optional teamId)
   * @param requesterRole - Role of the user making the request
   * @returns Created user object without password hash
   * @throws ForbiddenException if requester is not Admin or Accountant
   * @throws BadRequestException if email already exists or team is invalid
   */
  async create(
    organizationId: string,
    data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role: UserRole;
      teamId?: string;
    },
    requesterRole: UserRole,
  ) {
    // Role-based access control: Only Admins and Accountants can create users
    if (requesterRole !== UserRole.ADMIN && requesterRole !== UserRole.ACCOUNTANT) {
      throw new ForbiddenException('Only admins and accountants can create users');
    }

    // Check if user with this email already exists (globally unique)
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Hash password using bcrypt with salt rounds of 10
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Validate team exists in organization if teamId is provided
    if (data.teamId) {
      const team = await this.prisma.team.findFirst({
        where: { id: data.teamId, organizationId },
      });
      if (!team) {
        throw new BadRequestException('Team not found in your organization');
      }
    }

    // Create new user account
    // Admins and Accountants are auto-approved, regular users need approval
    const autoApprove = data.role === UserRole.ADMIN || data.role === UserRole.ACCOUNTANT;
    
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        organizationId,
        teamId: data.teamId || null,
        isActive: true, // New users are active by default
        approvalStatus: autoApprove ? UserApprovalStatus.APPROVED : UserApprovalStatus.PENDING_APPROVAL,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        approvalStatus: true,
        createdAt: true,
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // If user needs approval, notify admins
    if (!autoApprove) {
      const admins = await this.prisma.user.findMany({
        where: {
          organizationId,
          role: UserRole.ADMIN,
          isActive: true,
        },
      });

      await this.prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: 'user_registration',
          title: 'New User Registration',
          message: `${user.firstName} ${user.lastName} (${user.email}) has been created and requires approval.`,
          read: false,
          metadata: JSON.stringify({ userId: user.id, email: user.email }),
        })),
      });
    }

    return user;
  }

  /**
   * Get all active members of an organization
   *
   * Returns a simplified list of active users for sharing purposes.
   * Used when users need to select recipients for credential/invoice sharing.
   *
   * @param organizationId - ID of the organization
   * @returns Array of active user objects with basic information
   */
  async findOrganizationMembers(organizationId: string) {
    // All users in the organization can see other members for sharing purposes
    return this.prisma.user.findMany({
      where: {
        organizationId,
        isActive: true, // Only show active users
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
      orderBy: { firstName: 'asc' },
    });
  }

  /**
   * Get a single user by ID
   *
   * Returns user information if they exist in the specified organization.
   * Enforces multi-tenant isolation.
   *
   * @param id - User ID
   * @param organizationId - ID of the organization (multi-tenant isolation)
   * @returns User object or null if not found
   */
  async findOne(id: string, organizationId: string) {
    return this.prisma.user.findFirst({
      where: {
        id,
        organizationId, // Multi-tenant isolation: only return if in same organization
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  /**
   * Update a user's role
   *
   * Changes the role of a user (e.g., USER to ACCOUNTANT).
   * Only Admins and Accountants can perform this operation.
   *
   * @param userId - ID of the user to update
   * @param organizationId - ID of the organization (multi-tenant isolation)
   * @param newRole - New role to assign
   * @param requesterRole - Role of the user making the request
   * @returns Updated user object
   * @throws ForbiddenException if requester is not Admin or Accountant
   * @throws NotFoundException if user not found
   */
  async updateRole(
    userId: string,
    organizationId: string,
    newRole: UserRole,
    requesterRole: UserRole,
  ) {
    // Role-based access control
    if (requesterRole !== UserRole.ADMIN && requesterRole !== UserRole.ACCOUNTANT) {
      throw new ForbiddenException('Only admins and accountants can update user roles');
    }

    // Verify user exists in organization
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update user role
    return this.prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });
  }

  /**
   * Update a user's active status
   *
   * Activates or deactivates a user account. Deactivated users cannot login.
   * Only Admins and Accountants can perform this operation.
   *
   * @param userId - ID of the user to update
   * @param organizationId - ID of the organization (multi-tenant isolation)
   * @param isActive - New active status (true = active, false = inactive)
   * @param requesterRole - Role of the user making the request
   * @returns Updated user object
   * @throws ForbiddenException if requester is not Admin or Accountant
   * @throws NotFoundException if user not found
   */
  async updateStatus(
    userId: string,
    organizationId: string,
    isActive: boolean,
    requesterRole: UserRole,
  ) {
    // Role-based access control
    if (requesterRole !== UserRole.ADMIN && requesterRole !== UserRole.ACCOUNTANT) {
      throw new ForbiddenException('Only admins and accountants can update user status');
    }

    // Verify user exists in organization
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update user active status
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });
  }

  /**
   * Delete a user from the organization
   *
   * Permanently removes a user account. This operation cannot be undone.
   * Only Admins and Accountants can perform this operation.
   *
   * @param userId - ID of the user to delete
   * @param organizationId - ID of the organization (multi-tenant isolation)
   * @param requesterRole - Role of the user making the request
   * @returns Success message
   * @throws ForbiddenException if requester is not Admin or Accountant
   * @throws NotFoundException if user not found
   */
  async remove(userId: string, organizationId: string, requesterRole: UserRole) {
    // Role-based access control: Only Admins and Accountants can delete users
    if (requesterRole !== UserRole.ADMIN && requesterRole !== UserRole.ACCOUNTANT) {
      throw new ForbiddenException('Only admins and accountants can delete users');
    }

    // Admins can delete users from any organization
    // Accountants can only delete users from their own organization
    const whereClause: any = { id: userId };
    if (requesterRole !== UserRole.ADMIN) {
      whereClause.organizationId = organizationId;
    }

    // Verify user exists
    const user = await this.prisma.user.findFirst({
      where: whereClause,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Note: Self-deletion prevention should be handled in the controller
    // where we have access to the requester's userId

    // Permanently delete user from database
    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { message: 'User deleted successfully' };
  }

  /**
   * Approve a user registration
   *
   * Changes user's approval status from PENDING_APPROVAL to APPROVED.
   * Only Admins can perform this operation.
   *
   * @param userId - ID of the user to approve
   * @param organizationId - ID of the organization (multi-tenant isolation)
   * @param requesterRole - Role of the user making the request
   * @returns Updated user object
   * @throws ForbiddenException if requester is not Admin
   * @throws NotFoundException if user not found
   */
  async approveUser(userId: string, organizationId: string, requesterRole: UserRole) {
    // Only Admins can approve users
    if (requesterRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can approve user registrations');
    }

    // Verify user exists
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.approvalStatus === UserApprovalStatus.APPROVED) {
      throw new BadRequestException('User is already approved');
    }

    // Update approval status
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { approvalStatus: UserApprovalStatus.APPROVED },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        approvalStatus: true,
        createdAt: true,
      },
    });

    // Create notification for the approved user
    await this.prisma.notification.create({
      data: {
        userId: user.id,
        type: 'user_approved',
        title: 'Account Approved',
        message: 'Your account has been approved. You can now access the platform.',
        read: false,
      },
    });

    return updatedUser;
  }

  /**
   * Reject a user registration
   *
   * Changes user's approval status from PENDING_APPROVAL to REJECTED.
   * Only Admins can perform this operation.
   *
   * @param userId - ID of the user to reject
   * @param organizationId - ID of the organization (multi-tenant isolation)
   * @param requesterRole - Role of the user making the request
   * @param reason - Optional reason for rejection
   * @returns Updated user object
   * @throws ForbiddenException if requester is not Admin
   * @throws NotFoundException if user not found
   */
  async rejectUser(
    userId: string,
    organizationId: string,
    requesterRole: UserRole,
    reason?: string,
  ) {
    // Only Admins can reject users
    if (requesterRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can reject user registrations');
    }

    // Verify user exists
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.approvalStatus === UserApprovalStatus.REJECTED) {
      throw new BadRequestException('User is already rejected');
    }

    // Update approval status
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { approvalStatus: UserApprovalStatus.REJECTED },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        approvalStatus: true,
        createdAt: true,
      },
    });

    // Create notification for the rejected user
    await this.prisma.notification.create({
      data: {
        userId: user.id,
        type: 'user_rejected',
        title: 'Registration Rejected',
        message: reason
          ? `Your registration has been rejected. Reason: ${reason}`
          : 'Your registration has been rejected. Please contact your administrator for more information.',
        read: false,
        metadata: reason ? JSON.stringify({ reason }) : null,
      },
    });

    return updatedUser;
  }

  /**
   * Assign a user to an admin (admin-user hierarchy)
   *
   * Links a user to a specific admin for management purposes.
   * Only Admins can perform this operation.
   *
   * @param userId - ID of the user to assign
   * @param adminId - ID of the admin to assign the user to
   * @param organizationId - ID of the organization (multi-tenant isolation)
   * @param requesterRole - Role of the user making the request
   * @returns Updated user object
   * @throws ForbiddenException if requester is not Admin
   * @throws NotFoundException if user or admin not found
   * @throws BadRequestException if adminId is not an admin
   */
  async assignUserToAdmin(
    userId: string,
    adminId: string,
    organizationId: string,
    requesterRole: UserRole,
  ) {
    // Only Admins can assign users
    if (requesterRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can assign users to admins');
    }

    // Verify user exists
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify admin exists and is actually an admin
    const admin = await this.prisma.user.findFirst({
      where: { id: adminId, organizationId, role: UserRole.ADMIN },
    });

    if (!admin) {
      throw new BadRequestException('Admin not found or is not an admin');
    }

    // Update user's assigned admin
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { assignedAdminId: adminId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        assignedAdminId: true,
        assignedAdmin: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        createdAt: true,
      },
    });

    // Create notification for the assigned user
    await this.prisma.notification.create({
      data: {
        userId: user.id,
        type: 'user_assigned',
        title: 'Assigned to Admin',
        message: `You have been assigned to ${admin.firstName} ${admin.lastName} for management.`,
        read: false,
        metadata: JSON.stringify({ adminId: admin.id }),
      },
    });

    return updatedUser;
  }

  /**
   * Unassign a user from an admin
   *
   * Removes the admin-user assignment.
   * Only Admins can perform this operation.
   *
   * @param userId - ID of the user to unassign
   * @param organizationId - ID of the organization (multi-tenant isolation)
   * @param requesterRole - Role of the user making the request
   * @returns Updated user object
   * @throws ForbiddenException if requester is not Admin
   * @throws NotFoundException if user not found
   */
  async unassignUserFromAdmin(userId: string, organizationId: string, requesterRole: UserRole) {
    // Only Admins can unassign users
    if (requesterRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can unassign users from admins');
    }

    // Verify user exists
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Remove assigned admin
    return this.prisma.user.update({
      where: { id: userId },
      data: { assignedAdminId: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        assignedAdminId: true,
        createdAt: true,
      },
    });
  }
}
