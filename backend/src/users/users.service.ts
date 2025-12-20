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
import { UserRole } from '@prisma/client';
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
    const whereClause =
      requesterRole === UserRole.ADMIN ? {} : { organizationId };

    return this.prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
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
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

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
}
